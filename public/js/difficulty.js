// SAC hiking difficulty scale (T1–T6).
// Reference: Schweizer Alpen-Club Wander-Skala.

export const SAC_SCALE = {
  hiking: 1,
  mountain_hiking: 2,
  demanding_mountain_hiking: 3,
  alpine_hiking: 4,
  demanding_alpine_hiking: 5,
  difficult_alpine_hiking: 6,
};

export const DIFFICULTIES = {
  1: { level: 'T1', label: 'Wandern', color: '#2e9e4f' },
  2: { level: 'T2', label: 'Bergwandern', color: '#7bb241' },
  3: { level: 'T3', label: 'Anspruchsvolles Bergwandern', color: '#e0a800' },
  4: { level: 'T4', label: 'Alpinwandern', color: '#e07b00' },
  5: { level: 'T5', label: 'Anspruchsvolles Alpinwandern', color: '#d64545' },
  6: { level: 'T6', label: 'Schwieriges Alpinwandern', color: '#8e2f2f' },
};

/** Normalize a raw `sac_scale` tag to a T level 1–6, or null. */
export function normalizeSacScale(raw) {
  if (!raw) return null;
  const key = String(raw).toLowerCase().trim().replace(/[\s-]+/g, '_');
  return SAC_SCALE[key] ?? null;
}

/**
 * Estimate a SAC difficulty from hike statistics when no `sac_scale` tag is
 * present. This is a deliberately simple heuristic: gradient and altitude are
 * the two strongest signals available in a GPX file.
 */
export function estimateDifficulty(stats, sacScale) {
  const fromTag = normalizeSacScale(sacScale);
  if (fromTag) return fromTag;

  const distanceKm = stats.distanceKm || 0;
  const ascentM = stats.ascentM || 0;
  const maxEle = stats.maxEle ?? 0;

  // Average ascent gradient in percent, but ignore very short segments which
  // would otherwise dominate the average.
  const gradient = distanceKm > 0.5 ? ascentM / (distanceKm * 10) : 0;

  let level;
  if (gradient < 8) level = 1;
  else if (gradient < 15) level = 2;
  else if (gradient < 25) level = 3;
  else if (gradient < 40) level = 4;
  else level = 5;

  // High alpine terrain implies at least T3 even on gentle trails.
  if (maxEle >= 3000) level = Math.max(level, 4);
  else if (maxEle >= 2500) level = Math.max(level, 3);
  else if (maxEle >= 2000) level = Math.max(level, 2);

  return level;
}

export function difficultyInfo(level) {
  return DIFFICULTIES[level] || DIFFICULTIES[1];
}

export function difficultyLabel(level) {
  const info = difficultyInfo(level);
  return `${info.level} · ${info.label}`;
}