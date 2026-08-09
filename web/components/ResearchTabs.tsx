import { Tabs } from "@mantine/core";
import type { ResearchTab } from "../types";

export function ResearchTabs({ value, onChange }: { value: ResearchTab; onChange: (value: ResearchTab) => void }) {
  return <Tabs value={value} onChange={(next) => next && onChange(next as ResearchTab)} variant="pills" radius="md" className="research-tabs">
    <Tabs.List>
      <Tabs.Tab value="all">全部</Tabs.Tab><Tabs.Tab value="top">今日涨幅</Tabs.Tab>
      <Tabs.Tab value="down">今日回撤</Tabs.Tab><Tabs.Tab value="on_exchange">场内</Tabs.Tab><Tabs.Tab value="off_exchange">场外</Tabs.Tab>
    </Tabs.List>
  </Tabs>;
}
