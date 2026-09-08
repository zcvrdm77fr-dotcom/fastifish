import { validCoordinates } from './forecast.js';

export const SAVED_KEY = 'ff_saved_places_v1';
export const MAX_PLACES = 12;

export function readSavedPlaces(storage) {
  try {
    const items = JSON.parse(storage.getItem(SAVED_KEY) || '[]');
    if (!Array.isArray(items)) return [];
    return items.filter(place => place && typeof place.name === 'string' && place.name.trim() && validCoordinates(place.lat, place.lon))
      .slice(0, MAX_PLACES).map(({ name, lat, lon }) => ({ name: name.trim().slice(0, 60), lat, lon }));
  } catch { return []; }
}

export function savePlace(storage, place) {
  if (!place || !validCoordinates(place.lat, place.lon) || typeof place.name !== 'string' || !place.name.trim()) return { ok: false, reason: 'invalid' };
  const places = readSavedPlaces(storage);
  const next = { name: place.name.trim().slice(0, 60), lat: Number(place.lat.toFixed(5)), lon: Number(place.lon.toFixed(5)) };
  const duplicate = places.findIndex(p => Math.abs(p.lat - next.lat) < 0.0001 && Math.abs(p.lon - next.lon) < 0.0001);
  if (duplicate >= 0) places[duplicate] = next;
  else if (places.length >= MAX_PLACES) return { ok: false, reason: 'full' };
  else places.unshift(next);
  try { storage.setItem(SAVED_KEY, JSON.stringify(places)); return { ok: true, place: next }; }
  catch { return { ok: false, reason: 'storage' }; }
}

export function removePlace(storage, index) {
  const places = readSavedPlaces(storage);
  if (!Number.isInteger(index) || index < 0 || index >= places.length) return false;
  places.splice(index, 1);
  try { storage.setItem(SAVED_KEY, JSON.stringify(places)); return true; } catch { return false; }
}
