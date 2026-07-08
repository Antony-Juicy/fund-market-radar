import assert from "node:assert/strict";
import test from "node:test";

import { greet } from "../src/greeting.js";

test("greet returns a Chinese greeting for the supplied name", () => {
  assert.equal(greet("Tony"), "你好，Tony!");
});
