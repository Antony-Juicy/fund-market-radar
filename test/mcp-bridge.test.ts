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
      serverEntry: resolve(process.cwd(), "build/src/index.js")
    });

    try {
      const result = await connection.callHello("Tony");
      assert.equal(extractText(result), "你好，Tony!");
    } finally {
      await connection.close();
    }
  }
);
