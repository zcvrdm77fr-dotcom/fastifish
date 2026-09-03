# FastFishingin tuotantodeploy

FastFishingin frontend julkaistaan GitHub Pagesissa osoitteessa `https://fastfishin.com`.
API ajetaan Oracle Cloud -virtuaalikoneella osoitteessa `https://api.fastfishin.com`.

API käyttää SQLite-tietokantaa ja paikallisia kuvatiedostoja, joten tuotannon data pitää aina
säilyttää pysyvällä levyllä. Nykyisessä Oracle-asennuksessa hostin hakemisto
`/opt/fastfish-data` mountataan containeriin polkuun `/data`.

## Oracle Cloud -deploy Dockerilla

Aja komennot Oracle VM:llä repositorion hakemistossa.

```bash
git fetch origin
git checkout main
git pull --ff-only origin main

git rev-parse --short HEAD
sudo docker build --pull -t fastfish .
```

Tarkista ennen vanhan containerin poistamista sen asetukset:

```bash
sudo docker inspect fastfish \
  --format 'ENV={{json .Config.Env}} MOUNTS={{json .Mounts}} PORTS={{json .HostConfig.PortBindings}} RESTART={{json .HostConfig.RestartPolicy}}'
```

Nykyisen tuotantoasennuksen olennaiset asetukset ovat:

- container: `fastfish`
- image: `fastfish`
- host-portti: `3000`
- persistent data: `/opt/fastfish-data:/data`
- restart policy: `unless-stopped`

Kun uusi image on rakennettu onnistuneesti:

```bash
sudo docker stop fastfish
sudo docker rm fastfish

sudo docker run -d \
  --name fastfish \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATA_DIR=/data \
  -e SERVE_FRONTEND=0 \
  -e ALLOWED_ORIGINS=https://fastfishin.com,https://www.fastfishin.com \
  -e ADMIN_USERNAMES=<ADMINIT_PILKULLA_EROTELTUNA> \
  -e BACKUP_INTERVAL_HOURS=24 \
  -e BACKUP_LOCAL_RETENTION=7 \
  -p 3000:3000 \
  -v /opt/fastfish-data:/data \
  fastfish
```

Älä poista `/opt/fastfish-data`-hakemistoa deployn yhteydessä. Siellä ovat SQLite-data,
saaliskuvat ja paikalliset backupit.

`CROSS_SITE_COOKIES`-asetusta ei käytetä enää. FastFishingin istunto käyttää
`api.fastfishin.com`-hostin HttpOnly-, Secure- ja SameSite=Lax-cookiea, eikä bearer-tokenia
palauteta selaimen JavaScriptille.

## Tuotannon ympäristömuuttujat

| Muuttuja | Tuotantoarvo / esimerkki | Selitys |
|---|---|---|
| `NODE_ENV` | `production` | Aktivoi tuotantovalidoinnit ja Secure-cookien. |
| `PORT` | `3000` | Express-palvelimen sisäinen portti. |
| `DATA_DIR` | `/data` | SQLite, kuvat ja paikalliset backupit containerissa. |
| `SERVE_FRONTEND` | `0` | Oracle API ei tarjoile repositorion frontend-lähteitä. |
| `ALLOWED_ORIGINS` | `https://fastfishin.com,https://www.fastfishin.com` | Sallitut selain-origin-osoitteet. |
| `ADMIN_USERNAMES` | käyttäjänimet pilkulla eroteltuna | FastFishing-adminit. |
| `BACKUP_INTERVAL_HOURS` | `24` | Paikallisen SQLite-snapshotin väli. |
| `BACKUP_LOCAL_RETENTION` | `7` | Säilytettävien paikallisten backupien määrä. |

Valinnainen S3-yhteensopiva offsite-backup käyttää lisäksi:

```text
BACKUP_S3_ENDPOINT
BACKUP_S3_BUCKET
BACKUP_S3_REGION
BACKUP_S3_ACCESS_KEY_ID
BACKUP_S3_SECRET_ACCESS_KEY
BACKUP_S3_PREFIX
```

Offsite-backupia ei pidä merkitä valmiiksi ennen kuin kohde on oikeasti konfiguroitu ja
palautus on testattu käytännössä.

## Deployn tarkistus

Tarkista ensin container:

```bash
sudo docker ps
sudo docker logs --tail 100 fastfish
```

Tarkista API paikallisesti Oracle VM:ltä:

```bash
curl http://127.0.0.1:3000/api/health
```

Ja lopuksi julkisen reverse proxyn kautta:

```bash
curl https://api.fastfishin.com/api/health
```

Nykyisen version health-vastauksessa pitää näkyä vähintään:

```json
{
  "ok": true,
  "postMetadata": true,
  "cookieOnlySessions": true,
  "schemaVersion": 4
}
```

GitHub Actionsin `Production health` tarkistaa saman julkisen endpointin tunnin välein ja
myös `main`-pushien jälkeen.

## Jos `git pull --ff-only` ei onnistu

Jos Oracle VM:llä on paikallisia muutoksia, älä aja suoraan `git reset --hard`.
Vanhemmalla Git-versiolla turvallinen tapa on:

```bash
git status --short
git stash save -u "oracle-before-deploy"
git pull --ff-only origin main
```

Älä palauta stashia automaattisesti uuden tuotantokoodin päälle. Tarkista ensin mitä siellä oli:

```bash
git stash list
git stash show --stat stash@{0}
git stash show -p stash@{0}
```

## Paikallinen kehitys

```bash
npm install
npm start
```

Paikallisesti API voi käyttää oletushakemistoa `./data` ja frontend voidaan tarjoilla samasta
Express-palvelimesta. Tuotannossa frontend tulee GitHub Pagesista ja Oracle-containerissa
`SERVE_FRONTEND=0`.
