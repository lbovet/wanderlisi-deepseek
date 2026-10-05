// AI hike description, isolated behind a service so a real model/API can be
// connected later. The MVP ships a local heuristic provider and an optional
// remote provider that activates as soon as an endpoint is configured
// (localStorage key `wanderlisi.ai.endpoint`).

import { formatDuration } from '../gpx.js';
import { difficultyInfo } from '../difficulty.js';

const AI_ENDPOINT_KEY = 'wanderlisi.ai.endpoint';

export function getAiEndpoint() {
  try {
    return globalThis.localStorage?.getItem(AI_ENDPOINT_KEY) || '';
  } catch {
    return '';
  }
}

export function setAiEndpoint(endpoint) {
  try {
    if (endpoint) globalThis.localStorage?.setItem(AI_ENDPOINT_KEY, endpoint);
    else globalThis.localStorage?.removeItem(AI_ENDPOINT_KEY);
  } catch {
    /* ignore */
  }
}

function pick(list, seed) {
  return list[seed % list.length];
}

/** Offline description built purely from the imported hike data. */
export class HeuristicDescriptionProvider {
  name = 'lokal';

  async generate(hike) {
    const stats = hike.stats || {};
    const difficulty = difficultyInfo(hike.difficulty || 1);
    const title = hike.title || 'Diese Wanderung';
    const parts = [];

    parts.push(`«${title}» ist eine Wanderung von ${stats.distanceKm ?? '?'} km Länge.`);
    parts.push(
      `Unterwegs werden ${stats.ascentM ?? 0} m Aufstieg sowie ${stats.descentM ?? 0} m Abstieg bewältigt.`,
    );

    if (stats.maxEle) {
      parts.push(`Der höchste Punkt liegt auf ${stats.maxEle} m ü. M.`);
    }

    parts.push(
      `Die Route ist als ${difficulty.level} (${difficulty.label}) eingestuft; die reine Gehzeit beträgt etwa ${formatDuration(stats.durationMin)}.`,
    );

    const seed = (hike.title || '').length;
    parts.push(
      pick(
        [
          'Die Aussicht auf dem Weg entschädigt für jede Steigung.',
          'Die Tour eignet sich gut für einen langen Tag in den Bergen.',
          'Für diese Route lohnt es sich, früh aufzubrechen.',
          'Wer die Höhenmeter ruhig angeht, wird mit weiten Blicken belohnt.',
        ],
        seed,
      ),
    );

    return { text: parts.join(' '), provider: this.name };
  }
}

/**
 * Optional remote provider. Expected contract:
 *   POST <endpoint> { hike }  ->  { description } | { text } | plain text
 */
export class RemoteDescriptionProvider {
  name = 'KI';

  constructor({ endpoint, fetchImpl = globalThis.fetch } = {}) {
    this.endpoint = endpoint;
    this.fetch = fetchImpl;
  }

  async generate(hike) {
    if (!this.endpoint) throw new Error('Kein KI-Endpunkt konfiguriert.');
    const response = await this.fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hike }),
    });
    if (!response.ok) throw new Error(`KI-Anfrage fehlgeschlagen: ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      const text = data.description || data.text || data.result;
      if (!text) throw new Error('Leere KI-Antwort.');
      return { text: String(text).trim(), provider: this.name };
    }
    const text = await response.text();
    if (!text.trim()) throw new Error('Leere KI-Antwort.');
    return { text: text.trim(), provider: this.name };
  }
}

export class DescriptionService {
  constructor({ heuristic = new HeuristicDescriptionProvider(), endpoint } = {}) {
    this.heuristic = heuristic;
    this.endpoint = endpoint;
  }

  /** Generate a description, falling back to the local provider on any error. */
  async generate(hike) {
    const endpoint = this.endpoint ?? getAiEndpoint();
    if (endpoint) {
      try {
        return await new RemoteDescriptionProvider({ endpoint }).generate(hike);
      } catch {
        // fall through to the heuristic
      }
    }
    return this.heuristic.generate(hike);
  }
}