import assert from "node:assert/strict";
import test from "node:test";

import { EastmoneyFundAdapter, FundService, PythonFundAdapter } from "../src/fund-service.js";
import type { FundQuote, FundResearchDetail } from "../src/fund-types.js";

const quote: FundQuote = {
  code: "510300",
  name: "沪深300ETF",
  market: "on_exchange",
  fundType: "ETF",
  dataDate: "2026-07-15",
  updatedAt: "2026-07-15T15:00:00+08:00",
  isTradingDay: true,
  officialNavAvailable: true,
  source: "test"
};

test("Python adapter fixed sample returns both exchange markets", async () => {
  const service = new FundService(new PythonFundAdapter(undefined, undefined, true));
  const result = await service.snapshot("", "all", "change_desc", 20);

  assert.equal(result.items.length, 20);
  assert.deepEqual(new Set(result.items.map((item) => item.market)), new Set(["on_exchange", "off_exchange"]));
  assert.equal(result.items[0]?.code, "510300");
});

test("fund service honors the larger local demo result sizes", async () => {
  const service = new FundService(new PythonFundAdapter(undefined, undefined, true));
  const result = await service.snapshot("", "all", "change_desc", 100);

  assert.equal(result.items.length, 100);
});

test("fund service applies keyword and market filters", async () => {
  const service = new FundService(new PythonFundAdapter(undefined, undefined, true));
  const result = await service.snapshot("半导体", "off_exchange", "change_desc", 20, "industry");

  assert.ok(result.items.length > 1);
  const semiconductor = result.items.find((item) => item.code === "012345");
  assert.equal(semiconductor?.code, "012345");
  assert.deepEqual(semiconductor?.matchedBy, ["行业"]);
});

test("Eastmoney adapter merges research detail without overwriting quote identity or source", async () => {
  const adapter = new EastmoneyFundAdapter();
  adapter.listQuotes = async () => [quote];
  const research: FundResearchDetail = {
    stockHoldings: [{ rank: 1, stockCode: "001309", stockName: "德明利", navRatio: 1.05, reportDate: "2026-03-31" }],
    holdingsReportDate: "2026-03-31",
    performanceHistory: [{ date: "2026-07-14", value: 1.6063 }, { date: "2026-07-15", value: 1.5893 }],
    performanceSource: "东方财富基金历史净值",
    availability: { holdings: "available", performance: "available" }
  };
  Object.assign(adapter, { detailSource: { getResearchDetail: async () => research } });

  const detail = await adapter.getDetail("510300");

  assert.equal(detail?.code, quote.code);
  assert.equal(detail?.name, quote.name);
  assert.equal(detail?.source, quote.source);
  assert.equal(detail?.stockHoldings[0]?.stockCode, "001309");
  assert.equal(detail?.performanceHistory.at(-1)?.date, "2026-07-15");
  assert.deepEqual(detail?.availability, { holdings: "available", performance: "available" });
});

test("Python sample adapter keeps undisclosed research as empty", async () => {
  const adapter = new PythonFundAdapter(undefined, undefined, true);

  const detail = await adapter.getDetail("510300");

  assert.deepEqual(detail?.availability, { holdings: "empty", performance: "empty" });
  assert.deepEqual(detail?.stockHoldings, []);
  assert.deepEqual(detail?.performanceHistory, []);
});
