const CACHE_VERSION = 'v6';
const CACHE_NAME = `fastfishing-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/kalapaikat.json',
  '/fishing-structures.js',
  '/depth-structures.js',
  '/inland-depth/manifest.json'
];

function isObviouslyNonFishingFeature(tags = {}) {
  const leisure = String(tags.leisure || '').toLowerCase();
  const amenity = String(tags.amenity || '').toLowerCase();
  const water = String(tags.water || '').toLowerCase();
  const manMade = String(tags.man_made || '').toLowerCase();

  if (['swimming_pool', 'wading_pool', 'water_park', 'splash_pad'].includes(leisure)) return true;
  if (amenity === 'fountain' || water === 'fountain') return true;
  if (['swimming_pool', 'wading_pool', 'splash_pool', 'wastewater', 'sewage'].includes(water)) return true;
  if (['wastewater_plant', 'sewage_treatment'].includes(manMade)) return true;
  return false;
}

async function filterFishingPlacesResponse(response) {
  if (!response || !response.ok) return response;

  try {
    const data = await response.clone().json();
    if (!data || !Array.isArray(data.spots)) return response;

    const before = data.spots.length;
    data.spots = data.spots.filter((spot) => !isObviouslyNonFishingFeature(spot?.tags || {}));
    const removed = before - data.spots.length;

    if (removed > 0 && data.counts && Number.isFinite(data.counts.known)) {
      data.counts.known = Math.max(0, data.counts.known - removed);
    }

    const headers = new Headers(response.headers);
    headers.set('content-type', 'application/json; charset=utf-8');
    headers.delete('content-length');
    headers.delete('content-encoding');

    return new Response(`${JSON.stringify(data)}\n`, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    return response;
  }
}

async function injectFishingStructures(response) {
  if (!response || !response.ok) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  try {
    let html = await response.clone().text();
    // Poistetaan mahdollinen vanhan service workerin injektoima versio ja lisätään aina
    // tämän cache-version skriptit. Näin vanha ?v=4/?v=5 ei voi jäädä puhelimeen kummittelemaan.
    html = html
      .replace(/\s*<script\s+src=["']\/fishing-structures\.js(?:\?[^"']*)?["']><\/script>/gi, '')
      .replace(/\s*<script\s+src=["']\/depth-structures\.js(?:\?[^"']*)?["']><\/script>/gi, '');

    const injection = '<script src="/fishing-structures.js?v=6"></script>\n<script src="/depth-structures.js?v=6"></script>';
    html = html.includes('</body>') ? html.replace('</body>', `${injection}\n</body>`) : `${html}\n${injection}`;

    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.delete('content-length');
    headers.delete('content-encoding');

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    return response;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/kalapaikat.json') {
    event.respondWith(
      caches.match(request)
        .then((cached) => cached || fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        }))
        .then(filterFishingPlacesResponse)
    );
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }))
    );
    return;
  }

  if (url.pathname.startsWith('/inland-depth/tiles/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
    return;
  }

  const isPage = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  if (isPage) {
    event.respondWith(
      fetch(request)
        .then((response) => (url.pathname === '/' || url.pathname === '/index.html') ? injectFishingStructures(response) : response)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(async (cached) => {
          const fallback = cached || await caches.match('/index.html');
          if (!fallback) return fallback;
          return (url.pathname === '/' || url.pathname === '/index.html') ? injectFishingStructures(fallback) : fallback;
        }))
    );
  }
});
