import { Badge, Card, Divider, Group, Progress, Stack, Tabs, Text, ThemeIcon, Title, UnstyledButton } from "@mantine/core";
import { IconArrowDownRight, IconArrowUpRight, IconMinus, IconTrophy } from "@tabler/icons-react";
import type { FundPeriodKey, FundQuote } from "../types";
import React from 'react';

const periodOptions: Array<{ value: FundPeriodKey; label: string }> = [
  { value: "today", label: "最新日" }, { value: "yesterday", label: "上一日" }, { value: "week", label: "近 1 周" }, { value: "half_month", label: "近 15 天" }, { value: "month", label: "近 1 月" }
];

export function OverviewPanel({ items, period, onPeriodChange, onSelect }: { items: FundQuote[]; period: FundPeriodKey; onPeriodChange: (period: FundPeriodKey) => void; onSelect: (code: string) => void }) {
  const getChange = (item: FundQuote) => item.periodChanges?.[period] ?? (period === "today" ? item.changePercent : undefined);
  const on = items.filter((item) => item.market === "on_exchange").length;
  const up = items.filter((item) => (getChange(item) ?? 0) > 0).length;
  const down = items.filter((item) => (getChange(item) ?? 0) < 0).length;
  const flat = Math.max(items.length - up - down, 0);
  const changes = items.map(getChange).filter((value): value is number => value !== undefined);
  const average = changes.length ? changes.reduce((sum, value) => sum + value, 0) / changes.length : undefined;
  const leaders = [...items].sort((a, b) => (getChange(b) ?? -Infinity) - (getChange(a) ?? -Infinity)).slice(0, 7);
  const leader = leaders[0];
  const onRatio = items.length ? Math.round((on / items.length) * 100) : 0;
  const formatChange = (value?: number) => value === undefined ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  return <Card withBorder radius="lg" padding="lg" className="overview-panel">
    <Group justify="space-between" align="center" mb="md"><Title order={3}>行情概览</Title></Group>
    <Tabs value={period} onChange={(value) => value && onPeriodChange(value as FundPeriodKey)} variant="pills" radius="md" mb="md"><Tabs.List grow>{periodOptions.map((option) => <Tabs.Tab key={option.value} value={option.value}>{option.label}</Tabs.Tab>)}</Tabs.List></Tabs>
    <Card withBorder radius="md" padding="md" className="overview-lead">
      <Group justify="space-between" align="flex-end"><Stack gap={2}><Text size="xs" c="dimmed">返回基金</Text><Title order={1}>{items.length || "—"}</Title></Stack><Stack gap={2} align="flex-end"><Text size="xs" c="dimmed">平均涨跌幅</Text><Text fw={800} c={(average ?? 0) >= 0 ? "red" : "teal"}>{formatChange(average)}</Text></Stack></Group>
      <Group gap="xs" mt="md"><Text size="xs" c="dimmed">上涨 {up}</Text><Text size="xs" c="dimmed">·</Text><Text size="xs" c="dimmed">下跌 {down}</Text><Text size="xs" c="dimmed">·</Text><Text size="xs" c="dimmed">持平 {flat}</Text></Group>
    </Card>
    <Stack gap={6} mt="md"><Group justify="space-between"><Text size="xs" fw={600}>市场分布</Text><Text size="xs" c="dimmed">场内 {on} / 场外 {items.length - on}</Text></Group><Progress size="sm" radius="xl" value={onRatio} color="blue" sections={[{ value: onRatio, color: "blue" }, { value: 100 - onRatio, color: "orange" }]} /><Group justify="space-between"><Text size="xs" c="dimmed">场内 {onRatio}%</Text><Text size="xs" c="dimmed">场外 {100 - onRatio}%</Text></Group></Stack>
    <Divider my="md" />
    <Group gap="xs" mb="xs"><ThemeIcon size="sm" radius="xl" variant="light" color="yellow"><IconTrophy size={14} /></ThemeIcon><Text size="sm" fw={700}>涨幅领先 Top 7</Text></Group>
    <Stack gap={2}>{leaders.length ? leaders.map((item, index) => <UnstyledButton key={item.code} className="leader-button" onClick={() => onSelect(item.code)} aria-label={`定位 ${item.name} ${item.code}`}><Group justify="space-between" className="leader-row"><Group gap="xs" wrap="nowrap"><Text size="xs" c="dimmed" w={16}>{index + 1}</Text><Stack gap={0} miw={0}><Text size="sm" fw={600} lineClamp={1}>{item.name}</Text><Text size="xs" c="dimmed">{item.code}</Text></Stack></Group><Text size="sm" fw={700} c={(getChange(item) ?? 0) >= 0 ? "red" : "teal"}>{formatChange(getChange(item))}</Text></Group></UnstyledButton>) : <Text size="sm" c="dimmed">等待行情返回</Text>}</Stack>
    <Group gap="lg" mt="md"><Group gap={5}><IconArrowUpRight size={15} color="#e03131" /><Text size="xs" c="dimmed">上涨 {up}</Text></Group><Group gap={5}><IconArrowDownRight size={15} color="#0f766e" /><Text size="xs" c="dimmed">下跌 {down}</Text></Group><Group gap={5}><IconMinus size={15} color="#868e96" /><Text size="xs" c="dimmed">持平 {flat}</Text></Group></Group>
    <Text size="xs" c="dimmed" className="notice" mt="md">数据用于研究和比较，不构成投资建议。最近数据日：{leader?.dataDate || "—"}{period !== "today" && changes.length === 0 ? "；当前数据源未返回该区间收益" : ""}</Text>
  </Card>;
}
