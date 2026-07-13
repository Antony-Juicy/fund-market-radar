import assert from "node:assert/strict";
import test from "node:test";
import { shouldPreferStaticData } from "../src/runtime-data-source.js";

test("GitHub Pages uses its exported market snapshot without contacting the live Sites domain", () => {
  assert.equal(shouldPreferStaticData("antony-juicy.github.io"), true);
  assert.equal(shouldPreferStaticData("fund-market-radar.gabbiyabbiy9.chatgpt.site"), false);
  assert.equal(shouldPreferStaticData("127.0.0.1"), false);
});
