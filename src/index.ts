import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { greet } from "./greeting.js";

const server = new McpServer({
  name: "demo-mcp",
  version: "0.1.0"
});

server.registerTool(
  "hello",
  {
    title: "Say Hello",
    description: "Return a greeting for a supplied name.",
    inputSchema: {
      name: z.string().describe("Name to greet")
    }
  },
  async ({ name }) => ({
    content: [
      {
        type: "text",
        text: greet(name)
      }
    ]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
