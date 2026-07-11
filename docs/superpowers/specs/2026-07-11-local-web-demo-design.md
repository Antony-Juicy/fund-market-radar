# Local Web Demo Design

## Goal

Add a local page at `http://127.0.0.1:3000` that accepts a name, calls the
existing `hello` MCP tool, and renders the returned text. The demo must not
write to Codex MCP configuration or parse terminal output.

## Architecture

One web-bridge Node process serves the page and an HTTP API. On startup, it
creates an MCP client and launches the existing compiled MCP server as a
second local Node process over STDIO. The browser communicates only with the
HTTP API.

```text
Browser -> GET /api/hello?name=Tony -> Web bridge -> MCP hello tool
Browser <- { "text": "Hello result" } <- Web bridge <- MCP result
```

The server binds to `127.0.0.1:3000` so the demo is local only. It uses Node's
built-in HTTP APIs and the existing MCP SDK; no new runtime dependency is
needed.

## Components

- `src/web-server.ts`: starts the HTTP server, owns the MCP client, validates
  requests, calls `hello`, and returns JSON.
- `src/web-helpers.ts`: contains independently testable input validation and
  MCP text extraction helpers.
- `public/index.html`: provides a name input, submit button, loading state,
  error state, and result area.
- `package.json`: adds a command that builds the project and starts the web
  demo.
- `docs/mcp-web-chain.md`: records the durable browser-to-MCP runtime chain,
  API contract, file ownership, and troubleshooting steps in Chinese.

## Data Flow

1. The user enters a name and submits the form.
2. The page requests `/api/hello?name=<value>`.
3. The web bridge trims and validates the name.
4. The bridge calls `client.callTool({ name: "hello", arguments: { name } })`.
5. The bridge extracts the first text content item and returns `{ "text": ... }`.
6. The page renders the text without inserting HTML.

## Error Handling

- Empty names and names longer than 80 characters return HTTP 400.
- MCP startup failures prevent the web server from claiming readiness.
- MCP call failures return HTTP 502 with a short JSON error message.
- Unknown routes return HTTP 404.
- The page disables submission while loading and displays request errors.

## Testing

- Unit tests cover name validation and MCP text extraction.
- HTTP tests use an injected fake tool caller to verify success, validation,
  and upstream failure behavior without launching a model or Codex.
- Final verification runs the full test suite, starts the local server, checks
  the API with `curl`, and exercises the page in a browser.

## Non-goals

- No persistent Codex MCP registration.
- No remote deployment, authentication, database, or framework migration.
- No parsing of `codex exec` output.

## Run And Preview

Run `npm run web`, then open `http://127.0.0.1:3000`. The bridge binds only to
the local loopback interface. `PORT=<number> npm run web` can select another
local port without changing the default.
