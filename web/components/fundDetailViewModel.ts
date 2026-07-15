import { buildPerformanceSeries } from "../../src/fund-performance.js";
import type {
  FundDetailAvailability,
  FundPerformancePeriod,
  FundPerformancePoint,
  FundPerformanceSeriesPoint,
  FundStockHolding
} from "../../src/fund-types.js";

export const PERFORMANCE_PERIOD_OPTIONS: Array<{ value: FundPerformancePeriod; label: string }> = [
  { value: "half_month", label: "近15天" },
  { value: "month", label: "近1月" },
  { value: "quarter", label: "近3月" },
  { value: "year", label: "近1年" },
  { value: "year_to_date", label: "今年以来" }
];

type Availability = FundDetailAvailability["performance"];

export interface PerformanceViewModel {
  state: "available" | "empty" | "unavailable";
  points: FundPerformanceSeriesPoint[];
  totalReturn?: number;
  color: string;
  message?: string;
}

export function formatPerformanceAnnouncement(point: FundPerformanceSeriesPoint): string {
  const totalReturn = `${point.returnPercent > 0 ? "+" : ""}${point.returnPercent.toFixed(2)}%`;
  return `${point.date}，真实净值 ${point.value.toFixed(4)}，累计收益 ${totalReturn}`;
}

export function buildPerformanceViewModel(
  history: FundPerformancePoint[],
  period: FundPerformancePeriod,
  availability: Availability
): PerformanceViewModel {
  if (availability === "unavailable") {
    return { state: "unavailable", points: [], color: "#64748b", message: "历史净值暂时不可用" };
  }

  const series = buildPerformanceSeries(history, period);
  if (availability === "empty" || series.points.length < 2 || series.totalReturn === undefined) {
    return { state: "empty", points: [], color: "#64748b", message: "该区间历史数据不足" };
  }

  const color = series.totalReturn > 0 ? "#d9485f" : series.totalReturn < 0 ? "#0f9f8f" : "#64748b";
  return { state: "available", ...series, color };
}

export interface HoldingRowViewModel extends FundStockHolding {
  barPercent: number;
}

export interface HoldingsViewModel {
  state: "available" | "empty" | "unavailable";
  reportDate?: string;
  rows: HoldingRowViewModel[];
  message?: string;
}

export function buildHoldingsViewModel(
  items: FundStockHolding[],
  reportDate: string | undefined,
  availability: FundDetailAvailability["holdings"]
): HoldingsViewModel {
  if (availability === "unavailable") {
    return { state: "unavailable", reportDate, rows: [], message: "股票持仓暂时不可用" };
  }

  const holdings = [...items].sort((left, right) => left.rank - right.rank).slice(0, 10);
  if (availability === "empty" || holdings.length === 0) {
    return { state: "empty", reportDate, rows: [], message: "该基金暂未披露股票持仓" };
  }

  const maxRatio = Math.max(...holdings.map((item) => item.navRatio), 0);
  const rows = holdings.map((item) => ({
    ...item,
    barPercent: maxRatio > 0 ? Math.max(0, Math.min(100, (item.navRatio / maxRatio) * 100)) : 0
  }));
  return { state: "available", reportDate, rows };
}
