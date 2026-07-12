import assert from "node:assert/strict";
import test from "node:test";

import { FundService, PythonFundAdapter } from "../src/fund-service.js";

test("Python adapter fixed sample returns both exchange markets", async () => {
  const service = new FundService(new PythonFundAdapter(undefined, undefined, true));
  const result = await service.snapshot("", "all", "change_desc", 20);

  assert.equal(result.items.length, 20);
  assert.deepEqual(new Set(result.items.map((item) => item.market)), new Set(["on_exchange", "off_exchange"]));
  assert.equal(result.items[0]?.code, "510300");
});

test("fund service honors the larger local demo result sizes", async () => {
  const service = new FundService(new PythonFundAdapter(undefined, undefined, true));
  const result = await service.snapshot("", "all", "change_desc", 100);

  assert.equal(result.items.length, 100);
});

test("fund service applies keyword and market filters", async () => {
  const service = new FundService(new PythonFundAdapter(undefined, undefined, true));
  const result = await service.snapshot("半导体", "off_exchange", "change_desc", 20, "industry");

  assert.ok(result.items.length > 1);
  const semiconductor = result.items.find((item) => item.code === "012345");
  assert.equal(semiconductor?.code, "012345");
  assert.deepEqual(semiconductor?.matchedBy, ["行业"]);
});
