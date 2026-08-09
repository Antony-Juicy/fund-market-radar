import { lazy, Suspense } from "react";
import { Badge, Drawer, Group, Skeleton, Stack, Text, Title } from "@mantine/core";
import type { FundDetail } from "../types";
import { FundHoldingsList } from "./FundHoldingsList";

const FundPerformanceChart = lazy(() =>
  import("./FundPerformanceChart").then((module) => ({ default: module.FundPerformanceChart }))
);

const formatChange = (value: number | undefined) => value === undefined ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

function FundSummary({ detail }: { detail: FundDetail }) {
  const latestValue = detail.market === "on_exchange" ? detail.price ?? detail.nav : detail.nav ?? detail.price;
  const changeColor = detail.changePercent === undefined || detail.changePercent === 0 ? "#64748b" : detail.changePercent > 0 ? "#d9485f" : "#0f9f8f";
  return <section className="detail-section fund-detail-summary" aria-labelledby="fund-detail-name">
    <Stack gap="sm">
      <div>
        <Group gap="xs" mb={4} wrap="wrap"><Badge variant="light" color="blue" radius="sm">{detail.market === "on_exchange" ? "场内" : "场外"}</Badge><Text size="xs" c="dimmed">{detail.code}</Text><Text size="xs" c="dimmed">{detail.fundType}</Text></Group>
        <Title order={3} id="fund-detail-name" className="fund-detail-name">{detail.name}</Title>
      </div>
      <div className="fund-summary-metrics">
        <Stack gap={1}><Text size="xs" c="dimmed">{detail.market === "on_exchange" ? "最新价格" : "最新净值"}</Text><Text fw={750} className="fund-summary-value">{latestValue === undefined ? "—" : latestValue.toFixed(4)}</Text></Stack>
        <Stack gap={1}><Text size="xs" c="dimmed">最新涨跌</Text><Text fw={750} c={changeColor} className="fund-summary-value">{formatChange(detail.changePercent)}</Text></Stack>
        <Stack gap={1}><Text size="xs" c="dimmed">数据日期</Text><Text fw={650} className="fund-summary-date">{detail.dataDate || "—"}</Text></Stack>
      </div>
    </Stack>
  </section>;
}

function DetailSkeleton() {
  return <div className="fund-detail-content" aria-label="基金详情加载中">
    <section className="detail-section fund-detail-summary"><Skeleton height={14} width={126} mb="xs" /><Skeleton height={26} width="72%" /><div className="fund-summary-metrics"><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div></section>
    <section className="detail-section fund-performance-section"><Group justify="space-between"><Skeleton height={22} width={90} /><Skeleton height={34} width={72} /></Group><Skeleton height={30} mt="md" /><Skeleton height={240} mt="md" /></section>
    <section className="detail-section fund-holdings-section"><Group justify="space-between"><Skeleton height={22} width={130} /><Skeleton height={22} width={72} /></Group><Stack gap="sm" mt="md">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} height={46} />)}</Stack></section>
  </div>;
}

function PerformanceChartFallback() {
  return <section className="detail-section fund-performance-section" aria-label="业绩曲线加载中">
    <Group justify="space-between"><Skeleton height={22} width={90} /><Skeleton height={34} width={72} /></Group>
    <Skeleton height={30} mt="md" />
    <Skeleton height={240} mt="sm" />
  </section>;
}

export function FundDetailPanel({ opened, detail, loading, onClose, onExitTransitionEnd }: { opened: boolean; detail?: FundDetail; loading: boolean; onClose: () => void; onExitTransitionEnd: () => void }) {
  return <Drawer opened={opened} onClose={onClose} onExitTransitionEnd={onExitTransitionEnd} title="基金详情" position="right" size={560} lockScroll={false} className="detail-drawer">
    {loading ? <DetailSkeleton /> : detail ? <div className="fund-detail-content">
      <FundSummary detail={detail} />
      <Suspense fallback={<PerformanceChartFallback />}><FundPerformanceChart detail={detail} /></Suspense>
      <FundHoldingsList detail={detail} />
      <Stack gap={3} className="fund-detail-footnote"><Text size="xs" c="dimmed">持仓为季度披露数据，并非实时持仓；数据仅供研究比较。</Text><Text size="xs" c="dimmed">数据来源：{detail.source}{detail.performanceSource ? ` / ${detail.performanceSource}` : ""}</Text></Stack>
    </div> : null}
  </Drawer>;
}
