import { describe, expect, test } from 'bun:test';
import {
  haversine,
  distanceKm,
  boundingBox,
  centroid,
  simplify,
  downsample,
} from '../public/js/geo.js';

describe('geo', () => {
  test('haversine matches one degree of latitude', () => {
    const distance = haversine({ lat: 46, lon: 8 }, { lat: 47, lon: 8 });
    expect(distance).toBeGreaterThan(110000);
    expect(distance).toBeLessThan(112000);
  });

  test('distanceKm sums consecutive segments', () => {
    const km = distanceKm([
      { lat: 46, lon: 8 },
      { lat: 46.01, lon: 8 },
      { lat: 46.02, lon: 8 },
    ]);
    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(2.4);
  });

  test('boundingBox and centroid', () => {
    const points = [
      { lat: 46, lon: 7 },
      { lat: 47, lon: 9 },
    ];
    expect(boundingBox(points)).toEqual({ minLat: 46, maxLat: 47, minLon: 7, maxLon: 9 });
    expect(centroid(points)).toEqual({ lat: 46.5, lon: 8 });
  });

  test('simplify keeps endpoints and drops collinear noise', () => {
    const points = [];
    for (let i = 0; i <= 100; i++) {
      points.push({ lat: 46 + i * 0.0001, lon: 8 + (i % 2 === 0 ? 0 : 0.0000001), ele: 1000 + i });
    }
    const simplified = simplify(points, 5);
    expect(simplified[0]).toEqual(points[0]);
    expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
    expect(simplified.length).toBeLessThan(points.length);
  });

  test('downsample caps the number of points', () => {
    const points = Array.from({ length: 1000 }, (_, i) => ({ lat: 46 + i * 0.0001, lon: 8, ele: i }));
    const result = downsample(points, 100);
    expect(result.length).toBe(100);
    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]);
  });
});