import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreFishingHour, findBestWindow, rankFishingWindows, recommendForSpecies } from '../fishing-advice.js';

test('hyvä iltakeli saa paremman pistemäärän kuin kova tuuli keskellä päivää', () => {
  const good = scoreFishingHour({ temp:16, pressure:1008, pressure6hAgo:1010, wind:3, cloud:65, hour:20, species:'kuha' });
  const poor = scoreFishingHour({ temp:28, pressure:1024, pressure6hAgo:1020, wind:13, cloud:5, hour:13, species:'kuha' });
  assert.ok(good > poor, `${good} pitäisi olla suurempi kuin ${poor}`);
  assert.ok(good >= 60);
});

test('findBestWindow valitsee parhaat peräkkäiset tunnit', () => {
  const hourly = [
    { time:'2026-09-03T12:00', hour:12, temp:26, pressure:1020, pressure6hAgo:1018, wind:11, cloud:5 },
    { time:'2026-09-03T18:00', hour:18, temp:18, pressure:1016, pressure6hAgo:1012, wind:9, cloud:30 },
    { time:'2026-09-03T19:00', hour:19, temp:17, pressure:1011, pressure6hAgo:1014, wind:3, cloud:70 },
    { time:'2026-09-03T20:00', hour:20, temp:16, pressure:1010, pressure6hAgo:1013, wind:3, cloud:75 }
  ];
  const best = findBestWindow(hourly, 'kuha', 2);
  assert.ok(best);
  assert.equal(best.start, '2026-09-03T19:00');
  assert.equal(best.end, '2026-09-03T21:00');
});

const hour = (time, overrides = {}) => ({ time, hour: Number(time.slice(11, 13)), temp: 16, pressure: 1008, pressure6hAgo: 1010, wind: 3, cloud: 65, ...overrides });

test('a two-hour trip crosses midnight and ends after the final hour', () => {
  const best = findBestWindow([hour('2026-09-05T23:00Z'), hour('2026-09-06T00:00Z')]);
  assert.equal(best.end, '2026-09-06T01:00:00.000Z');
  assert.equal(best.endTimestamp - best.startTimestamp, 2 * 3600000);
});

test('missing hours and invalid weather cannot be joined into a good trip', () => {
  assert.equal(findBestWindow([hour('2026-09-05T18:00'), hour('2026-09-05T20:00')]), null);
  assert.equal(findBestWindow([hour('2026-09-05T18:00'), hour('2026-09-05T19:00', { wind: null })]), null);
  assert.equal(scoreFishingHour(hour('2026-09-05T18:00', { temp: null })), null);
  assert.equal(scoreFishingHour(hour('2026-09-05T18:00', { cloud: 101 })), null);
});

test('invalid durations and too little data return no recommendation', () => {
  const hours = [hour('2026-09-05T18:00')];
  for (const duration of [0, -1, 1.5, NaN, 13, 2]) assert.equal(findBestWindow(hours, 'kuha', duration), null);
  assert.equal(findBestWindow(null), null);
});

test('alternatives do not overlap, and equal scores prefer the earliest start', () => {
  const hours = Array.from({ length: 6 }, (_, i) => hour(`2026-09-05T${18 + i}:00`)).reverse();
  const windows = rankFishingWindows(hours);
  assert.equal(windows.length, 3);
  assert.equal(windows[0].start, '2026-09-05T18:00');
  for (let i = 1; i < windows.length; i++) assert.ok(windows[i].startTimestamp >= windows[i - 1].endTimestamp);
});

test('the entire trip must fit the chosen time of day', () => {
  const hours = [hour('2026-09-05T10:00'), hour('2026-09-05T11:00'), hour('2026-09-05T12:00')];
  const windows = rankFishingWindows(hours, 'kuha', 2, { period: 'morning' });
  assert.equal(windows.length, 1);
  assert.equal(windows[0].end, '2026-09-05T12:00');
  assert.deepEqual(rankFishingWindows(hours, 'kuha', 3, { period: 'morning' }), []);
});

test('DST repeated local hours remain a continuous two-hour trip', () => {
  const windows = [hour('2026-10-25T00:00Z', { hour: 3 }), hour('2026-10-25T01:00Z', { hour: 3 })];
  assert.equal(findBestWindow(windows).endTimestamp - findBestWindow(windows).startTimestamp, 7200000);
});

test('English lure advice stays in English', () => {
  const result = recommendForSpecies('ahven', { temp: 14, wind: 3, cloud: 50, hour: 9 }, 'en');
  assert.equal(result.species, 'Perch');
  assert.match(result.lure, /jig/);
  assert.match(result.depth, /drop-offs/);
});

test('lajisuositus palauttaa vieheen ja syvyysvinkin', () => {
  const result = recommendForSpecies('ahven', { temp:14, wind:3, cloud:50, hour:9 });
  assert.equal(result.species, 'Ahven');
  assert.match(result.lure, /jigi/i);
  assert.ok(result.depth.length > 3);
});
