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

export interface FundDetail extends FundQuote {
  industryAllocation: FundIndustryAllocation[];
}
