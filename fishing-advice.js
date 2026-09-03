import { calibrateFishingScore } from './score-calibration.js';

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

export function recommendForSpecies(species, conditions) {
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

export function findBestWindow(hourly, species = 'kuha', windowHours = 2) {
  if (!Array.isArray(hourly) || hourly.length === 0) return null;
  const scored = hourly.map(item => ({ ...item, score: scoreFishingHour({ ...item, species }) }));
  let best = null;

  for (let i = 0; i <= scored.length - windowHours; i += 1) {
    const slice = scored.slice(i, i + windowHours);
    const average = slice.reduce((sum, item) => sum + item.score, 0) / slice.length;
    if (!best || average > best.average) best = { average, items: slice };
  }

  if (!best) return null;
  const first = best.items[0];
  const last = best.items[best.items.length - 1];
  return {
    score: Math.round(best.average),
    start: first.time,
    end: last.time,
    conditions: first
  };
}

export const supportedSpecies = Object.entries(SPECIES).map(([id, value]) => ({ id, name: value.name }));
