import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDir = resolve(process.cwd(), "dist/data");
const apiBase = (process.env.PAGES_DATA_API_URL ?? "https://fund-market-radar.gabbiyabbiy9.chatgpt.site").replace(/\/$/, "");

async function fetchJson(path, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(`${apiBase}${path}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`Pages data API returned HTTP ${response.status}.`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1_000));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
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
