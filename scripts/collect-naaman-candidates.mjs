// Official Naaman locator -> candidates only. No shared catalog mutation.
import { readFile, writeFile, rename } from 'node:fs/promises';
const baseline = JSON.parse(await readFile(new URL('./data/naaman-round5-reviewed.json', import.meta.url), 'utf8'));
const sourceUrl = baseline.sourceUrl;
const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
if (!response.ok || new URL(response.url).hostname !== 'www.naamanp.co.il') throw Error('Official Naaman locator unavailable');
const html = await response.text();
const clean = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
const rows = html.split(/<li class="store /).slice(1).map(s => ({
  id: s.match(/post="(\d+)"/)?.[1],
  name: clean(s.match(/<h2>(.*?)<\/h2>/s)?.[1] || ''),
  city: clean(s.match(/<span class="city">(.*?)<\/span>/s)?.[1] || ''),
  address: clean(s.match(/<span class="street">(.*?)<span class="comma">/s)?.[1] || ''),
  lat: Number(s.match(/data-latitude="([^"]*)/)?.[1]),
  lng: Number(s.match(/data-longitude="([^"]*)/)?.[1]),
  waze: s.match(/href="(waze:[^"]*)"/)?.[1].replace(/&amp;/g, '&'),
}));
if (rows.length < baseline.examined || rows.some(r => !r.id || !r.name || !r.city) || new Set(rows.map(r => r.id)).size !== rows.length)
  throw Error('Incomplete or changed locator structure; previous candidates preserved');
const store = 'נעמן פורצלן';
const checkedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const branches = [], skipped = [];
for (const row of rows) {
  const reviewed = baseline.reviewed.find(r => r.id === row.id);
  if (!reviewed) {
    const excluded = baseline.skipped.find(r => r.id === row.id);
    skipped.push({ officialId: row.id, name: row.name, city: row.city, address: row.address,
      reason: excluded?.reason || 'new-location-needs-review' });
    continue;
  }
  if (JSON.stringify(reviewed) !== JSON.stringify(row)) throw Error(`Reviewed branch ${row.id} changed; manual review required`);
  const destination = new URL(row.waze);
  const [lat, lng] = (destination.searchParams.get('ll') || '').split(',').map(Number);
  if (destination.protocol !== 'waze:' || destination.searchParams.get('navigate') !== 'yes' ||
      !row.address || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 29 || lat > 34 || lng < 34 || lng > 36.5 || lat !== row.lat || lng !== row.lng)
    throw Error(`Invalid or conflicting explicit navigation destination ${row.id}`);
  branches.push({ id: `naaman-${row.id}`, store, name: row.name, city: row.city, address: row.address,
    lat, lng, sourceUrl, coordinateSourceUrl: sourceUrl, checkedAt, locationAccuracy: 'address-or-venue' });
}
if (branches.length !== baseline.reviewed.length || new Set(branches.map(b => `${b.lat},${b.lng}`)).size !== branches.length)
  throw Error('Missing or duplicate reviewed location; previous candidates preserved');
branches.sort((a, b) => a.id.localeCompare(b.id));
const output = { store, branches, source: {
  store, aliases: ['נעמן פורצלן', 'נעמן', 'NAAMAN', 'Naaman'], sourceUrl, checkedAt,
  examined: rows.length, included: branches.length, coverage: 'partial',
  note: 'יעדי Waze מפורשים מרשימת נעמן הרשמית, לאחר התאמת העיר והמתחם. סניפים משולבים המוזכרים ברשימה נכללו כנעמן בלבד; לא נוספו רשומות ורדינון. קואורדינטות משותפות חשודות, עודפים, ירידים וכתובות או מתחמים שדורשים בירור נשארו לבדיקה. אין ברשומה הוכחת זכאות לשובר.',
  skipped,
} };
const target = new URL('../candidates/naaman-round5.json', import.meta.url);
const temp = new URL('../candidates/naaman-round5.json.tmp', import.meta.url);
await writeFile(temp, JSON.stringify(output, null, 2) + '\n');
await rename(temp, target);
console.log(JSON.stringify({ store, examined: rows.length, included: branches.length, skipped: skipped.length }));
