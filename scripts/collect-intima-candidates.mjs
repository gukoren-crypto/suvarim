// Public official Intima locator. Writes only isolated candidates.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const baseline = JSON.parse(await readFile(new URL('./data/intima-round4-reviewed.json', import.meta.url), 'utf8'));
const sourceUrl = baseline.sourceUrl;
const checkedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw Error(`Official source HTTP ${response.status}`);
const html = await response.text();
const clean = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
const field = (s, re) => { const m = s.match(re); if (!m) throw Error('Locator structure changed; candidate preserved'); return m[1]; };
const rows = [...html.matchAll(/<li class="store ([\s\S]*?)<\/li>/g)].map(m => {
  const s = m[1];
  const row = {
    id: s.match(/post="(\d+)"/)?.[1],
    name: clean(field(s, /<div class="store_title"[^>]*>([\s\S]*?)<\/div>/)),
    city: clean(field(s, /<span class="city">([\s\S]*?)<\/span>/)),
    address: clean(field(s, /<span class="street">([\s\S]*?)<span class="comma">/)),
    lat: field(s, /data-latitude="([^"]*)/),
    lng: field(s, /data-longitude="([^"]*)/),
  };
  if (!row.id) row.id = 'unlinked-' + createHash('sha256').update([row.name, row.city, row.address].join('|')).digest('hex').slice(0, 12);
  return row;
});
if (rows.length < baseline.examined || new Set(rows.map(r => r.id)).size !== rows.length ||
    baseline.reviewed.some(old => !rows.some(row => row.id === old.id)))
  throw Error('Incomplete or duplicate source; candidate preserved');
const branches = [], skipped = [], store = 'אינטימה';
for (const row of rows) {
  const old = baseline.reviewed.find(r => r.id === row.id);
  if (old && ['id', 'name', 'city', 'address', 'lat', 'lng'].some(k => old[k] !== row[k]))
    throw Error(`Official row ${row.id} changed; review before replacing candidates`);
  const reason = baseline.exclusions[row.id] || (!old ? 'new-location-needs-review' : null);
  if (reason) { skipped.push({ officialId: row.id, name: row.name, city: row.city, reason }); continue; }
  const lat = Number(row.lat), lng = Number(row.lng);
  if (!row.lat || !row.lng || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 29 || lat > 34 || lng < 34 || lng > 36.5)
    throw Error(`Invalid coordinate ${row.id}`);
  branches.push({ ...row, id: `intima-${row.id}`, lat, lng, store, sourceUrl, coordinateSourceUrl: sourceUrl, checkedAt, locationAccuracy: 'address-or-venue' });
}
if (branches.length !== baseline.reviewed.filter(r => !baseline.exclusions[r.id]).length)
  throw Error('Reviewed location missing; candidate preserved');
branches.sort((a, b) => a.id.localeCompare(b.id));
const output = { store, branches, source: {
  store, aliases: ['אינטימה', 'INTIMA', 'Intima'], sourceUrl, checkedAt,
  examined: rows.length, included: branches.length, coverage: 'partial',
  note: 'מיקומים מפורשים לכל סניף מתוך רשימת אינטימה הרשמית, עם הצלבת שם המתחם או כתובת. קואורדינטות הפוכות וחסרות לא תוקנו או הושלמו. עודפים ומיקומים ללא הצלבה מספקת נשמרו לבדיקה; רישום מיקום אינו הוכחת זכאות לשובר.',
  skipped,
} };
const target = new URL('../candidates/intima-round4.json', import.meta.url);
const temp = new URL('../candidates/intima-round4.json.tmp', import.meta.url);
await writeFile(temp, JSON.stringify(output, null, 2) + '\n');
await rename(temp, target);
console.log(JSON.stringify({ store, examined: rows.length, included: branches.length, skipped: skipped.length }));
