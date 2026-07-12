import { Button, Group, Select, SimpleGrid, Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import type { FundMatchBy, FundMarket, FundQuery, FundSort } from "../types";

const topics = ["AI", "科技", "半导体", "医疗", "新能源", "消费", "军工", "红利", "沪深300"];
export function FilterBar({ query, loading, onChange, onSearch }: { query: FundQuery; loading: boolean; onChange: (next: Partial<FundQuery>) => void; onSearch: () => void }) {
  const updateKeyword = (keyword: string) => onChange({ keyword, ...( /^\d{6}$/.test(keyword.trim()) ? { matchBy: "code" as FundMatchBy } : {}) });
  return <form onSubmit={(event) => { event.preventDefault(); onSearch(); }} className="filter-form">
    <div className="filter-fields">
    <Text size="xs" fw={700} c="dimmed" className="filter-section-label">搜索条件</Text>
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm" className="filter-grid">
      <TextInput label="关键词 / 自定义输入" placeholder="AI、科技、半导体、医疗或六位代码" value={query.keyword} onChange={(event) => updateKeyword(event.currentTarget.value)} />
      <Select label="快捷主题" placeholder="选择主题" clearable data={topics} value={topics.includes(query.keyword) ? query.keyword : null} onChange={(value) => value && onChange({ keyword: value })} />
      <Select label="匹配字段" data={[{ value: "all", label: "全部字段" }, { value: "code", label: "代码" }, { value: "name", label: "名称" }, { value: "type", label: "类型" }, { value: "index", label: "指数" }, { value: "industry", label: "行业" }]} value={query.matchBy} onChange={(value) => onChange({ matchBy: (value || "all") as FundMatchBy })} />
    </SimpleGrid>
    <Text size="xs" fw={700} c="dimmed" className="filter-section-label filter-section-label-secondary">交易条件</Text>
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm" mt="sm">
      <Select label="市场" data={[{ value: "all", label: "全部市场" }, { value: "on_exchange", label: "场内" }, { value: "off_exchange", label: "场外" }]} value={query.market} onChange={(value) => onChange({ market: (value || "all") as FundMarket })} />
      <Select label="排序" data={[{ value: "change_desc", label: "涨幅优先" }, { value: "change_asc", label: "回撤优先" }, { value: "name", label: "名称排序" }]} value={query.sort} onChange={(value) => onChange({ sort: (value || "change_desc") as FundSort })} />
      <Select label="数量" data={['20', '50', '100']} value={String(query.limit)} onChange={(value) => onChange({ limit: Number(value || 20) })} />
      <Group align="end" className="search-action"><Button type="submit" leftSection={<IconSearch size={16} />} loading={loading} fullWidth size="md">查询行情</Button></Group>
    </SimpleGrid>
    </div>
  </form>;
}
