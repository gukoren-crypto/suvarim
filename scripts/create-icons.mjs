import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173/");
  for (const size of [192, 512]) {
    const base64 = await page.evaluate(async (size) => {
      const img = new Image();
      img.src = "/icon.svg";
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#24564b";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, size * 0.08, size * 0.08, size * 0.84, size * 0.84);
      return canvas.toDataURL("image/png").split(",")[1];
    }, size);
    await writeFile(`public/icon-${size}.png`, Buffer.from(base64, "base64"));
  }
} finally {
  await browser.close();
}
