export function initAMap(containerId, options = {}) {
  if (typeof AMap === 'undefined') return null;
  const defaultOptions = { zoom: 13, center: [116.397428, 39.90923], mapStyle: 'amap://styles/dark' };
  try {
    return new AMap.Map(containerId, { ...defaultOptions, ...options });
  } catch (e) {
    return null;
  }
}

export async function initMap(containerId, options = {}) {
  if (window.__activeMapProvider === 'mapbox' && window.mapboxgl) {
    try {
      return new window.mapboxgl.Map({
        container: containerId,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: options.center || [86.925, 27.988],
        zoom: options.zoom || 13,
      });
    } catch (e) {
      return null;
    }
  }
  if (window.__activeMapProvider === 'osm' && window.L) {
    try {
      const map = window.L.map(containerId).setView(
        (options.center && options.center.length === 2) ? [options.center[1], options.center[0]] : [27.988, 86.925],
        options.zoom || 13,
      );
      const tileUrl = window.__osmTileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const attribution = window.__osmAttribution || '© OpenStreetMap contributors';
      window.L.tileLayer(tileUrl, { attribution }).addTo(map);
      return map;
    } catch (e) {
      return null;
    }
  }
  return initAMap(containerId, options);
}

export function drawTrackOnMap(map, points) {
  if (!map || !points || points.length < 2) return;
  if (window.__activeMapProvider === 'mapbox' && window.mapboxgl && map.addSource) {
    const geojson = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
    };
    if (map.getSource('track-line')) map.getSource('track-line').setData(geojson);
    else {
      map.addSource('track-line', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'track-layer',
        type: 'line',
        source: 'track-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3d8a9e', 'line-width': 4 },
      });
    }
    return;
  }
  if (window.__activeMapProvider === 'osm' && window.L && typeof map.addLayer === 'function') {
    try {
      const latlngs = points.map((p) => [p.lat, p.lng]);
      window.L.polyline(latlngs, { color: '#3d8a9e', weight: 4 }).addTo(map);
      return;
    } catch (e) {}
  }
  if (typeof AMap !== 'undefined') {
    const path = points.map((p) => new AMap.LngLat(p.lng, p.lat));
    new AMap.Polyline({ path, strokeColor: '#3d8a9e', strokeWeight: 4, map });
  }
}

/*
Phase 2 - Track Recording
export function initTrackMap() {
  if (this.trackMap) {
    if (this.trackMapEngine === 'leaflet') {
      try { this.trackMap.invalidateSize(); } catch (e) {}
    } else {
      try { this.trackMap.resize(); } catch (e) {}
    }
    return;
  }
  if (window.L && document.getElementById('track-map')) {
    try {
      this.trackMap = window.L.map('track-map', { zoomControl: true }).setView([39.90923, 116.397428], 13);
      this.trackMapEngine = 'leaflet';
      this.trackTileLayer = null;
      applyTrackMapLayer.call(this, this.activeMapLayer);
      return;
    } catch (e) {}
  }
  this.trackMap = initAMap('track-map', { zoom: 13 });
  this.trackMapEngine = this.trackMap ? 'amap' : '';
}

export function applyTrackMapLayer(layerKey) {
  const normalized = this.mapLayerOptions.some((layer) => layer.key === layerKey) ? layerKey : 'standard';
  const layer = this.mapLayerOptions.find((item) => item.key === normalized) || this.mapLayerOptions[0];
  this.activeMapLayer = layer.key;
  try { localStorage.setItem('summitlink_map_layer', layer.key); } catch (e) {}
  if (this.trackMapEngine !== 'leaflet' || !this.trackMap || !window.L) return;
  if (this.trackTileLayer) {
    try { this.trackMap.removeLayer(this.trackTileLayer); } catch (e) {}
  }
  this.trackTileLayer = window.L.tileLayer(layer.tileUrl, { attribution: layer.attribution, maxZoom: 19 });
  this.trackTileLayer.addTo(this.trackMap);
}

export function switchTrackMapLayer(layerKey) {
  applyTrackMapLayer.call(this, layerKey);
  this.showTrackLayerPanel = false;
}

export function locateMe() {
  initTrackMap.call(this);
  if (!this.trackMap) return;
  if (this.trackMapEngine === 'leaflet') {
    if (!navigator.geolocation) {
      this.showToast('当前设备不支持定位', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      this.trackMap.setView([lat, lng], 15);
      if (this.trackLocationMarker) {
        try { this.trackMap.removeLayer(this.trackLocationMarker); } catch (e) {}
      }
      this.trackLocationMarker = window.L.marker([lat, lng]).addTo(this.trackMap);
    }, (error) => {
      const code = error && typeof error.code === 'number' ? error.code : 0;
      const msg = code === 1 ? '定位权限被拒绝，请在系统设置中开启定位权限' : code === 3 ? '定位超时，请检查网络后重试' : '定位失败，请检查定位权限或网络连接';
      this.showToast(msg, 'error');
    }, { enableHighAccuracy: true, timeout: 10000 });
    return;
  }
  if (typeof AMap === 'undefined') return;
  AMap.plugin('AMap.Geolocation', () => {
    const geo = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000 });
    this.trackMap.addControl(geo);
    geo.getCurrentPosition((status, result) => {
      if (status === 'complete' && result.position) {
        this.trackMap.setCenter([result.position.lng, result.position.lat]);
        this.trackMap.setZoom(15);
        new AMap.Marker({ position: result.position, map: this.trackMap });
      } else {
        this.showToast('定位失败，请检查GPS权限', 'error');
      }
    });
  });
}

export function locateRecordingMap() {
  const activeMap = this.recordingMap || this.trackMap;
  if (!activeMap || typeof AMap === 'undefined') return;
  AMap.plugin('AMap.Geolocation', () => {
    const geo = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000 });
    activeMap.addControl(geo);
    geo.getCurrentPosition((status, result) => {
      if (status === 'complete' && result.position) {
        activeMap.setCenter([result.position.lng, result.position.lat]);
        activeMap.setZoom(15);
      } else {
        this.showToast('定位失败，请检查GPS权限', 'error');
      }
    });
  });
}

export function renderTrackDetailMap(track) {
  if (typeof AMap === 'undefined' || !track || !track.points || track.points.length < 2) return;
  try {
    const mapEl = document.getElementById('track-detail-map');
    if (!mapEl) return;
    const center = [track.points[0].lng, track.points[0].lat];
    const detailMap = new AMap.Map('track-detail-map', { zoom: 13, center, mapStyle: 'amap://styles/dark' });
    AMap.convertFrom(track.points.map((p) => [p.lng, p.lat]), 'gps', (status, result) => {
      const rawPoints = track.points.map((p) => new AMap.LngLat(p.lng, p.lat));
      const path = status === 'complete' ? result.locations : rawPoints;
      new AMap.Polyline({ path, strokeColor: '#3d8a9e', strokeWeight: 4, map: detailMap });
      new AMap.Marker({ position: path[0], map: detailMap, label: { content: '起点', offset: new AMap.Pixel(-10, -30) } });
      new AMap.Marker({ position: path[path.length - 1], map: detailMap, label: { content: '终点', offset: new AMap.Pixel(-10, -30) } });
      detailMap.setFitView();
    });
  } catch (e) {}
}
*/

function clearPeakLocationMap(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return null;

  if (el._leafletMap) {
    try { el._leafletMap.remove(); } catch (e) {}
    el._leafletMap = null;
  }
  if (el._peakLocationMap) {
    try {
      if (typeof el._peakLocationMap.remove === 'function') el._peakLocationMap.remove();
      else if (typeof el._peakLocationMap.destroy === 'function') el._peakLocationMap.destroy();
    } catch (e) {}
    el._peakLocationMap = null;
  }
  if (el._leaflet_id) {
    try { window.L.DomUtil.get(containerId)._leaflet_id = null; } catch (e) {}
  }
  el.innerHTML = '';
  return el;
}

export async function renderPeakLocationMap(containerId, lat, lng, peakName, altitude) {
  const el = clearPeakLocationMap(containerId);
  if (!el || lat == null || lng == null) {
    if (el) el.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500 text-sm">位置信息暂未收录</div>';
    return null;
  }

  const provider = window.__activeMapProvider;

  if (provider === 'mapbox' && window.mapboxgl) {
    try {
      const map = new window.mapboxgl.Map({
        container: containerId,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: [lng, lat],
        zoom: 9,
        interactive: true,
      });
      map.on('load', () => {
        new window.mapboxgl.Marker({ color: '#ef4444' })
          .setLngLat([lng, lat])
          .setPopup(new window.mapboxgl.Popup().setHTML(`<b>${peakName}</b><br>${altitude ? altitude + 'm' : ''}`))
          .addTo(map);
      });
      el._peakLocationMap = map;
      return map;
    } catch (e) {
      return null;
    }
  }

  if (window.L) {
    try {
      const map = window.L.map(containerId, { zoomControl: true }).setView([lat, lng], 9);
      const tileUrl = window.__osmTileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      window.L.tileLayer(tileUrl, { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      const marker = window.L.marker([lat, lng]).addTo(map);
      marker.bindPopup(`<b>${peakName}</b>${altitude ? '<br>' + altitude + 'm' : ''}`).openPopup();
      el._leafletMap = map;
      el._peakLocationMap = map;
      return map;
    } catch (e) {
      return null;
    }
  }

  if (typeof AMap !== 'undefined') {
    try {
      const map = new AMap.Map(containerId, { zoom: 9, center: [lng, lat], mapStyle: 'amap://styles/dark' });
      new AMap.Marker({
        position: new AMap.LngLat(lng, lat),
        map,
        label: {
          content: `<div style="background:#1e293b;color:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;">${peakName}${altitude ? ' ' + altitude + 'm' : ''}</div>`,
          offset: new AMap.Pixel(-20, -40),
        },
      });
      el._peakLocationMap = map;
      return map;
    } catch (e) {
      return null;
    }
  }

  el.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500 text-sm">地图加载失败</div>';
  return null;
}
