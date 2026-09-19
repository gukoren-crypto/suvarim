import test from "node:test";
import assert from "node:assert/strict";
import {
  extractVoucher,
  daysLeft,
  statusOf,
  redeem,
  safeUrl,
  validateBackup,
  distanceKm,
} from "../src/domain.mjs";
const base = {
  id: "one",
  name: "מתנה",
  issuer: "BUYME",
  amount: 500,
  balance: 300,
  expiry: "2027-12-31",
  stores: ["חנות"],
  history: [],
};
test("recognizes redemption codes and expiry-until wording", () => {
  const result = extractVoucher("קוד מימוש: ABCD1234\nתוקף עד 31/12/2029");
  assert.equal(result.code, "ABCD1234");
  assert.equal(result.expiry, "2029-12-31");
  assert.throws(() =>
    validateBackup({
      version: 1,
      vouchers: [{ ...base, expiry: "2029-02-31" }],
      branches: [],
    }),
  );
});
test("extracts Hebrew message without inventing store eligibility", () => {
  const v = extractVoucher(
    "BUYME שווי 1,250.50 ₪\nקוד: ABCD-1234\nתוקף: 31/12/2027",
  );
  assert.equal(v.amount, 1250.5);
  assert.equal(v.code, "ABCD-1234");
  assert.equal(v.expiry, "2027-12-31");
  assert.equal(v.issuer, "BUYME");
  assert.deepEqual(v.stores, []);
});
test("extracts explicit stores and rejects impossible dates", () => {
  const v = extractVoucher("חנויות: א, ב; ג\nתוקף: 31/02/2027");
  assert.deepEqual(v.stores, ["א", "ב", "ג"]);
  assert.equal(v.expiry, "");
});
test("does not infer monetary value from a code", () =>
  assert.equal(extractVoucher("קוד: 123456789").amount, ""));
test("expiry is inclusive on the local date", () => {
  const now = new Date(2027, 11, 31, 23, 59);
  assert.equal(daysLeft(base.expiry, now), 0);
  assert.equal(statusOf(base, now), "active");
  assert.equal(statusOf(base, new Date(2028, 0, 1)), "expired");
});
test("partial redemption uses cents and records history", () => {
  const v = redeem({ ...base, balance: 0.3 }, 0.1, new Date(2027, 1, 1));
  assert.equal(v.balance, 0.2);
  assert.equal(v.history.length, 1);
  assert.equal(base.history.length, 0);
});
test("rejects overdraw, zero, NaN and expired redemption", () => {
  for (const amount of [301, 0, -1, NaN])
    assert.throws(() => redeem(base, amount, new Date(2027, 0, 1)));
  assert.throws(() => redeem(base, 1, new Date(2028, 0, 1)));
});
test("only accepts http and https links", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("file:///etc/passwd"), "");
  assert.ok(safeUrl("https://example.com/gift"));
});
test("backup validation preserves a valid wallet and rejects malformed records", () => {
  assert.equal(
    validateBackup({ version: 1, vouchers: [base], branches: [] }).vouchers
      .length,
    1,
  );
  for (const v of [
    { ...base, balance: -1 },
    { ...base, balance: 501 },
    { ...base, stores: [{}] },
    { ...base, image: "javascript:alert(1)" },
  ])
    assert.throws(() =>
      validateBackup({ version: 1, vouchers: [v], branches: [] }),
    );
  assert.throws(() =>
    validateBackup({ version: 1, vouchers: [base, base], branches: [] }),
  );
});
test("distance is in kilometers", () => {
  assert.equal(distanceKm({ lat: 32, lng: 34 }, { lat: 32, lng: 34 }), 0);
  assert.ok(
    Math.abs(distanceKm({ lat: 32, lng: 34 }, { lat: 33, lng: 34 }) - 111.195) <
      0.01,
  );
});
test('unknown balance stays available for store lookup but cannot be redeemed', () => {
  const voucher = {...base, balance:null};
  assert.equal(statusOf(voucher), 'active');
  assert.equal(validateBackup({version:1,vouchers:[voucher],branches:[]}).vouchers[0].balance,null);
  assert.throws(() => redeem(voucher, 1));
  assert.equal(statusOf({...voucher,balance:0}), 'used');
});
