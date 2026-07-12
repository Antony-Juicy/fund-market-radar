import assert from "node:assert/strict";
import test from "node:test";

import {
  filterAndSortFunds,
  isOfficialNavStale,
  parseFundLimit,
  parseFundMatchBy,
  parseFundMarket,
  parseFundSort
} from "../src/fund-helpers.js";
import type { FundQuote } from "../src/fund-types.js";

const sample: FundQuote[] = [
  {
    code: "510300", name: "沪深300ETF", market: "on_exchange", fundType: "ETF", indexName: "沪深300", industry: "宽基",
    price: 3.8, changePercent: 2.1, dataDate: "2026-07-11", updatedAt: "2026-07-11T15:00:00+08:00", isTradingDay: true, officialNavAvailable: true, source: "sample"
  },
  {
    code: "012345", name: "半导体精选混合", market: "off_exchange", fundType: "混合型", industry: "半导体",
    nav: 1.2, changePercent: -1.4, dataDate: "2026-07-10", updatedAt: "2026-07-11T10:00:00+08:00", isTradingDay: true, officialNavAvailable: false, source: "sample"
  }
];

test("parses fund query options and rejects invalid values", () => {
  assert.equal(parseFundMarket("场内"), "on_exchange");
  assert.equal(parseFundSort("名称"), "name");
  assert.equal(parseFundLimit("50"), 50);
  assert.equal(parseFundMatchBy("行业"), "industry");
  assert.throws(() => parseFundLimit("101"), /between 1 and 100/);
});

test("matches arbitrary code, name, index, and industry keywords", () => {
  assert.equal(filterAndSortFunds(sample, "半导体", "all", "change_desc", 20)[0]?.code, "012345");
  assert.equal(filterAndSortFunds(sample, "沪深300", "all", "change_desc", 20)[0]?.code, "510300");
});

test("restricts keyword matching to the selected field", () => {
  assert.equal(filterAndSortFunds(sample, "半导体", "all", "change_desc", 20, "industry")[0]?.code, "012345");
  assert.equal(filterAndSortFunds(sample, "半导体", "all", "change_desc", 20, "code").length, 0);
});

test("filters market and sorts by change", () => {
  assert.equal(filterAndSortFunds(sample, "", "on_exchange", "change_desc", 20).length, 1);
  assert.deepEqual(filterAndSortFunds(sample, "", "all", "change_asc", 20).map((item) => item.code), ["012345", "510300"]);
});

test("marks off-exchange previous NAV as not today's formal NAV", () => {
  assert.equal(isOfficialNavStale(sample[1], "2026-07-11"), true);
  assert.equal(isOfficialNavStale(sample[0], "2026-07-11"), false);
});
