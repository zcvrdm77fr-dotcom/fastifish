import { findBestWindow, recommendForSpecies, supportedSpecies } from './fishing-advice.js';
import { fishingScoreBand } from './score-calibration.js';

const API_BASE = String(window.FASTFISH_API_BASE || '').trim().replace(/\/+$/, '');
const SAVED_KEY = 'ff_saved_places_v1';
const NOTIFY_CHECK_KEY = 'ff_saved_places_last_check';
let activeLocation = null;

function apiUrl(path){ return API_BASE + path; }
function assetUrl(path){ return /^https?:\/\//i.test(path || '') ? path : API_BASE + (path || ''); }
function escapeHtml(value){ const d=document.createElement('div'); d.textContent=value == null ? '' : String(value); return d.innerHTML; }
function readSaved(){ try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; } }
function writeSaved(items){ try { localStorage.setItem(SAVED_KEY, JSON.stringify(items.slice(0, 12))); } catch {} }

async function api(path){
  const response = await fetch(apiUrl(path), { credentials: 'include' });
  if (!response.ok) throw new Error('Tietojen haku epäonnistui.');
  return response.json();
}

function formatHour(iso){
  const d = new Date(iso);
  return d.toLocaleTimeString('fi-FI', { hour:'2-digit', minute:'2-digit' });
}

async function weatherFor(lat, lon){
  const params = new URLSearchParams({
    latitude:String(lat), longitude:String(lon),
    hourly:'temperature_2m,pressure_msl,wind_speed_10m,cloud_cover',
    forecast_days:'2', past_days:'1', timezone:'auto', wind_speed_unit:'ms'
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('Sään haku epäonnistui.');
  const data = await res.json();
  const times = data.hourly?.time || [];
  const now = Date.now();
  return times.map((time, i) => ({
    time,
    hour:new Date(time).getHours(),
    temp:Number(data.hourly.temperature_2m[i]),
    pressure:Number(data.hourly.pressure_msl[i]),
    pressure6hAgo:Number(data.hourly.pressure_msl[Math.max(0, i - 6)]),
    wind:Number(data.hourly.wind_speed_10m[i]),
    cloud:Number(data.hourly.cloud_cover[i])
  })).filter(item => new Date(item.time).getTime() >= now - 30 * 60 * 1000).slice(0, 30);
}

function locate(){
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Sijaintia ei tueta tässä selaimessa.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat:p.coords.latitude, lon:p.coords.longitude, name:'Nykyinen sijainti' }),
      () => reject(new Error('Sijaintia ei saatu. Salli sijainti selaimen asetuksista.')),
      { enableHighAccuracy:false, timeout:10000, maximumAge:10 * 60 * 1000 }
    );
  });
}

function renderSavedPlaces(){
  const wrap = document.getElementById('ffSavedPlaces');
  const select = document.getElementById('ffSavedSelect');
  if (!wrap || !select) return;
  const saved = readSaved();
  select.innerHTML = '<option value="">Valitse tallennettu paikka</option>' + saved.map((p,i)=>`<option value="${i}">${escapeHtml(p.name)}</option>`).join('');
  wrap.innerHTML = saved.length ? saved.map((p,i)=>`<div class="ff-next-saved-row"><button class="btn" type="button" data-ff-place="${i}">${escapeHtml(p.name)}</button><button class="ff-next-close" type="button" aria-label="Poista paikka" data-ff-remove="${i}">×</button></div>`).join('') : '<p class="ff-next-muted">Ei vielä tallennettuja paikkoja.</p>';
  wrap.querySelectorAll('[data-ff-place]').forEach(btn => btn.addEventListener('click', () => useSaved(Number(btn.dataset.ffPlace))));
  wrap.querySelectorAll('[data-ff-remove]').forEach(btn => btn.addEventListener('click', () => { const items=readSaved(); items.splice(Number(btn.dataset.ffRemove),1); writeSaved(items); renderSavedPlaces(); }));
}

async function runAdvice(location){
  const status = document.getElementById('ffNowStatus');
  const result = document.getElementById('ffNowResult');
  const species = document.getElementById('ffSpecies').value;
  activeLocation = location;
  status.textContent = `Haetaan kalakeliä: ${location.name}…`;
  result.hidden = true;
  try {
    const hourly = await weatherFor(location.lat, location.lon);
    const best = findBestWindow(hourly, species, 2);
    if (!best) throw new Error('Ennustetta ei löytynyt.');
    const advice = recommendForSpecies(species, best.conditions);
    const label = fishingScoreBand(best.score, 'fi').text.toLocaleLowerCase('fi-FI');
    result.innerHTML = `<div class="ff-next-score">${best.score}/100 <span style="font-size:1rem">${label}</span></div>
      <strong>${escapeHtml(advice.species)}: paras 2 h ikkuna ${formatHour(best.start)}–${formatHour(best.end)}</strong>
      <div class="ff-next-chips"><span class="ff-next-chip">🎯 ${escapeHtml(advice.depth)}</span><span class="ff-next-chip">🪝 ${escapeHtml(advice.lure)}</span><span class="ff-next-chip">🎨 ${escapeHtml(advice.color)}</span></div>
      <p>${escapeHtml(advice.technique)}.</p>
      <p class="ff-next-muted">Perustuu Open-Meteon tuntiennusteeseen ja FastFishingin sääheuristiikkaan. Tämä on suuntaa-antava suositus, ei saalistakuu.</p>`;
    result.hidden = false;
    status.textContent = '';
    return { best, advice };
  } catch (error) {
    status.textContent = error.message || 'Suosituksen laskenta epäonnistui.';
    throw error;
  }
}

async function useSaved(index){
  const place = readSaved()[index];
  if (!place) return;
  document.getElementById('ffSavedSelect').value = String(index);
  await runAdvice(place);
}

function saveCurrent(){
  if (!activeLocation) return document.getElementById('ffNowStatus').textContent = 'Hae ensin nykyinen sijainti tai valitse tallennettu paikka.';
  const nameInput = document.getElementById('ffPlaceName');
  const name = nameInput.value.trim() || activeLocation.name || 'Kalapaikka';
  const items = readSaved();
  const next = { name:name.slice(0,60), lat:Number(activeLocation.lat.toFixed(5)), lon:Number(activeLocation.lon.toFixed(5)) };
  const duplicate = items.findIndex(p => Math.abs(p.lat-next.lat)<0.0001 && Math.abs(p.lon-next.lon)<0.0001);
  if (duplicate >= 0) items[duplicate] = next; else items.unshift(next);
  writeSaved(items);
  nameInput.value = '';
  renderSavedPlaces();
  document.getElementById('ffNowStatus').textContent = `Tallennettu: ${next.name}`;
}

function injectNowCard(){
  const section = document.getElementById('kelimittari');
  if (!section || document.getElementById('ffNowCard')) return;
  const card = document.createElement('section');
  card.id = 'ffNowCard';
  card.className = 'ff-next-card';
  card.innerHTML = `<h2>🎣 Mitä, missä ja millä juuri nyt?</h2><p class="ff-next-muted">Valitse tavoitelaji. FastFishing etsii seuraavan vuorokauden parhaan kahden tunnin ikkunan ja antaa aloitusvieheen sekä syvyysvinkin.</p>
    <div class="ff-next-grid"><div class="ff-next-field"><label for="ffSpecies">Tavoitelaji</label><select id="ffSpecies">${supportedSpecies.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select></div>
    <div class="ff-next-field"><label for="ffSavedSelect">Oma paikka</label><select id="ffSavedSelect"><option value="">Valitse tallennettu paikka</option></select></div>
    <div class="ff-next-field"><label for="ffPlaceName">Paikan nimi tallennusta varten</label><input id="ffPlaceName" maxlength="60" placeholder="esim. Näsijärvi / kotilahti"></div></div>
    <div class="ff-next-actions"><button class="btn primary" id="ffLocateBtn" type="button">Käytä nykyistä sijaintia</button><button class="btn" id="ffSaveBtn" type="button">Tallenna tämä paikka</button><button class="btn" id="ffNotifyBtn" type="button">Ota kalakeli-ilmoitukset käyttöön</button></div>
    <p class="ff-next-status" id="ffNowStatus"></p><div class="ff-next-result" id="ffNowResult" hidden></div><h3 style="margin-top:20px">Omat paikat</h3><div class="ff-next-saved" id="ffSavedPlaces"></div>`;
  section.prepend(card);
  document.getElementById('ffLocateBtn').addEventListener('click', async () => { try { await runAdvice(await locate()); } catch {} });
  document.getElementById('ffSaveBtn').addEventListener('click', saveCurrent);
  document.getElementById('ffSavedSelect').addEventListener('change', e => { if (e.target.value !== '') useSaved(Number(e.target.value)); });
  document.getElementById('ffSpecies').addEventListener('change', () => { if (activeLocation) runAdvice(activeLocation).catch(()=>{}); });
  document.getElementById('ffNotifyBtn').addEventListener('click', enableNotifications);
  renderSavedPlaces();
}

async function showNotification(title, body){
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, icon:'/icon-192.png', badge:'/icon-192.png', tag:'fastfishing-kalakeli' });
    } else if ('Notification' in window) new Notification(title, { body });
  } catch {}
}

async function enableNotifications(){
  const status = document.getElementById('ffNowStatus');
  if (!('Notification' in window)) return status.textContent = 'Tämä selain ei tue ilmoituksia.';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return status.textContent = 'Ilmoituksia ei sallittu.';
  status.textContent = 'Kalakeli-ilmoitukset käytössä. Tallennetut paikat tarkistetaan, kun FastFishing avataan.';
  await checkSavedPlaces(true);
}

async function checkSavedPlaces(force=false){
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const saved = readSaved();
  if (!saved.length) return;
  const last = Number(localStorage.getItem(NOTIFY_CHECK_KEY) || 0);
  if (!force && Date.now() - last < 6 * 60 * 60 * 1000) return;
  localStorage.setItem(NOTIFY_CHECK_KEY, String(Date.now()));
  const species = document.getElementById('ffSpecies')?.value || 'kuha';
  for (const place of saved.slice(0,4)) {
    try {
      const best = findBestWindow(await weatherFor(place.lat, place.lon), species, 2);
      if (best && best.score >= 72) await showNotification(`Hyvä kalakeli: ${place.name}`, `${best.score}/100 · paras ikkuna ${formatHour(best.start)}–${formatHour(best.end)}`);
    } catch {}
  }
}

async function loadWeeklyInsights(){
  const section = document.getElementById('feedi');
  if (!section || document.getElementById('ffWeeklyInsights')) return;
  const card = document.createElement('section');
  card.id = 'ffWeeklyInsights'; card.className='ff-next-card ff-next-insights';
  card.innerHTML = '<h2>📈 Tällä viikolla toimii</h2><p class="ff-next-muted">Ladataan Saalisvirran havaintoja…</p>';
  section.prepend(card);
  try {
    const data = await api('/api/insights/weekly');
    const species = data.topSpecies?.length ? data.topSpecies.map(x=>`<span class="ff-next-chip">${escapeHtml(x.name)} · ${x.catches}</span>`).join('') : '<span class="ff-next-muted">Lajihavaintoja ei vielä tarpeeksi.</span>';
    const lures = data.topLures?.length ? data.topLures.map(x=>`<span class="ff-next-chip">${escapeHtml(x.name)} · ${x.catches}</span>`).join('') : '<span class="ff-next-muted">Viehehavaintoja ei vielä tarpeeksi.</span>';
    card.innerHTML = `<h2>📈 Tällä viikolla toimii</h2><p><strong>${data.totalCatches}</strong> saalishavaintoa viimeisen 7 päivän aikana.</p><h3>Lajit</h3><div class="ff-next-chips">${species}</div><h3>Vieheet / syötit</h3><div class="ff-next-chips">${lures}</div>${data.busiestHour ? `<p class="ff-next-muted">Eniten julkaisuja noin klo ${String(data.busiestHour.hour).padStart(2,'0')}:00.</p>`:''}`;
  } catch { card.innerHTML = '<h2>📈 Tällä viikolla toimii</h2><p class="ff-next-muted">Trendit eivät ole juuri nyt saatavilla.</p>'; }
}

function profileModal(){
  let backdrop = document.getElementById('ffProfileBackdrop');
  if (backdrop) return backdrop;
  backdrop = document.createElement('div'); backdrop.id='ffProfileBackdrop'; backdrop.className='ff-next-modal-backdrop'; backdrop.hidden=true;
  backdrop.innerHTML='<div class="ff-next-modal" role="dialog" aria-modal="true" aria-label="Kalastajaprofiili"><div class="ff-next-modal-head"><h2 id="ffProfileTitle">Profiili</h2><button class="ff-next-close" id="ffProfileClose" type="button" aria-label="Sulje">×</button></div><div id="ffProfileBody"></div></div>';
  document.body.appendChild(backdrop);
  const close=()=>{backdrop.hidden=true;document.body.style.overflow='';};
  document.getElementById('ffProfileClose').addEventListener('click', close);
  backdrop.addEventListener('click', e=>{if(e.target===backdrop) close();});
  return backdrop;
}

async function openProfile(username){
  const modal=profileModal(); const body=document.getElementById('ffProfileBody');
  document.getElementById('ffProfileTitle').textContent=`@${username}`; body.innerHTML='<p>Ladataan profiilia…</p>'; modal.hidden=false; document.body.style.overflow='hidden';
  try {
    const { profile:p } = await api(`/api/profiles/${encodeURIComponent(username)}`);
    body.innerHTML=`<div class="ff-next-stats"><div class="ff-next-stat"><strong>${p.postCount}</strong>saalista</div><div class="ff-next-stat"><strong>${p.speciesCount}</strong>lajia</div><div class="ff-next-stat"><strong>${p.likesReceived}</strong>tykkäystä</div><div class="ff-next-stat"><strong>${p.biggestWeightKg ?? '–'} kg</strong>ennätyspaino</div><div class="ff-next-stat"><strong>${p.longestFishCm ?? '–'} cm</strong>pisin kala</div></div>
      ${p.topSpecies?.length?`<h3>Yleisimmät lajit</h3><div class="ff-next-chips">${p.topSpecies.map(x=>`<span class="ff-next-chip">${escapeHtml(x.species)} · ${x.catches}</span>`).join('')}</div>`:''}
      ${p.topLures?.length?`<h3>Yleisimmät vieheet</h3><div class="ff-next-chips">${p.topLures.map(x=>`<span class="ff-next-chip">${escapeHtml(x.lure)} · ${x.catches}</span>`).join('')}</div>`:''}
      ${p.recentPosts?.length?`<h3>Viimeisimmät saaliit</h3><div class="ff-next-gallery">${p.recentPosts.map(x=>`<img loading="lazy" src="${assetUrl(x.imageUrl)}" alt="${escapeHtml(x.species || 'Saaliskuva')}">`).join('')}</div>`:'<p>Ei vielä julkaistuja saaliita.</p>'}`;
  } catch { body.innerHTML='<p>Profiilia ei voitu ladata.</p>'; }
}

function decorateProfiles(root=document){
  root.querySelectorAll?.('.feed-post-user,.feed-comment-user').forEach(el=>{
    if (el.dataset.ffProfileReady) return;
    el.dataset.ffProfileReady='1'; el.classList.add('ff-next-profile-trigger'); el.tabIndex=0; el.setAttribute('role','button'); el.setAttribute('aria-label',`Avaa käyttäjän ${el.textContent.trim()} profiili`);
    const open=()=>openProfile(el.textContent.trim()); el.addEventListener('click',open); el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  });
}

function init(){
  injectNowCard();
  document.querySelectorAll('[data-page="feedi"]').forEach(btn=>btn.addEventListener('click',loadWeeklyInsights,{once:true}));
  if (location.hash.includes('feedi')) loadWeeklyInsights();
  decorateProfiles();
  new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(node=>{if(node.nodeType===1) decorateProfiles(node);}))).observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>checkSavedPlaces(false),2500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
