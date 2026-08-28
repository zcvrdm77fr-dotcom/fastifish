const CACHE_VERSION = 'v3';
const CACHE_NAME = `fastfishing-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/kalapaikat.json'
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

  const isPage = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  if (isPage) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
  }
});
