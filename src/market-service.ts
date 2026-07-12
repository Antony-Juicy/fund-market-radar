export interface MarketIndexQuote {
  code: string;
  name: string;
  value: number;
  changePercent: number;
}

export interface SectorFlow {
  name: string;
  amount: number;
  changePercent?: number;
}

export interface MarketOverview {
  indices: MarketIndexQuote[];
  inflowTotal: number;
  outflowTotal: number;
  netFlow: number;
  inflowRatio: number;
  outflowRatio: number;
  inflowSectors: SectorFlow[];
  outflowSectors: SectorFlow[];
  dataDate: string;
  updatedAt: string;
  source: string;
  flowBasis: string;
}

const INDEXES = [
  { secid: "1.000001", code: "000001" },
  { secid: "0.399001", code: "399001" },
  { secid: "0.399006", code: "399006" }
];

async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`Eastmoney returned HTTP ${response.status}.`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMarketOverview(): Promise<MarketOverview> {
  const indexResults = await Promise.all(INDEXES.map(async ({ secid, code }) => {
    const params = new URLSearchParams({ secid, fields: "f43,f57,f58,f169,f170,f124" });
    const payload = await fetchJson<{ data?: Record<string, unknown> }>(`https://push2delay.eastmoney.com/api/qt/stock/get?${params}`);
    const data = payload.data;
    if (!data || typeof data.f43 !== "number" || typeof data.f170 !== "number") throw new Error(`Index ${code} returned invalid data.`);
    return {
      code,
      name: String(data.f58 ?? code),
      value: data.f43 / 100,
      changePercent: data.f170 / 100,
      updatedAt: typeof data.f124 === "number" && data.f124 > 0 ? data.f124 : undefined
    };
  }));

  const params = new URLSearchParams({
    pn: "1", pz: "500", po: "1", np: "1", ut: "b2884a393a59ad64002292a3e90d46a5",
    fltt: "2", invt: "2", fid0: "f62", fs: "m:90 t:2", stat: "1",
    fields: "f12,f14,f2,f3,f62,f184,f124", rt: "52975239"
  });
  const sectorPayload = await fetchJson<{ data?: { diff?: Array<Record<string, unknown>> } }>(`https://push2delay.eastmoney.com/api/qt/clist/get?${params}`);
  const sectors = (sectorPayload.data?.diff ?? []).flatMap((row) => {
    if (typeof row.f62 !== "number" || !Number.isFinite(row.f62)) return [];
    return [{ name: String(row.f14 ?? row.f12 ?? "未知板块"), amount: row.f62, changePercent: typeof row.f3 === "number" ? row.f3 : undefined, updatedAt: typeof row.f124 === "number" ? row.f124 : undefined }];
  });
  if (!sectors.length) throw new Error("Sector fund-flow data is unavailable.");

  const positive = sectors.filter((item) => item.amount > 0);
  const negative = sectors.filter((item) => item.amount < 0);
  const inflowTotal = positive.reduce((sum, item) => sum + item.amount, 0);
  const outflowTotal = Math.abs(negative.reduce((sum, item) => sum + item.amount, 0));
  const gross = inflowTotal + outflowTotal;
  const latestTimestamp = Math.max(0, ...indexResults.map((item) => item.updatedAt ?? 0), ...sectors.map((item) => item.updatedAt ?? 0));
  const updatedAt = new Date(latestTimestamp > 0 ? latestTimestamp * 1000 : Date.now()).toISOString();

  return {
    indices: indexResults.map(({ updatedAt: _updatedAt, ...item }) => item),
    inflowTotal,
    outflowTotal,
    netFlow: inflowTotal - outflowTotal,
    inflowRatio: gross ? inflowTotal / gross * 100 : 0,
    outflowRatio: gross ? outflowTotal / gross * 100 : 0,
    inflowSectors: positive.sort((a, b) => b.amount - a.amount).slice(0, 5).map(({ updatedAt: _updatedAt, ...item }) => item),
    outflowSectors: negative.sort((a, b) => a.amount - b.amount).slice(0, 5).map(({ updatedAt: _updatedAt, ...item }) => item),
    dataDate: updatedAt.slice(0, 10),
    updatedAt,
    source: "东方财富行业资金流向与指数行情",
    flowBasis: "行业主力净流向正值与负值分别汇总，比例按绝对值合计计算"
  };
}
