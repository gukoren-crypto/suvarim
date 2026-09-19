// Refresh the reviewed FOX subset. Coordinates are copied only from FOX's own
// navigation links, never inferred from city names or borrowed from other stores.
// Usage: PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/update-branches-fox.mjs
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sourceUrl = 'https://fox.co.il/pages/branches';
const target = new URL('../src/data/branches.json', import.meta.url);
const existing = JSON.parse(await readFile(target, 'utf8'));
// Manually reviewed venue associations. A second official chain's nearby
// location is a sanity check, not evidence that this FOX branch accepts a voucher.
// Unreviewed rows are deliberately withheld: the official FOX page contains
// several cross-city navigation mistakes (e.g. Nahariya and Kiryat Bialik).
const reviewed = new Map([
  ['רמת השרון|ביג פאשן גלילות', 'laline-57'],
  ['אילת|מול הים', 'laline-129'],
  ['אילת|אייס מול', 'laline-130'],
  ['עפולה|מתחם עמק סנטר עפולה', 'laline-71'],
  ['נצרת|ביג פאשן נצרת', 'laline-23'],
  ['מעלות|קניון מעלות', 'laline-101'],
  ['רגבה|מתחם ביג רגבה', 'laline-70'],
  ['באר שבע|גרנד קניון ב"ש', 'laline-122'],
  ['ים המלח|קניון ים המלח', 'laline-124'],
  ['נתניה|קניון עיר ימים נתניה', 'laline-46'],
  ['הרצליה|קניון הרצליה שבעת הכוכבים', 'laline-66'],
  ['חדרה|מתחם מול החוף חדרה', 'laline-5'],
  ['חולון|קניון חולון', 'laline-107'],
  ['הוד השרון|קניון שרונים', 'laline-114'],
  ['ירושלים|קניון ממילא', 'laline-33'],
  ['רמת גן|קניון איילון', 'laline-96'],
  ['רמלה|עזריאלי רמלה', 'laline-116'],
  ['בית שאן|צום סנטר בית שאן', 'laline-39'],
  ['טבריה|ביג פאשן טבריה', 'laline-63'],
  ['ראש העין|קניון שפיר ראש העין', 'laline-22'],
  ['ראשון לציון|קניון הזהב', 'laline-60'],
]);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
let rows;
try {
  const page = await browser.newPage();
  await page.goto(sourceUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.branch-card').first().waitFor({ state: 'attached' });
  rows = await page.locator('.branch-card').evaluateAll(cards => cards.map(card => {
    const body = card.querySelector('.branch-card__body').cloneNode(true);
    body.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return {
      city: card.querySelector('.branch-card__name').textContent.trim(),
      name: body.textContent.trim().split('\n')[0].trim(),
      coordinateSourceUrl: card.querySelector('a[href*="waze"]')?.href,
    };
  }));
} finally { await browser.close(); }

const checkedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const accepted = [], skipped = [];
for (const row of rows) {
  const key = `${row.city}|${row.name}`;
  const reference = existing.find(b => b.id === reviewed.get(key));
  let reason = !row.coordinateSourceUrl ? 'missing-navigation-link' : !reference ? 'needs-review' : '';
  let lat, lng;
  if (!reason) {
    const url = new URL(row.coordinateSourceUrl);
    const coords = url.searchParams.get('ll') || url.searchParams.get('to')?.replace(/^ll\./, '');
    [lat, lng] = (coords || '').split(',').map(Number);
    if (!/(^|\.)waze\.com$/.test(url.hostname) || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 29 || lat > 34 || lng < 34 || lng > 36.5) reason = 'invalid-coordinate-link';
    else if (Math.hypot((lat-reference.lat)*111, (lng-reference.lng)*94) > 0.35) reason = 'coordinate-review-required';
  }
  if (reason) { skipped.push({ city: row.city, name: row.name, reason }); continue; }
  accepted.push({
    id: `fox-${createHash('sha256').update(key).digest('hex').slice(0,12)}`,
    store: 'פוקס', name: row.name, city: row.city,
    address: `${row.name}, ${row.city}`,
    lat, lng, sourceUrl, coordinateSourceUrl: row.coordinateSourceUrl, checkedAt,
  });
}
// Fail closed if the source markup/labels change, leaving the last snapshot intact.
if (accepted.length !== reviewed.size) throw new Error(`Expected ${reviewed.size} reviewed branches, extracted ${accepted.length}; inspect source before updating.`);
const merged = [...existing.filter(b => !b.id.startsWith('fox-')), ...accepted];
if (new Set(merged.map(b=>b.id)).size !== merged.length) throw new Error('Duplicate branch identifiers');
await writeFile(target, JSON.stringify(merged, null, 2) + '\n');
const sourcesTarget = new URL('../src/data/branch-sources.json', import.meta.url);
const registry = JSON.parse(await readFile(sourcesTarget, 'utf8'));
await writeFile(sourcesTarget, JSON.stringify({
  ...registry,
  sources: [...registry.sources.filter(s => s.store !== 'פוקס'), { store: 'פוקס', aliases: ['FOX', 'פוקס'], sourceUrl, checkedAt,
    examined: rows.length, included: accepted.length, coverage: 'partial',
    note: 'Only reviewed navigation links are included. Venue-level addresses are preserved as supplied; voucher eligibility is determined separately from the voucher catalog.',
    skipped }],
}, null, 2) + '\n');
console.log(JSON.stringify({ store: 'פוקס', included: accepted.length, skipped: skipped.length, total: merged.length }));
