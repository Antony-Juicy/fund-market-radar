import { useMemo } from "react";
import { Autocomplete, Badge, Button, Group, Loader, Select, SimpleGrid, Text } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import type { FundMatchBy, FundMarket, FundQuery, FundSearchOption, FundSort } from "../types";

const topics = ["AI", "科技", "半导体", "医疗", "新能源", "消费", "军工", "红利", "沪深300"];
const matchFields = [{ value: "all", label: "全部字段" }, { value: "code", label: "代码" }, { value: "name", label: "名称" }, { value: "type", label: "类型" }, { value: "index", label: "指数" }, { value: "industry", label: "行业" }];
const markets = [{ value: "all", label: "全部市场" }, { value: "on_exchange", label: "场内" }, { value: "off_exchange", label: "场外" }];
const sorts = [{ value: "change_desc", label: "涨幅优先" }, { value: "change_asc", label: "回撤优先" }, { value: "name", label: "名称排序" }];
const limits = ["20", "50", "100"];
export function FilterBar({ query, loading, suggestions, suggestionsLoading, suggestionError, onChange, onKeywordChange, onFundSelect, onSearch }: {
  query: FundQuery;
  loading: boolean;
  suggestions: FundSearchOption[];
  suggestionsLoading: boolean;
  suggestionError?: string;
  onChange: (next: Partial<FundQuery>) => void;
  onKeywordChange: (keyword: string) => void;
  onFundSelect: (code: string) => void;
  onSearch: () => void;
}) {
  const suggestionCodes = useMemo(() => suggestions.map((item) => item.code), [suggestions]);

  return <form onSubmit={(event) => { event.preventDefault(); onSearch(); }} className="filter-form">
    <div className="filter-fields">
    <Text size="xs" fw={700} c="dimmed" className="filter-section-label">搜索条件</Text>
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm" className="filter-grid">
      <Autocomplete
        className="fund-search-input"
        label="搜索基金"
        placeholder="输入基金名称或代码，如：创业板ETF、159915"
        value={query.keyword}
        data={suggestionCodes}
        filter={({ options }) => options}
        limit={8}
        maxDropdownHeight={320}
        rightSection={suggestionsLoading ? <Loader size={16} /> : <IconSearch size={16} />}
        rightSectionPointerEvents="none"
        onChange={onKeywordChange}
        onOptionSubmit={onFundSelect}
        renderOption={({ option }) => {
          const item = suggestions.find((candidate) => candidate.code === option.value);
          if (!item) return option.value;
          return <div className="fund-search-option">
            <Text size="sm" fw={650} truncate>{item.name}</Text>
            <Group gap={6} wrap="nowrap">
              <Text size="xs" c="dimmed">{item.code}</Text>
              <Badge size="xs" variant="light" color={item.market === "on_exchange" ? "blue" : "orange"}>{item.market === "on_exchange" ? "场内" : "场外"}</Badge>
              <Text size="xs" c="dimmed" truncate>{item.fundType}</Text>
            </Group>
          </div>;
        }}
      />
      <Select label="快捷主题" placeholder="选择主题" clearable data={topics} value={topics.includes(query.keyword) ? query.keyword : null} onChange={(value) => onKeywordChange(value ?? "")} />
      <Select label="匹配字段" data={matchFields} value={query.matchBy} onChange={(value) => onChange({ matchBy: (value || "all") as FundMatchBy })} />
    </SimpleGrid>
    <Text size="xs" c={suggestionError ? "red" : "dimmed"} className="fund-search-hint">{suggestionError || "输入基金名称或六位代码，选择候选后立即查询"}</Text>
    <Text size="xs" fw={700} c="dimmed" className="filter-section-label filter-section-label-secondary">交易条件</Text>
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm" mt="sm">
      <Select label="市场" data={markets} value={query.market} onChange={(value) => onChange({ market: (value || "all") as FundMarket })} />
      <Select label="排序" data={sorts} value={query.sort} onChange={(value) => onChange({ sort: (value || "change_desc") as FundSort })} />
      <Select label="数量" data={limits} value={String(query.limit)} onChange={(value) => onChange({ limit: Number(value || 20) })} />
      <Group align="end" className="search-action"><Button type="submit" leftSection={<IconSearch size={16} />} loading={loading} fullWidth size="md">查询行情</Button></Group>
    </SimpleGrid>
    </div>
  </form>;
}
