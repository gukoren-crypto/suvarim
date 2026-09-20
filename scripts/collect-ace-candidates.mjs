// Official public ACE locator. Brand-filtered reviewed candidates only.
import {readFile,writeFile,rename} from 'node:fs/promises';
const baseline=JSON.parse(await readFile(new URL('./data/ace-round8-reviewed.json',import.meta.url),'utf8'));
const response=await fetch(baseline.sourceUrl,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error(`Official locator HTTP ${response.status}`);
const html=await response.text();
const field=(s,re)=>{const m=s.match(re);if(!m)throw Error('Official locator structure changed');return m[1]};
const rows=html.split('<div class="store-item"').slice(1).map(s=>{
  const waze=field(s,/href="(https:\/\/waze.com[^\"]+)"/).replaceAll('&amp;','&');
  const target=new URL(waze);const ll=target.searchParams.get('ll')?.split(',').map(Number);
  if(target.hostname!=='waze.com'||target.searchParams.get('navigate')!=='yes'||ll?.length!==2)throw Error('Missing explicit navigation destination');
  return{id:field(s,/\/stores\/branch\/index\/id\/(\d+)/),brand:field(s,/data-brand="([^"]+)"/),city:field(s,/data-city="([^"]+)"/),name:field(s,/<h2>([^<]+)<\/h2>/),address:field(s,/<\/div><p>([^<]+)<\/p>/),lat:ll[0],lng:ll[1],waze};
});
if(rows.length<baseline.examined||new Set(rows.map(r=>r.id)).size!==rows.length||baseline.reviewed.some(old=>!rows.some(r=>r.id===old.id)))throw Error('Incomplete or duplicate official response');
const branches=[],skipped=[],store='ACE',checkedAt=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
for(const row of rows){
  const old=baseline.reviewed.find(r=>r.id===row.id);
  if(old&&Object.keys(old).some(k=>old[k]!==row[k]))throw Error(`Official row ${row.id} changed; review first`);
  if(row.brand==='סניפי_אוטודיפו'||['601','92'].includes(row.id))continue;
  const reason=baseline.exclusions[row.id]||(!old?'new-location-needs-review':null);
  if(reason){skipped.push({officialId:row.id,name:row.name,city:row.city,reason});continue;}
  if(!['סניפי_אייס','סניפים_משותפים_אייס_+_אוטודיפו'].includes(row.brand)||!Number.isFinite(row.lat)||!Number.isFinite(row.lng)||row.lat<29||row.lat>34||row.lng<34||row.lng>36.5)throw Error(`Invalid candidate ${row.id}`);
  branches.push({id:`ace-${row.id}`,store,name:row.name.trim(),city:row.id==='43'?'רגבה':row.city.replaceAll('_',' '),address:row.address,lat:row.lat,lng:row.lng,sourceUrl:`https://www.ace.co.il/stores/branch/index/id/${row.id}`,coordinateSourceUrl:row.waze,checkedAt,locationAccuracy:'address-or-venue'});
}
if(branches.length!==baseline.reviewed.filter(r=>!baseline.exclusions[r.id]).length)throw Error('Reviewed candidate missing');
branches.sort((a,b)=>a.id.localeCompare(b.id));
const output={store,branches,source:{store,aliases:['אייס','ACE','Ace'],sourceUrl:baseline.sourceUrl,checkedAt,examined:rows.filter(r=>r.brand!=='סניפי_אוטודיפו'&&!['601','92'].includes(r.id)).length,included:branches.length,coverage:'partial',note:'יעדי Waze מפורשים מדף הסניפים הרשמי. נכללו רק סניפי ACE וסניפים המוגדרים במקור כמשותפים ACE/AUTODEPOT; אוטודיפו בלבד אינו נכלל. נבדקו29 רשומות במקור המעורב, מהן21 חנויות ACE או משותפות;6 אוטודיפו בלבד ומחסן ומפעל אינם בספירת הרשת. כתובות ומתחמים הוצלבו; לא הוסקו קואורדינטות.',skipped}};
const target=new URL('../candidates/ace-round8.json',import.meta.url),temp=new URL('../candidates/ace-round8.json.tmp',import.meta.url);
await writeFile(temp,JSON.stringify(output,null,2)+'\n');await rename(temp,target);
console.log(JSON.stringify({store,examined:rows.length,included:branches.length,skipped:skipped.length}));
