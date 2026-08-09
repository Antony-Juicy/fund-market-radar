import assert from "node:assert/strict";
import test from "node:test";

import {
  EastmoneyFundDetailSource,
  parseFundHistoryResponse,
  parseFundHoldingsResponse,
  publishedNumber
} from "../src/fund-detail-source.js";

const HOLDINGS_FIXTURE = `var apidata={ content:"<div class=\\"box\\"><h4>2026年1季度股票投资明细 截止至：<font>2026-03-31</font></h4><table><tbody><tr><td>1</td><td><a>001309</a></td><td><a>德明利</a></td><td></td><td></td><td></td><td>1.05%</td><td>2,126.97</td><td>854,404.57</td></tr><tr><td>2</td><td><a>603588</a></td><td><a>高能环境</a></td><td></td><td></td><td></td><td>0.98%</td><td>0.12</td><td>31.40</td></tr></tbody></table></div>",arryear:[2026] };`;
const HISTORY_FIXTURE = JSON.stringify({
  Data: { LSJZList: [
    { FSRQ: "2026-07-15", DWJZ: "1.5893", LJJZ: "1.6893" },
    { FSRQ: "2026-07-14", DWJZ: "1.6063", LJJZ: "" }
  ] }
});
const clock = () => new Date("2026-07-15T08:00:00.000Z");

function response(body: string, status = 200): Response {
  return new Response(body, { status });
}

function detailFetch(overrides: Partial<{ history: () => Promise<Response>; holdings: () => Promise<Response> }> = {}): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.startsWith("https://api.fund.eastmoney.com/f10/lsjz?")) {
      return overrides.history ? overrides.history() : response(HISTORY_FIXTURE);
    }
    if (url.startsWith("https://fundf10.eastmoney.com/FundArchivesDatas.aspx?")) {
      return overrides.holdings ? overrides.holdings() : response(HOLDINGS_FIXTURE);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

test("parses cumulative NAV history without inventing missing numbers", () => {
  const parsed = parseFundHistoryResponse(HISTORY_FIXTURE);

  assert.deepEqual(parsed, [
    { date: "2026-07-14", value: 1.6063, unitNav: 1.6063 },
    { date: "2026-07-15", value: 1.6893, unitNav: 1.5893, cumulativeNav: 1.6893 }
  ]);
});

test("parses the latest disclosed top holdings and report date", () => {
  const parsed = parseFundHoldingsResponse(HOLDINGS_FIXTURE);

  assert.equal(parsed.reportDate, "2026-03-31");
  assert.deepEqual(parsed.items[0], {
    rank: 1,
    stockCode: "001309",
    stockName: "德明利",
    navRatio: 1.05,
    sharesWan: 2126.97,
    marketValueWan: 854404.57,
    reportDate: "2026-03-31"
  });
});

test("parses published thousands separators without treating blanks or invalid values as zero", () => {
  assert.equal(publishedNumber("2,126.97"), 2126.97);
  assert.equal(publishedNumber("854,404.57"), 854404.57);
  assert.equal(publishedNumber(""), undefined);
  assert.equal(publishedNumber("-"), undefined);
  assert.equal(publishedNumber("not published"), undefined);
  assert.equal(publishedNumber(null), undefined);
});

test("reuses one in-flight detail load for concurrent requests", async () => {
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    calls += 1;
    await pending;
    return String(input).startsWith("https://api.fund.eastmoney.com/")
      ? response(HISTORY_FIXTURE)
      : response(HOLDINGS_FIXTURE);
  };
  const source = new EastmoneyFundDetailSource({ fetch, clock });

  const first = source.getResearchDetail("510300");
  const second = source.getResearchDetail("510300");

  assert.equal(first, second);
  assert.equal(calls, 2);
  release();
  await first;
});

test("bounds and expires cached research detail loads", async () => {
  let now = new Date("2026-07-15T08:00:00.000Z");
  const calls = new Map<string, number>();
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const code = url.searchParams.get(url.pathname.includes("lsjz") ? "fundCode" : "code") ?? "";
    calls.set(code, (calls.get(code) ?? 0) + 1);
    return response(url.pathname.includes("lsjz") ? HISTORY_FIXTURE : HOLDINGS_FIXTURE);
  };
  const source = new EastmoneyFundDetailSource({ fetch, clock: () => now });
  const codes = Array.from({ length: 101 }, (_, index) => String(510000 + index));

  for (const code of codes) await source.getResearchDetail(code);
  await source.getResearchDetail(codes[0]);
  assert.equal(calls.get(codes[0]), 4);

  now = new Date(now.getTime() + 600_001);
  await source.getResearchDetail(codes.at(-1) ?? "");
  assert.equal(calls.get(codes.at(-1) ?? ""), 4);
});

test("uses Shanghai business dates and exact Eastmoney query parameters", async () => {
  const urls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    return url.startsWith("https://api.fund.eastmoney.com/")
      ? response(HISTORY_FIXTURE)
      : response(HOLDINGS_FIXTURE);
  };
  const source = new EastmoneyFundDetailSource({
    fetch,
    clock: () => new Date("2026-07-14T16:30:00.000Z")
  });

  await source.getResearchDetail("510300");

  assert.deepEqual(urls, [
    "https://api.fund.eastmoney.com/f10/lsjz?fundCode=510300&pageIndex=1&pageSize=400&startDate=2025-07-05&endDate=2026-07-15",
    "https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=510300&topline=10&year=&month="
  ]);
});

test("retains holdings when history is unavailable", async () => {
  const source = new EastmoneyFundDetailSource({
    fetch: detailFetch({ history: async () => { throw new Error("history unavailable"); } }),
    clock
  });

  const detail = await source.getResearchDetail("510300");

  assert.deepEqual(detail.availability, { performance: "unavailable", holdings: "available" });
  assert.equal(detail.performanceHistory.length, 0);
  assert.equal(detail.stockHoldings[0]?.stockCode, "001309");
});

test("retains holdings when a fulfilled history response cannot be parsed", async () => {
  const source = new EastmoneyFundDetailSource({
    fetch: detailFetch({ history: async () => response("not JSON") }),
    clock
  });

  const detail = await source.getResearchDetail("510300");

  assert.deepEqual(detail.availability, { performance: "unavailable", holdings: "available" });
  assert.equal(detail.stockHoldings[0]?.stockCode, "001309");
});

test("marks a fulfilled holdings response with no rows as empty", async () => {
  const source = new EastmoneyFundDetailSource({
    fetch: detailFetch({ holdings: async () => response('var apidata={ content:"<div>暂无数据</div>",arryear:[] };') }),
    clock
  });

  const detail = await source.getResearchDetail("510300");

  assert.equal(detail.availability.holdings, "empty");
  assert.deepEqual(detail.stockHoldings, []);
  assert.equal(detail.availability.performance, "available");
});
