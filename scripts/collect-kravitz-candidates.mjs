// Public official Kravitz -> Stockist branch data -> candidates only.
import { readFile, writeFile, rename } from 'node:fs/promises';
const baseline = JSON.parse(await readFile(new URL('./data/kravitz-round6-reviewed.json', import.meta.url), 'utf8'));
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || new URL(response.url).origin !== new URL(url).origin) throw Error(`Official source unavailable: ${url}`);
  return response.text();
}
const html = await get(baseline.sourceUrl);
if (!html.includes(baseline.officialEmbedEvidence)) throw Error('Official locator widget changed; previous candidates preserved');
const configText = await get(baseline.widgetConfigurationUrl);
const configMatch = configText.match(/_stockistConfigCallback_map_pqkngpy3\(([\s\S]*)\);?\s*$/);
if (!configMatch) throw Error('Public widget configuration changed');
const config = JSON.parse(configMatch[1]);
if (config.tag !== baseline.widgetId || config.max_results !== baseline.configuredMaxResults) throw Error('Public widget scope changed');
const data = JSON.parse(await get(baseline.coordinateSourceUrl));
if (!Array.isArray(data.locations)) throw Error('Public locator response changed');
const rows = data.locations.map(r => ({ id: r.id, name: r.name, city: r.city, address: r.address_line_1,
  lat: Number(r.latitude), lng: Number(r.longitude), website: r.website }));
if (rows.length < baseline.examined || rows.length >= config.max_results || rows.some(r => !r.id || !r.name) || new Set(rows.map(r => r.id)).size !== rows.length)
  throw Error('Incomplete, capped or duplicate source; previous candidates preserved');
const store = 'קרביץ';
const checkedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const branches = [], skipped = [];
for (const row of rows) {
  const reviewed = baseline.reviewed.find(r => r.id === row.id);
  if (!reviewed) {
    const excluded = baseline.skipped.find(r => r.id === row.id);
    skipped.push({ officialId: row.id, name: row.name, city: row.city || '', address: row.address || '', reason: excluded?.reason || 'new-location-needs-review' });
    continue;
  }
  if (JSON.stringify(reviewed) !== JSON.stringify(row)) throw Error(`Reviewed location changed: ${row.id}`);
  if (!row.city || !row.address || !Number.isFinite(row.lat) || !Number.isFinite(row.lng) || row.lat < 29 || row.lat > 34 || row.lng < 34 || row.lng > 36.5 || new URL(row.website).origin !== 'https://www.kravitz.co.il')
    throw Error(`Invalid reviewed location: ${row.id}`);
  branches.push({ id: `kravitz-${row.id}`, store, name: row.name, city: row.city, address: row.address, lat: row.lat, lng: row.lng,
    sourceUrl: row.website, coordinateSourceUrl: baseline.coordinateSourceUrl, checkedAt, locationAccuracy: 'address-or-venue' });
}
if (branches.length !== baseline.reviewed.length || new Set(branches.map(b => `${b.lat},${b.lng}`)).size !== branches.length)
  throw Error('Missing or duplicate reviewed location; previous candidates preserved');
branches.sort((a, b) => a.id.localeCompare(b.id));
const output = { store, branches, source: {
  store, aliases: ['קרביץ', 'KRAVITZ', 'Kravitz'], sourceUrl: baseline.sourceUrl, checkedAt,
  examined: rows.length, included: branches.length, coverage: 'partial',
  note: 'קואורדינטות של רשומות סניפים מווידג׳ט Stockist המוטמע באתר קרביץ הרשמי, לאחר התאמת העיר והמתחם או הכתובת. מזהה הווידג׳ט וקישור השירות הציבורי נשמרו לביקורת. לא נעשה שימוש במרכז המפה או במרכז שאילתת החיפוש כיעד. רשומות חסרות או סותרות נשארו לבדיקה; הכיסוי חלקי ואינו הוכחה לזכאות לשובר.',
  skipped,
} };
const target = new URL('../candidates/kravitz-round6.json', import.meta.url);
const temp = new URL('../candidates/kravitz-round6.json.tmp', import.meta.url);
await writeFile(temp, JSON.stringify(output, null, 2) + '\n');
await rename(temp, target);
console.log(JSON.stringify({ store, examined: rows.length, included: branches.length, skipped: skipped.length }));
