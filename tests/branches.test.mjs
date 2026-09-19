import test from "node:test";
import assert from "node:assert/strict";
import { branchesForStores, sameStore } from "../src/branches.mjs";
const branch = { id: "one", store: "ללין", lat: 32, lng: 34 };
test("shared branches support new vouchers and known language aliases without conflating channels", () => {
  assert.equal(sameStore("LALINE", "ללין"), true);
  assert.equal(sameStore("FOX HOME", "FOX"), false);
  assert.equal(sameStore("FOX אונליין", "FOX"), false);
  assert.deepEqual(branchesForStores(["LALINE"], [], [branch]), [branch]);
  assert.deepEqual(branchesForStores(["FOX"], [], [branch]), []);
});
test("shared and manual duplicate coordinates produce a single marker", () => {
  assert.equal(
    branchesForStores(
      ["LALINE"],
      [{ ...branch, id: "manual", store: "LALINE" }],
      [branch],
    ).length,
    1,
  );
});
