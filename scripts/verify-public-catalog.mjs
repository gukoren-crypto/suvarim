// Verify a production build using an isolated browser and synthetic vouchers only.
import { chromium, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { branchesForStores } from "../src/branches.mjs";
const target = process.argv[2];
if (!target || !/^https?:\/\//.test(target))
  throw Error("Usage: node scripts/verify-public-catalog.mjs https://host/base/");
const catalog = JSON.parse(await readFile("src/data/branches.json", "utf8"));
const stores = [...new Set(catalog.map((b) => b.store))];
const expected = branchesForStores(stores, [], catalog).length;
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
try {
  const page = await browser.newPage();
  await page.route("**/__local/wallet-import", (r) => r.fulfill({ status: 404 }));
  await page.goto(target);
  await expect(page.locator(".voucher-card")).toHaveCount(0);
  await page.getByRole("button", { name: "הארנק והמכשיר", exact: true }).click();
  const vouchers = stores.map((store, i) => ({
    id: `public-catalog-check-${i}`, name: `בדיקת מפה ${store}`,
    issuer: "נתוני דמה", amount: 1, balance: 1, expiry: "",
    stores: [store], history: [],
  }));
  await page.locator("input[type=file]").setInputFiles({
    name: "synthetic-catalog-check.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, vouchers, branches: [] })),
  });
  await page.getByRole("button", { name: "החלפה ושחזור" }).click();
  await page.getByRole("button", { name: "על המפה", exact: true }).click();
  await expect(page.locator(".branch-card")).toHaveCount(expected);
  const counts = {};
  for (const [i, store] of stores.entries()) {
    const count = branchesForStores([store], [], catalog).length;
    await page.getByLabel("חנויות לפי שובר", { exact: true })
      .selectOption(`public-catalog-check-${i}`);
    await expect(page.locator(".branch-card")).toHaveCount(count);
    counts[store] = count;
  }
  console.log(JSON.stringify({ target, uniqueLocations: expected, voucherFilters: counts }));
} finally {
  await browser.close();
}
