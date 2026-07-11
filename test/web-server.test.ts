import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import {
  createWebServer,
  type WebServerOptions
} from "../src/web-server.js";

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
