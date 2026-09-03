function injectTrustStrip(){
  const intro = document.querySelector('.site-intro');
  if (!intro || document.getElementById('ffTrustStrip')) return;

  const section = document.createElement('section');
  section.id = 'ffTrustStrip';
  section.className = 'shell ff-trust-strip';
  section.setAttribute('aria-label', 'FastFishingin sisältö ja luotettavuus');
  section.innerHTML = `
    <div class="ff-trust-copy">
      <strong>FastFishingin sisältö, lähteet ja tekijä</strong>
      <span>Katso oppaat yhdestä paikasta tai tarkista, miten sisältö ja kalakelipisteet tehdään.</span>
    </div>
    <nav class="ff-trust-links" aria-label="Sisältö ja luotettavuus">
      <a href="kalastusoppaat.html">Kalastusoppaat</a>
      <a href="metodologia.html">Metodologia</a>
      <a href="tietoa-meista.html" rel="author">Kuka tekee?</a>
      <a href="toimitusperiaatteet.html">Lähteet</a>
      <a href="tietosuoja.html">Tietosuoja</a>
    </nav>`;
  intro.insertAdjacentElement('afterend', section);
}

function injectGuideHub(){
  const guides = document.getElementById('oppaat');
  if (!guides || document.getElementById('ffGuideHubCallout')) return;
  const head = guides.querySelector('.section-head');
  const card = document.createElement('aside');
  card.id = 'ffGuideHubCallout';
  card.className = 'ff-guide-hub-callout';
  card.innerHTML = `
    <div>
      <span class="ff-guide-hub-kicker">Aloita tästä</span>
      <h3>Kaikki kalastusoppaat selkeästi yhdessä paikassa</h3>
      <p>Valitse tavoitekala, tekniikka tai vieheongelma. Oppaiden etusivu kertoo suoraan, mikä sisältö kannattaa avata ensin.</p>
    </div>
    <div class="ff-guide-hub-actions">
      <a class="btn primary" href="kalastusoppaat.html">Avaa Kalastusoppaat</a>
      <a class="btn" href="vieheen-valinta.html">Vieheen valinta</a>
      <a class="btn" href="jigikalastus.html">Jigikalastus</a>
    </div>`;
  if (head) head.insertAdjacentElement('afterend', card);
  else guides.prepend(card);
}

function strengthenFooter(){
  const footer = document.querySelector('body > footer, footer');
  if (!footer || document.getElementById('ffEditorialFooter')) return;
  const block = document.createElement('div');
  block.id = 'ffEditorialFooter';
  block.className = 'ff-editorial-footer';
  block.innerHTML = `
    <strong>FastFishing on yhden harrastuskalastajan ylläpitämä riippumaton palvelu.</strong>
    <span>Kalakelipiste on suuntaa-antava heuristiikka, ei saalistakuu.</span>
    <span class="ff-editorial-footer-links">
      <a href="kalastusoppaat.html">Oppaat</a>
      <a href="tietoa-meista.html" rel="author">Tekijä</a>
      <a href="toimitusperiaatteet.html">Toimitusperiaatteet</a>
      <a href="metodologia.html">Metodologia</a>
      <a href="tietosuoja.html">Tietosuoja</a>
    </span>`;
  footer.prepend(block);
}

function init(){
  injectTrustStrip();
  injectGuideHub();
  strengthenFooter();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();
