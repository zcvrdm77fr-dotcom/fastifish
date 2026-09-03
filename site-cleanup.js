const PRIMARY_PAGES = ['kelimittari', 'merikartta', 'feedi', 'oppaat'];
const SECONDARY_GROUPS = [
  { titleFi: 'Vieheet & kalat', titleEn: 'Lures & fish', pages: ['uistimet', 'kalalajit'] },
  { titleFi: 'Muu tietopankki', titleEn: 'More resources', pages: ['varusteet', 'linkit'] }
];
const PAGE_LABELS = {
  fi: { kelimittari:'Keli', merikartta:'Kartta', feedi:'Saaliit', oppaat:'Oppaat', uistimet:'Uistimet', kalalajit:'Kalalajit', varusteet:'Varusteet', linkit:'Linkit', more:'Lisää' },
  en: { kelimittari:'Conditions', merikartta:'Map', feedi:'Catches', oppaat:'Guides', uistimet:'Lures', kalalajit:'Species', varusteet:'Gear', linkit:'Links', more:'More' }
};

function currentLang() {
  return document.querySelector('.lang-btn.active')?.dataset.lang === 'en' ? 'en' : 'fi';
}

function relabelPrimaryButtons(nav) {
  const labels = PAGE_LABELS[currentLang()];
  nav.querySelectorAll('.tab-btn[data-page]').forEach(btn => {
    if (labels[btn.dataset.page]) btn.textContent = labels[btn.dataset.page];
  });
  const moreBtn = nav.querySelector('.ff-more-btn');
  if (moreBtn) moreBtn.textContent = labels.more;
  nav.querySelectorAll('.ff-more-title').forEach((title, index) => {
    const group = SECONDARY_GROUPS[index];
    if (group) title.textContent = currentLang() === 'en' ? group.titleEn : group.titleFi;
  });
}

function updateMoreActive(nav) {
  const more = nav.querySelector('.ff-more-btn');
  if (!more) return;
  const secondaryActive = SECONDARY_GROUPS
    .flatMap(group => group.pages)
    .some(page => nav.querySelector(`.tab-btn[data-page="${page}"]`)?.classList.contains('active'));
  more.classList.toggle('active', secondaryActive);
}

function simplifyDesktopNav() {
  const nav = document.getElementById('navTabs');
  if (!nav || nav.dataset.ffSimplified === '1') return;
  const moreWrap = nav.querySelector('.ff-more-wrap');
  const moreBtn = moreWrap?.querySelector('.ff-more-btn');
  const menu = moreWrap?.querySelector('.ff-more-menu');
  if (!moreBtn || !menu) return;
  nav.dataset.ffSimplified = '1';

  relabelPrimaryButtons(nav);
  updateMoreActive(nav);
  moreBtn.addEventListener('click', event => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    moreBtn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  menu.addEventListener('click', event => event.stopPropagation());
  menu.querySelectorAll('.tab-btn[data-page]').forEach(btn => btn.addEventListener('click', () => {
    menu.hidden = true;
    moreBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => updateMoreActive(nav), 0);
  }));
  document.addEventListener('click', () => {
    menu.hidden = true;
    moreBtn.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      menu.hidden = true;
      moreBtn.setAttribute('aria-expanded', 'false');
    }
  });

  const activeObserver = new MutationObserver(() => updateMoreActive(nav));
  nav.querySelectorAll('.tab-btn[data-page]').forEach(btn => activeObserver.observe(btn, { attributes:true, attributeFilter:['class'] }));
}

function secondaryButton(page) {
  return document.querySelector(`#navTabs .tab-btn[data-page="${page}"]`);
}

function mobileMoreSheet() {
  let backdrop = document.getElementById('ffMobileMoreBackdrop');
  if (backdrop) return backdrop;

  backdrop = document.createElement('div');
  backdrop.id = 'ffMobileMoreBackdrop';
  backdrop.className = 'ff-mobile-more-backdrop';
  backdrop.hidden = true;
  backdrop.innerHTML = '<div class="ff-mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Lisää FastFishingin toimintoja"><div class="ff-mobile-more-head"><strong>Lisää</strong><button type="button" class="ff-mobile-more-close" aria-label="Sulje">×</button></div><div class="ff-mobile-more-content"></div></div>';
  document.body.appendChild(backdrop);

  const content = backdrop.querySelector('.ff-mobile-more-content');
  SECONDARY_GROUPS.forEach(group => {
    const section = document.createElement('section');
    section.className = 'ff-mobile-more-group';
    section.innerHTML = `<div class="ff-mobile-more-title"></div><div class="ff-mobile-more-grid"></div>`;
    const grid = section.querySelector('.ff-mobile-more-grid');
    group.pages.forEach(page => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ff-mobile-more-link';
      button.dataset.page = page;
      button.addEventListener('click', () => {
        backdrop.hidden = true;
        document.body.classList.remove('ff-menu-open');
        secondaryButton(page)?.click();
      });
      grid.appendChild(button);
    });
    content.appendChild(section);
  });

  const close = () => {
    backdrop.hidden = true;
    document.body.classList.remove('ff-menu-open');
  };
  backdrop.querySelector('.ff-mobile-more-close').addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  return backdrop;
}

function relabelMobileMore() {
  const backdrop = document.getElementById('ffMobileMoreBackdrop');
  if (!backdrop) return;
  const lang = currentLang();
  const labels = PAGE_LABELS[lang];
  backdrop.querySelector('.ff-mobile-more-head strong').textContent = labels.more;
  backdrop.querySelectorAll('.ff-mobile-more-group').forEach((section, index) => {
    const group = SECONDARY_GROUPS[index];
    section.querySelector('.ff-mobile-more-title').textContent = lang === 'en' ? group.titleEn : group.titleFi;
  });
  backdrop.querySelectorAll('.ff-mobile-more-link').forEach(btn => {
    btn.textContent = labels[btn.dataset.page] || btn.dataset.page;
  });
}

function simplifyMobileNav() {
  const nav = document.getElementById('mobileBottomNav');
  if (!nav || nav.dataset.ffSimplified === '1') return;
  nav.dataset.ffSimplified = '1';

  const keep = ['kelimittari', 'merikartta', 'feedi', 'oppaat'];
  [...nav.querySelectorAll('.mobile-nav-item')].forEach(btn => {
    if (!keep.includes(btn.dataset.page)) btn.remove();
  });
  keep.forEach(page => {
    const btn = nav.querySelector(`.mobile-nav-item[data-page="${page}"]`);
    if (btn) nav.appendChild(btn);
  });

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'mobile-nav-item ff-mobile-more-trigger';
  more.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="5" cy="12" r="1" fill="currentColor"></circle><circle cx="12" cy="12" r="1" fill="currentColor"></circle><circle cx="19" cy="12" r="1" fill="currentColor"></circle></svg><span class="m-nav-label">Lisää</span>';
  more.addEventListener('click', () => {
    const sheet = mobileMoreSheet();
    relabelMobileMore();
    sheet.hidden = false;
    document.body.classList.add('ff-menu-open');
  });
  nav.appendChild(more);

  const labels = PAGE_LABELS[currentLang()];
  nav.querySelectorAll('.mobile-nav-item[data-page]').forEach(btn => {
    const label = btn.querySelector('.m-nav-label');
    if (label && labels[btn.dataset.page]) label.textContent = labels[btn.dataset.page];
  });
  more.querySelector('.m-nav-label').textContent = labels.more;
}

function cleanScoreCopy() {
  const fi = currentLang() === 'fi';
  const dailyTitle = document.getElementById('dailyForecastTitle');
  const dailySub = document.getElementById('dailyForecastSub');
  if (dailyTitle) dailyTitle.textContent = fi ? '7 vuorokauden kalakeliennuste' : '7-day fishing conditions';
  if (dailySub) dailySub.textContent = fi ? 'Valitse päivä nähdäksesi tuntikohtaiset kalakelipisteet' : 'Choose a day to see hourly fishing-condition scores';

  const lead = document.querySelector('.hero-copy .lead');
  if (lead) {
    lead.textContent = fi
      ? 'Yksi sivu, josta näet nopeasti kalakelin, parhaat kalastusajat ja millä vieheellä kannattaa aloittaa.'
      : 'One place for fishing conditions, the best time windows and a practical lure to start with.';
  }

  const gauge = document.querySelector('#kelimittari .gauge-card');
  if (gauge && !gauge.querySelector('.ff-score-explainer')) {
    const note = document.createElement('p');
    note.className = 'ff-score-explainer';
    gauge.appendChild(note);
  }
  const note = gauge?.querySelector('.ff-score-explainer');
  if (note) note.textContent = fi
    ? 'Kalakelipiste · ei prosenttiluku eikä saalistodennäköisyys.'
    : 'Fishing-condition score · not a percentage or catch probability.';
}

function refreshLanguageDependentUi() {
  const nav = document.getElementById('navTabs');
  if (nav) relabelPrimaryButtons(nav);
  simplifyMobileNav();
  relabelMobileMore();
  cleanScoreCopy();
}

function init() {
  simplifyDesktopNav();
  cleanScoreCopy();
  simplifyMobileNav();

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(refreshLanguageDependentUi, 0));
  });

  const bodyObserver = new MutationObserver(() => simplifyMobileNav());
  bodyObserver.observe(document.body, { childList:true, subtree:false });
}

init();
