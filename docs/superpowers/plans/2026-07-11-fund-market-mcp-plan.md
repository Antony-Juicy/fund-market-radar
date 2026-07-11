# 国内公募基金行情 MCP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 TypeScript MCP 中增加场内/场外公募基金查询工具，并将 Web 页面优化为基金行情扫描台。

**Architecture:** 保留现有 Node MCP Server 和本地 Web Bridge。Node 负责 MCP 协议、参数校验和统一返回；Python AKShare 适配器负责访问基金数据源并输出 JSON；Web 页面调用本地 HTTP 接口展示列表和详情。实时行情与官方净值分别保留独立状态，绝不混为一个价格字段。

**Tech Stack:** TypeScript、Node.js、Python 3、AKShare、MCP SDK、Node Test Runner、原生 HTML/CSS/JavaScript。

## Global Constraints

- 场内基金使用实时价格/IOPV 字段，场外基金使用单位净值/日增长率字段。
- 场外当天正式净值在数据源发布前必须标记不可用或使用上一交易日正式净值。
- 行业配置带报告期日期，不标记为当天行情。
- 网络请求必须有超时和可识别错误。
- 测试不能依赖实时网络；实时网络只用于手工验收。
- 页面展示数据日期、更新时间、数据类型和来源。

---

### Task 1: 建立统一基金数据模型和参数校验

**Files:**
- Create: `src/fund-types.ts`
- Create: `src/fund-helpers.ts`
- Test: `test/fund-helpers.test.ts`

**Interfaces:**
- Produces: `FundMarket`, `FundSnapshot`, `FundQuery`, `normalizeFundQuery`, `matchFundKeyword`。
- Consumes: MCP JSON 参数和适配器归一化字段。

- [ ] **Step 1:** 为 `normalizeFundQuery` 写失败测试，覆盖默认市场、默认排序、limit 边界和空关键词。
- [ ] **Step 2:** 运行 `npm test -- --test-name-pattern="fund query"`，确认因函数不存在失败。
- [ ] **Step 3:** 实现纯函数参数校验和名称/代码/类型关键词匹配。
- [ ] **Step 4:** 运行同一测试并确认通过。
- [ ] **Step 5:** 提交 `git add src/fund-types.ts src/fund-helpers.ts test/fund-helpers.test.ts && git commit -m "feat: add normalized fund query model"`。

### Task 2: 增加 Python AKShare 适配器

**Files:**
- Create: `python/fund_adapter.py`
- Create: `python/requirements.txt`
- Test: `test/fund-adapter.test.ts`

**Interfaces:**
- Consumes: stdin JSON `{ "operation": "snapshot" | "detail", ... }`。
- Produces: stdout 单行 JSON，失败输出结构化错误到 stderr。

- [ ] **Step 1:** 使用固定 stdin/stdout 样本写失败的归一化适配器测试，不在测试中请求网络。
- [ ] **Step 2:** 运行 `npm test -- --test-name-pattern="fund adapter"`，确认适配器接口尚未实现。
- [ ] **Step 3:** 实现 Python 适配器：调用 `fund_etf_spot_em`、`fund_open_fund_daily_em` 和单只基金行业配置接口，转换为统一字段；为请求设置超时和空值状态。
- [ ] **Step 4:** 安装 `python/requirements.txt` 后运行适配器固定样本测试，确认输出字段稳定。
- [ ] **Step 5:** 提交 `git add python test/fund-adapter.test.ts && git commit -m "feat: add AKShare fund data adapter"`。

### Task 3: 注册 MCP 基金工具

**Files:**
- Modify: `src/index.ts`
- Create: `src/fund-service.ts`
- Test: `test/fund-mcp.test.ts`

**Interfaces:**
- Produces: `fund_market_snapshot` 和 `fund_detail` 两个 MCP 工具。
- Consumes: `FundQuery`、Python 适配器 JSON 和 `FundSnapshot`。

- [ ] **Step 1:** 写 MCP 工具注册和统一返回结构的失败测试，使用固定适配器调用器。
- [ ] **Step 2:** 运行 `npm test -- --test-name-pattern="fund MCP"`，确认新工具未注册而失败。
- [ ] **Step 3:** 实现服务层和 MCP 工具，补充来源、日期、更新时间、估值/净值状态以及空结果提示。
- [ ] **Step 4:** 运行基金 MCP 测试和全量 `npm test`。
- [ ] **Step 5:** 提交 `git add src test/fund-mcp.test.ts && git commit -m "feat: expose domestic fund MCP tools"`。

### Task 4: 接入 Web Bridge 和扫描台页面

**Files:**
- Modify: `src/web-server.ts`
- Modify: `public/index.html`
- Modify: `test/web-server.test.ts`

**Interfaces:**
- Produces: `GET /api/funds?keyword=&market=&sort=&limit=` 和基金详情接口。
- Consumes: MCP 基金工具统一返回结构。

- [ ] **Step 1:** 写失败的 HTTP 和静态页面测试，验证基金查询接口、市场切换、重置按钮和数据状态标签。
- [ ] **Step 2:** 运行针对性测试确认接口和页面尚未存在。
- [ ] **Step 3:** 实现 HTTP 路由和基金行情扫描台：搜索栏、场内/场外/全部切换、排序、列表、详情和重置；加载时显示数据源阶段。
- [ ] **Step 4:** 运行全量测试，并用浏览器验证桌面/移动端布局。
- [ ] **Step 5:** 提交 `git add src/web-server.ts public/index.html test/web-server.test.ts && git commit -m "feat: add fund market scan web interface"`。

### Task 5: 文档、数据源说明和真实验收

**Files:**
- Modify: `docs/mcp-web-chain.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-11-fund-market-mcp-design.md`

**Interfaces:**
- Produces: 中文运行链路、数据时间语义、环境安装和故障排查说明。

- [ ] **Step 1:** 检查文档中的命令、工具名、字段和页面入口是否与实现一致。
- [ ] **Step 2:** 运行 `npm test`、`git diff --check` 和 `curl --noproxy '*' 'http://127.0.0.1:3000/api/funds?keyword=半导体'`。
- [ ] **Step 3:** 手工启动 Python 依赖并进行一次真实查询，记录数据源返回的日期和更新时间，不写入测试快照。
- [ ] **Step 4:** 用浏览器确认页面能展示场内、场外和空结果状态，并检查控制台无错误。
- [ ] **Step 5:** 提交 `git add README.md docs && git commit -m "docs: document domestic fund MCP data semantics"`。
