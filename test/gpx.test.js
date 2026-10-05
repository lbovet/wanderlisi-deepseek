import { describe, expect, test } from 'bun:test';
import {
  parseGpx,
  computeStats,
  buildHikeFromGpx,
  fallbackTitle,
  formatDuration,
} from '../public/js/gpx.js';

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <metadata><name>Metadata name</name></metadata>
  <trk>
    <name>First – Faulhorn – Schynige Platte</name>
    <type>hiking</type>
    <trkseg>
      <trkpt lat="46.6" lon="7.9"><ele>1000</ele><time>2024-06-01T08:00:00Z</time></trkpt>
      <trkpt lat="46.61" lon="7.91"><ele>1100</ele><time>2024-06-01T09:00:00Z</time></trkpt>
      <trkpt lat="46.62" lon="7.92"><ele>1050</ele><time>2024-06-01T10:00:00Z</time></trkpt>
    </trkseg>
  </trk>
  <extensions><sac_scale>mountain_hiking</sac_scale></extensions>
</gpx>`;

describe('gpx', () => {
  test('parses name, points, elevation and time', () => {
    const parsed = parseGpx(GPX);
    expect(parsed.name).toBe('First – Faulhorn – Schynige Platte');
    expect(parsed.sacScale).toBe('mountain_hiking');
    expect(parsed.points).toHaveLength(3);
    expect(parsed.points[0]).toMatchObject({ lat: 46.6, lon: 7.9, ele: 1000 });
    expect(parsed.points[0].time).toBe(Date.parse('2024-06-01T08:00:00Z'));
  });

  test('rejects invalid documents and point-less tracks', () => {
    expect(() => parseGpx('<html></html>')).toThrow();
    expect(() => parseGpx('<gpx><trk><trkseg></trkseg></trk></gpx>')).toThrow();
  });

  test('computes ascent, descent, distance and actual duration', () => {
    const stats = computeStats(parseGpx(GPX).points);
    expect(stats.ascentM).toBe(100);
    expect(stats.descentM).toBe(50);
    expect(stats.minEle).toBe(1000);
    expect(stats.maxEle).toBe(1100);
    expect(stats.distanceKm).toBeGreaterThan(2.5);
    expect(stats.actualDurationMin).toBe(120);
    expect(stats.durationMin).toBe(120);
  });

  test('estimates duration from distance and ascent when times are missing', () => {
    const points = [
      { lat: 46.6, lon: 7.9, ele: 1000, time: null },
      { lat: 46.61, lon: 7.91, ele: 1300, time: null },
    ];
    const stats = computeStats(points);
    expect(stats.actualDurationMin).toBeNull();
    // 4 km/h + 300 m/h rule of thumb must produce a positive estimate.
    expect(stats.estimatedDurationMin).toBeGreaterThan(30);
    expect(stats.durationMin).toBe(stats.estimatedDurationMin);
  });

  test('builds a hike from gpx with difficulty from sac_scale', () => {
    const hike = buildHikeFromGpx(GPX, 'track.gpx');
    expect(hike.title).toBe('First – Faulhorn – Schynige Platte');
    expect(hike.difficulty).toBe(2);
    expect(hike.difficultySource).toBe('sac_scale');
    expect(hike.points).toHaveLength(3);
  });

  test('falls back to a cleaned file name', () => {
    expect(fallbackTitle('my_hike-track.gpx')).toBe('My hike track');
    expect(fallbackTitle('.gpx')).toBe('Neue Wanderung');
  });

  test('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 h 00 min');
    expect(formatDuration(135)).toBe('2 h 15 min');
  });
});