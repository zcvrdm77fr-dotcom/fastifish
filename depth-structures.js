(function () {
  'use strict';

  if (window.__fastFishingDepthStructuresLoaded) return;
  window.__fastFishingDepthStructuresLoaded = true;

  const TRAFICOM_WFS = 'https://julkinen.traficom.fi/inspirepalvelu/avoin/wfs';
  const INLAND_MANIFEST = '/inland-depth/manifest.json';
  const API_BASE = String(window.FASTFISH_API_BASE || 'https://api.fastfishin.com').replace(/\/+$/, '');
  const EMODNET_SOURCE = 'https://emodnet.ec.europa.eu/en/bathymetry';
  const TRAFICOM_SOURCE = 'https://www.traficom.fi/fi/merikartoitus/merikarttojen-aineistopalvelut/merenmittausaineistot';
  const MIN_ZOOM = 10;
  const DEBOUNCE = 500;
  const MAX_CONTOURS = 2600;
  const MAX_AREAS = 1200;
  const MAX_SOUNDINGS = 900;
  const MAX_SAMPLES = 1700;
  const WFS_UTILS = import('/depth-wfs-utils.js').catch(() => null);

  let map = null;
  let timer = null;
  let token = 0;
  let cacheBounds = null;
  let cache = [];
  let prevClassifier = null;
  let discoveredLayers = null;
  let capabilitiesPromise = null;
  let lastDiag = null;
  let inlandManifestPromise = null;
  const inlandTileCache = new Map();

  const META = {
    pike_flat: {
      score: 94,
      species: ['hauki', 'ahven'],
      fi: 'Haukimatala 0–3 m',
      en: 'Pike flat 0–3 m',
      reasonFi: '0–3 metrin tasanne on tyypillinen hauen ruokailu- ja suoja-alue. Vieressä oleva syvempi vesi tekee siitä vielä paremman.',
      reasonEn: 'A 0–3 m flat is classic pike feeding and cover habitat, especially next to deeper water.'
    },
    shallow_edge: {
      score: 93,
      species: ['hauki', 'ahven', 'kuha'],
      fi: 'Matalan reuna 3–6 m',
      en: 'Shallow edge 3–6 m',
      reasonFi: 'Matalan ja syvemmän veden raja on vahva kulku- ja syöntirakenne hauelle, ahvenelle ja kuhalle.',
      reasonEn: 'The transition from shallow to deeper water is a strong travel and feeding structure.'
    },
    depth_break: {
      score: 94,
      species: ['ahven', 'kuha', 'hauki', 'siika'],
      fi: 'Syvyyspenkka',
      en: 'Depth break',
      reasonFi: 'Lähekkäiset eri syvyydet kertovat pudotuksesta. Penkan ylä- ja alareuna ovat petokalojen tyypillisiä kulkulinjoja.',
      reasonEn: 'Nearby depth changes indicate a drop-off; its top and base are common predator travel lines.'
    },
    steep_break: {
      score: 94,
      species: ['ahven', 'kuha', 'siika', 'taimen'],
      fi: 'Jyrkkä syvyyspenkka',
      en: 'Steep depth break',
      reasonFi: 'Syvyys muuttuu nopeasti lyhyellä matkalla. Jyrkkä reuna yhdistää ruokailualueen ja syvän veden suojan.',
      reasonEn: 'Depth changes rapidly over a short distance, placing feeding water beside deep-water security.'
    },
    deep_edge: {
      score: 91,
      species: ['kuha', 'ahven', 'siika'],
      fi: 'Syvänteen reuna',
      en: 'Deep-hole edge',
      reasonFi: 'Syvemmän altaan tai montun reuna on kuhalle ja ahvenelle vahva syvyydenvaihdos.',
      reasonEn: 'The edge of a deeper basin is a strong depth transition for zander and perch.'
    },
    sounding_break: {
      score: 89,
      species: ['kuha', 'ahven', 'hauki'],
      fi: 'Luotauspisteiden syvyysvaihdos',
      en: 'Sounding depth change',
      reasonFi: 'Lähekkäisissä syvyyspisteissä on suuri ero, mikä viittaa penkkaan tai montun reunaan.',
      reasonEn: 'Nearby depth samples differ sharply, indicating a likely break or basin edge.'
    }
  };

  const rad = degrees => degrees * Math.PI / 180;
  const clamp = (number, min, max) => Math.max(min, Math.min(max, number));

  function distance(a, b) {
    const radius = 6371000;
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(h));
  }

  function average(points) {
    if (!points.length) return null;
    let lat = 0;
    let lon = 0;
    for (const point of points) {
      lat += point.lat;
      lon += point.lon;
    }
    return { lat: lat / points.length, lon: lon / points.length };
  }

  function expanded(bounds, padding = 0.2) {
    const latPad = (bounds.getNorth() - bounds.getSouth()) * padding;
    const lonPad = (bounds.getEast() - bounds.getWest()) * padding;
    let south = Math.max(58.2, bounds.getSouth() - latPad);
    let north = Math.min(71.8, bounds.getNorth() + latPad);
    let west = Math.max(17.2, bounds.getWest() - lonPad);
    let east = Math.min(32.8, bounds.getEast() + lonPad);

    // Oracle-proxy hyväksyy tarkoituksella vain kompaktin bboxin. Rajaa hyvin matalilla zoomeilla
    // näkymän keskipisteen ympärille sen sijaan, että endpointista tulisi yleinen karttaproxy.
    if (east - west > 1.5) {
      const middle = (east + west) / 2;
      west = middle - 0.75;
      east = middle + 0.75;
    }
    if (north - south > 1.5) {
      const middle = (north + south) / 2;
      south = middle - 0.75;
      north = middle + 0.75;
    }
    return { south, west, north, east };
  }

  function contains(outer, inner) {
    return outer
      && inner.getSouth() >= outer.south
      && inner.getWest() >= outer.west
      && inner.getNorth() <= outer.north
      && inner.getEast() <= outer.east;
  }

  async function responseText(url, accept, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: accept || '*/*' }
      });
      return {
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        body: await response.text()
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  function localElements(root, names) {
    const wanted = new Set(Array.isArray(names) ? names : [names]);
    return [...root.getElementsByTagName('*')]
      .filter(element => wanted.has(element.localName || String(element.nodeName || '').split(':').pop()));
  }

  function firstLocal(root, names) {
    return localElements(root, names)[0] || null;
  }

  function localText(root, name) {
    return (firstLocal(root, name)?.textContent || '').trim();
  }

  function parseCapabilitiesLocal(xml) {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (localElements(document, 'parsererror').length) throw new Error('GetCapabilities XML parse failed');
    const features = localElements(document, 'FeatureType').map(feature => {
      const name = localText(feature, 'Name');
      const title = localText(feature, 'Title');
      return { name, hay: `${name} ${title}`.toLowerCase() };
    }).filter(feature => feature.name);

    const pick = (exact, keywords) => {
      for (const expected of exact) {
        const match = features.find(feature => feature.name === expected || feature.name.endsWith(`:${expected}`));
        if (match) return match.name;
      }
      return features.find(feature => keywords.some(keyword => feature.hay.includes(keyword)))?.name || null;
    };

    const formats = localElements(document, ['Format', 'Value'])
      .map(node => (node.textContent || '').trim())
      .filter(value => /json|gml|xml/i.test(value));

    return {
      layers: {
        contour: pick(['DepthContour_L'], ['depthcontour', 'syvyyskäyr', 'syvyyskayr', 'depcont']),
        area: pick(['DepthArea_A'], ['deptharea', 'syvyysalue', 'depare']),
        sounding: pick(['Sounding_P'], ['sounding', 'syvyyspiste', 'soundg'])
      },
      formats: [...new Set(formats)]
    };
  }

  async function discoverTraficom() {
    if (discoveredLayers) return discoveredLayers;
    if (!capabilitiesPromise) {
      capabilitiesPromise = (async () => {
        const utils = await WFS_UTILS;
        const errors = [];
        let lastParsed = { layers: {}, formats: [] };

        for (const version of ['2.0.0', '1.1.0']) {
          try {
            const url = `${TRAFICOM_WFS}?service=WFS&version=${version}&request=GetCapabilities`;
            const response = await responseText(url, 'application/xml,text/xml,*/*', 9000);
            if (!response.ok) {
              errors.push(`GetCapabilities ${version}: HTTP ${response.status}`);
              continue;
            }
            const parsed = utils?.parseWfsCapabilities
              ? utils.parseWfsCapabilities(response.body)
              : parseCapabilitiesLocal(response.body);
            lastParsed = parsed;
            const found = parsed?.layers || {};
            if (found.contour || found.area || found.sounding) {
              return {
                contour: found.contour || null,
                area: found.area || null,
                sounding: found.sounding || null,
                formats: parsed.formats || [],
                capabilitiesVersion: version,
                capabilitiesErrors: errors,
                available: true
              };
            }
            errors.push(`GetCapabilities ${version}: avoimia syvyyslayereita ei löytynyt`);
          } catch (error) {
            errors.push(`GetCapabilities ${version}: ${error?.name === 'AbortError' ? 'timeout' : (error?.message || 'virhe')}`);
          }
        }

        return {
          contour: null,
          area: null,
          sounding: null,
          formats: lastParsed.formats || [],
          capabilitiesVersion: null,
          capabilitiesErrors: errors,
          available: false
        };
      })();
    }
    discoveredLayers = await capabilitiesPromise;
    return discoveredLayers;
  }

  function coordinatePairs(text) {
    const numbers = String(text || '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    const out = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      const first = numbers[i];
      const second = numbers[i + 1];
      let lon = first;
      let lat = second;
      if (first >= 58 && first <= 72 && second >= 17 && second <= 33) {
        lat = first;
        lon = second;
      }
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) out.push([lon, lat]);
    }
    return out;
  }

  function parseGmlFeatures(xml) {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (localElements(document, 'parsererror').length) throw new Error('GML/XML parse failed');
    const members = localElements(document, ['member', 'featureMember']);
    const out = [];

    for (const member of members) {
      const feature = [...member.children][0];
      if (!feature) continue;
      const properties = {};
      for (const child of feature.children) {
        const local = (child.localName || child.nodeName || '').toLowerCase();
        if (/geom|shape|position|location|point|curve|surface/.test(local)) continue;
        const geometryChild = firstLocal(child, [
          'pos', 'posList', 'coordinates', 'Point', 'LineString', 'Polygon', 'Curve', 'Surface',
          'MultiPoint', 'MultiLineString', 'MultiCurve', 'MultiSurface', 'MultiPolygon'
        ]);
        if (!geometryChild) {
          const value = (child.textContent || '').trim();
          if (value && value.length < 500) properties[child.localName || child.nodeName] = value;
        }
      }

      const geometryRoot = firstLocal(feature, [
        'Point', 'LineString', 'Curve', 'Polygon', 'Surface', 'MultiPoint', 'MultiLineString',
        'MultiCurve', 'MultiSurface', 'MultiPolygon'
      ]);
      if (!geometryRoot) continue;
      const name = (geometryRoot.localName || geometryRoot.nodeName || '').toLowerCase();
      const positionLists = localElements(geometryRoot, ['posList', 'coordinates'])
        .map(node => coordinatePairs(node.textContent)).filter(values => values.length);
      const positions = localElements(geometryRoot, 'pos')
        .map(node => coordinatePairs(node.textContent)[0]).filter(Boolean);
      let geometry = null;

      if (name.includes('point')) {
        const point = positions[0] || positionLists[0]?.[0];
        if (point) geometry = { type: 'Point', coordinates: point };
      } else if (name.includes('polygon') || name.includes('surface')) {
        const ring = positionLists[0] || positions;
        if (ring?.length) geometry = { type: 'Polygon', coordinates: [ring] };
      } else {
        const line = positionLists[0] || positions;
        if (line?.length) geometry = { type: 'LineString', coordinates: line };
      }

      const id = feature.getAttributeNS?.('http://www.opengis.net/gml/3.2', 'id')
        || feature.getAttributeNS?.('http://www.opengis.net/gml', 'id')
        || feature.getAttribute('gml:id')
        || feature.getAttribute('id')
        || undefined;
      if (geometry) out.push({ type: 'Feature', id, properties, geometry });
    }
    return out;
  }

  async function fetchWfsLayer(typeName, bounds, count, formats) {
    if (!typeName) return { features: [], attempt: null };
    const utils = await WFS_UTILS;
    const candidates = utils?.buildWfsCandidates?.({
      endpoint: TRAFICOM_WFS,
      typeName,
      bounds,
      count,
      formats
    }) || [];
    const attempts = [];

    for (const candidate of candidates) {
      try {
        const response = await responseText(
          candidate.url,
          'application/json,application/geo+json,application/xml,text/xml;q=.8,*/*;q=.2',
          12000
        );
        const describe = message => utils?.describeWfsAttempt
          ? utils.describeWfsAttempt({
            typeName,
            version: candidate.version,
            outputFormat: candidate.outputFormat,
            status: response.status,
            message
          })
          : `${typeName} · WFS ${candidate.version} · HTTP ${response.status} · ${message}`;

        if (!response.ok) {
          attempts.push(describe(response.body.replace(/\s+/g, ' ').slice(0, 120)));
          continue;
        }

        if (candidate.responseKind === 'json' || /json/i.test(response.contentType)) {
          try {
            const data = JSON.parse(response.body);
            if (Array.isArray(data.features)) {
              return { features: data.features, attempt: describe(data.features.length ? 'OK' : 'ei kohteita') };
            }
            attempts.push(describe('JSON-vastauksessa ei features-taulukkoa'));
          } catch {
            attempts.push(describe('JSON-jäsennys epäonnistui'));
          }
        }

        try {
          const features = parseGmlFeatures(response.body);
          return { features, attempt: describe(features.length ? 'GML fallback OK' : 'GML fallback: ei kohteita') };
        } catch (error) {
          attempts.push(describe(error?.message || 'GML-jäsennys epäonnistui'));
        }
      } catch (error) {
        attempts.push(`${typeName} · ${error?.name === 'AbortError' ? 'timeout' : (error?.message || 'verkkovirhe')}`);
      }
    }

    const error = new Error(`Traficom WFS failed for ${typeName}`);
    error.attempts = attempts;
    throw error;
  }

  function geometryParts(geometry) {
    if (!geometry) return [];
    const coordinates = geometry.coordinates;
    if (geometry.type === 'Point') return [[coordinates]];
    if (geometry.type === 'MultiPoint') return coordinates.map(point => [point]);
    if (geometry.type === 'LineString') return [coordinates];
    if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') return coordinates;
    if (geometry.type === 'MultiPolygon') return coordinates.flat();
    return [];
  }

  function pointFromCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
    const lon = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }

  function featureCenter(feature) {
    const points = [];
    for (const part of geometryParts(feature.geometry)) {
      for (const coordinates of part) {
        const point = pointFromCoordinates(coordinates);
        if (point) points.push(point);
        if (points.length > 500) break;
      }
    }
    return average(points);
  }

  function numericProperty(properties, exact, patterns) {
    for (const expected of exact) {
      const key = Object.keys(properties || {}).find(value => value.toLowerCase() === expected.toLowerCase());
      if (key) {
        const number = Number(String(properties[key]).replace(',', '.'));
        if (Number.isFinite(number)) return number;
      }
    }
    for (const [key, value] of Object.entries(properties || {})) {
      if (!patterns.some(pattern => pattern.test(key))) continue;
      const number = Number(String(value).replace(',', '.'));
      if (Number.isFinite(number)) return number;
    }
    return null;
  }

  function contourDepth(properties) {
    const value = numericProperty(
      properties,
      ['VALDCO', 'DEPTH', 'SYVYYS', 'SYVYYS_M', 'ARVO', 'Z'],
      [/valdco/i, /depth/i, /syv/i, /contour.*val/i]
    );
    return value != null && value >= 0 && value <= 500 ? value : null;
  }

  function soundingDepth(properties) {
    const value = numericProperty(
      properties,
      ['VALSOU', 'DEPTH', 'SYVYYS', 'SYVYYS_M'],
      [/valsou/i, /sound.*depth/i, /depth/i, /syv/i]
    );
    return value != null && value >= 0 && value <= 500 ? value : null;
  }

  function depthRange(properties) {
    let min = numericProperty(properties, ['DRVAL1', 'MINDEPTH', 'SYVYYS_MIN'], [/drval1/i, /min.*depth/i, /syv.*min/i]);
    let max = numericProperty(properties, ['DRVAL2', 'MAXDEPTH', 'SYVYYS_MAX'], [/drval2/i, /max.*depth/i, /syv.*max/i]);
    if (min == null && max == null) {
      const depth = contourDepth(properties);
      if (depth != null) {
        min = 0;
        max = depth;
      }
    }
    if (min == null && max != null) min = 0;
    if (max == null && min != null) max = min;
    return min != null && max != null ? { min: Math.min(min, max), max: Math.max(min, max) } : null;
  }

  function sampleContour(part, depth, id) {
    const points = part.map(pointFromCoordinates).filter(Boolean);
    if (points.length < 2) return [];
    const out = [];
    const spacing = depth <= 6 ? 115 : depth <= 12 ? 165 : 230;
    let carry = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const length = distance(a, b);
      if (!length) continue;
      let position = Math.max(spacing - carry, 0);
      while (position <= length && out.length < 90) {
        const t = position / length;
        out.push({
          lat: a.lat + (b.lat - a.lat) * t,
          lon: a.lon + (b.lon - a.lon) * t,
          depth,
          source: id
        });
        position += spacing;
      }
      carry = (carry + length) % spacing;
    }
    if (!out.length) out.push({ ...points[Math.floor(points.length / 2)], depth, source: id });
    return out;
  }

  function contourSamples(features) {
    const out = [];
    for (let i = 0; i < features.length && out.length < MAX_SAMPLES; i++) {
      const depth = contourDepth(features[i].properties || {});
      if (depth == null) continue;
      for (const part of geometryParts(features[i].geometry)) {
        out.push(...sampleContour(part, depth, features[i].id || i));
        if (out.length >= MAX_SAMPLES) break;
      }
    }
    return out.slice(0, MAX_SAMPLES);
  }

  function depthElement(kind, point, options = {}) {
    const firstDepth = Number.isFinite(options.depth) ? options.depth : null;
    const secondDepth = Number.isFinite(options.otherDepth) ? options.otherDepth : null;
    const label = firstDepth != null && secondDepth != null
      ? `${Math.min(firstDepth, secondDepth).toFixed(1)}–${Math.max(firstDepth, secondDepth).toFixed(1)} m`
      : firstDepth != null ? `${firstDepth.toFixed(1)} m` : '';
    const prefix = options.dataset === 'emodnet' ? 'EMODnet ~115 m · ' : '';
    return {
      type: 'depth',
      id: `depth-${kind}-${options.id || Math.random().toString(36).slice(2)}`,
      lat: point.lat,
      lon: point.lon,
      tags: { name: `${prefix}${META[kind].fi}${label ? ` ${label}` : ''}` },
      _fastDepthStructure: true,
      _depthType: kind,
      _gradient: options.gradient || 0,
      _depth: firstDepth,
      _otherDepth: secondDepth,
      _baseScore: Number.isFinite(options.baseScore) ? options.baseScore : null,
      _depthDataset: options.dataset || 'traficom',
      _depthResolution: options.resolution || null,
      _sourceUrl: options.sourceUrl || TRAFICOM_SOURCE
    };
  }

  function contourBreaks(samples) {
    const cellSize = 0.0022;
    const grid = new Map();
    samples.forEach((sample, index) => {
      const key = `${Math.floor(sample.lat / cellSize)},${Math.floor(sample.lon / cellSize)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(index);
    });

    const out = [];
    const seen = new Set();
    for (let i = 0; i < samples.length; i++) {
      const a = samples[i];
      const cy = Math.floor(a.lat / cellSize);
      const cx = Math.floor(a.lon / cellSize);
      let best = null;
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          for (const j of grid.get(`${cy + y},${cx + x}`) || []) {
            if (j <= i) continue;
            const b = samples[j];
            const depthDifference = Math.abs(a.depth - b.depth);
            if (depthDifference < 2.5 || a.source === b.source) continue;
            const metres = distance(a, b);
            if (metres < 18 || metres > 230) continue;
            const gradient = depthDifference / metres;
            if (!best || gradient > best.gradient) best = { b, depthDifference, metres, gradient };
          }
        }
      }
      if (!best) continue;
      const shallow = Math.min(a.depth, best.b.depth);
      const deep = Math.max(a.depth, best.b.depth);
      let kind = null;
      if (best.depthDifference >= 5 && best.metres <= 120) kind = 'steep_break';
      else if (best.depthDifference >= 3 && best.metres <= 180) kind = shallow <= 6 ? 'shallow_edge' : 'depth_break';
      else if (shallow <= 3.5 && deep >= 5) kind = 'shallow_edge';
      else if (shallow >= 6 && best.depthDifference >= 4) kind = 'deep_edge';
      if (!kind) continue;
      const middle = { lat: (a.lat + best.b.lat) / 2, lon: (a.lon + best.b.lon) / 2 };
      const dedupe = `${kind}:${Math.round(middle.lat * 2500)}:${Math.round(middle.lon * 2500)}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push(depthElement(kind, middle, {
        id: `${i}-${Math.round(shallow * 10)}-${Math.round(deep * 10)}`,
        depth: shallow,
        otherDepth: deep,
        gradient: best.gradient
      }));
    }
    return out.sort((a, b) => b._gradient - a._gradient).slice(0, 180);
  }

  function areaSpots(features) {
    const out = [];
    const seen = new Set();
    for (let i = 0; i < features.length; i++) {
      const range = depthRange(features[i].properties || {});
      const center = featureCenter(features[i]);
      if (!range || !center) continue;
      let kind = null;
      if (range.max <= 3.5) kind = 'pike_flat';
      else if (range.min <= 3.5 && range.max <= 6.5) kind = 'shallow_edge';
      else if (range.min >= 6 && range.max >= 10) kind = 'deep_edge';
      if (!kind) continue;
      const dedupe = `${kind}:${Math.round(center.lat * 1800)}:${Math.round(center.lon * 1800)}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push(depthElement(kind, center, { id: `area-${i}`, depth: range.min, otherDepth: range.max }));
      if (out.length >= 100) break;
    }
    return out;
  }

  function soundingSpots(features) {
    const points = [];
    for (let i = 0; i < features.length && points.length < MAX_SOUNDINGS; i++) {
      const depth = soundingDepth(features[i].properties || {});
      const center = featureCenter(features[i]);
      if (depth != null && center) points.push({ ...center, depth });
    }
    const out = [];
    const seen = new Set();
    for (let i = 0; i < points.length; i++) {
      let best = null;
      for (let j = i + 1; j < Math.min(points.length, i + 90); j++) {
        const depthDifference = Math.abs(points[i].depth - points[j].depth);
        if (depthDifference < 3.5) continue;
        const metres = distance(points[i], points[j]);
        if (metres < 18 || metres > 160) continue;
        const gradient = depthDifference / metres;
        if (!best || gradient > best.gradient) best = { point: points[j], gradient };
      }
      if (!best) continue;
      const middle = {
        lat: (points[i].lat + best.point.lat) / 2,
        lon: (points[i].lon + best.point.lon) / 2
      };
      const dedupe = `${Math.round(middle.lat * 2200)}:${Math.round(middle.lon * 2200)}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push(depthElement('sounding_break', middle, {
        id: `s-${i}`,
        depth: Math.min(points[i].depth, best.point.depth),
        otherDepth: Math.max(points[i].depth, best.point.depth),
        gradient: best.gradient
      }));
    }
    return out.sort((a, b) => b._gradient - a._gradient).slice(0, 60);
  }

  async function fetchEmodnet(bounds) {
    const url = new URL(`${API_BASE}/api/depth/emodnet`);
    url.searchParams.set('west', bounds.west.toFixed(6));
    url.searchParams.set('south', bounds.south.toFixed(6));
    url.searchParams.set('east', bounds.east.toFixed(6));
    url.searchParams.set('north', bounds.north.toFixed(6));
    url.searchParams.set('rows', '5');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'include' });
      if (!response.ok) throw new Error(`FastFishing depth API HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.samples)) throw new Error('FastFishing depth API: samples puuttuu');
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function emodnetSpots(samples) {
    const groups = new Map();
    for (const raw of samples || []) {
      const depth = Number(raw?.depth);
      const lat = Number(raw?.lat);
      const lon = Number(raw?.lon);
      if (!Number.isFinite(depth) || !Number.isFinite(lat) || !Number.isFinite(lon) || depth < 0 || depth > 200) continue;
      const profile = String(raw.profile || 'profile');
      if (!groups.has(profile)) groups.set(profile, []);
      groups.get(profile).push({ profile, index: Number(raw.index) || 0, depth, lat, lon });
    }

    const candidates = [];
    const seen = new Set();
    for (const points of groups.values()) {
      points.sort((a, b) => a.index - b.index);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (b.index - a.index > 2) continue;
        const metres = distance(a, b);
        if (metres < 35 || metres > 420) continue;
        const depthDifference = Math.abs(a.depth - b.depth);
        const shallow = Math.min(a.depth, b.depth);
        const deep = Math.max(a.depth, b.depth);
        let kind = null;
        let baseScore = 0;

        if (depthDifference >= 5 && metres <= 240) {
          kind = 'steep_break';
          baseScore = 84;
        } else if (shallow <= 3.5 && deep >= 5 && metres <= 360) {
          kind = 'shallow_edge';
          baseScore = 82;
        } else if (depthDifference >= 3 && metres <= 320) {
          kind = shallow <= 6 ? 'shallow_edge' : 'depth_break';
          baseScore = shallow <= 6 ? 80 : 79;
        } else if (shallow >= 6 && depthDifference >= 4 && metres <= 380) {
          kind = 'deep_edge';
          baseScore = 77;
        }

        if (kind) {
          const middle = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
          const dedupe = `${kind}:${Math.round(middle.lat * 1700)}:${Math.round(middle.lon * 1700)}`;
          if (!seen.has(dedupe)) {
            seen.add(dedupe);
            candidates.push(depthElement(kind, middle, {
              id: `em-${a.profile}-${a.index}`,
              depth: shallow,
              otherDepth: deep,
              gradient: depthDifference / metres,
              baseScore,
              dataset: 'emodnet',
              resolution: 115,
              sourceUrl: EMODNET_SOURCE
            }));
          }
        }

        if (i % 4 === 0 && a.depth >= 0.8 && a.depth <= 3.5 && b.depth <= 4.5) {
          const flatKey = `flat:${Math.round(a.lat * 1500)}:${Math.round(a.lon * 1500)}`;
          if (!seen.has(flatKey)) {
            seen.add(flatKey);
            candidates.push(depthElement('pike_flat', a, {
              id: `em-flat-${a.profile}-${a.index}`,
              depth: a.depth,
              baseScore: 75,
              dataset: 'emodnet',
              resolution: 115,
              sourceUrl: EMODNET_SOURCE
            }));
          }
        }
      }
    }

    return candidates
      .sort((a, b) => (b._baseScore + b._gradient * 25) - (a._baseScore + a._gradient * 25))
      .slice(0, 110);
  }

  async function inlandManifest() {
    if (!inlandManifestPromise) {
      inlandManifestPromise = fetch(INLAND_MANIFEST, { cache: 'force-cache' })
        .then(response => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json();
        })
        .catch(() => null);
    }
    return inlandManifestPromise;
  }

  function inlandKeys(bounds, manifest) {
    const size = Number(manifest?.tileSizeDegrees) || 2;
    const keys = [];
    for (let lat = Math.floor(bounds.south / size) * size; lat <= Math.floor(bounds.north / size) * size; lat += size) {
      for (let lon = Math.floor(bounds.west / size) * size; lon <= Math.floor(bounds.east / size) * size; lon += size) {
        keys.push(`${lat}_${lon}`);
      }
    }
    return keys;
  }

  async function inlandTile(key) {
    if (inlandTileCache.has(key)) return inlandTileCache.get(key);
    const promise = fetch(`/inland-depth/tiles/${encodeURIComponent(key)}.json`, { cache: 'force-cache' })
      .then(response => response.ok ? response.json() : { spots: [] })
      .then(data => Array.isArray(data.spots) ? data.spots : [])
      .catch(() => []);
    inlandTileCache.set(key, promise);
    return promise;
  }

  async function loadInland(bounds) {
    const manifest = await inlandManifest();
    if (!manifest || !Array.isArray(manifest.tiles)) return [];
    const allowed = new Set(manifest.tiles);
    const keys = inlandKeys(bounds, manifest).filter(key => allowed.has(key));
    const spots = (await Promise.all(keys.map(inlandTile))).flat();
    return spots
      .filter(spot => spot && spot.lat >= bounds.south && spot.lat <= bounds.north && spot.lon >= bounds.west && spot.lon <= bounds.east)
      .map(spot => {
        const kind = META[spot.kind] ? spot.kind : 'shallow_edge';
        const low = Number(spot.minDepth);
        const high = Number(spot.maxDepth);
        const name = spot.name ? `${spot.name} · ${META[kind].fi}` : META[kind].fi;
        return {
          type: 'syke-depth',
          id: spot.id || `syke-${spot.lat}-${spot.lon}`,
          lat: Number(spot.lat),
          lon: Number(spot.lon),
          tags: { name },
          _fastDepthStructure: true,
          _depthType: kind,
          _baseScore: Number(spot.score) || Math.min(92, META[kind].score),
          _depth: Number.isFinite(low) ? low : null,
          _otherDepth: Number.isFinite(high) ? high : null,
          _depthDataset: 'syke',
          _sourceUrl: manifest.sourceUrl || 'https://www.avoindata.fi/data/fi/dataset/jarvien-ja-jokien-syvyysaineisto'
        };
      });
  }

  async function loadTraficom(bounds, discovered) {
    if (!discovered.available) {
      return {
        contourFeatures: [], areaFeatures: [], soundingFeatures: [], errors: [], attempts: [], available: false
      };
    }

    const specs = [
      ['contour', discovered.contour, MAX_CONTOURS],
      ['area', discovered.area, MAX_AREAS],
      ['sounding', discovered.sounding, MAX_SOUNDINGS]
    ].filter(([, layer]) => layer);
    const settled = await Promise.allSettled(
      specs.map(([, layer, count]) => fetchWfsLayer(layer, bounds, count, discovered.formats))
    );
    const output = { contourFeatures: [], areaFeatures: [], soundingFeatures: [], errors: [], attempts: [], available: true };
    settled.forEach((result, index) => {
      const [key, layer] = specs[index];
      if (result.status === 'fulfilled') {
        output[`${key}Features`] = result.value.features || [];
        if (result.value.attempt) output.attempts.push(result.value.attempt);
      } else {
        output.errors.push({ layer, attempts: result.reason?.attempts || [result.reason?.message || 'WFS-virhe'] });
      }
    });
    return output;
  }

  async function loadDepth(bounds) {
    const [discovered, inland] = await Promise.all([
      discoverTraficom(),
      loadInland(bounds).catch(() => [])
    ]);
    const traficom = await loadTraficom(bounds, discovered);
    const samples = contourSamples(traficom.contourFeatures);
    const breaks = contourBreaks(samples);
    const areas = areaSpots(traficom.areaFeatures);
    const sounding = breaks.length < 20 ? soundingSpots(traficom.soundingFeatures) : [];
    const traficomItems = [...breaks, ...areas, ...sounding];
    const traficomFeatureCount = traficom.contourFeatures.length + traficom.areaFeatures.length + traficom.soundingFeatures.length;

    let fallbackReason = null;
    if (!discovered.available) fallbackReason = 'layers_missing';
    else if (traficom.errors.length && traficomFeatureCount === 0) fallbackReason = 'wfs_failed';
    else if (traficomFeatureCount === 0) fallbackReason = 'no_data';

    let emodnet = null;
    let emodnetError = null;
    let emodnetItems = [];
    if (fallbackReason) {
      try {
        emodnet = await fetchEmodnet(bounds);
        emodnetItems = emodnetSpots(emodnet.samples);
      } catch (error) {
        emodnetError = error?.name === 'AbortError' ? 'timeout' : (error?.message || 'EMODnet fallback failed');
      }
    }

    const marineFailed = Boolean(fallbackReason && emodnetError);
    const diag = {
      source: emodnet ? 'emodnet' : (traficomFeatureCount ? 'traficom' : 'none'),
      fallbackReason,
      contours: traficom.contourFeatures.length,
      samples: samples.length,
      depthAreas: traficom.areaFeatures.length,
      soundings: traficom.soundingFeatures.length,
      breaks: breaks.length,
      areaSpots: areas.length,
      soundingSpots: sounding.length,
      emodnetSamples: Array.isArray(emodnet?.samples) ? emodnet.samples.length : 0,
      emodnetSpots: emodnetItems.length,
      emodnetProfilesFailed: Number(emodnet?.profilesFailed) || 0,
      emodnetError,
      inlandSpots: inland.length,
      layers: {
        contour: discovered.contour,
        area: discovered.area,
        sounding: discovered.sounding
      },
      capabilitiesVersion: discovered.capabilitiesVersion,
      capabilitiesErrors: discovered.capabilitiesErrors || [],
      wfsErrors: traficom.errors,
      wfsAttempts: traficom.attempts,
      marineFailed,
      marineEmpty: !marineFailed && traficomFeatureCount === 0 && !emodnetItems.length
    };

    return {
      items: [...traficomItems, ...emodnetItems, ...inland],
      failed: marineFailed,
      diag
    };
  }

  function classify(element, species) {
    const meta = META[element._depthType];
    if (!meta) return null;
    const isEmodnet = element._depthDataset === 'emodnet';
    let score = Number.isFinite(element._baseScore) ? element._baseScore : meta.score;
    if (element._gradient) score += clamp(Math.round(element._gradient * (isEmodnet ? 28 : 48)), 0, isEmodnet ? 2 : 3);
    if (species && species !== 'all') score += meta.species.includes(species) ? (isEmodnet ? 3 : 5) : (isEmodnet ? -7 : -12);
    if (species === 'hauki' && element._depthType === 'pike_flat') score += isEmodnet ? 1 : 3;
    if (species === 'kuha' && ['depth_break', 'steep_break', 'deep_edge'].includes(element._depthType)) score += isEmodnet ? 1 : 2;
    score = clamp(Math.round(score), 42, isEmodnet ? 88 : 94);

    const finnish = typeof currentLang === 'undefined' || currentLang === 'fi';
    const coarseReason = isEmodnet
      ? (finnish
        ? ' EMODnetin DTM on noin 115 m ruudukko, joten rakenne on suuntaa-antava eikä tarkka penkan paikka.'
        : ' EMODnet DTM uses an approximately 115 m grid, so the structure is indicative rather than an exact break location.')
      : '';
    const warning = isEmodnet
      ? (finnish
        ? 'Karkea EMODnet-syvyysmalli on kalastuksen suunnitteluapu, ei navigointiohje. Tarkista virallinen merikartta ja paikalliset olosuhteet.'
        : 'The coarse EMODnet depth model is for fishing planning, not navigation. Check an official chart and local conditions.')
      : (finnish
        ? 'Syvyystieto on suunnittelun apu, ei navigointiohje. Tarkista virallinen merikartta ja paikalliset olosuhteet.'
        : 'Depth data is for planning, not navigation. Check an official chart and local conditions.');

    return {
      id: String(element.id),
      lat: element.lat,
      lon: element.lon,
      score,
      structureScore: score,
      kind: finnish ? meta.fi : meta.en,
      name: element.tags?.name || (finnish ? meta.fi : meta.en),
      reason: `${finnish ? meta.reasonFi : meta.reasonEn}${coarseReason}`,
      warning,
      species: meta.species,
      typeKey: element._depthType,
      sourceUrl: element._sourceUrl
    };
  }

  function patchClassifier() {
    if (prevClassifier || typeof classifyPotentialSpot !== 'function') return;
    prevClassifier = classifyPotentialSpot;
    classifyPotentialSpot = function patchedClassifier(element, species) {
      if (element?._fastDepthStructure) return classify(element, species);
      const result = prevClassifier(element, species);
      if (result?.typeKey === 'strait') {
        result.score = 61;
        result.structureScore = 61;
        result.kind = (typeof currentLang === 'undefined' || currentLang === 'fi')
          ? 'Salmi (heikko vihje)'
          : 'Strait (weak signal)';
      }
      return result;
    };
  }

  function baseElements() {
    return typeof potentialSpotLastElements !== 'undefined' && Array.isArray(potentialSpotLastElements)
      ? potentialSpotLastElements.filter(element => !element?._fastDepthStructure)
      : [];
  }

  function render(items) {
    if (typeof renderPotentialSpotMarkers === 'function') {
      renderPotentialSpotMarkers(baseElements().concat(items || []));
    }
  }

  function status(diag) {
    if (typeof potentialSpotStatus !== 'function' || !diag) return;
    const inland = diag.inlandSpots || 0;
    const finnish = typeof currentLang === 'undefined' || currentLang === 'fi';

    if (diag.source === 'emodnet') {
      const reasonFi = diag.fallbackReason === 'layers_missing'
        ? 'Traficomin avoin WFS ei tällä hetkellä julkaise syvyyslayereita'
        : diag.fallbackReason === 'wfs_failed'
          ? 'Traficomin syvyyshaku epäonnistui'
          : 'Traficom ei palauttanut syvyysdataa tältä alueelta';
      const reasonEn = diag.fallbackReason === 'layers_missing'
        ? 'Traficom open WFS currently exposes no depth layers'
        : diag.fallbackReason === 'wfs_failed'
          ? 'Traficom depth request failed'
          : 'Traficom returned no depth data for this area';
      potentialSpotStatus(
        `${reasonFi} → EMODnet DTM ~115 m: ${diag.emodnetSamples} näytettä, ${diag.emodnetSpots} karkeaa merirakennetta · SYKE ${inland}.`,
        `${reasonEn} → EMODnet DTM ~115 m: ${diag.emodnetSamples} samples, ${diag.emodnetSpots} coarse marine structures · SYKE ${inland}.`
      );
      return;
    }

    if (diag.marineFailed) {
      const wfsDetail = diag.wfsErrors?.[0]?.attempts?.slice(-1)[0]
        || diag.capabilitiesErrors?.slice(-1)[0]
        || 'Traficom depth unavailable';
      potentialSpotStatus(
        `Merisyvyysdata ei latautunut (${wfsDetail}; EMODnet: ${diag.emodnetError || 'virhe'}). SYKE-sisävesikohteita ${inland}; virhettä ei peitetä fallbackilla.`,
        `Marine depth data failed (${wfsDetail}; EMODnet: ${diag.emodnetError || 'error'}). SYKE inland spots ${inland}; the failure is not hidden by the fallback.`
      );
      return;
    }

    if (diag.source === 'traficom') {
      const structures = diag.breaks + diag.areaSpots + diag.soundingSpots;
      const partial = diag.wfsErrors?.length
        ? ` · ${diag.wfsErrors.length} WFS-layeria epäonnistui`
        : '';
      potentialSpotStatus(
        `Syvyysdata: Traficom ${diag.contours} käyrää + ${diag.depthAreas} aluetta → ${structures} merikohdetta · SYKE ${inland}${partial}.`,
        `Depth data: Traficom ${diag.contours} contours + ${diag.depthAreas} areas → ${structures} marine spots · SYKE ${inland}${partial}.`
      );
      return;
    }

    potentialSpotStatus(
      finnish ? `Tältä alueelta ei löytynyt käyttökelpoista syvyysrakennetta · SYKE ${inland}.` : `No usable depth structure found for this area · SYKE ${inland}.`,
      `No usable depth structure found for this area · SYKE ${inland}.`
    );
  }

  async function refresh(force) {
    if (!map || typeof potentialSpotsWanted === 'undefined' || !potentialSpotsWanted) return;
    if (map.getZoom() < MIN_ZOOM) {
      cache = [];
      cacheBounds = null;
      return;
    }

    const visible = map.getBounds();
    if (!force && contains(cacheBounds, visible)) {
      render(cache);
      setTimeout(() => status(lastDiag), 80);
      return;
    }

    const requestToken = ++token;
    const bounds = expanded(visible);
    const result = await loadDepth(bounds).catch(error => ({
      items: [],
      failed: true,
      diag: {
        source: 'none',
        contours: 0,
        depthAreas: 0,
        soundings: 0,
        breaks: 0,
        areaSpots: 0,
        soundingSpots: 0,
        emodnetSamples: 0,
        emodnetSpots: 0,
        inlandSpots: 0,
        marineFailed: true,
        emodnetError: error?.message || 'tuntematon virhe',
        wfsErrors: [],
        capabilitiesErrors: []
      }
    }));

    if (requestToken !== token || !potentialSpotsWanted) return;
    lastDiag = result.diag;
    window.__fastFishingDepthDiagnostics = lastDiag;
    if (!result.failed || result.items.length) {
      cacheBounds = bounds;
      cache = result.items;
      render(cache);
    }
    setTimeout(() => status(lastDiag), 100);
  }

  function schedule(force) {
    clearTimeout(timer);
    timer = setTimeout(() => refresh(Boolean(force)), DEBOUNCE);
  }

  function updateQualityLabels() {
    const select = document.getElementById('potentialSpotQuality');
    if (!select) return;
    for (const option of select.options) {
      if (option.value === '80') option.textContent = (typeof currentLang === 'undefined' || currentLang === 'fi') ? 'Hyvät rakenteet 80+' : 'Good structures 80+';
      if (option.value === '75') option.textContent = (typeof currentLang === 'undefined' || currentLang === 'fi') ? 'Laajempi haku 75+' : 'Broader search 75+';
    }
  }

  function installMapPolish() {
    if (document.getElementById('ff-map-polish')) return;
    const style = document.createElement('style');
    style.id = 'ff-map-polish';
    style.textContent = `
#seaChartWrap.sea-chart-full-wrap{height:clamp(560px,68vh,780px);border-radius:22px;box-shadow:0 18px 50px rgba(23,52,47,.16);isolation:isolate}
#seaChartMap{cursor:grab;outline:none;touch-action:pan-x pan-y}
#seaChartMap:active{cursor:grabbing}
#seaChartMap:focus-visible{outline:3px solid var(--orange);outline-offset:-3px}
.sea-chart-activate-overlay{inset:auto 12px 12px auto;background:transparent;pointer-events:none;align-items:flex-end;justify-content:flex-end}
.sea-chart-activate-overlay .sea-chart-activate-btn{pointer-events:auto;min-height:44px;padding:0 15px;border-radius:999px;font-size:.82rem;box-shadow:0 8px 26px rgba(0,0,0,.28);backdrop-filter:blur(12px)}
.sea-chart-toolbar{left:12px;right:auto;width:min(390px,calc(100% - 24px));max-height:min(390px,52%);overflow:auto;overscroll-behavior:contain;border-radius:18px;padding:10px;scrollbar-width:thin}
.sea-chart-toolbar .btn{min-height:40px}.sea-chart-toggle{min-height:36px}
.sea-chart-hud{gap:6px;max-width:calc(100% - 24px)}.sea-chart-hud .condition-chip{min-width:0;min-height:38px;padding:6px 9px}
.potential-results-panel{box-shadow:0 16px 45px rgba(0,0,0,.2);backdrop-filter:blur(16px)}
.leaflet-popup-content-wrapper{border-radius:16px;box-shadow:0 14px 38px rgba(0,0,0,.22)}
.leaflet-popup-content{margin:14px 16px;max-width:min(310px,72vw)}
.leaflet-control-attribution{font-size:10px!important;background:rgba(255,255,255,.76)!important;backdrop-filter:blur(6px)}
html[data-theme="dark"] .leaflet-control-attribution{background:rgba(13,26,22,.78)!important;color:#d7e5df}
.sea-chart-maximized .sea-chart-activate-overlay{display:none!important}
@media(max-width:680px){
 #merikartta.shell,#merikartta{padding-left:8px;padding-right:8px}
 .sea-chart-compact-head{padding-inline:4px;margin-bottom:10px}.sea-chart-compact-head p{font-size:.88rem;line-height:1.35}
 #seaChartWrap.sea-chart-full-wrap{height:clamp(470px,calc(100svh - 150px),720px)!important;min-height:0!important;border-radius:18px!important;margin-inline:0}
 .sea-chart-toolbar{top:44px;left:8px;right:8px;width:auto;max-height:31svh;padding:8px;border-radius:15px}
 .sea-chart-toolbar .btn{min-height:42px;padding-inline:10px}.sea-toolbar-row2{gap:7px;margin-top:5px;padding-top:5px}
 .sea-chart-activate-overlay{right:8px;bottom:58px}.sea-chart-activate-overlay .sea-chart-activate-btn{min-height:46px;max-width:190px;white-space:normal;line-height:1.1}
 .sea-chart-top-actions{top:8px;right:8px}
 .potential-results-panel{left:8px!important;right:8px!important;bottom:62px!important;max-height:44%!important;border-radius:15px!important}
 .sea-chart-hud{left:8px!important;right:8px!important;bottom:8px!important;max-width:none!important;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px}
 .sea-chart-hud .condition-chip{flex:0 0 auto;min-height:42px}.leaflet-popup-content{max-width:76vw;margin:12px 14px}
}
@media(min-width:681px){.sea-chart-maximized .sea-chart-toolbar{max-height:calc(100svh - 110px)}}`;
    document.head.appendChild(style);
  }

  function polishMapInstance() {
    if (typeof seaChartMap === 'undefined' || !seaChartMap) return false;
    installMapPolish();
    const wrap = document.getElementById('seaChartWrap');
    const container = seaChartMap.getContainer?.();
    if (!wrap || !container) return false;

    if (!container.dataset.ffPolished) {
      container.dataset.ffPolished = '1';
      container.tabIndex = 0;
      container.setAttribute('role', 'application');
      container.setAttribute('aria-label', 'FastFishing kalastuskartta. Vedä karttaa hiirellä tai sormella ja zoomaa nipistämällä.');
      if (typeof setSeaChartInteractive === 'function') setSeaChartInteractive(true);
      seaChartMap.keyboard?.enable();
      seaChartMap.scrollWheelZoom?.disable();

      const enableWheel = () => seaChartMap.scrollWheelZoom?.enable();
      const disableWheel = () => {
        if (!wrap.classList.contains('sea-chart-maximized')) seaChartMap.scrollWheelZoom?.disable();
      };
      container.addEventListener('click', () => {
        container.focus({ preventScroll: true });
        if (matchMedia('(pointer:fine)').matches) enableWheel();
      });
      container.addEventListener('focus', () => {
        if (matchMedia('(pointer:fine)').matches) enableWheel();
      });
      container.addEventListener('blur', disableWheel);
      container.addEventListener('mouseleave', disableWheel);

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => seaChartMap.invalidateSize({ pan: false }));
        observer.observe(wrap);
      }
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && wrap.classList.contains('sea-chart-maximized') && typeof exitSeaChartFullscreen === 'function') {
          exitSeaChartFullscreen();
        }
      });
    }
    return true;
  }

  function attach() {
    patchClassifier();
    updateQualityLabels();
    installMapPolish();
    if (typeof seaChartMap === 'undefined' || !seaChartMap || typeof renderPotentialSpotMarkers !== 'function') return false;
    polishMapInstance();
    if (map === seaChartMap) return true;
    map = seaChartMap;
    map.on('moveend zoomend', () => schedule(false));
    document.getElementById('potentialSpotsToggle')?.addEventListener('change', event => {
      if (event.target.checked) schedule(true);
    });
    document.getElementById('potentialSpotSpecies')?.addEventListener('change', () => schedule(false));
    if (typeof potentialSpotsWanted !== 'undefined' && potentialSpotsWanted) schedule(true);
    return true;
  }

  window.FastFishingDepthDiagnostics = () => lastDiag;
  installMapPolish();
  let tries = 0;
  const boot = setInterval(() => {
    tries += 1;
    polishMapInstance();
    if (attach() || tries > 180) clearInterval(boot);
  }, 400);
})();
