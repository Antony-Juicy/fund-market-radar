import { useEffect, useRef, useState } from "react";
import { AppShell, Badge, Button, Card, Container, Group, Modal, Stack, Text, Title, Tooltip } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconActivity, IconAdjustmentsHorizontal, IconChartCandle, IconRefresh, IconRoute, IconX } from "@tabler/icons-react";
import { fetchFundDetail, fetchFundSnapshot, fetchFundSuggestions, fetchMarketOverview } from "./api";
import { canSearchFunds, createSelectedFundQuery, withFundKeyword, withResearchTab } from "../src/fund-search";
import { abortableDelay, isActiveRequest } from "../src/request-control";
import { FilterBar } from "./components/FilterBar";
import { FundDetailPanel } from "./components/FundDetailPanel";
import { FundTable } from "./components/FundTable";
import { McpChainDrawer } from "./components/McpChainDrawer";
import { MarketFlowCard } from "./components/MarketFlowCard";
import { OverviewPanel } from "./components/OverviewPanel";
import { ResearchTabs } from "./components/ResearchTabs";
import type { FundDetail, FundPeriodKey, FundQuery, FundSearchOption, FundSnapshot, MarketOverview, ResearchTab } from "./types";

const initialQuery: FundQuery = { keyword: "", matchBy: "all", market: "all", sort: "name", limit: 20 };
const EMPTY_FUNDS: FundSnapshot["items"] = [];

export function App() {
  const [query, setQuery] = useState<FundQuery>(initialQuery);
  const [tab, setTab] = useState<ResearchTab>("all");
  const [snapshot, setSnapshot] = useState<FundSnapshot>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [stage, setStage] = useState(1);
  const [chainOpen, setChainOpen] = useState(false);
  const [detail, setDetail] = useState<FundDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [period, setPeriod] = useState<FundPeriodKey>("today");
  const [highlightCode, setHighlightCode] = useState<string>();
  const [marketOverview, setMarketOverview] = useState<MarketOverview>();
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string>();
  const [suggestions, setSuggestions] = useState<FundSearchOption[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string>();
  const [debouncedKeyword] = useDebouncedValue(query.keyword, 250);
  const controllerRef = useRef<AbortController>();
  const suggestionControllerRef = useRef<AbortController>();
  const detailControllerRef = useRef<AbortController>();

  const runQuery = async (nextQuery = query) => {
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    setLoading(true); setError(undefined); setStage(1);
    try {
      await abortableDelay(160, controller.signal); setStage(2);
      await abortableDelay(160, controller.signal); setStage(3);
      const result = await fetchFundSnapshot(nextQuery, controller.signal);
      if (!isActiveRequest(controller, controllerRef.current)) return;
      await abortableDelay(180, controller.signal);
      if (!isActiveRequest(controller, controllerRef.current)) return;
      setSnapshot(result); setStage(4);
    } catch (caught) {
      if ((caught as Error).name !== "AbortError" && isActiveRequest(controller, controllerRef.current)) { setError(caught instanceof Error ? caught.message : "行情查询失败"); setSnapshot(undefined); }
    } finally { if (controllerRef.current === controller) setLoading(false); }
  };

  useEffect(() => {
    void runQuery(initialQuery);
    return () => {
      controllerRef.current?.abort();
      suggestionControllerRef.current?.abort();
      detailControllerRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    suggestionControllerRef.current?.abort();
    if (!canSearchFunds(debouncedKeyword) || query.matchBy === "code") {
      setSuggestions([]);
      setSuggestionError(undefined);
      setSuggestionsLoading(false);
      return;
    }
    const controller = new AbortController();
    suggestionControllerRef.current = controller;
    setSuggestionsLoading(true);
    setSuggestionError(undefined);
    void fetchFundSuggestions(debouncedKeyword, controller.signal)
      .then((items) => {
        if (!isActiveRequest(controller, suggestionControllerRef.current)) return;
        setSuggestions(items);
        setSuggestionError(items.length ? undefined : "未找到匹配基金");
      })
      .catch((caught) => {
        if ((caught as Error).name !== "AbortError" && isActiveRequest(controller, suggestionControllerRef.current)) {
          setSuggestions([]);
          setSuggestionError("暂时无法获取搜索建议");
        }
      })
      .finally(() => {
        if (suggestionControllerRef.current === controller) setSuggestionsLoading(false);
      });
    return () => controller.abort();
  }, [debouncedKeyword, query.matchBy]);
  const loadMarketOverview = async () => { setMarketLoading(true); setMarketError(undefined); try { setMarketOverview(await fetchMarketOverview()); } catch (caught) { setMarketOverview(undefined); setMarketError(caught instanceof Error ? caught.message : "实时市场数据读取失败"); } finally { setMarketLoading(false); } };
  useEffect(() => { void loadMarketOverview(); }, []);

  const updateQuery = (partial: Partial<FundQuery>) => setQuery((current) => ({ ...current, ...partial }));
  const updateKeyword = (keyword: string) => {
    setQuery((current) => withFundKeyword(current, keyword));
    if (!canSearchFunds(keyword)) {
      setSuggestions([]);
      setSuggestionError(undefined);
    }
  };
  const selectFund = (code: string) => {
    suggestionControllerRef.current?.abort();
    const nextQuery = createSelectedFundQuery(code, query.limit);
    setQuery(nextQuery);
    setSuggestions([]);
    setSuggestionError(undefined);
    void runQuery(nextQuery);
  };
  const handleTab = (next: ResearchTab) => {
    setTab(next);
    const nextQuery = withResearchTab(query, next); setQuery(nextQuery); void runQuery(nextQuery);
  };
  const reset = () => { suggestionControllerRef.current?.abort(); detailControllerRef.current?.abort(); setSuggestions([]); setSuggestionError(undefined); setQuery(initialQuery); setTab("all"); setPeriod("today"); setDetail(undefined); setDetailLoading(false); void runQuery(initialQuery); };
  const openDetail = async (code: string) => {
    detailControllerRef.current?.abort();
    const controller = new AbortController(); detailControllerRef.current = controller;
    setDetailLoading(true);
    try {
      const result = await fetchFundDetail(code, controller.signal);
      if (isActiveRequest(controller, detailControllerRef.current)) setDetail(result);
    } catch (caught) {
      if ((caught as Error).name !== "AbortError" && isActiveRequest(controller, detailControllerRef.current)) setError(caught instanceof Error ? caught.message : "详情读取失败");
    } finally {
      if (detailControllerRef.current === controller) setDetailLoading(false);
    }
  };
  const focusFund = (code: string) => { setHighlightCode(code); document.getElementById(`fund-row-${code}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); window.setTimeout(() => setHighlightCode((current) => current === code ? undefined : current), 2200); };

  return <AppShell header={{ height: 56 }} padding={0}>
    <AppShell.Header px="xl" className="app-header"><Group justify="space-between" h="100%" wrap="nowrap"><Group gap="sm" wrap="nowrap" className="app-brand"><Badge size="md" radius="sm" color="dark" className="app-brand-mark">M</Badge><Text fw={800} size="sm" tt="uppercase" lts=".08em">MCP Fund Bridge</Text></Group><Group gap="xs" wrap="nowrap" className="header-context"><IconChartCandle size={15} color="#228be6" /><Stack gap={0}><Text size="xs" fw={700} tt="uppercase" lts=".1em" c="blue">Market Intelligence</Text><Text size="xs" c="dimmed">国内公募基金 · 场内 + 场外</Text></Stack></Group><Group gap="xs" wrap="nowrap" className="service-status"><IconActivity size={15} color="#16a34a" /><Text size="sm" c="green" className="service-label"><span className="service-prefix">本机服务 / </span>{window.location.host}</Text></Group></Group></AppShell.Header>
    <AppShell.Main className="app-main"><Container size="xl"><Stack gap="lg">
      <Group align="flex-start"><Stack gap={4}><Text size="xs" fw={700} c="blue" tt="uppercase" lts=".12em">Demo MCP / Market Intelligence</Text><Title order={1}>公募基金市场雷达</Title><Text c="dimmed" maw={720}>扫描场内外基金表现，跟踪资金方向与行业变化。</Text></Stack></Group>

      <MarketFlowCard data={marketOverview} loading={marketLoading} error={marketError} onRetry={() => void loadMarketOverview()} />
      <div className="dashboard-grid"><Card withBorder radius="lg" padding="md" className="market-scan-card"><Group justify="space-between" mb="sm"><Group gap="xs"><IconAdjustmentsHorizontal size={18} /><Text fw={700}>市场扫描</Text><Text size="xs" c="dimmed">{snapshot?.dataDate ? `最近数据日 ${snapshot.dataDate}` : "等待查询"}</Text></Group><Tooltip label="恢复默认筛选并重新加载前 20 条基金"><Button variant="subtle" size="xs" leftSection={<IconRefresh size={14} />} onClick={reset}>重置筛选</Button></Tooltip></Group><ResearchTabs value={tab} onChange={handleTab} /><FilterBar query={query} loading={loading} suggestions={suggestions} suggestionsLoading={suggestionsLoading} suggestionError={suggestionError} onChange={updateQuery} onKeywordChange={updateKeyword} onFundSelect={selectFund} onSearch={() => void runQuery()} /><FundTable items={snapshot?.items ?? EMPTY_FUNDS} loading={loading} onSelect={openDetail} highlightCode={highlightCode} /></Card><OverviewPanel items={snapshot?.items ?? EMPTY_FUNDS} period={period} onPeriodChange={setPeriod} onSelect={focusFund} /></div>
      <Card withBorder radius="lg" padding="sm" className="chain-bar"><Group justify="space-between"><Group gap="xs"><IconRoute size={18} color="#2563eb" /><Text size="sm" fw={700}>MCP 调用链路</Text><Text size="xs" c="dimmed">调试模式</Text></Group><Button variant="subtle" size="xs" onClick={() => setChainOpen(true)}>查看调用步骤</Button></Group></Card>
    </Stack></Container></AppShell.Main>
    <McpChainDrawer opened={chainOpen} onClose={() => setChainOpen(false)} activeStep={loading ? stage : 4} />
    <FundDetailPanel detail={detail} loading={detailLoading} onClose={() => { detailControllerRef.current?.abort(); setDetail(undefined); setDetailLoading(false); }} />
    {error && <Modal opened onClose={() => setError(undefined)} title="请求未完成" centered><Group align="flex-start"><IconX color="red" /><Text>{error}</Text></Group></Modal>}
  </AppShell>;
}
