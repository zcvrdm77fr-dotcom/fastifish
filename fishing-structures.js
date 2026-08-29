(function () {
  'use strict';

  if (window.__fastFishingStructuresLoaded) return;
  window.__fastFishingStructuresLoaded = true;

  const MIN_STRUCTURE_ZOOM = 11;
  const QUERY_PADDING = 0.32;
  const FETCH_DEBOUNCE_MS = 520;
  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  const TRAFICOM_SOURCE = 'https://avoinapi.vaylapilvi.fi/vaylatiedot/ogc/features/v1/collections/vesivaylatiedot:turvalaitteet_uusi/items';

  let attachedMap = null;
  let updateTimer = null;
  let fetchToken = 0;
  let cacheBounds = null;
  let cacheElements = [];
  let originalClassify = null;

  const STRUCTURE_META = {
    reedbed: {
      score: 89,
      species: ['hauki', 'ahven', 'kuha'],
      kindFi: 'Kaislikon / ruovikon reuna', kindEn: 'Reed-bed edge',
      nameFi: 'Kaislikon reuna', nameEn: 'Reed-bed edge',
      reasonFi: 'Kasvillisuuden reuna muodostaa selkeän suojan ja saalistuslinjan. Ahven, hauki ja kuha liikkuvat usein avoimen veden ja kasvillisuuden rajalla.',
      reasonEn: 'The vegetation edge forms a clear cover and feeding line. Perch, pike and zander often patrol the boundary between open water and reeds.',
      warningFi: 'Kasvillisuus voi olla hyvin matalaa ja pohjassa voi olla runsaasti takertuvaa kasvustoa.',
      warningEn: 'Vegetation can be extremely shallow and snaggy.'
    },
    shoal: {
      score: 92,
      species: ['ahven', 'hauki', 'kuha', 'siika'],
      kindFi: 'Matalikko', kindEn: 'Shoal',
      nameFi: 'Matalikko', nameEn: 'Shoal',
      reasonFi: 'Matalikon reuna ja päällä lämpenevä vesi keräävät pikkukalaa. Syvän ja matalan veden vaihdos on vahva petokalojen ruokailurakenne.',
      reasonEn: 'A shoal and its depth transition can gather baitfish and create a strong feeding structure for predators.',
      warningFi: 'Matalikko on veneelle vaarallinen. Älä käytä tätä pistettä navigointiin.',
      warningEn: 'Shoals are a boating hazard. Do not use this point for navigation.'
    },
    reef: {
      score: 91,
      species: ['ahven', 'kuha', 'siika', 'taimen'],
      kindFi: 'Riutta / karikko', kindEn: 'Reef / rocky shoal',
      nameFi: 'Riutta tai karikko', nameEn: 'Reef or rocky shoal',
      reasonFi: 'Kova pohja, kivien välit ja ympäröivä syvyysvaihtelu tarjoavat ravintoa ja suojapaikkoja monille kaloille.',
      reasonEn: 'Hard bottom, gaps between rocks and nearby depth variation create feeding and holding water for many fish species.',
      warningFi: 'Karikko voi olla erittäin vaarallinen veneelle. Lähesty vain virallisen merikartan ja paikallistuntemuksen avulla.',
      warningEn: 'Rocky shoals can be extremely dangerous to boats. Use an official nautical chart and local knowledge.'
    },
    rock: {
      score: 87,
      species: ['ahven', 'kuha', 'siika', 'taimen'],
      kindFi: 'Vedenalainen kivi / kari', kindEn: 'Underwater rock / skerry',
      nameFi: 'Kivi tai kari', nameEn: 'Rock or skerry',
      reasonFi: 'Yksittäinen vedenalainen kivi rikkoo tasaista pohjaa, tarjoaa suojaa pikkukalalle ja voi muodostaa hyvän väijyntäpisteen.',
      reasonEn: 'An isolated underwater rock breaks up uniform bottom, shelters baitfish and can create a useful ambush point.',
      warningFi: 'Kivi voi olla aivan pinnassa tai veden alla. Piste ei ole navigointiohje.',
      warningEn: 'The rock may be awash or submerged. This point is not navigational guidance.'
    },
    rock_cluster: {
      score: 93,
      species: ['ahven', 'hauki', 'kuha', 'siika', 'taimen'],
      kindFi: 'Kivikko / karikko', kindEn: 'Rock field / skerry',
      nameFi: 'Kivikkoinen alue', nameEn: 'Rocky area',
      reasonFi: 'Usean lähekkäisen kiven muodostama kivikko tarjoaa paljon reunaa, rakoja ja kovaa pohjaa. Se on selvästi vahvempi rakenne kuin yksittäinen kivi.',
      reasonEn: 'Several nearby rocks create many edges, gaps and hard-bottom transitions, making a stronger structure than a single isolated rock.',
      warningFi: 'Kivikko on veneelle vaarallinen. Älä aja pisteeseen suoraan karttamerkin perusteella.',
      warningEn: 'Rock fields are hazardous to boats. Do not drive directly to this point based on the marker.'
    },
    islet_edge: {
      score: 84,
      species: ['ahven', 'hauki', 'kuha', 'taimen'],
      kindFi: 'Luodon / pienen saaren reuna', kindEn: 'Islet edge',
      nameFi: 'Luodon reuna', nameEn: 'Islet edge',
      reasonFi: 'Pienen luodon ympärillä pohja muuttuu usein nopeasti ja tuuli sekä virtaus kiertävät reunan kautta. Tämä tekee reunasta luonnollisen kalojen kulku- ja syöntipaikan.',
      reasonEn: 'Bottom shape, wind and current often change around a small islet, creating a natural travel and feeding edge.',
      warningFi: 'Ranta voi olla yksityinen ja ympärillä voi olla näkymättömiä kiviä. Pidä veneellä turvaetäisyys.',
      warningEn: 'The shore may be private and hidden rocks may surround the islet. Keep a safe boating distance.'
    },
    fairway_edge: {
      score: 82,
      species: ['kuha', 'ahven', 'hauki'],
      kindFi: 'Väylän reuna', kindEn: 'Fairway edge',
      nameFi: 'Väylän reuna', nameEn: 'Fairway edge',
      reasonFi: 'Väyläalueen reuna on todellinen vedenalaisen rakenteen raja ja voi toimia kalojen kulkulinjana. Se ei kuitenkaan automaattisesti tarkoita jyrkkää syvyyspenkkaa.',
      reasonEn: 'A fairway-area boundary is a real underwater-use edge and can act as a fish travel line, although it does not automatically mean a steep depth break.',
      warningFi: 'Älä kalasta tai ankkuroidu vilkkaan väylän keskelle. Väylän reuna ei ole sama asia kuin varmistettu syvyyskäyrä.',
      warningEn: 'Do not fish or anchor in active traffic. A fairway edge is not the same as a verified bathymetric contour.'
    }
  };

  function haversineM(a, b) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function expandedMapBounds(bounds, pad) {
    const latPad = (bounds.getNorth() - bounds.getSouth()) * pad;
    const lonPad = (bounds.getEast() - bounds.getWest()) * pad;
    return {
      south: Math.max(59.25, bounds.getSouth() - latPad),
      west: Math.max(18.8, bounds.getWest() - lonPad),
      north: Math.min(70.35, bounds.getNorth() + latPad),
      east: Math.min(31.8, bounds.getEast() + lonPad)
    };
  }

  function containsBounds(outer, inner) {
    return !!outer && inner.getSouth() >= outer.south && inner.getWest() >= outer.west && inner.getNorth() <= outer.north && inner.getEast() <= outer.east;
  }

  function overpassQuery(b) {
    const box = `${b.south},${b.west},${b.north},${b.east}`;
    return `[out:json][timeout:12];(\nnode[\"wetland\"=\"reedbed\"](${box});way[\"wetland\"=\"reedbed\"](${box});\nnode[\"natural\"=\"shoal\"](${box});way[\"natural\"=\"shoal\"](${box});relation[\"natural\"=\"shoal\"](${box});\nnode[\"natural\"=\"reef\"](${box});way[\"natural\"=\"reef\"](${box});relation[\"natural\"=\"reef\"](${box});\nnode[\"seamark:type\"=\"rock\"](${box});way[\"seamark:type\"=\"rock\"](${box});\nnode[\"seamark:type\"=\"reef\"](${box});way[\"seamark:type\"=\"reef\"](${box});\nnode[\"seamark:rock:water_level\"](${box});way[\"seamark:rock:water_level\"](${box});\nnode[\"place\"=\"islet\"](${box});way[\"place\"=\"islet\"](${box});\n);out tags center geom 450;`;
  }

  async function fetchOverpass(query) {
    let lastError = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const url = `${endpoint}?data=${encodeURIComponent(query)}`;
        const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        const data = await res.json();
        return Array.isArray(data.elements) ? data.elements : [];
      } catch (err) {
        clearTimeout(timeout);
        lastError = err;
      }
    }
    throw lastError || new Error('Overpass failed');
  }

  function geometryCenter(el) {
    if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) return { lat: el.lat, lon: el.lon };
    if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) return { lat: el.center.lat, lon: el.center.lon };
    const geom = Array.isArray(el.geometry) ? el.geometry.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)) : [];
    if (!geom.length) return null;
    const sum = geom.reduce((acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }), { lat: 0, lon: 0 });
    return { lat: sum.lat / geom.length, lon: sum.lon / geom.length };
  }

  function nearestGeometryPoint(el, target) {
    const geom = Array.isArray(el.geometry) ? el.geometry.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)) : [];
    if (!geom.length) return geometryCenter(el);
    let best = geom[0], bestD = Infinity;
    for (const p of geom) {
      const d = (p.lat - target.lat) ** 2 + ((p.lon - target.lon) * Math.cos(target.lat * Math.PI / 180)) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return { lat: best.lat, lon: best.lon };
  }

  function offsetOutward(edge, center, meters) {
    if (!edge || !center) return edge;
    let dx = (edge.lon - center.lon) * Math.cos(edge.lat * Math.PI / 180);
    let dy = edge.lat - center.lat;
    const len = Math.hypot(dx, dy);
    if (!len) return edge;
    dx /= len; dy /= len;
    const dLat = (meters / 111320) * dy;
    const cos = Math.max(0.15, Math.cos(edge.lat * Math.PI / 180));
    const dLon = (meters / (111320 * cos)) * (dx / cos);
    return { lat: edge.lat + dLat, lon: edge.lon + dLon };
  }

  function osmStructureType(tags) {
    if (tags.wetland === 'reedbed') return 'reedbed';
    if (tags.natural === 'shoal') return 'shoal';
    if (tags.natural === 'reef' || tags['seamark:type'] === 'reef') return 'reef';
    if (tags['seamark:type'] === 'rock' || tags['seamark:rock:water_level']) return 'rock';
    if (tags.place === 'islet') return 'islet_edge';
    return null;
  }

  function normalizeOsmElement(el, mapCenter) {
    const tags = el.tags || {};
    const structureType = osmStructureType(tags);
    if (!structureType) return null;
    const center = geometryCenter(el);
    if (!center) return null;

    let point = center;
    if (structureType === 'reedbed') point = nearestGeometryPoint(el, mapCenter) || center;
    if (structureType === 'islet_edge') {
      const edge = nearestGeometryPoint(el, mapCenter) || center;
      point = offsetOutward(edge, center, 28) || edge;
    }

    return {
      type: el.type || 'node',
      id: el.id,
      lat: point.lat,
      lon: point.lon,
      tags,
      _fastStructure: true,
      _structureType: structureType,
      _sourceUrl: `https://www.openstreetmap.org/${encodeURIComponent(el.type || 'node')}/${encodeURIComponent(el.id)}`
    };
  }

  function clusterOsmRocks(elements) {
    const rocks = elements.filter(e => e._structureType === 'rock');
    const others = elements.filter(e => e._structureType !== 'rock');
    const used = new Set();
    const out = others.slice();

    for (let i = 0; i < rocks.length; i++) {
      if (used.has(i)) continue;
      const group = [];
      for (let j = i; j < rocks.length; j++) {
        if (used.has(j)) continue;
        if (haversineM({ lat: rocks[i].lat, lon: rocks[i].lon }, { lat: rocks[j].lat, lon: rocks[j].lon }) <= 330) group.push(j);
      }
      if (group.length >= 3) {
        group.forEach(j => used.add(j));
        const lat = group.reduce((s, j) => s + rocks[j].lat, 0) / group.length;
        const lon = group.reduce((s, j) => s + rocks[j].lon, 0) / group.length;
        const first = rocks[group[0]];
        out.push({
          type: 'node', id: `rockcluster-${first.id}`, lat, lon,
          tags: { name: currentLang === 'fi' ? `Kivikko (${group.length} kiveä)` : `Rock field (${group.length} rocks)` },
          _fastStructure: true, _structureType: 'rock_cluster', _sourceUrl: first._sourceUrl
        });
      } else {
        used.add(i);
        out.push(rocks[i]);
      }
    }
    return out;
  }

  function flattenCoordinates(coords, out) {
    if (!Array.isArray(coords)) return out;
    if (coords.length >= 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
      out.push({ lon: coords[0], lat: coords[1] });
      return out;
    }
    coords.forEach(c => flattenCoordinates(c, out));
    return out;
  }

  function nearestGeoJsonBoundaryPoint(feature, mapCenter) {
    const pts = flattenCoordinates(feature && feature.geometry && feature.geometry.coordinates, []);
    if (!pts.length) return null;
    let best = pts[0], bestD = Infinity;
    for (const p of pts) {
      const d = (p.lat - mapCenter.lat) ** 2 + ((p.lon - mapCenter.lon) * Math.cos(mapCenter.lat * Math.PI / 180)) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  async function fetchOfficialStructures(b, mapCenter) {
    if (typeof fetchVaylapilviCollection !== 'function') return [];
    const bbox = [b.west, b.south, b.east, b.north];
    // Aiemmin myös turvalaitteiden kardinaali-/vaaramerkit (navigointilajikoodi 3-7) tuottivat
    // oman "kari/matalikko"-kalaspotin. Käyttäjäpalaute: näin ei aina ole - merkki kertoo VAIN
    // että jokin vaarallinen kohde on lähistöllä, ei mitä se on tai onko se edes kalastuksen
    // kannalta merkityksellinen (voi olla hylky, syvyysrajoitus tms). Väärän tarkka väite
    // poistettu - jäljelle jää vain aidosti todennettava väyläalueen reunasignaali.
    const areasResult = await fetchVaylapilviCollection('vesivaylatiedot:vaylaalueet_uusi', bbox, 260).catch(() => null);
    const out = [];

    if (areasResult) {
      for (const feature of areasResult.features || []) {
        const point = nearestGeoJsonBoundaryPoint(feature, mapCenter);
        if (!point) continue;
        const p = feature.properties || {};
        out.push({
          type: 'node', id: `traficom-fairway-${p.id || p.vaylaalueid || out.length}`,
          lat: point.lat, lon: point.lon,
          tags: { name: p.nimifi || '' },
          _fastStructure: true, _structureType: 'fairway_edge', _sourceUrl: TRAFICOM_SOURCE
        });
      }
    }
    return out;
  }

  function classifyStructure(el, selectedSpecies) {
    const meta = STRUCTURE_META[el && el._structureType];
    if (!meta) return null;
    let score = meta.score;
    if (selectedSpecies && selectedSpecies !== 'all') score += meta.species.includes(selectedSpecies) ? 7 : -10;
    if (el.tags && (el.tags.name || el.tags['name:fi'])) score += 1;
    score = Math.max(48, Math.min(96, Math.round(score)));
    const fi = typeof currentLang === 'undefined' || currentLang === 'fi';
    const rawName = el.tags && (el.tags['name:fi'] || el.tags.name);
    return {
      id: `structure-${String(el.id)}`,
      lat: el.lat, lon: el.lon,
      score, structureScore: score,
      kind: fi ? meta.kindFi : meta.kindEn,
      name: rawName || (fi ? meta.nameFi : meta.nameEn),
      reason: fi ? meta.reasonFi : meta.reasonEn,
      warning: fi ? meta.warningFi : meta.warningEn,
      species: meta.species,
      typeKey: el._structureType,
      sourceUrl: el._sourceUrl || TRAFICOM_SOURCE
    };
  }

  function patchClassifier() {
    if (originalClassify || typeof classifyPotentialSpot !== 'function') return;
    originalClassify = classifyPotentialSpot;
    classifyPotentialSpot = function (el, selectedSpecies) {
      if (el && el._fastStructure) return classifyStructure(el, selectedSpecies);
      return originalClassify(el, selectedSpecies);
    };
  }

  function baseElementsOnly() {
    if (typeof potentialSpotLastElements === 'undefined' || !Array.isArray(potentialSpotLastElements)) return [];
    return potentialSpotLastElements.filter(el => !el || !el._fastStructure);
  }

  function renderMerged(extras) {
    if (typeof renderPotentialSpotMarkers !== 'function') return;
    const base = baseElementsOnly();
    renderPotentialSpotMarkers(base.concat(extras || []));
  }

  async function refreshStructures(force) {
    if (!attachedMap || typeof potentialSpotsWanted === 'undefined' || !potentialSpotsWanted) return;
    if (attachedMap.getZoom() < MIN_STRUCTURE_ZOOM) {
      cacheElements = [];
      cacheBounds = null;
      return;
    }

    const currentBounds = attachedMap.getBounds();
    if (!force && cacheBounds && containsBounds(cacheBounds, currentBounds)) {
      renderMerged(cacheElements);
      return;
    }

    const token = ++fetchToken;
    const padded = expandedMapBounds(currentBounds, QUERY_PADDING);
    const center = attachedMap.getCenter();
    const mapCenter = { lat: center.lat, lon: center.lng };

    const [osmResult, officialResult] = await Promise.allSettled([
      fetchOverpass(overpassQuery(padded)),
      fetchOfficialStructures(padded, mapCenter)
    ]);
    if (token !== fetchToken || !potentialSpotsWanted) return;

    // Molemmat haut voivat epäonnistua hetkellisesti (Overpass-rajapinta on usein ruuhkainen).
    // Jos NIIN käy, säilytetään edelliset merkit sen sijaan että ne katoaisivat kartalta -
    // käyttäjä ei saa nähdä pisteen häviävän vain siksi että zoomasi ja haku sattui epäonnistumaan.
    if (osmResult.status !== 'fulfilled' && officialResult.status !== 'fulfilled') return;

    let extras = [];
    if (osmResult.status === 'fulfilled') {
      const osm = osmResult.value.map(el => normalizeOsmElement(el, mapCenter)).filter(Boolean);
      extras = extras.concat(clusterOsmRocks(osm));
    }
    if (officialResult.status === 'fulfilled') extras = extras.concat(officialResult.value);

    const seen = new Set();
    extras = extras.filter(el => {
      const key = `${el._structureType}:${el.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Number.isFinite(el.lat) && Number.isFinite(el.lon);
    });

    cacheBounds = padded;
    cacheElements = extras;
    renderMerged(extras);
  }

  function scheduleRefresh(force) {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => refreshStructures(!!force), FETCH_DEBOUNCE_MS);
  }

  function attach() {
    patchClassifier();
    if (typeof seaChartMap === 'undefined' || !seaChartMap || typeof renderPotentialSpotMarkers !== 'function') return false;
    if (attachedMap === seaChartMap) return true;

    attachedMap = seaChartMap;
    attachedMap.on('moveend zoomend', () => scheduleRefresh(false));

    const toggle = document.getElementById('potentialSpotsToggle');
    if (toggle) toggle.addEventListener('change', () => {
      if (toggle.checked) scheduleRefresh(true);
      else {
        ++fetchToken;
        cacheBounds = null;
        cacheElements = [];
      }
    });

    const species = document.getElementById('potentialSpotSpecies');
    if (species) species.addEventListener('change', () => {
      if (typeof potentialSpotsWanted !== 'undefined' && potentialSpotsWanted && cacheElements.length) {
        setTimeout(() => renderMerged(cacheElements), 180);
      }
    });

    if (typeof potentialSpotsWanted !== 'undefined' && potentialSpotsWanted) scheduleRefresh(true);
    return true;
  }

  let tries = 0;
  const boot = setInterval(() => {
    tries++;
    patchClassifier();
    if (attach() || tries > 120) clearInterval(boot);
  }, 500);
})();
