// Refresh reviewed FOX HOME, Shilav and Nike branches from official locators.
// Only explicit coordinates published by the chain or its linked navigation
// destination are used. No geocoding, guessed city centers, or borrowed locations.
// Usage: PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/update-branches-dreamcard.mjs [foxhome|shilav|nike|mango]
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const target = new URL('../src/data/branches.json', import.meta.url);
const sourcesTarget = new URL('../src/data/branch-sources.json', import.meta.url);
const checkedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const configs = {
  foxhome: { store: 'פוקס הום', aliases: ['פוקס הום', 'FOX HOME'], sourceUrl: 'https://www.foxhome.co.il/pages/branches' },
  shilav: { store: 'שילב', aliases: ['שילב'], sourceUrl: 'https://www.shilav.co.il/pages/סניפים' },
  nike: { store: 'נייק', aliases: ['נייק', 'NIKE'], sourceUrl: 'https://www.nike.com/il/retail/directory/israel/tel-aviv' },
  mango: { store: 'MANGO', aliases: ['MANGO', 'מנגו'], sourceUrl: 'https://shop.mango.com/il/en/stores/tel-aviv/ramat-aviv-mall/2807' },
};
// Reviewed coordinate baselines are sanity bounds, never fallback coordinates.
// A changed coordinate >350m away requires a fresh review and is withheld.
const reviewed = {
  "foxhome": [
    {
      "key": "באר שבע|באר שבע|https://www.waze.com/he/live-map/directions/il/south-district/%D7%91%D7%A9/azrieli-negev-mall?to=place.ChIJXf-OyQRnAhUR7d-YiyWuK18",
      "lat": 31.243726,
      "lng": 34.7946189
    },
    {
      "key": "הוד השרון|עזריאלי מרגלית השרון|https://www.waze.com/he/live-map/directions/%D7%94%D7%95%D7%93-%D7%94%D7%A9%D7%A8%D7%95%D7%9F?to=place.ws.il.3742.3",
      "lat": 32.14363479614258,
      "lng": 34.891815185546875
    },
    {
      "key": "חיפה|חיפה|https://www.waze.com/he/live-map/directions/il/%D7%9E%D7%97%D7%95%D7%96-%D7%97%D7%99%D7%A4%D7%94/%D7%97%D7%99%D7%A4%D7%94/%D7%A7%D7%A0%D7%99%D7%95%D7%9F-%D7%A2%D7%96%D7%A8%D7%99%D7%90%D7%9C%D7%99-%D7%97%D7%99%D7%A4%D7%94?to=place.ChIJD0CgT2i7HRURGRsyzgJAPiQ",
      "lat": 32.7896507,
      "lng": 34.9651905
    },
    {
      "key": "עין שמר|עין שמר|https://www.waze.com/he/live-map/directions/il/%D7%9E%D7%97%D7%95%D7%96-%D7%97%D7%99%D7%A4%D7%94/%D7%9E%D7%95%D7%A2%D7%A6%D7%94-%D7%90%D7%96%D7%95%D7%A8%D7%99%D7%AA-%D7%9E%D7%A0%D7%A9%D7%94/%D7%90%D7%9C%D7%95%D7%9F-%D7%A2%D7%99%D7%9F-%D7%A9%D7%9E%D7%A8-fashion?to=place.ChIJjxIqZUsOHRUR_wqoun_SoLI",
      "lat": 32.4652592,
      "lng": 34.9920294
    },
    {
      "key": "רמת ישי|רמת ישי|https://www.waze.com/he/live-map/directions/il/%D7%9E%D7%97%D7%95%D7%96-%D7%94%D7%A6%D7%A4%D7%95%D7%9F/%D7%A8%D7%9E%D7%AA-%D7%99%D7%A9%D7%99/fox-home?to=place.ChIJJ81Zjp6zHRUReSLITjTTpNM",
      "lat": 32.7077104,
      "lng": 35.175006
    },
    {
      "key": "ירושלים|ירושלים|https://www.waze.com/he/live-map/directions/il/jerusalem-district/jerusalem/%D7%A7%D7%A0%D7%99%D7%95%D7%9F-%D7%A9%D7%93%D7%A8%D7%95%D7%AA-%D7%90%D7%9C%D7%A8%D7%95%D7%91-%D7%9E%D7%9E%D7%99%D7%9C%D7%90?to=place.ChIJY2qRjdEpAxURmTrXMB3CaNo",
      "lat": 31.7777853,
      "lng": 35.2238188
    },
    {
      "key": "מעלות תרשיחא|מעלות|https://www.waze.com/he/live-map/directions/%D7%A7%D7%A0%D7%99%D7%95%D7%9F-%D7%A6%D7%99%D7%9D-%D7%A1%D7%A0%D7%98%D7%A8-%D7%A9%D7%9C%D7%9E%D7%94-%D7%A9%D7%A8%D7%99%D7%A8%D7%90-3-%D7%9E%D7%A2%D7%9C%D7%95%D7%AA-%D7%AA%D7%A8%D7%A9%D7%99%D7%97%D7%90?to=place.w.23134538.231214310.16837",
      "lat": 33.021796702,
      "lng": 35.280644243
    },
    {
      "key": "קרית אתא|קרית אתא|https://www.waze.com/he/live-map/directions/il/%D7%9E%D7%97%D7%95%D7%96-%D7%97%D7%99%D7%A4%D7%94/%D7%A7%D7%90/%D7%A7%D7%A0%D7%99%D7%95%D7%9F-%D7%A9%D7%A2%D7%A8-%D7%94%D7%A6%D7%A4%D7%95%D7%9F?to=place.ChIJP5bbuNOwHRURKf4oksvi2pE",
      "lat": 32.8076246,
      "lng": 35.0771708
    },
    {
      "key": "מבשרת ציון|מבשרת ציון|https://www.waze.com/he/live-map/directions/il/%D7%9E%D7%97%D7%95%D7%96-%D7%99%D7%A8%D7%95%D7%A9%D7%9C%D7%99%D7%9D/%D7%9E%D7%91%D7%A9%D7%A8%D7%AA-%D7%A6%D7%99%D7%95%D7%9F/%D7%A9%D7%93%D7%A8%D7%95%D7%AA-%D7%94%D7%97%D7%95%D7%A6%D7%91%D7%99%D7%9D-10?to=place.ChIJ4x1TeSDXAhURMGNDRJDb3SY",
      "lat": 31.796651,
      "lng": 35.1464797
    },
    {
      "key": "עטרות|עטרות|https://www.waze.com/he/live-map/directions/%D7%A8%D7%9E%D7%99-%D7%9C%D7%95%D7%99-%D7%A2%D7%98%D7%A8%D7%95%D7%AA-%D7%99%D7%A8%D7%95%D7%A9%D7%9C%D7%99%D7%9D?to=place.w.23068990.230886513.467360",
      "lat": 31.84982924,
      "lng": 35.22524402
    }
  ],
  "shilav": [
    {
      "key": "בית שאן|צים אורבן - בית שאן|https://www.waze.com/he/live-map/directions/%D7%A6%D7%99%D7%9D-%D7%90%D7%95%D7%A8%D7%91%D7%9F-%D7%91%D7%99%D7%AA-%D7%A9%D7%90%D7%9F?to=place.w.23265605.232656051.15309",
      "lat": 32.510621755,
      "lng": 35.50181396
    },
    {
      "key": "באר יעקב|קניון באר יעקב|https://www.waze.com/he/live-map/directions/%D7%A9%D7%90-%D7%A0%D7%A1-17-%D7%91%D7%90%D7%A8-%D7%99%D7%A2%D7%A7%D7%91?to=place.w.22806847.228265082.373161",
      "lat": 31.941568134,
      "lng": 34.833939008
    },
    {
      "key": "ראש העין|מרכז שפיר סנטר- ראש העין|https://www.waze.com/he/live-map/directions/%D7%99%D7%92%D7%90%D7%9C-%D7%90%D7%9C%D7%95%D7%9F-22-%D7%A8%D7%90%D7%A9-%D7%94%D7%A2%D7%99%D7%9F?to=place.w.22937921.229248137.2051350",
      "lat": 32.086312523529,
      "lng": 34.978441417214
    },
    {
      "key": "רהט|רהט-מתחם seven|https://www.waze.com/he/live-map/directions/il/%D7%9E%D7%97%D7%95%D7%96-%D7%94%D7%93%D7%A8%D7%95%D7%9D/%D7%A8%D7%94%D7%98/mall-seven-rahat-%D7%A7%D7%A0%D7%99%D7%95%D7%9F-%D7%A1%D7%91%D6%BC%D7%9F-%D7%A8%D7%94%D7%98-mwl-sfn?to=place.ChIJ6VIf4aNjAhUR9uw1bxv4BHk",
      "lat": 31.394591,
      "lng": 34.7539789
    }
  ],
  "nike": [
    {
      "key": "https://www.nike.com/il/retail/s/nike-store-dizengof",
      "lat": 32.075734,
      "lng": 34.774568
    },
    {
      "key": "https://www.nike.com/il/retail/s/nike-store-tlv-port",
      "lat": 32.099495,
      "lng": 34.775031
    },
    {
      "key": "https://www.nike.com/il/retail/s/nsp-ayalon",
      "lat": 32.100338,
      "lng": 34.82691
    },
    {
      "key": "https://www.nike.com/il/retail/s/nike-store-shenkar",
      "lat": 32.158912,
      "lng": 34.808891
    },
    {
      "key": "https://www.nike.com/il/retail/s/nike-store-azrieli",
      "lat": 32.074509,
      "lng": 34.791944
    }
  ]
};
const cityNames = { 'TEL AVIV': 'תל אביב', 'HERTZLIYA': 'הרצליה', 'RAMAT GAN': 'רמת גן' };
const coordinateConflicts = new Set([
  'https://www.nike.com/il/retail/s/ramat-aviv-new',
  'https://www.nike.com/il/retail/s/fox-nsp-glilot',
  'https://www.nike.com/il/retail/s/nsp-gindi-tlv',
]);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
const selected = process.argv[2] ? [process.argv[2]] : Object.keys(configs);
if (selected.some(k => !configs[k])) throw new Error('Unknown chain');
async function open(url) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return page;
  } catch (error) { await page.close(); throw error; }
}
async function structured(url) {
  const page = await open(url);
  try {
    await page.locator('script[type="application/ld+json"]').first().waitFor({ state: 'attached', timeout: 10000 });
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    return blocks.map(t => { try { return JSON.parse(t); } catch { return null; } }).find(x => x?.geo);
  } finally { await page.close(); }
}
async function listRows(chain, config) {
  const page = await open(config.sourceUrl);
  try {
    if (chain === 'nike') {
      await page.locator('a[href*="/retail/s/"]').first().waitFor({state:'attached',timeout:10000});
      return await page.locator('a[href*="/retail/s/"]').evaluateAll(as => [...new Map(as.map(a => [a.href, { key: a.href, name: a.innerText.split('\n')[0], coordinateSourceUrl: a.href }])).values()]);
    }
    await page.locator('.boa-branch-item').first().waitFor({state:'attached',timeout:10000});
    return await page.locator('.boa-branch-item').evaluateAll(cards => cards.map(card => {
      const city = card.querySelector('.text-bold')?.textContent.trim();
      const name = card.querySelector('.content-start-text p:nth-of-type(2),.content-start > p:nth-of-type(2)')?.textContent.trim();
      const link = card.querySelector('a[href*="waze.com"]');
      return { key: `${city}|${name}|${link?.href || ""}`, city, name,
        address: (card.querySelector('.metafield-rich_text_field')?.innerText || card.querySelector('.branch-item-nav')?.textContent || '').trim().split('\n')[0],
        coordinateSourceUrl: link?.href,
        excluded: /עודפים|סגור זמנית/.test(card.innerText),
      };
    }));
  } finally { await page.close(); }
}
try {
  for (const chain of selected) {
    const config = configs[chain];
    const existing = JSON.parse(await readFile(target, 'utf8'));
    const registry = JSON.parse(await readFile(sourcesTarget, 'utf8'));
    let record;
    try {
      if (chain === 'mango') {
        // The public page has one named store but only an address-based Maps
        // direction link. Browser access is currently denied; no coordinates
        // are invented from another shop in the same mall.
        const page = await open(config.sourceUrl);
        let accessDenied;
        try { accessDenied = /access denied/i.test(await page.title()); } finally { await page.close(); }
        record = {...config, checkedAt, examined: 1, included: 0, coverage: 'blocked',
          note: accessDenied ? 'האתר חסם גישה אוטומטית. זוהה סניף רמת אביב, אך טרם אומת מיקום מדויק.' : 'זוהה סניף רמת אביב; דרוש מקור לקואורדינטות מדויקות לפני הוספה למפה.',
          skipped: [{city:'תל אביב',name:'רמת אביב',reason:'coordinates-not-verified'}]};
      } else {
        const rows = await listRows(chain, config);
        if (rows.length < reviewed[chain].length) throw new Error('Incomplete source response; preserving previous snapshot');
        const accepted = [], skipped = [];
        for (const row of rows) {
          const expected = reviewed[chain].find(r => r.key === row.key);
          if (!expected || row.excluded) {
            skipped.push({city:row.city || '',name:row.name,reason:row.excluded || /factory/i.test(row.name) ? 'outlet-or-temporarily-closed' : coordinateConflicts.has(row.key) ? 'source-coordinate-mismatch' : 'needs-coordinate-review'});
            continue;
          }
          if (!row.coordinateSourceUrl) throw new Error(`Missing navigation link: ${row.key}`);
          const allowedHost = new URL(row.coordinateSourceUrl).hostname;
          if (!/(^|\.)(waze\.com|nike\.com)$/.test(allowedHost)) throw new Error('Unexpected navigation host');
          const details = await structured(row.coordinateSourceUrl);
          const lat = Number(details?.geo?.latitude), lng = Number(details?.geo?.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 29 || lat > 34 || lng < 34 || lng > 36.5 || Math.hypot((lat-expected.lat)*111,(lng-expected.lng)*94) > 0.35) throw new Error(`Coordinates changed; review ${row.key}`);
          accepted.push({ id: `${chain}-${createHash('sha256').update(row.key).digest('hex').slice(0,12)}`,
            store: config.store, name: chain === 'nike' ? details.name : row.name,
            city: chain === 'nike' ? (cityNames[details.address.addressLocality.toUpperCase()] || details.address.addressLocality) : row.city,
            address: chain === 'nike' ? details.address.streetAddress : row.address,
            lat, lng, sourceUrl: chain === 'nike' ? row.key : config.sourceUrl,
            coordinateSourceUrl: row.coordinateSourceUrl, checkedAt,
          });
        }
        if (accepted.length !== reviewed[chain].length) throw new Error('Reviewed branch missing; preserving previous snapshot');
        const merged = [...existing.filter(b => !b.id.startsWith(`${chain}-`)), ...accepted];
        if (new Set(merged.map(b=>b.id)).size !== merged.length) throw new Error('Duplicate branch ids');
        await writeFile(target, JSON.stringify(merged,null,2)+'\n');
        record = {...config, checkedAt, examined:rows.length, included:accepted.length, coverage:'partial',
          note: chain === 'nike' ? 'נבדק אזור תל אביב בלבד. סניפי עודפים ומיקומים סותרים הושמטו; יתר הארץ טרם נבדקה.' : 'נכללו רק קישורי ניווט שנבדקו. מיקום מתחם מסחרי אינו מציין קומה או כניסה; יתר הסניפים ממתינים לאימות.', skipped};
      }
    } catch (error) {
      const previous = registry.sources.find(s=>s.store===config.store);
      record = {...config, ...(previous || {}), lastAttemptAt:checkedAt,
        included: existing.filter(b=>b.id.startsWith(`${chain}-`)).length,
        coverage: previous?.included ? 'partial' : 'blocked',
        note: `העדכון לא הושלם; המידע הקודם נשמר. ${error.message}`};
    }
    registry.sources = [...registry.sources.filter(s=>s.store!==config.store), record];
    await writeFile(sourcesTarget,JSON.stringify(registry,null,2)+'\n');
    console.log(JSON.stringify({store:config.store,included:record.included,coverage:record.coverage,note:record.note}));
  }
} finally { await browser.close(); }
