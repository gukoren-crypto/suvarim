// Fetches the public product directory only. No personal card URLs, codes or login.
import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
const sourceUrl =
  "https://swish.co.il/home/family-time-giftcard/product-104068?isInformative=true";
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {},
);
try {
  const page = await browser.newPage();
  await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page
    .getByText("לרשימה המלאה", { exact: true })
    .click({ timeout: 20000 });
  await page.getByText("רשתות שיווק מזון ופארמה", { exact: true }).waitFor();
  const merchants = await page
    .locator(".chain-item-wrapper")
    .evaluateAll((items) =>
      items.map((item) => {
        let group = item.parentElement;
        while (group && !group.querySelector(".header-chains-container"))
          group = group.parentElement;
        const category =
          group
            ?.querySelector(".header-chains-container")
            ?.textContent?.trim() || "";
        return {
          id: item.querySelector("img")?.id || "",
          name:
            item.querySelector(".store-name-text")?.textContent?.trim() || "",
          category,
          channel: category === "רכישה אונליין" ? "online" : "listed",
        };
      }),
    );
  if (
    merchants.length < 100 ||
    merchants.some((m) => !m.id || !m.name || !m.category)
  )
    throw new Error(
      "Directory structure changed; the previous snapshot was not overwritten.",
    );
  const unique = [
    ...new Map(merchants.map((m) => [`${m.id}:${m.category}`, m])).values(),
  ];
  const snapshot = {
    productId: "swish-premium",
    sourceUrl,
    checkedAt: new Date().toISOString(),
    scope:
      "Public product directory; no branch addresses or individual-card verification.",
    merchants: unique,
  };
  await mkdir("src/data", { recursive: true });
  await writeFile(
    "src/data/swish-premium.json",
    JSON.stringify(snapshot, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      entries: unique.length,
      uniqueNames: new Set(unique.map((m) => m.name)).size,
      categories: [...new Set(unique.map((m) => m.category))],
    }),
  );
} finally {
  await browser.close();
}
