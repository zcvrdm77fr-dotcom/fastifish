import { initTripPlanner } from './trip-planner.js';

const API_BASE = String(window.FASTFISH_API_BASE || '').trim().replace(/\/+$/, '');

function apiUrl(path){ return API_BASE + path; }
function assetUrl(path){ return /^https?:\/\//i.test(path || '') ? path : API_BASE + (path || ''); }
function escapeHtml(value){ const d=document.createElement('div'); d.textContent=value == null ? '' : String(value); return d.innerHTML; }

async function api(path){
  const response = await fetch(apiUrl(path), { credentials: 'include' });
  if (!response.ok) throw new Error('Tietojen haku epäonnistui.');
  return response.json();
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
  initTripPlanner();
  document.querySelectorAll('[data-page="feedi"]').forEach(btn=>btn.addEventListener('click',loadWeeklyInsights,{once:true}));
  if (location.hash.includes('feedi')) loadWeeklyInsights();
  decorateProfiles();
  new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(node=>{if(node.nodeType===1) decorateProfiles(node);}))).observe(document.body,{childList:true,subtree:true});
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
