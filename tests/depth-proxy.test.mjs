import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDepthBounds, buildDepthProfiles, profileToSamples } from '../depth-proxy.js';

test('parseDepthBounds accepts a compact Finnish marine bbox', () => {
  assert.deepEqual(parseDepthBounds({ west: '24.7', south: '59.9', east: '25.2', north: '60.3' }), {
    west: 24.7, south: 59.9, east: 25.2, north: 60.3
  });
});

test('parseDepthBounds rejects oversized and non-Finnish proxy use', () => {
  assert.equal(parseDepthBounds({ west: 10, south: 50, east: 11, north: 51 }), null);
  assert.equal(parseDepthBounds({ west: 20, south: 59, east: 22, north: 60 }), null);
  assert.equal(parseDepthBounds({ west: 25, south: 60, east: 24, north: 61 }), null);
});

test('buildDepthProfiles creates bounded horizontal transects', () => {
  const bounds = { west: 24, south: 60, east: 25, north: 61 };
  const profiles = buildDepthProfiles(bounds, 5);
  assert.equal(profiles.length, 5);
  assert.equal(profiles[0].start.lon, 24);
  assert.equal(profiles[0].end.lon, 25);
  assert.equal(profiles[0].start.lat, profiles[0].end.lat);
  assert.ok(profiles[0].start.lat > 60);
  assert.ok(profiles.at(-1).start.lat < 61);
});

test('profileToSamples maps depth values to coordinates and drops missing or invalid depths', () => {
  const line = { id: 'h0', start: { lon: 24, lat: 60 }, end: { lon: 25, lat: 60 } };
  const samples = profileToSamples([2, null, 8, 999, 12], line);
  assert.deepEqual(samples.map(item => item.depth), [2, 8, 12]);
  assert.equal(samples[0].lon, 24);
  assert.equal(samples.at(-1).lon, 25);
  assert.equal(samples.every(item => item.lat === 60), true);
});
