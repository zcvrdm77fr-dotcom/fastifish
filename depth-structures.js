(function(){
'use strict';
if(window.__fastFishingDepthStructuresLoaded)return;
window.__fastFishingDepthStructuresLoaded=true;

const WFS='https://julkinen.traficom.fi/inspirepalvelu/avoin/wfs';
const INLAND_MANIFEST='/inland-depth/manifest.json';
const MIN_ZOOM=10,DEBOUNCE=500,MAX_CONTOURS=2600,MAX_AREAS=1200,MAX_SOUNDINGS=900,MAX_SAMPLES=1700;
const WFS_UTILS=import('/depth-wfs-utils.js').catch(()=>null);
let map=null,timer=null,token=0,cacheBounds=null,cache=[],prevClassifier=null,layers=null,capPromise=null,lastDiag=null,inlandManifestPromise=null;
const inlandTileCache=new Map();

const META={
 pike_flat:{score:95,species:['hauki','ahven'],fi:'Haukimatala 0–3 m',en:'Pike flat 0–3 m',reasonFi:'0–3 metrin tasanne on tyypillinen hauen ruokailu- ja suoja-alue. Vieressä oleva syvempi vesi tekee siitä vielä paremman.',reasonEn:'A 0–3 m flat is classic pike feeding and cover habitat, especially next to deeper water.'},
 shallow_edge:{score:94,species:['hauki','ahven','kuha'],fi:'Matalan reuna 3–6 m',en:'Shallow edge 3–6 m',reasonFi:'Matalan ja syvemmän veden raja on vahva kulku- ja syöntirakenne hauelle, ahvenelle ja kuhalle.',reasonEn:'The transition from shallow to deeper water is a strong travel and feeding structure.'},
 depth_break:{score:96,species:['ahven','kuha','hauki','siika'],fi:'Syvyyspenkka',en:'Depth break',reasonFi:'Lähekkäiset eri syvyyskäyrät kertovat todellisesta pudotuksesta. Penkan ylä- ja alareuna ovat petokalojen tyypillisiä kulkulinjoja.',reasonEn:'Closely spaced contours indicate a real drop-off; its top and base are common predator travel lines.'},
 steep_break:{score:99,species:['ahven','kuha','siika','taimen'],fi:'Jyrkkä syvyyspenkka',en:'Steep depth break',reasonFi:'Syvyys muuttuu nopeasti lyhyellä matkalla. Jyrkkä reuna yhdistää ruokailualueen ja syvän veden suojan.',reasonEn:'Depth changes rapidly over a short distance, placing feeding water beside deep-water security.'},
 deep_edge:{score:93,species:['kuha','ahven','siika'],fi:'Syvänteen reuna',en:'Deep-hole edge',reasonFi:'Syvemmän altaan tai montun reuna on kuhalle ja ahvenelle vahva syvyydenvaihdos.',reasonEn:'The edge of a deeper basin is a strong depth transition for zander and perch.'},
 sounding_break:{score:91,species:['kuha','ahven','hauki'],fi:'Luotauspisteiden syvyysvaihdos',en:'Sounding depth change',reasonFi:'Lähekkäisissä virallisissa syvyyspisteissä on suuri ero, mikä viittaa penkkaan tai montun reunaan.',reasonEn:'Nearby official soundings differ sharply, indicating a likely break or basin edge.'}
};

const rad=d=>d*Math.PI/180,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function dist(a,b){const R=6371000,dla=rad(b.lat-a.lat),dlo=rad(b.lon-a.lon),s=Math.sin(dla/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlo/2)**2;return 2*R*Math.asin(Math.sqrt(s));}
function avg(ps){if(!ps.length)return null;let a=0,o=0;for(const p of ps){a+=p.lat;o+=p.lon;}return{lat:a/ps.length,lon:o/ps.length};}
function expanded(b,p=.28){const la=(b.getNorth()-b.getSouth())*p,lo=(b.getEast()-b.getWest())*p;return{south:Math.max(59.2,b.getSouth()-la),west:Math.max(18.6,b.getWest()-lo),north:Math.min(70.5,b.getNorth()+la),east:Math.min(32,b.getEast()+lo)};}
function contains(o,b){return o&&b.getSouth()>=o.south&&b.getWest()>=o.west&&b.getNorth()<=o.north&&b.getEast()<=o.east;}

async function responseText(url,accept,ms=10000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
 try{
  const r=await fetch(url,{signal:c.signal,headers:{Accept:accept||'*/*'}});
  const body=await r.text();
  return{ok:r.ok,status:r.status,statusText:r.statusText,contentType:r.headers.get('content-type')||'',body};
 }finally{clearTimeout(t)}
}

function localElements(root,names){
 const wanted=new Set(Array.isArray(names)?names:[names]);
 return[...root.getElementsByTagName('*')].filter(el=>wanted.has(el.localName||String(el.nodeName||'').split(':').pop()));
}
function firstLocal(root,names){return localElements(root,names)[0]||null;}
function localText(root,name){return(firstLocal(root,name)?.textContent||'').trim();}

function parseCapsLocal(s){
 const x=new DOMParser().parseFromString(s,'application/xml');
 if(localElements(x,'parsererror').length)throw Error('GetCapabilities XML parse failed');
 const e=localElements(x,'FeatureType').map(f=>{const n=localText(f,'Name'),t=localText(f,'Title');return{name:n,hay:(n+' '+t).toLowerCase()}}).filter(x=>x.name);
 const pick=(exact,keys)=>{for(const q of exact){const z=e.find(v=>v.name===q||v.name.endsWith(':'+q));if(z)return z.name;}return e.find(v=>keys.some(k=>v.hay.includes(k)))?.name||null};
 const formats=localElements(x,['Format','Value']).map(n=>(n.textContent||'').trim()).filter(v=>/json|gml|xml/i.test(v));
 return{layers:{contour:pick(['DepthContour_L'],['depthcontour','syvyyskäyr','syvyyskayr','depcont']),area:pick(['DepthArea_A'],['deptharea','syvyysalue','depare']),sounding:pick(['Sounding_P'],['sounding','syvyyspiste','soundg'])},formats:[...new Set(formats)]};
}

async function discover(){
 if(layers)return layers;
 if(!capPromise)capPromise=(async()=>{
  const utils=await WFS_UTILS;
  const errors=[];
  for(const version of ['2.0.0','1.1.0']){
   try{
    const url=`${WFS}?service=WFS&version=${version}&request=GetCapabilities`;
    const r=await responseText(url,'application/xml,text/xml,*/*',9000);
    if(!r.ok){errors.push(`GetCapabilities ${version}: HTTP ${r.status}`);continue;}
    const parsed=utils?.parseWfsCapabilities?utils.parseWfsCapabilities(r.body):parseCapsLocal(r.body);
    const found=parsed?.layers||{};
    if(found.contour||found.area||found.sounding){
     return{contour:found.contour||'DepthContour_L',area:found.area||'DepthArea_A',sounding:found.sounding||'Sounding_P',formats:parsed.formats||[],capabilitiesVersion:version,capabilitiesErrors:errors};
    }
    errors.push(`GetCapabilities ${version}: syvyyslayereita ei löytynyt`);
   }catch(e){errors.push(`GetCapabilities ${version}: ${e?.name==='AbortError'?'timeout':(e?.message||'virhe')}`)}
  }
  return{contour:'DepthContour_L',area:'DepthArea_A',sounding:'Sounding_P',formats:[],capabilitiesVersion:null,capabilitiesErrors:errors};
 })();
 layers=await capPromise;
 return layers;
}

function coordinatePairs(text){
 const nums=String(text||'').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite),out=[];
 for(let i=0;i+1<nums.length;i+=2){
  let a=nums[i],b=nums[i+1],lon=a,lat=b;
  if(a>=58&&a<=72&&b>=17&&b<=33){lat=a;lon=b;}
  else if(a>=17&&a<=33&&b>=58&&b<=72){lon=a;lat=b;}
  if(lat>=-90&&lat<=90&&lon>=-180&&lon<=180)out.push([lon,lat]);
 }
 return out;
}

function gmlFeatures(xml){
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(localElements(doc,'parsererror').length)throw Error('GML/XML parse failed');
 const members=localElements(doc,['member','featureMember']);
 const out=[];
 for(const member of members){
  const feature=[...member.children][0];
  if(!feature)continue;
  const props={};
  for(const child of feature.children){
   const local=(child.localName||child.nodeName||'').toLowerCase();
   if(/geom|shape|position|location|point|curve|surface/.test(local))continue;
   if(!firstLocal(child,['pos','posList','coordinates','Point','LineString','Polygon','Curve','Surface','MultiPoint','MultiLineString','MultiCurve','MultiSurface','MultiPolygon'])){
    const value=(child.textContent||'').trim();
    if(value&&value.length<500)props[child.localName||child.nodeName]=value;
   }
  }
  const geomRoot=firstLocal(feature,['Point','LineString','Curve','Polygon','Surface','MultiPoint','MultiLineString','MultiCurve','MultiSurface','MultiPolygon']);
  if(!geomRoot)continue;
  const name=(geomRoot.localName||geomRoot.nodeName||'').toLowerCase();
  const posLists=localElements(geomRoot,['posList','coordinates']).map(n=>coordinatePairs(n.textContent)).filter(a=>a.length);
  const positions=localElements(geomRoot,'pos').map(n=>coordinatePairs(n.textContent)[0]).filter(Boolean);
  let geometry=null;
  if(name.includes('point')){
   const p=positions[0]||posLists[0]?.[0];if(p)geometry={type:'Point',coordinates:p};
  }else if(name.includes('polygon')||name.includes('surface')){
   const ring=posLists[0]||positions;if(ring?.length)geometry={type:'Polygon',coordinates:[ring]};
  }else{
   const line=posLists[0]||positions;if(line?.length)geometry={type:'LineString',coordinates:line};
  }
  const gmlId=feature.getAttributeNS?.('http://www.opengis.net/gml/3.2','id')||feature.getAttributeNS?.('http://www.opengis.net/gml','id')||feature.getAttribute('gml:id')||feature.getAttribute('id')||undefined;
  if(geometry)out.push({type:'Feature',id:gmlId,properties:props,geometry});
 }
 return out;
}

function fallbackCandidates(type,b,count,formats){
 const bbox=`${b.west},${b.south},${b.east},${b.north},EPSG:4326`;
 const jsonFormats=[...new Set([...(formats||[]).filter(v=>/json/i.test(v)),'application/json'])];
 const out=[];
 for(const outputFormat of jsonFormats){
  for(const version of ['2.0.0','1.1.0']){
   const p=new URLSearchParams({service:'WFS',version,request:'GetFeature',srsName:'EPSG:4326',bbox});
   p.set(version==='2.0.0'?'typeNames':'typeName',type);
   p.set(version==='2.0.0'?'count':'maxFeatures',String(count));
   p.set('outputFormat',outputFormat);
   out.push({version,outputFormat,responseKind:'json',url:`${WFS}?${p}`});
  }
 }
 for(const version of ['2.0.0','1.1.0']){
  const p=new URLSearchParams({service:'WFS',version,request:'GetFeature',srsName:'EPSG:4326',bbox});
  p.set(version==='2.0.0'?'typeNames':'typeName',type);
  p.set(version==='2.0.0'?'count':'maxFeatures',String(count));
  out.push({version,outputFormat:null,responseKind:'gml',url:`${WFS}?${p}`});
 }
 return out;
}

async function wfs(type,b,count,formats){
 if(!type)return{features:[],attempt:null};
 const utils=await WFS_UTILS;
 const candidates=utils?.buildWfsCandidates?utils.buildWfsCandidates({endpoint:WFS,typeName:type,bounds:b,count,formats}):fallbackCandidates(type,b,count,formats);
 const attempts=[];
 for(const candidate of candidates){
  try{
   const r=await responseText(candidate.url,'application/json,application/geo+json,application/xml,text/xml;q=.8,*/*;q=.2',12000);
   const describe=message=>utils?.describeWfsAttempt?utils.describeWfsAttempt({typeName:type,version:candidate.version,outputFormat:candidate.outputFormat,status:r.status,message}):`${type} · WFS ${candidate.version} · ${candidate.outputFormat||'GML'} · HTTP ${r.status}${message?` · ${message}`:''}`;
   if(!r.ok){attempts.push(describe((r.body||'').replace(/\s+/g,' ').slice(0,120)));continue;}
   if(candidate.responseKind==='json'||/json/i.test(r.contentType)){
    try{
     const data=JSON.parse(r.body);
     if(Array.isArray(data.features))return{features:data.features,attempt:describe(data.features.length?'OK': 'ei kohteita')};
     attempts.push(describe('JSON-vastauksessa ei features-taulukkoa'));
     continue;
    }catch(e){attempts.push(describe('JSON-jäsennys epäonnistui'));}
   }
   try{
    const features=gmlFeatures(r.body);
    return{features,attempt:describe(features.length?'GML fallback OK':'GML fallback: ei kohteita')};
   }catch(e){attempts.push(describe(e?.message||'GML-jäsennys epäonnistui'));}
  }catch(e){
   const msg=e?.name==='AbortError'?'timeout':(e?.message||'verkkovirhe');
   attempts.push(`${type} · WFS ${candidate.version} · ${candidate.outputFormat||'GML'} · ${msg}`);
  }
 }
 const err=Error(`Traficom WFS failed for ${type}`);err.attempts=attempts;throw err;
}

function parts(g){if(!g)return[];const c=g.coordinates;if(g.type==='Point')return[[c]];if(g.type==='MultiPoint')return c.map(x=>[x]);if(g.type==='LineString')return[c];if(g.type==='MultiLineString'||g.type==='Polygon')return c;if(g.type==='MultiPolygon')return c.flat();return[];}
function pt(c){if(!Array.isArray(c)||c.length<2)return null;const lon=+c[0],lat=+c[1];return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null;}
function center(f){const ps=[];for(const p of parts(f.geometry))for(const c of p){const q=pt(c);if(q)ps.push(q);if(ps.length>500)break}return avg(ps);}
function num(props,exact,regex){for(const q of exact){const k=Object.keys(props||{}).find(x=>x.toLowerCase()===q.toLowerCase());if(k){const n=+String(props[k]).replace(',','.');if(Number.isFinite(n))return n}}for(const[k,v]of Object.entries(props||{})){if(!regex.some(r=>r.test(k)))continue;const n=+String(v).replace(',','.');if(Number.isFinite(n))return n}return null;}
function contourDepth(p){const n=num(p,['VALDCO','DEPTH','SYVYYS','SYVYYS_M','ARVO','Z'],[/valdco/i,/depth/i,/syv/i,/contour.*val/i]);return n!=null&&n>=0&&n<=500?n:null;}
function soundingDepth(p){const n=num(p,['VALSOU','DEPTH','SYVYYS','SYVYYS_M'],[/valsou/i,/sound.*depth/i,/depth/i,/syv/i]);return n!=null&&n>=0&&n<=500?n:null;}
function range(p){let a=num(p,['DRVAL1','MINDEPTH','SYVYYS_MIN'],[/drval1/i,/min.*depth/i,/syv.*min/i]),b=num(p,['DRVAL2','MAXDEPTH','SYVYYS_MAX'],[/drval2/i,/max.*depth/i,/syv.*max/i]);if(a==null&&b==null){const g=contourDepth(p);if(g!=null){a=0;b=g}}if(a==null&&b!=null)a=0;if(b==null&&a!=null)b=a;return a!=null&&b!=null?{min:Math.min(a,b),max:Math.max(a,b)}:null;}
function sample(part,d,id){const ps=part.map(pt).filter(Boolean);if(ps.length<2)return[];const out=[],spacing=d<=6?115:d<=12?165:230;let carry=0;for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i],L=dist(a,b);if(!L)continue;let x=Math.max(spacing-carry,0);while(x<=L&&out.length<90){const t=x/L;out.push({lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t,depth:d,source:id});x+=spacing}carry=(carry+L)%spacing}if(!out.length)out.push({...ps[Math.floor(ps.length/2)],depth:d,source:id});return out;}
function contourSamples(fs){const out=[];for(let i=0;i<fs.length&&out.length<MAX_SAMPLES;i++){const d=contourDepth(fs[i].properties||{});if(d==null)continue;for(const p of parts(fs[i].geometry)){out.push(...sample(p,d,fs[i].id||i));if(out.length>=MAX_SAMPLES)break}}return out.slice(0,MAX_SAMPLES);}
function elem(kind,p,x={}){const a=Number.isFinite(x.depth)?x.depth:null,b=Number.isFinite(x.otherDepth)?x.otherDepth:null,label=a!=null&&b!=null?`${Math.min(a,b).toFixed(1)}–${Math.max(a,b).toFixed(1)} m`:a!=null?`${a.toFixed(1)} m`:'';return{type:'depth',id:`depth-${kind}-${x.id||Math.random().toString(36).slice(2)}`,lat:p.lat,lon:p.lon,tags:{name:label?`${META[kind].fi} ${label}`:META[kind].fi},_fastDepthStructure:true,_depthType:kind,_gradient:x.gradient||0,_depth:a,_otherDepth:b,_sourceUrl:'https://www.traficom.fi/fi/merikartoitus/suomalaiset-merikartat/merikarttojen-ja-merikartta-aineistojen-jakelukanavat'};}
function breaks(ss){const size=.0022,g=new Map();ss.forEach((p,i)=>{const k=`${Math.floor(p.lat/size)},${Math.floor(p.lon/size)}`;(g.get(k)||g.set(k,[]).get(k)).push(i)});const out=[],seen=new Set();for(let i=0;i<ss.length;i++){const a=ss[i],cy=Math.floor(a.lat/size),cx=Math.floor(a.lon/size);let best=null;for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++)for(const j of g.get(`${cy+y},${cx+x}`)||[]){if(j<=i)continue;const b=ss[j],dd=Math.abs(a.depth-b.depth);if(dd<2.5||a.source===b.source)continue;const di=dist(a,b);if(di<18||di>230)continue;const gr=dd/di;if(!best||gr>best.gr)best={b,dd,di,gr}}if(!best)continue;const sh=Math.min(a.depth,best.b.depth),de=Math.max(a.depth,best.b.depth);let k=null;if(best.dd>=5&&best.di<=120)k='steep_break';else if(best.dd>=3&&best.di<=180)k=sh<=6?'shallow_edge':'depth_break';else if(sh<=3.5&&de>=5)k='shallow_edge';else if(sh>=6&&best.dd>=4)k='deep_edge';if(!k)continue;const m={lat:(a.lat+best.b.lat)/2,lon:(a.lon+best.b.lon)/2},dk=`${k}:${Math.round(m.lat*2500)}:${Math.round(m.lon*2500)}`;if(seen.has(dk))continue;seen.add(dk);out.push(elem(k,m,{id:`${i}-${Math.round(sh*10)}-${Math.round(de*10)}`,depth:sh,otherDepth:de,gradient:best.gr}))}return out.sort((a,b)=>b._gradient-a._gradient).slice(0,180);}
function areas(fs){const out=[],seen=new Set();for(let i=0;i<fs.length;i++){const r=range(fs[i].properties||{}),c=center(fs[i]);if(!r||!c)continue;let k=null;if(r.max<=3.5)k='pike_flat';else if(r.min<=3.5&&r.max<=6.5)k='shallow_edge';else if(r.min>=6&&r.max>=10)k='deep_edge';if(!k)continue;const dk=`${k}:${Math.round(c.lat*1800)}:${Math.round(c.lon*1800)}`;if(seen.has(dk))continue;seen.add(dk);out.push(elem(k,c,{id:`area-${i}`,depth:r.min,otherDepth:r.max}));if(out.length>=100)break}return out;}
function soundings(fs){const ps=[];for(let i=0;i<fs.length&&ps.length<MAX_SOUNDINGS;i++){const d=soundingDepth(fs[i].properties||{}),c=center(fs[i]);if(d!=null&&c)ps.push({...c,depth:d})}const out=[],seen=new Set();for(let i=0;i<ps.length;i++){let best=null;for(let j=i+1;j<Math.min(ps.length,i+90);j++){const dd=Math.abs(ps[i].depth-ps[j].depth);if(dd<3.5)continue;const di=dist(ps[i],ps[j]);if(di<18||di>160)continue;const gr=dd/di;if(!best||gr>best.gr)best={p:ps[j],dd,di,gr}}if(!best)continue;const m={lat:(ps[i].lat+best.p.lat)/2,lon:(ps[i].lon+best.p.lon)/2},dk=`${Math.round(m.lat*2200)}:${Math.round(m.lon*2200)}`;if(seen.has(dk))continue;seen.add(dk);out.push(elem('sounding_break',m,{id:`s-${i}`,depth:Math.min(ps[i].depth,best.p.depth),otherDepth:Math.max(ps[i].depth,best.p.depth),gradient:best.gr}))}return out.sort((a,b)=>b._gradient-a._gradient).slice(0,60);}

async function loadDepth(b){
 const n=await discover();
 const marine=await Promise.allSettled([
  wfs(n.contour,b,MAX_CONTOURS,n.formats),
  wfs(n.area,b,MAX_AREAS,n.formats),
  wfs(n.sounding,b,MAX_SOUNDINGS,n.formats)
 ]);
 const inland=await loadInland(b).catch(()=>[]);
 const values=marine.map(r=>r.status==='fulfilled'?r.value:null);
 const contourF=values[0]?.features||[],areaF=values[1]?.features||[],soundF=values[2]?.features||[];
 const cs=contourSamples(contourF),br=breaks(cs),ar=areas(areaF),so=br.length<20?soundings(soundF):[];
 const errors=marine.map((r,i)=>r.status==='rejected'?{layer:[n.contour,n.area,n.sounding][i],attempts:r.reason?.attempts||[r.reason?.message||'WFS-virhe']}:null).filter(Boolean);
 const attempts=values.map(v=>v?.attempt).filter(Boolean);
 const failed=marine.every(r=>r.status==='rejected');
 return{items:[...br,...ar,...so,...inland],failed,areaFeatures:areaF,diag:{contours:contourF.length,samples:cs.length,depthAreas:areaF.length,soundings:soundF.length,breaks:br.length,areaSpots:ar.length,soundingSpots:so.length,inlandSpots:inland.length,layers:{contour:n.contour,area:n.area,sounding:n.sounding},capabilitiesVersion:n.capabilitiesVersion,capabilitiesErrors:n.capabilitiesErrors||[],wfsErrors:errors,wfsAttempts:attempts,marineFailed:failed,marineEmpty:!failed&&contourF.length===0&&areaF.length===0&&soundF.length===0}};
}

async function inlandManifest(){if(!inlandManifestPromise)inlandManifestPromise=fetch(INLAND_MANIFEST,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).catch(()=>null);return inlandManifestPromise;}
function inlandKeys(b,m){const z=Number(m?.tileSizeDegrees)||2,keys=[];for(let la=Math.floor(b.south/z)*z;la<=Math.floor(b.north/z)*z;la+=z)for(let lo=Math.floor(b.west/z)*z;lo<=Math.floor(b.east/z)*z;lo+=z)keys.push(`${la}_${lo}`);return keys;}
async function inlandTile(key){if(inlandTileCache.has(key))return inlandTileCache.get(key);const p=fetch(`/inland-depth/tiles/${encodeURIComponent(key)}.json`,{cache:'force-cache'}).then(r=>r.ok?r.json():{spots:[]}).then(d=>Array.isArray(d.spots)?d.spots:[]).catch(()=>[]);inlandTileCache.set(key,p);return p;}
async function loadInland(b){const m=await inlandManifest();if(!m||!Array.isArray(m.tiles))return[];const allowed=new Set(m.tiles),keys=inlandKeys(b,m).filter(k=>allowed.has(k)),arr=(await Promise.all(keys.map(inlandTile))).flat();return arr.filter(s=>s&&s.lat>=b.south&&s.lat<=b.north&&s.lon>=b.west&&s.lon<=b.east).map(s=>{const kind=META[s.kind]?s.kind:'shallow_edge',lo=Number(s.minDepth),hi=Number(s.maxDepth),nm=s.name?`${s.name} · ${META[kind].fi}`:META[kind].fi;return{type:'syke-depth',id:s.id||`syke-${s.lat}-${s.lon}`,lat:Number(s.lat),lon:Number(s.lon),tags:{name:nm},_fastDepthStructure:true,_depthType:kind,_baseScore:Number(s.score)||META[kind].score,_depth:Number.isFinite(lo)?lo:null,_otherDepth:Number.isFinite(hi)?hi:null,_sourceUrl:m.sourceUrl||'https://www.avoindata.fi/data/fi/dataset/jarvien-ja-jokien-syvyysaineisto'};});}

function classify(el,species){const m=META[el._depthType];if(!m)return null;let score=Number.isFinite(el._baseScore)?el._baseScore:m.score;if(el._gradient)score+=clamp(Math.round(el._gradient*55),0,3);if(species&&species!=='all')score+=m.species.includes(species)?5:-12;if(species==='hauki'&&el._depthType==='pike_flat')score+=3;if(species==='kuha'&&['depth_break','steep_break','deep_edge'].includes(el._depthType))score+=2;score=clamp(Math.round(score),42,99);const fi=typeof currentLang==='undefined'||currentLang==='fi';return{id:String(el.id),lat:el.lat,lon:el.lon,score,structureScore:score,kind:fi?m.fi:m.en,name:el.tags?.name||(fi?m.fi:m.en),reason:fi?m.reasonFi:m.reasonEn,warning:fi?'Syvyystieto on suunnittelun apu, ei navigointiohje. Tarkista virallinen merikartta ja paikalliset olosuhteet.':'Depth data is for planning, not navigation. Check an official chart and local conditions.',species:m.species,typeKey:el._depthType,sourceUrl:el._sourceUrl};}
function patch(){if(prevClassifier||typeof classifyPotentialSpot!=='function')return;prevClassifier=classifyPotentialSpot;classifyPotentialSpot=function(el,s){if(el?._fastDepthStructure)return classify(el,s);const r=prevClassifier(el,s);if(r?.typeKey==='strait'){r.score=61;r.structureScore=61;r.kind=(typeof currentLang==='undefined'||currentLang==='fi')?'Salmi (heikko vihje)':'Strait (weak signal)'}return r};}
function base(){return typeof potentialSpotLastElements!=='undefined'&&Array.isArray(potentialSpotLastElements)?potentialSpotLastElements.filter(e=>!e?._fastDepthStructure):[];}
function render(items){if(typeof renderPotentialSpotMarkers==='function')renderPotentialSpotMarkers(base().concat(items||[]));}
function status(d){
 if(typeof potentialSpotStatus!=='function'||!d)return;
 const n=d.breaks+d.areaSpots+d.soundingSpots,syke=d.inlandSpots||0;
 if(d.marineFailed){
  const detail=d.wfsErrors?.[0]?.attempts?.slice(-1)[0]||'Traficom WFS ei vastannut';
  potentialSpotStatus(`Traficom WFS epäonnistui (${detail}). SYKE-sisävesikohteita ${syke}; meridatan virhettä ei peitetä fallbackilla.`,`Traficom WFS failed (${detail}). SYKE inland spots ${syke}; the marine-data failure is not hidden by the fallback.`);return;
 }
 if(d.marineEmpty){potentialSpotStatus(`Traficom: tällä kartta-alueella ei palautunut syvyysdataa. SYKE ${syke} sisävesikohdetta.`,`Traficom returned no depth data for this map area. SYKE ${syke} inland spots.`);return;}
 const partial=d.wfsErrors?.length?` · ${d.wfsErrors.length} WFS-layeria epäonnistui (diagnostiikka konsolissa)`:'';
 potentialSpotStatus(`Syvyysdata: Traficom ${d.contours} käyrää + ${d.depthAreas} aluetta → ${n} merikohdetta · SYKE ${syke} sisävesikohdetta${partial}.`,`Depth data: Traficom ${d.contours} contours + ${d.depthAreas} areas → ${n} marine spots · SYKE ${syke} inland spots${partial}.`);
}

async function refresh(force){
 if(!map||typeof potentialSpotsWanted==='undefined'||!potentialSpotsWanted)return;
 if(map.getZoom()<MIN_ZOOM){cache=[];cacheBounds=null;return}
 const vis=map.getBounds();if(!force&&contains(cacheBounds,vis)){render(cache);setTimeout(()=>status(lastDiag),80);return}
 const my=++token,b=expanded(vis);
 const r=await loadDepth(b).catch(e=>({items:[],failed:true,diag:{contours:0,depthAreas:0,soundings:0,breaks:0,areaSpots:0,soundingSpots:0,inlandSpots:0,marineFailed:true,wfsErrors:[{attempts:[e?.message||'tuntematon virhe']}],wfsAttempts:[]}}));
 if(my!==token||!potentialSpotsWanted)return;
 lastDiag=r.diag;
 window.__fastFishingDepthDiagnostics=lastDiag;
 if(r.failed){setTimeout(()=>status(lastDiag),80);return}
 cacheBounds=b;cache=r.items;render(cache);setTimeout(()=>status(lastDiag),100);
}
function schedule(f){clearTimeout(timer);timer=setTimeout(()=>refresh(!!f),DEBOUNCE);}
function ui(){const q=document.getElementById('potentialSpotQuality');if(!q)return;for(const o of q.options){if(o.value==='80')o.textContent=(typeof currentLang==='undefined'||currentLang==='fi')?'Hyvät rakenteet 80+':'Good structures 80+';if(o.value==='75')o.textContent=(typeof currentLang==='undefined'||currentLang==='fi')?'Laajempi haku 75+':'Broader search 75+';}}

function installMapPolish(){
 if(document.getElementById('ff-map-polish'))return;
 const style=document.createElement('style');style.id='ff-map-polish';style.textContent=`
#seaChartWrap.sea-chart-full-wrap{height:clamp(560px,68vh,780px);border-radius:22px;box-shadow:0 18px 50px rgba(23,52,47,.16);isolation:isolate}
#seaChartMap{cursor:grab;outline:none}
#seaChartMap:active{cursor:grabbing}
#seaChartMap:focus-visible{outline:3px solid var(--orange);outline-offset:-3px}
.sea-chart-activate-overlay{inset:auto 12px 12px auto;background:transparent;pointer-events:none;align-items:flex-end;justify-content:flex-end}
.sea-chart-activate-overlay .sea-chart-activate-btn{pointer-events:auto;min-height:44px;padding:0 15px;border-radius:999px;font-size:.82rem;box-shadow:0 8px 26px rgba(0,0,0,.28);backdrop-filter:blur(12px)}
.sea-chart-toolbar{left:12px;right:auto;width:min(390px,calc(100% - 24px));max-height:min(390px,52%);overflow:auto;overscroll-behavior:contain;border-radius:18px;padding:10px;scrollbar-width:thin}
.sea-chart-toolbar .btn{min-height:40px}
.sea-chart-toggle{min-height:36px}
.sea-chart-hud{gap:6px;max-width:calc(100% - 24px)}
.sea-chart-hud .condition-chip{min-width:0;min-height:38px;padding:6px 9px}
.potential-results-panel{box-shadow:0 16px 45px rgba(0,0,0,.2);backdrop-filter:blur(16px)}
.leaflet-popup-content-wrapper{border-radius:16px;box-shadow:0 14px 38px rgba(0,0,0,.22)}
.leaflet-popup-content{margin:14px 16px;max-width:min(310px,72vw)}
.leaflet-control-attribution{font-size:10px!important;background:rgba(255,255,255,.76)!important;backdrop-filter:blur(6px)}
html[data-theme="dark"] .leaflet-control-attribution{background:rgba(13,26,22,.78)!important;color:#d7e5df}
.sea-chart-maximized .sea-chart-activate-overlay{display:none!important}
@media(max-width:680px){
 #merikartta.shell,#merikartta{padding-left:8px;padding-right:8px}
 .sea-chart-compact-head{padding-inline:4px;margin-bottom:10px}
 .sea-chart-compact-head p{font-size:.88rem;line-height:1.35}
 #seaChartWrap.sea-chart-full-wrap{height:clamp(470px,calc(100svh - 150px),720px)!important;min-height:0!important;border-radius:18px!important;margin-inline:0}
 .sea-chart-toolbar{top:44px;left:8px;right:8px;width:auto;max-height:31svh;padding:8px;border-radius:15px}
 .sea-chart-toolbar .btn{min-height:42px;padding-inline:10px}
 .sea-toolbar-row2{gap:7px;margin-top:5px;padding-top:5px}
 .sea-chart-activate-overlay{right:8px;bottom:58px}
 .sea-chart-activate-overlay .sea-chart-activate-btn{min-height:46px;max-width:190px;white-space:normal;line-height:1.1}
 .sea-chart-top-actions{top:8px;right:8px}
 .potential-results-panel{left:8px!important;right:8px!important;bottom:62px!important;max-height:44%!important;border-radius:15px!important}
 .sea-chart-hud{left:8px!important;right:8px!important;bottom:8px!important;max-width:none!important;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px}
 .sea-chart-hud .condition-chip{flex:0 0 auto;min-height:42px}
 .leaflet-popup-content{max-width:76vw;margin:12px 14px}
}
@media(min-width:681px){.sea-chart-maximized .sea-chart-toolbar{max-height:calc(100svh - 110px)}}
`;
 document.head.appendChild(style);
}

function polishMapInstance(){
 if(typeof seaChartMap==='undefined'||!seaChartMap)return false;
 installMapPolish();
 const wrap=document.getElementById('seaChartWrap'),container=seaChartMap.getContainer?.();
 if(!wrap||!container)return false;
 if(!container.dataset.ffPolished){
  container.dataset.ffPolished='1';
  container.tabIndex=0;
  container.setAttribute('role','application');
  container.setAttribute('aria-label','FastFishing kalastuskartta. Vedä karttaa hiirellä tai sormella ja zoomaa nipistämällä.');
  if(typeof setSeaChartInteractive==='function')setSeaChartInteractive(true);
  seaChartMap.keyboard?.enable();
  seaChartMap.scrollWheelZoom?.disable();
  const wheelOn=()=>seaChartMap.scrollWheelZoom?.enable(),wheelOff=()=>{if(!wrap.classList.contains('sea-chart-maximized'))seaChartMap.scrollWheelZoom?.disable()};
  container.addEventListener('click',()=>{container.focus({preventScroll:true});if(matchMedia('(pointer:fine)').matches)wheelOn();});
  container.addEventListener('focus',()=>{if(matchMedia('(pointer:fine)').matches)wheelOn();});
  container.addEventListener('blur',wheelOff);container.addEventListener('mouseleave',wheelOff);
  const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>seaChartMap.invalidateSize({pan:false})):null;ro?.observe(wrap);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&wrap.classList.contains('sea-chart-maximized')&&typeof exitSeaChartFullscreen==='function')exitSeaChartFullscreen();});
 }
 return true;
}

function attach(){
 patch();ui();installMapPolish();
 if(typeof seaChartMap==='undefined'||!seaChartMap||typeof renderPotentialSpotMarkers!=='function')return false;
 polishMapInstance();
 if(map===seaChartMap)return true;
 map=seaChartMap;map.on('moveend zoomend',()=>schedule(false));
 document.getElementById('potentialSpotsToggle')?.addEventListener('change',e=>{if(e.target.checked)schedule(true)});
 document.getElementById('potentialSpotSpecies')?.addEventListener('change',()=>schedule(false));
 if(typeof potentialSpotsWanted!=='undefined'&&potentialSpotsWanted)schedule(true);
 return true;
}

window.FastFishingDepthDiagnostics=()=>lastDiag;
installMapPolish();
let tries=0;const boot=setInterval(()=>{tries++;polishMapInstance();if(attach()||tries>180)clearInterval(boot)},400);
})();
