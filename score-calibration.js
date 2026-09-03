function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Muuntaa heuristiikan raakapisteen käyttäjälle näytettäväksi kalakelipisteeksi.
 *
 * Tavoite ei ole esittää pistettä saalistodennäköisyytenä. Hyvät ja huonot tunnit
 * säilyvät samassa järjestyksessä, mutta asteikon ääripäitä puristetaan: vanha
 * teoreettinen 100/100 muuttuu noin 91/100:ksi. Näin 90+ jää aidosti harvinaiseksi.
 */
export function calibrateFishingScore(rawScore) {
  const raw = clamp(Number(rawScore) || 0, 0, 100);
  const calibrated = raw <= 50
    ? 50 - (50 - raw) * 0.90
    : 50 + (raw - 50) * 0.82;
  return clamp(Math.round(calibrated), 0, 94);
}

export function fishingScoreBand(score, lang = 'fi') {
  const value = clamp(Math.round(Number(score) || 0), 0, 100);
  const english = lang === 'en';

  if (value >= 86) return {
    id: 'exceptional',
    text: english ? 'Exceptional' : 'Poikkeuksellisen hyvä',
    color: '#426f33'
  };
  if (value >= 72) return {
    id: 'very-good',
    text: english ? 'Very good' : 'Erittäin hyvä',
    color: '#4f7d42'
  };
  if (value >= 56) return {
    id: 'good',
    text: english ? 'Good' : 'Hyvä',
    color: '#2e656b'
  };
  if (value >= 40) return {
    id: 'fair',
    text: english ? 'Fair' : 'Kohtalainen',
    color: '#d97725'
  };
  return {
    id: 'poor',
    text: english ? 'Poor' : 'Heikko',
    color: '#a94635'
  };
}
