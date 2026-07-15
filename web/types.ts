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

export type FundPerformancePeriod = "half_month" | "month" | "quarter" | "year" | "year_to_date";
export interface FundPerformancePoint { date: string; value: number; unitNav?: number; cumulativeNav?: number; }
export interface FundPerformanceSeriesPoint extends FundPerformancePoint { returnPercent: number; }
export interface FundStockHolding {
  rank: number;
  stockCode: string;
  stockName: string;
  navRatio: number;
  sharesWan?: number;
  marketValueWan?: number;
  reportDate: string;
}
export interface FundDetailAvailability {
  holdings: "available" | "empty" | "unavailable";
  performance: "available" | "empty" | "unavailable";
}
export interface FundResearchDetail {
  stockHoldings: FundStockHolding[];
  holdingsReportDate?: string;
  performanceHistory: FundPerformancePoint[];
  performanceSource: string;
  availability: FundDetailAvailability;
}
export interface FundSnapshot {
  keyword: string; matchBy: FundMatchBy; market: FundMarket; sort: FundSort; limit: number;
  dataDate: string; updatedAt: string; items: FundQuote[];
}
export interface FundDetail extends FundQuote, Partial<FundResearchDetail> { industryAllocation: Array<{ industry: string; ratio: number; reportDate: string }>; }
export interface FundQuery { keyword: string; matchBy: FundMatchBy; market: FundMarket; sort: FundSort; limit: number; }
export interface MarketIndexQuote { code: string; name: string; value: number; changePercent: number; }
export interface SectorFlow { name: string; amount: number; changePercent?: number; }
export interface MarketOverview {
  indices: MarketIndexQuote[]; inflowTotal: number; outflowTotal: number; netFlow: number;
  inflowRatio: number; outflowRatio: number; inflowSectors: SectorFlow[]; outflowSectors: SectorFlow[];
  dataDate: string; updatedAt: string; source: string;
}
