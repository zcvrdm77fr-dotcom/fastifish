# Saalisfeedin käyttöönotto

## Miksi feedi ei toiminut

Sivusto `fastfishin.com` on GitHub Pagesissa. GitHub Pages osaa tarjoilla vain valmiita
tiedostoja — HTML:ää, CSS:ää ja kuvia. Se **ei voi ajaa `server.js`:ää**, tallentaa
käyttäjätilejä eikä ottaa vastaan lähetettyjä kuvia.

Kirjautumislomake näkyi sivulla, koska se on tavallista HTML:ää. Kun sitä painoi, selain
lähetti pyynnön osoitteeseen `fastfishin.com/api/auth/login`, jossa ei ole palvelinta —
GitHub Pages vastasi 404-sivullaan, ja lomake näytti virheen "Jokin meni pieleen".
Sama koski kuvien julkaisua ja saaliiden listausta.

Koodissa ei siis ollut vikaa. Palvelinosa täytyy vain ajaa jossain, ja sivustolle pitää
kertoa sen osoite. Se tehdään näin.

---

## Vaihe 1: julkaise palvelin

Palvelin tarvitsee **pysyvän levyn**, koska käyttäjätilit (SQLite-tietokanta) ja saaliskuvat
tallennetaan tiedostoina. Ilman levyä kaikki katoaisi aina kun palvelu käynnistyy uudelleen.

### Renderillä (helpoin — `render.yaml` on valmiina)

1. Luo tili osoitteessa <https://render.com> ja yhdistä GitHub-tilisi.
2. **New → Blueprint** → valitse tämä repo. Render lukee `render.yaml`:n ja luo palvelun,
   1 Gt pysyvän levyn ja ympäristömuuttujat automaattisesti.
3. Odota että ensimmäinen julkaisu valmistuu (natiivipakettien kääntäminen kestää ~5–10 min).
4. Kopioi palvelun osoite, esim. `https://fastfishing-api.onrender.com`.

Huom: pysyvä levy on Renderin maksullinen ominaisuus (muutama euro/kk). Ilmaisella tasolla
levyä ei voi liittää, jolloin tilit ja kuvat häviäisivät — feediä ei kannata ajaa niin.

### Muut vaihtoehdot

Mukana on tavallinen `Dockerfile`, joten palvelin toimii myös Fly.io:ssa, Railwayssä,
Hetznerillä tai omalla VPS:llä. Liitä pysyvä levy polkuun `/var/data` ja aseta samat
ympäristömuuttujat kuin alla.

### Ympäristömuuttujat

| Muuttuja | Arvo | Selitys |
|---|---|---|
| `DATA_DIR` | `/var/data` | Mihin tietokanta ja kuvat tallennetaan (pysyvä levy). |
| `ALLOWED_ORIGINS` | `https://fastfishin.com,https://www.fastfishin.com` | Osoitteet, joista selain saa kutsua APIa. Ilman tätä selain estää kaikki pyynnöt. |
| `CROSS_SITE_COOKIES` | `1` | Aseta kun sivusto ja API ovat eri osoitteissa. |
| `NODE_ENV` | `production` | |
| `PORT` | (alusta asettaa) | Älä aseta itse pilvipalvelussa. |
| `ADMIN_USERNAMES` | esim. `oma-kayttajanimi` | Valinnainen. Pilkulla erotetut käyttäjänimet, joilla on oikeus poistaa KENEN TAHANSA saalisjulkaisu ja -kommentti (ei vain omiaan). Ilman tätä kukaan ei voi siivota muiden julkaisemaa asiatonta sisältöä paitsi julkaisijat itse. |

Tarkista lopuksi selaimella, että `https://<palvelimesi-osoite>/api/health` vastaa
`{"ok":true,"feed":true}`.

### Ylläpitäjän oikeudet (ADMIN_USERNAMES)

`ADMIN_USERNAMES` ei ole tietokantaan tallennettu rooli, vaan pelkkä ympäristömuuttuja, joka
luetaan palvelimen käynnistyessä. Näin otat sen käyttöön Renderissä (muilla alustoilla vastaava
"Environment"-välilehti):

1. Luo itsellesi tavallinen käyttäjätili saalisfeediin (jos ei jo ole).
2. Render → palvelusi → **Environment** → **Add Environment Variable**.
3. Key: `ADMIN_USERNAMES`, Value: käyttäjänimesi (esim. `jake82`). Useampi ylläpitäjä pilkulla
   erotettuna: `jake82,toinennimi`.
4. Tallenna — Render käynnistää palvelun uudelleen automaattisesti.
5. Kirjaudu sisään samalla käyttäjänimellä. Näet nyt "Poista"-napin kaikkien käyttäjien
   julkaisuissa ja kommenteissa, et vain omissasi.

---

## Vaihe 2: kerro osoite sivustolle

Avaa `feed-config.js` ja kirjoita palvelimen osoite:

```js
window.FASTFISH_API_BASE = "https://fastfishing-api.onrender.com";
```

Ei kauttaviivaa loppuun. Committaa ja pushaa — GitHub Pages julkaisee muutoksen
noin minuutissa, ja saalisfeedi alkaa toimia.

Jos kenttä jätetään tyhjäksi, sivusto näyttää saaliit-osiossa selkeän viestin siitä, ettei
palvelinta ole vielä otettu käyttöön, kirjautumislomakkeen sijaan.

---

## Suositus: käytä omaa alidomainia

Paras vaihtoehto on osoittaa esim. `api.fastfishin.com` palvelimelle ja käyttää sitä:

```js
window.FASTFISH_API_BASE = "https://api.fastfishin.com";
```

Silloin sivusto ja API ovat saman verkkotunnuksen alla, jolloin selaimet käsittelevät
istuntoa normaalina evästeenä. Renderissä alidomain lisätään kohdassa *Settings → Custom
Domains*, ja verkkotunnuksen DNS-asetuksiin tulee Renderin antama CNAME-tietue.

Kirjautuminen toimii kuitenkin myös eri verkkotunnuksesta: palvelin palauttaa istuntotunnuksen
myös vastauksen rungossa, ja sivusto lähettää sen `Authorization`-otsakkeessa. Näin kirjautuminen
säilyy myös Safarissa ja Firefoxissa, jotka estävät kolmannen osapuolen evästeet oletuksena.

---

## Paikallinen ajo

```bash
npm install
npm start
```

Avaa <http://localhost:3000>. Paikallisesti `feed-config.js` saa jäädä tyhjäksi, koska sivusto
ja API ovat samassa osoitteessa. Tietokanta ja kuvat menevät `data/`-kansioon (git-ignoroitu).

---

## Sisällöntarkistus

Kuvat tarkistetaan `nsfwjs`-mallilla ja tekstit sanalistalla (`wordlist.js`). Malli ladataan
verkosta ensimmäisellä julkaisukerralla, joten palvelimella pitää olla ulospäin toimiva
verkkoyhteys. Jos tarkistus ei onnistu, julkaisu **hylätään** eikä päästetä läpi
tarkistamattomana — käyttäjä saa viestin "Sisällöntarkistus ei ole juuri nyt käytettävissä".

Ensimmäinen julkaisu kestää tavallista pidempään (~10–20 s), koska malli ladataan silloin
kerran muistiin.
