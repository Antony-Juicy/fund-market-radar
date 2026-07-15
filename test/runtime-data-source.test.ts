import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { shouldPreferStaticData } from "../src/runtime-data-source.js";

test("GitHub Pages uses its exported market snapshot without contacting the live Sites domain", () => {
  assert.equal(shouldPreferStaticData("antony-juicy.github.io"), true);
  assert.equal(shouldPreferStaticData("fund-market-radar.gabbiyabbiy9.chatgpt.site"), false);
  assert.equal(shouldPreferStaticData("127.0.0.1"), false);
});

test("GitHub Pages requests dynamic fund detail from Sites", async () => {
  const source = await readFile("web/api.ts", "utf8");

  assert.match(source, /VITE_DETAIL_API_BASE_URL/);
  assert.match(source, /fetchDynamicFundDetail/);
  assert.match(source, /DETAIL_API_BASE_URL\}\/api\/funds\/\$\{code\}/);
  assert.match(source, /holdings: "unavailable"/);
  assert.match(source, /performance: "unavailable"/);
});
