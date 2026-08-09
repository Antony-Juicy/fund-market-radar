import type { FundDetail, FundQuery, FundSnapshot, MarketOverview } from "./types";
import {
  canSearchFunds,
  toFundSearchOptions,
  type FundSearchOption
} from "../src/fund-search";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;
const LIVE_REQUEST_TIMEOUT_MS = 30_000;
const DETAIL_REQUEST_TIMEOUT_MS = 20_000;

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

async function fetchLive<T>(
  path: string,
  signal?: AbortSignal,
  timeoutMs = LIVE_REQUEST_TIMEOUT_MS
): Promise<T> {
  return fetchJson<T>(apiUrl(path), signal, timeoutMs);
}

export async function fetchFundSnapshot(query: FundQuery, signal?: AbortSignal): Promise<FundSnapshot> {
  const params = new URLSearchParams({ ...query, limit: String(query.limit) });
  return fetchLive<FundSnapshot>(`/api/funds?${params}`, signal);
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
  return fetchLive<FundDetail>(`/api/funds/${code}`, signal, DETAIL_REQUEST_TIMEOUT_MS);
}

export async function fetchMarketOverview(signal?: AbortSignal): Promise<MarketOverview> {
  return fetchLive<MarketOverview>("/api/market-overview", signal);
}
