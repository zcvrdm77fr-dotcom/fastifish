import fs from 'node:fs';

function replaceRequired(text, search, replacement, label) {
  const next = typeof search === 'string' ? text.replace(search, replacement) : text.replace(search, replacement);
  if (next === text) throw new Error(`CMP patch failed: ${label}`);
  return next;
}

let index = fs.readFileSync('index.html', 'utf8');

index = replaceRequired(
  index,
  /<!-- Consent Mode v2:[^\n]*\n<script>\n  window\.dataLayer = window\.dataLayer \|\| \[\];[\s\S]*?  gtag\('config', 'G-WENSSGS6RJ', \{ 'anonymize_ip': true \}\);\n<\/script>/,
  `<!-- Consent Mode v2: oletuksena denied. Google-certified CMP (Privacy & messaging / IAB TCF) hallitsee mainos- ja analytiikkasuostumuksen ETA:ssa, UK:ssa ja Sveitsissä. -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'wait_for_update': 500
  });
  // Vanha FastFishingin oma mainossuostumus ei saa ohittaa Google-certified CMP:n TCF-valintaa.
  (function clearLegacyFastFishingConsent(){
    try { localStorage.removeItem('cookie_consent'); } catch(e) {}
    try { document.cookie = 'cookie_consent=; Max-Age=0; path=/; SameSite=Lax'; } catch(e) {}
  })();
  gtag('js', new Date());
  gtag('config', 'G-WENSSGS6RJ', { 'anonymize_ip': true });
</script>`,
  'index Consent Mode block'
);

index = index.replace(
  'hyväksynyt mainosevästeitä evästebannerista.',
  'antanut suostumusta Google-certified CMP:n kautta.'
);

index = index.replace(
  /<!-- AdSense-skripti EI lataudu tässä automaattisesti\.[\s\S]*?ks\. sivun lopun <script>\. -->\n/,
  ''
);

index = replaceRequired(
  index,
  '\n<div id="consentBanner" class="consent-banner hidden"></div>\n',
  '\n',
  'custom consent banner element'
);

index = replaceRequired(
  index,
  /function renderConsentBanner\(lang = currentLang\) \{[\s\S]*?\n\}\n\nfunction setLanguage/,
  `function clearLegacyConsentState() {
  try { storage.removeItem('cookie_consent'); } catch(e) {}
  try { document.cookie = 'cookie_consent=; Max-Age=0; path=/; SameSite=Lax'; } catch(e) {}
}

function renderConsentBanner() {
  // Mainos- ja analytiikkasuostumus kuuluu nyt Google-certified CMP:lle. Vanha FastFishing-banneri
  // poistetaan myös DOM:sta, jotta Googlen European regulations -viestin päälle ei tule toista dialogia.
  document.getElementById("consentBanner")?.remove();
  clearLegacyConsentState();
}

function openGooglePrivacyChoices() {
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  const showChoices = () => {
    if (typeof window.googlefc.showRevocationMessage !== 'function') return false;
    window.googlefc.showRevocationMessage();
    return true;
  };
  if (showChoices()) return;
  window.googlefc.callbackQueue.push({ CONSENT_API_READY: showChoices });
}

function setLanguage`,
  'custom consent renderer'
);

index = replaceRequired(
  index,
  "const changeConsentLabel = lang === 'fi' ? 'Muuta evästeasetuksia' : 'Change cookie settings';",
  "const changeConsentLabel = lang === 'fi' ? 'Tietosuoja- ja evästeasetukset' : 'Privacy & cookie settings';",
  'footer consent label'
);

const oldFooterHandler = `    const btnConsent = document.getElementById("changeConsentBtn");
    if (btnConsent) {
      btnConsent.addEventListener("click", (e) => {
        e.preventDefault();
        // Peruminen yhtä helppoa kuin hyväksyminen: poistetaan aiempi valinta ja
        // näytetään banneri uudelleen niin että käyttäjä voi vaihtaa valintaansa.
        storage.removeItem('cookie_consent');
        if (typeof gtag === "function") {
          gtag('consent', 'update', {
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied',
            'analytics_storage': 'denied'
          });
        }
        renderConsentBanner();
      });
    }`;
const newFooterHandler = `    const btnConsent = document.getElementById("changeConsentBtn");
    if (btnConsent) {
      btnConsent.addEventListener("click", (e) => {
        e.preventDefault();
        openGooglePrivacyChoices();
      });
    }`;
index = replaceRequired(index, oldFooterHandler, newFooterHandler, 'footer CMP reopen handler');

index = replaceRequired(
  index,
  'renderNearbySpots.lastSpots && renderNearbySpots(renderNearbySpots.lastSpots, renderNearbySpots.lastLat, renderNearbySpots.lastLon);',
  `renderNearbySpots.lastSpots && renderNearbySpots(renderNearbySpots.lastSpots, renderNearbySpots.lastLat, renderNearbySpots.lastLon);
  if (!renderNearbySpots.lastSpots && document.getElementById('nearbyLocationBtn')) renderGeoLocationOptIn();`,
  'location opt-in translation refresh'
);

const geoGate = `if (storage.getItem('cookie_consent') !== 'all' || !("geolocation" in navigator)) return;`;
if ((index.match(new RegExp(geoGate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 2) {
  throw new Error('CMP patch failed: expected two legacy geolocation consent gates');
}
index = index.split(geoGate).join(`if (!("geolocation" in navigator)) return;`);

index = replaceRequired(
  index,
  /function initGeoLocation\(\)\{[\s\S]*?\n\}\n\nfunction showPage\(id\)\{/,
  `let nearbyGeoLoading = false;
function renderGeoLocationOptIn(){
  const section = document.getElementById("nearbySection");
  const statusEl = document.getElementById("nearbyStatus");
  if (!section || !("geolocation" in navigator)) {
    if (section) section.hidden = true;
    return;
  }
  const isKelimittariActive = document.getElementById("kelimittari")?.classList.contains("active");
  section.hidden = !isKelimittariActive;
  if (!statusEl || renderNearbySpots.lastSpots) return;
  const label = currentLang === 'fi' ? 'Käytä sijaintiani' : 'Use my location';
  const copy = currentLang === 'fi'
    ? 'Lähikalapaikat tarvitsevat erillisen selaimen sijaintiluvan. Mainos- tai evästesuostumus ei anna FastFishingille sijaintilupaa.'
    : 'Nearby fishing spots need a separate browser location permission. Ad or cookie consent does not grant FastFishing location access.';
  statusEl.innerHTML = \`${'${copy}'} <button type="button" class="btn" id="nearbyLocationBtn" style="margin-left:8px;min-height:38px;padding:7px 13px;">${'${label}'}</button>\`;
  document.getElementById("nearbyLocationBtn")?.addEventListener("click", () => initGeoLocation(true), { once:true });
}

async function initGeoLocation(requestPermission = false){
  try {
    const section = document.getElementById("nearbySection");
    if (!("geolocation" in navigator) || !navigator.geolocation) {
      if (section) section.hidden = true;
      return;
    }

    const isKelimittariActive = document.getElementById("kelimittari")?.classList.contains("active");
    if (section) section.hidden = !isKelimittariActive;

    if (!requestPermission) {
      let permissionState = 'prompt';
      try {
        if (navigator.permissions?.query) {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          permissionState = permission.state;
        }
      } catch(e) {}
      if (permissionState !== 'granted') {
        renderGeoLocationOptIn();
        return;
      }
    }

    if (nearbyGeoLoading) return;
    nearbyGeoLoading = true;
    const statusEl = document.getElementById("nearbyStatus");
    if (statusEl) {
      statusEl.textContent = currentLang === 'fi'
        ? "Haetaan sijaintiasi selaimelta..."
        : "Locating your position in browser...";
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        nearbyGeoLoading = false;
        try {
          loadNearbySpots(pos.coords.latitude, pos.coords.longitude);
        } catch (err) {
          console.error("getCurrentPosition success handler exception:", err);
        }
      },
      () => {
        nearbyGeoLoading = false;
        const statusEl2 = document.getElementById("nearbyStatus");
        if (statusEl2) {
          statusEl2.textContent = currentLang === 'fi'
            ? "Sijaintia ei saatu käyttöön. Salli sijainti selaimen sivustoasetuksista tai valitse paikka käsin yllä olevasta listasta."
            : "Location could not be acquired. Allow location in your browser site settings or choose a place manually above.";
        }
        const gridEl = document.getElementById("nearbyGrid");
        if (gridEl) gridEl.innerHTML = "";
      },
      {enableHighAccuracy:false, timeout:8000, maximumAge:600000}
    );
  } catch (err) {
    nearbyGeoLoading = false;
    console.error("initGeoLocation exception:", err);
  }
}

function showPage(id){`,
  'geolocation consent separation'
);

const oldShowPageGeo = `  const section = document.getElementById("nearbySection");
  if (section) {
    const consent = storage.getItem('cookie_consent');
    if (id === 'kelimittari' && consent === 'all' && ("geolocation" in navigator)) {
      section.hidden = false;
      if (nearbyMap) setTimeout(()=>nearbyMap.invalidateSize(), 50);
    } else {
      section.hidden = true;
    }
  }`;
const newShowPageGeo = `  const section = document.getElementById("nearbySection");
  if (section) {
    if (id === 'kelimittari' && ("geolocation" in navigator)) {
      section.hidden = false;
      if (!renderNearbySpots.lastSpots) initGeoLocation(false);
      if (nearbyMap) setTimeout(()=>nearbyMap.invalidateSize(), 50);
    } else {
      section.hidden = true;
    }
  }`;
index = replaceRequired(index, oldShowPageGeo, newShowPageGeo, 'showPage geolocation gate');

if (index.includes("storage.setItem('cookie_consent'")) throw new Error('Legacy FastFishing consent writer remains in index.html');
if (index.includes("storage.getItem('cookie_consent'")) throw new Error('Legacy FastFishing consent reader remains in index.html');
fs.writeFileSync('index.html', index);

let privacy = fs.readFileSync('tietosuoja.html', 'utf8');
privacy = replaceRequired(
  privacy,
  /<!-- Google tag \(gtag\.js\) - Consent Mode v2:[^\n]*\n<script>\n  window\.dataLayer = window\.dataLayer \|\| \[\];[\s\S]*?  gtag\('config', 'G-WENSSGS6RJ', \{ 'anonymize_ip': true \}\);\n<\/script>/,
  `<!-- Google tag (gtag.js) - Consent Mode v2 alkaa denied-tilasta; Google-certified CMP / IAB TCF hallitsee ETA/UK/CH-suostumukset. -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'wait_for_update': 500
  });
  (function clearLegacyFastFishingConsent(){
    try { localStorage.removeItem('cookie_consent'); } catch(e) {}
    try { document.cookie = 'cookie_consent=; Max-Age=0; path=/; SameSite=Lax'; } catch(e) {}
  })();
  gtag('js', new Date());
  gtag('config', 'G-WENSSGS6RJ', { 'anonymize_ip': true });
</script>`,
  'privacy Consent Mode block'
);

privacy = privacy.replace(
  'Ilman käyttäjätiliä keräämme lähinnä teknisiä lokitietoja ja suostumusvalintasi. Jos käytät Saalisvirtaa, tallennamme käyttäjänimen, suojatun salasanatiivisteen sekä itse julkaisemasi kuvat, tekstit ja saalistiedot.\n                Emme myy tietoja. Google-tagit toimivat ennen suostumusta rajoitetussa, evästeettömässä Consent Mode -tilassa; mainos- ja analytiikkaevästeitä käytetään vasta hyväksynnän jälkeen.',
  'Ilman käyttäjätiliä keräämme lähinnä teknisiä lokitietoja ja käyttöliittymävalintoja. Jos käytät Saalisvirtaa, tallennamme käyttäjänimen, suojatun salasanatiivisteen sekä itse julkaisemasi kuvat, tekstit ja saalistiedot.\n                Emme myy tietoja. ETA-alueella, UK:ssa ja Sveitsissä mainos- ja analytiikkasuostumusta hallitaan Googlen sertifioidulla Privacy &amp; messaging -CMP:llä IAB TCF -kehyksen mukaisesti; Google-tagien Consent Mode alkaa denied-tilasta.'
);

privacy = privacy.replace(
  '<li><strong>Suostumus- ja käyttöliittymävalinnat</strong> – esimerkiksi evästesuostumus, kieli, teema ja laitenäkymä tallennetaan evästeeseen tai selaimen paikalliseen tallennustilaan.</li>',
  '<li><strong>Suostumus- ja käyttöliittymävalinnat</strong> – Google-certified CMP hallitsee mainos- ja analytiikkasuostumusta sekä TCF-signaalia. FastFishing tallentaa selaimeen erikseen vain tarpeellisia käyttöliittymävalintoja, kuten kielen, teeman ja laitenäkymän.</li>'
);

privacy = replaceRequired(
  privacy,
  /            <!-- 5 -->\n            <article class="privacy-card full">[\s\S]*?\n            <\/article>\n\n            <!-- 6 -->/,
  `            <!-- 5 -->
            <article class="privacy-card full" id="google-cmp">
                <span class="tag">5</span>
                <h2>Google-certified CMP, AdSense, Analytics &amp; Consent Mode</h2>
                <p>FastFishing käyttää Google AdSense -mainontaa ja Google Analytics -kävijämittausta. ETA-alueella, Yhdistyneessä kuningaskunnassa ja Sveitsissä suostumus pyydetään Googlen <strong>Privacy &amp; messaging</strong> -palvelun sertifioidulla CMP:llä, joka toimii IAB Europe Transparency &amp; Consent Framework (TCF) -kehyksen mukaisesti. FastFishingin oma erillinen mainossuostumusbanneri ei ole enää käytössä.</p>
                <ul>
                    <li>Google CMP tarjoaa käyttäjälle vaihtoehdot <strong>Suostun</strong>, <strong>En suostu</strong> ja <strong>Hallinnoi valintoja</strong> julkaistun European regulations -viestin mukaisesti.</li>
                    <li>Google-tagien Consent Mode v2 alustetaan FastFishingissä arvoihin <code>ad_storage=denied</code>, <code>ad_user_data=denied</code>, <code>ad_personalization=denied</code> ja <code>analytics_storage=denied</code>. Googlen CMP:n ja Google-palveluiden asetukset välittävät käyttäjän lopullisen valinnan mainonta- ja mittaustageille.</li>
                    <li>Google AdSense ja sen kumppanit voivat käsitellä suostumuksen mukaisia tietoja mainosten toimittamiseen, mittaamiseen ja mahdolliseen personointiin. Google Analytics käsittelee suostumustilan mukaisia sivu- ja laitetietoja.</li>
                    <li>Selaimen sijaintilupa on tästä erillinen: lähikalapaikat pyytävät sijainnin selaimen omalla luvalla vasta käyttäjän pyynnöstä. Mainos- tai evästesuostumus ei anna FastFishingille sijaintilupaa.</li>
                </ul>
                <p><button type="button" class="btn" id="googlePrivacyChoicesBtn">Muuta tietosuoja- ja evästeasetuksia</button></p>
                <p>Google CMP:n asetukset voi avata uudelleen yllä olevasta painikkeesta silloin, kun European regulations -viesti on käyttäjän alueella käytettävissä. Lisätietoa Googlen tietosuojakäytännöistä: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</a>. Consent Modesta: <a href="https://developers.google.com/tag-platform/security/concepts/consent-mode" target="_blank" rel="noopener">Google Consent Mode</a>.</p>
                <p style="margin-top:12px;"><strong>Tietojen siirto EU/ETA-alueen ulkopuolelle:</strong> Google Analytics ja Google AdSense voivat käsitellä dataa osana Googlen globaalia infrastruktuuria myös EU/ETA-alueen ulkopuolella. Google kuvaa käyttämänsä siirtomekanismit, sopimusehdot ja tietosuojatoimet omissa tietosuoja- ja palveluehdoissaan.</p>
            </article>

            <!-- 6 -->`,
  'privacy Google CMP section'
);

privacy = replaceRequired(
  privacy,
  '<li><strong>Peruuttaa</strong> evästeisiin liittyvä suostumus poistamalla <code>cookie_consent</code>-evästeen ja sivuston paikallisen tallennustiedon tai selaimen asetuksista.</li>',
  '<li><strong>Peruuttaa tai muuttaa</strong> Google CMP:llä antamasi mainos- ja analytiikkasuostumuksen tämän sivun “Muuta tietosuoja- ja evästeasetuksia” -painikkeesta tai Googlen viestin tarjoamasta tietosuoja-asetusten linkistä.</li>',
  'privacy consent revocation text'
);

privacy = replaceRequired(
  privacy,
  /\n<div id="cookieConsentBanner"[\s\S]*?<\/script>\n<script>\n\(function \(\) \{\n  var root =/,
  `
<script>
(function(){
  var btn = document.getElementById('googlePrivacyChoicesBtn');
  if (!btn) return;
  btn.addEventListener('click', function(){
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    function showChoices(){
      if (typeof window.googlefc.showRevocationMessage !== 'function') return false;
      window.googlefc.showRevocationMessage();
      return true;
    }
    if (!showChoices()) window.googlefc.callbackQueue.push({ CONSENT_API_READY: showChoices });
  });
})();
</script>
<script>
(function () {
  var root =`,
  'privacy custom banner removal and CMP reopen handler'
);

if (privacy.includes('id="cookieConsentBanner"')) throw new Error('Legacy privacy consent banner remains');
if (privacy.includes("localStorage.setItem('cookie_consent'")) throw new Error('Legacy privacy consent writer remains');
fs.writeFileSync('tietosuoja.html', privacy);

console.log('Google CMP cleanup applied to index.html and tietosuoja.html');
