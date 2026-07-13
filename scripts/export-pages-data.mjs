import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDir = resolve(process.cwd(), "dist/data");
const apiBase = (process.env.PAGES_DATA_API_URL ?? "https://fund-market-radar.gabbiyabbiy9.chatgpt.site").replace(/\/$/, "");

async function fetchJson(path) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`Pages data API returned HTTP ${response.status}.`);
  return response.json();
}

const [fundData, marketOverview] = await Promise.all([
  fetchJson("/api/funds-export"),
  fetchJson("/api/market-overview")
]);

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDir, "funds.json"), JSON.stringify(fundData)),
  writeFile(resolve(outputDir, "market-overview.json"), JSON.stringify(marketOverview))
]);

console.log(`Exported ${fundData.items.length} real fund quotes for Pages fallback.`);
