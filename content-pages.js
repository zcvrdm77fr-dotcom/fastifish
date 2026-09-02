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

  function getConsent() {
    try {
      const match = document.cookie.match(/(?:^|; )cookie_consent=([^;]*)/);
      return match ? decodeURIComponent(match[1]) : localStorage.getItem('cookie_consent');
    } catch (error) {
      return null;
    }
  }

  function storeConsent(value) {
    try { localStorage.setItem('cookie_consent', value); } catch (error) {}
    document.cookie = `cookie_consent=${encodeURIComponent(value)};path=/;max-age=31536000;SameSite=Lax`;
  }

  const banner = document.getElementById('cookieConsentBanner');
  if (banner && !getConsent()) banner.hidden = false;

  document.getElementById('cookieAcceptBtn')?.addEventListener('click', () => {
    storeConsent('all');
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted'
      });
    }
    if (banner) banner.hidden = true;
  });

  document.getElementById('cookieDeclineBtn')?.addEventListener('click', () => {
    storeConsent('min');
    if (banner) banner.hidden = true;
  });
})();

