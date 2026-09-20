// Use the official public brand selector in an isolated browser; no login/profile.
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile, writeFile, rename } from 'node:fs/promises';
const baseline = JSON.parse(await readFile(new URL('./data/polgat-round5-reviewed.json', import.meta.url), 'utf8'));
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(chrome) ? chrome : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
let payload;
try {
  const page = await browser.newPage();
  await page.goto(baseline.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const selector = page.locator('select').filter({ has: page.locator('option[value="Polgat"]') }).first();
  await selector.waitFor({ state: 'visible' });
  const responsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    if (url.origin !== 'https://www.golfgroup.co.il' || url.pathname !== '/_api/cloud-data/v2/items/query') return false;
    try {
      const query = JSON.parse(Buffer.from(url.searchParams.get('.r') || '', 'base64').toString());
      return query.dataCollectionId === 'Branches' && query.query?.filter?.brand === 'Polgat';
    } catch { return false; }
  }, { timeout: 30000 });
  await selector.selectOption('Polgat');
  const response = await responsePromise;
  if (!response.ok()) throw Error(`Official API HTTP ${response.status()}`);
  payload = await response.json();
} finally { await browser.close(); }
const metadata = payload?.pagingMetadata;
if (!Array.isArray(payload?.dataItems) || metadata?.hasNext !== false || metadata.offset !== 0 ||
    metadata.total !== payload.dataItems.length || metadata.count !== payload.dataItems.length ||
    metadata.total < baseline.examined)
  throw Error('Incomplete official brand response; candidates preserved');
const rows = payload.dataItems.map(({data:r}) => ({id:String(r.code), officialId:r._id, name:r.title, city:r.city, address:r.address, lat:r.latitude, lng:r.longitude, brand:r.brand, isActive:r.is_active, storelocator:r.storelocator}));
if (new Set(rows.map(r => r.id)).size !== rows.length || baseline.reviewed.some(old => !rows.some(r => r.id === old.id)))
  throw Error('Duplicate or missing reviewed official branch');
const store = 'פולגת', sourceUrl = baseline.sourceUrl;
const checkedAt = new Date().toLocaleDateString('en-CA', { timeZone:'Asia/Jerusalem' });
const branches = [], skipped = [];
for (const row of rows) {
  const old = baseline.reviewed.find(r => r.id === row.id);
  if (old && Object.keys(old).some(k => old[k] !== row[k])) throw Error(`Changed official row ${row.id}; review first`);
  const reason = baseline.exclusions[row.id] || (!old ? 'new-location-needs-review' : null);
  if (reason) { skipped.push({officialId:row.officialId, name:row.name, city:row.city, reason}); continue; }
  if (row.brand !== 'Polgat' || row.isActive !== 1 || row.storelocator !== 1 || !Number.isFinite(row.lat) || !Number.isFinite(row.lng) || row.lat < 29 || row.lat > 34 || row.lng < 34 || row.lng > 36.5) throw Error(`Invalid candidate ${row.id}`);
  branches.push({id:`polgat-${row.id}`,store,name:row.name,city:row.city,address:row.address,lat:row.lat,lng:row.lng,sourceUrl,coordinateSourceUrl:sourceUrl,checkedAt,locationAccuracy:'address-or-venue'});
}
if (branches.length !== baseline.reviewed.filter(r => !baseline.exclusions[r.id]).length) throw Error('Reviewed candidate missing');
branches.sort((a,b) => a.id.localeCompare(b.id));
const output = {store,branches,source:{store,aliases:['פולגת','POLGAT','Polgat'],sourceUrl,checkedAt,examined:rows.length,included:branches.length,coverage:'partial',note:'נתוני סניפים מפורשים מתוך מסנן Polgat במאתר הרשמי של קבוצת גולף; תגובת המקור נבדקה כמלאה לפי total/hasNext. רק מתחמים וכתובות שהוצלבו נכללו. הכיסוי חלקי בגלל חריגים; לא הוחלפו צירים ולא הוסקו קואורדינטות.',skipped}};
const target = new URL('../candidates/polgat-round5.json',import.meta.url), temporary = new URL('../candidates/polgat-round5.json.tmp',import.meta.url);
await writeFile(temporary,JSON.stringify(output,null,2)+'\n'); await rename(temporary,target);
console.log(JSON.stringify({store,examined:rows.length,included:branches.length,skipped:skipped.length}));
