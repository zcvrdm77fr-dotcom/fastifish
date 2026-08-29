(function(){
'use strict';
if(window.__fastFishingVelmuFishLoaded)return;
window.__fastFishingVelmuFishLoaded=true;

const WMS='https://kartta.luke.fi/geoserver/velmu/wms';
const SPECIES={
  hauki:{layer:'velmu_hauki',fi:'hauen mallinnettu lisääntymisalue',en:'modelled pike reproduction area'},
  ahven:{layer:'velmu_ahven',fi:'ahvenen mallinnettu poikastuotantoalue',en:'modelled perch larval production area'},
  kuha:{layer:'velmu_kuha',fi:'kuhan mallinnettu poikastuotantoalue',en:'modelled zander larval production area'},
  siika:{layer:'velmu_siika',fi:'merikutuisen siian mallinnettu poikastuotantoalue',en:'modelled sea-spawning whitefish larval production area'}
};
let map=null,layer=null,currentKey=null,lastStatusTimer=null;

function removeLayer(){if(layer&&map){try{map.removeLayer(layer);}catch(e){}}layer=null;currentKey=null;}
function selectedSpecies(){return document.getElementById('potentialSpotSpecies')?.value||'all';}
function wanted(){return typeof potentialSpotsWanted!=='undefined'&&potentialSpotsWanted;}
function appendStatus(key){clearTimeout(lastStatusTimer);lastStatusTimer=setTimeout(()=>{if(!SPECIES[key]||typeof potentialSpotStatus!=='function')return;const el=document.getElementById('potentialSpotStatus'),existing=el?.textContent||'',fi=typeof currentLang==='undefined'||currentLang==='fi',label=fi?SPECIES[key].fi:SPECIES[key].en,suffix=fi?` · VELMU: ${label} (malli)`:` · VELMU: ${label} (model)`;if(existing&&!existing.includes('VELMU:'))potentialSpotStatus(existing+suffix,existing+suffix);},450);}
function update(){if(!map)return;const key=selectedSpecies(),meta=SPECIES[key];if(!wanted()||!meta){removeLayer();return;}if(layer&&currentKey===key){appendStatus(key);return;}removeLayer();if(typeof L==='undefined'||!L.tileLayer||!L.tileLayer.wms)return;layer=L.tileLayer.wms(WMS,{layers:meta.layer,format:'image/png',transparent:true,version:'1.1.0',opacity:.27,zIndex:190,attribution:'Luonnonvarakeskus / VELMU · Creative Commons Attribution'});layer.addTo(map);currentKey=key;appendStatus(key);}
function attach(){if(typeof seaChartMap==='undefined'||!seaChartMap)return false;if(map===seaChartMap)return true;map=seaChartMap;document.getElementById('potentialSpotSpecies')?.addEventListener('change',update);document.getElementById('potentialSpotsToggle')?.addEventListener('change',update);update();return true;}
let tries=0;const boot=setInterval(()=>{tries++;if(attach()||tries>180)clearInterval(boot);},400);
})();
