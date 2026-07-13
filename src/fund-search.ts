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
