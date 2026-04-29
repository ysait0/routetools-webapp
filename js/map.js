// Google Maps地図の管理

let map = null;
let mapElement = null;
let routePolyline = null;
let routeClickPolyline = null;
let hoverHighlightMarker = null;
let activeInfoWindow = null;
let onRouteClickCallback = null;
let onMarkerClickCallback = null;
let onMarkerHoverCallback = null; // (index, isHovering) を受け取る外部通知用
let onRouteHoverCallback = null; // ルート上のmousemove通知 (index|null)
let onNearbyPlaceAddCallback = null;
let poiMarkers = []; // POI一覧のindexと対応する{marker, poi}配列
let nearbyPlaceMarkers = [];
let trackpointsCache = []; // ルート上hover時に最近傍を高速計算するため保持
let googleMapsSearchControl = null; // Google Maps 検索コントロール
let googleMapsLoadPromise = null;
let pendingRouteTrackpoints = null;
let pendingPois = null;
let routeFitRequestId = 0;
let placesLibraryPromise = null;

const POI_COLOR_DEFAULT = '#3388ff';
const POI_COLOR_HIGHLIGHT = '#ef4444';
const TURN_COLOR_DEFAULT = '#f59e0b'; // 自動追加の右左折POI用（アンバー）
const GOOGLE_MAPS_CALLBACK = '__routetoolsGoogleMapsLoaded';

function getConfiguredGoogleMapsApiKey() {
  const params = new URLSearchParams(window.location.search);
  const queryKey = params.get('google_maps_api_key') || params.get('googleMapsApiKey');
  if (queryKey) return queryKey;

  try {
    const saved = localStorage.getItem('routetools-google-maps-api-key');
    if (saved) return saved;
  } catch (e) { /* localStorage不可 */ }

  if (window.ROUTETOOLS_CONFIG && window.ROUTETOOLS_CONFIG.googleMapsApiKey) {
    return window.ROUTETOOLS_CONFIG.googleMapsApiKey;
  }

  const meta = document.querySelector('meta[name="google-maps-api-key"]');
  return meta ? meta.content.trim() : '';
}

function showMapMessage(message, isError = false) {
  if (!mapElement) return;
  mapElement.classList.add('map-message');
  mapElement.classList.toggle('error', isError);
  mapElement.textContent = message;
}

function clearMapMessage() {
  if (!mapElement) return;
  mapElement.classList.remove('map-message', 'error');
  mapElement.textContent = '';
}

function loadGoogleMapsApi() {
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  const apiKey = getConfiguredGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error(t('status.google_maps_key_missing')));
  }

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    window[GOOGLE_MAPS_CALLBACK] = () => {
      resolve(window.google.maps);
      delete window[GOOGLE_MAPS_CALLBACK];
    };

    const script = document.createElement('script');
    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      loading: 'async',
      callback: GOOGLE_MAPS_CALLBACK,
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      googleMapsLoadPromise = null;
      reject(new Error(t('status.google_maps_load_failed')));
    };
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

function initMap(elementId) {
  mapElement = document.getElementById(elementId);
  if (!mapElement) return;

  showMapMessage(t('status.google_maps_loading'));

  loadGoogleMapsApi()
    .then(() => {
      clearMapMessage();
      map = new google.maps.Map(mapElement, {
        center: { lat: 35.68, lng: 139.77 },
        zoom: 10,
        maxZoom: 20,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        fullscreenControlOptions: {
          position: google.maps.ControlPosition.INLINE_START_BLOCK_END,
        },
        clickableIcons: false,
      });
      map.invalidateSize = resizeMap;
      activeInfoWindow = new google.maps.InfoWindow();
      setupGoogleMapsSearchControl();
      if (pendingRouteTrackpoints) displayRoute(pendingRouteTrackpoints);
      if (pendingPois) displayPOIs(pendingPois);
    })
    .catch(err => {
      showMapMessage(err.message, true);
      if (typeof showStatus === 'function') {
        showStatus(err.message, true);
      }
    });
}

function getMap() {
  return map;
}

function setRouteClickHandler(callback) {
  onRouteClickCallback = callback;
}

function setMarkerClickHandler(callback) {
  onMarkerClickCallback = callback;
}

function setMarkerHoverHandler(callback) {
  onMarkerHoverCallback = callback;
}

function setRouteHoverHandler(callback) {
  onRouteHoverCallback = callback;
}

function setNearbyPlaceAddHandler(callback) {
  onNearbyPlaceAddCallback = callback;
}

function clearMap() {
  clearRouteLayers();
  clearPOIMarkers();
  clearNearbyPlaceMarkers();
  clearRouteHighlight();
}

function normalizeLatLng(latlng) {
  if (!latlng) return null;
  if (Array.isArray(latlng)) {
    return { lat: Number(latlng[0]), lng: Number(latlng[1]) };
  }
  if (typeof latlng.lat === 'function' && typeof latlng.lng === 'function') {
    return { lat: latlng.lat(), lng: latlng.lng() };
  }
  return { lat: Number(latlng.lat), lng: Number(latlng.lng) };
}

function clearRouteLayers() {
  if (routePolyline) {
    routePolyline.setMap(null);
    routePolyline = null;
  }
  if (routeClickPolyline) {
    routeClickPolyline.setMap(null);
    routeClickPolyline = null;
  }
}

function displayRoute(trackpoints) {
  pendingRouteTrackpoints = trackpoints || [];
  clearRouteLayers();
  clearRouteHighlight();
  trackpointsCache = trackpoints || [];
  if (!map || !trackpoints || trackpoints.length === 0) return;

  const path = trackpoints.map(tp => ({ lat: tp.latitude, lng: tp.longitude }));
  routePolyline = new google.maps.Polyline({
    path,
    strokeColor: '#2563eb',
    strokeOpacity: 0.8,
    strokeWeight: 3,
    clickable: false,
    map,
  });
  routeClickPolyline = new google.maps.Polyline({
    path,
    strokeColor: '#000000',
    strokeOpacity: 0.01,
    strokeWeight: 16,
    clickable: true,
    zIndex: 2,
    map,
  });

  routeClickPolyline.addListener('click', e => {
    if (onRouteClickCallback && e.latLng) {
      onRouteClickCallback(normalizeLatLng(e.latLng));
    }
  });
  routeClickPolyline.addListener('mousemove', e => {
    if (!onRouteHoverCallback || !e.latLng) return;
    const idx = findNearestTrackpointIndex(normalizeLatLng(e.latLng));
    if (idx !== -1) onRouteHoverCallback(idx);
  });
  routeClickPolyline.addListener('mouseout', () => {
    if (onRouteHoverCallback) onRouteHoverCallback(null);
  });

  const bounds = new google.maps.LatLngBounds();
  path.forEach(point => bounds.extend(point));
  scheduleRouteFit(bounds, path);
}

function scheduleRouteFit(bounds, path) {
  const requestId = ++routeFitRequestId;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (requestId !== routeFitRequestId || !map) return;
      fitRouteBounds(bounds, path);
    });
  });
}

function fitRouteBounds(bounds, path) {
  if (path.length === 1) {
    map.setCenter(path[0]);
    map.setZoom(15);
  } else {
    map.fitBounds(bounds, { top: 30, right: 30, bottom: 30, left: 30 });
  }
}

// 緯度経度に最も近いトラックポイントのindexを返す（二乗距離で十分）
function findNearestTrackpointIndex(latlng) {
  const point = normalizeLatLng(latlng);
  if (!point || !trackpointsCache || trackpointsCache.length === 0) return -1;
  let minD = Infinity;
  let minI = 0;
  for (let i = 0; i < trackpointsCache.length; i++) {
    const tp = trackpointsCache[i];
    const dy = tp.latitude - point.lat;
    const dx = tp.longitude - point.lng;
    const d = dx * dx + dy * dy;
    if (d < minD) { minD = d; minI = i; }
  }
  return minI;
}

// 指定座標にクロスハイライト用のマーカーを表示（既存は移動）
function setRouteHighlight(latlng) {
  if (!map) return;
  const position = normalizeLatLng(latlng);
  if (!position) return;
  if (!hoverHighlightMarker) {
    hoverHighlightMarker = new google.maps.Marker({
      position,
      map,
      clickable: false,
      zIndex: 2000,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        fillColor: '#ef4444',
        fillOpacity: 0.75,
      },
    });
  } else {
    hoverHighlightMarker.setPosition(position);
    hoverHighlightMarker.setMap(map);
  }
}

function clearRouteHighlight() {
  if (hoverHighlightMarker) {
    hoverHighlightMarker.setMap(null);
    hoverHighlightMarker = null;
  }
}

function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function makePoiIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M 12 0 C 5.4 0 0 5.4 0 12 C 0 21 12 36 12 36 C 12 36 24 21 24 12 C 24 5.4 18.6 0 12 0 Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="4.5" fill="#fff"/>
  </svg>`;
  return {
    url: svgToDataUrl(svg),
    scaledSize: new google.maps.Size(24, 36),
    anchor: new google.maps.Point(12, 36),
  };
}

// 自動追加の右左折POI用: 円形 + 方向矢印
function makeTurnIcon(direction, color) {
  const arrow = direction === 'Left'
    ? '<path d="M 17 12 L 7 12 M 11 7 L 6 12 L 11 17" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<path d="M 7 12 L 17 12 M 13 7 L 18 12 L 13 17" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
    <circle cx="12" cy="12" r="11" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    ${arrow}
  </svg>`;
  return {
    url: svgToDataUrl(svg),
    scaledSize: new google.maps.Size(24, 24),
    anchor: new google.maps.Point(12, 12),
  };
}

// POIの属性（autoGenerated / direction）に応じたアイコンを返す
function makeIconForPOI(poi, highlighted) {
  if (poi.autoGenerated && (poi.type === 'Left' || poi.type === 'Right')) {
    const color = highlighted ? POI_COLOR_HIGHLIGHT : TURN_COLOR_DEFAULT;
    return makeTurnIcon(poi.type, color);
  }
  const color = highlighted ? POI_COLOR_HIGHLIGHT : POI_COLOR_DEFAULT;
  return makePoiIcon(color);
}

function clearPOIMarkers() {
  for (const entry of poiMarkers) {
    entry.marker.setMap(null);
  }
  poiMarkers = [];
}

function clearNearbyPlaceMarkers() {
  for (const entry of nearbyPlaceMarkers) {
    entry.marker.setMap(null);
  }
  nearbyPlaceMarkers = [];
}

function getNearbyPlaceDisplayName(place) {
  if (!place) return t('poi.no_name');
  if (typeof place.displayName === 'string') return place.displayName;
  if (place.displayName && typeof place.displayName.text === 'string') return place.displayName.text;
  return t('poi.no_name');
}

function getCurrentLanguageCode() {
  return (typeof getLanguage === 'function') ? getLanguage() : 'ja';
}

function getSafeExternalUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch (e) {
    // ignore invalid URLs
  }
  return '';
}

function getCurrentLocale() {
  return getCurrentLanguageCode() === 'ja' ? 'ja-JP' : 'en-US';
}

function formatOpeningHoursTime(hour, minute) {
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(Date.UTC(2000, 0, 1, hour || 0, minute || 0)));
}

function getWeekdayLabel(dayIndex) {
  const baseSunday = new Date(Date.UTC(2024, 0, 7 + dayIndex, 12, 0, 0));
  return new Intl.DateTimeFormat(getCurrentLocale(), { weekday: 'long' }).format(baseSunday);
}

function getWeekdayOrder() {
  try {
    const locale = new Intl.Locale(getCurrentLocale());
    const firstDay = locale.weekInfo && locale.weekInfo.firstDay;
    if (typeof firstDay === 'number') {
      const start = firstDay % 7;
      return Array.from({ length: 7 }, (_, index) => (start + index) % 7);
    }
  } catch (e) {
    // Intl.Locale が使えない環境では日曜始まり
  }
  return [0, 1, 2, 3, 4, 5, 6];
}

function formatNearbyPlaceHours(place) {
  const openingHours = place && place.regularOpeningHours;
  if (!openingHours || !Array.isArray(openingHours.periods)) return null;

  const dailyRanges = Array.from({ length: 7 }, () => []);
  let alwaysOpen = false;

  for (const period of openingHours.periods) {
    const open = period && period.open;
    if (!open || typeof open.day !== 'number') continue;
    if (!period.close && open.day === 0 && open.hour === 0 && open.minute === 0) {
      alwaysOpen = true;
      break;
    }

    const openTime = formatOpeningHoursTime(open.hour, open.minute);
    let closeTime = '';
    if (period.close && typeof period.close.hour === 'number' && typeof period.close.minute === 'number') {
      closeTime = formatOpeningHoursTime(period.close.hour, period.close.minute);
    }

    const text = closeTime ? `${openTime} - ${closeTime}` : openTime;
    dailyRanges[open.day].push(text);
  }

  const todayIndex = new Date().getDay();
  const dayOrder = getWeekdayOrder();
  const rows = dayOrder.map(dayIndex => {
    const value = alwaysOpen
      ? t('hours.open_24')
      : (dailyRanges[dayIndex].length > 0 ? dailyRanges[dayIndex].join(', ') : t('hours.closed'));
    return {
      dayIndex,
      label: getWeekdayLabel(dayIndex),
      value,
      isToday: dayIndex === todayIndex,
    };
  });

  const todayRow = rows.find(row => row.isToday) || rows[0];
  return {
    todayLabel: todayRow.label,
    todayValue: todayRow.value,
    rows,
  };
}

function displayPOIs(pois) {
  pendingPois = pois || [];
  clearPOIMarkers();
  if (!map || !pois || pois.length === 0) return;

  for (let i = 0; i < pois.length; i++) {
    const poi = pois[i];
    const marker = new google.maps.Marker({
      position: { lat: poi.latitude, lng: poi.longitude },
      map,
      icon: makeIconForPOI(poi, false),
      title: `${i + 1}. ${poi.name || 'POI'}`,
    });
    const idx = i;
    marker.addListener('mouseover', () => {
      highlightPOIMarker(idx);
      if (onMarkerHoverCallback) onMarkerHoverCallback(idx, true);
    });
    marker.addListener('mouseout', () => {
      unhighlightPOIMarker(idx);
      if (onMarkerHoverCallback) onMarkerHoverCallback(idx, false);
    });
    marker.addListener('click', () => {
      if (onMarkerClickCallback) onMarkerClickCallback(idx);
    });
    poiMarkers.push({ marker, poi });
  }
}

function highlightPOIMarker(index) {
  const entry = poiMarkers[index];
  if (!entry) return;
  entry.marker.setIcon(makeIconForPOI(entry.poi, true));
  entry.marker.setZIndex(1000);
}

function unhighlightPOIMarker(index) {
  const entry = poiMarkers[index];
  if (!entry) return;
  entry.marker.setIcon(makeIconForPOI(entry.poi, false));
  entry.marker.setZIndex(null);
}

function openMapPopup(latlng, content) {
  if (!map || !activeInfoWindow) return null;
  const position = normalizeLatLng(latlng);
  if (!position) return null;
  activeInfoWindow.close();
  activeInfoWindow.setOptions({
    content,
    position,
    maxWidth: 320,
  });
  activeInfoWindow.open({ map });
  return activeInfoWindow;
}

function closeMapPopup() {
  if (activeInfoWindow) activeInfoWindow.close();
}

function getExpandedPopupRect() {
  const popupRoot = document.querySelector('.nearby-place-popup');
  if (!popupRoot) return null;
  const rect = popupRoot.getBoundingClientRect();
  return {
    top: rect.top - 40,
    right: rect.right + 48,
    bottom: rect.bottom + 12,
    left: rect.left - 12,
  };
}

function getSearchControlRect() {
  if (!googleMapsSearchControl || googleMapsSearchControl.style.display === 'none') return null;
  const rect = googleMapsSearchControl.getBoundingClientRect();
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  };
}

function keepActivePopupInView() {
  if (!map || !mapElement) return;
  const popupRect = getExpandedPopupRect();
  if (!popupRect) return;

  const mapRect = mapElement.getBoundingClientRect();
  const padding = 16;

  const overflowTop = Math.max(0, (mapRect.top + padding) - popupRect.top);
  const overflowBottom = Math.max(0, popupRect.bottom - (mapRect.bottom - padding));
  const overflowLeft = Math.max(0, (mapRect.left + padding) - popupRect.left);
  const overflowRight = Math.max(0, popupRect.right - (mapRect.right - padding));

  let panX = overflowRight > 0 ? overflowRight : (overflowLeft > 0 ? -overflowLeft : 0);
  let panY = overflowBottom > 0 ? overflowBottom : (overflowTop > 0 ? -overflowTop : 0);

  const controlRect = getSearchControlRect();
  if (controlRect) {
    const overlapWidth = Math.min(popupRect.right, controlRect.right) - Math.max(popupRect.left, controlRect.left);
    const overlapHeight = Math.min(popupRect.bottom, controlRect.bottom) - Math.max(popupRect.top, controlRect.top);
    if (overlapWidth > 0 && overlapHeight > 0) {
      const moveLeft = overlapWidth + padding;
      const moveDown = overlapHeight + padding;
      const canMoveLeft = popupRect.left - (mapRect.left + padding) >= moveLeft;
      const canMoveDown = (mapRect.bottom - padding) - popupRect.bottom >= moveDown;

      if (canMoveLeft || !canMoveDown) {
        panX += moveLeft;
      } else {
        panY -= moveDown;
      }
    }
  }

  if (panX !== 0 || panY !== 0) {
    map.panBy(panX, panY);
  }
}

function setupGoogleMapsSearchControl() {
  if (!map || googleMapsSearchControl) return;
  googleMapsSearchControl = document.createElement('div');
  googleMapsSearchControl.className = 'google-maps-search-control';
  googleMapsSearchControl.style.display = 'none';
  googleMapsSearchControl.innerHTML = `
    <div class="nearby-search-panel">
      <div class="nearby-search-fields">
        <label>
          <span>${escapeHtml(t('label.nearby_query'))}</span>
          <input type="text" class="nearby-query-input" placeholder="${escapeHtml(t('placeholder.nearby_query'))}" />
        </label>
      </div>
      <div class="nearby-search-actions">
        <button type="button" class="nearby-search-run">${escapeHtml(t('button.search'))}</button>
        <button type="button" class="nearby-search-clear">${escapeHtml(t('button.clear_results'))}</button>
      </div>
    </div>
  `;

  const queryInput = googleMapsSearchControl.querySelector('.nearby-query-input');
  const runButton = googleMapsSearchControl.querySelector('.nearby-search-run');
  const clearButton = googleMapsSearchControl.querySelector('.nearby-search-clear');

  runButton.addEventListener('click', async () => {
    const query = queryInput ? queryInput.value : '';
    await searchNearbyPlaces(query);
  });
  queryInput.addEventListener('keydown', async e => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = queryInput ? queryInput.value : '';
      await searchNearbyPlaces(query);
    }
  });
  clearButton.addEventListener('click', () => {
    clearNearbyPlaceMarkers();
    closeMapPopup();
    showStatus(t('status.nearby_results_cleared'));
  });

  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(googleMapsSearchControl);
}

function refreshGoogleMapsSearchControlTranslations() {
  if (!googleMapsSearchControl) return;
  const queryLabel = googleMapsSearchControl.querySelector('.nearby-search-fields label span');
  const queryInput = googleMapsSearchControl.querySelector('.nearby-query-input');
  const runButton = googleMapsSearchControl.querySelector('.nearby-search-run');
  const clearButton = googleMapsSearchControl.querySelector('.nearby-search-clear');

  if (queryLabel) queryLabel.textContent = t('label.nearby_query');
  if (queryInput) {
    queryInput.placeholder = t('placeholder.nearby_query');
  }
  if (runButton) runButton.textContent = t('button.search');
  if (clearButton) clearButton.textContent = t('button.clear_results');
}

function setGoogleMapsControlVisible(visible) {
  if (!googleMapsSearchControl) return;
  googleMapsSearchControl.style.display = visible ? 'block' : 'none';
  if (!visible) {
    clearNearbyPlaceMarkers();
  }
}

function getNearbyResultIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
    <circle cx="14" cy="14" r="11" fill="#f97316" stroke="#fff" stroke-width="2"/>
    <circle cx="14" cy="14" r="3.5" fill="#fff"/>
  </svg>`;
  return {
    url: svgToDataUrl(svg),
    scaledSize: new google.maps.Size(28, 28),
    anchor: new google.maps.Point(14, 14),
  };
}

async function loadPlacesLibrary() {
  if (!map) throw new Error(t('status.google_maps_load_failed'));
  if (placesLibraryPromise) return placesLibraryPromise;
  placesLibraryPromise = google.maps.importLibrary('places')
    .catch(err => {
      placesLibraryPromise = null;
      throw err;
    });
  return placesLibraryPromise;
}

function getCurrentRouteSearchBounds() {
  if (!map) return null;
  const viewportBounds = map.getBounds();
  if (!viewportBounds) return null;

  if (!trackpointsCache || trackpointsCache.length === 0) {
    return viewportBounds.toJSON ? viewportBounds.toJSON() : null;
  }

  const visiblePoints = trackpointsCache.filter(tp =>
    viewportBounds.contains({ lat: tp.latitude, lng: tp.longitude })
  );

  if (visiblePoints.length === 0) {
    return viewportBounds.toJSON ? viewportBounds.toJSON() : null;
  }

  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;
  for (const point of visiblePoints) {
    if (point.latitude > north) north = point.latitude;
    if (point.latitude < south) south = point.latitude;
    if (point.longitude > east) east = point.longitude;
    if (point.longitude < west) west = point.longitude;
  }

  const ne = viewportBounds.getNorthEast();
  const sw = viewportBounds.getSouthWest();
  const latPad = Math.max((ne.lat() - sw.lat()) * 0.05, 0.001);
  const lngPad = Math.max((ne.lng() - sw.lng()) * 0.05, 0.001);

  return {
    north: Math.min(ne.lat(), north + latPad),
    south: Math.max(sw.lat(), south - latPad),
    east: Math.min(ne.lng(), east + lngPad),
    west: Math.max(sw.lng(), west - lngPad),
  };
}

async function searchNearbyPlaces(query) {
  if (!map) return;
  closeMapPopup();
  const trimmedQuery = (query || '').trim() || t('nearby.default_query');

  const locationRestriction = getCurrentRouteSearchBounds();
  if (!locationRestriction) {
    showStatus(t('status.nearby_bounds_missing'), true);
    return;
  }

  const runButton = googleMapsSearchControl && googleMapsSearchControl.querySelector('.nearby-search-run');
  if (runButton) runButton.disabled = true;

  try {
    showStatus(t('status.nearby_searching', { query: trimmedQuery }));
    const { Place, SearchByTextRankPreference } = await loadPlacesLibrary();
    const request = {
      fields: ['displayName', 'location', 'formattedAddress', 'googleMapsURI', 'regularOpeningHours', 'websiteURI'],
      textQuery: trimmedQuery,
      locationRestriction,
      language: getCurrentLanguageCode(),
      maxResultCount: 20,
      rankPreference: SearchByTextRankPreference.RELEVANCE,
    };
    const { places } = await Place.searchByText(request);
    renderNearbyPlaceResults(places || [], trimmedQuery);
  } catch (err) {
    const message = (err && err.message) ? err.message : String(err);
    showStatus(t('status.nearby_error', { message }), true);
  } finally {
    if (runButton) runButton.disabled = false;
  }
}

function renderNearbyPlaceResults(places, query) {
  clearNearbyPlaceMarkers();
  if (!places || places.length === 0) {
    showStatus(t('status.nearby_none', { query }));
    return;
  }

  for (const place of places) {
    if (!place.location) continue;
    const marker = new google.maps.Marker({
      position: place.location,
      map,
      icon: getNearbyResultIcon(),
      title: getNearbyPlaceDisplayName(place),
      zIndex: 900,
    });
    marker.addListener('click', () => {
      openNearbyPlacePopup(place, marker);
    });
    nearbyPlaceMarkers.push({ marker, place });
  }

  showStatus(t('status.nearby_results', {
    count: nearbyPlaceMarkers.length,
    query,
  }));
}

function openNearbyPlacePopup(place, marker) {
  if (!marker) return;
  const title = getNearbyPlaceDisplayName(place);
  const address = place.formattedAddress || '';
  const mapsUrl = place.googleMapsURI || '';
  const websiteUrl = getSafeExternalUrl(place.websiteURI);
  const hours = formatNearbyPlaceHours(place);
  const hoursContent = hours ? `
      <details class="nearby-place-hours">
        <summary>
          <span class="nearby-place-hours-summary-text">
            <span class="nearby-place-hours-heading">${escapeHtml(t('label.opening_hours'))}</span>
            <span class="nearby-place-hours-today">${escapeHtml(t('label.today'))}: ${escapeHtml(hours.todayValue)}</span>
          </span>
        </summary>
        <ul class="nearby-place-hours-list">
          ${hours.rows.map(row => `
            <li class="${row.isToday ? 'today' : ''}">
              <span class="nearby-place-hours-day">${escapeHtml(row.label)}</span>
              <span class="nearby-place-hours-value">${escapeHtml(row.value)}</span>
            </li>
          `).join('')}
        </ul>
      </details>
    ` : '';
  const websiteContent = websiteUrl ? `
      <p class="nearby-place-website">
        <a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(websiteUrl)}</a>
      </p>
    ` : '';
  const content = `
    <div class="nearby-place-popup">
      <h3>${escapeHtml(title)}</h3>
      ${address ? `<p class="nearby-place-address">${escapeHtml(address)}</p>` : ''}
      ${hoursContent}
      ${websiteContent}
      <div class="popup-actions">
        <button class="btn btn-secondary" id="btn-nearby-open-maps">${escapeHtml(t('button.open_google_maps'))}</button>
        <button class="btn btn-primary" id="btn-nearby-add-poi">${escapeHtml(t('button.add_as_poi'))}</button>
      </div>
    </div>
  `;
  const popup = openMapPopup(normalizeLatLng(marker.getPosition()), content);
  if (!popup) return;

  setTimeout(() => {
    const openButton = document.getElementById('btn-nearby-open-maps');
    const addButton = document.getElementById('btn-nearby-add-poi');
    const hoursDetails = document.querySelector('.nearby-place-hours');
    if (openButton) {
      openButton.disabled = !mapsUrl;
      openButton.addEventListener('click', () => {
        if (!mapsUrl) return;
        window.open(mapsUrl, '_blank', 'noopener');
      });
    }
    if (addButton) {
      addButton.addEventListener('click', () => {
        if (onNearbyPlaceAddCallback) onNearbyPlaceAddCallback(place);
        closeMapPopup();
      });
    }
    if (hoursDetails) {
      hoursDetails.addEventListener('toggle', () => {
        requestAnimationFrame(() => {
          keepActivePopupInView();
        });
        setTimeout(() => {
          keepActivePopupInView();
        }, 120);
      });
    }
    keepActivePopupInView();
    setTimeout(() => {
      keepActivePopupInView();
    }, 120);
  }, 0);
}

function resizeMap() {
  if (!map) return;
  const center = map.getCenter();
  requestAnimationFrame(() => {
    if (center) map.setCenter(center);
  });
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const resizer = document.getElementById('sidebar-resizer');
  const btn = document.getElementById('btn-sidebar-toggle');
  if (!sidebar) return;
  const collapsed = sidebar.classList.toggle('collapsed');
  if (resizer) resizer.classList.toggle('collapsed', collapsed);
  // ◀ (開いている=閉じる方向) / ▶ (閉じている=開く方向)
  if (btn) btn.textContent = collapsed ? '\u25B6' : '\u25C4';
  resizeMap();
}
