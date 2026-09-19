// Official locator only. !3d/!4d is the destination; @lat,lng is a map viewport
// and must NEVER be treated as a store location. Baselines require manual review.
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const sourceUrl = "https://footlocker.co.il/pages/branches";
const { reviewed, exclusions } = JSON.parse(
  await readFile(
    new URL("./data/footlocker-reviewed.json", import.meta.url),
    "utf8",
  ),
);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
let rows;
try {
  const p = await browser.newPage();
  await p.goto(sourceUrl, { waitUntil: "domcontentloaded" });
  await p.locator(".boa-branch-item").first().waitFor();
  rows = await p
    .locator(".boa-branch-item")
    .evaluateAll((es) =>
      es.map((e) => ({
        city: e.dataset.city.trim(),
        name: e
          .querySelector(".content-start-text p:nth-of-type(2)")
          ?.textContent.trim(),
        address: e.querySelector(".branch-item-nav p")?.textContent.trim(),
        url: e.querySelector(".branch-item-nav")?.href,
        excluded: /עודפים|סגור זמנית/.test(e.innerText),
      })),
    );
} finally {
  await browser.close();
}
if (rows.length < reviewed.length)
  throw Error("Incomplete locator; prior snapshot preserved");
const accepted = [],
  skipped = [],
  checkedAt = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jerusalem",
  });
for (const r of rows) {
  const expected = reviewed.find((e) => e.city === r.city && e.name === r.name),
    coords = r.url?.match(/!3d([-\d.]+)!4d([-\d.]+)/);
  let reason = r.excluded
    ? "outlet-or-closed"
    : exclusions[r.name] ||
      (!coords ? "no-explicit-destination" : !expected ? "needs-review" : "");
  const lat = Number(coords?.[1]),
    lng = Number(coords?.[2]);
  if (
    !reason &&
    (!/^https:\/\/(www\.)?google\.com\/maps\/place\//.test(r.url) ||
      !r.address ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 29 ||
      lat > 34 ||
      lng < 34 ||
      lng > 36.5 ||
      Math.hypot((lat - expected.lat) * 111, (lng - expected.lng) * 94) > 0.15)
  )
    reason = "source-changed-review";
  if (reason) {
    skipped.push({ city: r.city, name: r.name, reason });
    continue;
  }
  accepted.push({
    id:
      "footlocker-" +
      createHash("sha256")
        .update(`${r.city}|${r.name}`)
        .digest("hex")
        .slice(0, 12),
    store: "פוט לוקר",
    name: r.name,
    city: r.city,
    address: r.address,
    lat,
    lng,
    sourceUrl,
    coordinateSourceUrl: r.url,
    checkedAt,
    locationAccuracy: "address-or-venue",
  });
}
if (
  accepted.length !== reviewed.length ||
  new Set(accepted.map((b) => b.id)).size !== accepted.length
)
  throw Error("Reviewed source changed; prior snapshot preserved");
const target = new URL("../src/data/branches.json", import.meta.url),
  registryTarget = new URL("../src/data/branch-sources.json", import.meta.url);
const previous = JSON.parse(await readFile(target, "utf8")),
  registry = JSON.parse(await readFile(registryTarget, "utf8"));
const merged = [
  ...previous.filter((b) => !b.id.startsWith("footlocker-")),
  ...accepted,
];
registry.sources = [
  ...registry.sources.filter((s) => s.store !== "פוט לוקר"),
  {
    store: "פוט לוקר",
    aliases: ["פוט לוקר", "FOOT LOCKER"],
    sourceUrl,
    checkedAt,
    examined: rows.length,
    included: accepted.length,
    coverage: "partial",
    note: "נקודות יעד מפורשות בקישורי המפה של הרשת, ברמת כתובת או מתחם. קישורי חיפוש, עסקים אחרים, מיקומים סותרים וסניפים הדורשים בירור הושמטו.",
    skipped,
  },
];
await writeFile(target, JSON.stringify(merged, null, 2) + "\n");
await writeFile(registryTarget, JSON.stringify(registry, null, 2) + "\n");
console.log({
  included: accepted.length,
  skipped: skipped.length,
  total: merged.length,
});
