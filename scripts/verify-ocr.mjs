import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173");
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 450;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1200, 450);
    ctx.fillStyle = "black";
    ctx.font = "52px Arial";
    ["BUYME", "Value: 250", "Code: ABCD1234", "Expires: 31/12/2029"].forEach(
      (line, i) => ctx.fillText(line, 60, 85 + i * 90),
    );
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByRole("button", { name: "הוספת שובר", exact: true }).click();
  await page.getByRole("button", { name: "תמונה", exact: true }).click();
  await page
    .locator(".upload-zone input")
    .setInputFiles({
      name: "sample-voucher.png",
      mimeType: "image/png",
      buffer: Buffer.from(image, "base64"),
    });
  await page.waitForFunction(
    () => !document.querySelector(".scan-status"),
    {},
    { timeout: 150000 },
  );
  const error = await page.locator(".error-box").allTextContents();
  const amount = await page.getByLabel("סכום מקורי").inputValue();
  const code = await page.getByLabel("קוד מימוש", { exact: true }).inputValue();
  if (amount !== "250" || code !== "ABCD1234")
    throw new Error(JSON.stringify({ amount, code, error }));
  console.log("OCR verified in browser: value 250, code ABCD1234.");
} finally {
  await browser.close();
}
