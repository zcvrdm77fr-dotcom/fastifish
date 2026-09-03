# Contributing to FastFishing

Kiitos kiinnostuksesta FastFishingin kehitykseen.

## Kehityshaara

Tee muutokset omassa branchissa ja avaa pull request `main`-branchiin. Pidä yksi PR mahdollisimman selkeästi yhden kokonaisuuden ympärillä.

## Ennen pull requestia

Aja:

```bash
npm run check
```

PR:n pitää läpäistä GitHub Actionsin **Quality**-workflow.

## Commit-viestit

Commitin ensimmäinen rivi on lyhyt yhteenveto muutoksesta.

Suositus:

- tavoite alle 50 merkkiä
- käytä käskymuotoista tai selkeää toimintaverbiä
- älä tunge yksityiskohtia otsikkoriville
- jätä tyhjä rivi ennen mahdollista pidempää selostusta

Hyvä:

```text
Fix Traficom WFS fallback

Log the failed WFS version and layer separately from an empty data response.
```

Huonompi:

```text
Fix Traficom WFS fallback and improve all diagnostics and add support for multiple layers and update documentation
```

## Pull requestin otsikko

Pidä myös PR-otsikko lyhyenä, koska squash-mergessä siitä tulee yleensä `main`-branchin commit-otsikko.

Hyvä esimerkki:

```text
Improve repository docs
```

## Koodi

- pidä uudet ominaisuudet mahdollisuuksien mukaan omissa moduuleissaan
- lisää testattavalle laskentalogiikalle testit
- älä lisää salaisuuksia tai tuotannon `.env`-arvoja repoon
- huomioi kalapaikkoihin ja käyttäjien kuviin liittyvä yksityisyys
- viralliset lupa-, rajoitus- ja turvallisuusväitteet pitää pystyä jäljittämään ensisijaiseen lähteeseen

## Frontend

`index.html` on historiallisista syistä suuri. Uudet ominaisuudet kannattaa ensisijaisesti toteuttaa erillisinä JS/CSS-moduuleina sen sijaan, että tiedostoa kasvatetaan lisää.

## Issues

Tunnettu bugi, rajapintariippuvuus tai tekninen velka kirjataan issueksi. Issueen kannattaa lisätä ainakin:

- nykyinen käyttäytyminen
- odotettu käyttäytyminen
- tapa toistaa ongelma
- mahdollinen ulkoinen rajapinta tai riippuvuus
- selkeä "valmis kun" -määritelmä
