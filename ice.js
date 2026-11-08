import { copy, gear, species } from './ice-data.js';

const byId = id => document.getElementById(id);
const stateKey = 'fastfishing.ice.v1';
const panels = ['suunnittele', 'kartta', 'vinkit', 'saaliit'];
const finland = [62.4, 26.2];
const timeZone = 'Europe/Helsinki';
const speciesKeys = Object.keys(species);
const holeDialog = byId('ice-hole-dialog');
const catchDialog = byId('ice-catch-dialog');

let language = 'fi';
try { if (localStorage.getItem('user_language') === 'en') language = 'en'; } catch {}
let storageBlocked = false;
let state = readState();
let target = 'perch';
let map, pinLayer, mapFocus, draftHole, draftCatch;
let tileFailed = false;
let gpsMapStatus = '', gpsWeatherStatus = '';
let forecastLocation, forecastData, forecastController;
let weatherStatus = 'weatherEmpty';
let weatherIntent = 0;
let announcementTimer;

const localized = pair => pair[language === 'en' ? 1 : 0];
const t = key => key ? localized(copy[key]) : '';
const locale = () => language === 'fi' ? 'fi-FI' : 'en-GB';

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(stateKey) || '{}') || {};
    return {
      holes: Array.isArray(saved.holes) ? saved.holes : [],
      catches: Array.isArray(saved.catches) ? saved.catches : [],
      gear: Array.isArray(saved.gear) ? saved.gear : []
    };
  } catch {
    return { holes: [], catches: [], gear: [] };
  }
}

function updateState(update) {
  state = update(storageBlocked ? state : readState());
  try { localStorage.setItem(stateKey, JSON.stringify(state)); }
  catch {
    storageBlocked = true;
    byId('ice-storage').hidden = false;
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, handler, style = 'ice-secondary') {
  const node = element('button', `ice-btn ${style}`, label);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

function formatNumber(value, digits = 1) {
  return value.toLocaleString(locale(), { maximumFractionDigits: digits });
}

function formatTime(value, options) {
  return new Intl.DateTimeFormat(locale(), { timeZone, ...options }).format(new Date(value));
}

function coordinateText({ lat, lng }) {
  return `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
}

function updateLanguage() {
  document.documentElement.lang = language;
  document.title = language === 'fi'
    ? 'Pilkkitila – sää, reikäkartta ja saalispäiväkirja | FastFishing'
    : 'Ice Fishing – weather, hole map and catch journal | FastFishing';
  document.querySelectorAll('[data-ice]').forEach(node => { node.textContent = t(node.dataset.ice); });
  document.querySelectorAll('[data-ice-label]').forEach(node => node.setAttribute('aria-label', t(node.dataset.iceLabel)));
  const switcher = byId('ice-language');
  switcher.textContent = language === 'fi' ? 'EN' : 'FI';
  switcher.lang = language === 'fi' ? 'en' : 'fi';
  switcher.setAttribute('aria-label', language === 'fi' ? 'Switch to English' : 'Vaihda suomeksi');
  byId('ice-lake-source').href = language === 'fi' ? 'https://www.vesi.fi/jaatilanne/' : 'https://www.vesi.fi/en/ice-situation/';
  byId('ice-sea-source').href = language === 'fi' ? 'https://www.ilmatieteenlaitos.fi/jaatilanne' : 'https://en.ilmatieteenlaitos.fi/ice-conditions';
  renderWeather();
  renderMapStatus();
  renderGear();
  renderHoles();
  renderGuide();
  renderCatches();
}

function showPanel(moveFocus = false) {
  const fragment = location.hash.slice(1);
  const selected = panels.includes(fragment) ? fragment : panels[0];
  document.body.dataset.iceView = selected;
  for (const id of panels) {
    byId(id).hidden = id !== selected;
    const link = document.querySelector(`[data-ice-section="${id}"]`);
    if (id === selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (selected === 'kartta') {
    mountMap();
    map?.invalidateSize({ pan: false });
  }
  if (moveFocus) {
    byId(selected).querySelector('h2').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function updateConnection() {
  byId('ice-offline').hidden = navigator.onLine;
  renderMapStatus();
}

function requestPosition(button, setStatus, found) {
  if (!navigator.geolocation) {
    setStatus('gpsError');
    return;
  }
  button.disabled = true;
  setStatus('gpsLoading');
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    button.disabled = false;
    setStatus('');
    found({ lat: coords.latitude, lng: coords.longitude });
  }, () => {
    button.disabled = false;
    setStatus('gpsError');
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
}

function weatherUrl(place) {
  const url = new URL('https://opendata.fmi.fi/wfs');
  url.search = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'getFeature',
    storedquery_id: 'fmi::forecast::harmonie::surface::point::simple',
    parameters: 'Temperature,FeelsLike,WindSpeedMS,WindGust,Sunrise,Sunset',
    timestep: '60',
    endtime: new Date(Date.now() + 26 * 3600000).toISOString(),
    maxlocations: '1',
    ...(place.kind === 'place' ? { place: place.name } : { latlon: `${place.lat.toFixed(2)},${place.lng.toFixed(2)}` })
  });
  return url;
}

function parseForecast(xml) {
  const response = new DOMParser().parseFromString(xml, 'application/xml');
  const fmi = 'http://xml.fmi.fi/schema/wfs/2.0';
  const gml = 'http://www.opengis.net/gml/3.2';
  const fields = { Temperature: 'temperature', FeelsLike: 'feels', WindSpeedMS: 'wind', WindGust: 'gusts', Sunrise: 'rise', Sunset: 'set' };
  const position = response.getElementsByTagNameNS(gml, 'pos')[0]?.textContent.trim();
  const hourly = new Map();
  for (const entry of response.getElementsByTagNameNS(fmi, 'BsWfsElement')) {
    if (entry.getElementsByTagNameNS(gml, 'pos')[0]?.textContent.trim() !== position) continue;
    const value = name => entry.getElementsByTagNameNS(fmi, name)[0]?.textContent.trim();
    const timestamp = Date.parse(value('Time'));
    const field = fields[value('ParameterName')];
    const raw = value('ParameterValue');
    const daylight = field === 'rise' || field === 'set';
    const sun = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(raw);
    const reading = daylight
      ? sun ? Date.UTC(+sun[1], +sun[2] - 1, +sun[3], +sun[4], +sun[5], +sun[6]) : NaN
      : raw ? Number(raw) : NaN;
    if (!Number.isFinite(timestamp) || !field || !Number.isFinite(reading)) continue;
    if (!hourly.has(timestamp)) hourly.set(timestamp, { timestamp });
    hourly.get(timestamp)[field] = reading;
  }
  const [lat, lng] = position?.split(/\s+/).map(Number) || [];
  return {
    point: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    rows: [...hourly.values()].sort((a, b) => a.timestamp - b.timestamp)
  };
}

async function loadForecast(place, centerMap = false) {
  weatherIntent += 1;
  forecastController?.abort();
  const controller = new AbortController();
  forecastController = controller;
  forecastLocation = place;
  forecastData = null;
  gpsWeatherStatus = '';
  weatherStatus = 'weatherLoading';
  renderWeather();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(weatherUrl(place), { signal: controller.signal });
    const xml = await response.text();
    if (forecastController !== controller) return;
    if (!response.ok) {
      weatherStatus = place.kind === 'place' && response.status === 400 && /No locations found/i.test(xml)
        ? 'weatherNoPlace' : 'weatherError';
      return;
    }
    const parsed = parseForecast(xml);
    if (!parsed.rows.length) {
      weatherStatus = 'weatherOutside';
      return;
    }
    forecastData = parsed.rows;
    weatherStatus = '';
    if (centerMap) {
      mapFocus = place.kind === 'gps' ? place : parsed.point;
      if (map && mapFocus) map.setView(mapFocus, 12);
    }
  } catch {
    if (forecastController === controller) weatherStatus = 'weatherError';
  } finally {
    clearTimeout(timeout);
    if (forecastController === controller) renderWeather();
  }
}

function renderWeather() {
  byId('ice-search-status').textContent = t(gpsWeatherStatus);
  byId('ice-weather-status').textContent = t(weatherStatus);
  byId('ice-forecast-head').hidden = !forecastLocation;
  byId('ice-forecast-place').textContent = forecastLocation?.name
    || (forecastLocation ? t(forecastLocation.kind === 'gps' ? 'localGps' : 'mapPoint') : '');
  byId('ice-refresh').disabled = weatherStatus === 'weatherLoading';
  const view = byId('ice-forecast');
  view.hidden = !forecastData;
  if (!forecastData) return;
  const future = forecastData.filter(row => row.timestamp >= Date.now() - 3600000);
  const first = future[0] || forecastData.at(-1);
  const temp = value => Number.isFinite(value) ? `${formatNumber(value, 0)} °C` : '—';
  const speed = value => Number.isFinite(value) ? `${formatNumber(value)} m/s` : '—';
  const time = timestamp => formatTime(timestamp, { hour: '2-digit', minute: '2-digit' });
  const info = element('p', 'ice-muted ice-weather-time', `${t('weatherValid')} ${time(first.timestamp)}`);
  const values = element('dl', 'ice-weather-now');
  for (const [key, reading] of [
    ['temperature', temp(first.temperature)], ['feels', temp(first.feels)],
    ['wind', speed(first.wind)], ['gusts', speed(first.gusts)]
  ]) {
    const stat = element('div');
    stat.append(element('dt', '', t(key)), element('dd', '', reading));
    values.append(stat);
  }
  const next = element('ul', 'ice-weather-days');
  for (const row of future.filter((_, index) => index > 0 && index % 3 === 0).slice(0, 4)) {
    const item = element('li');
    item.append(
      element('strong', '', time(row.timestamp)),
      element('span', '', temp(row.temperature)),
      element('span', '', `${t('gusts')} ${speed(row.gusts)}`)
    );
    next.append(item);
  }
  view.replaceChildren(info, values);
  if (first.rise && first.set) {
    view.append(element('p', 'ice-muted ice-weather-sun', `${t('daylight')} ${time(first.rise)}–${time(first.set)}`));
  }
  view.append(next);
}

function renderGear() {
  const items = Object.entries(gear).map(([id, label]) => {
    const input = element('input');
    input.type = 'checkbox';
    input.value = id;
    input.addEventListener('change', () => {
      updateState(latest => ({ ...latest, gear: input.checked
        ? [...new Set([...latest.gear, id])]
        : latest.gear.filter(value => value !== id) }));
      syncGear();
    });
    const item = element('li');
    const wrapper = element('label');
    wrapper.append(input, element('span', '', localized(label)));
    item.append(wrapper);
    return item;
  });
  byId('ice-gear').replaceChildren(...items);
  syncGear();
}

function syncGear() {
  const checkboxes = [...byId('ice-gear').querySelectorAll('input')];
  for (const box of checkboxes) box.checked = state.gear.includes(box.value);
  const packed = checkboxes.filter(box => box.checked).length;
  byId('ice-gear-count').textContent = `${packed} / ${checkboxes.length}`;
  byId('ice-reset-gear').hidden = !packed;
}

function mountMap() {
  if (map) return;
  const L = window.L;
  if (!L) {
    byId('ice-add-hole').disabled = true;
    byId('ice-map-weather').disabled = true;
    renderMapStatus();
    return;
  }
  const lastHole = state.holes[0];
  const focus = mapFocus || lastHole;
  map = L.map('ice-map', { scrollWheelZoom: false }).setView(focus ? [focus.lat, focus.lng] : finland, focus ? 13 : 6);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
  let loads = 0;
  let errors = 0;
  tiles.on('loading', () => { loads = 0; errors = 0; });
  tiles.on('tileload', () => { loads += 1; });
  tiles.on('tileerror', () => { errors += 1; });
  tiles.on('load', () => {
    tileFailed = errors > 0 && loads === 0;
    renderMapStatus();
  });
  tiles.addTo(map);
  pinLayer = L.layerGroup().addTo(map);
  map.on('moveend resize', updateMapCoordinates);
  map.on('click', ({ latlng }) => map.panTo(latlng, { animate: false }));
  updateMapCoordinates();
  renderMapPins();
}

function renderMapStatus() {
  const status = gpsMapStatus || (!window.L ? 'mapUnavailable' : tileFailed || !navigator.onLine ? 'mapTilesMissing' : '');
  byId('ice-map-status').textContent = t(status);
}

function mapCenter() {
  return map.wrapLatLng(map.containerPointToLatLng(map.getSize().divideBy(2)));
}

function updateMapCoordinates() {
  byId('ice-coordinates').textContent = coordinateText(mapCenter());
}

function renderMapPins() {
  if (!pinLayer) return;
  const L = window.L;
  pinLayer.clearLayers();
  state.holes.forEach((hole, index) => {
    const icon = L.divIcon({ className: 'ice-map-pin', html: String(state.holes.length - index), iconSize: [26, 26] });
    const pin = L.marker([hole.lat, hole.lng], { icon, title: hole.name }).addTo(pinLayer);
    pin.getElement().setAttribute('aria-label', hole.name);
    const popup = element('span', '', hole.name);
    pin.bindPopup(popup);
  });
}

function renderHoles() {
  byId('ice-hole-count').textContent = String(state.holes.length);
  const list = byId('ice-holes');
  if (!state.holes.length) {
    list.replaceChildren(element('p', 'ice-card ice-empty', t('noHoles')));
    renderMapPins();
    return;
  }
  list.replaceChildren(...state.holes.map((hole, index) => {
    const entry = element('article', 'ice-card ice-entry');
    const detail = element('div');
    const depth = hole.depth == null ? '' : ` · ${formatNumber(hole.depth)} m`;
    detail.append(element('h4', '', `${state.holes.length - index} · ${hole.name}`), element('p', 'ice-coordinates', coordinateText(hole) + depth));
    if (hole.thickness != null) {
      const measured = formatTime(hole.measuredAt, { dateStyle: 'short', timeStyle: 'short' });
      detail.append(element('p', 'ice-muted', `${t('measured')} ${formatNumber(hole.thickness)} cm · ${measured}`));
    }
    if (hole.notes) detail.append(element('p', 'ice-muted ice-entry-notes', hole.notes));
    const actions = element('div', 'ice-actions');
    const show = button(t('showMap'), () => {
      if (!map) return;
      map.setView([hole.lat, hole.lng], Math.max(map.getZoom(), 14));
      byId('ice-map').focus();
    }, 'ice-quiet');
    show.hidden = !window.L;
    actions.append(
      show,
      button(t('addCatch'), () => openCatch({ holeId: hole.id, holeName: hole.name }), 'ice-quiet'),
      button(t('edit'), () => openHole(hole))
    );
    entry.append(detail, actions);
    return entry;
  }));
  renderMapPins();
}

function nextHoleName() {
  let number = state.holes.length + 1;
  while (state.holes.some(hole => hole.name === `${t('defaultHole')} ${number}`)) number += 1;
  return `${t('defaultHole')} ${number}`;
}

function openHole(point) {
  draftHole = point;
  byId('ice-hole-heading').textContent = t(point.id ? 'editHole' : 'newHole');
  byId('ice-hole-position').textContent = coordinateText(point);
  byId('ice-hole-name').value = point.name ?? nextHoleName();
  byId('ice-hole-depth').value = point.depth ?? '';
  byId('ice-hole-thickness').value = point.thickness ?? '';
  byId('ice-hole-notes').value = point.notes ?? '';
  byId('ice-delete-hole').hidden = !point.id;
  holeDialog.showModal();
}

function renderGuide() {
  const picker = byId('ice-species');
  picker.replaceChildren(...speciesKeys.map(key => {
    const choice = button(localized(species[key].name), () => selectGuide(key));
    choice.dataset.species = key;
    return choice;
  }));
  selectGuide(target);
}

function selectGuide(key) {
  target = key;
  const fish = species[key];
  for (const choice of byId('ice-species').querySelectorAll('button')) {
    choice.setAttribute('aria-pressed', String(choice.dataset.species === key));
  }
  const picks = element('div', 'ice-guide-picks');
  for (const [label, detail] of [['startWith', fish.lure], ['lookFor', fish.where], ['fishIt', fish.action]]) {
    const card = element('div');
    card.append(element('strong', '', t(label)), element('p', '', localized(detail)));
    picks.append(card);
  }
  byId('ice-guide').replaceChildren(element('p', 'ice-kicker', t('fieldGuide')), element('h3', '', localized(fish.name)), picks);
}

function renderCatches() {
  const fishCount = state.catches.reduce((total, item) => total + item.count, 0);
  const longest = state.catches.reduce((max, item) => Math.max(max, item.length || 0), 0);
  const stats = [
    ['catchCount', formatNumber(fishCount)], ['catchEntries', formatNumber(state.catches.length)],
    ['bestLength', longest ? `${formatNumber(longest)} cm` : '—']
  ];
  byId('ice-journal-stats').replaceChildren(...stats.map(([label, value]) => {
    const stat = element('div');
    stat.append(element('strong', '', value), element('span', '', t(label)));
    return stat;
  }));
  const list = byId('ice-catches');
  if (!state.catches.length) {
    list.replaceChildren(element('p', 'ice-card ice-empty', t('noCatches')));
    return;
  }
  const ordered = [...state.catches].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  list.replaceChildren(...ordered.map(item => {
    const entry = element('article', 'ice-card ice-entry');
    const detail = element('div');
    const fish = species[item.species] ? localized(species[item.species].name) : t('other');
    const holeName = state.holes.find(hole => hole.id === item.holeId)?.name || item.holeName;
    const date = formatTime(`${item.date}T00:00:00Z`, { dateStyle: 'medium' });
    const meta = [date, item.length && `${formatNumber(item.length)} cm`, holeName, item.lure].filter(Boolean);
    detail.append(element('h4', '', `${fish} × ${formatNumber(item.count)}`), element('p', 'ice-muted', meta.join(' · ')));
    if (item.notes) detail.append(element('p', 'ice-muted ice-entry-notes', item.notes));
    entry.append(detail, button(t('edit'), () => openCatch(item)));
    return entry;
  }));
}

function openCatch(item = {}) {
  draftCatch = item;
  byId('ice-catch-heading').textContent = t(item.id ? 'editCatch' : 'newCatch');
  const fish = byId('ice-catch-species');
  fish.replaceChildren(...speciesKeys.map(key => new Option(localized(species[key].name), key)), new Option(t('other'), 'other'));
  fish.value = item.species ?? target;
  byId('ice-catch-date').value = item.date ?? new Intl.DateTimeFormat('sv-SE', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  byId('ice-catch-count').value = item.count ?? 1;
  byId('ice-catch-length').value = item.length ?? '';
  const holes = byId('ice-catch-hole');
  holes.replaceChildren(new Option(t('noHole'), ''), ...state.holes.map(hole => new Option(hole.name, hole.id)));
  if (item.holeId && !state.holes.some(hole => hole.id === item.holeId)) holes.add(new Option(item.holeName, item.holeId));
  holes.value = item.holeId ?? '';
  byId('ice-catch-lure').value = item.lure ?? '';
  byId('ice-catch-notes').value = item.notes ?? '';
  byId('ice-delete-catch').hidden = !item.id;
  catchDialog.showModal();
}

function fieldNumber(id) {
  const value = byId(id).valueAsNumber;
  return Number.isFinite(value) ? value : null;
}

function upsert(list, item) {
  return list.some(entry => entry.id === item.id)
    ? list.map(entry => entry.id === item.id ? item : entry)
    : [item, ...list];
}

function announce(key) {
  const message = byId('ice-announcement');
  message.textContent = t(key);
  clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => { message.textContent = ''; }, 3800);
}

byId('ice-hole-form').addEventListener('submit', event => {
  event.preventDefault();
  const thickness = fieldNumber('ice-hole-thickness');
  const item = {
    id: draftHole.id || crypto.randomUUID(),
    name: byId('ice-hole-name').value.trim() || nextHoleName(),
    lat: draftHole.lat,
    lng: draftHole.lng,
    depth: fieldNumber('ice-hole-depth'),
    thickness,
    measuredAt: thickness == null ? null : thickness === draftHole.thickness ? draftHole.measuredAt : Date.now(),
    notes: byId('ice-hole-notes').value.trim()
  };
  updateState(latest => ({
    ...latest,
    holes: upsert(latest.holes, item),
    catches: latest.catches.map(entry => entry.holeId === item.id ? { ...entry, holeName: item.name } : entry)
  }));
  holeDialog.close();
  renderHoles();
  renderCatches();
  announce('savedHole');
  if (draftHole.id) byId('ice-holes-title').focus();
});

byId('ice-catch-form').addEventListener('submit', event => {
  event.preventDefault();
  const holeId = byId('ice-catch-hole').value;
  const item = {
    id: draftCatch.id || crypto.randomUUID(),
    species: byId('ice-catch-species').value,
    date: byId('ice-catch-date').value,
    count: fieldNumber('ice-catch-count'),
    length: fieldNumber('ice-catch-length'),
    holeId,
    holeName: state.holes.find(hole => hole.id === holeId)?.name || (holeId ? draftCatch.holeName : ''),
    lure: byId('ice-catch-lure').value.trim(),
    notes: byId('ice-catch-notes').value.trim(),
    createdAt: draftCatch.createdAt ?? Date.now()
  };
  updateState(latest => ({ ...latest, catches: upsert(latest.catches, item) }));
  catchDialog.close();
  renderCatches();
  announce('savedCatch');
  if (draftCatch.id) byId('ice-journal-title').focus();
});

byId('ice-delete-hole').addEventListener('click', () => {
  if (!window.confirm(t('confirmHole'))) return;
  updateState(latest => ({ ...latest, holes: latest.holes.filter(hole => hole.id !== draftHole.id) }));
  holeDialog.close();
  renderHoles();
  renderCatches();
  announce('removedHole');
  byId('ice-holes-title').focus();
});

byId('ice-delete-catch').addEventListener('click', () => {
  if (!window.confirm(t('confirmCatch'))) return;
  updateState(latest => ({ ...latest, catches: latest.catches.filter(item => item.id !== draftCatch.id) }));
  catchDialog.close();
  renderCatches();
  announce('removedCatch');
  byId('ice-journal-title').focus();
});

document.querySelectorAll('[data-close]').forEach(node => node.addEventListener('click', () => node.closest('dialog').close()));
byId('ice-add-hole').addEventListener('click', () => {
  if (!map) return;
  updateMapCoordinates();
  openHole(mapCenter());
});
byId('ice-add-catch').addEventListener('click', () => openCatch());
byId('ice-hole-gps').addEventListener('click', event => requestPosition(event.currentTarget, status => {
  gpsMapStatus = status;
  renderMapStatus();
}, point => {
  if (map) map.setView(point, Math.max(map.getZoom(), 15));
  if (document.body.dataset.iceView === 'kartta' && !holeDialog.open && !catchDialog.open) openHole(point);
}));

byId('ice-search').addEventListener('submit', event => {
  event.preventDefault();
  const name = byId('ice-query').value.trim();
  if (name.length >= 2) loadForecast({ kind: 'place', name }, true);
});
byId('ice-refresh').addEventListener('click', () => loadForecast(forecastLocation, true));
byId('ice-weather-gps').addEventListener('click', event => {
  const intent = ++weatherIntent;
  requestPosition(event.currentTarget, status => {
    if (weatherIntent !== intent) return;
    gpsWeatherStatus = status;
    renderWeather();
  }, point => {
    if (weatherIntent === intent) loadForecast({ kind: 'gps', ...point }, true);
  });
});
byId('ice-map-weather').addEventListener('click', () => {
  if (!map) return;
  location.hash = 'suunnittele';
  loadForecast({ kind: 'map', ...mapCenter() });
});
byId('ice-reset-gear').addEventListener('click', () => {
  updateState(latest => ({ ...latest, gear: [] }));
  syncGear();
  byId('ice-gear').querySelector('input').focus();
});
byId('ice-language').addEventListener('click', () => {
  language = language === 'fi' ? 'en' : 'fi';
  try { localStorage.setItem('user_language', language); } catch {}
  updateLanguage();
});
window.addEventListener('storage', event => {
  if ((event.key === stateKey || event.key === null) && !storageBlocked) {
    state = readState();
    syncGear();
    renderHoles();
    renderCatches();
  }
});
window.addEventListener('hashchange', () => showPanel(true));
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);

document.body.classList.add('ice-enhanced');
showPanel(Boolean(location.hash));
updateLanguage();
updateConnection();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
