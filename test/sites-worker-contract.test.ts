import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerSource = () => readFile("scripts/build-sites-worker.mjs", "utf8");

test("Sites worker requests the complete open-fund collection", async () => {
  const source = await workerSource();

  assert.match(source, /page=1,50000/);
  assert.doesNotMatch(source, /page=1,5000(?:[^0]|$)/);
});

test("Sites worker derives market dates from upstream timestamps", async () => {
  const source = await workerSource();

  assert.match(source, /latestTimestamp/);
  assert.match(source, /dataDate:\s*shanghaiDate\(latestTimestamp \* 1000\)/);
  assert.match(source, /updatedAt:\s*dateOf\(latestTimestamp\)/);
});

test("Sites worker derives trading status from the returned data date", async () => {
  const source = await workerSource();

  assert.match(source, /function isCurrentTradingDate\(dataDate/);
  assert.match(source, /isTradingDay:\s*isCurrentTradingDate\(dataDate\)/);
});
