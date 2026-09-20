import test from "node:test";
import assert from "node:assert/strict";
import { mergeBranchCandidates } from "../scripts/lib/merge-branch-candidates.mjs";
const b = {
  id: "x",
  store: "FOX",
  name: "one",
  city: "city",
  address: "address",
  lat: 32,
  lng: 34.8,
  sourceUrl: "https://fox.co.il/pages/branches",
  coordinateSourceUrl: "https://www.waze.com/?ll=32,34.8",
  checkedAt: "2026-09-20",
};
const batch = (branches) => ({
  store: "FOX",
  branches,
  source: {
    store: "FOX",
    examined: 10,
    sourceUrl: b.sourceUrl,
    checkedAt: b.checkedAt,
    skipped: [],
    coverage: "partial",
  },
});
test("partial collections retain missing branches and merge new branches", () => {
  const result = mergeBranchCandidates([b], { sources: [] }, [
    batch([{ ...b, id: "new", lat: 32.1 }]),
  ]);
  assert.equal(result.branches.length, 2);
  assert.equal(result.report.retained.length, 1);
  assert.equal(result.report.added.length, 1);
});
test("moving a known branch requires review; mismatched IDs and untrusted provenance fail", () => {
  const result = mergeBranchCandidates([b], { sources: [] }, [
    batch([{ ...b, lat: 33 }]),
  ]);
  assert.equal(result.report.reviewRequired.length, 1);
  assert.equal(result.branches[0].lat, 32);
  assert.throws(() =>
    mergeBranchCandidates([b], { sources: [] }, [
      batch([{ ...b, sourceUrl: "javascript:alert(1)" }]),
    ]),
  );
  assert.throws(() =>
    mergeBranchCandidates([{ ...b, store: "LALINE" }], { sources: [] }, [
      batch([b]),
    ]),
  );
});
test("same physical location is not added twice and duplicate chain batches are rejected", () => {
  const result = mergeBranchCandidates([b], { sources: [] }, [
    batch([{ ...b, id: "new" }]),
  ]);
  assert.equal(result.branches.length, 1);
  assert.equal(result.report.duplicates.length, 1);
  assert.throws(() =>
    mergeBranchCandidates([], { sources: [] }, [batch([b]), batch([b])]),
  );
});
