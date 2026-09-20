// Read-only network collector: writes candidates, never the published catalogue.
// Usage: PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/collect-existing-candidates.mjs [foxhome|shilav]
// FOX HOME allowlist records manually reviewed destination identity + coordinate
// baselines. Baselines are sanity checks, never fallback coordinates. New source
// rows require review; a disappeared row is reported, never deleted here.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const configs = {
  foxhome: { store: 'פוקס הום', aliases: ['פוקס הום', 'FOX HOME'], sourceUrl: 'https://www.foxhome.co.il/pages/branches' },
  shilav: { store: 'שילב', aliases: ['שילב'], sourceUrl: 'https://www.shilav.co.il/pages/סניפים' },
};
const selected = process.argv[2] ? [process.argv[2]] : Object.keys(configs);
if (selected.some(k => !configs[k])) throw new Error('Unknown chain');
const baselines = JSON.parse(await readFile(new URL('./data/existing-reviewed.json', import.meta.url)));
const existing = JSON.parse(await readFile(new URL('../src/data/branches.json', import.meta.url)));
const checkedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
const output = new URL('../candidates/', import.meta.url);
await mkdir(output, { recursive: true });
const key = r => `${r.city}|${r.name}|${r.coordinateSourceUrl || ''}`;
async function pageAt(url) {
  const page = await browser.newPage();
  try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); return page; }
  catch (error) { await page.close(); throw error; }
}
async function destination(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !/(^|\.)waze\.com$/.test(parsed.hostname) || !parsed.searchParams.get('to')?.startsWith('place.')) throw new Error('Not an explicit Waze destination');
  const page = await pageAt(url);
  try {
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const value = blocks.map(t => { try { return JSON.parse(t); } catch { return null; } }).find(v => v?.geo);
    if (!value) throw new Error('Missing destination coordinates');
    return value;
  } finally { await page.close(); }
}
try {
  for (const chain of selected) {
    const config = configs[chain], page = await pageAt(config.sourceUrl);
    let rows;
    try {
      await page.locator('.boa-branch-item').first().waitFor({ state: 'attached', timeout: 10000 });
      rows = await page.locator('.boa-branch-item').evaluateAll(cards => cards.map(card => ({
        city: card.querySelector('.text-bold')?.textContent.trim(),
        name: card.querySelector('.content-start-text p:nth-of-type(2),.content-start > p:nth-of-type(2)')?.textContent.trim(),
        address: (card.querySelector('.metafield-rich_text_field')?.innerText || card.querySelector('.branch-item-nav')?.textContent || '').trim().split('\n')[0],
        coordinateSourceUrl: card.querySelector('a[href*="waze.com"]')?.href,
        excluded: /עודפים|אאוטלט|outlet|סגור זמנית/i.test(card.innerText),
      })));
    } finally { await page.close(); }
    if (rows.length < (chain === 'foxhome' ? 100 : 85)) throw new Error('Incomplete locator response; previous candidates preserved');
    const branches = [], skipped = [];
    for (const row of rows) {
      const previous = existing.find(b => b.store === config.store && key(b) === key(row));
      const reviewed = baselines[chain]?.find(b => b.key === key(row)) || (chain === 'shilav' ? previous : null);
      let reason = row.excluded ? 'outlet-or-temporarily-closed' : !row.coordinateSourceUrl ? 'no-navigation-coordinates' : baselines.withheld?.find(b => b.key === key(row))?.reason || (!reviewed ? 'needs-coordinate-review' : null);
      if (!reason) {
        try {
          const detail = await destination(row.coordinateSourceUrl);
          const lat = Number(detail.geo.latitude), lng = Number(detail.geo.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 29 || lat > 34 || lng < 34 || lng > 36.5 || Math.hypot((lat - reviewed.lat) * 111, (lng - reviewed.lng) * 94) > 0.35) throw new Error('Destination moved; review required');
          if ('place' in reviewed && (detail.name !== reviewed.place || detail.address?.addressLocality !== reviewed.locality || detail.address?.streetAddress !== reviewed.street)) throw new Error('Destination identity changed');
          branches.push({ id: previous?.id || `${chain}-${createHash('sha256').update(key(row)).digest('hex').slice(0, 12)}`, store: config.store, name: row.name, city: row.city, address: row.address, lat, lng, sourceUrl: config.sourceUrl, coordinateSourceUrl: row.coordinateSourceUrl, checkedAt });
        } catch (error) { reason = `verification-failed: ${error.message}`; }
      }
      if (reason) skipped.push({ city: row.city || '', name: row.name || '', address: row.address, reason });
    }
    const source = { ...config, checkedAt, examined: rows.length, included: branches.length, coverage: 'partial', note: chain === 'shilav' ? 'ברשימה הרשמית 91 רשומות; רק ארבע מפרסמות קישור ניווט עם קואורדינטות שניתן לאמת. יתר הכתובות ממתינות למקור מיקום.' : 'קישורי יעד רשמיים אומתו מול שם המתחם או הכתובת. הושמטו יעדי עודפים ויעדים לא חד-משמעיים. מיקום מתחם אינו מציין קומה או כניסה; יתר הרשימה ממתינה לאימות.', skipped };
    await writeFile(new URL(`${chain}.json`, output), JSON.stringify({ store: config.store, branches, source }, null, 2) + '\n');
    console.log(JSON.stringify({ chain, examined: rows.length, included: branches.length, new: branches.filter(b => !existing.some(old => old.id === b.id)).length, skipped: skipped.length }));
  }
} finally { await browser.close(); }
