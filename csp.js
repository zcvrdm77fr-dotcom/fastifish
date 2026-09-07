// Content-Security-Policy yhdessä paikassa, jotta API-palvelimen otsake ja staattisten
// sivujen <meta http-equiv> pysyvät synkassa. Staattinen frontend on GitHub Pagesissa,
// joka ei salli omia HTTP-otsakkeita, joten sivut kantavat politiikan meta-tagissa.
//
// Huom: 'unsafe-inline' ja 'unsafe-eval' ovat script-src:ssä, koska AdSense/CMP ja
// sivujen omat inline-lohkot vaativat ne. Politiikan käytännön suoja tulee siis
// muista direktiiveistä: base-uri, object-src, form-action, frame-ancestors ja
// connect-src rajaavat sen, mihin sivu voi kytkeytyä ja mitä se voi upottaa.

const GOOGLE_ADS_SCRIPTS = [
  'https://pagead2.googlesyndication.com',
  'https://partner.googleadservices.com',
  'https://tpc.googlesyndication.com',
  'https://www.googletagservices.com',
  'https://adservice.google.com',
  'https://securepubads.g.doubleclick.net',
  'https://googleads.g.doubleclick.net',
  'https://www.googletagmanager.com',
  'https://fundingchoicesmessages.google.com',
  'https://ep1.adtrafficquality.google',
  'https://ep2.adtrafficquality.google'
];

const GOOGLE_ADS_CONNECT = [
  'https://pagead2.googlesyndication.com',
  'https://googleads.g.doubleclick.net',
  'https://securepubads.g.doubleclick.net',
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://region1.google-analytics.com',
  'https://fundingchoicesmessages.google.com',
  'https://ep1.adtrafficquality.google',
  'https://ep2.adtrafficquality.google',
  'https://csi.gstatic.com'
];

// AdSense ja CMP piirtävät mainokset ja suostumusikkunan omiin iframeihinsa.
const GOOGLE_ADS_FRAMES = [
  'https://pagead2.googlesyndication.com',
  'https://googleads.g.doubleclick.net',
  'https://securepubads.g.doubleclick.net',
  'https://tpc.googlesyndication.com',
  'https://www.google.com',
  'https://fundingchoicesmessages.google.com',
  'https://ep1.adtrafficquality.google',
  'https://ep2.adtrafficquality.google'
];

// Avoimen datan rajapinnat, joita kartta ja kalakeli kutsuvat selaimesta.
const OPEN_DATA_CONNECT = [
  'https://api.fastfishin.com',
  'https://api.open-meteo.com',
  'https://marine-api.open-meteo.com',
  'https://nominatim.openstreetmap.org',
  'https://overpass-api.de',
  'https://overpass.kumi.systems',
  'https://avoinapi.vaylapilvi.fi',
  'https://julkinen.traficom.fi',
  'https://gtkdata.gtk.fi',
  'https://hakku.gtk.fi',
  'https://kartta.luke.fi',
  'https://emodnet.ec.europa.eu',
  'https://rest.emodnet-bathymetry.eu'
];

function directives(map) {
  return Object.entries(map)
    .map(([name, values]) => (values.length ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

// Selainsivujen politiikka. frame-ancestors jätetään pois, koska se ohitetaan
// meta-tagissa; kehyksiin upottamisen estää X-Frame-Options / pageCsp-otsake.
export const PAGE_CSP = directives({
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'form-action': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", ...GOOGLE_ADS_SCRIPTS],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
  // Karttalaatat ja mainosten kuvat tulevat lukuisista isännistä, joten kuvat
  // sallitaan laajasti. Kuvalähde ei voi suorittaa koodia.
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'connect-src': ["'self'", ...OPEN_DATA_CONNECT, ...GOOGLE_ADS_CONNECT],
  'frame-src': ["'self'", ...GOOGLE_ADS_FRAMES],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'upgrade-insecure-requests': []
});

// Sama politiikka otsakkeena, kun API-palvelin tarjoaa frontendin paikallisesti.
export const PAGE_CSP_HEADER = `${PAGE_CSP}; frame-ancestors 'none'`;

// API vastaa JSONia ja tarjoaa uploads-kuvia. Mikään niistä ei tarvitse skriptejä.
export const API_CSP = directives({
  'default-src': ["'none'"],
  'img-src': ["'self'", 'data:'],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"]
});
