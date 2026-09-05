import { createForecastClient, createForecastLoader, upcomingHours, HOUR } from './forecast.js';
import { rankFishingWindows, findBestWindow, scoreFishingHour, recommendForSpecies, supportedSpecies } from './fishing-advice.js';
import { fishingScoreBand } from './score-calibration.js';
import { readSavedPlaces, savePlace, removePlace } from './saved-places.js';

const COPY = {
  fi: {
    title: 'Milloin kalaan?', intro: 'Vertaa seuraavan 48 tunnin lähtöaikoja ja valitse reissullesi sopiva keli.',
    species: 'Tavoitelaji', duration: 'Reissun pituus', period: 'Vuorokaudenaika', all: 'Kaikki ajat', morning: 'Aamu 5–12', day: 'Päivä 12–18', evening: 'Ilta 18–24',
    location: 'Paikka', noPlace: 'Valitse paikka sivun paikkahausta.', gps: 'Käytä sijaintiani', current: 'Nykyinen sijainti', refresh: 'Päivitä ennuste',
    saved: 'Omat paikat', savedSelect: 'Valitse tallennettu paikka', savedEmpty: 'Tallenna paikka, johon haluat palata.', save: 'Tallenna paikka', name: 'Paikan nimi', remove: 'Poista',
    savedNote: 'Paikat tallennetaan vain tähän selaimeen. Niitä ei julkaista Saalisvirrassa.', savedOk: 'Paikka tallennettu.', full: '12 paikkaa on jo tallennettu. Poista yksi ennen uuden lisäämistä.', storageError: 'Tallennus ei onnistunut. Tarkista, että selaimen tallennustila on käytettävissä.',
    loading: 'Haetaan ennustetta', locating: 'Haetaan sijaintiasi…', gpsError: 'Sijaintia ei saatu. Voit valita paikan sivun paikkahausta.', error: 'Ennustetta ei saatu. Tarkista yhteys ja yritä uudelleen.',
    empty: 'Näillä valinnoilla ei löytynyt yhtenäistä ennustejaksoa. Kokeile lyhyempää reissua tai toista vuorokaudenaikaa.',
    unsupported: 'Tälle lajille ei vielä ole reissusuositusta. Valitse kuha, hauki, ahven tai taimen. Kelimittari toimii muillekin lajeille.',
    alternatives: 'Vertaa lähtöaikoja', best: 'Paras jakso', alternative: 'Vaihtoehto', chosen: 'Valittu ajankohta', hourly: 'Tuntiennuste ja muut lähtöajat',
    score: 'Kalakelipisteet', wind: 'Tuuli', temp: 'Ilman lämpötila', pressure: 'Paineen muutos / 6 h', unknown: 'Ei havaintoa',
    depth: 'Aloitussyvyys', lure: 'Aloitusviehe', color: 'Vieheen väri', why: 'Miksi tämä aika?',
    heuristic: 'Pisteet ovat lajikohtainen sääheuristiikka, eivät saalistodennäköisyys. Syvyysvinkki on yleinen: käytössä on ilman, ei veden lämpötila. Kelimittarilla on erillinen laskentamalli.',
    source: 'Sää: Open-Meteo', method: 'Miten pisteet lasketaan?', updated: 'Haettu', local: 'Paikan paikallisaika', cached: 'Yhteys ei onnistunut. Näytetään aiemmin haettu ennuste',
    notifyOn: 'Ota kalakeli-ilmoitukset käyttöön', notifyOff: 'Poista kalakeli-ilmoitukset käytöstä', notifyNote: 'Ilmoitukset tarkistetaan vain sovelluksen ollessa auki, enintään neljälle tallennetulle paikalle.',
    notifyDenied: 'Selain ei salli ilmoituksia. Voit muuttaa luvan selaimen asetuksista.', notifyUnsupported: 'Tämä selain ei tue ilmoituksia.', notifyEnabled: 'Kalakeli-ilmoitukset käytössä.', notifyDisabled: 'Kalakeli-ilmoitukset poistettu käytöstä.', notifyTitle: 'Hyvä kalakeli',
    result: 'Ennuste valmis. Vertaa lähtöaikoja alla.', prime: 'Aamu tai ilta tukee tämän mallin pisteitä.', moderateWind: 'Tuuli osuu mallin suotuisaan vaihteluväliin.', falling: 'Ennusteessa ilmanpaine laskee maltillisesti.', baseline: 'Jakso sijoittuu valittujen aikojen kärkeen lajikohtaisessa mallissa.'
  },
  en: {
    title: 'When should you go fishing?', intro: 'Compare the next 48 hours and choose conditions that fit your trip.',
    species: 'Target species', duration: 'Trip length', period: 'Time of day', all: 'Any time', morning: 'Morning 5–12', day: 'Afternoon 12–18', evening: 'Evening 18–24',
    location: 'Location', noPlace: 'Choose a location using the place search above.', gps: 'Use my location', current: 'Current location', refresh: 'Refresh forecast',
    saved: 'Saved places', savedSelect: 'Choose a saved place', savedEmpty: 'Save a place you want to return to.', save: 'Save place', name: 'Place name', remove: 'Remove',
    savedNote: 'Places stay in this browser. They are not published in the catch feed.', savedOk: 'Place saved.', full: 'You have saved 12 places. Remove one before adding another.', storageError: 'Could not save. Check that browser storage is available.',
    loading: 'Loading forecast', locating: 'Finding your location…', gpsError: 'Location unavailable. You can choose a place using the search above.', error: 'Forecast unavailable. Check your connection and try again.',
    empty: 'No continuous forecast fits these choices. Try a shorter trip or another time of day.',
    unsupported: 'Trip advice is available for zander, pike, perch and trout. The conditions gauge supports the other species.',
    alternatives: 'Compare departure times', best: 'Best window', alternative: 'Alternative', chosen: 'Selected time', hourly: 'Hourly forecast and other departure times',
    score: 'Fishing-condition score', wind: 'Wind', temp: 'Air temperature', pressure: 'Pressure change / 6 h', unknown: 'Unavailable',
    depth: 'Starting depth', lure: 'Starting lure', color: 'Lure colour', why: 'Why this time?',
    heuristic: 'Scores are species-specific weather heuristics, not catch probabilities. Depth tips are general: the model uses air, not water temperature. The conditions gauge uses a separate model.',
    source: 'Weather: Open-Meteo', method: 'How are scores calculated?', updated: 'Retrieved', local: 'Local time at the location', cached: 'Connection failed. Showing a previously retrieved forecast',
    notifyOn: 'Enable fishing notifications', notifyOff: 'Disable fishing notifications', notifyNote: 'Notifications are checked only while the app is open, for up to four saved places.',
    notifyDenied: 'Notifications are blocked. You can change permission in your browser settings.', notifyUnsupported: 'This browser does not support notifications.', notifyEnabled: 'Fishing notifications enabled.', notifyDisabled: 'Fishing notifications disabled.', notifyTitle: 'Good fishing conditions',
    result: 'Forecast ready. Compare departure times below.', prime: 'Morning or evening contributes to the model score.', moderateWind: 'Wind is in the model’s favourable range.', falling: 'The forecast shows moderately falling pressure.', baseline: 'This window ranks highly for the selected species and times.'
  }
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function initTripPlanner() {
  const section = document.getElementById('kelimittari');
  if (!section || document.getElementById('ffNowCard')) return;
  let storage = null;
  let session = null;
  try { storage = window.localStorage; } catch { /* Optional. */ }
  try { session = window.sessionStorage; } catch { /* Optional. */ }
  const client = createForecastClient({ storage: session });
  const card = document.createElement('section');
  card.id = 'ffNowCard';
  card.className = 'ff-next-card ff-planner';
  card.setAttribute('aria-labelledby', 'ffPlannerTitle');
  section.prepend(card);
  let lang = document.querySelector('.lang-btn.active')?.dataset.lang === 'en' ? 'en' : 'fi';
  let activeLocation = null;
  let forecast = null;
  let requestId = 0;
  let selectedStart = null;
  let currentWindows = [];
  let notificationRunning = false;
  const t = key => COPY[lang][key];
  const el = id => card.querySelector(`#${id}`);
  const locale = () => lang === 'fi' ? 'fi-FI' : 'en-GB';
  const status = message => { el('ffNowStatus').textContent = message; };
  const loader = createForecastLoader(client, state => {
    if (state.status === 'loading') {
      activeLocation = state.location;
      forecast = null; selectedStart = null;
      el('ffActivePlace').textContent = activeLocation.name;
      el('ffNowResult').hidden = true;
      status(`${t('loading')}: ${activeLocation.name}…`);
    } else if (state.status === 'ready') {
      forecast = state.forecast; renderForecast();
    } else status(t('error'));
  });
  const speciesName = species => lang === 'fi' ? supportedSpecies.find(s => s.id === species)?.name : ({ kuha: 'Zander', hauki: 'Pike', ahven: 'Perch', taimen: 'Trout' }[species]);
  function format(timestamp, options, timezone = forecast?.timezone || 'UTC') {
    return new Intl.DateTimeFormat(locale(), { timeZone: timezone, ...options }).format(timestamp);
  }
  function range(item, timezone = forecast.timezone) {
    const date = timestamp => format(timestamp, { weekday: 'short', day: 'numeric', month: 'numeric' }, timezone);
    const offset = timestamp => format(timestamp, { timeZoneName: 'shortOffset' }, timezone).split(' ').at(-1);
    const clock = timestamp => format(timestamp, { hour: '2-digit', minute: '2-digit', ...(offset(item.startTimestamp) !== offset(item.endTimestamp) ? { timeZoneName: 'shortOffset' } : {}) }, timezone);
    const endDate = date(item.startTimestamp) === date(item.endTimestamp) ? '' : `${date(item.endTimestamp)} `;
    return `${date(item.startTimestamp)} ${clock(item.startTimestamp)}–${endDate}${clock(item.endTimestamp)}`;
  }
  function notificationEnabled() {
    try {
      const preference = storage?.getItem('ff_notifications_enabled_v1');
      // Preserve existing users' opt-in from the earlier notification feature.
      const enabled = preference === '1' || (preference == null && Number(storage?.getItem('ff_saved_places_last_check')) > 0);
      return enabled && window.Notification?.permission === 'granted';
    } catch { return false; }
  }
  function renderSaved() {
    const places = readSavedPlaces(storage);
    el('ffSavedSelect').innerHTML = `<option value="">${t('savedSelect')}</option>` + places.map((p, i) => `<option value="${i}">${escapeHtml(p.name)}</option>`).join('');
    el('ffSavedPlaces').innerHTML = places.length ? places.map((p, i) => `<div class="ff-next-saved-row"><button class="btn" type="button" data-place="${i}">${escapeHtml(p.name)}</button><button class="ff-next-close" type="button" aria-label="${t('remove')} ${escapeHtml(p.name)}" data-remove="${i}">×</button></div>`).join('') : `<p class="ff-next-muted">${t('savedEmpty')}</p>`;
    el('ffNotifyBtn').textContent = t(notificationEnabled() ? 'notifyOff' : 'notifyOn');
    el('ffNotifyBtn').setAttribute('aria-pressed', String(notificationEnabled()));
  }
  function renderShell(values = {}) {
    card.innerHTML = `<div class="ff-planner-heading"><div><h2 id="ffPlannerTitle">${t('title')}</h2><p class="ff-next-muted">${t('intro')}</p></div><span class="ff-planner-horizon">48 h</span></div>
      <p class="ff-planner-location"><span>${t('location')}</span> <strong id="ffActivePlace">${escapeHtml(activeLocation?.name || t('noPlace'))}</strong></p>
      <div class="ff-next-grid ff-planner-controls">
        <div class="ff-next-field"><label for="ffSpecies">${t('species')}</label><select id="ffSpecies">${supportedSpecies.map(s => `<option value="${s.id}">${speciesName(s.id)}</option>`).join('')}</select></div>
        <div class="ff-next-field"><label for="ffDuration">${t('duration')}</label><select id="ffDuration">${[1, 2, 3, 4].map(hours => `<option value="${hours}">${hours} h</option>`).join('')}</select></div>
        <div class="ff-next-field"><label for="ffPeriod">${t('period')}</label><select id="ffPeriod">${['all', 'morning', 'day', 'evening'].map(period => `<option value="${period}">${t(period)}</option>`).join('')}</select></div>
      </div>
      <div class="ff-next-actions"><button class="btn" id="ffLocateBtn" type="button">${t('gps')}</button><button class="btn" id="ffForecastRefresh" type="button">${t('refresh')}</button><select id="ffSavedSelect" aria-label="${t('saved')}"></select></div>
      <p class="ff-next-status" id="ffNowStatus" role="status" aria-live="polite" aria-atomic="true"></p>
      <div id="ffNowResult" hidden></div>
      <details class="ff-planner-saved"><summary>${t('saved')}</summary><p class="ff-next-muted">${t('savedNote')}</p>
        <form id="ffSaveForm" class="ff-planner-save"><div class="ff-next-field"><label for="ffPlaceName">${t('name')}</label><input id="ffPlaceName" maxlength="60" autocomplete="off"></div><button class="btn" id="ffSaveBtn" type="submit">${t('save')}</button></form>
        <div class="ff-next-saved" id="ffSavedPlaces"></div><button class="btn" id="ffNotifyBtn" type="button"></button><p class="ff-next-muted">${t('notifyNote')}</p>
      </details>`;
    el('ffSpecies').value = values.species || 'kuha';
    el('ffDuration').value = values.duration || '2';
    el('ffPeriod').value = values.period || 'all';
    el('ffPlaceName').value = values.name || '';
    renderSaved();
    el('ffSaveForm').addEventListener('submit', event => {
      event.preventDefault();
      if (!activeLocation) return status(t('noPlace'));
      const saved = savePlace(storage, { ...activeLocation, name: el('ffPlaceName').value.trim() || activeLocation.name });
      if (!saved.ok) return status(t(saved.reason === 'full' ? 'full' : 'storageError'));
      el('ffPlaceName').value = ''; renderSaved(); status(t('savedOk'));
    });
    el('ffSavedPlaces').addEventListener('click', event => {
      const remove = event.target.closest('[data-remove]');
      if (remove) {
        if (!removePlace(storage, Number(remove.dataset.remove))) return status(t('storageError'));
        renderSaved(); el('ffSavedSelect').focus(); return;
      }
      const button = event.target.closest('[data-place]');
      if (button) useSaved(Number(button.dataset.place));
    });
    el('ffSavedSelect').addEventListener('change', event => { if (event.target.value !== '') useSaved(Number(event.target.value)); });
    el('ffForecastRefresh').addEventListener('click', () => { if (activeLocation) chooseLocation(activeLocation, true); else syncFromPage(); });
    el('ffLocateBtn').addEventListener('click', locate);
    el('ffNotifyBtn').addEventListener('click', toggleNotifications);
    ['ffSpecies', 'ffDuration', 'ffPeriod'].forEach(id => el(id).addEventListener('change', () => {
      selectedStart = null;
      if (id === 'ffSpecies') {
        const select = document.getElementById('speciesSelect');
        if (select && select.value !== el(id).value) { select.value = el(id).value; select.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      renderForecast();
    }));
    el('ffNowResult').addEventListener('click', event => {
      const button = event.target.closest('[data-start]');
      if (!button || button.disabled) return;
      const item = currentWindows.find(window => window.startTimestamp === Number(button.dataset.start));
      if (item) selectWindow(item);
    });
  }

  function selectWindow(item) {
    selectedStart = item.startTimestamp;
    const conditions = item.conditions;
    const advice = recommendForSpecies(el('ffSpecies').value, conditions, lang);
    const delta = Number.isFinite(conditions.pressure6hAgo) ? conditions.pressure - conditions.pressure6hAgo : null;
    const reasons = [];
    if (conditions.hour <= 8 || conditions.hour >= 18) reasons.push(t('prime'));
    if (conditions.wind >= 1.5 && conditions.wind <= 6.5) reasons.push(t('moderateWind'));
    if (delta !== null && delta >= -4 && delta <= -0.5) reasons.push(t('falling'));
    if (!reasons.length) reasons.push(t('baseline'));
    el('ffSelectedWindow').innerHTML = `<div class="ff-planner-selected-head"><div><p class="ff-planner-kicker">${t('chosen')}</p><h3>${escapeHtml(range(item))}</h3></div><div class="ff-next-score">${item.score}<span>/100</span></div></div>
      <dl class="ff-planner-weather"><div><dt>${t('wind')}</dt><dd>${Math.min(...item.items.map(i => i.wind)).toFixed(1)}–${Math.max(...item.items.map(i => i.wind)).toFixed(1)} m/s</dd></div><div><dt>${t('temp')}</dt><dd>${Math.min(...item.items.map(i => i.temp)).toFixed(0)}–${Math.max(...item.items.map(i => i.temp)).toFixed(0)} °C</dd></div><div><dt>${t('pressure')}</dt><dd>${delta === null ? t('unknown') : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} hPa`}</dd></div></dl>
      <dl class="ff-planner-tips"><div><dt>${t('depth')}</dt><dd>${escapeHtml(advice.depth)}</dd></div><div><dt>${t('lure')}</dt><dd>${escapeHtml(advice.lure)}</dd></div><div><dt>${t('color')}</dt><dd>${escapeHtml(advice.color)}</dd></div></dl>
      <p>${escapeHtml(advice.technique)}.</p><details><summary>${t('why')}</summary><ul>${reasons.map(reason => `<li>${reason}</li>`).join('')}</ul></details>`;
    card.querySelectorAll('[data-start]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.start) === selectedStart)));
  }

  function renderForecast() {
    if (!forecast) return;
    const species = el('ffSpecies').value;
    const result = el('ffNowResult');
    if (!species) { result.hidden = true; status(t('unsupported')); return; }
    const hours = upcomingHours(forecast);
    const duration = Number(el('ffDuration').value);
    const period = el('ffPeriod').value;
    const best = rankFishingWindows(hours, species, duration, { period });
    if (!best.length) { result.hidden = true; status(t('empty')); return; }
    currentWindows = hours.map((_, index) => rankFishingWindows(hours.slice(index, index + duration), species, duration, { period, limit: 1 })[0]).filter(Boolean);
    const chosen = currentWindows.find(item => item.startTimestamp === selectedStart) || best[0];
    result.innerHTML = `<p class="ff-planner-freshness${forecast.stale ? ' is-stale' : ''}">${t(forecast.stale ? 'cached' : 'updated')} ${escapeHtml(format(forecast.fetchedAt, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }))} · ${t('local')}: ${escapeHtml(forecast.timezone)}</p>
      <fieldset class="ff-planner-alternatives"><legend>${t('alternatives')}</legend><div class="ff-planner-windows">${best.map((item, index) => `<button class="ff-planner-window" type="button" data-start="${item.startTimestamp}" aria-pressed="false"><span class="ff-planner-kicker">${index === 0 ? t('best') : `${t('alternative')} ${index + 1}`}</span><strong>${escapeHtml(range(item))}</strong><span class="ff-planner-window-score">${item.score}/100 <span>${escapeHtml(fishingScoreBand(item.score, lang).text)}</span></span></button>`).join('')}</div></fieldset>
      <div id="ffSelectedWindow" class="ff-planner-selected" aria-live="polite" aria-atomic="true"></div>
      <details class="ff-planner-hourly"><summary>${t('hourly')}</summary><div class="ff-planner-hours">${hours.map(hour => {
        const score = scoreFishingHour({ ...hour, species });
        const available = currentWindows.some(item => item.startTimestamp === hour.timestamp);
        const label = format(hour.timestamp, { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' });
        return `<button type="button" class="ff-planner-hour" data-start="${hour.timestamp}" aria-pressed="false" ${available ? '' : 'disabled'} aria-label="${escapeHtml(label)} · ${t('score')} ${score}/100"><span>${escapeHtml(format(hour.timestamp, { weekday: 'short', hour: '2-digit', minute: '2-digit' }))}</span><span class="ff-planner-bar" aria-hidden="true"><i style="height:${score}%"></i></span><strong>${score}</strong></button>`;
      }).join('')}</div></details>
      <p class="ff-next-muted ff-planner-method">${t('heuristic')} <a href="metodologia.html">${t('method')}</a> <a href="https://open-meteo.com/">${t('source')}</a></p>`;
    result.hidden = false;
    selectWindow(chosen);
    status(t('result'));
  }

  function chooseLocation(place, force = false) {
    requestId++;
    return loader.load({ name: place.name, lat: place.lat, lon: place.lon }, { force });
  }
  function syncFromPage(force = false) {
    const key = document.getElementById('locationSelect')?.value;
    const place = window.resolveLocation?.(key);
    if (place) return chooseLocation(place, force);
    status(t('noPlace'));
  }
  function selectOnPage(place) {
    const select = document.getElementById('locationSelect');
    if (select && typeof window.addDynamicLocation === 'function') {
      select.value = window.addDynamicLocation(place);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } else chooseLocation(place);
  }
  function useSaved(index) {
    const place = readSavedPlaces(storage)[index];
    if (place) selectOnPage(place);
  }
  async function locate() {
    const id = ++requestId;
    loader.cancel();
    forecast = null; el('ffNowResult').hidden = true;
    status(t('locating'));
    el('ffLocateBtn').disabled = true;
    try {
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('geolocation-unavailable'));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
      });
      if (id === requestId) selectOnPage({ name: t('current'), lat: position.coords.latitude, lon: position.coords.longitude });
    } catch { if (id === requestId) status(t('gpsError')); }
    finally { el('ffLocateBtn').disabled = false; }
  }

  async function toggleNotifications() {
    if (!('Notification' in window)) return status(t('notifyUnsupported'));
    if (notificationEnabled()) {
      try { storage.setItem('ff_notifications_enabled_v1', '0'); } catch { return status(t('storageError')); }
      renderSaved(); status(t('notifyDisabled')); return;
    }
    try {
      if (await Notification.requestPermission() !== 'granted') return status(t('notifyDenied'));
      storage.setItem('ff_notifications_enabled_v1', '1');
      renderSaved(); status(t('notifyEnabled'));
      await checkNotifications(true);
    } catch { status(t('storageError')); }
  }
  async function checkNotifications(force = false) {
    if (!notificationEnabled() || notificationRunning || !el('ffSpecies').value) return;
    const places = readSavedPlaces(storage).slice(0, 4);
    if (!places.length) return;
    try {
      const last = Number(storage.getItem('ff_saved_places_last_check') || 0);
      if (!force && Date.now() - last < 6 * HOUR) return;
      storage.setItem('ff_saved_places_last_check', String(Date.now()));
    } catch { return; }
    notificationRunning = true;
    const species = el('ffSpecies').value;
    try {
      for (const place of places) {
        try {
          const data = await client.get(place.lat, place.lon);
          const best = findBestWindow(upcomingHours(data, Date.now(), 24), species, 2);
          if (!notificationEnabled()) return;
          if (!best || best.score < 72 || data.stale) continue;
          const body = `${speciesName(species)} · ${best.score}/100 · ${range(best, data.timezone)}`;
          // getRegistration resolves even if a service worker never became ready.
          const registration = await navigator.serviceWorker?.getRegistration();
          const title = `${t('notifyTitle')}: ${place.name}`;
          const options = { body, icon: '/icon-192.png', tag: `fastfishing:${place.lat.toFixed(3)},${place.lon.toFixed(3)}` };
          if (!notificationEnabled()) return;
          if (registration) await registration.showNotification(title, options);
          else new Notification(title, options);
        } catch { /* A failed place must not prevent the others from loading. */ }
      }
    } finally { notificationRunning = false; }
  }

  renderShell();
  const pageSpecies = document.getElementById('speciesSelect');
  function syncSpecies() {
    const previous = el('ffSpecies').value;
    if (pageSpecies) el('ffSpecies').value = pageSpecies.value;
    if (previous !== el('ffSpecies').value) selectedStart = null;
    renderForecast();
  }
  syncSpecies();
  window.addEventListener('fastfishing:forecast-selection', event => {
    const { location: place, force } = event.detail;
    syncSpecies();
    if (!forecast || force || activeLocation?.lat !== place.lat || activeLocation?.lon !== place.lon || activeLocation?.name !== place.name) chooseLocation(place, force);
  });
  document.querySelectorAll('.lang-btn').forEach(button => button.addEventListener('click', () => {
    lang = button.dataset.lang === 'en' ? 'en' : 'fi';
    const values = { species: el('ffSpecies').value, duration: el('ffDuration').value, period: el('ffPeriod').value, name: el('ffPlaceName').value };
    renderShell(values); syncSpecies();
    if (!forecast) syncFromPage();
  }));
  window.addEventListener('storage', event => { if (event.key === 'ff_saved_places_v1' || event.key === 'ff_notifications_enabled_v1' || event.key === null) renderSaved(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (activeLocation) chooseLocation(activeLocation);
    checkNotifications();
  });
  syncFromPage();
  setTimeout(() => checkNotifications(), 2500);
}
