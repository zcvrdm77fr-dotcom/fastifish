import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreFishingHour, findBestWindow, recommendForSpecies } from '../fishing-advice.js';

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
  assert.equal(best.end, '2026-09-03T20:00');
});

test('lajisuositus palauttaa vieheen ja syvyysvinkin', () => {
  const result = recommendForSpecies('ahven', { temp:14, wind:3, cloud:50, hour:9 });
  assert.equal(result.species, 'Ahven');
  assert.match(result.lure, /jigi/i);
  assert.ok(result.depth.length > 3);
});
