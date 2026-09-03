# FastFishing API:n käyttöönotto

FastFishingin frontend on GitHub Pagesissa (`https://fastfishin.com`) ja API erillisessä palvelussa (`https://api.fastfishin.com`). GitHub Pages ei aja Node-palvelinta eikä tallenna käyttäjiä, joten kirjautuminen, saaliskuvat, kommentit ja profiilit tarvitsevat `server.js`:n sekä pysyvän levyn.

## Render

Repo sisältää `render.yaml`:n ja `Dockerfile`:n.

1. Render → **New → Blueprint** → valitse tämä repo.
2. Liitä palvelulle pysyvä levy polkuun `/var/data`.
3. Lisää `ADMIN_USERNAMES` Renderin Environment-näkymässä tarvittaessa.
4. Osoita `api.fastfishin.com` Render-palveluun ja pidä `feed-config.js`:n API-base samana.
5. Tarkista deployn jälkeen `https://api.fastfishin.com/api/health`.

Tuotantokontti käynnistyy rootina vain persistent diskin oikeuksien varmistamiseksi ja pudottaa sen jälkeen prosessin `node`-käyttäjälle `gosu`:lla. API ei tuotannossa tarjoa repositorion juuritiedostoja staattisina tiedostoina.

## Ympäristömuuttujat

| Muuttuja | Esimerkki | Selitys |
|---|---|---|
| `DATA_DIR` | `/var/data` | SQLite, kuvat ja paikalliset backupit. |
| `ALLOWED_ORIGINS` | `https://fastfishin.com,https://www.fastfishin.com` | Sallitut selain-origin-osoitteet. Tuotannossa pakollinen ja HTTPS. |
| `SERVE_FRONTEND` | `0` | API-palvelin ei tarjoile GitHub Pages -fronttia. |
| `NODE_ENV` | `production` | Ottaa tuotannon cookie- ja config-suojaukset käyttöön. |
| `ADMIN_USERNAMES` | `oma-kayttajanimi` | Valinnainen ylläpitäjälista pilkulla erotettuna. |
| `BACKUP_INTERVAL_HOURS` | `24` | Paikallisen SQLite-snapshotin väli. |
| `BACKUP_LOCAL_RETENTION` | `7` | Kuinka monta paikallista DB-snapshotia säilytetään. |

## Istunnot

Selain saa kirjautuessa vain `HttpOnly`, `Secure` (tuotannossa), `SameSite=Lax` -session cookien API-hostilta. Sessio-tokenia ei palauteta JSONissa eikä tallenneta `localStorage`en. Tietokantaan tallennetaan vain tokenin SHA-256-digest.

`fastfishin.com` ja `api.fastfishin.com` ovat saman site-kokonaisuuden HTTPS-alidomaineja. Frontend käyttää API-kutsuissa `credentials: 'include'`, ja CORS sallii vain määritellyt originit.

Vanha `ff_session_token` poistetaan selaimen localStoragesta uuden frontendin latautuessa. Käyttäjä, jolla ei ole enää kelvollista API-cookiea, joutuu kirjautumaan kerran uudelleen.

## Saalisfeedin metadata

Postauksen valinnaiset kentät kulkevat koko ketjun läpi:

- kalalaji
- paino
- pituus
- viehe / syötti
- saantipaikka

Saantipaikka tallennetaan vain, jos käyttäjä valitsee erikseen **Näytä saantipaikka julkisesti postauksessa**. Muut kentät näkyvät postauksen metadatassa, kun ne on täytetty.

CI:n HTTP-integraatiotesti luo oikean testipostauksen ja varmistaa, että nämä kentät säilyvät POST → SQLite → GET feed -kierroksen yli. `/api/health` palauttaa lisäksi `postMetadata: true` vain kun tuotannon skeemassa ovat kaikki tarvittavat sarakkeet.

## Backupit

Palvelin ottaa SQLite Online Backup API:lla paikallisen snapshotin oletuksena kerran vuorokaudessa ja säilyttää seitsemän uusinta tiedostoa `/var/data/backups`-hakemistossa.

Offsite-varmistus voidaan ottaa käyttöön S3-yhteensopivaan object storageen, kuten Cloudflare R2:een, asettamalla Renderin secretteinä:

```text
BACKUP_S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
BACKUP_S3_BUCKET=fastfishing-backups
BACKUP_S3_REGION=auto
BACKUP_S3_ACCESS_KEY_ID=...
BACKUP_S3_SECRET_ACCESS_KEY=...
BACKUP_S3_PREFIX=fastfishing
```

Kun nämä ovat käytössä, jokainen backup-kierros lähettää DB-snapshotin, uudet/muuttuneet saaliskuvat sekä `latest.json`-manifestin offsite-kohteeseen. `/api/health` näyttää backupin tilan ja viimeisimmän onnistumisajan ilman salaisuuksia.

Offsite-backup kannattaa testata käytännössä palauttamalla snapshot erilliseen testiympäristöön. Pelkkä backupin olemassaolo ei ole palautustesti.

## Health check

`GET /api/health` tarkistaa ainakin:

- SQLite-yhteyden
- versionoidun migration-skeeman
- feedin metadata-sarakkeet
- cookie-only-istuntomallin version
- failed-upload-cleanup-jonon määrän
- backupin tilan ja iän

Health palauttaa HTTP 503:n, jos DB tai feedin vaadittu skeema ei ole kunnossa. GitHub Actions tarkistaa production-healthin myös jokaisen `main`-pushin jälkeen sekä tunnin välein.

## Paikallinen ajo

```bash
npm ci
npm start
```

Avaa `http://localhost:3000`. Paikallisesti frontend tarjotaan oletuksena samasta palvelimesta ja data menee `data/`-hakemistoon.

## Sisällöntarkistus ja upload-suojaus

Kuvat tarkistetaan `nsfwjs`-mallilla ja tekstit sanalistalla. Jos moderointimalli ei ole tuotannossa käytettävissä, julkaisu hylätään fail-closed-periaatteella.

Uploadissa on lisäksi:

- Multer 2.3.0 tai uudempi lukittu versio
- tiukat multipart parts/fields/files -rajat
- 8 Mt tiedostoraja
- Sharpin 40 megapikselin input-raja
- upload-kohtainen rate limit
- epäonnistuneiden kuvanpoistojen retry-jono

## Julkaisupolku

Normaali muutos tehdään branchiin → pull request → Quality → squash merge `main`iin. Syvyysdatan automaatio tekee jatkossa oman PR:n eikä pushaa generoituja tiedostoja suoraan `main`iin.
