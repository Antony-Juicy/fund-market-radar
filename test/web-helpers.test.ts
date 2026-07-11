import assert from "node:assert/strict";
import test from "node:test";

import {
  HttpError,
  extractText,
  validateName
} from "../src/web-helpers.js";

test("validateName trims a valid name", () => {
  assert.equal(validateName("  Tony  "), "Tony");
});

test("validateName rejects an empty name", () => {
  assert.throws(
    () => validateName("   "),
    (error) => error instanceof HttpError && error.statusCode === 400
  );
});

test("validateName rejects a name longer than 80 characters", () => {
  assert.throws(
    () => validateName("a".repeat(81)),
    (error) => error instanceof HttpError && error.statusCode === 400
  );
});

test("extractText returns the first MCP text content item", () => {
  assert.equal(
    extractText({
      content: [{ type: "image" }, { type: "text", text: "hello" }]
    }),
    "hello"
  );
});

test("extractText rejects a result without text content", () => {
  assert.throws(
    () => extractText({ content: [{ type: "image" }] }),
    /no text content/i
  );
});
