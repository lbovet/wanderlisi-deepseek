// Leaflet map: Swiss topographic base map with all hike tracks.
//
// Tracks are coloured by status (done vs. planned). Start points are clustered
// with a tiny screen-grid implementation on low zoom levels — no marker-cluster
// plugin needed for 30–100 hikes.

const SWISS_BOUNDS = [
  [45.7, 5.8],
  [47.9, 10.6],
];

export const STATUS_COLORS = {
  done: '#2e9e4f',
  planned: '#a855f7',
};

const TILE_URL =
  'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg';
const CLUSTER_ZOOM = 12;
const CLUSTER_PIXEL_SIZE = 64;

export class HikeMap {
  constructor(elementId, { onSelect } = {}) {
    this.onSelect = onSelect || (() => {});
    this.hikes = [];
    this.lines = new Map(); // id -> L.Polyline
    this.statusById = new Map(); // id -> status
    this.selectedId = null;

    this.map = L.map(elementId, {
      zoomControl: false,
      attributionControl: true,
      maxBounds: L.latLngBounds(SWISS_BOUNDS).pad(0.2),
      maxBoundsViscosity: 0.6,
      minZoom: 7,
      maxZoom: 18,
    }).setView([46.8, 8.2], 8);

    L.tileLayer(TILE_URL, {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.swisstopo.admin.ch/">swisstopo</a> | Wanderlisi',
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(this.map);

    this.linesLayer = L.layerGroup().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.map.on('zoomend', () => this.renderMarkers());
  }

  setHikes(hikes) {
    this.hikes = hikes.filter((hike) => Array.isArray(hike.points) && hike.points.length > 1);
    this.linesLayer.clearLayers();
    this.lines.clear();
    this.statusById.clear();

    for (const hike of this.hikes) {
      const latlngs = hike.points.map((p) => [p.lat, p.lon]);
      const color = STATUS_COLORS[hike.status] || STATUS_COLORS.planned;
      const line = L.polyline(latlngs, {
        color,
        weight: hike.status === 'done' ? 5 : 4,
        opacity: 0.85,
        lineJoin: 'round',
      });
      line.on('click', () => this.select(hike.id, { fit: false }));
      line.bindTooltip(hike.title || 'Wanderung', { sticky: true });
      line.addTo(this.linesLayer);
      this.lines.set(hike.id, line);
      this.statusById.set(hike.id, hike.status);
    }

    this.renderMarkers();
    if (this.selectedId) this.highlight(this.selectedId);
  }

  highlight(id) {
    for (const [lineId, line] of this.lines) {
      const status = this.statusById.get(lineId);
      line.setStyle(this.statusColorAndWeight(status, lineId === id));
    }
    this.selectedId = id;
  }

  statusColorAndWeight(status, selected) {
    return {
      color: STATUS_COLORS[status] || STATUS_COLORS.planned,
      weight: selected ? 8 : status === 'done' ? 5 : 4,
      opacity: selected ? 1 : 0.85,
    };
  }

  select(id, { fit = true } = {}) {
    this.highlight(id);
    const hike = this.hikes.find((h) => h.id === id);
    if (fit && hike) this.fitHike(id);
    this.onSelect(id);
  }

  fitHike(id) {
    const line = this.lines.get(id);
    if (!line) return;
    this.map.fitBounds(line.getBounds(), { padding: [60, 60], maxZoom: 15 });
  }

  fitAll() {
    if (!this.lines.size) {
      this.map.setView([46.8, 8.2], 8);
      return;
    }
    const group = L.featureGroup([...this.lines.values()]);
    this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
  }

  // --- start-point clustering ---------------------------------------------

  renderMarkers() {
    this.markersLayer.clearLayers();
    if (!this.hikes.length) return;
    const zoom = this.map.getZoom();

    if (zoom >= CLUSTER_ZOOM) {
      for (const hike of this.hikes) {
        this.addStartMarker(hike, 9);
      }
      return;
    }

    const grid = new Map();
    for (const hike of this.hikes) {
      const start = hike.points[0];
      const projected = this.map.project([start.lat, start.lon], zoom);
      const key = `${Math.floor(projected.x / CLUSTER_PIXEL_SIZE)}:${Math.floor(projected.y / CLUSTER_PIXEL_SIZE)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push({ hike, latlng: [start.lat, start.lon] });
    }

    for (const group of grid.values()) {
      if (group.length === 1) {
        this.addStartMarker(group[0].hike, 8);
      } else {
        const center = group.reduce(
          (acc, item) => [acc[0] + item.latlng[0] / group.length, acc[1] + item.latlng[1] / group.length],
          [0, 0],
        );
        const marker = L.marker(center, {
          icon: L.divIcon({
            className: 'hike-cluster',
            html: `<span>${group.length}</span>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
        });
        marker.on('click', () => {
          const bounds = L.latLngBounds(group.map((item) => item.latlng)).pad(0.05);
          this.map.fitBounds(bounds, { maxZoom: CLUSTER_ZOOM + 1 });
        });
        marker.addTo(this.markersLayer);
      }
    }
  }

  addStartMarker(hike, radius) {
    const start = hike.points[0];
    const marker = L.circleMarker([start.lat, start.lon], {
      radius,
      color: '#ffffff',
      weight: 2,
      fillColor: STATUS_COLORS[hike.status] || STATUS_COLORS.planned,
      fillOpacity: 1,
    });
    marker.bindTooltip(hike.title || 'Wanderung', { direction: 'top' });
    marker.on('click', () => this.select(hike.id));
    marker.addTo(this.markersLayer);
  }

  invalidateSize() {
    this.map.invalidateSize();
  }
}