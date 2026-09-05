import test from 'node:test';
import assert from 'node:assert/strict';
import { readSavedPlaces, savePlace, removePlace, SAVED_KEY } from '../saved-places.js';

function storageWith(value) {
  const data = new Map([[SAVED_KEY, value]]);
  return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
}

test('saved places tolerate malformed JSON, non-arrays and invalid records', () => {
  for (const value of ['{oops', '{}', 'null', '"hello"']) assert.deepEqual(readSavedPlaces(storageWith(value)), []);
  const data = [null, { name: 'Bad', lat: 99, lon: 24 }, { name: '<img>', lat: 60, lon: 24, extra: 'ignored' }];
  assert.deepEqual(readSavedPlaces(storageWith(JSON.stringify(data))), [{ name: '<img>', lat: 60, lon: 24 }]);
});

test('saving the same coordinates renames a place and preserves the existing storage format', () => {
  const storage = storageWith('[]');
  assert.equal(savePlace(storage, { name: '  Lahti  ', lat: 60.12345678, lon: 24.23456789 }).ok, true);
  assert.deepEqual(readSavedPlaces(storage), [{ name: 'Lahti', lat: 60.12346, lon: 24.23457 }]);
  assert.equal(savePlace(storage, { name: 'Kotilahti', lat: 60.12346, lon: 24.23457 }).ok, true);
  assert.equal(readSavedPlaces(storage).length, 1);
  assert.equal(readSavedPlaces(storage)[0].name, 'Kotilahti');
});

test('full storage preserves all 12 places instead of silently dropping one', () => {
  const storage = storageWith('[]');
  for (let i = 0; i < 12; i++) assert.equal(savePlace(storage, { name: `Place ${i}`, lat: 60 + i, lon: 24 }).ok, true);
  const before = storage.getItem(SAVED_KEY);
  assert.deepEqual(savePlace(storage, { name: 'New', lat: 80, lon: 24 }), { ok: false, reason: 'full' });
  assert.equal(storage.getItem(SAVED_KEY), before);
});

test('write failures are reported for both saving and removing', () => {
  const storage = { getItem: () => '[{"name":"Lahti","lat":60,"lon":24}]', setItem() { throw new Error('quota'); } };
  assert.equal(savePlace(storage, { name: 'Other', lat: 61, lon: 24 }).reason, 'storage');
  assert.equal(removePlace(storage, 0), false);
  assert.equal(removePlace(storage, -1), false);
  assert.equal(removePlace(storage, 0.5), false);
});

test('removing one place leaves the other records intact', () => {
  const storage = storageWith('[]');
  savePlace(storage, { name: 'A', lat: 60, lon: 24 });
  savePlace(storage, { name: 'B', lat: 61, lon: 24 });
  assert.equal(removePlace(storage, 1), true);
  assert.deepEqual(readSavedPlaces(storage), [{ name: 'B', lat: 61, lon: 24 }]);
});
