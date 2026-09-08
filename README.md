# FastFishing

**Kalakeli, kalapaikkakartta, kalastusoppaat ja saalisyhteisö suomalaisille kalastajille.**

[🌐 Avaa FastFishing](https://fastfishin.com) · [📚 Kalastusoppaat](https://fastfishin.com/kalastusoppaat.html) · [🧪 Metodologia](https://fastfishin.com/metodologia.html)

![Quality](https://github.com/zcvrdm77fr-dotcom/fastifish/actions/workflows/quality.yml/badge.svg)

## Mikä FastFishing on?

FastFishing on harrastusprojekti, joka kokoaa ennen kalareissua tarvittavia työkaluja yhteen palveluun. Tavoitteena on auttaa käyttäjää löytämään nopeasti **milloin kannattaa lähteä, mistä kalaa kannattaa etsiä ja millä vieheellä kannattaa aloittaa**.

Palvelussa on tällä hetkellä mm.:

- 🎣 kalakelipiste ja lajikohtainen **Kalastusnyt**-suositus
- 🗺️ kalapaikkakartta, syvyysrakenteita ja kalastuksen kannalta kiinnostavia paikkoja
- 📍 omat tallennetut kalapaikat ja selaimen kalakeli-ilmoitukset
- 🐟 Saalisvirta käyttäjien saaliskuville, kommenteille ja tykkäyksille
- 👤 kalastajaprofiilit ja viikoittaiset saalistrendit
- 📚 omat oppaat hauelle, ahvenelle, kuhalle, jigikalastukseen, vetouisteluun ja vieheen valintaan
- 🌦️ Open-Meteo-pohjainen säädata ja avoimesti dokumentoitu kalakelimalli

### Reissun lähtöajan vertailu

**Milloin kalaan?** käyttää sivun paikkahakua tai omaa sijaintia. Valitse kuha, hauki,
ahven tai taimen, 1–4 tunnin reissu ja sopiva vuorokaudenaika. Suunnittelija vertailee
seuraavan 48 tunnin yhtenäisiä ennustejaksoja ja näyttää enintään kolme toisistaan erillistä
vaihtoehtoa sekä valittavan tuntiennusteen. Kaikki ajat esitetään paikan aikavyöhykkeellä.

Lajin, keston ja vuorokaudenajan vaihtaminen lasketaan suunnittelijassa jo haetusta
datasta. Säädataa säilytetään istunnon välimuistissa enintään kuudelle paikalle;
15 minuuttia vanhempi ennuste haetaan uudelleen. Verkkovirheen aikana voidaan näyttää
enintään kuusi tuntia vanha ennuste, jonka ikä ja välimuistista näyttäminen kerrotaan
näkyvästi. Puuttuvia tuntihavaintoja ei pisteytetä eikä yhdistetä ehjäksi reissuksi.

Omat paikat säilyvät aiemmassa selainkohtaisessa muodossa. Kalakeli-ilmoitukset voi
ottaa käyttöön ja poistaa käytöstä suunnittelijassa; niitä tarkistetaan vain sovelluksen
ollessa auki. Taustalla toimiva Web Push on edelleen erillinen kehityskohde (#15).

> Kalakelipiste on heuristinen vertailuarvo, ei saalistodennäköisyys tai saalistakuu. Mallin laskenta ja rajoitukset on kuvattu [metodologiasivulla](https://fastfishin.com/metodologia.html).

## Demo

Tuotantoversio: **https://fastfishin.com**

API:n health check: **https://api.fastfishin.com/api/health**

## Tekninen rakenne

FastFishing on tarkoituksella melko kevyt kokonaisuus:

- frontend: HTML, CSS ja JavaScript
- kartta- ja kalastuslogiikka: selaimessa ajettavat JavaScript-moduulit
- backend: Node.js + Express
- tietokanta: SQLite / `better-sqlite3`
- kuvat: palvelimen uploads-hakemisto, kuvien käsittely `sharp`illa
- moderointi: paikallinen TensorFlow.js / NSFWJS -pohjainen kuvantarkistus
- sää: Open-Meteo
- merialueiden syvyysrakenteet: Traficomin avoin WFS-data
- staattinen frontend: GitHub Pages
- API: erillinen Node-palvelu osoitteessa `api.fastfishin.com`

## Paikallinen kehitys

### Vaatimukset

- Node.js 22 suositeltu
- npm
- Git

### 1. Kloonaa repo

```bash
git clone https://github.com/zcvrdm77fr-dotcom/fastifish.git
cd fastifish
```

### 2. Asenna riippuvuudet

Lukitun dependency-version mukaan:

```bash
npm ci
```

Jos olet muuttamassa riippuvuuksia, käytä normaalisti:

```bash
npm install
```

### 3. Ympäristömuuttujat

Paikallinen perusajo toimii ilman pakollisia ympäristömuuttujia. Halutessasi kopioi mallipohja:

```bash
cp .env.example .env
```

Tärkeimmät tuotantoasetukset ovat:

```env
DATA_DIR=/var/data
ALLOWED_ORIGINS=https://fastfishin.com,https://www.fastfishin.com
CROSS_SITE_COOKIES=1
NODE_ENV=production
ADMIN_USERNAMES=oma-kayttajanimi
```

Katso tarkemmat deploy-ohjeet tiedostosta [`DEPLOY.md`](DEPLOY.md).

### 4. Käynnistä

```bash
npm start
```

Palvelin käynnistyy oletuksena osoitteeseen:

```text
http://localhost:3000
```

API health check:

```text
http://localhost:3000/api/health
```

## Testit ja tarkistukset

Aja kaikki tärkeimmät tarkistukset:

```bash
npm run check
```

Erikseen:

```bash
npm test       # Node-testit
npm run build  # JS-syntaksi + sivuston SEO/linkki/sitemap-validointi
npm run lint   # sama staattinen tarkistusketju
```

GitHub Actionsin **Quality**-workflow ajaa testit ja buildin pull requesteille sekä `main`-branchin muutoksille.

## Projektin tärkeimmät tiedostot

| Tiedosto | Tarkoitus |
| --- | --- |
| `index.html` | Pääsivu ja vanhempi frontend-rakenne |
| `site-cleanup.js` | Selkeämpi navigaatio ja UI-parannuksia |
| `next-features.js` | Kalastusnyt, tallennetut paikat, profiilit ja trendit |
| `trip-planner.js` | Lähtöajan vertailu, tuntiennuste ja suunnittelijan käyttöliittymä |
| `forecast.js` | Aikavyöhykkeet, säädatan validointi, välimuisti ja uusimman paikkavalinnan hallinta |
| `saved-places.js` | Omien paikkojen validointi ja selainkohtainen tallennus |
| `fishing-advice.js` | Testattava lajikohtainen suosituslogiikka |
| `score-calibration.js` | Käyttäjälle näytettävän kalakelipisteen kalibrointi |
| `depth-structures.js` | Syvyysdatan käsittely ja kalastusrakenteiden tunnistus |
| `server.js` | Express-palvelin ja API-reititys |
| `auth.js` | Kirjautuminen, sessiot ja rate limiting |
| `posts.js` | Saalisvirran julkaisut, kuvat, tykkäykset ja kommentit |
| `profiles.js` | Julkiset kalastajaprofiilit |
| `insights.js` | Saalisvirran viikoittaiset aggregaatit |
| `security.js` | Security headers ja rate limiter |
| `scripts/validate-site.mjs` | Sisältö-, SEO-, linkki- ja sitemap-tarkistukset |
| `tests/` | Node-testit |

## Tietosuoja ja sisältö

FastFishingin käyttäjien tarkkoja kalapaikkoja ei julkaista automaattisesti aggregaateissa. Ladattujen kuvien EXIF-GPS-metatiedot poistetaan kuvankäsittelyssä.

- [Tietosuojaseloste](https://fastfishin.com/tietosuoja.html)
- [Lähteet ja toimitusperiaatteet](https://fastfishin.com/toimitusperiaatteet.html)
- [Tietoa projektista](https://fastfishin.com/tietoa-meista.html)

## Tunnetut kehityskohteet

Avoimet tekniset ja tuoteasiat pidetään GitHub Issues -osiossa. Esimerkiksi Traficomin WFS-syvyysdatan virhetilanteiden diagnostiikka on kirjattu omaksi issuekseen, jotta rajapintariippuvuus ei jää hiljaiseksi tekniseksi velaksi.

## Commit- ja PR-käytäntö

Pidä commitin ensimmäinen rivi lyhyenä ja toiminnallisena:

```text
Fix Traficom WFS fallback
```

Jos muutos tarvitsee lisäselityksen, jätä tyhjä rivi ja kirjoita pidempi kuvaus sen alle. Tarkemmat ohjeet ovat tiedostossa [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Versiointi

FastFishing käyttää semanttista versiointia (`MAJOR.MINOR.PATCH`). Ensimmäinen koottu julkaisu on `v1.0.0`. Isommat käyttäjälle näkyvät ominaisuudet nostavat minor-version ja yhteensopimattomat muutokset major-version.

## Lisenssi

Repositoriossa ei tällä hetkellä ole erillistä avoimen lähdekoodin lisenssiä. Kaikki oikeudet säilyvät tekijällä, kunnes lisenssi lisätään erikseen.
