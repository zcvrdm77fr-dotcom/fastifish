# Contributing to FastFishing

Kiitos kiinnostuksesta FastFishingin kehitykseen.

## Branch-strategia: GitHub Flow

`main` on julkaistava ja tarkoituksella vakaa branch. Normaali muutoskulku on:

1. tee lyhyt feature/fix/chore-branch `main`ista
2. tee yksi selkeä kokonaisuus
3. avaa pull request `main`iin
4. odota **Quality**-workflow vihreäksi
5. squash-mergeä lyhyellä commit-otsikolla
6. älä pushaa tarkoituksella keskeneräistä ominaisuutta suoraan `main`iin

Pitkäikäisiä `develop`/release-brancheja ei käytetä. Pienelle projektille GitHub Flow pitää tuotantopolun yksinkertaisena.

## Ennen pull requestia

Aja:

```bash
npm run check
```

PR:n pitää läpäistä GitHub Actionsin **Quality**-workflow. Workflow tarkistaa JavaScript-syntaksin, testit, coverage-raportin sekä sivuston build/SEO/linkkivalidoinnin.

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
- tee skeemamuutokset versionoidulla `schema_migrations`-migraatiolla
- async Express -reitit pitää kääriä `asyncHandler`iin, jotta virheet päätyvät keskitettyyn error handleriin

## Frontend

`index.html` on historiallisista syistä suuri. Uudet ominaisuudet kannattaa ensisijaisesti toteuttaa erillisinä JS/CSS-moduuleina sen sijaan, että tiedostoa kasvatetaan lisää.

## Issues

Tunnettu bugi, rajapintariippuvuus tai tekninen velka kirjataan issueksi. Issueen kannattaa lisätä ainakin:

- nykyinen käyttäytyminen
- odotettu käyttäytyminen
- tapa toistaa ongelma
- mahdollinen ulkoinen rajapinta tai riippuvuus
- selkeä "valmis kun" -määritelmä
