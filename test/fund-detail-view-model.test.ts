import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHoldingsViewModel,
  buildPerformanceViewModel,
  formatPerformanceAnnouncement,
  PERFORMANCE_PERIOD_OPTIONS
} from "../web/components/fundDetailViewModel.js";

test("exposes the five performance period labels in product order", () => {
  assert.deepEqual(PERFORMANCE_PERIOD_OPTIONS, [
    { value: "half_month", label: "近15天" },
    { value: "month", label: "近1月" },
    { value: "quarter", label: "近3月" },
    { value: "year", label: "近1年" },
    { value: "year_to_date", label: "今年以来" }
  ]);
});

test("builds an available positive performance view from real NAV points", () => {
  const view = buildPerformanceViewModel(
    [
      { date: "2026-06-15", value: 1.2 },
      { date: "2026-07-15", value: 1.26 }
    ],
    "month",
    "available"
  );

  assert.equal(view.state, "available");
  assert.equal(view.totalReturn, 5);
  assert.equal(view.color, "#d9485f");
  assert.deepEqual(view.points.at(-1), {
    date: "2026-07-15",
    value: 1.26,
    returnPercent: 5
  });
});

test("uses teal for negative returns and separates empty from unavailable history", () => {
  const negative = buildPerformanceViewModel(
    [
      { date: "2026-06-15", value: 1.2 },
      { date: "2026-07-15", value: 1.14 }
    ],
    "month",
    "available"
  );
  const empty = buildPerformanceViewModel(
    [{ date: "2026-07-15", value: 1.14 }],
    "month",
    "empty"
  );
  const unavailable = buildPerformanceViewModel([], "month", "unavailable");

  assert.equal(negative.color, "#0f9f8f");
  assert.deepEqual(
    { state: empty.state, message: empty.message },
    { state: "empty", message: "该区间历史数据不足" }
  );
  assert.deepEqual(
    { state: unavailable.state, message: unavailable.message },
    { state: "unavailable", message: "历史净值暂时不可用" }
  );
});

test("keeps absolute holding ratios while normalizing bars to the largest holding", () => {
  const view = buildHoldingsViewModel(
    [
      { rank: 1, stockCode: "600519", stockName: "贵州茅台", navRatio: 8.4, sharesWan: 12.3, marketValueWan: 12345.6, reportDate: "2026-03-31" },
      { rank: 2, stockCode: "000858", stockName: "五粮液", navRatio: 4.2, reportDate: "2026-03-31" }
    ],
    "2026-03-31",
    "available"
  );

  assert.equal(view.state, "available");
  assert.equal(view.reportDate, "2026-03-31");
  assert.deepEqual(
    view.rows.map(({ navRatio, barPercent }) => ({ navRatio, barPercent })),
    [
      { navRatio: 8.4, barPercent: 100 },
      { navRatio: 4.2, barPercent: 50 }
    ]
  );
});

test("separates undisclosed holdings from unavailable holdings", () => {
  const empty = buildHoldingsViewModel([], undefined, "empty");
  const unavailable = buildHoldingsViewModel([], undefined, "unavailable");

  assert.deepEqual(
    { state: empty.state, message: empty.message },
    { state: "empty", message: "该基金暂未披露股票持仓" }
  );
  assert.deepEqual(
    { state: unavailable.state, message: unavailable.message },
    { state: "unavailable", message: "股票持仓暂时不可用" }
  );
});

test("formats the active chart point for screen-reader announcement", () => {
  assert.equal(
    formatPerformanceAnnouncement({ date: "2026-07-15", value: 1.26, returnPercent: 5 }),
    "2026-07-15，真实净值 1.2600，累计收益 +5.00%"
  );
});
