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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateOf(timestamp) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
}

function shanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
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
  const sectors = (payload.data?.diff || []).map((row) => ({ name: String(row.f14 || row.f12 || "未知板块"), amount: number(row.f62), changePercent: number(row.f3) })).filter((item) => typeof item.amount === "number");
  const positive = sectors.filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const negative = sectors.filter((item) => item.amount < 0).sort((a, b) => a.amount - b.amount);
  const inflowTotal = positive.reduce((sum, item) => sum + item.amount, 0);
  const outflowTotal = Math.abs(negative.reduce((sum, item) => sum + item.amount, 0));
  const gross = inflowTotal + outflowTotal;
  return { indices, inflowTotal, outflowTotal, netFlow: inflowTotal - outflowTotal, inflowRatio: gross ? inflowTotal / gross * 100 : 0, outflowRatio: gross ? outflowTotal / gross * 100 : 0, inflowSectors: positive.slice(0, 5), outflowSectors: negative.slice(0, 5), dataDate: shanghaiDate(), updatedAt: new Date().toISOString(), source, flowBasis: "行业主力净流向正值与负值分别汇总，比例按绝对值合计计算" };
}

function parseOpenFunds(text) {
  const match = text.match(/datas:(\\[\\[.*?\\]\\]),count:/s);
  if (!match) return [];
  let rows = [];
  try { rows = JSON.parse(match[1]); } catch { return []; }
  const dateMatch = text.match(/showday:(\\[[^\\]]+\\])/);
  let dataDate = shanghaiDate();
  try { dataDate = JSON.parse(dateMatch?.[1] || "[]")[0] || dataDate; } catch {}
  return rows.map((row) => ({ code: row[0], name: row[1], market: "off_exchange", fundType: "开放式公募", nav: number(row[3]), changePercent: number(row[8]), dataDate, updatedAt: new Date().toISOString(), source: "东方财富开放式基金净值", flowBasis: "基金净值与日涨跌幅" })).filter((item) => /^\\d{6}$/.test(item.code || "") && item.name && typeof item.nav === "number");
}

async function fundQuotes() {
  const etfParams = new URLSearchParams({ pn: "1", pz: "300", po: "1", np: "1", ut: "bd1d9ddb04089700cf9c27f6f7426281", fltt: "2", invt: "2", fid: "f12", fs: "b:MK0021,b:MK0022,b:MK0023,b:MK0024,b:MK0827", fields: "f2,f3,f12,f14,f124,f297,f441" });
  const [etfPayload, openText] = await Promise.all([getJson("https://push2delay.eastmoney.com/api/qt/clist/get?" + etfParams), getText("https://fund.eastmoney.com/Data/Fund_JJJZ_Data.aspx?t=1&lx=1&sort=zdf,desc&page=1,5000&dt=" + Date.now())]);
  const etfs = (etfPayload.data?.diff || []).map((row) => ({ code: row.f12, name: row.f14, market: "on_exchange", fundType: "ETF", price: number(row.f2), nav: number(row.f441), changePercent: number(row.f3), periodChanges: { today: number(row.f3) }, dataDate: /^\\d{8}$/.test(String(row.f297)) ? String(row.f297).replace(/(\\d{4})(\\d{2})(\\d{2})/, "$1-$2-$3") : shanghaiDate(), updatedAt: dateOf(row.f124), source: "东方财富 ETF 行情", flowBasis: "ETF 交易价格与日涨跌幅" })).filter((item) => /^\\d{6}$/.test(item.code || "") && item.name);
  return etfs.concat(parseOpenFunds(openText));
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
  return { keyword: url.searchParams.get("keyword") || "", matchBy, market, sort, limit, dataDate: items[0]?.dataDate || shanghaiDate(), updatedAt: new Date().toISOString(), isTradingDay: new Date().getDay() !== 0 && new Date().getDay() !== 6, items: filtered.slice(0, limit) };
}

async function api(url) {
  if (url.pathname === "/api/market-overview") return json(await marketOverview());
  if (url.pathname === "/api/funds") return json(filterFunds(await fundQuotes(), url));
  const detail = url.pathname.match(/^\\/api\\/funds\\/(\\d{6})$/);
  if (detail) {
    const item = (await fundQuotes()).find((fund) => fund.code === detail[1]);
    return item ? json({ ...item, industryAllocation: [] }) : json({ error: "未找到该基金。" }, 404);
  }
  return json({ error: "Not found." }, 404);
}

export default { async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    try { return cors(await api(url)); } catch (error) { return json({ error: "实时数据源暂时不可用。" }, 502); }
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
