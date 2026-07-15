import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createServer } from "vite";
import { shouldPreferStaticData } from "../src/runtime-data-source.js";

test("GitHub Pages uses its exported market snapshot without contacting the live Sites domain", () => {
  assert.equal(shouldPreferStaticData("antony-juicy.github.io"), true);
  assert.equal(shouldPreferStaticData("fund-market-radar.gabbiyabbiy9.chatgpt.site"), false);
  assert.equal(shouldPreferStaticData("127.0.0.1"), false);
});

test("GitHub Pages requests dynamic fund detail from Sites", async () => {
  const source = await readFile("web/api.ts", "utf8");

  assert.match(source, /VITE_DETAIL_API_BASE_URL/);
  assert.match(source, /fetchDynamicFundDetail/);
  assert.match(source, /DETAIL_API_BASE_URL\}\/api\/funds\/\$\{code\}/);
  assert.match(source, /holdings: "unavailable"/);
  assert.match(source, /performance: "unavailable"/);
});

const staticQuote = {
  code: "510300", name: "静态沪深300ETF", market: "on_exchange" as const, fundType: "ETF",
  price: 3.8, nav: 3.79, changePercent: 2.1, dataDate: "2026-07-15", updatedAt: "2026-07-15T08:00:00.000Z",
  source: "静态 Pages 快照", flowBasis: "快照"
};
const staticSnapshot = {
  keyword: "", matchBy: "all" as const, market: "all" as const, sort: "change_desc" as const, limit: 20,
  dataDate: "2026-07-15", updatedAt: "2026-07-15T08:00:00.000Z", items: [staticQuote]
};

async function pagesApi(fetchImplementation: typeof fetch) {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.fetch = fetchImplementation;
  Object.assign(globalThis, { window: {
    location: { hostname: "antony-juicy.github.io" }, setTimeout, clearTimeout
  } });
  const server = await createServer({ logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  const module = await server.ssrLoadModule("/api.ts");
  return {
    fetchFundDetail: module.fetchFundDetail as (code: string) => Promise<unknown>,
    restore: async () => {
      await server.close();
      globalThis.fetch = originalFetch;
      Object.assign(globalThis, { window: originalWindow });
    }
  };
}

test("GitHub Pages keeps static identity while using dynamic detail research", async () => {
  const api = await pagesApi(async (input) => {
    const url = String(input);
    if (url.includes("/data/funds.json")) return new Response(JSON.stringify(staticSnapshot));
    if (url.includes("/api/funds/510300")) return new Response(JSON.stringify({
      ...staticQuote, name: "不应覆盖静态身份", industryAllocation: [], stockHoldings: [{ rank: 1, stockCode: "001309", stockName: "德明利", navRatio: 1.05, reportDate: "2026-03-31" }], performanceHistory: [{ date: "2026-07-15", value: 1.6893 }], performanceSource: "东方财富基金历史净值", availability: { holdings: "available", performance: "available" }
    }));
    throw new Error(`Unexpected URL: ${url}`);
  });
  try {
    const detail = await api.fetchFundDetail("510300") as typeof staticQuote & { stockHoldings: unknown[]; availability: unknown };
    assert.equal(detail.name, staticQuote.name);
    assert.equal(detail.stockHoldings.length, 1);
    assert.deepEqual(detail.availability, { holdings: "available", performance: "available" });
  } finally {
    await api.restore();
  }
});

test("GitHub Pages exposes unavailable research instead of static fake detail", async () => {
  const api = await pagesApi(async (input) => {
    const url = String(input);
    if (url.includes("/data/funds.json")) return new Response(JSON.stringify(staticSnapshot));
    if (url.includes("/api/funds/510300")) return new Response(JSON.stringify({ error: "unavailable" }), { status: 502 });
    throw new Error(`Unexpected URL: ${url}`);
  });
  try {
    const detail = await api.fetchFundDetail("510300") as typeof staticQuote & { stockHoldings: unknown[]; performanceHistory: unknown[]; availability: unknown };
    assert.equal(detail.name, staticQuote.name);
    assert.deepEqual(detail.stockHoldings, []);
    assert.deepEqual(detail.performanceHistory, []);
    assert.deepEqual(detail.availability, { holdings: "unavailable", performance: "unavailable" });
  } finally {
    await api.restore();
  }
});
