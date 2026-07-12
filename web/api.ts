import type { FundDetail, FundQuery, FundSnapshot, MarketOverview } from "./types";

export async function fetchFundSnapshot(query: FundQuery, signal?: AbortSignal): Promise<FundSnapshot> {
  const params = new URLSearchParams({ ...query, limit: String(query.limit) });
  const response = await fetch(`/api/funds?${params}`, { signal, headers: { Accept: "application/json" } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "行情查询失败");
  return data as FundSnapshot;
}

export async function fetchFundDetail(code: string, signal?: AbortSignal): Promise<FundDetail> {
  const response = await fetch(`/api/funds/${code}`, { signal, headers: { Accept: "application/json" } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "详情读取失败");
  return data as FundDetail;
}

export async function fetchMarketOverview(signal?: AbortSignal): Promise<MarketOverview> {
  const response = await fetch("/api/market-overview", { signal, headers: { Accept: "application/json" } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "实时市场数据读取失败");
  return data as MarketOverview;
}
