import { calibrateFishingScore } from './score-calibration.js';

const hour = 3600000;

export function scoreIceHour(row, previous, target) {
  if (![row.wind, row.cloud].every(Number.isFinite) || row.wind < 0 || row.cloud < 0 || row.cloud > 100) return null;
  let score = 55;
  if (row.wind <= 3) score += 9;
  else if (row.wind > 8) score -= 12;
  if (row.gusts > 12) score -= 8;
  if (row.feels < -20) score -= 8;
  if (row.cloud >= 35) score += 5;

  if (Number.isFinite(row.pressure) && Number.isFinite(previous?.pressure)) {
    const change = row.pressure - previous.pressure;
    if (change >= -3 && change <= 1) score += 7;
    else if (Math.abs(change) > 5) score -= 9;
  }

  if (row.rise && row.set && row.rise < row.set) {
    const daylight = row.timestamp >= row.rise && row.timestamp <= row.set;
    const twilight = Math.min(Math.abs(row.timestamp - row.rise), Math.abs(row.timestamp - row.set)) <= hour;
    if (target === 'burbot') score += daylight ? -8 : 12;
    else if (target === 'zander') score += twilight ? 13 : daylight ? 0 : 4;
    else score += daylight ? 9 : twilight ? 5 : -6;
  }
  return calibrateFishingScore(score);
}

export function iceScoreForecast(rows, now, target) {
  const byTime = new Map(rows.map(row => [row.timestamp, row]));
  const hours = rows.filter(row => row.timestamp > now - hour && row.timestamp < now + 12 * hour)
    .map(row => ({
      timestamp: row.timestamp,
      score: scoreIceHour(row, byTime.get(row.timestamp - 6 * hour), target)
    }));
  let best = null;
  for (let i = 1; i < hours.length; i += 1) {
    const [first, next] = [hours[i - 1], hours[i]];
    if (first.timestamp < now || next.timestamp - first.timestamp !== hour || first.score === null || next.score === null) continue;
    const score = Math.round((first.score + next.score) / 2);
    if (!best || score > best.score) best = { start: first.timestamp, end: next.timestamp + hour, score };
  }
  return { hours, best };
}
