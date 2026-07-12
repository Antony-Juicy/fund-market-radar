import { Drawer, Skeleton, Stack, Text, Title } from "@mantine/core";
import type { FundDetail } from "../types";

export function FundDetailPanel({ detail, loading, onClose }: { detail?: FundDetail; loading: boolean; onClose: () => void }) {
  return <Drawer opened={Boolean(detail) || loading} onClose={onClose} title="基金详情" position="right" size="sm" lockScroll={false} className="detail-drawer">
    <Stack gap="sm" mih={240}>{loading ? <><Skeleton height={24} width="72%" /><Skeleton height={14} width="42%" /><Skeleton height={16} width="58%" mt="md" /><Skeleton height={16} width="48%" /><Skeleton height={16} width="64%" /><Text size="sm" c="dimmed" mt="md">正在通过 MCP 读取详情...</Text></> : detail ? <><Title order={3}>{detail.name}</Title><Text c="dimmed">基金代码：{detail.code}</Text><Text>市场：{detail.market === "on_exchange" ? "场内" : "场外"}</Text><Text>涨跌幅：{detail.changePercent === undefined ? "—" : `${detail.changePercent.toFixed(2)}%`}</Text><Text>数据来源：{detail.source}</Text></> : null}</Stack>
  </Drawer>;
}
