import { filterAndSortFunds } from "./fund-helpers.js";
import type {
  FundMarket,
  FundMatchBy,
  FundQuote,
  FundSnapshot,
  FundSort
} from "./fund-types.js";

export interface StaticFundData {
  dataDate: string;
  updatedAt: string;
  isTradingDay: boolean;
  items: FundQuote[];
}

export interface StaticFundQuery {
  keyword: string;
  matchBy: FundMatchBy;
  market: FundMarket;
  sort: FundSort;
  limit: number;
}

export function createSnapshotFromStaticData(
  data: StaticFundData,
  query: StaticFundQuery
): FundSnapshot {
  return {
    ...query,
    dataDate: data.dataDate,
    updatedAt: data.updatedAt,
    isTradingDay: data.isTradingDay,
    items: filterAndSortFunds(
      data.items,
      query.keyword,
      query.market,
      query.sort,
      query.limit,
      query.matchBy
    )
  };
}
