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
