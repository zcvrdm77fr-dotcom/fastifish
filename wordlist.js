// Karkea suomi/englanti-sanalista vihapuheelle, rasistisille/homofobisille halventaville
// termeille ja selvälle seksuaaliselle sisällölle. Tarkoituksella suppea ja täsmällinen -
// tavallinen kirosana (esim. "vittu", "saatana") EI ole täällä, koska tavoite on estää
// häiritsevä/vihamielinen sisältö, ei tavallista arkikieltä. Ei väitetä kattavaksi - tämä on
// yksi kerros muiden (kuvantunnistus, käyttäjänimen muotovaatimukset) rinnalla.
export const BLOCKED_TERMS = [
  // englanti - rasistiset/vihamieliset termit
  'nigger', 'nigga', 'chink', 'spic', 'kike', 'wetback', 'towelhead', 'faggot', 'retard',
  'raghead', 'gook',
  // englanti - seksuaalinen/eksplisiittinen
  'porn', 'pornhub', 'xvideos', 'xxx', 'anal sex', 'blowjob', 'cumshot', 'rape',
  // suomi - vihamieliset/rasistiset
  'neekeri', 'nekru', 'natsi', 'hitler', 'ryssä', 'homolutka', 'homottelu',
  // yhdyshalventelut: kohdistettu loukkaus, ei sama asia kuin neutraali itseidentifiointi
  // (esim. "olen homo" ei osu tähän, koska sana on tässä yhdistettynä halventavaan liitteeseen)
  'homo pelle', 'homovittu', 'homopaska',
  // suomi - seksuaalinen/eksplisiittinen
  'panopelle', 'raiskaus', 'lapsiporno', 'pedofiili',
  // yleiset uhkaus-/väkivaltatermit
  'kill yourself', 'kys', 'tapa itsesi'
];

function normalize(text){
  return String(text)
    .toLowerCase()
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/@/g, 'a').replace(/\$/g, 's')
    .replace(/[^a-zäöå0-9\s]/g, '');
}

export function findBlockedTerm(text){
  if (!text) return null;
  const normalized = normalize(text);
  for (const term of BLOCKED_TERMS) {
    if (normalized.includes(normalize(term))) return term;
  }
  return null;
}
