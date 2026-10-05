// Internet image search, isolated behind a provider interface so a concrete
// API can later be plugged in or swapped without touching the UI.
//
// Default provider: Wikimedia Commons (free, no API key, CORS enabled).
// Fallback provider: locally generated SVG illustrations so the feature keeps
// working fully offline.

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const GRADIENTS = [
  ['#0e7490', '#67e8f9'],
  ['#166534', '#86efac'],
  ['#7c2d12', '#fdba74'],
  ['#4c1d95', '#c4b5fd'],
  ['#0c4a6e', '#7dd3fc'],
  ['#713f12', '#fde68a'],
];

/** Deterministic offline illustrations — one per requested slot. */
export class PlaceholderImageProvider {
  constructor(name = 'Illustration') {
    this.name = name;
  }

  async search({ title = 'Wanderung', count = 4 }) {
    const images = [];
    for (let i = 0; i < count; i++) {
      const seed = hashString(`${title}-${i}`);
      const [from, to] = GRADIENTS[seed % GRADIENTS.length];
      const label = title.length > 26 ? `${title.slice(0, 25)}…` : title;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>
  </linearGradient></defs>
  <rect width="800" height="520" fill="url(#g)"/>
  <path d="M0 400 L180 250 L320 360 L470 190 L650 400 L800 300 L800 520 L0 520 Z" fill="rgba(255,255,255,0.18)"/>
  <path d="M0 450 L150 320 L300 430 L520 280 L700 450 L800 380 L800 520 L0 520 Z" fill="rgba(0,0,0,0.15)"/>
  <text x="40" y="80" font-family="Segoe UI, sans-serif" font-size="30" fill="rgba(255,255,255,0.92)">${label}</text>
  <text x="40" y="120" font-family="Segoe UI, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">Wanderlisi · ${this.name}</text>
</svg>`;
      images.push({
        url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        thumbUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        title: label,
        source: this.name,
        link: null,
        author: null,
      });
    }
    return images;
  }
}

/** Wikimedia Commons image search (title keywords + geosearch around the track). */
export class WikimediaImageProvider {
  constructor({ fetchImpl = globalThis.fetch, endpoint = 'https://commons.wikimedia.org/w/api.php' } = {}) {
    this.fetch = fetchImpl;
    this.endpoint = endpoint;
    this.name = 'Wikimedia Commons';
  }

  async api(params) {
    const url = new URL(this.endpoint);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await this.fetch(url.toString(), { signal: controller.signal });
      if (!response.ok) throw new Error(`Wikimedia request failed: ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async searchByTitle(query, limit) {
    const data = await this.api({
      action: 'query',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6',
      gsrlimit: String(limit),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '900',
    });
    return this.toImages(data);
  }

  async searchByArea(centroid, limit) {
    if (!centroid) return [];
    const geo = await this.api({
      action: 'query',
      list: 'geosearch',
      gscoord: `${centroid.lat}|${centroid.lon}`,
      gsradius: '10000',
      gslimit: String(limit),
      gsnamespace: '6',
    });
    const ids = (geo.query?.geosearch || []).map((item) => item.pageid).filter(Boolean);
    if (!ids.length) return [];
    const data = await this.api({
      action: 'query',
      pageids: ids.join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '900',
    });
    return this.toImages(data);
  }

  toImages(data) {
    const pages = data?.query?.pages || {};
    const images = [];
    for (const page of Object.values(pages)) {
      const info = page.imageinfo?.[0];
      if (!info?.url) continue;
      if (!/\.(jpe?g|png|webp)$/i.test(info.url)) continue;
      const meta = info.extmetadata || {};
      images.push({
        url: info.thumburl || info.url,
        thumbUrl: info.thumburl || info.url,
        title: (page.title || '').replace(/^File:/, ''),
        source: this.name,
        link: info.descriptionurl || info.url,
        author: meta.Artist?.value ? String(meta.Artist.value).replace(/<[^>]+>/g, '').trim() : null,
      });
    }
    return images;
  }

  async search({ title = '', centroid = null, count = 4 }) {
    const query = title
      .replace(/[–—]/g, ' ')
      .replace(/\b(T\d|SAC|GPX)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const results = [];
    if (query) {
      try {
        results.push(...(await this.searchByTitle(query, count)));
      } catch {
        /* try geosearch next */
      }
    }
    if (results.length < count && centroid) {
      try {
        results.push(...(await this.searchByArea(centroid, count)));
      } catch {
        /* fall back to whatever we have */
      }
    }
    const seen = new Set();
    return results.filter((image) => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
  }
}

/**
 * Facade used by the UI. Providers are tried in order; the first one that
 * yields images wins. Errors never propagate — the placeholder provider keeps
 * the feature usable offline.
 */
export class ImageSearchService {
  constructor(providers = [new WikimediaImageProvider(), new PlaceholderImageProvider()]) {
    this.providers = providers;
  }

  async search(context) {
    const count = context.count ?? 4;
    for (const provider of this.providers) {
      try {
        const images = await provider.search({ ...context, count });
        if (images.length) return images.slice(0, count);
      } catch {
        // try the next provider
      }
    }
    return [];
  }
}