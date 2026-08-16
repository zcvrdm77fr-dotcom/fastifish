// Automaattinen sisällöntarkistus ennen julkaisua (käyttäjän pyynnöstä, ei manuaalista jonoa).
// TÄRKEÄ PERIAATE: jos tarkistus epäonnistuu odottamattomasti (esim. kuvamalli ei lataudu) EI
// julkaista sisältöä tarkistamattomana - virhe tulkitaan aina hylkäykseksi ("fail closed").
//
// Tämä käyttää täysin paikallista, ilmaista tarkistusta - ei ulkoista tiliä, API-avainta eikä
// laskutusta. Kokeiltiin ensin Gemini/Vertex AI:ta, mutta käyttäjän Google Cloud -tili vaati
// laskutettavan service accountin, jota käyttäjä ei halunnut ottaa käyttöön. Tämä on siis
// tarkoituksella karkeampi kuin tekoälypohjainen tarkistus olisi ollut:
//  - Kuvat: nsfwjs (avoin, paikallinen mallipohjainen luokitin) tunnistaa alastomuuden/
//    pornografisen sisällön kuvasta. Se EI ymmärrä esim. väkivaltaa, vihasymboleita tai
//    kontekstia - vain alastomuuden/seksuaalisuuden asteen.
//  - Tekstit (käyttäjänimet, kuvatekstit): sanalista (wordlist.js) tunnetuille vihapuhe-/
//    seksuaalisisältötermeille suomeksi ja englanniksi.
import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import sharp from 'sharp';
import { findBlockedTerm } from './wordlist.js';

class ModerationUnavailableError extends Error {}

// Kynnysarvot: yhdistetty Porn+Hentai-todennäköisyys tai hyvin korkea Sexy-todennäköisyys
// hylkää kuvan. Tavalliset kalastuskuvat (myös esim. uimapukukuvat rannalla) jäävät selvästi
// näiden alle - kynnykset on asetettu varovaisen sallivasti väärien hylkäysten välttämiseksi,
// koska tavoite on estää selvästi sopimaton sisältö, ei moralisoida rajatapauksia.
const PORN_HENTAI_THRESHOLD = 0.5;
const SEXY_ONLY_THRESHOLD = 0.9;

let modelPromise = null;
function getModel(){
  if (!modelPromise) modelPromise = nsfwjs.load();
  return modelPromise;
}

async function classifyImage(imageBuffer){
  const model = await getModel();
  const { data, info } = await sharp(imageBuffer)
    .resize(224, 224)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels], 'int32');
  let predictions;
  try {
    predictions = await model.classify(tensor);
  } finally {
    tensor.dispose();
  }
  const byClass = {};
  predictions.forEach(p => { byClass[p.className] = p.probability; });
  return byClass;
}

export async function moderateUsername(username){
  const term = findBlockedTerm(username);
  if (term) return { allowed: false, reason: 'Käyttäjänimi sisältää asiattomaksi tulkittavaa sisältöä.' };
  return { allowed: true, reason: '' };
}

export async function moderatePost(imageBuffer, mimeType, caption){
  const capTerm = findBlockedTerm(caption);
  if (capTerm) return { allowed: false, reason: 'Kuvateksti sisältää asiattomaksi tulkittavaa sisältöä.' };

  let scores;
  try {
    scores = await classifyImage(imageBuffer);
  } catch(e) {
    throw new ModerationUnavailableError('Kuvantarkistusmalli ei ole käytettävissä: ' + e.message);
  }

  const pornHentai = (scores.Porn || 0) + (scores.Hentai || 0);
  if (pornHentai > PORN_HENTAI_THRESHOLD || (scores.Sexy || 0) > SEXY_ONLY_THRESHOLD) {
    return { allowed: false, reason: 'Kuva ei läpäissyt automaattista sisällöntarkistusta (mahdollisesti sopimaton kuvasisältö).' };
  }
  return { allowed: true, reason: '' };
}

export { ModerationUnavailableError };
