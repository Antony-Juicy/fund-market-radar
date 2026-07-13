import test from "node:test";
import assert from "node:assert/strict";

import { abortableDelay, isActiveRequest } from "../src/request-control.js";

test("an aborted delay rejects before its timer completes", async () => {
  const controller = new AbortController();
  const pending = abortableDelay(1_000, controller.signal);
  controller.abort();

  await assert.rejects(pending, (error: Error) => error.name === "AbortError");
});

test("only the latest non-aborted request is active", () => {
  const stale = new AbortController();
  const latest = new AbortController();

  assert.equal(isActiveRequest(stale, latest), false);
  assert.equal(isActiveRequest(latest, latest), true);
  latest.abort();
  assert.equal(isActiveRequest(latest, latest), false);
});
