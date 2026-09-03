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

  // Sisältösivuilta oppaisiin johtavat vanhat linkit viedään oikealle opaskeskukselle.
  document.querySelectorAll('a[href="index.html#oppaat"], a[href="/index.html#oppaat"]').forEach(link => {
    link.setAttribute('href', 'kalastusoppaat.html');
  });

  const footerLinks = document.querySelector('.footer-links');
  if (footerLinks) {
    if (!footerLinks.querySelector('a[href="kalastusoppaat.html"]')) {
      const guides = document.createElement('a');
      guides.href = 'kalastusoppaat.html';
      guides.textContent = 'Kalastusoppaat';
      footerLinks.prepend(guides);
    }
    if (!footerLinks.querySelector('a[href="kalareissun-suunnittelu.html"]')) {
      const planner = document.createElement('a');
      planner.href = 'kalareissun-suunnittelu.html';
      planner.textContent = 'Reissusuunnittelu';
      footerLinks.prepend(planner);
    }
  }
})();
