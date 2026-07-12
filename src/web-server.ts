import { readFile } from "node:fs/promises";
import {
  createServer,
  type Server,
  type ServerResponse
} from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
  HttpError,
  extractText,
  validateName,
  type ToolResultLike
} from "./web-helpers.js";
import { parseFundLimit, parseFundMarket, parseFundMatchBy, parseFundSort } from "./fund-helpers.js";
import type { FundDetail, FundMatchBy, FundSnapshot } from "./fund-types.js";
import type { MarketOverview } from "./market-service.js";

export interface HelloToolCaller {
  (name: string): Promise<ToolResultLike>;
}

export interface FundSnapshotCaller {
  (keyword: string, market: "all" | "on_exchange" | "off_exchange", sort: "change_desc" | "change_asc" | "name", limit: number, matchBy?: FundMatchBy): Promise<FundSnapshot>;
}

export interface FundDetailCaller {
  (code: string): Promise<FundDetail | undefined>;
}

export interface MarketOverviewCaller {
  (): Promise<MarketOverview>;
}

export interface WebServerOptions {
  callHello: HelloToolCaller;
  callFundSnapshot?: FundSnapshotCaller;
  callFundDetail?: FundDetailCaller;
  callMarketOverview?: MarketOverviewCaller;
  indexFile?: string;
  staticDir?: string;
}

export interface McpConnectionOptions {
  cwd: string;
  serverEntry: string;
  env?: Record<string, string>;
}

export interface HelloToolConnection {
  callHello: HelloToolCaller;
  callFundSnapshot: FundSnapshotCaller;
  callFundDetail: FundDetailCaller;
  callMarketOverview: MarketOverviewCaller;
  close(): Promise<void>;
}

export async function connectHelloTool(
  options: McpConnectionOptions
): Promise<HelloToolConnection> {
  const client = new Client({
    name: "demo-mcp-web",
    version: "0.1.0"
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [options.serverEntry],
    cwd: options.cwd,
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      ...options.env
    }
  });

  await client.connect(transport);

  return {
    callHello: async (name) => {
      const result = await client.callTool({
        name: "hello",
        arguments: { name }
      });

      if (!Array.isArray(result.content)) {
        throw new Error("MCP tool returned invalid content.");
      }

      return { content: result.content };
    },
    callFundSnapshot: async (keyword, market, sort, limit, matchBy) => {
      const result = await client.callTool({
        name: "fund_market_snapshot",
        arguments: { keyword, matchBy, market, sort, limit }
      });
      return extractJson<FundSnapshot>(result);
    },
    callFundDetail: async (code) => {
      const result = await client.callTool({
        name: "fund_detail",
        arguments: { code }
      });
      const detail = extractJson<FundDetail | { error: string }>(result);
      return "error" in detail ? undefined : detail;
    },
    callMarketOverview: async () => {
      const result = await client.callTool({ name: "market_overview", arguments: {} });
      return extractJson<MarketOverview>(result);
    },
    close: () => client.close()
  };
}

function extractJson<T>(result: unknown): T {
  const content = typeof result === "object" && result !== null && "content" in result ? result.content : undefined;
  if (!Array.isArray(content)) throw new Error("MCP tool returned invalid content.");
  const item = content.find((entry): entry is { type: "text"; text: string } => {
    return typeof entry === "object" && entry !== null && "type" in entry && entry.type === "text" && "text" in entry && typeof entry.text === "string";
  });
  if (!item) throw new Error("MCP tool returned no JSON text.");
  return JSON.parse(item.text) as T;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

export function createWebServer(options: WebServerOptions): Server {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/api/hello") {
      try {
        const name = validateName(url.searchParams.get("name"));
        const result = await options.callHello(name);
        sendJson(response, 200, { text: extractText(result) });
      } catch (error) {
        if (error instanceof HttpError) {
          sendJson(response, error.statusCode, { error: error.message });
        } else {
          sendJson(response, 502, { error: "MCP tool call failed." });
        }
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/funds" && options.callFundSnapshot) {
      try {
        const keyword = url.searchParams.get("keyword")?.trim() ?? "";
        const market = parseFundMarket(url.searchParams.get("market"));
        const matchBy = parseFundMatchBy(url.searchParams.get("matchBy"));
        const sort = parseFundSort(url.searchParams.get("sort"));
        const limit = parseFundLimit(url.searchParams.get("limit"));
        sendJson(response, 200, await options.callFundSnapshot(keyword, market, sort, limit, matchBy));
      } catch (error) {
        if (error instanceof Error && /must be/.test(error.message)) sendJson(response, 400, { error: error.message });
        else sendJson(response, 502, { error: "基金数据源暂时不可用。" });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/market-overview" && options.callMarketOverview) {
      try { sendJson(response, 200, await options.callMarketOverview()); }
      catch { sendJson(response, 502, { error: "实时指数或资金流向数据暂时不可用。" }); }
      return;
    }

    const detailMatch = request.method === "GET" && url.pathname.match(/^\/api\/funds\/(\d{6})$/);
    if (detailMatch && options.callFundDetail) {
      try {
        const detail = await options.callFundDetail(detailMatch[1]);
        if (!detail) sendJson(response, 404, { error: "未找到该基金。" });
        else sendJson(response, 200, detail);
      } catch { sendJson(response, 502, { error: "基金数据源暂时不可用。" }); }
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/" &&
      options.indexFile
    ) {
      try {
        const html = await readFile(options.indexFile);
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, max-age=0"
        });
        response.end(html);
      } catch {
        sendJson(response, 500, { error: "Page could not be loaded." });
      }
      return;
    }

    if (request.method === "GET" && options.staticDir && url.pathname.startsWith("/assets/")) {
      const assetPath = resolve(options.staticDir, `.${decodeURIComponent(url.pathname)}`);
      const root = resolve(options.staticDir);
      if (!assetPath.startsWith(`${root}/`)) {
        sendJson(response, 400, { error: "Invalid asset path." });
        return;
      }
      try {
        const asset = await readFile(assetPath);
        const type = assetPath.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8";
        response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
        response.end(asset);
      } catch { sendJson(response, 404, { error: "Asset not found." }); }
      return;
    }

    if (request.method === "GET" && url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  });
}

function listen(server: Server, port: number): Promise<AddressInfo> {
  return new Promise((resolveAddress, reject) => {
    const handleError = (error: Error) => {
      server.off("listening", handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off("error", handleError);
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Web server did not expose a TCP address."));
        return;
      }

      resolveAddress(address);
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(port, "127.0.0.1");
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

export async function startWebDemo(): Promise<void> {
  const modulePath = fileURLToPath(import.meta.url);
  const moduleDir = dirname(modulePath);
  const projectRoot = resolve(moduleDir, "../..");
  const requestedPort = Number(process.env.PORT ?? "3000");

  if (
    !Number.isInteger(requestedPort) ||
    requestedPort < 0 ||
    requestedPort > 65_535
  ) {
    throw new Error("PORT must be an integer between 0 and 65535.");
  }

  const connection = await connectHelloTool({
    cwd: projectRoot,
    serverEntry: resolve(moduleDir, "index.js")
  });
  const server = createWebServer({
    callHello: connection.callHello,
    callFundSnapshot: connection.callFundSnapshot,
    callFundDetail: connection.callFundDetail,
    callMarketOverview: connection.callMarketOverview,
    indexFile: resolve(projectRoot, "dist/index.html"),
    staticDir: resolve(projectRoot, "dist")
  });

  let address: AddressInfo;
  try {
    address = await listen(server, requestedPort);
  } catch (error) {
    await connection.close();
    throw error;
  }

  let shutdownPromise: Promise<void> | undefined;
  const shutdown = (): Promise<void> => {
    shutdownPromise ??= (async () => {
      await closeServer(server);
      await connection.close();
    })();

    return shutdownPromise;
  };
  const handleSignal = () => {
    void shutdown().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
  console.log(`Web demo ready at http://127.0.0.1:${address.port}`);
}

const currentModulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentModulePath) {
  await startWebDemo();
}
