export type FundMarket = "all" | "on_exchange" | "off_exchange";
export type { FundSearchOption } from "../src/fund-search";
export type FundSort = "change_desc" | "change_asc" | "name";
export type FundMatchBy = "all" | "code" | "name" | "type" | "index" | "industry";
export type ResearchTab = "all" | "top" | "down" | "on_exchange" | "off_exchange";
export type PeriodKey = "today" | "yesterday" | "week" | "half_month" | "month";

export interface FundQuote {
  code: string; name: string; market: "on_exchange" | "off_exchange"; fundType: string;
  indexName?: string; industry?: string; price?: number; nav?: number; changePercent?: number;
  periodChanges?: Partial<Record<PeriodKey, number>>;
  dataDate: string; updatedAt: string; source: string; flowBasis: string;
}
export interface FundSnapshot {
  keyword: string; matchBy: FundMatchBy; market: FundMarket; sort: FundSort; limit: number;
  dataDate: string; updatedAt: string; items: FundQuote[];
}
export interface FundDetail extends FundQuote { industryAllocation: Array<{ industry: string; ratio: number; reportDate: string }>; }
export interface FundQuery { keyword: string; matchBy: FundMatchBy; market: FundMarket; sort: FundSort; limit: number; }
export interface MarketIndexQuote { code: string; name: string; value: number; changePercent: number; }
export interface SectorFlow { name: string; amount: number; changePercent?: number; }
export interface MarketOverview {
  indices: MarketIndexQuote[]; inflowTotal: number; outflowTotal: number; netFlow: number;
  inflowRatio: number; outflowRatio: number; inflowSectors: SectorFlow[]; outflowSectors: SectorFlow[];
  dataDate: string; updatedAt: string; source: string;
}
