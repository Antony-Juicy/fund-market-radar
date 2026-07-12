import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { connectHelloTool } from "../src/web-server.js";
import { extractText } from "../src/web-helpers.js";

test(
  "connectHelloTool launches the MCP server and calls hello",
  { timeout: 5_000 },
  async () => {
    const connection = await connectHelloTool({
      cwd: process.cwd(),
      serverEntry: resolve(process.cwd(), "build/src/index.js"),
      env: { FUND_DATA_MODE: "sample" }
    });

    try {
      const result = await connection.callHello("Tony");
      assert.equal(extractText(result), "你好，Tony!");
    } finally {
      await connection.close();
    }
  }
);

test(
  "connectHelloTool can call fund MCP tools with the fixed adapter",
  { timeout: 5_000 },
  async () => {
    const connection = await connectHelloTool({
      cwd: process.cwd(),
      serverEntry: resolve(process.cwd(), "build/src/index.js"),
      env: { FUND_DATA_MODE: "sample" }
    });

    try {
      const result = await connection.callFundSnapshot("半导体", "off_exchange", "change_desc", 20, "industry");
      assert.ok(result.items.some((item) => item.code === "012345"));
      const detail = await connection.callFundDetail("510300");
      assert.equal(detail?.name, "沪深300ETF");
    } finally {
      await connection.close();
    }
  }
);
