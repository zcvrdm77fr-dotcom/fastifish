import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWfsCapabilities,
  preferredJsonFormats,
  buildWfsCandidates,
  describeWfsAttempt
} from '../depth-wfs-utils.js';

const CAPS = `<?xml version="1.0"?>
<wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:ows="http://www.opengis.net/ows/1.1">
  <ows:OperationsMetadata>
    <ows:Operation name="GetFeature">
      <ows:Parameter name="outputFormat">
        <ows:AllowedValues>
          <ows:Value>application/json</ows:Value>
          <ows:Value>text/xml; subtype=gml/3.2</ows:Value>
        </ows:AllowedValues>
      </ows:Parameter>
    </ows:Operation>
  </ows:OperationsMetadata>
  <wfs:FeatureTypeList>
    <wfs:FeatureType><wfs:Name>avoin:DepthContour_L</wfs:Name><wfs:Title>Syvyyskäyrä</wfs:Title></wfs:FeatureType>
    <wfs:FeatureType><wfs:Name>avoin:DepthArea_A</wfs:Name><wfs:Title>Syvyysalue</wfs:Title></wfs:FeatureType>
    <wfs:FeatureType><wfs:Name>avoin:Sounding_P</wfs:Name><wfs:Title>Luotauspiste</wfs:Title></wfs:FeatureType>
  </wfs:FeatureTypeList>
</wfs:WFS_Capabilities>`;

test('parseWfsCapabilities finds namespaced depth layers and formats', () => {
  const parsed = parseWfsCapabilities(CAPS);
  assert.deepEqual(parsed.layers, {
    contour: 'avoin:DepthContour_L',
    area: 'avoin:DepthArea_A',
    sounding: 'avoin:Sounding_P'
  });
  assert.ok(parsed.formats.includes('application/json'));
  assert.equal(parsed.featureTypes.length, 3);
});

test('preferredJsonFormats keeps server formats and a safe JSON fallback', () => {
  const formats = preferredJsonFormats(['application/geo+json', 'text/xml']);
  assert.equal(formats[0], 'application/geo+json');
  assert.ok(formats.includes('application/json'));
});

test('buildWfsCandidates tries both WFS versions and ends with GML fallback', () => {
  const candidates = buildWfsCandidates({
    endpoint: 'https://example.test/wfs',
    typeName: 'avoin:DepthContour_L',
    bounds: { west: 24, south: 60, east: 25, north: 61 },
    count: 250,
    formats: ['application/json']
  });
  assert.ok(candidates.some(item => item.version === '2.0.0' && item.responseKind === 'json'));
  assert.ok(candidates.some(item => item.version === '1.1.0' && item.responseKind === 'json'));
  assert.equal(candidates.at(-1).responseKind, 'gml');
  assert.match(candidates.at(-1).url, /maxFeatures=250/);
});

test('describeWfsAttempt includes layer, version, format and HTTP status', () => {
  const line = describeWfsAttempt({
    typeName: 'DepthArea_A', version: '2.0.0', outputFormat: 'application/json', status: 400, message: 'Bad Request'
  });
  assert.match(line, /DepthArea_A/);
  assert.match(line, /WFS 2\.0\.0/);
  assert.match(line, /HTTP 400/);
  assert.match(line, /Bad Request/);
});
