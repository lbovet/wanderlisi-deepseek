import { describe, expect, test } from 'bun:test';
import { ImageSearchService, PlaceholderImageProvider } from '../public/js/services/images.js';
import { HeuristicDescriptionProvider, DescriptionService } from '../public/js/services/description.js';

describe('image search service', () => {
  test('placeholder provider returns the requested number of images', async () => {
    const provider = new PlaceholderImageProvider();
    const images = await provider.search({ title: 'Test', count: 4 });
    expect(images).toHaveLength(4);
    expect(images[0].url.startsWith('data:image/svg+xml')).toBe(true);
  });

  test('falls back to the next provider when one fails', async () => {
    const failing = {
      async search() {
        throw new Error('offline');
      },
    };
    const service = new ImageSearchService([failing, new PlaceholderImageProvider()]);
    const images = await service.search({ title: 'Test', count: 3 });
    expect(images).toHaveLength(3);
  });
});

describe('description service', () => {
  test('heuristic provider describes the hike stats', async () => {
    const provider = new HeuristicDescriptionProvider();
    const result = await provider.generate({
      title: 'Testroute',
      difficulty: 3,
      stats: { distanceKm: 12.5, ascentM: 800, descentM: 750, maxEle: 2100, durationMin: 300 },
    });
    expect(result.text).toContain('Testroute');
    expect(result.text).toContain('12.5');
    expect(result.text).toContain('T3');
  });

  test('service falls back to the heuristic when no endpoint is set', async () => {
    const service = new DescriptionService({ endpoint: '' });
    const result = await service.generate({
      title: 'Route',
      difficulty: 1,
      stats: { distanceKm: 5, ascentM: 50, descentM: 50, maxEle: 800, durationMin: 80 },
    });
    expect(result.text.length).toBeGreaterThan(20);
  });
});