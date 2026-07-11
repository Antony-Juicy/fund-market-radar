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

export interface HelloToolCaller {
  (name: string): Promise<ToolResultLike>;
}

export interface WebServerOptions {
  callHello: HelloToolCaller;
  indexFile?: string;
}

export interface McpConnectionOptions {
  cwd: string;
  serverEntry: string;
}

export interface HelloToolConnection {
  callHello: HelloToolCaller;
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
    cwd: options.cwd
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
    close: () => client.close()
  };
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

    if (
      request.method === "GET" &&
      url.pathname === "/" &&
      options.indexFile
    ) {
      try {
        const html = await readFile(options.indexFile);
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8"
        });
        response.end(html);
      } catch {
        sendJson(response, 500, { error: "Page could not be loaded." });
      }
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
    indexFile: resolve(projectRoot, "public/index.html")
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
