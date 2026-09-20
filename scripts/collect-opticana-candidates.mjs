// Bounded official detail-page collection; never writes shared catalogs.
import { readFile, writeFile, rename } from 'node:fs/promises';
const baseline = JSON.parse(await readFile(new URL('./data/opticana-round8-reviewed.json', import.meta.url), 'utf8'));
const store = 'אופטיקנה';
const checkedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const branches = [];
if (baseline.examined !== baseline.reviewed.length + baseline.skipped.length) throw Error('Invalid scope');
for (const expected of baseline.reviewed) {
  const response = await fetch(expected.sourceUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || response.url !== expected.sourceUrl) throw Error(`Official branch unavailable: ${expected.id}`);
  const html = await response.text();
  const waze = html.match(/href="(https:\/\/waze.com[^" ]*)/)?.[1];
  const destination = new URL(waze);
  const [lat, lng] = (destination.searchParams.get('ll') || '').split(',').map(Number);
  const row = {
    id: expected.id,
    name: html.match(/<h1 class="page-title">(.*?)<\/h1>/s)?.[1]?.trim(),
    city: html.match(/"addressLocality": "([^"]+)"/)?.[1],
    address: html.match(/<div class="address">.*?<h2>(.*?)<\/h2>/s)?.[1]?.trim(),
    lat, lng,
    schemaLat: Number(html.match(/"latitude": "([^"]+)"/)?.[1]),
    schemaLng: Number(html.match(/"longitude": "([^"]+)"/)?.[1]),
    waze, sourceUrl: expected.sourceUrl,
  };
  if (JSON.stringify(row) !== JSON.stringify(expected)) throw Error(`Reviewed branch changed: ${row.id}`);
  if (!row.name || !row.city || !row.address || /קאטליה|cattleya/i.test(row.name) ||
      destination.origin !== 'https://waze.com' || destination.searchParams.get('navigate') !== 'yes' ||
      !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 29 || lat > 34 || lng < 34 || lng > 36.5 ||
      lat !== row.schemaLat || lng !== row.schemaLng) throw Error(`Invalid explicit destination: ${row.id}`);
  branches.push({ id: `opticana-${row.id}`, store, name: row.name, city: row.city, address: row.address,
    lat, lng, sourceUrl: row.sourceUrl, coordinateSourceUrl: row.sourceUrl, checkedAt, locationAccuracy: 'address-or-venue' });
}
if (new Set(branches.map(b => b.id)).size !== branches.length ||
    new Set(branches.map(b => `${b.lat},${b.lng}`)).size !== branches.length) throw Error('Duplicate destination');
branches.sort((a,b) => a.id.localeCompare(b.id));
const output = { store, branches, source: { store, aliases: [store, 'OPTICANA', 'Opticana'],
  sourceUrl: baseline.sourceUrl, checkedAt, examined: baseline.examined, included: branches.length, coverage: 'partial',
  note: 'מדגם מוגבל של 14 דפי סניפים רשמיים שהתגלו בחיפוש; אינו רשימה ארצית. קואורדינטות מיעד Waze של הסניף בהסכמה עם נתוני GeoCoordinates. רשימת ברירת המחדל הציגה קאטליה ולא הוסבה לאופטיקנה. ההשמטות נבדקו בתאריך הבסיס וממתינות לבירור; אין הוכחת זכאות לשובר.',
  skipped: baseline.skipped.map(r => ({ officialId: r.id, name: r.name, city: r.city, address: r.address || '', sourceUrl: r.sourceUrl, checkedAt: baseline.checkedAt, reason: r.reason })),
} };
const target = new URL('../candidates/opticana-round8.json', import.meta.url);
const temp = new URL('../candidates/opticana-round8.json.tmp', import.meta.url);
await writeFile(temp, JSON.stringify(output, null, 2) + '\n');
await rename(temp, target);
console.log(JSON.stringify({ store, included: branches.length, examined: baseline.examined, skipped: baseline.skipped.length }));
