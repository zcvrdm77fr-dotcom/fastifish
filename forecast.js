// Open-Meteo unix timestamps are UTC; display hours in the forecast location's zone.
// https://open-meteo.com/en/docs#api_documentation
export const HOUR = 60 * 60 * 1000;
const FRESH_FOR = 15 * 60 * 1000;
const OFFLINE_FOR = 6 * HOUR;
const CACHE_KEY = 'ff_forecasts_v1';

export function validCoordinates(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

export function normalizeForecast(data) {
  const source = data?.hourly;
  if (!Array.isArray(source?.time) || typeof data.timezone !== 'string') throw new Error('invalid-forecast');
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: data.timezone, hour: '2-digit', hourCycle: 'h23' });
  const fields = { temp: 'temperature_2m', pressure: 'pressure_msl', wind: 'wind_speed_10m', cloud: 'cloud_cover' };
  const hours = source.time.map((seconds, index) => {
    if (!Number.isFinite(seconds)) return null;
    const timestamp = seconds * 1000;
    const item = { time: new Date(timestamp).toISOString(), timestamp, hour: Number(clock.format(timestamp)) };
    for (const [key, field] of Object.entries(fields)) {
      // null/empty values must never become calm wind or zero degrees.
      if (!Number.isFinite(source[field]?.[index])) return null;
      item[key] = source[field][index];
    }
    if (item.wind < 0 || item.cloud < 0 || item.cloud > 100 || item.pressure <= 0) return null;
    const previous = source.pressure_msl?.[index - 6];
    item.pressure6hAgo = source.time[index - 6] === seconds - 21600 && Number.isFinite(previous) && previous > 0 ? previous : null;
    return item;
  }).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
  if (!hours.length) throw new Error('invalid-forecast');
  return { timezone: data.timezone, hours };
}

export function upcomingHours(forecast, now = Date.now(), horizon = 48) {
  // Only whole future hours: a trip must not start before the current time.
  return forecast.hours.filter(item => item.timestamp >= now && item.timestamp + HOUR <= now + horizon * HOUR);
}

export function createForecastClient({ fetchImpl = (...args) => fetch(...args), storage = null, now = Date.now, timeoutMs = 8000 } = {}) {
  const cache = new Map();
  const pending = new Map();
  try {
    const entries = JSON.parse(storage?.getItem(CACHE_KEY) || '[]');
    if (Array.isArray(entries)) for (const entry of entries.slice(-6)) {
      if (Array.isArray(entry) && typeof entry[0] === 'string' && Number.isFinite(entry[1]?.fetchedAt)) {
        try { normalizeForecast(entry[1].data); cache.set(entry[0], entry[1]); } catch { /* Ignore damaged storage. */ }
      }
    }
  } catch { /* Storage is optional (private browsing, quota or disabled storage). */ }

  function read(entry, stale = false) {
    const forecast = normalizeForecast(entry.data);
    if (!upcomingHours(forecast, now()).length) throw new Error('expired-forecast');
    return { ...forecast, fetchedAt: entry.fetchedAt, stale };
  }

  async function get(lat, lon, { force = false } = {}) {
    if (!validCoordinates(lat, lon)) throw new Error('invalid-location');
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const entry = cache.get(key);
    const age = entry ? now() - entry.fetchedAt : Infinity;
    if (!force && age >= 0 && age < FRESH_FOR) {
      try { return read(entry); } catch { /* Refetch if all hours have expired. */ }
    }
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const params = new URLSearchParams({
          latitude: String(lat), longitude: String(lon),
          hourly: 'temperature_2m,pressure_msl,wind_speed_10m,cloud_cover',
          forecast_days: '3', past_days: '1', timezone: 'auto', timeformat: 'unixtime', wind_speed_unit: 'ms'
        });
        const response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('forecast-unavailable');
        const fresh = { data: await response.json(), fetchedAt: now() };
        const forecast = read(fresh);
        cache.delete(key);
        cache.set(key, fresh);
        while (cache.size > 6) cache.delete(cache.keys().next().value);
        try { storage?.setItem(CACHE_KEY, JSON.stringify([...cache])); } catch { /* Keep the in-memory cache. */ }
        return forecast;
      } catch (error) {
        const fallbackAge = entry ? now() - entry.fetchedAt : Infinity;
        if (fallbackAge >= 0 && fallbackAge <= OFFLINE_FOR) {
          try { return read(entry, true); } catch { /* No usable cached hours. */ }
        }
        throw error;
      } finally { clearTimeout(timer); }
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  }
  return { get };
}

// Selection requests may finish in any order. Only the latest choice owns the UI.
export function createForecastLoader(client, onUpdate) {
  let version = 0;
  return {
    cancel() { version++; },
    async load(location, options) {
      const request = ++version;
      onUpdate({ status: 'loading', location });
      try {
        const forecast = await client.get(location.lat, location.lon, options);
        if (request === version) onUpdate({ status: 'ready', location, forecast });
      } catch (error) {
        if (request === version) onUpdate({ status: 'error', location, error });
      }
    }
  };
}
