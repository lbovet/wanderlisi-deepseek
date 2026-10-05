import { describe, expect, test } from 'bun:test';
import {
  normalizeSacScale,
  estimateDifficulty,
  difficultyInfo,
  difficultyLabel,
} from '../public/js/difficulty.js';

describe('difficulty', () => {
  test('normalizes sac_scale tags', () => {
    expect(normalizeSacScale('hiking')).toBe(1);
    expect(normalizeSacScale('mountain_hiking')).toBe(2);
    expect(normalizeSacScale('Demanding Mountain Hiking')).toBe(3);
    expect(normalizeSacScale('nonsense')).toBeNull();
    expect(normalizeSacScale(null)).toBeNull();
  });

  test('a sac_scale tag wins over the heuristic', () => {
    expect(estimateDifficulty({ distanceKm: 2, ascentM: 10, maxEle: 500 }, 'alpine_hiking')).toBe(4);
  });

  test('flat lowland hike is T1', () => {
    expect(estimateDifficulty({ distanceKm: 10, ascentM: 100, maxEle: 600 })).toBe(1);
  });

  test('steep high-alpine hike is harder', () => {
    expect(estimateDifficulty({ distanceKm: 5, ascentM: 800, maxEle: 2600 })).toBeGreaterThanOrEqual(3);
  });

  test('difficulty metadata exists for all levels', () => {
    for (let level = 1; level <= 6; level++) {
      expect(difficultyInfo(level).level).toBe(`T${level}`);
      expect(difficultyLabel(level)).toContain(`T${level}`);
    }
  });
});