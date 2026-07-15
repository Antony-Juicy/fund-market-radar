import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { before, test } from "node:test";

const execFile = promisify(execFileCallback);
const workerUrl = pathToFileURL(`${process.cwd()}/dist/server/index.js`).href;
const HISTORY_FIXTURE = JSON.stringify({
  Data: { LSJZList: [{ FSRQ: "2026-07-15", DWJZ: "1.5893", LJJZ: "1.6893" }] }
});
const HOLDINGS_FIXTURE = `var apidata={ content:"<h4>截止至：<font>2026-03-31</font></h4><table><tr><td>1</td><td><a>001309</a></td><td><a>德明利</a></td><td></td><td></td><td></td><td>1.05%</td><td>2,126.97</td><td>854,404.57</td></tr></table>",arryear:[2026] };`;
let workerVersion = 0;

before(async () => {
  await execFile(process.execPath, ["scripts/build-sites-worker.mjs"]);
});

function quote(code: string) {
  return { f12: code, f14: `基金${code}`, f2: 3.8, f3: 2.1, f441: 3.79, f124: 1_784_000_000, f297: "20260715" };
}

function response(body: string | object, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

interface UpstreamOptions {
  codes?: string[];
  history?: "success" | "failure";
  holdings?: "success" | "failure";
  invalidHistory?: boolean;
  allFailure?: boolean;
  historyCalls?: Map<string, number>;
}

function upstreamFetch(options: UpstreamOptions = {}): typeof fetch {
  const codes = options.codes ?? ["510300"];
  return async (input) => {
    const url = String(input);
    if (options.allFailure) throw new Error("upstream unavailable");
    if (url.includes("/api/qt/clist/get")) {
      return response({ data: { total: codes.length, diff: codes.map(quote) } });
    }
    if (url.includes("Fund_JJJZ_Data.aspx")) return response("datas:[],count:");
    if (url.includes("api.fund.eastmoney.com/f10/lsjz")) {
      const code = new URL(url).searchParams.get("fundCode") ?? "";
      options.historyCalls?.set(code, (options.historyCalls.get(code) ?? 0) + 1);
      if (options.history === "failure") throw new Error("history unavailable");
      if (options.invalidHistory) return response("not JSON");
      return response(HISTORY_FIXTURE);
    }
    if (url.includes("FundArchivesDatas.aspx")) {
      if (options.holdings === "failure") throw new Error("holdings unavailable");
      return response(HOLDINGS_FIXTURE);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

function hangingDetailFetch(): typeof fetch {
  const baseFetch = upstreamFetch();
  return async (input, init) => {
    const url = String(input);
    if (url.includes("api.fund.eastmoney.com/f10/lsjz") || url.includes("FundArchivesDatas.aspx")) {
      return await new Promise<Response>(() => {
        void init;
      });
    }
    return baseFetch(input, init);
  };
}

async function workerHarness(fetchImplementation: typeof fetch) {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  globalThis.fetch = fetchImplementation;
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  const module = await import(`${workerUrl}?runtime-test=${workerVersion++}`);
  return {
    worker: module.default as { fetch(request: Request): Promise<Response> },
    warnings,
    restore: () => {
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
    }
  };
}

test("generated Worker serves complete fund research detail", async () => {
  const harness = await workerHarness(upstreamFetch());
  try {
    const response = await harness.worker.fetch(new Request("https://sites.test/api/funds/510300"));
    const body = await response.json() as { stockHoldings: Array<{ sharesWan?: number }>; performanceHistory: unknown[]; availability: unknown };

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
    assert.equal(body.stockHoldings[0]?.sharesWan, 2126.97);
    assert.equal(body.performanceHistory.length, 1);
    assert.deepEqual(body.availability, { holdings: "available", performance: "available" });
  } finally {
    harness.restore();
  }
});

test("generated Worker preserves partial detail results and logs safe diagnostics", async () => {
  const harness = await workerHarness(upstreamFetch({ history: "failure" }));
  try {
    const response = await harness.worker.fetch(new Request("https://sites.test/api/funds/510300"));
    const body = await response.json() as { stockHoldings: unknown[]; performanceHistory: unknown[]; availability: unknown };

    assert.equal(response.status, 200);
    assert.equal(body.stockHoldings.length, 1);
    assert.deepEqual(body.performanceHistory, []);
    assert.deepEqual(body.availability, { holdings: "available", performance: "unavailable" });
    assert.deepEqual(harness.warnings, [["fund_detail_upstream_failure", {
      code: "510300", source: "history", failure: "request_failed"
    }]]);
  } finally {
    harness.restore();
  }
});

test("generated Worker keeps NAV history when holdings are unavailable", async () => {
  const harness = await workerHarness(upstreamFetch({ holdings: "failure" }));
  try {
    const response = await harness.worker.fetch(new Request("https://sites.test/api/funds/510300"));
    const body = await response.json() as { stockHoldings: unknown[]; performanceHistory: unknown[]; availability: unknown };

    assert.equal(response.status, 200);
    assert.deepEqual(body.stockHoldings, []);
    assert.equal(body.performanceHistory.length, 1);
    assert.deepEqual(body.availability, { holdings: "unavailable", performance: "available" });
    assert.deepEqual(harness.warnings, [["fund_detail_upstream_failure", {
      code: "510300", source: "holdings", failure: "request_failed"
    }]]);
  } finally {
    harness.restore();
  }
});

test("generated Worker returns unavailable detail when upstream fetches never settle", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: TimerHandler, _timeout?: number, ...args: unknown[]) =>
    originalSetTimeout(handler, 1, ...args)) as typeof setTimeout;
  const harness = await workerHarness(hangingDetailFetch());
  try {
    const response = await Promise.race([
      harness.worker.fetch(new Request("https://sites.test/api/funds/510300")),
      new Promise<never>((_, reject) => originalSetTimeout(() => reject(new Error("detail request did not settle")), 100))
    ]);
    const body = await response.json() as { stockHoldings: unknown[]; performanceHistory: unknown[]; availability: unknown };

    assert.equal(response.status, 200);
    assert.deepEqual(body.stockHoldings, []);
    assert.deepEqual(body.performanceHistory, []);
    assert.deepEqual(body.availability, { holdings: "unavailable", performance: "unavailable" });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    harness.restore();
  }
});

test("generated Worker logs parse failures without upstream response data", async () => {
  const harness = await workerHarness(upstreamFetch({ invalidHistory: true }));
  try {
    const response = await harness.worker.fetch(new Request("https://sites.test/api/funds/510300"));
    const body = await response.json() as { availability: unknown };

    assert.equal(response.status, 200);
    assert.deepEqual(body.availability, { holdings: "available", performance: "unavailable" });
    assert.deepEqual(harness.warnings, [["fund_detail_upstream_failure", {
      code: "510300", source: "history", failure: "parse_failed"
    }]]);
  } finally {
    harness.restore();
  }
});

test("generated Worker returns 404 only for an unknown quote", async () => {
  const harness = await workerHarness(upstreamFetch());
  try {
    const response = await harness.worker.fetch(new Request("https://sites.test/api/funds/999999"));

    assert.equal(response.status, 404);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  } finally {
    harness.restore();
  }
});

test("generated Worker returns a CORS error when quote upstreams fail", async () => {
  const harness = await workerHarness(upstreamFetch({ allFailure: true }));
  try {
    const response = await harness.worker.fetch(new Request("https://sites.test/api/funds/510300"));
    const body = await response.json() as { error: string };

    assert.equal(response.status, 502);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
    assert.equal(body.error, "实时数据源暂时不可用。");
  } finally {
    harness.restore();
  }
});

test("generated Worker reuses an in-flight detail load for the same code", async () => {
  const historyCalls = new Map<string, number>();
  const harness = await workerHarness(upstreamFetch({ historyCalls }));
  try {
    const request = () => harness.worker.fetch(new Request("https://sites.test/api/funds/510300"));
    const [first, second] = await Promise.all([request(), request()]);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(historyCalls.get("510300"), 1);
  } finally {
    harness.restore();
  }
});

test("generated Worker expires and bounds detail cache entries", async () => {
  const historyCalls = new Map<string, number>();
  const codes = Array.from({ length: 101 }, (_, index) => String(510000 + index));
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;
  const harness = await workerHarness(upstreamFetch({ codes, historyCalls }));
  try {
    for (const code of codes) {
      const response = await harness.worker.fetch(new Request(`https://sites.test/api/funds/${code}`));
      assert.equal(response.status, 200);
    }
    await harness.worker.fetch(new Request(`https://sites.test/api/funds/${codes[0]}`));
    assert.equal(historyCalls.get(codes[0]), 2);

    now += 600_001;
    await harness.worker.fetch(new Request(`https://sites.test/api/funds/${codes.at(-1)}`));
    assert.equal(historyCalls.get(codes.at(-1) ?? ""), 2);
  } finally {
    Date.now = originalNow;
    harness.restore();
  }
});
