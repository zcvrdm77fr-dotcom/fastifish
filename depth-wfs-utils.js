export const DEFAULT_DEPTH_LAYERS = Object.freeze({
  contour: 'DepthContour_L',
  area: 'DepthArea_A',
  sounding: 'Sounding_P'
});

const LAYER_MATCHERS = Object.freeze({
  contour: {
    exact: ['DepthContour_L'],
    keywords: ['depthcontour', 'syvyyskäyr', 'syvyyskayr', 'depcont']
  },
  area: {
    exact: ['DepthArea_A'],
    keywords: ['deptharea', 'syvyysalue', 'depare']
  },
  sounding: {
    exact: ['Sounding_P'],
    keywords: ['sounding', 'syvyyspiste', 'soundg']
  }
});

function decodeXml(value = '') {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function tagValue(block, localName) {
  const pattern = new RegExp(`<(?:(?:[\\w.-]+):)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?${localName}>`, 'i');
  const match = String(block || '').match(pattern);
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function allTagValues(xml, localName) {
  const values = [];
  const pattern = new RegExp(`<(?:(?:[\\w.-]+):)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?${localName}>`, 'gi');
  let match;
  while ((match = pattern.exec(String(xml || '')))) {
    const value = decodeXml(match[1].replace(/<[^>]+>/g, '').trim());
    if (value) values.push(value);
  }
  return values;
}

function pickLayer(featureTypes, matcher) {
  for (const expected of matcher.exact) {
    const exact = featureTypes.find(item => item.name === expected || item.name.endsWith(`:${expected}`));
    if (exact) return exact.name;
  }
  const fuzzy = featureTypes.find(item => matcher.keywords.some(keyword => item.hay.includes(keyword)));
  return fuzzy?.name || null;
}

export function parseWfsCapabilities(xml) {
  const source = String(xml || '');
  const featureTypes = [];
  const featurePattern = /<(?:(?:[\w.-]+):)?FeatureType\b[^>]*>([\s\S]*?)<\/(?:(?:[\w.-]+):)?FeatureType>/gi;
  let match;
  while ((match = featurePattern.exec(source))) {
    const name = tagValue(match[1], 'Name');
    const title = tagValue(match[1], 'Title');
    if (!name) continue;
    featureTypes.push({ name, title, hay: `${name} ${title}`.toLowerCase() });
  }

  const rawFormats = [
    ...allTagValues(source, 'Format'),
    ...allTagValues(source, 'Value')
  ];
  const formats = [...new Set(rawFormats
    .map(value => value.trim())
    .filter(value => /json|gml|xml/i.test(value))
  )];

  return {
    layers: {
      contour: pickLayer(featureTypes, LAYER_MATCHERS.contour),
      area: pickLayer(featureTypes, LAYER_MATCHERS.area),
      sounding: pickLayer(featureTypes, LAYER_MATCHERS.sounding)
    },
    formats,
    featureTypes: featureTypes.map(({ name, title }) => ({ name, title }))
  };
}

export function preferredJsonFormats(formats = []) {
  const available = Array.isArray(formats) ? formats : [];
  const json = available.filter(value => /json/i.test(value));
  const preferred = ['application/json', 'application/geo+json', 'json', 'geojson'];
  return [...new Set([
    ...preferred.filter(value => json.some(candidate => candidate.toLowerCase() === value.toLowerCase())),
    ...json,
    'application/json'
  ])];
}

export function buildWfsCandidates({ endpoint, typeName, bounds, count = 1000, formats = [] }) {
  if (!endpoint || !typeName || !bounds) return [];
  const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north},EPSG:4326`;
  const candidates = [];
  const jsonFormats = preferredJsonFormats(formats);

  for (const outputFormat of jsonFormats) {
    candidates.push({
      version: '2.0.0',
      outputFormat,
      responseKind: 'json',
      params: {
        service: 'WFS', version: '2.0.0', request: 'GetFeature',
        typeNames: typeName, outputFormat, srsName: 'EPSG:4326', bbox, count: String(count)
      }
    });
    candidates.push({
      version: '1.1.0',
      outputFormat,
      responseKind: 'json',
      params: {
        service: 'WFS', version: '1.1.0', request: 'GetFeature',
        typeName, outputFormat, srsName: 'EPSG:4326', bbox, maxFeatures: String(count)
      }
    });
  }

  // Viimeinen fallback pyytää palvelimen oletus-GML:n ilman outputFormat-parametria.
  candidates.push({
    version: '2.0.0', outputFormat: null, responseKind: 'gml',
    params: {
      service: 'WFS', version: '2.0.0', request: 'GetFeature',
      typeNames: typeName, srsName: 'EPSG:4326', bbox, count: String(count)
    }
  });
  candidates.push({
    version: '1.1.0', outputFormat: null, responseKind: 'gml',
    params: {
      service: 'WFS', version: '1.1.0', request: 'GetFeature',
      typeName, srsName: 'EPSG:4326', bbox, maxFeatures: String(count)
    }
  });

  return candidates.map(candidate => {
    const query = new URLSearchParams(candidate.params);
    return { ...candidate, url: `${endpoint}?${query}` };
  });
}

export function describeWfsAttempt({ typeName, version, outputFormat, status, message }) {
  const format = outputFormat || 'palvelimen oletus/GML';
  const http = Number.isFinite(Number(status)) ? `HTTP ${status}` : 'verkkovirhe';
  return `${typeName || 'tuntematon layer'} · WFS ${version || '?'} · ${format} · ${http}${message ? ` · ${message}` : ''}`;
}
