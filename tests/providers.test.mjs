import test from "node:test";
import assert from "node:assert/strict";
import { extractVoucher, validateBackup } from "../src/domain.mjs";
import { identifyProvider, extractLinks } from "../src/providers.mjs";
test("a displayed balance is not an original amount, and an original value is not a current balance", () => {
  const current = extractVoucher(
    "Swish Premium (Rainbow)\nיתרה בכרטיס: ₪97.35\nבתוקף עד: 26.03.2031",
  );
  assert.equal(current.amount, "");
  assert.equal(current.balance, 97.35);
  assert.equal(current.expiry, "2031-03-26");
  const original = extractVoucher("קיבלת שובר Dream Card בשווי 400₪.");
  assert.equal(original.amount, 400);
  assert.equal(original.balance, "");
  const both = extractVoucher("שווי 400 ₪\nיתרה בכרטיס: 97.35 ₪");
  assert.equal(both.amount, 400);
  assert.equal(both.balance, 97.35);
});
test("the exact include terms route identifies the Multipass sales variant and keeps a personal restriction", () => {
  const data = extractVoucher(
    "DREAM CARD\nhttps://www.dcgift.co.il/include\nלא תקף באתרי הסחר.\nתוקף התו -",
  );
  assert.equal(data.voucherProductId, "dreamcard-multipass-include");
  assert.equal(data.expiry, "");
  assert.equal(data.notes, "לא תקף באתרי הסחר.");
  assert.equal(getProduct(data.voucherProductId).merchants.length, 20);
  assert.equal(
    identifyProvider("https://dcgift.co.il.evil.example/include")
      .voucherProductId,
    "",
  );
});
test("a wrapped screenshot link and a hyphen-separated code retain only their explicit values", () => {
  const data = extractVoucher(
    "בקוד מולטיפאס -\n9000000000001\nhttps://mycards.mltp.co.il/\nFAKE_TEST_ONLY",
  );
  assert.equal(data.code, "9000000000001");
  assert.equal(data.link, "https://mycards.mltp.co.il/FAKE_TEST_ONLY");
});
test("a balance-only voucher survives backup validation", () => {
  const wallet = {
    version: 1,
    vouchers: [
      {
        id: "test",
        name: "balance only",
        amount: null,
        balance: 97.35,
        stores: [],
        history: [],
      },
    ],
    branches: [],
  };
  assert.equal(validateBackup(wallet).vouchers[0].amount, null);
});
import {
  getProduct,
  applyCatalog,
  clearCatalogAssociation,
  merchantIndex,
} from "../src/catalog.mjs";

test("Multipass message extracts a synthetic code and cashier directions without guessing product eligibility", () => {
  const v = extractVoucher(
    "קוד מולטיפאס: 9000000000001\nלינק לצפייה בכרטיס: [לכרטיס](https://mycards.mltp.co.il/FAKE_TEST_ONLY)\nהנחיות לקופאי/ת: תשלום אחר > מולטיפאס, ולהקליד את הקוד.",
  );
  assert.equal(v.code, "9000000000001");
  assert.equal(v.paymentProvider, "מולטיפאס");
  assert.equal(v.issuer, "");
  assert.equal(v.voucherProductId, "");
  assert.equal(v.link, "https://mycards.mltp.co.il/FAKE_TEST_ONLY");
  assert.ok(v.cashierInstructions.includes("תשלום אחר"));
  assert.equal(v.amount, "");
  assert.equal(v.expiry, "");
  assert.deepEqual(v.stores, []);
});
test("private URL alone identifies the platform, never a token, balance or product", () => {
  const v = extractVoucher("https://mycards.mltp.co.il/SwishPremiumFAKE");
  assert.equal(v.paymentProvider, "מולטיפאס");
  assert.equal(v.voucherProductId, "");
  assert.equal(v.code, "");
  assert.equal(v.amount, "");
});
test("Swish Premium and historical Rainbow alias map to one product without a personal expiration date", () => {
  for (const input of [
    "swish premium&#x20;",
    "נופשונית Rainbow",
    "סוויש פרימיום",
    "https://swish.co.il/benefitPage/104068?isInformative=true",
  ]) {
    const v = extractVoucher(input);
    assert.equal(v.voucherProductId, "swish-premium");
    assert.equal(v.issuer, "Swish");
    assert.equal(v.expiry, "");
    assert.deepEqual(v.stores, []);
  }
});
test("generic Swish, Plus, mixed recommendations and spoofed domains do not identify Premium", () => {
  for (const input of [
    "Swish",
    "Swish Plus",
    "Swish Plus — ראו גם Swish Premium",
    "https://swish.co.il.evil.example/benefitPage/104068",
    "https://example.com/?next=https%3A%2F%2Fswish.co.il%2FbenefitPage%2F104068",
  ])
    assert.equal(identifyProvider(input).voucherProductId, "");
});
test("DREAMCARD needs a variant; bare code prefixes do not establish eligibility", () => {
  for (const input of [
    "dreamcard",
    "DREAM CARD קוד: 876500000000",
    "DREAM CARD קוד: 123400000000",
    "https://www.dcgift.co.il/paybox",
  ]) {
    const v = extractVoucher(input);
    assert.equal(v.issuer, "DREAM CARD");
    assert.equal(v.voucherProductId, "");
    assert.deepEqual(v.stores, []);
  }
});
test("Markdown links and HTML ampersands are normalized", () => {
  assert.deepEqual(
    extractLinks(
      "[https://example.com/card](https://example.com/card?a=1&amp;b=2)",
    ),
    ["https://example.com/card?a=1&b=2"],
  );
});
test("catalogs keep DREAMCARD variants separate", () => {
  assert.equal(getProduct("dreamcard-paybox-all").merchants.length, 20);
  assert.deepEqual(
    getProduct("dreamcard-paybox-sport").merchants.map((m) => m.name),
    ["NIKE", "FOOT LOCKER", "CONVERSE", "BILLABONG"],
  );
  assert.equal(getProduct("dreamcard-paybox-baby").merchants.length, 4);
  assert.equal(getProduct("dreamcard-praxell-no-sales").merchants.length, 12);
});
test("confirmed import is idempotent; changing the product clears imported eligibility but keeps manual stores", () => {
  const fields = {
    voucherProductId: "dreamcard-paybox-sport",
    stores: "חנות ידנית",
  };
  const imported = applyCatalog(fields);
  assert.equal(imported.stores.split(", ").length, 5);
  assert.deepEqual(applyCatalog(imported), imported);
  const cleared = clearCatalogAssociation(imported);
  assert.equal(cleared.stores, "חנות ידנית");
  assert.equal(cleared.storesSourceProductId, "");
});
test("Swish directory records the public source and online entries do not become physical branches", () => {
  const product = getProduct("swish-premium");
  assert.ok(product.merchants.length > 1000);
  assert.ok(product.sourceUrl.startsWith("https://swish.co.il/"));
  const index = merchantIndex([
    {
      storesSourceProductId: product.id,
      stores: product.merchants.map((m) => m.name),
    },
  ]);
  assert.equal(index.get("פוקס הום אונליין").channel, "online");
  assert.ok(
    index.get("סופר פארם").categories.includes("רשתות שיווק מזון ופארמה"),
  );
  assert.ok(
    product.merchants.every((m) => m.lat === undefined && m.lng === undefined),
  );
});
test("new provider metadata in backups is validated", () => {
  assert.throws(() =>
    validateBackup({
      version: 1,
      vouchers: [
        {
          id: "fake",
          name: "test",
          amount: 5,
          balance: 5,
          stores: [],
          history: [],
          cashierInstructions: { bad: true },
        },
      ],
      branches: [],
    }),
  );
});

test("Dream Card categories reuse public tags without borrowing eligibility or online channels", () => {
  const product = getProduct("dreamcard-multipass-include");
  assert.equal(
    product.merchants.find((m) => m.name === "FOX HOME").category,
    "הכל לבית",
  );
  assert.equal(
    product.merchants.find((m) => m.name === "FOOT LOCKER").category,
    "אופנה ולייף סטייל",
  );
  assert.equal(
    product.merchants.find((m) => m.name === "FOOT LOCKER").channel,
    "listed",
  );
  assert.ok(!product.merchants.some((m) => m.name === "פוט לוקר אונליין"));
});
