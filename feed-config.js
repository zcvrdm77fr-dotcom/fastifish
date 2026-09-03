// Saalisfeedin API-osoite. GitHub Pages tarjoaa staattisen frontin ja API ajetaan erikseen.
window.FASTFISH_API_BASE = "https://api.fastfishin.com";

// Uudet ominaisuudet pidetään omissa tiedostoissaan, jotta suuri index.html ei kasva entisestään.
(function loadFastFishingNext(){
  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/next-features.css';
  document.head.appendChild(css);

  window.addEventListener('load', function(){
    if (document.querySelector('script[data-fastfishing-next]')) return;
    var script = document.createElement('script');
    script.type = 'module';
    script.src = '/next-features.js';
    script.dataset.fastfishingNext = '1';
    document.body.appendChild(script);
  }, { once: true });
})();
