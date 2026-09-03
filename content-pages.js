(function () {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');

  function storeTheme(theme) {
    try { localStorage.setItem('color_theme', theme); } catch (error) {}
    document.cookie = `color_theme=${encodeURIComponent(theme)};path=/;max-age=31536000;SameSite=Lax`;
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      storeTheme(next);
    });
  }

  // Mainos- ja analytiikkasuostumus kuuluu Google-certified CMP:lle.
  // Sisältösivut eivät enää lue, kirjoita tai näytä FastFishingin vanhaa suostumustilaa.

  // Sisältösivuilta oppaisiin johtavat linkit viedään nyt oikealle opaskeskukselle
  // eikä takaisin suuren etusivun yksittäiseen SPA-osioon.
  document.querySelectorAll('a[href="index.html#oppaat"], a[href="/index.html#oppaat"]').forEach(link => {
    link.setAttribute('href', 'kalastusoppaat.html');
  });

  const footerLinks = document.querySelector('.footer-links');
  if (footerLinks && !footerLinks.querySelector('a[href="kalastusoppaat.html"]')) {
    const guides = document.createElement('a');
    guides.href = 'kalastusoppaat.html';
    guides.textContent = 'Kalastusoppaat';
    footerLinks.prepend(guides);
  }

  // 3.9.2026 alkaen käyttäjälle näytettävä asteikko puristaa heuristiikan ääripäitä.
  // Raakalaskenta säilyy dokumentoituna, jotta vertailu ja lajipainot ovat läpinäkyviä.
  if (location.pathname.endsWith('/metodologia.html') || location.pathname.endsWith('metodologia.html')) {
    const lead = document.querySelector('.hero .lead');
    if (lead) {
      lead.textContent = 'FastFishing ei esitä pisteitä tieteellisenä ennusteena eikä saalistakuuna. Säästä lasketaan ensin avoimesti dokumentoitu raakapiste, minkä jälkeen näytettävän asteikon ääripäitä kalibroidaan maltillisesti. Vanha teoreettinen 100/100 vastaa nykyisessä näkymässä noin 91/100 pistettä.';
    }

    const weights = document.getElementById('painot');
    if (weights && !document.getElementById('scoreCalibrationNote')) {
      const note = document.createElement('div');
      note.id = 'scoreCalibrationNote';
      note.className = 'note';
      note.innerHTML = '<strong>Näytettävä piste kalibroidaan vielä raakapisteen jälkeen.</strong> Hyvien ja huonojen tuntien järjestys ei muutu, mutta ääripäitä puristetaan, jotta 100/100 ei näyttäisi saalistodennäköisyydeltä. Raakapiste 100 näkyy noin 91 pisteenä ja 90+ on tarkoituksella harvinainen tulos.';
      weights.appendChild(note);
    }

    document.querySelectorAll('#esimerkki p').forEach(p => {
      if (p.textContent.includes('Lopputulos on siis') && p.textContent.includes('92 pistettä')) {
        p.innerHTML = 'Ahvenen ehdot täyttyvät tuulen (+6), pilvisyyden (+5) ja lämpötilan (+4) osalta. Lajikorjaus on <code>pyöristys((6+5+4)×0,60) = 9</code>. Raakapiste on siis <strong>92</strong>, joka näkyy kalibroidulla asteikolla noin <strong>84/100</strong>.';
      }
    });
  }
})();
