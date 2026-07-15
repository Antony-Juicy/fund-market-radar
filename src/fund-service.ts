import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { EastmoneyFundDetailSource } from "./fund-detail-source.js";
import { filterAndSortFunds } from "./fund-helpers.js";
import type { FundDetail, FundMarket, FundMatchBy, FundQuote, FundResearchDetail, FundSnapshot, FundSort } from "./fund-types.js";

export interface FundDataAdapter {
  listQuotes(): Promise<FundQuote[]>;
  getDetail(code: string): Promise<FundDetail | undefined>;
}

export interface FundResearchDetailSource {
  getResearchDetail(code: string): Promise<FundResearchDetail>;
}

export class PythonFundAdapter implements FundDataAdapter {
  constructor(
    private readonly scriptPath = resolve(process.cwd(), "python/fund_adapter.py"),
    private readonly pythonCommand = process.env.PYTHON ?? "python3",
    private readonly sample = process.env.FUND_DATA_MODE !== "real"
  ) {}

  async listQuotes(): Promise<FundQuote[]> {
    const payload = await runPythonAdapter(this.pythonCommand, this.scriptPath, this.sample);
    return payload.quotes as FundQuote[];
  }

  async getDetail(code: string): Promise<FundDetail | undefined> {
    const quote = (await this.listQuotes()).find((item) => item.code === code);
    return quote ? {
      ...quote,
      industryAllocation: [],
      stockHoldings: [],
      performanceHistory: [],
      performanceSource: "东方财富基金历史净值",
      availability: { holdings: "empty", performance: "empty" }
    } : undefined;
  }
}

export class EastmoneyFundAdapter implements FundDataAdapter {
  private cache?: { expiresAt: number; quotes: Promise<FundQuote[]> };

  constructor(
    private readonly detailSource: FundResearchDetailSource = new EastmoneyFundDetailSource()
  ) {}

  async listQuotes(): Promise<FundQuote[]> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.quotes;

    const quotes = Promise.all([fetchEtfQuotes(), fetchOpenFundQuotes()]).then(([etfs, openFunds]) => {
      const items = [...etfs, ...openFunds];
      if (!items.length) throw new Error("Eastmoney returned no fund quotes.");
      return items;
    });
    this.cache = { expiresAt: Date.now() + 5 * 60_000, quotes };
    try {
      return await quotes;
    } catch (error) {
      this.cache = undefined;
      throw error;
    }
  }

  async getDetail(code: string): Promise<FundDetail | undefined> {
    const quote = (await this.listQuotes()).find((item) => item.code === code);
    if (!quote) return undefined;

    const research = await this.detailSource.getResearchDetail(code);
    return mergeQuoteAndResearch(quote, research);
  }
}

export class FundService {
  constructor(private readonly adapter: FundDataAdapter) {}

  async snapshot(keyword: string, market: FundMarket, sort: FundSort, limit: number, matchBy: FundMatchBy = "all"): Promise<FundSnapshot> {
    const quotes = await this.adapter.listQuotes();
    const items = filterAndSortFunds(quotes, keyword, market, sort, limit, matchBy);
    const updatedAt = quotes.reduce((latest, item) => item.updatedAt > latest ? item.updatedAt : latest, "");
    return {
      keyword, matchBy, market, sort, limit,
      dataDate: quotes[0]?.dataDate ?? new Date().toISOString().slice(0, 10),
      updatedAt, isTradingDay: quotes.some((item) => item.isTradingDay), items
    };
  }

  getDetail(code: string): Promise<FundDetail | undefined> {
    return this.adapter.getDetail(code);
  }
}

interface AdapterPayload { quotes: unknown[]; }
interface RankingReturns { today?: number; week?: number; month?: number; custom?: number; }

function mergeQuoteAndResearch(quote: FundQuote, research: FundResearchDetail): FundDetail {
  return { ...research, ...quote, industryAllocation: [] };
}

async function runPythonAdapter(command: string, scriptPath: string, sample: boolean): Promise<AdapterPayload> {
  return new Promise((resolvePayload, rejectPayload) => {
    const args = [scriptPath];
    if (sample) args.push("--sample");
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), 15_000);
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", (error) => { clearTimeout(timer); rejectPayload(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) { rejectPayload(new Error(stderr.trim() || `Fund adapter exited with code ${code}.`)); return; }
      try {
        const payload = JSON.parse(stdout) as AdapterPayload & { error?: string };
        if (payload.error) throw new Error(payload.error);
        resolvePayload(payload);
      } catch (error) { rejectPayload(error); }
    });
    child.stdin.end(JSON.stringify({}) + "\n");
  });
}

async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0", Referer: "https://fund.eastmoney.com/" } });
    if (!response.ok) throw new Error(`Eastmoney returned HTTP ${response.status}.`);
    return await response.text();
  } finally { clearTimeout(timer); }
}

export function parsePublishedNumber(value: string | undefined | null): number | undefined {
  if (value === undefined || value === null || value.trim() === "" || value === "-") return undefined;
  const parsed = Number(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rankingRows(text: string): string[][] {
  const match = text.match(/datas:\[(.*?)\],allRecords/s);
  if (!match && /ErrCode\s*:\s*-999/.test(text) && /无访问权限/.test(text)) return [];
  if (!match) throw new Error("Fund-ranking response could not be parsed.");
  return (JSON.parse(`[${match[1]}]`) as string[]).map((row) => row.split(","));
}

export function parseOpenFundRankingText(text: string): Map<string, RankingReturns> {
  const result = new Map<string, RankingReturns>();
  for (const row of rankingRows(text)) {
    const values = {
      today: parsePublishedNumber(row[6]),
      week: parsePublishedNumber(row[7]),
      month: parsePublishedNumber(row[8]),
      custom: parsePublishedNumber(row[18])
    };
    result.set(row[0], Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)));
  }
  return result;
}

export function parseExchangeFundRankingText(text: string): Map<string, RankingReturns> {
  const result = new Map<string, RankingReturns>();
  for (const row of rankingRows(text)) {
    const values = { week: parsePublishedNumber(row[6]), month: parsePublishedNumber(row[7]) };
    result.set(row[0], Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)));
  }
  return result;
}

async function fetchRankingText(params: Record<string, string>): Promise<string> {
  const query = new URLSearchParams({
    op: "ph", rs: "", gs: "0", sc: "1nzf", st: "desc", pi: "1", pn: "30000", v: String(Math.random()), ...params
  });
  return fetchText(`https://fund.eastmoney.com/data/rankhandler.aspx?${query}`);
}

async function fetchOpenFundRanking(startDate: string, endDate: string): Promise<Map<string, RankingReturns>> {
  return parseOpenFundRankingText(await fetchRankingText({
    dt: "kf", ft: "all", sd: startDate, ed: endDate, qdii: "", tabSubtype: ",,,,,", dx: "1"
  }));
}

async function fetchExchangeFundRanking(): Promise<Map<string, RankingReturns>> {
  return parseExchangeFundRankingText(await fetchRankingText({ dt: "fb", ft: "ct" }));
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function fetchEtfQuotes(): Promise<FundQuote[]> {
  const fetchPage = async (page: number) => {
    const params = new URLSearchParams({
      pn: String(page), pz: "100", po: "1", np: "1", ut: "bd1d9ddb04089700cf9c27f6f7426281",
      fltt: "2", invt: "2", fid: "f12", fs: "b:MK0021,b:MK0022,b:MK0023,b:MK0024,b:MK0827",
      fields: "f2,f3,f5,f6,f12,f14,f124,f297,f441"
    });
    const text = await fetchText(`https://push2delay.eastmoney.com/api/qt/clist/get?${params}`);
    return JSON.parse(text) as { data?: { total?: number; diff?: Array<Record<string, unknown>> } };
  };
  const [first, ranking] = await Promise.all([fetchPage(1), fetchExchangeFundRanking()]);
  const total = first.data?.total ?? first.data?.diff?.length ?? 0;
  const pageCount = Math.ceil(total / 100);
  const remaining = pageCount > 1
    ? await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => fetchPage(index + 2)))
    : [];
  const rows = [first, ...remaining].flatMap((payload) => payload.data?.diff ?? []);

  return rows.flatMap((row) => {
    if (typeof row.f12 !== "string" || typeof row.f14 !== "string" || typeof row.f2 !== "number") return [];
    const updatedAt = typeof row.f124 === "number" && row.f124 > 0 ? new Date(row.f124 * 1000).toISOString() : new Date().toISOString();
    const rawDate = typeof row.f297 === "number" ? String(row.f297) : "";
    const dataDate = /^\d{8}$/.test(rawDate) ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6)}` : updatedAt.slice(0, 10);
    const history = ranking.get(row.f12);
    return [{
      code: row.f12, name: row.f14, market: "on_exchange" as const, fundType: "ETF",
      price: row.f2, nav: typeof row.f441 === "number" ? row.f441 : undefined,
      estimate: typeof row.f441 === "number" ? row.f441 : undefined,
      changePercent: typeof row.f3 === "number" ? row.f3 : undefined,
      periodChanges: history ? {
        today: typeof row.f3 === "number" ? row.f3 : undefined,
        week: history.week,
        month: history.month
      } : undefined,
      volume: typeof row.f5 === "number" ? row.f5 : undefined,
      turnover: typeof row.f6 === "number" ? row.f6 : undefined,
      dataDate, updatedAt, isTradingDay: isCurrentTradingDate(dataDate), officialNavAvailable: true,
      source: "东方财富 ETF 行情"
    }];
  });
}

function isCurrentTradingDate(dataDate: string, now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const today = `${value("year")}-${value("month")}-${value("day")}`;
  return dataDate === today && value("weekday") !== "Sat" && value("weekday") !== "Sun";
}

async function fetchOpenFundQuotes(): Promise<FundQuote[]> {
  const params = new URLSearchParams({ t: "1", lx: "1", letter: "", gsid: "", text: "", sort: "zdf,desc", page: "1,50000", dt: String(Date.now()), atfc: "", onlySale: "0" });
  const text = await fetchText(`https://fund.eastmoney.com/Data/Fund_JJJZ_Data.aspx?${params}`);
  const dataMatch = text.match(/datas:(\[\[.*?\]\]),count:/s);
  const dayMatch = text.match(/showday:(\[[^\]]+\])/);
  if (!dataMatch) throw new Error("Open-fund response could not be parsed.");
  const rows = JSON.parse(dataMatch[1]) as string[][];
  const days = dayMatch ? JSON.parse(dayMatch[1]) as string[] : [];
  const dataDate = days[0] || new Date().toISOString().slice(0, 10);
  const previousDataDate = days[1] || shiftDate(dataDate, -1);
  const [currentRanking, previousRanking] = await Promise.all([
    fetchOpenFundRanking(shiftDate(dataDate, -15), dataDate),
    fetchOpenFundRanking(shiftDate(previousDataDate, -1), previousDataDate)
  ]);
  const updatedAt = new Date().toISOString();
  return rows.flatMap((row) => {
    const nav = parsePublishedNumber(row[3]);
    const change = parsePublishedNumber(row[8]);
    if (!/^\d{6}$/.test(row[0] ?? "") || !row[1] || nav === undefined) return [];
    const current = currentRanking.get(row[0]);
    const previous = previousRanking.get(row[0]);
    return [{
      code: row[0], name: row[1], market: "off_exchange" as const, fundType: "开放式公募",
      nav, changePercent: change,
      periodChanges: current || previous ? {
        today: change ?? current?.today,
        yesterday: previous?.custom,
        week: current?.week,
        half_month: current?.custom,
        month: current?.month
      } : undefined,
      dataDate, updatedAt, isTradingDay: isCurrentTradingDate(dataDate), officialNavAvailable: true,
      source: "东方财富开放式基金净值"
    }];
  });
}

/*
  The live adapters above intentionally avoid inferred history. Historical period
  fields stay absent until a source returns the corresponding observed values.
*/
