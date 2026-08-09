import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import test from "node:test";

import {
  createWebServer,
  type WebServerOptions
} from "../src/web-server.js";
import type { FundDetail } from "../src/fund-types.js";

async function withServer(
  options: WebServerOptions,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const server = createWebServer(options);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("GET /api/hello returns MCP text as JSON", async () => {
  await withServer(
    {
      callHello: async (name) => ({
        content: [{ type: "text", text: `你好，${name}!` }]
      })
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/hello?name=Tony`);

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /application\/json/);
      assert.deepEqual(await response.json(), { text: "你好，Tony!" });
    }
  );
});

test("GET /api/hello rejects an empty name before calling MCP", async () => {
  let called = false;

  await withServer(
    {
      callHello: async () => {
        called = true;
        return { content: [] };
      }
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/hello?name=`);

      assert.equal(response.status, 400);
      assert.equal(called, false);
      assert.deepEqual(await response.json(), { error: "Name is required." });
    }
  );
});

test("GET /api/hello maps MCP failures to 502", async () => {
  await withServer(
    {
      callHello: async () => {
        throw new Error("upstream failed");
      }
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/hello?name=Tony`);

      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { error: "MCP tool call failed." });
    }
  );
});

test("GET /api/funds returns a filtered fund snapshot", async () => {
  await withServer(
    {
      callHello: async () => ({ content: [] }),
      callFundSnapshot: async (keyword, market, sort, limit, matchBy = "all") => ({
        keyword, matchBy, market, sort, limit, dataDate: "2026-07-11", updatedAt: "2026-07-11T10:00:00+08:00", isTradingDay: true,
        items: [{ code: "012345", name: "半导体精选混合", market: "off_exchange", fundType: "混合型", industry: "半导体", changePercent: -1.4, dataDate: "2026-07-10", updatedAt: "2026-07-11T10:00:00+08:00", isTradingDay: true, officialNavAvailable: false, source: "sample", matchedBy: ["名称", "行业"] }]
      })
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/funds?keyword=%E5%8D%8A%E5%AF%BC%E4%BD%93&market=off_exchange&limit=10`);
      assert.equal(response.status, 200);
      const body = await response.json() as { items: Array<{ code: string }> };
      assert.equal(body.items[0]?.code, "012345");
    }
  );
});

test("GET /api/funds rejects invalid query parameters", async () => {
  await withServer(
    { callHello: async () => ({ content: [] }), callFundSnapshot: async () => { throw new Error("should not call"); } },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/funds?limit=101`);
      assert.equal(response.status, 400);
      assert.match((await response.json() as { error: string }).error, /between 1 and 100/);
    }
  );
});

test("GET /api/funds/:code returns holdings and performance history", async () => {
  const detail: FundDetail = {
    code: "561780", name: "1000增强ETF博时", market: "on_exchange", fundType: "ETF",
    price: 1.6063, changePercent: 2.12, dataDate: "2026-07-14",
    updatedAt: "2026-07-14T15:00:00+08:00", isTradingDay: true,
    officialNavAvailable: true, source: "东方财富 ETF 行情", industryAllocation: [],
    stockHoldings: [{ rank: 1, stockCode: "001309", stockName: "德明利", navRatio: 1.05, reportDate: "2026-03-31" }],
    holdingsReportDate: "2026-03-31",
    performanceHistory: [{ date: "2026-07-14", value: 1.6063 }, { date: "2026-07-15", value: 1.5893 }],
    performanceSource: "东方财富基金历史净值",
    availability: { holdings: "available", performance: "available" }
  };

  await withServer({
    callHello: async () => ({ content: [] }),
    callFundDetail: async () => detail
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/funds/561780`);
    const body = await response.json() as FundDetail;

    assert.equal(response.status, 200);
    assert.equal(body.stockHoldings[0]?.stockCode, "001309");
    assert.equal(body.performanceHistory.at(-1)?.date, "2026-07-15");
    assert.equal(body.availability.holdings, "available");
  });
});

test("GET /api/funds/:code returns 404 when the detail caller finds no fund", async () => {
  let requestedCode: string | undefined;

  await withServer({
    callHello: async () => ({ content: [] }),
    callFundDetail: async (code) => {
      requestedCode = code;
      return undefined;
    }
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/funds/561780`);

    assert.equal(response.status, 404);
    assert.equal(requestedCode, "561780");
    assert.deepEqual(await response.json(), { error: "未找到该基金。" });
  });
});

test("unknown routes return 404", async () => {
  await withServer(
    {
      callHello: async () => ({ content: [] })
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/missing`);

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Not found." });
    }
  );
});

test("GET / serves the local MCP demo page", async () => {
  await withServer(
    {
      callHello: async () => ({ content: [] }),
      indexFile: resolve(process.cwd(), "dist/index.html")
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /text\/html/);
      assert.match(html, /id="root"/);
      assert.match(html, /公募基金市场雷达/);
      assert.match(html, /assets\/index-.*\.js/);
    }
  );
});
