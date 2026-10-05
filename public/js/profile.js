// Lightweight elevation profile rendered as inline SVG (no chart library).
import { haversine } from './geo.js';

const WIDTH = 680;
const HEIGHT = 180;
const PAD_X = 6;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

/** Build { distancesKm, elevations, minEle, maxEle } from raw points. */
export function elevationSeries(points) {
  const distances = [0];
  const elevations = [];
  let total = 0;
  let previous = null;
  for (const point of points) {
    if (previous) total += haversine(previous, point) / 1000;
    distances.push(total);
    elevations.push(point.ele ?? null);
    previous = point;
  }
  const valid = elevations.filter((e) => Number.isFinite(e));
  return {
    distancesKm: distances,
    elevations,
    minEle: valid.length ? Math.min(...valid) : null,
    maxEle: valid.length ? Math.max(...valid) : null,
  };
}

export function renderProfile(container, points) {
  container.innerHTML = '';
  const { distancesKm, elevations, minEle, maxEle } = elevationSeries(points);
  if (minEle === null || elevations.length < 2) {
    container.innerHTML = '<div class="profile-empty">Keine Höhendaten vorhanden.</div>';
    return;
  }

  const totalKm = distancesKm[distancesKm.length - 1] || 1;
  const range = Math.max(20, maxEle - minEle);
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (km) => PAD_X + (km / totalKm) * (WIDTH - PAD_X * 2);
  const y = (ele) => PAD_TOP + ((maxEle - ele) / range) * plotHeight;

  let started = false;
  let line = '';
  let area = `M ${PAD_X} ${HEIGHT - PAD_BOTTOM}`;
  for (let i = 0; i < elevations.length; i++) {
    const ele = elevations[i];
    if (!Number.isFinite(ele)) continue;
    const px = x(distancesKm[i]).toFixed(1);
    const py = y(ele).toFixed(1);
    line += `${started ? ' L' : 'M'} ${px} ${py}`;
    area += ` L ${px} ${py}`;
    started = true;
  }
  area += ` L ${WIDTH - PAD_X} ${HEIGHT - PAD_BOTTOM} Z`;

  const svg = `<svg class="profile-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" role="img" aria-label="Höhenprofil">
  <defs>
    <linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#05aab9" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#05aab9" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  <path d="${area}" fill="url(#profile-fill)" />
  <path d="${line}" fill="none" stroke="#05aab9" stroke-width="2" stroke-linejoin="round"/>
  <text x="${PAD_X}" y="${PAD_TOP - 2}" class="profile-label">${maxEle} m</text>
  <text x="${PAD_X}" y="${HEIGHT - 6}" class="profile-label">${minEle} m</text>
  <text x="${WIDTH - PAD_X}" y="${HEIGHT - 6}" text-anchor="end" class="profile-label">${totalKm.toFixed(1)} km</text>
</svg>`;

  container.innerHTML = svg;
}