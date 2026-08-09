# MCP Web 页面中文化与 UI 优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将本地 MCP Web 演示改造成“本地 MCP 工具调用工作台”，补齐中文设计说明，并通过真实浏览器验证调用链路。

**Architecture:** 保留现有 Node HTTP Bridge、STDIO MCP Server 和静态 HTML 架构。页面左侧负责真实调用，右侧展示四步操作链路；浏览器仍只访问 `/api/hello`，不直接连接 MCP 或修改 Codex 配置。

**Tech Stack:** TypeScript、Node.js 内置 HTTP、MCP SDK、原生 HTML/CSS/JavaScript、Node Test Runner。

## Global Constraints

- 不增加运行时依赖。
- 不写入 `~/.codex/config.toml`，不解析 `codex exec` 输出。
- 页面返回内容必须通过 `textContent` 渲染。
- 页面必须保留 320px 起步的响应式布局，并保证提交期间不会发生布局跳动。
- 文档和用户可见页面文案使用中文；代码标识、HTTP 路径和 JSON 字段保留原文。

---

### Task 1: 补充页面契约测试

**Files:**
- Modify: `test/web-server.test.ts`
- Test: `test/web-server.test.ts`

**Interfaces:**
- Consumes: `public/index.html` 静态页面内容。
- Produces: 对正式标题、左侧操作区、右侧步骤区和安全文本渲染约束的可重复检查。

- [ ] **Step 1: Write the failing test**

在现有静态页面测试中加入以下断言：

```ts
assert.match(page, /本地 MCP 工具调用工作台/);
assert.match(page, /在浏览器中调用并观察本地 MCP 工具/);
assert.match(page, /操作步骤/);
assert.match(page, /Browser|浏览器/);
assert.match(page, /textContent/);
```

- [ ] **Step 2: Run test to verify it fails**

运行：`npm test -- --test-name-pattern="serves the demo page"`

预期：失败，因为当前页面仍使用旧标题，缺少新的步骤区文案。

- [ ] **Step 3: Write minimal implementation**

在后续 Task 2 中一次性实现页面契约，不为测试增加额外接口。

- [ ] **Step 4: Run test to verify it passes**

运行：`npm test -- --test-name-pattern="serves the demo page"`

预期：页面契约测试通过。

- [ ] **Step 5: Commit**

```bash
git add test/web-server.test.ts
git commit -m "test: define Chinese MCP web page contract"
```

### Task 2: 实现工作台页面

**Files:**
- Modify: `public/index.html`
- Verify: `src/web-server.ts`

**Interfaces:**
- Consumes: `/api/hello?name=<姓名>` 返回的 `{ text: string }` 或 `{ error: string }`。
- Produces: 左侧可操作的 `hello` 调用区、右侧四步操作说明、加载/成功/错误状态。

- [ ] **Step 1: Write the failing test**

使用 Task 1 中的静态页面契约测试，确保正式标题、步骤说明和安全渲染入口必须存在。

- [ ] **Step 2: Run test to verify it fails**

运行：`npm test -- --test-name-pattern="serves the demo page"`

预期：失败并指出旧页面缺少新标题或操作步骤。

- [ ] **Step 3: Write minimal implementation**

重做 `public/index.html` 的页面结构，保持现有字段 `#name`、`#submit`、`#result` 和
`#status` 的兼容性：

```text
标题区：本地 MCP 工具调用工作台
左栏：hello 工具、name 输入框、调用工具按钮、Response 结果区
右栏：输入参数 -> 浏览器请求 -> Bridge 连接 MCP -> 返回结果
底部：Browser -> HTTP Bridge -> STDIO MCP -> hello 的链路摘要
```

提交处理继续请求 `/api/hello`，开始时禁用按钮，成功时用 `result.textContent` 显示
结果，失败时显示中文错误，最后恢复按钮。新增 `data-step` 状态钩子用于高亮步骤，
不改变 Web Bridge API。

- [ ] **Step 4: Run test to verify it passes**

运行：`npm test`

预期：全部测试通过。

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: redesign MCP web demo workbench"
```

### Task 3: 完成中文文档

**Files:**
- Modify: `docs/superpowers/specs/2026-07-11-local-web-demo-design.md`
- Modify: `docs/mcp-web-chain.md`

**Interfaces:**
- Consumes: 已确认的页面架构和交互设计。
- Produces: 中文设计说明和中文运行链路文档，命令、路径、JSON 字段保持准确。

- [ ] **Step 1: Write the failing test**

文档为 Markdown 说明文件，不新增运行时代码测试；用 `rg` 检查设计说明中不存在
英文段落标题，并检查文档提到的页面标题与 HTML 一致。

- [ ] **Step 2: Run test to verify it fails**

运行：`rg -n "^## (Goal|Architecture|Components|Data Flow|Error Handling|Testing|Non-goals|Run And Preview)" docs/superpowers/specs/2026-07-11-local-web-demo-design.md`

预期：当前英文设计说明匹配到英文标题。

- [ ] **Step 3: Write minimal implementation**

将设计说明改为中文，并补充已确认的双栏工作台、四步操作状态和正式标题；检查链路
文档中的运行命令、API 契约、文件职责和排查顺序与实现一致。

- [ ] **Step 4: Run test to verify it passes**

运行：`rg -n "^## (Goal|Architecture|Components|Data Flow|Error Handling|Testing|Non-goals|Run And Preview)" docs/superpowers/specs/2026-07-11-local-web-demo-design.md`

预期：无匹配；随后运行 `npm test`，确保文档改动没有影响项目。

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-07-11-local-web-demo-design.md docs/mcp-web-chain.md
git commit -m "docs: translate MCP web design guidance to Chinese"
```

### Task 4: 浏览器验证与交付检查

**Files:**
- Verify: `public/index.html`
- Verify: `src/web-server.ts`
- Verify: `docs/mcp-web-chain.md`

**Interfaces:**
- Consumes: 已构建的本地 Web Bridge。
- Produces: 桌面端和移动端页面截图级检查、真实 `hello` 调用结果和最终测试记录。

- [ ] **Step 1: Write the failing test**

无新增代码行为；先启动服务并用 `curl --noproxy '*'` 检查 API，确保验证入口明确。

- [ ] **Step 2: Run test to verify it fails**

在页面改动完成前，用旧页面检查新标题会失败；改动完成后直接进入浏览器验证。

- [ ] **Step 3: Write minimal implementation**

如发现桌面或移动端溢出，只调整 `public/index.html` 的 CSS，不改 API 和 MCP 调用协议。

- [ ] **Step 4: Run test to verify it passes**

运行：

```bash
npm test
curl --noproxy '*' -i 'http://127.0.0.1:3000/api/hello?name=Tony'
```

预期：测试全部通过，API 返回 HTTP 200 和 `{"text":"你好，Tony!"}`；浏览器中可输入
姓名并看到结果，桌面和移动端无横向溢出。

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: verify local MCP web demo delivery"
```
