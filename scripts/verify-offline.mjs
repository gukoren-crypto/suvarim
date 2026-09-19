import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole("button", { name: "הוספת שובר", exact: true }).click();
  await page
    .getByLabel("שם השובר *", { exact: true })
    .fill("שובר שנשמר ללא רשת");
  await page.getByLabel("סכום מקורי").fill("125");
  await page.getByLabel("יתרה נוכחית").fill("125");
  await page.getByRole("button", { name: "שמירת השובר בארנק" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".voucher-card")).toContainText(
    "שובר שנשמר ללא רשת",
  );
  console.log("Production offline reload verified with persisted voucher.");
} finally {
  await browser.close();
}
