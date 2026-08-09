import test from "node:test";
import assert from "node:assert/strict";

import { createSnapshotFromStaticData } from "../src/pages-fallback.js";
import type { FundQuote } from "../src/fund-types.js";

const quote = (overrides: Partial<FundQuote>): FundQuote => ({
  code: "510300",
  name: "沪深300ETF",
  market: "on_exchange",
  fundType: "ETF",
  price: 3.8,
  changePercent: 2.1,
  dataDate: "2026-07-10",
  updatedAt: "2026-07-10T07:00:00.000Z",
  isTradingDay: true,
  officialNavAvailable: true,
  source: "东方财富 ETF 行情",
  ...overrides
});

test("static Pages data preserves query filtering, sorting, and limit", () => {
  const data = {
    dataDate: "2026-07-10",
    updatedAt: "2026-07-10T07:00:00.000Z",
    isTradingDay: true,
    items: [
      quote({ code: "510300", name: "沪深300ETF", changePercent: 2.1 }),
      quote({ code: "159819", name: "人工智能ETF", changePercent: 1.4 }),
      quote({ code: "013001", name: "人工智能主题ETF联接", market: "off_exchange", changePercent: 1.8 })
    ]
  };

  const snapshot = createSnapshotFromStaticData(data, {
    keyword: "人工智能",
    matchBy: "name",
    market: "all",
    sort: "change_desc",
    limit: 1
  });

  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].code, "013001");
  assert.equal(snapshot.keyword, "人工智能");
  assert.equal(snapshot.dataDate, "2026-07-10");
});
