# Local MCP Web Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve a local page on `http://127.0.0.1:3000` that calls the existing `hello` MCP tool and renders its text result.

**Architecture:** A Node HTTP bridge serves a same-origin HTML page and JSON API. The bridge starts the compiled MCP server as a child process through `StdioClientTransport`, calls `hello`, and converts the MCP content array into `{ "text": string }` for the browser.

**Tech Stack:** TypeScript, Node.js built-in HTTP server, MCP TypeScript SDK 1.29.0, Node test runner, HTML/CSS/JavaScript.

## Global Constraints

- Bind to `127.0.0.1` and default to port `3000`.
- Do not write Codex MCP configuration or parse `codex exec` output.
- Do not add a web framework or another runtime dependency.
- Validate trimmed names as 1-80 Unicode characters.
- Render returned text with `textContent`, never `innerHTML`.
- Keep the design document at `docs/superpowers/specs/2026-07-11-local-web-demo-design.md`.

---

### Task 1: Validate Names And Extract MCP Text

**Files:**
- Create: `src/web-helpers.ts`
- Create: `test/web-helpers.test.ts`

**Interfaces:**
- Produces: `HttpError`, `validateName(value: string | null): string`, `extractText(result: ToolResultLike): string`, and `ToolResultLike`.

- [ ] **Step 1: Write the failing helper tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { HttpError, extractText, validateName } from "../src/web-helpers.js";

test("validateName trims a valid name", () => {
  assert.equal(validateName("  Tony  "), "Tony");
});

test("validateName rejects an empty name", () => {
  assert.throws(
    () => validateName("   "),
    (error) => error instanceof HttpError && error.statusCode === 400
  );
});

test("validateName rejects a name longer than 80 characters", () => {
  assert.throws(
    () => validateName("a".repeat(81)),
    (error) => error instanceof HttpError && error.statusCode === 400
  );
});

test("extractText returns the first MCP text content item", () => {
  assert.equal(
    extractText({ content: [{ type: "image" }, { type: "text", text: "hello" }] }),
    "hello"
  );
});

test("extractText rejects a result without text content", () => {
  assert.throws(
    () => extractText({ content: [{ type: "image" }] }),
    /no text content/i
  );
});
```

- [ ] **Step 2: Run `npm run build` and verify it fails because `src/web-helpers.ts` is missing.**

- [ ] **Step 3: Implement the helper module**

```ts
export interface ToolResultLike {
  content: unknown[];
}

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function validateName(value: string | null): string {
  const name = value?.trim() ?? "";
  if (name.length === 0) throw new HttpError(400, "Name is required.");
  if (Array.from(name).length > 80) {
    throw new HttpError(400, "Name must be 80 characters or fewer.");
  }
  return name;
}

export function extractText(result: ToolResultLike): string {
  const item = result.content.find(
    (entry): entry is { type: "text"; text: string } =>
      typeof entry === "object" && entry !== null &&
      "type" in entry && entry.type === "text" &&
      "text" in entry && typeof entry.text === "string"
  );
  if (!item) throw new Error("MCP tool returned no text content.");
  return item.text;
}
```

- [ ] **Step 4: Run `npm test`; expect six tests and zero failures.**

- [ ] **Step 5: Commit**

```bash
git add src/web-helpers.ts test/web-helpers.test.ts
git commit -m "feat: add web bridge result helpers"
```

### Task 2: Add The Injectable HTTP API

**Files:**
- Create: `src/web-server.ts`
- Create: `test/web-server.test.ts`

**Interfaces:**
- Consumes: `HttpError`, `extractText`, `validateName`, and `ToolResultLike` from Task 1.
- Produces: `HelloToolCaller`, `createWebServer(options): Server`, and `startWebDemo(): Promise<void>`.

- [ ] **Step 1: Write failing HTTP API tests**

```ts
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createWebServer } from "../src/web-server.js";

type ToolResult = { content: unknown[] };

async function withServer(
  callHello: (name: string) => Promise<ToolResult>,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const server = createWebServer({ callHello });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

test("GET /api/hello returns MCP text as JSON", async () => {
  await withServer(
    async (name) => ({ content: [{ type: "text", text: `你好，${name}!` }] }),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/hello?name=Tony`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { text: "你好，Tony!" });
    }
  );
});

test("GET /api/hello rejects an empty name before calling MCP", async () => {
  let called = false;
  await withServer(
    async () => { called = true; return { content: [] }; },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/hello?name=`);
      assert.equal(response.status, 400);
      assert.equal(called, false);
    }
  );
});

test("GET /api/hello maps MCP failures to 502", async () => {
  await withServer(
    async () => { throw new Error("upstream failed"); },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/hello?name=Tony`);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { error: "MCP tool call failed." });
    }
  );
});
```

- [ ] **Step 2: Run `npm run build`; verify it fails because `src/web-server.ts` is missing.**

- [ ] **Step 3: Implement `createWebServer`**

```ts
import { readFile } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import { HttpError, extractText, validateName, type ToolResultLike } from "./web-helpers.js";

export interface HelloToolCaller {
  (name: string): Promise<ToolResultLike>;
}

export interface WebServerOptions {
  callHello: HelloToolCaller;
  indexFile?: string;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

export function createWebServer(options: WebServerOptions): Server {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/api/hello") {
      try {
        const name = validateName(url.searchParams.get("name"));
        sendJson(response, 200, { text: extractText(await options.callHello(name)) });
      } catch (error) {
        if (error instanceof HttpError) {
          sendJson(response, error.statusCode, { error: error.message });
        } else {
          sendJson(response, 502, { error: "MCP tool call failed." });
        }
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/" && options.indexFile) {
      try {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(await readFile(options.indexFile));
      } catch {
        sendJson(response, 500, { error: "Page could not be loaded." });
      }
      return;
    }
    sendJson(response, 404, { error: "Not found." });
  });
}
```

- [ ] **Step 4: Run `npm test`; expect API tests to pass with zero failures.**

- [ ] **Step 5: Commit**

```bash
git add src/web-server.ts test/web-server.test.ts
git commit -m "feat: add local MCP HTTP bridge"
```

### Task 3: Add The Local Demo Page

**Files:**
- Create: `public/index.html`
- Modify: `test/web-server.test.ts`

**Interfaces:**
- Consumes: `GET /api/hello?name=<value>` returning `{ text: string }` or `{ error: string }`.
- Produces: A same-origin form that renders the result into `#result` with `textContent`.

- [ ] **Step 1: Add a failing test that requests `/` with `indexFile` set and asserts status 200, `text/html`, `id="hello-form"`, and `id="result"`.**

- [ ] **Step 2: Run `npm test`; verify the static-page test fails because `public/index.html` is missing.**

- [ ] **Step 3: Create `public/index.html`**

The page must contain this functional structure:

```html
<form id="hello-form">
  <label for="name">Name</label>
  <div class="field-row">
    <input id="name" name="name" value="Tony" maxlength="80" required>
    <button type="submit">Call MCP</button>
  </div>
</form>
<p id="status" role="status" aria-live="polite">Ready</p>
<output id="result">The MCP result will appear here.</output>
```

Its script must call `/api/hello`, disable the button while loading, parse the
JSON response, render with `textContent`, display API errors, and re-enable the
button in `finally`. Use a restrained developer-tool layout with white, ink,
cyan, and coral colors; square geometry; no external assets; and responsive
wrapping below 640px.

- [ ] **Step 4: Run `npm test`; expect the page and API tests to pass.**

- [ ] **Step 5: Commit**

```bash
git add public/index.html test/web-server.test.ts
git commit -m "feat: add MCP web demo interface"
```

### Task 4: Wire The Real MCP Runtime And Documentation

**Files:**
- Modify: `src/web-server.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-11-local-web-demo-design.md`

**Interfaces:**
- Consumes: compiled `build/src/index.js`, MCP `Client`, and `StdioClientTransport`.
- Produces: `npm run web`, `http://127.0.0.1:3000`, and durable chain documentation.

- [ ] **Step 1: Add `startWebDemo()` and the ESM main guard**

```ts
const moduleDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(moduleDir, "../..");
const client = new Client({ name: "demo-mcp-web", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(moduleDir, "index.js")],
  cwd: projectRoot
});
await client.connect(transport);

const server = createWebServer({
  indexFile: resolve(projectRoot, "public/index.html"),
  callHello: (name) => client.callTool({ name: "hello", arguments: { name } })
});
```

Listen on `127.0.0.1` and `Number(process.env.PORT ?? 3000)`, print the ready
URL, and close both HTTP server and MCP client on `SIGINT` or `SIGTERM`. The
main guard must prevent startup when tests import this module.

- [ ] **Step 2: Add `"web": "npm run build && node build/src/web-server.js"` to `package.json`.**

- [ ] **Step 3: Update `README.md` and the design MD with the command, URL, JSON response shape, shutdown instructions, final file map, and the browser -> HTTP bridge -> STDIO MCP chain.**

- [ ] **Step 4: Run `npm test`; expect all tests to pass.**

- [ ] **Step 5: Run `npm run web`, then verify the real chain**

```bash
curl -sS 'http://127.0.0.1:3000/api/hello?name=Tony'
```

Expected: `{"text":"你好，Tony!"}`.

- [ ] **Step 6: Commit**

```bash
git add src/web-server.ts package.json README.md \
  docs/superpowers/specs/2026-07-11-local-web-demo-design.md
git commit -m "feat: connect web demo to MCP server"
```

### Task 5: Browser Verification And Handoff

**Files:**
- Modify only if verification exposes a defect.

**Interfaces:**
- Consumes: `npm run web` and `http://127.0.0.1:3000`.
- Produces: A verified local preview and concise handoff.

- [ ] **Step 1: Open the page at desktop and narrow mobile widths; verify no overlap or layout shift.**

- [ ] **Step 2: Submit `Tony`; verify the page visibly renders `你好，Tony!`.**

- [ ] **Step 3: Submit an empty value, verify an understandable error, then submit a valid value and verify recovery.**

- [ ] **Step 4: Run fresh completion checks**

```bash
npm test
git status --short
curl -sS 'http://127.0.0.1:3000/api/hello?name=Tony'
```

Expected: zero test failures, only intentional working-tree changes, and the
real MCP JSON result.
