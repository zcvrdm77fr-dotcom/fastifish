(function () {
  const root = document.documentElement;
  const buttons = [
    document.getElementById('themeToggle'),
    document.getElementById('themeToggleFab')
  ].filter(Boolean);

  if (!buttons.length) return;

  function storeTheme(theme) {
    try { localStorage.setItem('color_theme', theme); } catch (error) {}
    try {
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      document.cookie = `color_theme=${encodeURIComponent(theme)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    } catch (error) {}
  }

  for (const button of buttons) {
    if (button.dataset.fastFishingThemeBound === '1') continue;
    button.dataset.fastFishingThemeBound = '1';
    button.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      storeTheme(next);
    });
  }
})();
