// Collect public American Eagle locator candidates; NEVER edits published data.
// Only reviewed branches with official ClothingStore JSON-LD coordinates qualify.
// Viewport coordinates, inferred geocodes and automatic corrections are not used.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";

const origin = "https://storelocations.ae.com";
const store = "אמריקן איגל";
const baseline = JSON.parse(
  await readFile(
    new URL("./data/new-chain-american-eagle-reviewed.json", import.meta.url),
    "utf8",
  ),
);
const checkedAt = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Jerusalem",
});
const cache = new Map();
async function load(slug) {
  const url = new URL(slug, `${origin}/`);
  if (url.origin !== origin || !url.pathname.startsWith("/il"))
    throw Error("Unexpected locator URL");
  if (cache.has(url.href)) return cache.get(url.href);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok)
    throw Error(`Official locator returned ${response.status}: ${url.href}`);
  const html = await response.text();
  const props = html.match(
    /pageProps: JSON.parse\(decodeURIComponent\("([^"]+)"/,
  );
  if (!props) throw Error(`Locator structure changed: ${url.href}`);
  const document = JSON.parse(decodeURIComponent(props[1])).document;
  const schemas = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ].flatMap((m) => {
    const data = JSON.parse(m[1]);
    return data["@graph"] || [data];
  });
  const result = { document, schemas, url: url.href };
  cache.set(url.href, result);
  return result;
}
async function boundedMap(rows, fn) {
  const result = [];
  for (let i = 0; i < rows.length; i += 3)
    result.push(...(await Promise.all(rows.slice(i, i + 3).map(fn))));
  return result;
}
const root = await load("il");
const states = await boundedMap(root.document.dm_directoryChildren, (r) =>
  load(r.slug),
);
const cities = await boundedMap(
  states.flatMap((s) => s.document.dm_directoryChildren),
  (r) => load(r.slug),
);
const rows = cities.flatMap((c) => c.document.dm_directoryChildren);
if (rows.length < baseline.reviewed.length)
  throw Error("Incomplete locator; candidate file preserved");
const branches = [],
  skipped = [];
for (const row of rows) {
  const officialId = row.slug.split("/").at(-1).split("-")[0];
  const reviewed = baseline.reviewed.find((r) => r.officialId === officialId);
  const excluded = baseline.exclusions[officialId];
  if (!reviewed || excluded) {
    skipped.push({
      city: row.address?.city || "",
      name: row.address?.extraDescription || row.name,
      reason: excluded || "new-location-needs-review",
    });
    continue;
  }
  const { document, schemas, url } = await load(row.slug);
  const schema = schemas.find((s) => s["@type"] === "ClothingStore");
  const lat = Number(schema?.geo?.latitude),
    lng = Number(schema?.geo?.longitude);
  const addressFields = ["city", "line1", "extraDescription", "countryCode"];
  if (
    row.slug !== reviewed.slug ||
    !document.c_atThisLocationLine1BrandLinks?.includes("AE") ||
    !schema ||
    schema.address?.addressCountry !== "IL" ||
    addressFields.some(
      (key) => document.address?.[key] !== reviewed.sourceAddress[key],
    ) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 29 ||
    lat > 34 ||
    lng < 34 ||
    lng > 36.5 ||
    Math.hypot((lat - reviewed.lat) * 111, (lng - reviewed.lng) * 94) > 0.05 ||
    /outlet|closed|עודפים|סגור/i.test(
      `${document.name} ${document.address?.extraDescription}`,
    )
  ) {
    throw Error(
      `Reviewed branch changed; review before publishing: ${officialId}`,
    );
  }
  branches.push({
    id: `american-eagle-${createHash("sha256").update(officialId).digest("hex").slice(0, 12)}`,
    store,
    name: reviewed.name,
    city: reviewed.city,
    address: `${document.address.line1}, ${reviewed.city}`,
    lat,
    lng,
    sourceUrl: url,
    coordinateSourceUrl: url,
    checkedAt,
    locationAccuracy: "address-or-venue",
  });
}
if (
  branches.length !== baseline.reviewed.length ||
  new Set(branches.map((b) => b.id)).size !== branches.length
)
  throw Error(
    "Reviewed branch missing or duplicated; candidate file preserved",
  );
branches.sort((a, b) => a.id.localeCompare(b.id));
const output = {
  store,
  branches,
  source: {
    store,
    aliases: ["AMERICAN EAGLE", "אמריקן איגל", "American Eagle"],
    sourceUrl: baseline.sourceUrl,
    checkedAt,
    examined: rows.length,
    included: branches.length,
    coverage: "partial",
    note: "מיקומי סניפים מתוך נתוני ClothingStore הרשמיים של American Eagle בישראל. נכללו רק סניפים שנבדקה התאמת המיקום לעיר ולמרכז המסחרי; כפילויות וסתירות נשארו לבירור. הכיסוי מתייחס לרשומות במקור, ולא לכל סניפי הרשת בישראל.",
    skipped,
  },
};
const target = new URL("../candidates/new-chain.json", import.meta.url);
await mkdir(new URL("../candidates/", import.meta.url), { recursive: true });
const temporary = new URL("../candidates/new-chain.json.tmp", import.meta.url);
await writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporary, target);
console.log(
  JSON.stringify({
    store,
    examined: rows.length,
    included: branches.length,
    skipped: skipped.length,
    output: target.pathname,
  }),
);
