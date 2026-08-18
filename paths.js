// Yhteiset tallennuspolut. Pilvipalveluissa (Render, Fly, Railway, oma VPS) levy on usein
// muualla kuin projektikansiossa - esim. Renderin pysyvä levy liitetään polkuun /var/data.
// DATA_DIR-ympäristömuuttujalla tietokanta ja kuvat saadaan sille pysyvälle levylle, jolloin
// ne EIVÄT katoa kun palvelu käynnistetään uudelleen tai uusi versio julkaistaan.
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(DATA_DIR, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
