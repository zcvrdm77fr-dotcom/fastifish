let lastSelectionSignature = '';
let lastSelectionAt = -Infinity;

function currentSelection(force = false) {
  const locationSelect = document.getElementById('locationSelect');
  const speciesSelect = document.getElementById('speciesSelect');
  const resolve = window.resolveLocation;
  if (!locationSelect || !speciesSelect || typeof resolve !== 'function') return;

  const location = resolve(locationSelect.value);
  if (!location) return;

  const detail = { location, species: speciesSelect.value, force };
  const now = performance.now();
  const signature = `${location.lat}|${location.lon}|${detail.species}|${force}`;
  if (signature === lastSelectionSignature && now - lastSelectionAt < 100) return;
  lastSelectionSignature = signature;
  lastSelectionAt = now;

  window.dispatchEvent(new CustomEvent('fastfishing:forecast-selection', { detail }));
}

function dedupeLocationOptions() {
  const select = document.getElementById('locationSelect');
  if (!select) return;

  const selected = select.value;
  const seen = new Set();
  for (const option of [...select.options]) {
    if (seen.has(option.value)) option.remove();
    else seen.add(option.value);
  }
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
}

function installFrontendCompat() {
  const locationSelect = document.getElementById('locationSelect');
  const speciesSelect = document.getElementById('speciesSelect');
  const refreshButton = document.getElementById('refreshBtn');
  const searchInput = document.getElementById('locationSearch');

  locationSelect?.addEventListener('change', () => currentSelection(false));
  speciesSelect?.addEventListener('change', () => currentSelection(false));
  refreshButton?.addEventListener('click', () => currentSelection(true));
  searchInput?.addEventListener('input', event => {
    if (event.target.value === '') dedupeLocationOptions();
  });

  const originalRefresh = window.refresh;
  if (typeof originalRefresh === 'function' && !originalRefresh.__fastFishingPlannerBridge) {
    const wrapped = function(event) {
      currentSelection(event?.type === 'click');
      return originalRefresh.apply(this, arguments);
    };
    Object.defineProperty(wrapped, '__fastFishingPlannerBridge', { value: true });
    window.refresh = wrapped;
  }
}

installFrontendCompat();
