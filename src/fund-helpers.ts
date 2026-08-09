import type { FundMarket, FundMatchBy, FundQuote, FundSort } from "./fund-types.js";

export function parseFundMarket(value: string | null | undefined): FundMarket {
  if (!value || value === "all" || value === "全部") return "all";
  if (value === "on_exchange" || value === "场内") return "on_exchange";
  if (value === "off_exchange" || value === "场外") return "off_exchange";
  throw new Error("market must be all, on_exchange, or off_exchange.");
}

export function parseFundSort(value: string | null | undefined): FundSort {
  if (!value || value === "change_desc") return "change_desc";
  if (value === "change_asc" || value === "跌幅") return "change_asc";
  if (value === "name" || value === "名称") return "name";
  throw new Error("sort must be change_desc, change_asc, or name.");
}

export function parseFundLimit(value: string | null | undefined): number {
  if (!value) return 20;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit must be an integer between 1 and 100.");
  }
  return limit;
}

export function parseFundMatchBy(value: string | null | undefined): FundMatchBy {
  if (!value || value === "all" || value === "全部") return "all";
  if (value === "code" || value === "代码") return "code";
  if (value === "name" || value === "名称") return "name";
  if (value === "type" || value === "类型") return "type";
  if (value === "index" || value === "指数") return "index";
  if (value === "industry" || value === "行业") return "industry";
  throw new Error("matchBy must be all, code, name, type, index, or industry.");
}

export function matchFund(quote: FundQuote, keyword: string, matchBy: FundMatchBy = "all"): string[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return [];
  const fields: Array<[FundMatchBy, string, string | undefined]> = [
    ["code", "代码", quote.code],
    ["name", "名称", quote.name],
    ["type", "类型", quote.fundType],
    ["index", "指数", quote.indexName],
    ["industry", "行业", quote.industry]
  ];
  return fields.filter(([field, , value]) => (matchBy === "all" || field === matchBy) && value?.toLowerCase().includes(normalized)).map(([, label]) => label);
}

export function filterAndSortFunds(
  quotes: FundQuote[],
  keyword: string,
  market: FundMarket,
  sort: FundSort,
  limit: number,
  matchBy: FundMatchBy = "all"
): FundQuote[] {
  return quotes
    .map((quote) => ({ ...quote, matchedBy: matchFund(quote, keyword, matchBy) }))
    .filter((quote) => (market === "all" || quote.market === market) && (!keyword.trim() || quote.matchedBy?.length))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "zh-CN");
      const left = a.changePercent ?? Number.NEGATIVE_INFINITY;
      const right = b.changePercent ?? Number.NEGATIVE_INFINITY;
      return sort === "change_asc" ? left - right : right - left;
    })
    .slice(0, limit);
}

export function isOfficialNavStale(quote: FundQuote, today: string): boolean {
  return quote.market === "off_exchange" && (!quote.officialNavAvailable || quote.dataDate < today);
}
