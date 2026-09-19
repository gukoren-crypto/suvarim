import test from "node:test";
import assert from "node:assert/strict";
import { coverageFor } from "../src/coverage.mjs";
const product = "dreamcard-multipass-include";
test("coverage never interprets unknown total as complete", () => {
  const rows = coverageFor(
    product,
    [],
    [{ id: "x", store: "FOX", lat: 32, lng: 34 }],
  );
  assert.equal(rows.length, 20);
  const fox = rows.find((r) => r.name === "FOX");
  assert.equal(fox.status, "partial");
  assert.equal(fox.remaining, null);
  assert.equal(rows.find((r) => r.name === "MANGO").status, "pending");
});
test("complete requires explicit source confirmation and matching counts", () => {
  const branch = { id: "x", store: "FOX", lat: 32, lng: 34 };
  const source = { store: "FOX", examined: 2, coverage: "complete" };
  assert.equal(
    coverageFor(product, [source], [branch]).find((r) => r.name === "FOX")
      .status,
    "partial",
  );
  source.examined = 1;
  assert.equal(
    coverageFor(product, [source], [branch]).find((r) => r.name === "FOX")
      .status,
    "complete",
  );
});
