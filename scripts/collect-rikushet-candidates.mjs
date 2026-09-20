// Official Rikushet store destination coordinates only; no DMS repair or axis swaps.
import {readFile,writeFile,rename} from 'node:fs/promises';
const baseline=JSON.parse(await readFile(new URL('./data/rikushet-round9-reviewed.json',import.meta.url),'utf8'));
const response=await fetch(baseline.sourceUrl,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error(`Official source HTTP ${response.status}`);
const html=await response.text();
const field=(s,re)=>{const m=s.match(re);if(!m)throw Error('Locator structure changed');return m[1]};
const clean=s=>s.replace(/<[^>]*>/g,'').trim();
const rows=[...html.matchAll(/<li class="store ([\s\S]*?)<\/li>/g)].map(m=>{const s=m[1];return{
  id:field(s,/post="(\d+)"/),
  name:clean(field(s,/<div class="store_title"[^>]*>([\s\S]*?)<\/div>/)),
  city:clean(field(s,/<span class="city">([\s\S]*?)<\/span>/)),
  address:clean(field(s,/<span class="street">([\s\S]*?)<span class="comma">/)),
  lat:field(s,/data-latitude="([^"]*)/),lng:field(s,/data-longitude="([^"]*)/),
  waze:field(s,/href="(waze:\/\/[^\"]*)/).replaceAll('&amp;','&'),
}});
if(rows.length<baseline.examined||new Set(rows.map(r=>r.id)).size!==rows.length||baseline.reviewed.some(old=>!rows.some(r=>r.id===old.id)))throw Error('Missing or duplicate official rows');
const branches=[],skipped=[],store='ריקושט',checkedAt=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
for(const row of rows){
  const old=baseline.reviewed.find(r=>r.id===row.id);
  if(old&&Object.keys(old).some(k=>old[k]!==row[k]))throw Error(`Official row ${row.id} changed; review first`);
  if(row.name.includes('עודפים'))continue;
  const reason=baseline.exclusions[row.id]||(!old?'new-location-needs-review':null);
  if(reason){skipped.push({officialId:row.id,name:row.name,city:row.city,reason});continue;}
  const lat=Number(row.lat),lng=Number(row.lng),target=new URL(row.waze),ll=target.searchParams.get('ll')?.split(',').map(Number);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<29||lat>34||lng<34||lng>36.5||target.protocol!=='waze:'||target.searchParams.get('navigate')!=='yes'||ll?.length!==2||ll[0]!==lat||ll[1]!==lng)throw Error(`Invalid explicit destination ${row.id}`);
  branches.push({id:`rikushet-${row.id}`,store,name:row.name,city:row.city,address:row.address,lat,lng,sourceUrl:baseline.sourceUrl,coordinateSourceUrl:baseline.sourceUrl,checkedAt,locationAccuracy:'address-or-venue'});
}
if(branches.length!==baseline.reviewed.filter(r=>!baseline.exclusions[r.id]).length)throw Error('Missing reviewed candidate');
branches.sort((a,b)=>a.id.localeCompare(b.id));
const output={store,branches,source:{store,aliases:['ריקושט','RIKUSHET','Rikushet'],sourceUrl:baseline.sourceUrl,checkedAt,examined:rows.filter(r=>!r.name.includes('עודפים')).length,included:branches.length,coverage:'partial',note:'נבדקו40 רשומות רשמיות;2 סניפי עודפים הופרדו מהיקף38 חנויות רגילות. נכללו רק יעדי Waze עשרוניים מפורשים התואמים לשדות הסניף ולמתחם שאומת. מרבית יעדי המקור רשומים במעלות/דקות/שניות בסדר צירים הפוך ולא תוקנו. עודפים ומיקום ללא הצלבה נשארו לבירור.',skipped}};
const target=new URL('../candidates/rikushet-round9.json',import.meta.url),temp=new URL('../candidates/rikushet-round9.json.tmp',import.meta.url);
await writeFile(temp,JSON.stringify(output,null,2)+'\n');await rename(temp,target);
console.log(JSON.stringify({store,examined:rows.length,included:branches.length,skipped:skipped.length}));
