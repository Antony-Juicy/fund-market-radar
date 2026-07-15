import type { FundDetail, FundQuery, FundSnapshot, MarketOverview } from "./types";
import { createSnapshotFromStaticData } from "../src/pages-fallback";
import {
  canSearchFunds,
  toFundSearchOptions,
  type FundSearchOption
} from "../src/fund-search";
import { throwIfAborted } from "../src/request-control";
import { shouldPreferStaticData } from "../src/runtime-data-source";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const DETAIL_API_BASE_URL = String(
  import.meta.env.VITE_DETAIL_API_BASE_URL ?? "https://fund-market-radar.gabbiyabbiy9.chatgpt.site"
).replace(/\/$/, "");
const STATIC_DATA_BASE_URL = `${import.meta.env.BASE_URL}data`;
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;
const LIVE_REQUEST_TIMEOUT_MS = 4_000;
const DETAIL_REQUEST_TIMEOUT_MS = 15_000;
const PREFER_STATIC_DATA = shouldPreferStaticData(window.location.hostname);
let staticFundsPromise: Promise<FundSnapshot> | undefined;

async function fetchJson<T>(url: string, signal?: AbortSignal, timeoutMs?: number): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = timeoutMs ? window.setTimeout(abort, timeoutMs) : undefined;
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data as T;
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

async function fetchLive<T>(path: string, signal?: AbortSignal): Promise<T> {
  return fetchJson<T>(apiUrl(path), signal, LIVE_REQUEST_TIMEOUT_MS);
}

async function fetchDynamicFundDetail(code: string, signal?: AbortSignal): Promise<FundDetail> {
  return fetchJson<FundDetail>(`${DETAIL_API_BASE_URL}/api/funds/${code}`, signal, DETAIL_REQUEST_TIMEOUT_MS);
}

function fetchStaticFunds(): Promise<FundSnapshot> {
  if (!staticFundsPromise) {
    staticFundsPromise = fetchJson<FundSnapshot>(`${STATIC_DATA_BASE_URL}/funds.json`)
      .catch((error) => {
        staticFundsPromise = undefined;
        throw error;
      });
  }
  return staticFundsPromise;
}

function unavailableFundDetail(item: FundSnapshot["items"][number]): FundDetail {
  return {
    ...item,
    industryAllocation: [],
    stockHoldings: [],
    performanceHistory: [],
    performanceSource: "东方财富基金历史净值",
    availability: { holdings: "unavailable", performance: "unavailable" }
  };
}

function mergeStaticQuoteWithResearch(
  item: FundSnapshot["items"][number],
  detail: FundDetail
): FundDetail {
  return {
    ...item,
    industryAllocation: detail.industryAllocation,
    stockHoldings: detail.stockHoldings,
    ...(detail.holdingsReportDate === undefined ? {} : { holdingsReportDate: detail.holdingsReportDate }),
    performanceHistory: detail.performanceHistory,
    performanceSource: detail.performanceSource,
    availability: detail.availability
  };
}

export async function fetchFundSnapshot(query: FundQuery, signal?: AbortSignal): Promise<FundSnapshot> {
  const params = new URLSearchParams({ ...query, limit: String(query.limit) });
  if (PREFER_STATIC_DATA) {
    const data = await fetchStaticFunds();
    throwIfAborted(signal);
    return createSnapshotFromStaticData(data, query) as FundSnapshot;
  }
  try {
    return await fetchLive<FundSnapshot>(`/api/funds?${params}`, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    const data = await fetchStaticFunds();
    throwIfAborted(signal);
    return createSnapshotFromStaticData(data, query) as FundSnapshot;
  }
}

export async function fetchFundSuggestions(
  keyword: string,
  signal?: AbortSignal
): Promise<FundSearchOption[]> {
  if (!canSearchFunds(keyword)) return [];
  const snapshot = await fetchFundSnapshot({
    keyword: keyword.trim(),
    matchBy: "all",
    market: "all",
    sort: "name",
    limit: 8
  }, signal);
  return toFundSearchOptions(snapshot.items);
}

export async function fetchFundDetail(code: string, signal?: AbortSignal): Promise<FundDetail> {
  if (PREFER_STATIC_DATA) {
    const data = await fetchStaticFunds();
    throwIfAborted(signal);
    const item = data.items.find((fund) => fund.code === code);
    if (!item) throw new Error("未找到该基金。");
    try {
      return mergeStaticQuoteWithResearch(item, await fetchDynamicFundDetail(code, signal));
    } catch (error) {
      if (signal?.aborted) throw error;
      return unavailableFundDetail(item);
    }
  }
  try {
    return await fetchLive<FundDetail>(`/api/funds/${code}`, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    const data = await fetchStaticFunds();
    throwIfAborted(signal);
    const item = data.items.find((fund) => fund.code === code);
    if (!item) throw new Error("未找到该基金。");
    return unavailableFundDetail(item);
  }
}

export async function fetchMarketOverview(signal?: AbortSignal): Promise<MarketOverview> {
  if (PREFER_STATIC_DATA) {
    return fetchJson<MarketOverview>(`${STATIC_DATA_BASE_URL}/market-overview.json`, signal);
  }
  try {
    return await fetchLive<MarketOverview>("/api/market-overview", signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    return fetchJson<MarketOverview>(`${STATIC_DATA_BASE_URL}/market-overview.json`, signal);
  }
}
