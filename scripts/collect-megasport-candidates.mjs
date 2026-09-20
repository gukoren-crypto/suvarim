// Official locator -> candidates only, preserving separate retail channels.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const baseline = JSON.parse(await readFile(new URL('./data/megasport-round9-reviewed.json', import.meta.url), 'utf8'));
const response = await fetch(baseline.sourceUrl, { signal: AbortSignal.timeout(30000) });
if (!response.ok || response.url !== baseline.sourceUrl) throw Error('Official locator unavailable');
const html = await response.text();
const clean = s => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
const rows = html.split('<div class="store-card"').slice(1).map(s => {
  const name = clean(s.match(/<h2>(.*?)<\/h2>/s)?.[1] || '');
  const city = clean(s.match(/<p class="city">(.*?)<\/p>/s)?.[1] || '');
  const address = clean(s.match(/<p class="address">(.*?)<\/p>/s)?.[1] || '');
  const links = [...s.matchAll(/href="([^"]+)"[^>]*class="(?:waze-link|map-overlay)"/g)].map(m => m[1]);
  const destination = links.find(u => new URL(u).searchParams.has('ll'));
  const [lat, lng] = destination ? new URL(destination).searchParams.get('ll').split(',').map(Number) : [];
  return { id: createHash('sha256').update(name).digest('hex').slice(0,12), name, city, address, lat, lng, links, destination };
});
if (rows.length < baseline.rawCount || rows.some(r => !r.name || !r.city) || new Set(rows.map(r => r.id)).size !== rows.length)
  throw Error('Missing or duplicate source records');
const store = 'מגה ספורט';
const checkedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const branches = [], skipped = [];
let excluded = 0;
for (const row of rows) {
  if (/עודפים|מרלו|קידס|kids|online|אונליין/i.test(row.name)) { excluded++; continue; }
  const reviewed = baseline.reviewed.find(r => r.id === row.id);
  if (!reviewed) {
    const old = baseline.skipped.find(r => r.id === row.id);
    skipped.push({ officialId: row.id, name: row.name, city: row.city, address: row.address,
      reason: old?.reason || 'new-location-needs-review' });
    continue;
  }
  if (JSON.stringify(row) !== JSON.stringify(reviewed)) throw Error(`Reviewed source changed: ${row.name}`);
  if (!row.address || !Number.isFinite(row.lat) || !Number.isFinite(row.lng) || row.lat < 29 || row.lat > 34 || row.lng < 34 || row.lng > 36.5)
    throw Error('Invalid reviewed destination');
  for (const link of row.links) {
    const u = new URL(link);
    if (u.protocol !== 'https:' || !['ul.waze.com','www.waze.com','waze.com'].includes(u.hostname)) throw Error('Unexpected navigation host');
    if (!u.searchParams.has('ll')) continue;
    const [lat,lng] = u.searchParams.get('ll').split(',').map(Number);
    // The second link is commonly rounded to six decimals; tolerate only that precision difference.
    if (u.searchParams.get('navigate') !== 'yes' || Math.abs(lat-row.lat)>0.000001 || Math.abs(lng-row.lng)>0.000001)
      throw Error(`Conflicting explicit destinations: ${row.name}`);
  }
  branches.push({ id: `megasport-${row.id}`, store, name: row.name, city: row.city, address: row.address,
    lat: row.lat, lng: row.lng, sourceUrl: baseline.sourceUrl, coordinateSourceUrl: baseline.sourceUrl,
    checkedAt, locationAccuracy: 'address-or-venue' });
}
if (branches.length !== baseline.reviewed.length || new Set(branches.map(b=>`${b.lat},${b.lng}`)).size !== branches.length)
  throw Error('Missing or duplicated reviewed point');
branches.sort((a,b)=>a.id.localeCompare(b.id));
const output = { store, branches, source: { store, aliases: [store,'MEGA SPORT','Mega Sport'],
  sourceUrl: baseline.sourceUrl, checkedAt, examined: rows.length-excluded, included: branches.length, coverage: 'partial',
  note: 'חנויות מגה ספורט רגילות בלבד; עודפים ומרלוג הוחרגו. יעדי ניווט מפורשים של הסניף עם התאמת מתחם או כתובת. כפילויות ויעדים חשודים נשארו לבירור. אין ערבוב עם קידס או אונליין ואין הוכחת זכאות לשובר.', skipped } };
const target = new URL('../candidates/megasport-round9.json', import.meta.url);
const temp = new URL('../candidates/megasport-round9.json.tmp', import.meta.url);
await writeFile(temp, JSON.stringify(output,null,2)+'\n');
await rename(temp,target);
console.log(JSON.stringify({ raw:rows.length,examined:rows.length-excluded,included:branches.length,skipped:skipped.length,excluded }));
