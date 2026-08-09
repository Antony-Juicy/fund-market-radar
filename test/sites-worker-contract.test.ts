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

test("Sites worker never converts unpublished fund values to zero", async () => {
  const source = await workerSource();

  assert.match(source, /value === "" \|\| value === "-" \|\| value == null/);
  assert.match(source, /typeof value !== "string" && typeof value !== "number"/);
});

test("Sites worker aggregates real holdings and NAV history for fund detail", async () => {
  const source = await workerSource();

  assert.match(source, /FundArchivesDatas\.aspx\?type=jjcc/);
  assert.match(source, /api\.fund\.eastmoney\.com\/f10\/lsjz/);
  assert.match(source, /FUND_DETAIL_CACHE_TTL_MS = 600000/);
  assert.match(source, /fundDetailCache/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /availability/);
  assert.match(source, /Asia\/Shanghai/);
  assert.match(source, /15000/);
});

test("Sites worker returns partial detail data rather than failing the quote", async () => {
  const source = await workerSource();

  assert.match(source, /return item \? json\(\{ \.\.\.item, \.\.\.\(await fundDetail/);
  assert.match(source, /let holdings = \{ items: \[\] \}/);
  assert.match(source, /let performanceHistory = \[\]/);
  assert.match(source, /let holdingsAvailability = "unavailable"/);
  assert.match(source, /let performance = "unavailable"/);
});

test("Sites worker preserves the FundDetail quote contract", async () => {
  const source = await workerSource();

  assert.match(source, /officialNavAvailable/);
});
