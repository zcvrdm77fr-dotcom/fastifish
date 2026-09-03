import {
  parseWfsCapabilities,
  buildWfsCandidates,
  describeWfsAttempt
} from '../depth-wfs-utils.js';

const ENDPOINT = 'https://julkinen.traficom.fi/inspirepalvelu/avoin/wfs';
const HELSINKI_SEA = { west: 24.72, south: 59.95, east: 25.18, north: 60.22 };
const TIMEOUT_MS = 15_000;

async function requestText(url, accept = '*/*') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: accept, 'user-agent': 'FastFishing-WFS-smoke/1.0' }
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

async function loadCapabilities() {
  const errors = [];
  for (const version of ['2.0.0', '1.1.0']) {
    try {
      const url = `${ENDPOINT}?service=WFS&version=${version}&request=GetCapabilities`;
      const response = await requestText(url, 'application/xml,text/xml,*/*');
      if (!response.ok) {
        errors.push(`GetCapabilities ${version}: HTTP ${response.status}`);
        continue;
      }
      const parsed = parseWfsCapabilities(response.body);
      if (parsed.layers.contour || parsed.layers.area || parsed.layers.sounding) {
        return { version, ...parsed };
      }
      errors.push(`GetCapabilities ${version}: depth layers missing`);
    } catch (error) {
      errors.push(`GetCapabilities ${version}: ${error.name === 'AbortError' ? 'timeout' : error.message}`);
    }
  }
  throw new Error(errors.join('\n'));
}

function gmlFeatureCount(xml) {
  return (String(xml).match(/<(?:[\w.-]+:)?(?:member|featureMember)\b/gi) || []).length;
}

async function main() {
  const capabilities = await loadCapabilities();
  const layer = capabilities.layers.contour || capabilities.layers.area || capabilities.layers.sounding;
  if (!layer) throw new Error('Traficom capabilities did not expose a usable depth layer.');

  console.log(`Capabilities WFS ${capabilities.version}`);
  console.log(`Depth layers: ${JSON.stringify(capabilities.layers)}`);
  console.log(`Formats: ${capabilities.formats.join(', ') || '(not advertised)'}`);
  console.log(`Smoke layer: ${layer}`);

  const candidates = buildWfsCandidates({
    endpoint: ENDPOINT,
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
          return;
        }
      } catch (error) {
        const line = `${layer} · WFS ${candidate.version} · ${candidate.outputFormat || 'GML'} · ${error.name === 'AbortError' ? 'timeout' : error.message}`;
        attempts.push(line);
        console.warn(line);
      }
    }
  }

  throw new Error(`Traficom WFS smoke failed for known Helsinki marine bbox.\n${attempts.join('\n')}`);
}

await main();
