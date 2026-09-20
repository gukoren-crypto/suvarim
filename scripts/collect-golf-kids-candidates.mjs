// Public Golf Kids locator only. Writes candidates, never the published catalog.
import { readFile, writeFile, rename } from 'node:fs/promises';
const baseline = JSON.parse(await readFile(new URL('./data/golf-kids-round3-reviewed.json', import.meta.url), 'utf8'));
const sourceUrl = baseline.sourceUrl;
const checkedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw Error(`Official source HTTP ${response.status}`);
const html = await response.text();
const clean = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
const field = (s, re) => { const m = s.match(re); if (!m) throw Error('Locator structure changed; candidate preserved'); return m[1]; };
const rows = [...html.matchAll(/<li class="store ([\s\S]*?)<\/li>/g)].map(m => {
  const s = m[1];
  return {
    id: field(s, /\/stores\/store\/(\d+)/),
    name: clean(field(s, /<div class="store_title"[^>]*>([\s\S]*?)<\/div>/)),
    city: clean(field(s, /<span class="city">([\s\S]*?)<\/span>/)),
    address: clean(field(s, /<span class="street">([\s\S]*?)<span class="comma">/)),
    lat: Number(field(s, /data-latitude="([^"]*)/)),
    lng: Number(field(s, /data-longitude="([^"]*)/)),
  };
});
if (rows.length < baseline.examined || new Set(rows.map(r => r.id)).size !== rows.length ||
    baseline.reviewed.some(old => !rows.some(row => row.id === old.id)))
  throw Error('Incomplete or duplicate source; candidate preserved');
const branches = [], skipped = [], store = 'GOLF KIDS';
for (const row of rows) {
  const old = baseline.reviewed.find(r => r.id === row.id);
  if (old && JSON.stringify(old) !== JSON.stringify(row))
    throw Error(`Official row ${row.id} changed; review before replacing candidates`);
  const reason = baseline.exclusions[row.id] || (!old ? 'new-location-needs-review' : null);
  if (reason) { skipped.push({ officialId: row.id, name: row.name, city: row.city, reason }); continue; }
  if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng) || row.lat < 29 || row.lat > 34 || row.lng < 34 || row.lng > 36.5)
    throw Error(`Invalid coordinate ${row.id}`);
  // Source typo would split the city filter; preserve original in reviewed baseline.
  const city = row.id === '390' && row.city === 'רמת הההשרון' ? 'רמת השרון' : row.city;
  branches.push({ ...row, city, id: `golf-kids-${row.id}`, store, sourceUrl, coordinateSourceUrl: sourceUrl, checkedAt, locationAccuracy: 'address-or-venue' });
}
const reviewedIncluded = baseline.reviewed.filter(r => !baseline.exclusions[r.id]).length;
if (branches.length !== reviewedIncluded) throw Error('Reviewed location missing; candidate preserved');
branches.sort((a, b) => a.id.localeCompare(b.id));
const output = { store, branches, source: {
  store, aliases: ['GOLF KIDS', 'Golf Kids', 'גולף קידס'], sourceUrl, checkedAt,
  examined: rows.length, included: branches.length, coverage: 'partial',
  note: 'מיקומים מפורשים ברשימת הסניפים הרשמית של GOLF KIDS שהוצלבו ברמת המתחם. קואורדינטות הפוכות או אפס לא תוקנו; ירידים, עודפים, כפילויות ומיקומים שלא אומתו נשארו להשלמה. זוהי רשת נפרדת מגולף וגולף אנד קו. רישום מיקום אינו הוכחת זכאות לשובר.',
  skipped,
} };
const target = new URL('../candidates/golf-kids-round3.json', import.meta.url);
const temp = new URL('../candidates/golf-kids-round3.json.tmp', import.meta.url);
await writeFile(temp, JSON.stringify(output, null, 2) + '\n');
await rename(temp, target);
console.log(JSON.stringify({ store, examined: rows.length, included: branches.length, skipped: skipped.length }));
