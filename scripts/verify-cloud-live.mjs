// Creates synthetic test data only; never load the user's local-import endpoint.
import { chromium, expect } from "@playwright/test";
import { walletCredentials } from "../src/cloud-crypto.mjs";
import { writeFile } from "node:fs/promises";
const url = process.env.SYNC_TEST_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
try {
  const a = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    b = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  for (const context of [a, b])
    await context.route("**/__local/wallet-import", (r) =>
      r.fulfill({ status: 404, body: "" }),
    );
  const first = await a.newPage(),
    second = await b.newPage();
  await first.goto(url);
  await first
    .getByRole("button", { name: "הארנק והמכשיר", exact: true })
    .click();
  await first
    .getByRole("button", { name: "יצירת ארנק מסונכרן מהשוברים שלי" })
    .click();
  await expect(
    first.getByRole("region", { name: "סנכרון בין מכשירים" }),
  ).toContainText("נשמר בענן", { timeout: 40000 });
  await first
    .getByRole("button", { name: "הצגת מפתח לחיבור מכשיר נוסף" })
    .click();
  const secret = await first
    .getByLabel("מפתח הארנק שלך", { exact: true })
    .inputValue();
  const { id } = await walletCredentials(secret);
  await writeFile(".local/cloud-browser-test-id.txt", id);
  await second.goto(url);
  await second
    .getByRole("button", { name: "הארנק והמכשיר", exact: true })
    .click();
  await second.getByLabel("מפתח מארנק קיים").fill(secret);
  await second.getByRole("checkbox").check();
  await second
    .getByRole("button", { name: "חיבור לארנק קיים", exact: true })
    .click();
  await expect(
    second.getByRole("region", { name: "סנכרון בין מכשירים" }),
  ).toContainText("נשמר בענן", { timeout: 40000 });
  await first.getByRole("button", { name: /^הארנק שלי/ }).click();
  await first.getByRole("button", { name: "הוספת שובר", exact: true }).click();
  await first
    .getByLabel("שם השובר *", { exact: true })
    .fill("בדיקת ענן סינתטית");
  await first.getByLabel("יתרה נוכחית").fill("100");
  await first.getByRole("button", { name: "שמירת השובר בארנק" }).click();
  await expect(first.getByRole("dialog")).not.toBeVisible({ timeout: 40000 });
  await second
    .getByRole("button", { name: "רענון מהענן", exact: true })
    .click();
  await expect(
    second.getByRole("button", { name: /^הארנק שלי/ }),
  ).toContainText("1", { timeout: 40000 });
  await second.getByRole("button", { name: /^הארנק שלי/ }).click();
  await second.locator(".voucher-card").click();
  await second.getByLabel("מימשת חלק מהשובר? כמה שילמת?").fill("20");
  await second.getByRole("button", { name: "עדכון היתרה" }).click();
  await expect(second.locator(".detail-ticket>strong")).toContainText("80", {
    timeout: 40000,
  });
  await first.reload();
  await expect(first.locator(".voucher-card")).toContainText("80", {
    timeout: 40000,
  });
  await a.setOffline(true);
  await first.locator(".voucher-card").click();
  await first.getByLabel("מימשת חלק מהשובר? כמה שילמת?").fill("10");
  await first.getByRole("button", { name: "עדכון היתרה" }).click();
  await expect(first.locator(".detail-ticket>strong")).toContainText("80");
  console.log(
    "LIVE PASS: two browsers create/join, add voucher, update balance, reload, and no offline balance mutation.",
  );
} finally {
  await browser.close();
}
