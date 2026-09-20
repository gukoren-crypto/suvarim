// Official public CASTRO locator -> candidates only. Never modifies published data.
// Optional --html <downloaded locator> permits repeatable offline parser review.
import { readFile, writeFile, rename } from "node:fs/promises";
const sourceUrl = "https://www.castro.com/stores";
const store = "קסטרו";
const baseline = JSON.parse(await readFile(new URL("./data/castro-round2-reviewed.json", import.meta.url), "utf8"));
const input = process.argv.indexOf("--html");
const checkedAt = input >= 0 ? baseline.checkedAt : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
let html;
if (input >= 0) html = await readFile(process.argv[input + 1], "utf8");
else {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`Official locator HTTP ${response.status}`);
  html = await response.text();
}
const clean = (s) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim().replace(/,$/, "");
const rows = html.split(/<li class="store /).slice(1).map((s) => ({
  officialId: s.match(/post="(\d+)"/)?.[1],
  name: clean(s.match(/<h2>(.*?)<\/h2>/s)?.[1] || ""),
  city: clean(s.match(/<span class="city">(.*?)<\/span>/s)?.[1] || ""),
  address: clean(s.match(/<span class="street">(.*?)<\/span>/s)?.[1] || ""),
  waze: s.match(/href="(waze:[^"]+)"/)?.[1]?.replace(/&amp;/g, "&"),
}));
if (rows.length < baseline.examined || rows.some((r) => !r.officialId || !r.name || !r.city || !r.address) || new Set(rows.map((r) => r.officialId)).size !== rows.length)
  throw Error("Incomplete or changed locator structure; previous candidates preserved");
const branches = [], skipped = [];
for (const row of rows) {
  const reviewed = baseline.reviewed.find((r) => r.officialId === row.officialId);
  const excluded = baseline.skipped.find((r) => r.officialId === row.officialId);
  if (!reviewed) {
    skipped.push({ ...row, reason: excluded?.reason || "new-location-needs-review" });
    continue;
  }
  for (const field of ["name", "city", "address", "waze"])
    if (row[field] !== reviewed[field]) throw Error(`Reviewed location changed: ${row.officialId} ${field}`);
  const target = new URL(row.waze);
  const [lat, lng] = (target.searchParams.get("ll") || "").split(",").map(Number);
  if (target.protocol !== "waze:" || target.searchParams.get("navigate") !== "yes" || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 29 || lat > 34 || lng < 34 || lng > 36.5)
    throw Error(`Invalid explicit navigation destination: ${row.officialId}`);
  branches.push({ id: `castro-${row.officialId}`, store, name: row.name, city: row.city,
    address: `${row.address}, ${row.city}`, lat, lng, sourceUrl,
    coordinateSourceUrl: sourceUrl, checkedAt, locationAccuracy: "address-or-venue" });
}
if (branches.length !== baseline.reviewed.length || new Set(branches.map((b) => `${b.lat},${b.lng}`)).size !== branches.length)
  throw Error("Reviewed location missing or duplicated; previous candidates preserved");
branches.sort((a, b) => a.id.localeCompare(b.id));
const output = { store, branches, source: {
  store, aliases: ["קסטרו", "CASTRO", "Castro"], sourceUrl, checkedAt,
  examined: rows.length, included: branches.length, coverage: "partial",
  note: "יעדי ניווט Waze מפורשים מדף הסניפים הרשמי; נבדקה התאמה לעיר ולמתחם מול מיקומים שכבר נבדקו. מחלקות באותו מתחם אוחדו למיקום אחד. עודפים, חנות לעובדים בלבד, יעד חשוד ומיקומים הדורשים בדיקה נוספת לא צורפו. אין ברשומה הוכחה לזכאות לשובר, והכיסוי חלקי.",
  skipped,
} };
const target = new URL("../candidates/castro-round2.json", import.meta.url);
const temporary = new URL("../candidates/castro-round2.json.tmp", import.meta.url);
await writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporary, target);
console.log(JSON.stringify({ store, examined: rows.length, included: branches.length, skipped: skipped.length }));
