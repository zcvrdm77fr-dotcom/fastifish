#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const [inputPath = 'finland-strong-osm.json', outputPath = 'kalapaikat.json'] = process.argv.slice(2);
const raw = JSON.parse(await readFile(inputPath, 'utf8'));

const allowedFishing = new Set(['yes', 'designated', 'permissive']);
const getName = tags => tags['name:fi'] || tags.name || '';
const coordinate = element => ({
  lat: element.lat ?? element.center?.lat,
  lon: element.lon ?? element.center?.lon
});

function isObviouslyNonFishingFeature(tags = {}) {
  const leisure = String(tags.leisure || '').toLowerCase();
  const amenity = String(tags.amenity || '').toLowerCase();
  const water = String(tags.water || '').toLowerCase();
  const manMade = String(tags.man_made || '').toLowerCase();

  if (['swimming_pool', 'wading_pool', 'water_park', 'splash_pad'].includes(leisure)) return true;
  if (amenity === 'fountain' || water === 'fountain') return true;
  if (['swimming_pool', 'wading_pool', 'splash_pool', 'wastewater', 'sewage'].includes(water)) return true;
  if (['wastewater_plant', 'sewage_treatment'].includes(manMade)) return true;
  return false;
}

function category(tags) {
  // Explicit fishing tags must never override a feature that is clearly not fishable water.
  if (isObviouslyNonFishingFeature(tags)) return null;
  if (tags.fishing === 'no' || tags.access === 'private' || tags.access === 'no') return null;
  if (tags.natural === 'bay' || tags.natural === 'cape' || tags.waterway === 'dam' || tags.waterway === 'weir') return null;
  if (tags.leisure === 'fishing' || tags.sport === 'fishing' || allowedFishing.has(tags.fishing)) return 'known';
  if ((tags.waterway === 'rapids' || tags.water === 'rapids') && getName(tags)) return 'rapids';
  if (tags.water === 'stream_pool' && getName(tags)) return 'pool';
  if (tags.natural === 'shoal' && getName(tags)) return 'shoal';
  if (tags.natural === 'strait' && getName(tags)) return 'strait';
  return null;
}

const keepTagKeys = [
  'name', 'name:fi', 'leisure', 'sport', 'fishing', 'waterway', 'water', 'natural',
  'amenity', 'man_made', 'access', 'fee', 'permit', 'website', 'operator'
];

const priority = { known: 5, shoal: 4, rapids: 3, pool: 2, strait: 1 };
const candidates = raw.elements.flatMap(element => {
  const tags = element.tags || {};
  const kind = category(tags);
  const { lat, lon } = coordinate(element);
  if (!kind || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const compactTags = Object.fromEntries(keepTagKeys.filter(key => tags[key] != null).map(key => [key, tags[key]]));
  return [{ type: element.type, id: element.id, lat, lon, tags: compactTags, _kind: kind }];
});

// Sama OSM-kohde voi tulla kyselystä useita kertoja eri tageilla. Pidetään yksi versio.
const byId = new Map();
for (const item of candidates) {
  const key = `${item.type}-${item.id}`;
  const previous = byId.get(key);
  if (!previous || priority[item._kind] > priority[previous._kind]) byId.set(key, item);
}

const spots = [...byId.values()]
  .sort((a, b) => priority[b._kind] - priority[a._kind] || a.lat - b.lat || a.lon - b.lon)
  .map(({ _kind, ...item }) => item);

const counts = {};
for (const item of byId.values()) counts[item._kind] = (counts[item._kind] || 0) + 1;

const output = {
  version: 2,
  generatedAt: raw.osm3s?.timestamp_osm_base || new Date().toISOString(),
  source: 'OpenStreetMap contributors (ODbL)',
  criteria: 'Explicit fishing places plus named rapids, stream pools, shoals and straits. Private/no-access, fishing=no and clearly non-fishable pools/fountains/utility water features excluded.',
  counts,
  spots
};

await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(JSON.stringify({ outputPath, total: spots.length, counts }, null, 2));
