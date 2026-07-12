# React Mantine 基金行情工作台迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有基金行情静态页面迁移为 React + Vite + Mantine 组件化工作台，保留 MCP Bridge 与基金 API 行为。

**Architecture:** Node MCP/HTTP 服务继续负责 `/api/funds`、`/api/funds/:code` 和静态文件服务；React 应用放在 `web/`，通过 Vite 构建到 `dist/`，由 Web Bridge 返回 `dist/index.html`。页面状态集中在 React，组件只通过 fetch 调用现有 API。

**Tech Stack:** React 18、React DOM、Vite、TypeScript、Mantine 7、Tabler Icons。

## Global Constraints

- 保留现有 MCP 工具名称：`fund_market_snapshot`、`fund_detail`。
- 默认查询 `limit=20`，重置后自动恢复初始化结果。
- 使用 Mantine `Select`、`Tabs`、`Skeleton`、`Button`、`Card`、`Drawer`、`Table` 组件，不使用浏览器原生下拉作为主要交互。
- “今日涨幅/今日回撤”只用于行情研究，不显示投资建议或买卖结论。
- 浏览器页面继续通过 HTTP Bridge → MCP Client → STDIO MCP 调用数据。

### Task 1: React/Vite/Mantine 构建链路

**Files:**
- Modify: `package.json`
- Create: `vite.config.ts`
- Create: `web/index.html`
- Create: `web/main.tsx`
- Create: `web/styles.css`
- Modify: `src/web-server.ts`

**Interfaces:**
- Produces Vite output at `dist/index.html` and assets under `dist/assets/`.
- `startWebDemo()` serves `dist/index.html` after `npm run build`.

- [ ] Add exact dependencies: `react`, `react-dom`, `@mantine/core`, `@mantine/hooks`, `@tabler/icons-react`, plus dev dependencies `vite`, `@vitejs/plugin-react`, `@types/react`, and `@types/react-dom`.
- [ ] Change scripts so `npm run build` runs TypeScript compilation and `vite build`, while `npm run web` starts the bridge after the build.
- [ ] Configure Vite root `web`, output `../dist`, and React plugin.
- [ ] Update `src/web-server.ts` `indexFile` from `public/index.html` to `dist/index.html` in `startWebDemo()`.
- [ ] Verify `npm run build` creates `dist/index.html` before any UI component work.

### Task 2: React component model and API state

**Files:**
- Create: `web/App.tsx`
- Create: `web/api.ts`
- Create: `web/types.ts`
- Create: `web/components/FilterBar.tsx`
- Create: `web/components/ResearchTabs.tsx`

**Interfaces:**
- `fetchFundSnapshot(params: FundQuery): Promise<FundSnapshot>` calls `/api/funds`.
- `fetchFundDetail(code: string): Promise<FundDetail>` calls `/api/funds/:code`.
- `FilterBar` emits `onSearch(query)` and `onReset()`.
- `ResearchTabs` emits one of `all | top | down | on_exchange | off_exchange`.

- [ ] Move the existing fund types needed by the browser into `web/types.ts` without changing server types.
- [ ] Implement URLSearchParams construction in `web/api.ts`, including `keyword`, `matchBy`, `market`, `sort`, and `limit`.
- [ ] Implement controlled Mantine selects for quick topic, match field, market, sort, and limit.
- [ ] Implement code detection in React state: six digits sets `matchBy` to `code`; returned industry/index can update the topic display only when a keyword exists.
- [ ] Add failing component-level checks for reset defaults and query parameter construction before implementation, then run the checks.

### Task 3: Mantine dashboard UI

**Files:**
- Modify: `web/App.tsx`
- Create: `web/components/OverviewPanel.tsx`
- Create: `web/components/FundTable.tsx`
- Create: `web/components/FundDetailPanel.tsx`
- Create: `web/components/McpChainDrawer.tsx`
- Modify: `web/styles.css`

**Interfaces:**
- `App` owns `query`, `activeTab`, `snapshot`, `selectedFund`, `loading`, and `error`.
- `FundTable` receives `items`, `loading`, and `onSelect(code)`.
- `McpChainDrawer` receives current request step state and `onClose`.

- [ ] Build the primary desktop layout as a focused two-column workbench: results/filter area on the left, `OverviewPanel` on the right.
- [ ] Use Mantine Tabs for research views, Mantine Table for fund results, Mantine Skeleton for loading, and Mantine Drawer for MCP chain details.
- [ ] Keep labels and value columns aligned; use `NumberFormatter`-style formatting helpers for price and change percentage.
- [ ] Add selected-row state and a compact detail panel/drawer for `fund_detail`.
- [ ] Add empty, error, loading, and success states with stable dimensions so the layout never jumps.
- [ ] Add responsive behavior: two columns on desktop, stacked sections under 960px, horizontally scrollable table only when necessary.

### Task 4: Request lifecycle, reset, and MCP chain state

**Files:**
- Modify: `web/App.tsx`
- Modify: `web/components/McpChainDrawer.tsx`

- [ ] Use `AbortController` for the active snapshot request and abort it on reset or a newer query.
- [ ] Reset query to `{ keyword: "", matchBy: "all", market: "all", sort: "change_desc", limit: 20 }`, activate the “全部” tab, clear selected detail, and immediately reload the default first 20 funds.
- [ ] Progress request stages visibly but without fake long delays: `input`, `browser`, `mcp`, `rendered`.
- [ ] Keep the MCP chain collapsed by default and open it only as an explicit debugging action.
- [ ] Ensure loading completion restores the button label and never lets an old response overwrite current state.

### Task 5: Tests, docs, and visual verification

**Files:**
- Modify: `test/web-server.test.ts`
- Create: `test/web-ui-contract.test.ts`
- Modify: `README.md`
- Modify: `docs/mcp-web-chain.md`

- [ ] Update static page tests to inspect Vite output and assert React/Mantine markers, dashboard title, research tabs, and default limit 20.
- [ ] Add API/UI contract tests for reset defaults, query construction, empty state, error state, and detail selection.
- [ ] Run `npm test`, `git diff --check`, and direct curl checks for default 20, industry keyword, and code lookup.
- [ ] Run the real browser at desktop and mobile sizes; verify Mantine Select opens, Tabs filter, Skeleton renders, reset reloads default data, and Drawer opens without overlap.
- [ ] Update Chinese docs with the React/Mantine component boundaries and build/run commands.

