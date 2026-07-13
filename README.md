# demo-mcp

一个 TypeScript MCP 示例服务，包含基础 `hello` 工具和国内公募基金行情工具；前端使用 React、Vite 和 Mantine。

## 安装与测试

```bash
npm install
npm test
```

## 启动预览

```bash
npm run web
```

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)，页面会展示“公募基金市场雷达”。
`npm run web` 默认使用真实行情；点击查询即可观察完整的 Browser → HTTP Bridge →
STDIO MCP → `fund_market_snapshot` 链路。

## 数据来源

真实模式直接读取东方财富公开行情接口，不依赖本地 Python：

- 场内 ETF：最新价、IOPV、涨跌幅、成交量、成交额、近 1 周和近 1 月收益。
- 场外公募：正式单位净值、日增长率、上一交易日、近 1 周、近 15 天和近 1 月收益。
- 市场概览：上证指数、深证成指、创业板指及行业主力净流向。

流入、流出金额是行业主力净流向正值与负值的分别汇总，不表示市场总成交额。周末和
休市日展示最近交易日数据，并在 JSON 中将 `isTradingDay` 标记为 `false`。

仅需固定样本进行离线演示时使用：

```bash
npm run web:sample
```

## MCP 工具

`src/index.ts` 注册：

- `hello({ name })`：返回中文问候语。
- `fund_market_snapshot({ keyword?, matchBy?, market?, sort?, limit? })`：按代码、名称、类型、指数或行业查询场内/场外公募基金行情。
- `market_overview()`：查询指数与行业板块主力净流向。
- `fund_detail({ code })`：查询单只基金详情与真实区间收益。

直接接入 MCP Inspector：

```bash
npx @modelcontextprotocol/inspector node build/src/index.js
```

Codex 或其他 MCP Client 的配置示例：

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

## 文档

- [中文链路文档](docs/mcp-web-chain.md)
- [项目开发全流程与详细流程图](docs/project-development-flow.md)
- [在 Obsidian 中打开项目全流程](obsidian://open?vault=Obsidian%20Vault&file=%E9%A1%B9%E7%9B%AE%2F%E5%85%AC%E5%8B%9F%E5%9F%BA%E9%87%91%E5%B8%82%E5%9C%BA%E9%9B%B7%E8%BE%BE-%E5%BC%80%E5%8F%91%E5%85%A8%E6%B5%81%E7%A8%8B)
- [基金 MCP 设计说明](docs/superpowers/specs/2026-07-11-fund-market-mcp-design.md)
- [基金 MCP 实施计划](docs/superpowers/plans/2026-07-11-fund-market-mcp-plan.md)
