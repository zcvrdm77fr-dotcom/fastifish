import test from 'node:test';
import assert from 'node:assert/strict';
import { createForecastClient, createForecastLoader, normalizeForecast, upcomingHours, validCoordinates, HOUR } from '../forecast.js';

const NOW = Date.parse('2026-09-05T12:30:00Z');
function weather(start = NOW - 12.5 * HOUR, length = 100, timezone = 'Europe/Helsinki') {
  return { timezone, hourly: {
    time: Array.from({ length }, (_, i) => (start + i * HOUR) / 1000),
    temperature_2m: Array(length).fill(16), pressure_msl: Array(length).fill(1008), wind_speed_10m: Array(length).fill(3), cloud_cover: Array(length).fill(65)
  } };
}
const response = data => ({ ok: true, json: async () => data });
function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('UTC timestamps use the location clock, including a half-hour timezone', () => {
  const helsinki = normalizeForecast(weather());
  assert.equal(helsinki.hours[12].time, '2026-09-05T12:00:00.000Z');
  assert.equal(helsinki.hours[12].hour, 15);
  assert.equal(normalizeForecast(weather(undefined, undefined, 'Asia/Kolkata')).hours[12].hour, 17);
});

test('DST spring gap and autumn repeated hours use actual elapsed time', () => {
  const spring = normalizeForecast(weather(Date.parse('2026-03-29T00:00Z'), 3));
  assert.deepEqual(spring.hours.map(x => x.hour), [2, 4, 5]);
  const autumn = normalizeForecast(weather(Date.parse('2026-10-25T00:00Z'), 3));
  assert.deepEqual(autumn.hours.map(x => x.hour), [3, 3, 4]);
  assert.equal(autumn.hours[1].timestamp - autumn.hours[0].timestamp, HOUR);
});

test('null values, truncated arrays and impossible values are omitted, not converted to zero', () => {
  const data = weather(undefined, 10);
  data.hourly.temperature_2m[0] = null;
  data.hourly.wind_speed_10m[1] = '';
  data.hourly.pressure_msl[2] = 0;
  data.hourly.cloud_cover[3] = 200;
  data.hourly.wind_speed_10m[4] = -1;
  data.hourly.cloud_cover.pop();
  const forecast = normalizeForecast(data);
  assert.equal(forecast.hours.length, 4);
  assert.equal(forecast.hours[0].timestamp, data.hourly.time[5] * 1000);
  assert.equal(forecast.hours[0].pressure6hAgo, null);
  assert.throws(() => normalizeForecast({ hourly: { time: [] } }));
});

test('pressure history must actually be six hours earlier', () => {
  const data = weather(undefined, 8);
  data.hourly.time[0] -= 3600;
  assert.equal(normalizeForecast(data).hours[6].pressure6hAgo, null);
});

test('the horizon excludes past starts and hours that end beyond 48 hours', () => {
  const hours = upcomingHours(normalizeForecast(weather()), NOW);
  assert.equal(hours[0].time, '2026-09-05T13:00:00.000Z');
  assert.ok(hours.at(-1).timestamp + HOUR <= NOW + 48 * HOUR);
  assert.equal(hours.length, 47);
});

test('simultaneous requests share one fetch and species changes can reuse the cached data', async () => {
  let calls = 0;
  let finish;
  const client = createForecastClient({ now: () => NOW, fetchImpl: async url => {
    calls++;
    const params = new URL(url).searchParams;
    assert.equal(params.get('timeformat'), 'unixtime');
    assert.equal(params.get('wind_speed_unit'), 'ms');
    return new Promise(resolve => { finish = () => resolve(response(weather())); });
  } });
  const first = client.get(60.2, 24.9);
  const second = client.get(60.2, 24.9);
  assert.equal(calls, 1);
  finish();
  assert.deepEqual(await first, await second);
  await client.get(60.2, 24.9);
  assert.equal(calls, 1);
});

test('different locations never share weather', async () => {
  let calls = 0;
  const client = createForecastClient({ now: () => NOW, fetchImpl: async () => { calls++; return response(weather()); } });
  await Promise.all([client.get(60, 24), client.get(65, 25)]);
  assert.equal(calls, 2);
});

test('explicit refresh bypasses fresh cache and failure yields a labelled fallback', async () => {
  let calls = 0;
  const client = createForecastClient({ now: () => NOW, fetchImpl: async () => { if (++calls > 1) throw new Error('offline'); return response(weather()); } });
  assert.equal((await client.get(60, 24)).stale, false);
  const fallback = await client.get(60, 24, { force: true });
  assert.equal(fallback.stale, true);
  assert.equal(fallback.fetchedAt, NOW);
  assert.equal(calls, 2);
});

test('cache survives a page reload, but expires after six hours offline', async () => {
  const storage = memoryStorage();
  let now = NOW;
  await createForecastClient({ storage, now: () => now, fetchImpl: async () => response(weather()) }).get(60, 24);
  now += HOUR;
  const client = createForecastClient({ storage, now: () => now, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal((await client.get(60, 24)).stale, true);
  now = NOW + 6 * HOUR + 1;
  await assert.rejects(client.get(60, 24));
});

test('invalid payloads and failed requests are not cached and can be retried', async () => {
  let calls = 0;
  const client = createForecastClient({ now: () => NOW, fetchImpl: async () => response(++calls === 1 ? { hourly: {} } : weather()) });
  await assert.rejects(client.get(60, 24));
  assert.equal((await client.get(60, 24)).stale, false);
  assert.equal(calls, 2);
});

test('timeout also aborts a response body that never arrives', async () => {
  const client = createForecastClient({ timeoutMs: 15, now: () => NOW, fetchImpl: async (_, { signal }) => ({ ok: true, json: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) }) });
  await assert.rejects(client.get(60, 24), /aborted/);
});

test('broken or unavailable storage never prevents a live forecast', async () => {
  for (const storage of [memoryStorage(), { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } }]) {
    try { storage.setItem('ff_forecasts_v1', '{broken'); } catch {}
    const client = createForecastClient({ storage, now: () => NOW, fetchImpl: async () => response(weather()) });
    assert.ok((await client.get(60, 24)).hours.length);
  }
});

test('invalid coordinates never make a network request', async () => {
  const client = createForecastClient({ fetchImpl: () => assert.fail('unexpected fetch') });
  for (const [lat, lon] of [[91, 25], [60, -181], ['60', 25], [null, 25], [NaN, 25]]) {
    assert.equal(validCoordinates(lat, lon), false);
    await assert.rejects(client.get(lat, lon));
  }
});

test('a slow previous location never overwrites a newer selection or its error', async () => {
  for (const newerFails of [false, true]) {
    const pending = [];
    const updates = [];
    const loader = createForecastLoader({ get: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) }, state => updates.push(state));
    const old = loader.load({ name: 'Old', lat: 60, lon: 24 });
    const latest = loader.load({ name: 'Latest', lat: 65, lon: 25 });
    if (newerFails) pending[1].reject(new Error('offline')); else pending[1].resolve('latest forecast');
    await latest;
    pending[0].resolve('old forecast');
    await old;
    assert.deepEqual(updates.map(state => state.status), ['loading', 'loading', newerFails ? 'error' : 'ready']);
    assert.equal(updates.at(-1).location.name, 'Latest');
  }
});

test('a cancelled selection and an old failure cannot replace the active forecast', async () => {
  let fail;
  const updates = [];
  const loader = createForecastLoader({ get: () => new Promise((_, reject) => { fail = reject; }) }, state => updates.push(state));
  const old = loader.load({ name: 'Old', lat: 60, lon: 24 });
  loader.cancel();
  fail(new Error('timeout'));
  await old;
  assert.deepEqual(updates.map(state => state.status), ['loading']);
});
