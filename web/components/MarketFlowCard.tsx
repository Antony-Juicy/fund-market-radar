import {
  Badge,
  Button,
  Card,
  Group,
  Progress,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconChartDonut,
  IconRefresh,
} from "@tabler/icons-react";
import type { MarketOverview } from "../types";

const money = (value: number, sign = false) =>
  `${sign && value >= 0 ? "+" : ""}${(value / 100_000_000).toFixed(1)} 亿`;
const percent = (value: number) => `${value.toFixed(1)}%`;

export function MarketFlowCard({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: MarketOverview;
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  const isInflow = (data?.netFlow ?? 0) >= 0;
  return (
    <Card withBorder radius="lg" padding={0} className="market-flow-card">
      <div className="market-flow-head">
        <Group justify="space-between" align="center" wrap="nowrap" className="market-flow-head-row">
          <Group gap="sm" wrap="nowrap" className="market-flow-summary">
            <ThemeIcon
              size={36}
              radius="md"
              color={isInflow ? "red" : "teal"}
              variant="light"
            >
              {isInflow ? (
                <IconArrowUpRight size={20} />
              ) : (
                <IconArrowDownRight size={20} />
              )}
            </ThemeIcon>
            <Stack gap={2} className="market-flow-summary-copy">
              <Group gap="xs" className="market-flow-title-row">
                <Text fw={700} className="market-flow-title">市场资金观察</Text>
                {data && (
                  <Badge color={isInflow ? "red" : "teal"} variant="light">
                    {isInflow ? "偏流入" : "偏流出"}
                  </Badge>
                )}
                <Badge color="gray" variant="light">
                  真实数据
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" className="market-flow-source">
                {error ||
                  (loading
                    ? "正在读取实时指数与行业资金流向..."
                    : data
                      ? `${data.source} · 最近交易日 ${data.dataDate}`
                      : "等待实时数据")}
              </Text>
            </Stack>
          </Group>
          <Group gap={0} wrap="nowrap" className="market-flow-metrics">
            {loading ? (
              [1, 2, 3, 4].map((item) => (
                <Skeleton key={item} width={82} height={28} />
              ))
            ) : data ? (
              <>
                <Stack gap={1} className="market-flow-metric">
                  <Text size="xs" c="dimmed">
                    流入板块合计
                  </Text>
                  <Text fw={800} c="red">
                    +{money(data.inflowTotal)}
                  </Text>
                </Stack>
                <Stack gap={1} className="market-flow-metric">
                  <Text size="xs" c="dimmed">
                    流出板块合计
                  </Text>
                  <Text fw={800} c="teal">
                    -{money(data.outflowTotal)}
                  </Text>
                </Stack>
                <Stack gap={1} className="market-flow-metric market-flow-metric-net">
                  <Text size="xs" c="dimmed">
                    净流向
                  </Text>
                  <Text fw={800} c={data.netFlow >= 0 ? "red" : "teal"}>
                    {money(data.netFlow, true)}
                  </Text>
                </Stack>
                <Stack gap={4} className="market-flow-metric market-flow-metric-ratio">
                  <Text size="xs" c="dimmed">
                    行业净流向占比
                  </Text>
                  <Progress
                    value={100}
                    size="sm"
                    w={150}
                    aria-label="净流入与净流出板块金额占比"
                    className="market-flow-ratio-track"
                  >
                    <Progress.Section value={data.inflowRatio} color="red" />
                    <Progress.Section value={data.outflowRatio} color="teal" />
                  </Progress>
                  <Group justify="space-between">
                    <Text size="xs" c="red">
                      流入 {percent(data.inflowRatio)}
                    </Text>
                    <Text size="xs" c="teal">
                      流出 {percent(data.outflowRatio)}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" className="market-flow-ratio-note">
                    按行业净流向绝对值计算
                  </Text>
                </Stack>
              </>
            ) : (
              <Button
                variant="light"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={onRetry}
              >
                重试实时数据
              </Button>
            )}
          </Group>
        </Group>
      </div>
      <div className="index-band">
        <Text size="xs" fw={700} c="dimmed" className="index-band-label">
          主要指数 · 最近收盘
        </Text>
        <Group gap={0} wrap="nowrap" className="index-strip">
          {loading
            ? [1, 2, 3].map((item) => (
                <Stack key={item} gap={5} className="index-item">
                  <Skeleton width={58} height={10} />
                  <Skeleton width={104} height={18} />
                </Stack>
              ))
            : data?.indices.map((item) => (
                <Stack key={item.code} gap={1} className="index-item">
                  <Text size="xs" c="dimmed">
                    {item.name}
                  </Text>
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" fw={700}>
                      {item.value.toLocaleString("zh-CN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                    <Text
                      size="xs"
                      fw={700}
                      c={item.changePercent >= 0 ? "red" : "teal"}
                    >
                      {item.changePercent >= 0 ? "+" : ""}
                      {item.changePercent.toFixed(2)}%
                    </Text>
                  </Group>
                </Stack>
              ))}
        </Group>
      </div>
      <div className="market-flow-body">
        <Group gap="xs" mb="sm" className="market-flow-section-head">
          <Text size="xs" fw={700}>
            板块资金分布
          </Text>
          <IconChartDonut size={14} />
          <Text size="xs" c="dimmed">
            行业主力净流入金额，正负板块分别汇总
          </Text>
        </Group>
        {loading ? (
          <div className="sector-flow-grid">
            <Skeleton height={62} />
            <Skeleton height={62} />
          </div>
        ) : data ? (
          <div className="sector-flow-grid">
            <Stack gap={8} className="sector-flow-panel sector-flow-panel-out">
              <Group justify="space-between" wrap="nowrap"><Text size="xs" fw={700} c="teal">流出板块</Text><Text size="xs" c="dimmed">净流出 Top 5</Text></Group>
              <Group gap={6}>
                {data.outflowSectors.map((sector) => (
                  <Badge
                    key={sector.name}
                    size="sm"
                    variant="light"
                    color="teal"
                  >
                    {sector.name} {money(sector.amount)}
                  </Badge>
                ))}
              </Group>
            </Stack>
            <Stack gap={8} className="sector-flow-panel sector-flow-panel-in">
              <Group justify="space-between" wrap="nowrap"><Text size="xs" fw={700} c="red">流入板块</Text><Text size="xs" c="dimmed">净流入 Top 5</Text></Group>
              <Group gap={6}>
                {data.inflowSectors.map((sector) => (
                  <Badge
                    key={sector.name}
                    size="sm"
                    variant="light"
                    color="red"
                  >
                    {sector.name} +{money(sector.amount)}
                  </Badge>
                ))}
              </Group>
            </Stack>
          </div>
        ) : (
          <Text size="sm" c="red">
            {error || "实时板块资金数据暂时不可用。"}
          </Text>
        )}
      </div>
    </Card>
  );
}
