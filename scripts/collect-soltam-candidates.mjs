// Public Soltam locator response; clean browser, no login or saved session.
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile, writeFile, rename } from 'node:fs/promises';
const baseline = JSON.parse(await readFile(new URL('./data/soltam-round7-reviewed.json', import.meta.url),'utf8'));
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(chrome) ? chrome : undefined);
const browser = await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
let data;
try {
  const page = await browser.newPage();
  const responsePromise = page.waitForResponse(r => {
    const u = new URL(r.url());
    return u.origin + u.pathname === baseline.coordinateSourceUrl && u.searchParams.get('load_all') === '1';
  },{timeout:30000});
  await page.goto(baseline.sourceUrl,{waitUntil:'domcontentloaded',timeout:45000});
  const response = await responsePromise;
  if (!response.ok()) throw Error(`Official locator HTTP ${response.status()}`);
  data = await response.json();
} finally { await browser.close(); }
if (!Array.isArray(data) || data.length < baseline.examined) throw Error('Incomplete official locator; candidates preserved');
const rows = data.map(r=>({id:r.id,name:r.title.trim(),city:r.city.trim(),address:r.street.trim(),lat:r.lat,lng:r.lng}));
if(new Set(rows.map(r=>r.id)).size !== rows.length || baseline.reviewed.some(old=>!rows.some(r=>r.id===old.id))) throw Error('Duplicate or missing official record');
const checkedAt = new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
const store='סולתם', branches=[], skipped=[];
for(const row of rows){
  const old=baseline.reviewed.find(r=>r.id===row.id);
  if(old && Object.keys(old).some(k=>old[k]!==row[k])) throw Error(`Official row ${row.id} changed; review first`);
  const reason=baseline.exclusions[row.id] || (!old?'new-location-needs-review':null);
  if(reason){skipped.push({officialId:row.id,name:row.name,city:row.city,reason});continue;}
  const lat=Number(row.lat),lng=Number(row.lng);
  if(!row.lat||!row.lng||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<29||lat>34||lng<34||lng>36.5)throw Error(`Invalid coordinates ${row.id}`);
  branches.push({...row,id:`soltam-${row.id}`,store,lat,lng,sourceUrl:baseline.sourceUrl,coordinateSourceUrl:baseline.coordinateSourceUrl,checkedAt,locationAccuracy:'address-or-venue'});
}
if(branches.length!==baseline.reviewed.filter(r=>!baseline.exclusions[r.id]).length)throw Error('Reviewed candidate missing');
branches.sort((a,b)=>a.id.localeCompare(b.id));
const output={store,branches,source:{store,aliases:['סולתם','SOLTAM','Soltam'],sourceUrl:baseline.sourceUrl,checkedAt,examined:rows.length,included:branches.length,coverage:'partial',note:'קואורדינטות מפורשות מנתוני מאתר סולתם הרשמי, שנצפה נטען עם load_all=1 בדף הסניפים. רק כתובות ומתחמים שהוצלבו נכללו. נקודות סותרות, משווק ומיקומים ללא הצלבה נשארו לבדיקה; לא הוסקו או תוקנו קואורדינטות.',skipped}};
const target=new URL('../candidates/soltam-round7.json',import.meta.url),temporary=new URL('../candidates/soltam-round7.json.tmp',import.meta.url);
await writeFile(temporary,JSON.stringify(output,null,2)+'\n');await rename(temporary,target);
console.log(JSON.stringify({store,examined:rows.length,included:branches.length,skipped:skipped.length}));
