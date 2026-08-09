import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createServer } from "vite";

test("GitHub Pages requests dynamic fund detail from Sites", async () => {
  const source = await readFile("web/api.ts", "utf8");

  assert.match(source, /VITE_API_BASE_URL/);
  assert.match(source, /fetchLive<FundDetail>\(`\/api\/funds\/\$\{code\}`/);
  assert.doesNotMatch(source, /STATIC_DATA_BASE_URL|fetchStaticFunds|PREFER_STATIC_DATA/);
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

type BrowserApiOptions = {
  hostname?: string;
  onTimeout?: (timeoutMs: number) => void;
};

async function browserApi(fetchImplementation: typeof fetch, options: BrowserApiOptions = {}) {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.fetch = fetchImplementation;
  Object.assign(globalThis, { window: {
    location: { hostname: options.hostname ?? "antony-juicy.github.io" },
    setTimeout: (handler: TimerHandler, timeoutMs?: number) => {
      options.onTimeout?.(timeoutMs ?? 0);
      return setTimeout(handler, timeoutMs);
    },
    clearTimeout
  } });
  const server = await createServer({
    logLevel: "error",
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom"
  });
  const module = await server.ssrLoadModule("/api.ts");
  return {
    fetchFundDetail: module.fetchFundDetail as (code: string) => Promise<unknown>,
    fetchMarketOverview: module.fetchMarketOverview as () => Promise<unknown>,
    fetchFundSnapshot: module.fetchFundSnapshot as (query: {
      keyword: string;
      matchBy: "all";
      market: "all";
      sort: "change_desc";
      limit: number;
    }) => Promise<unknown>,
    restore: async () => {
      await server.close();
      globalThis.fetch = originalFetch;
      Object.assign(globalThis, { window: originalWindow });
    }
  };
}

test("GitHub Pages loads the current fund snapshot from Sites instead of deployment JSON", async () => {
  const liveSnapshot = {
    ...staticSnapshot,
    dataDate: "2026-08-07",
    updatedAt: "2026-08-07T08:00:00.000Z",
    items: [{ ...staticQuote, name: "实时沪深300ETF", dataDate: "2026-08-07" }]
  };
  const requests: string[] = [];
  const api = await browserApi(async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("/api/funds?")) return new Response(JSON.stringify(liveSnapshot));
    throw new Error(`Unexpected URL: ${url}`);
  });
  try {
    const snapshot = await api.fetchFundSnapshot({
      keyword: "",
      matchBy: "all",
      market: "all",
      sort: "change_desc",
      limit: 20
    }) as typeof liveSnapshot;

    assert.equal(snapshot.dataDate, "2026-08-07");
    assert.equal(snapshot.items[0]?.name, "实时沪深300ETF");
    assert.equal(requests.some((url) => url.includes("/data/funds.json")), false);
  } finally {
    await api.restore();
  }
});

test("GitHub Pages loads the current market overview from Sites", async () => {
  const overview = { dataDate: "2026-08-07", source: "东方财富行业资金流向与指数行情" };
  const requests: string[] = [];
  const api = await browserApi(async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith("/api/market-overview")) return new Response(JSON.stringify(overview));
    throw new Error(`Unexpected URL: ${url}`);
  });
  try {
    assert.deepEqual(await api.fetchMarketOverview(), overview);
    assert.equal(requests.some((url) => url.includes("/data/market-overview.json")), false);
  } finally {
    await api.restore();
  }
});

test("GitHub Pages uses the current quote returned with dynamic detail research", async () => {
  const api = await browserApi(async (input) => {
    const url = String(input);
    if (url.includes("/api/funds/510300")) return new Response(JSON.stringify({
      ...staticQuote, name: "实时沪深300ETF", dataDate: "2026-08-07", industryAllocation: [], stockHoldings: [{ rank: 1, stockCode: "001309", stockName: "德明利", navRatio: 1.05, reportDate: "2026-03-31" }], performanceHistory: [{ date: "2026-08-07", value: 1.6893 }], performanceSource: "东方财富基金历史净值", availability: { holdings: "available", performance: "available" }
    }));
    throw new Error(`Unexpected URL: ${url}`);
  });
  try {
    const detail = await api.fetchFundDetail("510300") as typeof staticQuote & { stockHoldings: unknown[]; availability: unknown };
    assert.equal(detail.name, "实时沪深300ETF");
    assert.equal(detail.dataDate, "2026-08-07");
    assert.equal(detail.stockHoldings.length, 1);
    assert.deepEqual(detail.availability, { holdings: "available", performance: "available" });
  } finally {
    await api.restore();
  }
});

test("GitHub Pages does not mask a live API failure with a stale deployment snapshot", async () => {
  const api = await browserApi(async (input) => {
    const url = String(input);
    if (url.includes("/api/funds/510300")) return new Response(JSON.stringify({ error: "unavailable" }), { status: 502 });
    if (url.includes("/data/funds.json")) return new Response(JSON.stringify(staticSnapshot));
    throw new Error(`Unexpected URL: ${url}`);
  });
  try {
    await assert.rejects(api.fetchFundDetail("510300"), /unavailable/);
  } finally {
    await api.restore();
  }
});

test("deployed cold requests allow the real Eastmoney adapter to finish", async () => {
  const timeouts: number[] = [];
  const api = await browserApi(async (input) => {
    const url = String(input);
    if (url.includes("/api/funds?")) return new Response(JSON.stringify(staticSnapshot));
    if (url.endsWith("/api/funds/510300")) return new Response(JSON.stringify({
      ...staticQuote,
      industryAllocation: [],
      stockHoldings: [],
      performanceHistory: [],
      performanceSource: "东方财富基金历史净值",
      availability: { holdings: "empty", performance: "empty" }
    }));
    throw new Error(`Unexpected URL: ${url}`);
  }, {
    hostname: "fund-market-radar.gabbiyabbiy9.chatgpt.site",
    onTimeout: (timeoutMs) => timeouts.push(timeoutMs)
  });

  try {
    await api.fetchFundSnapshot({
      keyword: "",
      matchBy: "all",
      market: "all",
      sort: "change_desc",
      limit: 20
    });
    await api.fetchFundDetail("510300");

    assert.equal(timeouts[0], 30_000);
    assert.ok(
      (timeouts[1] ?? 0) > 15_000,
      "detail timeout must leave response overhead beyond the server's 15 second upstream window"
    );
  } finally {
    await api.restore();
  }
});
