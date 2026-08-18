import assert from "node:assert/strict";
import test from "node:test";

import {
  canQueueDocument,
  DEFAULT_INGESTION_CONCURRENCY,
  MAX_INGESTION_CONCURRENCY,
  parseIngestionConcurrency,
} from "./queue-policy";

test("ingestion concurrency defaults safely and is bounded", () => {
  assert.equal(
    parseIngestionConcurrency(undefined),
    DEFAULT_INGESTION_CONCURRENCY,
  );
  assert.equal(parseIngestionConcurrency("2"), 2);
  assert.equal(parseIngestionConcurrency("99"), MAX_INGESTION_CONCURRENCY);
  assert.equal(
    parseIngestionConcurrency("invalid"),
    DEFAULT_INGESTION_CONCURRENCY,
  );
});

test("only initial, failed, and legacy review states can be queued", () => {
  assert.equal(canQueueDocument("PENDING"), true);
  assert.equal(canQueueDocument("FAILED"), true);
  assert.equal(canQueueDocument("REVIEW_REQUIRED"), true);
  assert.equal(canQueueDocument("QUEUED"), false);
  assert.equal(canQueueDocument("PROCESSING"), false);
  assert.equal(canQueueDocument("COMPLETED"), false);
});
