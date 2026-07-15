export type FundMarket = "all" | "on_exchange" | "off_exchange";
export type FundSort = "change_desc" | "change_asc" | "name";
export type FundMatchBy = "all" | "code" | "name" | "type" | "index" | "industry";
export type FundPeriodKey = "today" | "yesterday" | "week" | "half_month" | "month";

export interface FundIndustryAllocation {
  industry: string;
  ratio: number;
  reportDate: string;
}

export interface FundQuote {
  code: string;
  name: string;
  market: "on_exchange" | "off_exchange";
  fundType: string;
  indexName?: string;
  industry?: string;
  price?: number;
  nav?: number;
  estimate?: number;
  changePercent?: number;
  periodChanges?: Partial<Record<FundPeriodKey, number>>;
  volume?: number;
  turnover?: number;
  dataDate: string;
  updatedAt: string;
  isTradingDay: boolean;
  officialNavAvailable: boolean;
  source: string;
  matchedBy?: string[];
}

export interface FundSnapshot {
  keyword: string;
  matchBy: FundMatchBy;
  market: FundMarket;
  sort: FundSort;
  limit: number;
  dataDate: string;
  updatedAt: string;
  isTradingDay: boolean;
  items: FundQuote[];
}

export type FundPerformancePeriod = "half_month" | "month" | "quarter" | "year" | "year_to_date";

export interface FundPerformancePoint {
  date: string;
  value: number;
  unitNav?: number;
  cumulativeNav?: number;
}

export interface FundPerformanceSeriesPoint extends FundPerformancePoint {
  returnPercent: number;
}

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

export interface FundDetail extends FundQuote, Partial<FundResearchDetail> {
  industryAllocation: FundIndustryAllocation[];
}
