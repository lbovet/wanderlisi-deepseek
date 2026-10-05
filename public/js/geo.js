// Geographic helpers used by the GPX pipeline and the map.
// Kept dependency-free so they run identically in the browser and in Bun tests.

const EARTH_RADIUS_M = 6371008.8;
const METERS_PER_DEG_LAT = 111320;

export function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two {lat, lon} points, in meters. */
export function haversine(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total horizontal length of a point list, in kilometers. */
export function distanceKm(points) {
  let meters = 0;
  for (let i = 1; i < points.length; i++) {
    meters += haversine(points[i - 1], points[i]);
  }
  return meters / 1000;
}

export function boundingBox(points) {
  if (!points.length) return null;
  const box = {
    minLat: Infinity,
    maxLat: -Infinity,
    minLon: Infinity,
    maxLon: -Infinity,
  };
  for (const p of points) {
    if (p.lat < box.minLat) box.minLat = p.lat;
    if (p.lat > box.maxLat) box.maxLat = p.lat;
    if (p.lon < box.minLon) box.minLon = p.lon;
    if (p.lon > box.maxLon) box.maxLon = p.lon;
  }
  return box;
}

export function centroid(points) {
  if (!points.length) return null;
  let lat = 0;
  let lon = 0;
  for (const p of points) {
    lat += p.lat;
    lon += p.lon;
  }
  return { lat: lat / points.length, lon: lon / points.length };
}

function metersPerDegLon(lat) {
  return METERS_PER_DEG_LAT * Math.cos(toRadians(lat));
}

function perpendicularDistanceMeters(p, a, b) {
  const latRef = a.lat;
  const scaleLon = metersPerDegLon(latRef);
  const ax = 0;
  const ay = 0;
  const bx = (b.lon - a.lon) * scaleLon;
  const by = (b.lat - a.lat) * METERS_PER_DEG_LAT;
  const px = (p.lon - a.lon) * scaleLon;
  const py = (p.lat - a.lat) * METERS_PER_DEG_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px, py);
  let t = (px * dx + py * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - t * dx, py - t * dy);
}

/**
 * Douglas–Peucker line simplification in meters. Keeps elevation/time of the
 * retained points so the elevation profile stays meaningful.
 */
export function simplify(points, toleranceMeters = 8) {
  if (points.length <= 2) return points.slice();
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const dist = perpendicularDistanceMeters(points[i], points[first], points[last]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (index !== -1 && maxDist > toleranceMeters) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Downsample to at most `max` points while always keeping the endpoints. */
export function downsample(points, max = 600) {
  if (points.length <= max) return points.slice();
  const step = (points.length - 1) / (max - 1);
  const result = [];
  for (let i = 0; i < max; i++) {
    result.push(points[Math.round(i * step)]);
  }
  return result;
}