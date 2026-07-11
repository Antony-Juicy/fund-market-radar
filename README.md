# demo-mcp

A minimal TypeScript MCP server that exposes one tool: `hello`.

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Inspect

```bash
npx @modelcontextprotocol/inspector node build/src/index.js
```

## Local Web Demo

Start the local HTTP-to-MCP bridge:

```bash
npm run web
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000), enter a name, and select
**调用 MCP →**. Stop the server with `Ctrl+C`.

The page calls the same-origin HTTP endpoint:

```text
GET /api/hello?name=Tony
```

The endpoint returns:

```json
{"text":"你好，Tony!"}
```

The browser does not launch the STDIO process directly. The Node web bridge is
the MCP client and starts `build/src/index.js` as a child process. This flow
does not add anything to Codex MCP configuration.

See [docs/mcp-web-chain.md](docs/mcp-web-chain.md) for the complete runtime
chain, file ownership, API contract, and troubleshooting notes.

## Example MCP Client Configuration

```json
{
  "mcpServers": {
    "demo-mcp": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/demo-mcp/build/src/index.js"]
    }
  }
}
```
