import { readFile } from "node:fs/promises";
import {
  createServer,
  type Server,
  type ServerResponse
} from "node:http";

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
