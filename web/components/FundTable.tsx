import { Badge, Skeleton, Table, Text } from "@mantine/core";
import type { FundQuote } from "../types";

const formatValue = (item: FundQuote) => (item.price ?? item.nav ?? "—");
const ColumnGroup = () => <colgroup><col className="fund-col-name" /><col className="fund-col-market" /><col className="fund-col-value" /><col className="fund-col-change" /><col className="fund-col-date" /><col className="fund-col-detail" /></colgroup>;

function LoadingRows() {
  return <>{Array.from({ length: 6 }).map((_, index) => <Table.Tr key={index} className="skeleton-fund-row">
    <Table.Td><Skeleton height={14} width="62%" /><Skeleton height={10} width="34%" mt={8} /></Table.Td>
    <Table.Td><Skeleton height={22} width={46} radius="xl" /></Table.Td>
    <Table.Td><Skeleton height={14} width={58} /></Table.Td>
    <Table.Td><Skeleton height={14} width={52} /></Table.Td>
    <Table.Td><Skeleton height={12} width={76} /></Table.Td>
    <Table.Td><Skeleton height={12} width={38} /></Table.Td>
  </Table.Tr>)}</>;
}

export function FundTable({ items, loading, onSelect, highlightCode }: { items: FundQuote[]; loading: boolean; onSelect: (code: string) => void; highlightCode?: string }) {
  if (!loading && !items.length) return <Text c="dimmed" ta="center" py="xl">没有匹配的基金，请调整筛选条件。</Text>;
  return <Table.ScrollContainer minWidth={680}><Table verticalSpacing="md" highlightOnHover withTableBorder withColumnBorders={false} className="fund-table" aria-busy={loading}>
    <ColumnGroup />
    <Table.Thead><Table.Tr><Table.Th>基金名称</Table.Th><Table.Th>市场</Table.Th><Table.Th>净值 / 价格</Table.Th><Table.Th>涨跌幅</Table.Th><Table.Th>更新时间</Table.Th><Table.Th>详情</Table.Th></Table.Tr></Table.Thead>
    <Table.Tbody>{loading ? <LoadingRows /> : items.map((item) => <Table.Tr id={`fund-row-${item.code}`} key={item.code} onClick={() => onSelect(item.code)} className={`fund-row${highlightCode === item.code ? " fund-row-highlight" : ""}`} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(item.code); }}>
      <Table.Td><Text fw={700} size="sm">{item.name}{highlightCode === item.code && <Badge size="xs" variant="light" color="blue" ml="xs">已定位</Badge>}</Text><Text size="xs" c="dimmed">{item.code} · {item.fundType}</Text></Table.Td>
      <Table.Td><Badge color={item.market === "on_exchange" ? "blue" : "orange"} variant="light">{item.market === "on_exchange" ? "场内" : "场外"}</Badge></Table.Td>
      <Table.Td>{typeof formatValue(item) === "number" ? Number(formatValue(item)).toFixed(4) : "—"}</Table.Td>
      <Table.Td><Text c={(item.changePercent ?? 0) >= 0 ? "red" : "teal"} fw={700}>{item.changePercent === undefined ? "—" : `${item.changePercent >= 0 ? "+" : ""}${item.changePercent.toFixed(2)}%`}</Text></Table.Td>
      <Table.Td><Text size="xs" c="dimmed">{item.dataDate}</Text></Table.Td><Table.Td><Text size="xs" c="blue">查看 →</Text></Table.Td>
    </Table.Tr>)}</Table.Tbody>
  </Table></Table.ScrollContainer>;
}
