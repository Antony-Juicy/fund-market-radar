import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { greet } from "./greeting.js";
import { EastmoneyFundAdapter, FundService, PythonFundAdapter } from "./fund-service.js";
import { fetchMarketOverview } from "./market-service.js";

const server = new McpServer({
  name: "demo-mcp",
  version: "0.1.0"
});

const fundService = new FundService(process.env.FUND_DATA_MODE === "sample" ? new PythonFundAdapter() : new EastmoneyFundAdapter());

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

server.registerTool(
  "fund_market_snapshot",
  {
    title: "查询公募基金行情",
    description: "查询国内公募基金场内与场外行情，支持代码、名称、指数和行业关键词。返回来源与数据时间，不构成投资建议。",
    inputSchema: {
      keyword: z.string().optional().describe("基金代码、名称、指数或行业关键词"),
      matchBy: z.enum(["all", "code", "name", "type", "index", "industry"]).optional().describe("关键词匹配字段"),
      market: z.enum(["all", "on_exchange", "off_exchange"]).optional().describe("全部、场内或场外"),
      sort: z.enum(["change_desc", "change_asc", "name"]).optional().describe("涨幅、跌幅或名称排序"),
      limit: z.number().int().min(1).max(100).optional().describe("返回数量，默认 20")
    }
  },
  async ({ keyword = "", matchBy = "all", market = "all", sort = "change_desc", limit = 20 }) => ({
    content: [{ type: "text", text: JSON.stringify(await fundService.snapshot(keyword, market, sort, limit, matchBy), null, 2) }]
  })
);

server.registerTool(
  "market_overview",
  {
    title: "查询大盘指数与资金流向",
    description: "查询大盘指数与行业板块主力净流向；流入、流出金额为正负板块净流向的分别汇总。",
    inputSchema: {}
  },
  async () => ({ content: [{ type: "text", text: JSON.stringify(await fetchMarketOverview(), null, 2) }] })
);

server.registerTool(
  "fund_detail",
  {
    title: "查询基金详情",
    description: "查询单只国内公募基金的最新行情、净值、区间收益与数据来源。",
    inputSchema: {
      code: z.string().regex(/^\d{6}$/).describe("六位基金代码")
    }
  },
  async ({ code }) => {
    const detail = await fundService.getDetail(code);
    if (!detail) return { content: [{ type: "text", text: JSON.stringify({ error: "基金不存在", code }) }] };
    return { content: [{ type: "text", text: JSON.stringify(detail, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
