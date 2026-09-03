// Saalisfeedin API-osoite. GitHub Pages tarjoaa staattisen frontin ja API ajetaan erikseen.
window.FASTFISH_API_BASE = "https://api.fastfishin.com";

// Uudet ominaisuudet pidetään omissa tiedostoissaan, jotta suuri index.html ei kasva entisestään.
(function loadFastFishingNext(){
  ['/next-features.css', '/site-cleanup.css', '/adsense-quality.css'].forEach(function(href){
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = href;
    document.head.appendChild(css);
  });

  window.addEventListener('load', function(){
    if (!document.querySelector('script[data-fastfishing-cleanup]')) {
      var cleanup = document.createElement('script');
      cleanup.type = 'module';
      cleanup.src = '/site-cleanup.js';
      cleanup.dataset.fastfishingCleanup = '1';
      document.body.appendChild(cleanup);
    }

    if (!document.querySelector('script[data-fastfishing-quality]')) {
      var quality = document.createElement('script');
      quality.type = 'module';
      quality.src = '/adsense-quality.js';
      quality.dataset.fastfishingQuality = '1';
      document.body.appendChild(quality);
    }

    if (!document.querySelector('script[data-fastfishing-next]')) {
      var script = document.createElement('script');
      script.type = 'module';
      script.src = '/next-features.js';
      script.dataset.fastfishingNext = '1';
      document.body.appendChild(script);
    }
  }, { once: true });
})();
