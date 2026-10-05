// GPX import: parsing and hike statistics.
// Uses lightweight tag scanning (no DOMParser / no XML dependency) so it runs
// both in the browser and in Bun tests.

import { distanceKm as geoDistanceKm } from './geo.js';
import { estimateDifficulty } from './difficulty.js';

function firstMatch(text, tag) {
  const match = text.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function unescapeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function attr(attributes, name) {
  const match = attributes.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return match ? match[1] : null;
}

/**
 * Parse a GPX document into { name, type, sacScale, points }.
 * `points` is [{ lat, lon, ele, time }] in document order.
 */
export function parseGpx(xml) {
  if (typeof xml !== 'string' || !xml.includes('<gpx')) {
    throw new Error('Keine gültige GPX-Datei.');
  }

  const trkMatch = xml.match(/<trk\b[^>]*>([\s\S]*?)<\/trk>/i);
  const trkBody = trkMatch ? trkMatch[1] : xml;
  const metadataMatch = xml.match(/<metadata\b[^>]*>([\s\S]*?)<\/metadata>/i);

  const name =
    (trkMatch && firstMatch(trkBody, 'name')) ||
    (metadataMatch && firstMatch(metadataMatch[1], 'name')) ||
    firstMatch(xml, 'name') ||
    null;

  const type = trkMatch ? firstMatch(trkBody, 'type') : firstMatch(xml, 'type');
  const sacScale = firstMatch(trkBody, 'sac_scale') || firstMatch(xml, 'sac_scale');

  const points = [];
  const pointRegex = /<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
  let match;
  while ((match = pointRegex.exec(xml)) !== null) {
    const attributes = match[2] || '';
    const inner = match[3] || '';
    const lat = Number.parseFloat(attr(attributes, 'lat'));
    const lon = Number.parseFloat(attr(attributes, 'lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const eleRaw = firstMatch(inner, 'ele');
    const ele = eleRaw !== null ? Number.parseFloat(eleRaw) : null;
    const timeRaw = firstMatch(inner, 'time');
    const time = timeRaw ? Date.parse(timeRaw) : null;

    points.push({
      lat,
      lon,
      ele: Number.isFinite(ele) ? ele : null,
      time: Number.isFinite(time) ? time : null,
    });
  }

  if (points.length < 2) {
    throw new Error('Die GPX-Datei enthält keinen Track mit mindestens zwei Punkten.');
  }

  return {
    name: name ? unescapeXml(name) : null,
    type: type ? unescapeXml(type) : null,
    sacScale: sacScale ? unescapeXml(sacScale) : null,
    points,
  };
}

/** Compute distance, ascent/descent, elevation range and duration. */
export function computeStats(points) {
  let ascent = 0;
  let descent = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;
  let reference = null;

  for (const point of points) {
    if (point.ele === null || !Number.isFinite(point.ele)) continue;
    if (point.ele < minEle) minEle = point.ele;
    if (point.ele > maxEle) maxEle = point.ele;
    if (reference === null) {
      reference = point.ele;
      continue;
    }
    const delta = point.ele - reference;
    // Hysteresis of 1 m filters out GPS elevation noise while keeping real climbs.
    if (delta > 1) {
      ascent += delta;
      reference = point.ele;
    } else if (delta < -1) {
      descent += -delta;
      reference = point.ele;
    }
  }

  const distance = geoDistanceKm(points);

  const timestamps = points.map((p) => p.time).filter((t) => Number.isFinite(t));
  const startTime = timestamps.length ? timestamps[0] : null;
  const endTime = timestamps.length ? timestamps[timestamps.length - 1] : null;
  const actualDurationMin =
    startTime !== null && endTime !== null && endTime > startTime
      ? Math.round((endTime - startTime) / 60000)
      : null;

  // DIN 33466 rule of thumb: 4 km/h horizontally, 300 m/h of ascent.
  const estimatedDurationMin = Math.round((distance / 4 + ascent / 300) * 60);
  const durationMin = actualDurationMin ?? estimatedDurationMin;

  return {
    distanceKm: Math.round(distance * 100) / 100,
    ascentM: Math.round(ascent),
    descentM: Math.round(descent),
    minEle: Number.isFinite(minEle) ? Math.round(minEle) : null,
    maxEle: Number.isFinite(maxEle) ? Math.round(maxEle) : null,
    durationMin,
    actualDurationMin,
    estimatedDurationMin,
    startTime,
    endTime,
  };
}

export function fallbackTitle(fileName) {
  const base = String(fileName || '')
    .replace(/\.gpx$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) return 'Neue Wanderung';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Build the hike fields derived from a GPX document. */
export function buildHikeFromGpx(xml, fileName = '') {
  const parsed = parseGpx(xml);
  const stats = computeStats(parsed.points);
  const difficulty = estimateDifficulty(stats, parsed.sacScale);
  return {
    title: parsed.name || fallbackTitle(fileName),
    stats,
    difficulty,
    difficultySource: parsed.sacScale ? 'sac_scale' : 'estimated',
    sourceType: parsed.type || null,
    points: parsed.points,
  };
}

export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '–';
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} min`;
  return `${hours} h ${String(mins).padStart(2, '0')} min`;
}

export function formatDistance(km) {
  if (km === null || km === undefined || !Number.isFinite(km)) return '–';
  return `${km.toFixed(1)} km`;
}