import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const assetsDir = join(dist, "assets");
const html = await readFile(join(dist, "index.html"), "utf8");
const assetNames = await readdir(assetsDir);
const assets = {};

for (const name of assetNames) {
  const content = await readFile(join(assetsDir, name));
  const type = name.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8";
  assets[`/assets/${name}`] = { type, body: content.toString("base64") };
}

const worker = `
const INDEXES = [
  { secid: "1.000001", code: "000001" },
  { secid: "0.399001", code: "399001" },
  { secid: "0.399006", code: "399006" }
];
const html = ${JSON.stringify(html)};
const assets = ${JSON.stringify(assets)};
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const source = "东方财富行业资金流向与指数行情";
const ETF_PAGE_SIZE = 100;
const FUND_CACHE_TTL_MS = 120000;
const FUND_DETAIL_CACHE_TTL_MS = 600000;
const FUND_DETAIL_CACHE_MAX_ENTRIES = 100;
const FUND_DETAIL_REQUEST_TIMEOUT_MS = 15000;
const PERFORMANCE_SOURCE = "东方财富基金历史净值";
let fundQuotesCache;
let fundQuotesExpiresAt = 0;
let fundQuotesLoading;
const fundDetailCache = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, { status: response.status, headers });
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error("upstream http " + response.status);
  return response.json();
}

async function getText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://fund.eastmoney.com/" } });
  if (!response.ok) throw new Error("upstream http " + response.status);
  return response.text();
}

function number(value) {
  if (value === "" || value === "-" || value == null) return undefined;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const parsed = Number(String(value).trim().replace(/,/g, "").replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateOf(timestamp) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
}

function shanghaiDate(timestamp = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date(timestamp));
}

function isCurrentTradingDate(dataDate, now = Date.now()) {
  const date = new Date(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" }).format(date);
  return dataDate === shanghaiDate(now) && weekday !== "Sat" && weekday !== "Sun";
}

function shanghaiBusinessDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return value("year") + "-" + value("month") + "-" + value("day");
}

function historyStartDate(today) {
  const start = new Date(today + "T00:00:00Z");
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  start.setUTCDate(start.getUTCDate() - 10);
  return start.toISOString().slice(0, 10);
}

function warnFundDetailFailure(code, source, failure) {
  console.warn("fund_detail_upstream_failure", { code, source, failure });
}

async function getFundDetailText(url, code, source) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0", Referer: "https://fund.eastmoney.com/" }
        });
        if (!response.ok) throw new Error("upstream http " + response.status);
        return response.text();
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("fund detail upstream timeout"));
        }, FUND_DETAIL_REQUEST_TIMEOUT_MS);
      })
    ]);
  } catch (error) {
    warnFundDetailFailure(code, source, "request_failed");
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function parseFundHistory(text) {
  const payload = JSON.parse(text);
  if (!Array.isArray(payload.Data?.LSJZList)) throw new Error("Fund history response has no LSJZList.");
  return payload.Data.LSJZList.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const date = typeof row.FSRQ === "string" ? row.FSRQ.trim() : "";
    const unitNav = number(row.DWJZ);
    const cumulativeNav = number(row.LJJZ);
    const value = cumulativeNav ?? unitNav;
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || value === undefined) return [];
    return [{ date, value, ...(unitNav === undefined ? {} : { unitNav }), ...(cumulativeNav === undefined ? {} : { cumulativeNav }) }];
  }).sort((left, right) => left.date.localeCompare(right.date));
}

function plainText(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\\s+/g, " ").trim();
}

function parseFundHoldings(text) {
  const contentMatch = text.match(/\\bcontent\\s*:\\s*("(?:\\\\.|[^"\\\\])*")/s);
  if (!contentMatch) throw new Error("Fund holdings response has no content.");
  const content = JSON.parse(contentMatch[1]);
  const reportDate = plainText(content).match(/\\b\\d{4}-\\d{2}-\\d{2}\\b/)?.[0];
  if (!reportDate) return { items: [] };
  const items = [...content.matchAll(/<tr\\b[^>]*>([\\s\\S]*?)<\\/tr>/gi)].flatMap((row) => {
    const cells = [...row[1].matchAll(/<td\\b[^>]*>([\\s\\S]*?)<\\/td>/gi)].map((cell) => plainText(cell[1]));
    const rank = number(cells[0]);
    const stockCode = cells[1]?.trim();
    const stockName = cells[2]?.trim();
    const navRatio = number(cells[6]);
    if (rank === undefined || !stockCode || !stockName || navRatio === undefined) return [];
    const sharesWan = number(cells[7]);
    const marketValueWan = number(cells[8]);
    return [{ rank, stockCode, stockName, navRatio, ...(sharesWan === undefined ? {} : { sharesWan }), ...(marketValueWan === undefined ? {} : { marketValueWan }), reportDate }];
  });
  return { items: items.slice(0, 10), reportDate };
}

async function loadFundDetail(code) {
  const businessDate = shanghaiBusinessDate();
  const historyUrl = "https://api.fund.eastmoney.com/f10/lsjz?" + new URLSearchParams({
    fundCode: code,
    pageIndex: "1",
    pageSize: "400",
    startDate: historyStartDate(businessDate),
    endDate: businessDate
  });
  const holdingsUrl = "https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=" + encodeURIComponent(code) + "&topline=10&year=&month=";
  const [historyResult, holdingsResult] = await Promise.allSettled([
    getFundDetailText(historyUrl, code, "history"),
    getFundDetailText(holdingsUrl, code, "holdings")
  ]);

  let performanceHistory = [];
  let performance = "unavailable";
  if (historyResult.status === "fulfilled") {
    try {
      performanceHistory = parseFundHistory(historyResult.value);
      performance = performanceHistory.length ? "available" : "empty";
    } catch {
      warnFundDetailFailure(code, "history", "parse_failed");
    }
  }

  let holdings = { items: [] };
  let holdingsAvailability = "unavailable";
  if (holdingsResult.status === "fulfilled") {
    try {
      holdings = parseFundHoldings(holdingsResult.value);
      holdingsAvailability = holdings.items.length ? "available" : "empty";
    } catch {
      warnFundDetailFailure(code, "holdings", "parse_failed");
    }
  }

  return {
    stockHoldings: holdings.items,
    ...(holdings.reportDate === undefined ? {} : { holdingsReportDate: holdings.reportDate }),
    performanceHistory,
    performanceSource: PERFORMANCE_SOURCE,
    availability: { holdings: holdingsAvailability, performance }
  };
}

function fundDetail(code) {
  const now = Date.now();
  const cached = fundDetailCache.get(code);
  if (cached && cached.expiresAt > now) return cached.value;
  for (const [cachedCode, entry] of fundDetailCache) {
    if (entry.expiresAt <= now) fundDetailCache.delete(cachedCode);
  }
  while (fundDetailCache.size >= FUND_DETAIL_CACHE_MAX_ENTRIES) {
    const oldestCode = fundDetailCache.keys().next().value;
    if (oldestCode === undefined) break;
    fundDetailCache.delete(oldestCode);
  }
  const value = loadFundDetail(code);
  fundDetailCache.set(code, { expiresAt: now + FUND_DETAIL_CACHE_TTL_MS, value });
  void value.catch(() => {
    if (fundDetailCache.get(code)?.value === value) fundDetailCache.delete(code);
  });
  return value;
}

async function marketOverview() {
  const indices = await Promise.all(INDEXES.map(async ({ secid, code }) => {
    const params = new URLSearchParams({ secid, fields: "f43,f58,f170,f124" });
    const payload = await getJson("https://push2delay.eastmoney.com/api/qt/stock/get?" + params);
    const data = payload.data || {};
    return { code, name: String(data.f58 || code), value: Number(data.f43 || 0) / 100, changePercent: Number(data.f170 || 0) / 100 };
  }));
  const params = new URLSearchParams({ pn: "1", pz: "500", po: "1", np: "1", ut: "b2884a393a59ad64002292a3e90d46a5", fltt: "2", invt: "2", fid0: "f62", fs: "m:90 t:2", stat: "1", fields: "f12,f14,f3,f62,f124" });
  const payload = await getJson("https://push2delay.eastmoney.com/api/qt/clist/get?" + params);
  const sectors = (payload.data?.diff || []).map((row) => ({ name: String(row.f14 || row.f12 || "未知板块"), amount: number(row.f62), changePercent: number(row.f3), updatedAt: number(row.f124) })).filter((item) => typeof item.amount === "number");
  const positive = sectors.filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const negative = sectors.filter((item) => item.amount < 0).sort((a, b) => a.amount - b.amount);
  const inflowTotal = positive.reduce((sum, item) => sum + item.amount, 0);
  const outflowTotal = Math.abs(negative.reduce((sum, item) => sum + item.amount, 0));
  const gross = inflowTotal + outflowTotal;
  const latestTimestamp = Math.max(0, ...sectors.map((item) => item.updatedAt || 0));
  const cleanSector = ({ updatedAt: _updatedAt, ...item }) => item;
  return { indices, inflowTotal, outflowTotal, netFlow: inflowTotal - outflowTotal, inflowRatio: gross ? inflowTotal / gross * 100 : 0, outflowRatio: gross ? outflowTotal / gross * 100 : 0, inflowSectors: positive.slice(0, 5).map(cleanSector), outflowSectors: negative.slice(0, 5).map(cleanSector), dataDate: shanghaiDate(latestTimestamp * 1000), updatedAt: dateOf(latestTimestamp), source, flowBasis: "行业主力净流向正值与负值分别汇总，比例按绝对值合计计算" };
}

function parseOpenFunds(text) {
  const match = text.match(/datas:(\\[\\[.*?\\]\\]),count:/s);
  if (!match) return [];
  let rows = [];
  try { rows = JSON.parse(match[1]); } catch { return []; }
  const dateMatch = text.match(/showday:(\\[[^\\]]+\\])/);
  let dataDate = shanghaiDate();
  try { dataDate = JSON.parse(dateMatch?.[1] || "[]")[0] || dataDate; } catch {}
  return rows.map((row) => ({ code: row[0], name: row[1], market: "off_exchange", fundType: "开放式公募", nav: number(row[3]), changePercent: number(row[8]), dataDate, updatedAt: new Date().toISOString(), isTradingDay: isCurrentTradingDate(dataDate), officialNavAvailable: true, source: "东方财富开放式基金净值", flowBasis: "基金净值与日涨跌幅" })).filter((item) => /^\\d{6}$/.test(item.code || "") && item.name && typeof item.nav === "number");
}

function etfUrl(page) {
  const params = new URLSearchParams({ pn: String(page), pz: String(ETF_PAGE_SIZE), po: "1", np: "1", ut: "bd1d9ddb04089700cf9c27f6f7426281", fltt: "2", invt: "2", fid: "f12", fs: "b:MK0021,b:MK0022,b:MK0023,b:MK0024,b:MK0827", fields: "f2,f3,f12,f14,f124,f297,f441" });
  return "https://push2delay.eastmoney.com/api/qt/clist/get?" + params;
}

async function loadFundQuotes() {
  const [firstEtfPayload, openText] = await Promise.all([getJson(etfUrl(1)), getText("https://fund.eastmoney.com/Data/Fund_JJJZ_Data.aspx?t=1&lx=1&sort=zdf,desc&page=1,50000&dt=" + Date.now())]);
  const pageCount = Math.max(1, Math.ceil(Number(firstEtfPayload.data?.total || 0) / ETF_PAGE_SIZE));
  const remainingPayloads = await Promise.all(Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => getJson(etfUrl(index + 2))));
  const etfRows = [firstEtfPayload, ...remainingPayloads].flatMap((payload) => payload.data?.diff || []);
  const etfs = etfRows.map((row) => {
    const dataDate = /^\\d{8}$/.test(String(row.f297)) ? String(row.f297).replace(/(\\d{4})(\\d{2})(\\d{2})/, "$1-$2-$3") : shanghaiDate();
    return { code: row.f12, name: row.f14, market: "on_exchange", fundType: "ETF", price: number(row.f2), nav: number(row.f441), changePercent: number(row.f3), periodChanges: { today: number(row.f3) }, dataDate, updatedAt: dateOf(row.f124), isTradingDay: isCurrentTradingDate(dataDate), officialNavAvailable: true, source: "东方财富 ETF 行情", flowBasis: "ETF 交易价格与日涨跌幅" };
  }).filter((item) => /^\\d{6}$/.test(item.code || "") && item.name);
  return etfs.concat(parseOpenFunds(openText));
}

async function fundQuotes() {
  if (fundQuotesCache && Date.now() < fundQuotesExpiresAt) return fundQuotesCache;
  if (!fundQuotesLoading) {
    fundQuotesLoading = loadFundQuotes().then((items) => {
      fundQuotesCache = items;
      fundQuotesExpiresAt = Date.now() + FUND_CACHE_TTL_MS;
      return items;
    });
  }
  try { return await fundQuotesLoading; } finally { fundQuotesLoading = undefined; }
}

function filterFunds(items, url) {
  const keyword = (url.searchParams.get("keyword") || "").trim().toLowerCase();
  const market = url.searchParams.get("market") || "all";
  const matchBy = url.searchParams.get("matchBy") || "all";
  const sort = url.searchParams.get("sort") || "change_desc";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);
  const matches = (item) => {
    if (market !== "all" && item.market !== market) return false;
    if (!keyword) return true;
    const fields = matchBy === "code" ? [item.code] : matchBy === "name" ? [item.name] : [item.code, item.name, item.indexName, item.industry, item.fundType];
    return fields.some((field) => String(field || "").toLowerCase().includes(keyword));
  };
  const filtered = items.filter(matches).sort((a, b) => sort === "name" ? String(a.name).localeCompare(String(b.name), "zh-CN") : (Number(b.changePercent || -Infinity) - Number(a.changePercent || -Infinity)) * (sort === "change_asc" ? -1 : 1));
  const dataDate = items[0]?.dataDate || shanghaiDate();
  return { keyword: url.searchParams.get("keyword") || "", matchBy, market, sort, limit, dataDate, updatedAt: new Date().toISOString(), isTradingDay: isCurrentTradingDate(dataDate), items: filtered.slice(0, limit) };
}

async function api(url) {
  if (url.pathname === "/api/market-overview") return json(await marketOverview());
  if (url.pathname === "/api/funds-export") {
    const items = await fundQuotes();
    const dataDate = items[0]?.dataDate || shanghaiDate();
    return json({ dataDate, updatedAt: new Date().toISOString(), isTradingDay: isCurrentTradingDate(dataDate), items });
  }
  if (url.pathname === "/api/funds") return json(filterFunds(await fundQuotes(), url));
  const detail = url.pathname.match(/^\\/api\\/funds\\/(\\d{6})$/);
  if (detail) {
    const item = (await fundQuotes()).find((fund) => fund.code === detail[1]);
    return item ? json({ ...item, ...(await fundDetail(detail[1])), industryAllocation: [] }) : json({ error: "未找到该基金。" }, 404);
  }
  return json({ error: "Not found." }, 404);
}

export default { async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    try { return cors(await api(url)); } catch (error) { return cors(json({ error: "实时数据源暂时不可用。" }, 502)); }
  }
  if (url.pathname === "/" || url.pathname === "/index.html") return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  const asset = assets[url.pathname];
  if (asset) {
    const binary = Uint8Array.from(atob(asset.body), (char) => char.charCodeAt(0));
    return new Response(binary, { headers: { "Content-Type": asset.type, "Cache-Control": "public, max-age=31536000, immutable" } });
  }
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
} };
`;

await mkdir(join(dist, "server"), { recursive: true });
await writeFile(join(dist, "server", "index.js"), worker);
console.log("Wrote dist/server/index.js for Sites deployment.");
