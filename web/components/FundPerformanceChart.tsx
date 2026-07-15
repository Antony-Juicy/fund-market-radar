import { useEffect, useMemo, useState } from "react";
import { Center, Group, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { FundDetail, FundPerformancePeriod, FundPerformanceSeriesPoint } from "../types";
import { buildPerformanceViewModel, formatPerformanceAnnouncement, PERFORMANCE_PERIOD_OPTIONS, type PerformanceViewModel } from "./fundDetailViewModel";

const formatReturn = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
const formatAxisDate = (date: string) => date.slice(5).replace("-", "/");

function PerformanceTooltip({ active, payload, onAnnouncement }: { active?: boolean; payload?: Array<{ payload: FundPerformanceSeriesPoint }>; onAnnouncement: (value: string) => void }) {
  const point = payload?.[0]?.payload;
  useEffect(() => {
    onAnnouncement(active && point ? formatPerformanceAnnouncement(point) : "");
  }, [active, point?.date, point?.value, point?.returnPercent, onAnnouncement]);
  if (!active || !point) return null;
  return <div className="fund-chart-tooltip">
    <Text size="xs" fw={700}>{point.date}</Text>
    <Group justify="space-between" gap="xl"><Text size="xs" c="dimmed">真实净值</Text><Text size="xs" fw={600}>{point.value.toFixed(4)}</Text></Group>
    <Group justify="space-between" gap="xl"><Text size="xs" c="dimmed">累计收益</Text><Text size="xs" fw={700}>{formatReturn(point.returnPercent)}</Text></Group>
  </div>;
}

function PerformanceChartContent({
  period,
  onPeriodChange,
  view
}: {
  period: FundPerformancePeriod;
  onPeriodChange: (period: FundPerformancePeriod) => void;
  view: PerformanceViewModel;
}) {
  const [announcement, setAnnouncement] = useState("");
  const periodLabel = PERFORMANCE_PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "当前区间";
  const chartTitle = `${periodLabel}基金累计收益曲线`;
  const chartDescription = `基于基金真实净值计算，共 ${view.points.length} 个数据点，区间累计收益 ${view.totalReturn === undefined ? "不可用" : formatReturn(view.totalReturn)}。可使用方向键浏览数据点。`;

  useEffect(() => setAnnouncement(""), [period]);

  return <section className="detail-section fund-performance-section" aria-labelledby="fund-performance-title">
    <Group justify="space-between" align="flex-end" mb="sm" wrap="nowrap">
      <Stack gap={1}>
        <Title order={4} id="fund-performance-title">业绩走势</Title>
        <Text size="xs" c="dimmed">基金历史净值累计收益</Text>
      </Stack>
      <Stack gap={0} align="flex-end" className="fund-return-summary">
        <Text size="xs" c="dimmed">区间收益</Text>
        <Text fw={750} c={view.color} className="fund-return-value">
          {view.totalReturn === undefined ? "—" : formatReturn(view.totalReturn)}
        </Text>
      </Stack>
    </Group>
    <SegmentedControl
      fullWidth
      size="xs"
      radius="sm"
      value={period}
      data={PERFORMANCE_PERIOD_OPTIONS}
      onChange={(value) => onPeriodChange(value as FundPerformancePeriod)}
      className="fund-period-control"
      aria-label="业绩区间"
    />
    <div className="fund-performance-chart">
      {view.state !== "available" ? <Center h="100%"><Stack gap={5} align="center"><Text size="sm" c="dimmed">{view.message}</Text><Text size="xs" c="dimmed">切换其他区间或稍后再试</Text></Stack></Center> :
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={view.points} margin={{ top: 18, right: 8, bottom: 0, left: -14 }} accessibilityLayer title={chartTitle} desc={chartDescription}>
            <CartesianGrid vertical={false} stroke="#edf1f5" />
            <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fontSize: 11, fill: "#748094" }} axisLine={false} tickLine={false} minTickGap={32} />
            <YAxis tickFormatter={(value: number) => `${value.toFixed(1)}%`} tick={{ fontSize: 11, fill: "#748094" }} axisLine={false} tickLine={false} width={52} domain={["auto", "auto"]} />
            <ReferenceLine y={0} stroke="#aeb8c5" strokeDasharray="3 3" />
            <Tooltip content={<PerformanceTooltip onAnnouncement={setAnnouncement} />} cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} />
            <Area type="monotone" dataKey="returnPercent" stroke={view.color} strokeWidth={2} fill={view.color} fillOpacity={0.1} dot={false} activeDot={{ r: 4, fill: view.color, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>}
    </div>
    <div className="fund-chart-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
  </section>;
}

export function FundPerformanceChart({ detail }: { detail: FundDetail }) {
  const [period, setPeriod] = useState<FundPerformancePeriod>("month");
  const view = useMemo(
    () => buildPerformanceViewModel(detail.performanceHistory, period, detail.availability.performance),
    [detail.performanceHistory, detail.availability.performance, period]
  );
  return <PerformanceChartContent period={period} onPeriodChange={setPeriod} view={view} />;
}
