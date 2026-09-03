import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrateFishingScore, fishingScoreBand } from '../score-calibration.js';

test('vanha täydellinen raakapiste ei näytä 100/100', () => {
  assert.equal(calibrateFishingScore(100), 91);
  assert.ok(calibrateFishingScore(100) < 95);
});

test('kalibrointi säilyttää pisteiden järjestyksen', () => {
  const values = [20, 40, 50, 65, 80, 95, 100].map(calibrateFishingScore);
  for (let i = 1; i < values.length; i += 1) {
    assert.ok(values[i] > values[i - 1], `${values[i]} pitäisi olla suurempi kuin ${values[i - 1]}`);
  }
});

test('90+ kuuluu vain poikkeuksellisen hyvään luokkaan', () => {
  assert.equal(fishingScoreBand(91).id, 'exceptional');
  assert.equal(fishingScoreBand(80).id, 'very-good');
  assert.equal(fishingScoreBand(60).id, 'good');
  assert.equal(fishingScoreBand(45).id, 'fair');
  assert.equal(fishingScoreBand(30).id, 'poor');
});
