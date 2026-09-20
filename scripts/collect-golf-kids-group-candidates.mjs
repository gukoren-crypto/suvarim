// Use the official public brand selector in an isolated browser; no login/profile.
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile, writeFile, rename } from 'node:fs/promises';
const baseline = JSON.parse(await readFile(new URL('./data/golf-kids-round6-reviewed.json', import.meta.url), 'utf8'));
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(chrome) ? chrome : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
let payload;
try {
  const page = await browser.newPage();
  await page.goto(baseline.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const selector = page.locator('select').filter({ has: page.locator('option[value="Golf Kids & Baby"]') }).first();
  await selector.waitFor({ state: 'visible' });
  const responsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    if (url.origin !== 'https://www.golfgroup.co.il' || url.pathname !== '/_api/cloud-data/v2/items/query') return false;
    try {
      const query = JSON.parse(Buffer.from(url.searchParams.get('.r') || '', 'base64').toString());
      return query.dataCollectionId === 'Branches' && query.query?.filter?.brand === 'Golf Kids & Baby';
    } catch { return false; }
  }, { timeout: 30000 });
  await selector.selectOption('Golf Kids & Baby');
  const response = await responsePromise;
  if (!response.ok()) throw Error(`Official API HTTP ${response.status()}`);
  payload = await response.json();
  const items = [...payload.dataItems], pages = [payload.pagingMetadata];
  const queryUrl = new URL(response.url());
  const query = JSON.parse(Buffer.from(queryUrl.searchParams.get('.r'), 'base64').toString());
  // Public read-only pagination; headers remain only in this clean process.
  const headers = Object.fromEntries(Object.entries(await response.request().allHeaders()).filter(([key]) => !key.startsWith(':')));
  while (payload.pagingMetadata.hasNext) {
    if (pages.length > 10) throw Error('Unexpected pagination size');
    query.query.paging.offset = items.length;
    queryUrl.searchParams.set('.r', Buffer.from(JSON.stringify(query)).toString('base64'));
    const next = await page.request.get(queryUrl.href, { headers });
    if (!next.ok()) throw Error('Official pagination failed');
    payload = await next.json();
    if (payload.pagingMetadata.offset !== items.length || !payload.dataItems.length || payload.pagingMetadata.total !== pages[0].total) throw Error('Incomplete pagination');
    items.push(...payload.dataItems); pages.push(payload.pagingMetadata);
  }
  if (items.length !== pages[0].total) throw Error('Incomplete official response');
  payload = {dataItems:items, pagingMetadata:{...payload.pagingMetadata,count:items.length,offset:0}};
} finally { await browser.close(); }
const metadata = payload?.pagingMetadata;
if (!Array.isArray(payload?.dataItems) || metadata?.hasNext !== false || metadata.offset !== 0 ||
    metadata.total !== payload.dataItems.length || metadata.count !== payload.dataItems.length ||
    metadata.total < baseline.examined)
  throw Error('Incomplete official brand response; candidates preserved');
const rows = payload.dataItems.map(({data:r}) => ({id:String(r.code), officialId:r._id, name:r.title, city:r.city, address:r.address, lat:r.latitude, lng:r.longitude, brand:r.brand, isActive:r.is_active, storelocator:r.storelocator}));
if (new Set(rows.map(r => r.id)).size !== rows.length || baseline.reviewed.some(old => !rows.some(r => r.id === old.id)))
  throw Error('Duplicate or missing reviewed official branch');
for (const row of rows) {
  const old = baseline.reviewed.find(r => r.id === row.id);
  if (!old || Object.keys(old).some(k => old[k] !== row[k])) throw Error('Source changed; review before replacing audit candidates');
}
// No additions qualified. Preserve the existing source scope and every branch byte-for-byte.
const output = {store:'GOLF KIDS',branches:baseline.preservedBranches,source:baseline.preservedSource};
const target = new URL('../candidates/golf-kids-round6.json',import.meta.url), temporary = new URL('../candidates/golf-kids-round6.json.tmp',import.meta.url);
await writeFile(temporary,JSON.stringify(output,null,2)+'\n'); await rename(temporary,target);
console.log(JSON.stringify({store:'GOLF KIDS',officialExamined:rows.length,added:0,preserved:output.branches.length,scope:'audit-only; no source registry replacement'}));
