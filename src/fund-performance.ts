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
