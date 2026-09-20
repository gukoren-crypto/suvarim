// Public Golf&Co locator -> reviewed candidates only; never writes shared catalogs.
import { readFile, writeFile, rename } from 'node:fs/promises';
const baseline = JSON.parse(await readFile(new URL('./data/golf-co-round3-reviewed.json', import.meta.url), 'utf8'));
const sourceUrl = baseline.sourceUrl;
const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
if (!response.ok || new URL(response.url).hostname !== 'www.golfco.co.il') throw Error('Official locator unavailable');
const html = await response.text();
const clean = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
const all = html.split(/<li class="store /).slice(1).map(s => ({
  id: s.match(/post="(\d+)"/)?.[1],
  name: clean(s.match(/<h2>(.*?)<\/h2>/s)?.[1] || ''),
  city: clean(s.match(/<span class="city">(.*?)<\/span>/s)?.[1] || ''),
  address: clean(s.match(/<span class="street">(.*?)<span class="comma">/s)?.[1] || ''),
  lat: Number(s.match(/data-latitude="([^"]*)/)?.[1]),
  lng: Number(s.match(/data-longitude="([^"]*)/)?.[1]),
}));
// The locator mixes SABON and Golf&Co. SABON rows are not Golf&Co branches.
const rows = all.filter(r => !r.name.startsWith('SABON'));
const explicitIds = rows.map(r => r.id).filter(Boolean);
if (all.some(r => !r.name || !r.city) || rows.length < baseline.examined || new Set(explicitIds).size !== explicitIds.length)
  throw Error('Incomplete or changed locator structure; previous candidates preserved');
const store = 'גולף אנד קו';
const checkedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const branches = [], skipped = [];
for (const row of rows) {
  const reviewed = row.id && baseline.reviewed.find(r => r.id === row.id);
  if (!reviewed) {
    const excluded = baseline.skipped.find(r => row.id ? r.id === row.id : r.name === row.name && r.city === row.city && r.address === row.address);
    skipped.push({ officialId: row.id || null, name: row.name, city: row.city, address: row.address,
      reason: excluded?.reason || 'new-location-needs-review' });
    continue;
  }
  if (JSON.stringify(reviewed) !== JSON.stringify(row)) throw Error(`Reviewed row ${row.id} changed; review required`);
  if (!row.address || !Number.isFinite(row.lat) || !Number.isFinite(row.lng) || row.lat < 29 || row.lat > 34 || row.lng < 34 || row.lng > 36.5)
    throw Error(`Invalid branch ${row.id}`);
  branches.push({ ...row, id: `golf-co-${row.id}`, store, sourceUrl, coordinateSourceUrl: sourceUrl, checkedAt, locationAccuracy: 'address-or-venue' });
}
if (branches.length !== baseline.reviewed.length || new Set(branches.map(b => `${b.lat},${b.lng}`)).size !== branches.length)
  throw Error('Missing or duplicate reviewed destination; previous candidates preserved');
branches.sort((a, b) => a.id.localeCompare(b.id));
const output = { store, branches, source: {
  store, aliases: ['גולף אנד קו', 'GOLF&CO', 'GOLF & CO', 'Golf & Co'], sourceUrl, checkedAt,
  examined: rows.length, included: branches.length, coverage: 'partial',
  note: 'קואורדינטות מפורשות לכל סניף מרשימת גולף אנד קו הרשמית, לאחר התאמת עיר ומתחם. רשומות SABON הופרדו ואינן נספרות בכיסוי רשת זו. סניפים ללא מיקום, עודפים ונתוני מיקום או כתובת חשודים נשארו לבדיקה; לא הוסקו קואורדינטות. אין ברשומה הוכחת זכאות לשובר.',
  skipped,
} };
const target = new URL('../candidates/golf-co-round3.json', import.meta.url);
const temp = new URL('../candidates/golf-co-round3.json.tmp', import.meta.url);
await writeFile(temp, JSON.stringify(output, null, 2) + '\n');
await rename(temp, target);
console.log(JSON.stringify({ store, examined: rows.length, included: branches.length, skipped: skipped.length, excludedOtherBrandRows: all.length - rows.length }));
