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
