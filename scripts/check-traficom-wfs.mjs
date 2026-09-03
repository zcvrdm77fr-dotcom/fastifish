import {
  parseWfsCapabilities,
  buildWfsCandidates,
  describeWfsAttempt
} from '../depth-wfs-utils.js';

const TRAFICOM_WFS = 'https://julkinen.traficom.fi/inspirepalvelu/avoin/wfs';
const EMODNET_REST = 'https://rest.emodnet-bathymetry.eu';
const HELSINKI_SEA = { west: 24.72, south: 59.95, east: 25.18, north: 60.22 };
const HELSINKI_SAMPLE = { lon: 24.94, lat: 60.10 };
const TIMEOUT_MS = 15_000;

async function requestText(url, accept = '*/*') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: accept, 'user-agent': 'FastFishing-depth-smoke/1.0' }
    });
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      cors: response.headers.get('access-control-allow-origin') || '',
      body: await response.text()
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadTraficomCapabilities() {
  const errors = [];
  let lastParsed = null;
  for (const version of ['2.0.0', '1.1.0']) {
    try {
      const url = `${TRAFICOM_WFS}?service=WFS&version=${version}&request=GetCapabilities`;
      const response = await requestText(url, 'application/xml,text/xml,*/*');
      if (!response.ok) {
        errors.push(`GetCapabilities ${version}: HTTP ${response.status}`);
        continue;
      }
      const parsed = parseWfsCapabilities(response.body);
      lastParsed = { version, ...parsed };
      if (parsed.layers.contour || parsed.layers.area || parsed.layers.sounding) return { ...lastParsed, errors };
      errors.push(`GetCapabilities ${version}: depth layers missing`);
    } catch (error) {
      errors.push(`GetCapabilities ${version}: ${error.name === 'AbortError' ? 'timeout' : error.message}`);
    }
  }
  return { ...(lastParsed || { version: null, layers: {}, formats: [] }), errors };
}

function gmlFeatureCount(xml) {
  return (String(xml).match(/<(?:[\w.-]+:)?(?:member|featureMember)\b/gi) || []).length;
}

async function smokeTraficom(capabilities) {
  const layer = capabilities.layers?.contour || capabilities.layers?.area || capabilities.layers?.sounding;
  if (!layer) {
    console.log('Traficom open WFS: depth layers are currently not advertised; switching smoke test to the open EMODnet fallback.');
    for (const line of capabilities.errors || []) console.log(line);
    return false;
  }

  console.log(`Traficom capabilities WFS ${capabilities.version}`);
  console.log(`Depth layers: ${JSON.stringify(capabilities.layers)}`);
  console.log(`Formats: ${capabilities.formats.join(', ') || '(not advertised)'}`);
  console.log(`Smoke layer: ${layer}`);

  const candidates = buildWfsCandidates({
    endpoint: TRAFICOM_WFS,
    typeName: layer,
    bounds: HELSINKI_SEA,
    count: 12,
    formats: capabilities.formats
  });

  const attempts = [];
  for (const candidate of candidates) {
    for (let retry = 0; retry < 2; retry++) {
      try {
        const response = await requestText(
          candidate.url,
          'application/json,application/geo+json,application/xml,text/xml;q=.8,*/*;q=.2'
        );
        let count = 0;
        let detail = '';
        if (response.ok && (candidate.responseKind === 'json' || /json/i.test(response.contentType))) {
          try {
            const data = JSON.parse(response.body);
            count = Array.isArray(data.features) ? data.features.length : 0;
            detail = `JSON features=${count}`;
          } catch {
            detail = 'invalid JSON';
          }
        } else if (response.ok) {
          count = gmlFeatureCount(response.body);
          detail = `GML members=${count}`;
        } else {
          detail = response.body.replace(/\s+/g, ' ').slice(0, 160);
        }

        const line = describeWfsAttempt({
          typeName: layer,
          version: candidate.version,
          outputFormat: candidate.outputFormat,
          status: response.status,
          message: detail
        });
        attempts.push(line);
        console.log(line);

        if (response.ok && count > 0) {
          console.log('Traficom WFS smoke OK: known Helsinki marine bbox returned depth features.');
          return true;
        }
      } catch (error) {
        const line = `${layer} · WFS ${candidate.version} · ${candidate.outputFormat || 'GML'} · ${error.name === 'AbortError' ? 'timeout' : error.message}`;
        attempts.push(line);
        console.warn(line);
      }
    }
  }

  console.warn(`Traficom advertised depth data but the live smoke did not return features.\n${attempts.join('\n')}`);
  return false;
}

async function smokeEmodnet() {
  const point = `POINT(${HELSINKI_SAMPLE.lon} ${HELSINKI_SAMPLE.lat})`;
  const sampleUrl = `${EMODNET_REST}/depth_sample?${new URLSearchParams({ geom: point })}`;
  const response = await requestText(sampleUrl, 'application/json');
  if (!response.ok) throw new Error(`EMODnet depth_sample HTTP ${response.status}: ${response.body.slice(0, 180)}`);
  const sample = JSON.parse(response.body);
  const depths = [sample.min, sample.max, sample.avg, sample.smoothed].map(Number).filter(Number.isFinite);
  if (!depths.length) throw new Error(`EMODnet depth_sample returned no finite depth: ${response.body.slice(0, 220)}`);
  if (!response.cors || !(response.cors === '*' || response.cors.includes('fastfishin.com'))) {
    throw new Error(`EMODnet REST is not browser-CORS compatible for FastFishing (Access-Control-Allow-Origin=${response.cors || '(missing)'}).`);
  }

  const profileGeom = `LINESTRING(${HELSINKI_SEA.west} 60.08,${HELSINKI_SEA.east} 60.08)`;
  const profileUrl = `${EMODNET_REST}/depth_profile?${new URLSearchParams({ geom: profileGeom })}`;
  const profileResponse = await requestText(profileUrl, 'application/json');
  if (!profileResponse.ok) throw new Error(`EMODnet depth_profile HTTP ${profileResponse.status}: ${profileResponse.body.slice(0, 180)}`);
  const profile = JSON.parse(profileResponse.body);
  const finiteProfile = Array.isArray(profile) ? profile.map(Number).filter(Number.isFinite) : [];
  if (finiteProfile.length < 2) throw new Error(`EMODnet depth_profile returned too few samples: ${profileResponse.body.slice(0, 220)}`);

  console.log(`EMODnet depth_sample OK: avg=${sample.avg}, min=${sample.min}, max=${sample.max}, CORS=${response.cors}`);
  console.log(`EMODnet depth_profile OK: ${finiteProfile.length} finite samples.`);
  console.log('Open marine fallback smoke OK.');
}

async function main() {
  const capabilities = await loadTraficomCapabilities();
  const traficomOk = await smokeTraficom(capabilities);
  if (!traficomOk) await smokeEmodnet();
}

await main();
