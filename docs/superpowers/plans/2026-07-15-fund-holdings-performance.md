# 基金持仓与业绩曲线实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将基金详情升级为真实的前十大股票持仓和五个时间区间的基金自身累计收益曲线，并在本地 MCP、Sites 和 GitHub Pages 保持一致。

**Architecture:** 扩展现有 `fund_detail` 和 `GET /api/funds/:code` 契约，由服务端并行聚合东方财富历史净值与季度持仓。接口返回约一年历史净值和最新前十大持仓，React 端只负责按区间筛选、归一化和展示；Sites Worker 实现相同动态接口，GitHub Pages 的详情请求单独回源 Sites。

**Tech Stack:** TypeScript、Node.js Fetch、MCP SDK、React 18、Mantine 7、Recharts、Cloudflare Workers-compatible Sites、Node Test Runner、Playwright。

## Global Constraints

- 只展示真实上游数据；不得生成示例持仓或虚构收益点。
- 历史收益优先使用累计净值，缺失时使用单位净值。
- 持仓是最新季度披露数据，必须展示报告日期和“非实时持仓”提示。
- 缺失数字保持 `undefined`，不得转换为 `0`。
- `empty` 与 `unavailable` 必须分开，分别表示真实空数据与上游失败。
- 曲线只展示基金自身累计收益，不叠加指数或业绩基准。
- 支持 `近15天 / 近1月 / 近3月 / 近1年 / 今年以来`。
- GitHub Pages 列表继续使用静态数据，详情通过 Sites 动态接口获取。

## File Structure

- Create `src/fund-performance.ts`: 区间边界、历史点筛选和累计收益归一化。
- Create `src/fund-detail-source.ts`: 东方财富历史净值与持仓响应解析、请求和详情缓存。
- Modify `src/fund-types.ts`: 新增持仓、历史点、可用性和曲线周期类型。
- Modify `src/fund-service.ts`: 将基础行情与研究详情聚合为完整 `FundDetail`。
- Modify `src/index.ts`: 更新 MCP 工具描述，不改变工具名和输入参数。
- Modify `src/web-server.ts`: 保持详情路由并返回扩展契约。
- Modify `scripts/build-sites-worker.mjs`: 为 Sites 增加同契约的真实详情聚合、缓存和 CORS。
- Modify `web/types.ts`: 同步浏览器侧详情契约。
- Modify `web/api.ts`: GitHub Pages 的详情改为请求 Sites 动态接口。
- Create `web/components/FundPerformanceChart.tsx`: 区间切换、收益摘要和 Recharts 曲线。
- Create `web/components/FundHoldingsList.tsx`: 前十大股票持仓和比例条。
- Modify `web/components/FundDetailPanel.tsx`: 组合摘要、曲线、持仓、错误态和移动端结构。
- Modify `web/styles.css`: 详情抽屉、图表、持仓行和响应式样式。
- Modify `package.json` and `package-lock.json`: 增加 `recharts`。
- Create `test/fund-performance.test.ts`: 五个区间和收益归一化测试。
- Create `test/fund-detail-source.test.ts`: 历史净值和持仓解析测试。
- Modify `test/fund-service.test.ts`: 部分成功与缓存测试。
- Modify `test/web-server.test.ts`: 扩展详情接口契约测试。
- Modify `test/sites-worker-contract.test.ts`: Sites 详情路由、缓存和 CORS 契约测试。
- Modify `test/runtime-data-source.test.ts`: GitHub Pages 动态详情回源测试。

---

### Task 1: Performance Range Domain

**Files:**
- Create: `src/fund-performance.ts`
- Modify: `src/fund-types.ts`
- Modify: `web/types.ts`
- Test: `test/fund-performance.test.ts`

**Interfaces:**
- Produces: `FundPerformancePeriod`, `FundPerformancePoint`, `FundPerformanceSeriesPoint`, `buildPerformanceSeries(history, period)`。
- Consumes: ISO 日期字符串和真实净值序列。

- [ ] **Step 1: Write the failing period and normalization tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildPerformanceSeries } from "../src/fund-performance.js";

const history = [
  { date: "2025-07-10", value: 1.00 },
  { date: "2026-01-02", value: 1.10 },
  { date: "2026-04-15", value: 1.05 },
  { date: "2026-06-30", value: 1.20 },
  { date: "2026-07-15", value: 1.21 }
];

test("normalizes a selected performance range from zero", () => {
  const result = buildPerformanceSeries(history, "month");
  assert.equal(result.points[0]?.returnPercent, 0);
  assert.equal(result.points.at(-1)?.returnPercent, 0.83);
});

test("uses January 1 as the year-to-date boundary", () => {
  const result = buildPerformanceSeries(history, "year_to_date");
  assert.equal(result.points[0]?.date, "2026-01-02");
  assert.equal(result.points.at(-1)?.returnPercent, 10);
});

test("returns no chart for fewer than two valid points", () => {
  const result = buildPerformanceSeries([{ date: "2026-07-15", value: 1.21 }], "half_month");
  assert.deepEqual(result.points, []);
  assert.equal(result.totalReturn, undefined);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run build`

Expected: FAIL with `Cannot find module '../src/fund-performance.js'`.

- [ ] **Step 3: Add the exact domain types and minimal range implementation**

Add to `src/fund-types.ts` and mirror in `web/types.ts`:

```ts
export type FundPerformancePeriod = "half_month" | "month" | "quarter" | "year" | "year_to_date";
export interface FundPerformancePoint { date: string; value: number; unitNav?: number; cumulativeNav?: number; }
export interface FundPerformanceSeriesPoint extends FundPerformancePoint { returnPercent: number; }
export interface FundStockHolding {
  rank: number;
  stockCode: string;
  stockName: string;
  navRatio: number;
  sharesWan?: number;
  marketValueWan?: number;
  reportDate: string;
}
export interface FundDetailAvailability {
  holdings: "available" | "empty" | "unavailable";
  performance: "available" | "empty" | "unavailable";
}
export interface FundResearchDetail {
  stockHoldings: FundStockHolding[];
  holdingsReportDate?: string;
  performanceHistory: FundPerformancePoint[];
  performanceSource: string;
  availability: FundDetailAvailability;
}
export interface FundDetail extends FundQuote, FundResearchDetail {
  industryAllocation: FundIndustryAllocation[];
}
```

Create `src/fund-performance.ts` with this pure implementation:

```ts
import type {
  FundPerformancePeriod,
  FundPerformancePoint,
  FundPerformanceSeriesPoint
} from "./fund-types.js";

function boundaryFor(latestDate: string, period: FundPerformancePeriod): string {
  const latest = new Date(`${latestDate}T00:00:00Z`);
  if (period === "year_to_date") return `${latestDate.slice(0, 4)}-01-01`;
  if (period === "half_month") latest.setUTCDate(latest.getUTCDate() - 15);
  if (period === "month") latest.setUTCMonth(latest.getUTCMonth() - 1);
  if (period === "quarter") latest.setUTCMonth(latest.getUTCMonth() - 3);
  if (period === "year") latest.setUTCFullYear(latest.getUTCFullYear() - 1);
  return latest.toISOString().slice(0, 10);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildPerformanceSeries(
  history: FundPerformancePoint[],
  period: FundPerformancePeriod
): { points: FundPerformanceSeriesPoint[]; totalReturn?: number } {
  const ordered = history
    .filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.value) && point.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered.at(-1);
  if (!latest) return { points: [] };
  const selected = ordered.filter((point) => point.date >= boundaryFor(latest.date, period));
  if (selected.length < 2) return { points: [] };
  const base = selected[0].value;
  const points = selected.map((point) => ({
    ...point,
    returnPercent: round2((point.value / base - 1) * 100)
  }));
  return { points, totalReturn: points.at(-1)?.returnPercent };
}
```

Use UTC date arithmetic so local timezone cannot shift an ISO date. For month-based periods use `setUTCMonth`; for `year_to_date` construct `${latestYear}-01-01`.

- [ ] **Step 4: Verify GREEN**

Run: `npm run build && node --test build/test/fund-performance.test.js`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fund-performance.ts src/fund-types.ts web/types.ts test/fund-performance.test.ts
git commit -m "feat: add fund performance ranges"
```

---

### Task 2: Eastmoney Detail Source Parsers

**Files:**
- Create: `src/fund-detail-source.ts`
- Test: `test/fund-detail-source.test.ts`

**Interfaces:**
- Produces: `parseFundHistoryResponse(text)`, `parseFundHoldingsResponse(text)`, `EastmoneyFundDetailSource.getResearchDetail(code)`。
- Returns: `{ stockHoldings, holdingsReportDate, performanceHistory, performanceSource, availability }`。
- Consumes: `FundStockHolding`, `FundPerformancePoint` and availability types from Task 1/`fund-types.ts`。

- [ ] **Step 1: Write failing parser tests using fixed upstream fragments**

```ts
const HOLDINGS_FIXTURE = `var apidata={ content:"<div class='box'><h4>2026年1季度股票投资明细 截止至：<font>2026-03-31</font></h4><table><tbody><tr><td>1</td><td><a>001309</a></td><td><a>德明利</a></td><td></td><td></td><td></td><td>1.05%</td><td>0.09</td><td>34.21</td></tr><tr><td>2</td><td><a>603588</a></td><td><a>高能环境</a></td><td></td><td></td><td></td><td>0.98%</td><td>0.12</td><td>31.40</td></tr></tbody></table></div>",arryear:[2026] };`;

test("parses cumulative NAV history without inventing missing numbers", () => {
  const parsed = parseFundHistoryResponse(JSON.stringify({
    Data: { LSJZList: [
      { FSRQ: "2026-07-15", DWJZ: "1.5893", LJJZ: "1.6893" },
      { FSRQ: "2026-07-14", DWJZ: "1.6063", LJJZ: "" }
    ] }
  }));
  assert.deepEqual(parsed, [
    { date: "2026-07-14", value: 1.6063, unitNav: 1.6063 },
    { date: "2026-07-15", value: 1.6893, unitNav: 1.5893, cumulativeNav: 1.6893 }
  ]);
});

test("parses the latest disclosed top holdings and report date", () => {
  const parsed = parseFundHoldingsResponse(HOLDINGS_FIXTURE);
  assert.equal(parsed.reportDate, "2026-03-31");
  assert.deepEqual(parsed.items[0], {
    rank: 1,
    stockCode: "001309",
    stockName: "德明利",
    navRatio: 1.05,
    sharesWan: 0.09,
    marketValueWan: 34.21,
    reportDate: "2026-03-31"
  });
});
```

The fixture must contain the real response structure `var apidata={ content:"...<tbody>...</tbody>..." }` but only two rows, so it remains readable and deterministic.

- [ ] **Step 2: Run and verify RED**

Run: `npm run build`

Expected: FAIL because `src/fund-detail-source.ts` does not exist.

- [ ] **Step 3: Implement dedicated, testable parsers**

Implement:

```ts
export function parseFundHistoryResponse(text: string): FundPerformancePoint[];
export function parseFundHoldingsResponse(text: string): {
  items: FundStockHolding[];
  reportDate?: string;
};
```

Rules:

- Parse the history body as JSON and reject a missing `Data.LSJZList` array.
- Parse numbers with one shared `publishedNumber()` helper; blank, `-`, `null` and non-finite values return `undefined`.
- Prefer `LJJZ` for `value`, otherwise use `DWJZ`.
- Decode the `content` JavaScript string before extracting table cells.
- Strip HTML tags and decode `&nbsp;`, `&amp;`, `&lt;`, `&gt;` through a dedicated `plainText()` helper.
- Limit holdings to 10 and keep only rows with code, name and `navRatio`.
- Never infer a report date from the current date.

- [ ] **Step 4: Add real requests, independent availability and cache**

Implement `EastmoneyFundDetailSource` with an injected `fetch` and clock so tests do not depend on the network. Store `{ expiresAt, value: Promise<FundResearchDetail> }` per code before awaiting the load; this makes concurrent calls share one in-flight promise. The load method must start history and holdings requests together, wrap each request in its own 15-second `AbortController`, and resolve them through `Promise.allSettled`. Convert fulfilled non-empty results to `available`, fulfilled empty results to `empty`, and rejected requests to `unavailable`. Keep successful and partial-success values for 10 minutes; remove a cache entry only when construction of the complete `FundResearchDetail` itself rejects unexpectedly.

Use these sources:

```text
GET https://api.fund.eastmoney.com/f10/lsjz?fundCode={code}&pageIndex=1&pageSize=400&startDate={oneYearMinus10Days}&endDate={today}
GET https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code={code}&topline=10&year=&month=
```

- [ ] **Step 5: Verify GREEN and error-state tests**

Add tests with injected fetch implementations proving:

- two concurrent requests for one code reuse one load;
- history failure plus valid holdings produces `performance: "unavailable"` and `holdings: "available"`;
- an empty valid holdings body produces `holdings: "empty"`.

Run: `npm run build && node --test build/test/fund-detail-source.test.js`

Expected: all parser, cache and partial-failure tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/fund-detail-source.ts test/fund-detail-source.test.ts src/fund-types.ts web/types.ts
git commit -m "feat: load real fund research detail"
```

---

### Task 3: MCP Service And HTTP Detail Contract

**Files:**
- Modify: `src/fund-service.ts`
- Modify: `src/index.ts`
- Modify: `src/web-server.ts`
- Modify: `test/fund-service.test.ts`
- Modify: `test/web-server.test.ts`
- Modify: `test/mcp-bridge.test.ts`

**Interfaces:**
- Consumes: `EastmoneyFundDetailSource.getResearchDetail(code)` from Task 2.
- Produces: extended `FundDetail` through MCP `fund_detail` and `GET /api/funds/:code`.

- [ ] **Step 1: Write failing service and HTTP contract tests**

```ts
test("GET /api/funds/:code returns holdings and performance history", async () => {
  const detail: FundDetail = {
    code: "561780", name: "1000增强ETF博时", market: "on_exchange", fundType: "ETF",
    price: 1.6063, changePercent: 2.12, dataDate: "2026-07-14",
    updatedAt: "2026-07-14T15:00:00+08:00", isTradingDay: true,
    officialNavAvailable: true, source: "东方财富 ETF 行情", industryAllocation: [],
    stockHoldings: [{ rank: 1, stockCode: "001309", stockName: "德明利", navRatio: 1.05, reportDate: "2026-03-31" }],
    holdingsReportDate: "2026-03-31",
    performanceHistory: [{ date: "2026-07-14", value: 1.6063 }, { date: "2026-07-15", value: 1.5893 }],
    performanceSource: "东方财富基金历史净值",
    availability: { holdings: "available", performance: "available" }
  };
  await withServer({
    callHello: async () => ({ content: [] }),
    callFundDetail: async () => detail
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/funds/561780`);
    const body = await response.json() as FundDetail;
    assert.equal(response.status, 200);
    assert.equal(body.stockHoldings[0]?.stockCode, "001309");
    assert.equal(body.performanceHistory.at(-1)?.date, "2026-07-15");
    assert.equal(body.availability.holdings, "available");
  });
});
```

Add a service test whose adapter returns a quote and whose detail source returns research fields; assert that `getDetail()` merges them without overwriting quote identity or source.

- [ ] **Step 2: Run and verify RED**

Run: `npm run build && node --test build/test/fund-service.test.js build/test/web-server.test.js`

Expected: FAIL because the adapter detail lacks research fields.

- [ ] **Step 3: Inject and merge the detail source**

Change `EastmoneyFundAdapter` to accept a detail source:

```ts
export class EastmoneyFundAdapter implements FundDataAdapter {
  constructor(private readonly detailSource = new EastmoneyFundDetailSource()) {}

  async getDetail(code: string): Promise<FundDetail | undefined> {
    const quote = (await this.listQuotes()).find((item) => item.code === code);
    if (!quote) return undefined;
    return { ...quote, industryAllocation: [], ...(await this.detailSource.getResearchDetail(code)) };
  }
}
```

For `PythonFundAdapter` sample mode return empty arrays with `availability: { holdings: "empty", performance: "empty" }`; do not create sample holdings or history.

Update MCP description to explicitly mention latest disclosed holdings and historical performance. Keep the tool name `fund_detail` and input `{ code }` unchanged.

- [ ] **Step 4: Verify GREEN**

Run: `npm run build && node --test build/test/fund-service.test.js build/test/web-server.test.js build/test/mcp-bridge.test.js`

Expected: all tests PASS and the sample MCP test asserts the new empty availability contract.

- [ ] **Step 5: Commit**

```bash
git add src/fund-service.ts src/index.ts src/web-server.ts test/fund-service.test.ts test/web-server.test.ts test/mcp-bridge.test.ts
git commit -m "feat: expose research data in fund detail"
```

---

### Task 4: Sites Runtime And GitHub Pages Detail Fetching

**Files:**
- Modify: `scripts/build-sites-worker.mjs`
- Modify: `web/api.ts`
- Modify: `test/sites-worker-contract.test.ts`
- Modify: `test/runtime-data-source.test.ts`

**Interfaces:**
- Consumes: the Task 3 `FundDetail` JSON contract.
- Produces: Sites `GET /api/funds/:code` with CORS and cached real research data; Pages detail requests to that endpoint.

- [ ] **Step 1: Write failing deployment contract tests**

```ts
test("Sites worker aggregates real holdings and NAV history for fund detail", async () => {
  const source = await workerSource();
  assert.match(source, /FundArchivesDatas\.aspx\?type=jjcc/);
  assert.match(source, /api\.fund\.eastmoney\.com\/f10\/lsjz/);
  assert.match(source, /fundDetailCache/);
  assert.match(source, /availability/);
});

test("GitHub Pages requests dynamic fund detail from Sites", async () => {
  const source = await readFile("web/api.ts", "utf8");
  assert.match(source, /VITE_DETAIL_API_BASE_URL/);
  assert.match(source, /fetchDynamicFundDetail/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run build && node --test build/test/sites-worker-contract.test.js build/test/runtime-data-source.test.js`

Expected: FAIL because worker detail still returns `industryAllocation: []` only.

- [ ] **Step 3: Add Sites detail aggregation**

In the generated worker source add:

Add `FUND_DETAIL_CACHE_TTL_MS = 600000`, a module-level `fundDetailCache`, and a `fundDetail(code)` function. The function must store the in-flight promise before awaiting it, fetch `lsjz` JSON and `jjcc` HTML through `Promise.allSettled`, apply the same published-number, parsing, availability, timeout, and 10-minute cache rules as `src/fund-detail-source.ts`, then merge those research fields into the matching quote returned by `fundQuotes()`.

Keep `cors(await api(url))` for every `/api/` route. Return 404 only when the fund code does not exist; partial upstream failures return 200 with `availability` states.

- [ ] **Step 4: Make Pages use dynamic detail only**

In `web/api.ts` add:

```ts
const DETAIL_API_BASE_URL = String(
  import.meta.env.VITE_DETAIL_API_BASE_URL ?? "https://fund-market-radar.gabbiyabbiy9.chatgpt.site"
).replace(/\/$/, "");

async function fetchDynamicFundDetail(code: string, signal?: AbortSignal) {
  return fetchJson<FundDetail>(`${DETAIL_API_BASE_URL}/api/funds/${code}`, signal, 15_000);
}
```

When `PREFER_STATIC_DATA` is true, use the static list only to confirm and display base identity, then request dynamic detail. If that request fails, return base quote plus empty arrays and both availability fields set to `unavailable`; never synthesize chart points or holdings.

- [ ] **Step 5: Verify GREEN and build the worker**

Run: `npm run build:sites && node --test build/test/sites-worker-contract.test.js build/test/runtime-data-source.test.js`

Expected: tests PASS and `dist/server/index.js` contains both upstream URLs and the detail cache.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-sites-worker.mjs web/api.ts test/sites-worker-contract.test.ts test/runtime-data-source.test.ts
git commit -m "feat: serve dynamic fund research detail"
```

---

### Task 5: Performance Chart And Holdings Components

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `web/components/FundPerformanceChart.tsx`
- Create: `web/components/FundHoldingsList.tsx`
- Modify: `web/components/FundDetailPanel.tsx`
- Modify: `web/styles.css`

**Interfaces:**
- Consumes: `FundDetail`, `buildPerformanceSeries`, `FundPerformancePeriod`.
- Produces: stable responsive detail drawer with independent performance and holdings states.

- [ ] **Step 1: Install Recharts and verify the baseline build**

Run:

```bash
npm install recharts
npm run build
```

Expected: dependency installs and existing build remains green before component changes.

- [ ] **Step 2: Create the performance component**

Implement this public interface:

```tsx
export function FundPerformanceChart({ detail }: { detail: FundDetail }) {
  const [period, setPeriod] = useState<FundPerformancePeriod>("month");
  const series = useMemo(
    () => buildPerformanceSeries(detail.performanceHistory, period),
    [detail.performanceHistory, period]
  );
  return <PerformanceChartContent detail={detail} period={period} onPeriodChange={setPeriod} series={series} />;
}
```

Keep `PerformanceChartContent` in the same file. It must render the Mantine `SegmentedControl`, availability/empty states, return summary, and Recharts `ResponsiveContainer`; this separation keeps period calculation testable without introducing a new public component.

Required visible labels:

```ts
const PERIOD_OPTIONS = [
  { value: "half_month", label: "近15天" },
  { value: "month", label: "近1月" },
  { value: "quarter", label: "近3月" },
  { value: "year", label: "近1年" },
  { value: "year_to_date", label: "今年以来" }
];
```

Chart requirements:

- `ResponsiveContainer` with stable `height={240}`.
- `AreaChart` with zero reference line, formatted Y axis and tooltip.
- Tooltip shows date, real NAV `value`, and `returnPercent`.
- Positive final return uses red; negative uses teal.
- `empty` shows “该区间历史数据不足”; `unavailable` shows “历史净值暂时不可用”.

- [ ] **Step 3: Create the holdings component**

```tsx
export function FundHoldingsList({ detail }: { detail: FundDetail }) {
  return <HoldingsContent items={detail.stockHoldings} reportDate={detail.holdingsReportDate} availability={detail.availability.holdings} />;
}
```

Keep `HoldingsContent` in the same file. Its header renders “前十大重仓股”、报告日期和“季度披露”标识；each row renders rank, stock name/code, absolute NAV ratio, proportional bar, and published shares/market value when present.

Normalize each bar relative to the largest `navRatio`, while printing the real absolute ratio. `empty` shows “该基金暂未披露股票持仓”; `unavailable` shows “股票持仓暂时不可用”.

- [ ] **Step 4: Rebuild the detail drawer**

Replace the compact `FundDetailPanel` body with:

```tsx
<Drawer size={560} position="right" className="detail-drawer">
  <FundSummary detail={detail} />
  <FundPerformanceChart detail={detail} />
  <FundHoldingsList detail={detail} />
  <Text size="xs" c="dimmed">持仓为季度披露数据，并非实时持仓；数据仅供研究比较。</Text>
</Drawer>
```

Keep one stable skeleton structure matching the same three sections. On screens below 700px set the drawer content width to `100vw`, remove excessive horizontal padding, and keep all primary fields visible without horizontal scrolling.

- [ ] **Step 5: Add focused responsive styles**

Add dedicated classes instead of global Mantine overrides:

```css
.detail-drawer .mantine-Drawer-content { max-width: 100vw; }
.fund-performance-chart { height: 240px; }
.fund-holding-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; }
.fund-holding-bar { height: 4px; border-radius: 999px; background: #e9eef3; }
@media (max-width: 700px) {
  .detail-drawer .mantine-Drawer-content { width: 100vw; }
  .fund-holding-secondary { display: none; }
}
```

- [ ] **Step 6: Verify the production build**

Run: `npm run build && git diff --check`

Expected: TypeScript and Vite build PASS with no whitespace errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json web/components/FundPerformanceChart.tsx web/components/FundHoldingsList.tsx web/components/FundDetailPanel.tsx web/styles.css
git commit -m "feat: show fund holdings and performance chart"
```

---

### Task 6: End-to-End Verification And Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/project-development-flow.md`

**Interfaces:**
- Consumes: the complete local, Sites and Pages behavior from Tasks 1-5.
- Produces: verified release candidate and Chinese chain documentation.

- [ ] **Step 1: Run the full automated suite**

Run:

```bash
npm test
npm run build:sites
git diff --check
```

Expected: all tests PASS, Vite build succeeds, and `dist/server/index.js` is created.

- [ ] **Step 2: Validate two real funds**

Start real mode:

```bash
npm run web
```

Verify with API requests:

```bash
curl -sS http://127.0.0.1:3000/api/funds/561780
curl -sS http://127.0.0.1:3000/api/funds/000001
```

Expected for each existing fund:

- `performanceHistory` contains real dated points;
- `availability.performance` is `available`;
- funds with disclosed stocks contain up to ten `stockHoldings` and a real report date;
- every holding ratio and history value is finite and non-zero only when published.

- [ ] **Step 3: Perform Playwright desktop and mobile QA**

At 1440x1000 and 390x844:

- open a field-traded ETF detail;
- switch all five performance periods;
- hover/tap a chart point and inspect date, NAV and return;
- confirm ten holdings are readable;
- close and immediately open another fund to verify abort and loading stability;
- confirm no drawer width jump, table shift, clipped labels or horizontal page scroll.

- [ ] **Step 4: Update Chinese documentation**

Document:

- `fund_detail` MCP request and expanded response;
- real upstream URLs and disclosure caveats;
- cumulative return formula and five period boundaries;
- Sites dynamic detail and GitHub Pages fallback chain;
- local test commands and expected empty/unavailable behavior.

- [ ] **Step 5: Commit documentation and final verification**

```bash
git add README.md docs/project-development-flow.md
git commit -m "docs: explain fund research detail chain"
npm test && npm run build:sites && git status --short
```

Expected: tests and build PASS; status is clean.

- [ ] **Step 6: Publish only after verification**

Push `feat/local-mcp-web-demo`, deploy the verified commit to Sites, wait for GitHub Pages Actions, and verify both public URLs return the expanded detail contract. Do not publish if either real-fund API check or mobile drawer QA fails.
