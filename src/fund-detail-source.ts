import type {
  FundDetailAvailability,
  FundPerformancePoint,
  FundResearchDetail,
  FundStockHolding
} from "./fund-types.js";

const CACHE_TTL_MS = 10 * 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const PERFORMANCE_SOURCE = "东方财富基金历史净值";

type FetchImplementation = typeof fetch;

interface CacheEntry {
  expiresAt: number;
  value: Promise<FundResearchDetail>;
}

export interface EastmoneyFundDetailSourceOptions {
  fetch?: FetchImplementation;
  clock?: () => Date;
}

export function publishedNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  if (text === "" || text === "-") return undefined;
  const parsed = Number(text.replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseFundHistoryResponse(text: string): FundPerformancePoint[] {
  const payload = JSON.parse(text) as { Data?: { LSJZList?: unknown } };
  if (!Array.isArray(payload.Data?.LSJZList)) throw new Error("Fund history response has no LSJZList.");

  return payload.Data.LSJZList.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const values = row as Record<string, unknown>;
    const date = typeof values.FSRQ === "string" ? values.FSRQ.trim() : "";
    const unitNav = publishedNumber(values.DWJZ);
    const cumulativeNav = publishedNumber(values.LJJZ);
    const value = cumulativeNav ?? unitNav;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || value === undefined) return [];
    return [{
      date,
      value,
      ...(unitNav === undefined ? {} : { unitNav }),
      ...(cumulativeNav === undefined ? {} : { cumulativeNav })
    }];
  }).sort((left, right) => left.date.localeCompare(right.date));
}

export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function decodedHoldingsContent(text: string): string {
  const match = text.match(/\bcontent\s*:\s*("(?:\\.|[^"\\])*")/s);
  if (!match) throw new Error("Fund holdings response has no content.");
  return JSON.parse(match[1]) as string;
}

function tableCells(row: string): string[] {
  return [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => plainText(match[1]));
}

export function parseFundHoldingsResponse(text: string): { items: FundStockHolding[]; reportDate?: string } {
  const content = decodedHoldingsContent(text);
  const reportDate = plainText(content).match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (!reportDate) return { items: [] };

  const items = [...content.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((match) => {
    const cells = tableCells(match[1]);
    const rank = publishedNumber(cells[0]);
    const stockCode = cells[1]?.trim();
    const stockName = cells[2]?.trim();
    const navRatio = publishedNumber(cells[6]);
    if (rank === undefined || !stockCode || !stockName || navRatio === undefined) return [];
    const sharesWan = publishedNumber(cells[7]);
    const marketValueWan = publishedNumber(cells[8]);
    return [{
      rank,
      stockCode,
      stockName,
      navRatio,
      ...(sharesWan === undefined ? {} : { sharesWan }),
      ...(marketValueWan === undefined ? {} : { marketValueWan }),
      reportDate
    }];
  });

  return { items: items.slice(0, 10), reportDate };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function historyStartDate(today: Date): string {
  const start = new Date(today);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  start.setUTCDate(start.getUTCDate() - 10);
  return formatDate(start);
}

export class EastmoneyFundDetailSource {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly fetchImplementation: FetchImplementation;
  private readonly clock: () => Date;

  constructor(options: EastmoneyFundDetailSourceOptions = {}) {
    this.fetchImplementation = options.fetch ?? fetch;
    this.clock = options.clock ?? (() => new Date());
  }

  getResearchDetail(code: string): Promise<FundResearchDetail> {
    const now = this.clock().getTime();
    const cached = this.cache.get(code);
    if (cached && cached.expiresAt > now) return cached.value;

    const value = this.load(code, new Date(now));
    this.cache.set(code, { expiresAt: now + CACHE_TTL_MS, value });
    void value.catch(() => {
      if (this.cache.get(code)?.value === value) this.cache.delete(code);
    });
    return value;
  }

  private async load(code: string, today: Date): Promise<FundResearchDetail> {
    const historyParams = new URLSearchParams({
      fundCode: code,
      pageIndex: "1",
      pageSize: "400",
      startDate: historyStartDate(today),
      endDate: formatDate(today)
    });
    const holdingsParams = new URLSearchParams({ type: "jjcc", code, topline: "10", year: "", month: "" });
    const [historyResult, holdingsResult] = await Promise.allSettled([
      this.fetchText(`https://api.fund.eastmoney.com/f10/lsjz?${historyParams}`),
      this.fetchText(`https://fundf10.eastmoney.com/FundArchivesDatas.aspx?${holdingsParams}`)
    ]);

    let history: FundPerformancePoint[] = [];
    let performanceAvailability: FundDetailAvailability["performance"] = "unavailable";
    if (historyResult.status === "fulfilled") {
      try {
        history = parseFundHistoryResponse(historyResult.value);
        performanceAvailability = history.length ? "available" : "empty";
      } catch {
        performanceAvailability = "unavailable";
      }
    }

    let holdings: { items: FundStockHolding[]; reportDate?: string } = { items: [] };
    let holdingsAvailability: FundDetailAvailability["holdings"] = "unavailable";
    if (holdingsResult.status === "fulfilled") {
      try {
        holdings = parseFundHoldingsResponse(holdingsResult.value);
        holdingsAvailability = holdings.items.length ? "available" : "empty";
      } catch {
        holdingsAvailability = "unavailable";
      }
    }

    return {
      stockHoldings: holdings.items,
      ...(holdings.reportDate === undefined ? {} : { holdingsReportDate: holdings.reportDate }),
      performanceHistory: history,
      performanceSource: PERFORMANCE_SOURCE,
      availability: {
        holdings: holdingsAvailability,
        performance: performanceAvailability
      }
    };
  }

  private async fetchText(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImplementation(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://fund.eastmoney.com/" }
      });
      if (!response.ok) throw new Error(`Eastmoney returned HTTP ${response.status}.`);
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }
}
