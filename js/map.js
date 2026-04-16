// Leaflet地図の管理

let map = null;
let routeLayer = null;
let poiLayer = null;
let onRouteClickCallback = null;

function initMap(elementId) {
  map = L.map(elementId).setView([35.68, 139.77], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  poiLayer = L.layerGroup().addTo(map);
}

function getMap() {
  return map;
}

function setRouteClickHandler(callback) {
  onRouteClickCallback = callback;
}

function clearMap() {
  if (routeLayer) routeLayer.clearLayers();
  if (poiLayer) poiLayer.clearLayers();
}

function displayRoute(trackpoints) {
  if (routeLayer) routeLayer.clearLayers();
  if (!trackpoints || trackpoints.length === 0) return;

  const latlngs = trackpoints.map(tp => [tp.latitude, tp.longitude]);
  // クリック判定用の透明な太めのライン
  const clickable = L.polyline(latlngs, { color: '#000', weight: 16, opacity: 0, interactive: true });
  // 表示用のライン
  const polyline = L.polyline(latlngs, { color: '#2563eb', weight: 3, opacity: 0.8, interactive: false });
  routeLayer.addLayer(clickable);
  routeLayer.addLayer(polyline);
  clickable.on('click', (e) => {
    if (onRouteClickCallback) {
      onRouteClickCallback(e.latlng);
    }
  });
  map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
}

function displayPOIs(pois) {
  if (poiLayer) poiLayer.clearLayers();
  if (!pois || pois.length === 0) return;

  for (let i = 0; i < pois.length; i++) {
    const poi = pois[i];
    const marker = L.marker([poi.latitude, poi.longitude]);
    const popupContent = `<strong>${poi.name || 'POI'}</strong>` +
      (poi.notes ? `<br>${poi.notes}` : '') +
      (poi.type ? `<br><em>${poi.type}</em>` : '');
    marker.bindPopup(popupContent);
    marker.bindTooltip(`${i + 1}. ${poi.name || 'POI'}`, { permanent: false });
    poiLayer.addLayer(marker);
  }
}
