import { Badge, Group, Stack, Text, Title } from "@mantine/core";
import type { FundDetail } from "../types";
import { buildHoldingsViewModel, type HoldingsViewModel } from "./fundDetailViewModel";

const numberFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

function HoldingsContent({ view }: { view: HoldingsViewModel }) {
  return <section className="detail-section fund-holdings-section" aria-labelledby="fund-holdings-title">
    <Group justify="space-between" align="flex-start" mb="sm" wrap="nowrap">
      <Stack gap={1}>
        <Title order={4} id="fund-holdings-title">前十大重仓股</Title>
        <Text size="xs" c="dimmed">{view.reportDate ? `报告日期 ${view.reportDate}` : "报告日期暂未披露"}</Text>
      </Stack>
      <Badge variant="light" color="blue" radius="sm">季度披露</Badge>
    </Group>
    {view.state !== "available" ? <div className="fund-holdings-state"><Text size="sm" c="dimmed" ta="center">{view.message}</Text></div> :
      <div className="fund-holdings-list">
        {view.rows.map((item) => <div className="fund-holding-row" key={`${item.stockCode}-${item.rank}`}>
          <Text size="xs" c="dimmed" fw={700} className="fund-holding-rank">{String(item.rank).padStart(2, "0")}</Text>
          <div className="fund-holding-main">
            <Group justify="space-between" gap="sm" wrap="nowrap">
              <Stack gap={0} className="fund-holding-identity">
                <Text size="sm" fw={650} truncate>{item.stockName}</Text>
                <Text size="xs" c="dimmed">{item.stockCode}</Text>
              </Stack>
              {(item.sharesWan !== undefined || item.marketValueWan !== undefined) && <Group gap="md" wrap="nowrap" className="fund-holding-secondary">
                {item.sharesWan !== undefined && <Text size="xs" c="dimmed">持股 {numberFormatter.format(item.sharesWan)} 万股</Text>}
                {item.marketValueWan !== undefined && <Text size="xs" c="dimmed">市值 {numberFormatter.format(item.marketValueWan)} 万元</Text>}
              </Group>}
            </Group>
            <div className="fund-holding-bar" aria-hidden="true"><span style={{ width: `${item.barPercent}%` }} /></div>
          </div>
          <Text size="sm" fw={700} className="fund-holding-ratio">{item.navRatio.toFixed(2)}%</Text>
        </div>)}
      </div>}
  </section>;
}

export function FundHoldingsList({ detail }: { detail: FundDetail }) {
  const view = buildHoldingsViewModel(detail.stockHoldings, detail.holdingsReportDate, detail.availability.holdings);
  return <HoldingsContent view={view} />;
}
