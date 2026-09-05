import { calibrateFishingScore } from './score-calibration.js';
import { HOUR } from './forecast.js';

const SPECIES = {
  kuha: {
    name: 'Kuha',
    lure: '10–14 cm jigi tai kapea vaappu',
    depth: ({ hour, temp }) => (hour >= 20 || hour <= 6 ? '2–5 m reunat ja matalan vierus' : temp > 18 ? '6–10 m penkat' : '4–8 m penkat'),
    bonus: ({ cloud, prime }) => (cloud >= 50 ? 12 : 0) + (prime ? 10 : 0)
  },
  hauki: {
    name: 'Hauki',
    lure: 'spinnerbait, lusikka tai 12–20 cm shad',
    depth: ({ temp }) => (temp > 20 ? '4–8 m viileämmät reunat' : '1–5 m kasvustot ja penkat'),
    bonus: ({ cloud, wind, temp }) => (cloud >= 40 ? 8 : 0) + (wind >= 2 && wind <= 7 ? 6 : 0) - (temp > 24 ? 10 : 0)
  },
  ahven: {
    name: 'Ahven',
    lure: '5–10 cm jigi, blade tai pieni lippa',
    depth: ({ temp }) => (temp >= 10 && temp <= 20 ? '2–7 m parvet ja penkat' : '4–10 m syvemmät reunat'),
    bonus: ({ wind, cloud }) => (wind >= 1 && wind <= 5 ? 8 : 0) + (cloud >= 30 ? 5 : 0)
  },
  taimen: {
    name: 'Taimen',
    lure: 'lusikka, vaappu tai streamer',
    depth: ({ temp }) => (temp > 16 ? 'syvempi, viileä vesi ja virtapaikat' : 'pintakerros–4 m, virrat ja tuulenpuoleiset rannat'),
    bonus: ({ temp, wind }) => (temp >= 4 && temp <= 14 ? 12 : 0) + (wind >= 2 && wind <= 8 ? 6 : 0) - (temp > 19 ? 14 : 0)
  }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function scoreFishingHour({ temp, pressure, pressure6hAgo, wind, cloud, hour, species = 'kuha' }) {
  if (![temp, pressure, wind, cloud, hour].every(Number.isFinite) || wind < 0 || cloud < 0 || cloud > 100 || pressure <= 0 || hour < 0 || hour >= 24) return null;
  const prime = hour <= 8 || hour >= 18;
  const pressureDelta = Number.isFinite(pressure6hAgo) ? pressure - pressure6hAgo : 0;
  let rawScore = 48;

  if (prime) rawScore += 10;
  if (wind >= 1.5 && wind <= 6.5) rawScore += 10;
  else if (wind > 10) rawScore -= 12;
  if (cloud >= 35 && cloud <= 90) rawScore += 7;
  if (pressureDelta <= -0.5 && pressureDelta >= -4) rawScore += 8;
  else if (pressureDelta > 2.5) rawScore -= 5;
  if (temp >= 6 && temp <= 22) rawScore += 5;
  else if (temp > 27 || temp < -2) rawScore -= 10;

  const config = SPECIES[species] || SPECIES.kuha;
  rawScore += config.bonus({ temp, pressure, pressureDelta, wind, cloud, hour, prime });

  return calibrateFishingScore(clamp(Math.round(rawScore), 0, 100));
}

const ENGLISH_ADVICE = {
  kuha: { name: 'Zander', lure: '10–14 cm jig or slender plug', depth: ({ hour, temp }) => hour >= 20 || hour <= 6 ? '2–5 m edges beside shallows' : temp > 18 ? '6–10 m drop-offs' : '4–8 m drop-offs' },
  hauki: { name: 'Pike', lure: 'spinnerbait, spoon or 12–20 cm shad', depth: ({ temp }) => temp > 20 ? '4–8 m cooler edges' : '1–5 m weed beds and drop-offs' },
  ahven: { name: 'Perch', lure: '5–10 cm jig, blade or small spinner', depth: ({ temp }) => temp >= 10 && temp <= 20 ? '2–7 m shoals and drop-offs' : '4–10 m deeper edges' },
  taimen: { name: 'Trout', lure: 'spoon, plug or streamer', depth: ({ temp }) => temp > 16 ? 'deeper, cooler water and currents' : 'surface–4 m, currents and windward banks' }
};

export function recommendForSpecies(species, conditions, lang = 'fi') {
  if (lang === 'en') {
    const config = ENGLISH_ADVICE[species] || ENGLISH_ADVICE.kuha;
    return {
      species: config.name, lure: config.lure, depth: config.depth(conditions),
      color: conditions.cloud < 35 ? 'natural or silver' : 'dark, UV or contrasting',
      technique: conditions.wind > 7 ? 'fish the sheltered side and keep the lure under control' : conditions.hour >= 18 || conditions.hour <= 8 ? 'slow down slightly and work the edges methodically' : 'keep moving to find active fish'
    };
  }
  const config = SPECIES[species] || SPECIES.kuha;
  const bright = conditions.cloud < 35;
  const clearWaterColor = bright ? 'luonnollinen/hopea' : 'tumma, UV tai kontrastiväri';
  return {
    species: config.name,
    lure: config.lure,
    depth: config.depth(conditions),
    color: clearWaterColor,
    technique: conditions.wind > 7 ? 'kalasta suojan puolta ja pidä viehe hallittavana' : conditions.hour >= 18 || conditions.hour <= 8 ? 'hidasta hieman ja käy reunat järjestelmällisesti' : 'etsi aktiivista kalaa liikkuen'
  };
}

function timestampFor(item) {
  if (Number.isFinite(item?.timestamp)) return item.timestamp;
  if (typeof item?.time !== 'string') return NaN;
  // Legacy callers supply local ISO hours. Treat these as a wall-clock sequence,
  // independent of the test runner/browser's own timezone.
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(item.time) ? item.time : `${item.time}Z`);
}

export function rankFishingWindows(hourly, species = 'kuha', windowHours = 2, { limit = 3, period = 'all' } = {}) {
  if (!Array.isArray(hourly) || !Number.isInteger(windowHours) || windowHours < 1 || windowHours > 12 || !Number.isInteger(limit) || limit < 1) return [];
  const scored = hourly.filter(Boolean).map(item => ({ ...item, timestamp: timestampFor(item), score: scoreFishingHour({ ...item, species }) }))
    .sort((a, b) => a.timestamp - b.timestamp);
  const inPeriod = hour => period === 'morning' ? hour >= 5 && hour < 12 : period === 'day' ? hour >= 12 && hour < 18 : period === 'evening' ? hour >= 18 && hour < 24 : true;
  const candidates = [];
  for (let i = 0; i <= scored.length - windowHours; i += 1) {
    const items = scored.slice(i, i + windowHours);
    if (!items.every((item, index) => Number.isFinite(item.score) && Number.isFinite(item.timestamp) && inPeriod(item.hour) && (!index || item.timestamp - items[index - 1].timestamp === HOUR))) continue;
    const first = items[0];
    const endTimestamp = items.at(-1).timestamp + HOUR;
    const average = items.reduce((sum, item) => sum + item.score, 0) / windowHours;
    const explicitZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(first.time);
    candidates.push({ score: Math.round(average), average, start: first.time,
      end: explicitZone ? new Date(endTimestamp).toISOString() : new Date(endTimestamp).toISOString().slice(0, 16),
      startTimestamp: first.timestamp, endTimestamp, conditions: first, items });
  }
  candidates.sort((a, b) => b.average - a.average || a.startTimestamp - b.startTimestamp);
  const selected = [];
  for (const candidate of candidates) {
    if (selected.every(other => candidate.endTimestamp <= other.startTimestamp || candidate.startTimestamp >= other.endTimestamp)) selected.push(candidate);
    if (selected.length === limit) break;
  }
  return selected;
}

export function findBestWindow(hourly, species = 'kuha', windowHours = 2) {
  return rankFishingWindows(hourly, species, windowHours, { limit: 1 })[0] || null;
}

export const supportedSpecies = Object.entries(SPECIES).map(([id, value]) => ({ id, name: value.name }));
