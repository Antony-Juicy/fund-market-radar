import test from "node:test";
import assert from "node:assert/strict";

import {
  canSearchFunds,
  createSelectedFundQuery,
  toFundSearchOptions
} from "../src/fund-search.js";
import type { FundQuote } from "../src/fund-types.js";

const quote: FundQuote = {
  code: "159915",
  name: "创业板ETF",
  market: "on_exchange",
  fundType: "ETF",
  price: 1.5,
  changePercent: 1.2,
  dataDate: "2026-07-13",
  updatedAt: "2026-07-13T07:00:00.000Z",
  isTradingDay: true,
  officialNavAvailable: true,
  source: "东方财富 ETF 行情"
};

test("fund suggestions require two trimmed characters", () => {
  assert.equal(canSearchFunds("创"), false);
  assert.equal(canSearchFunds(" 创业 "), true);
});

test("fund options preserve real quote identity", () => {
  assert.deepEqual(toFundSearchOptions([quote]), [{
    value: "159915",
    name: "创业板ETF",
    code: "159915",
    market: "on_exchange",
    fundType: "ETF"
  }]);
});

test("selecting a fund creates an exact code query", () => {
  assert.deepEqual(createSelectedFundQuery("159915", 20), {
    keyword: "159915",
    matchBy: "code",
    market: "all",
    sort: "change_desc",
    limit: 20
  });
});
