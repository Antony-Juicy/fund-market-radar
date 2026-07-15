import assert from "node:assert/strict";
import test from "node:test";

import { EastmoneyFundAdapter, FundService, PythonFundAdapter } from "../src/fund-service.js";
import type { FundQuote } from "../src/fund-types.js";

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

test("Eastmoney adapter marks unrequested research as unavailable", async () => {
  const adapter = new EastmoneyFundAdapter();
  adapter.listQuotes = async () => [quote];

  const detail = await adapter.getDetail("510300");

  assert.deepEqual(detail?.availability, { holdings: "unavailable", performance: "unavailable" });
});

test("Python sample adapter keeps undisclosed research as empty", async () => {
  const adapter = new PythonFundAdapter(undefined, undefined, true);

  const detail = await adapter.getDetail("510300");

  assert.deepEqual(detail?.availability, { holdings: "empty", performance: "empty" });
});
