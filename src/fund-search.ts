import type { FundQuote } from "./fund-types.js";

export interface FundSearchOption {
  value: string;
  name: string;
  code: string;
  market: "on_exchange" | "off_exchange";
  fundType: string;
}

export interface SelectedFundQuery {
  keyword: string;
  matchBy: "code";
  market: "all";
  sort: "change_desc";
  limit: number;
}

export interface FundKeywordQuery {
  keyword: string;
  matchBy: "all" | "code" | "name" | "type" | "index" | "industry";
  market: "all" | "on_exchange" | "off_exchange";
  sort: "change_desc" | "change_asc" | "name";
  limit: number;
}

export type FundResearchTab = "all" | "top" | "down" | "on_exchange" | "off_exchange";

export const canSearchFunds = (keyword: string) => keyword.trim().length >= 2;

export const toFundSearchOptions = (items: FundQuote[]): FundSearchOption[] =>
  items.map(({ code, name, market, fundType }) => ({
    value: code,
    code,
    name,
    market,
    fundType
  }));

export const createSelectedFundQuery = (code: string, limit: number): SelectedFundQuery => ({
  keyword: code,
  matchBy: "code",
  market: "all",
  sort: "change_desc",
  limit
});

export const withFundKeyword = (query: FundKeywordQuery, keyword: string): FundKeywordQuery => ({
  ...query,
  keyword,
  matchBy: /^\d{6}$/.test(keyword.trim()) ? "code" : "all"
});

export const withResearchTab = (
  query: FundKeywordQuery,
  tab: FundResearchTab
): FundKeywordQuery => {
  if (tab === "top") return { ...query, market: "all", sort: "change_desc" };
  if (tab === "down") return { ...query, market: "all", sort: "change_asc" };
  if (tab === "on_exchange" || tab === "off_exchange") return { ...query, market: tab, sort: "name" };
  return { ...query, market: "all", sort: "name" };
};
