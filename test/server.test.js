import { describe, expect, test } from 'bun:test';
import { resolvePublicPath } from '../index.js';

describe('static server', () => {
  test('serves the app for the root path', () => {
    expect(resolvePublicPath('/')).toMatch(/public\/index\.html$/);
  });

  test('resolves static assets', () => {
    expect(resolvePublicPath('/css/style.css')).toMatch(/public\/css\/style\.css$/);
    expect(resolvePublicPath('/js/app.js')).toMatch(/public\/js\/app\.js$/);
  });

  test('blocks path traversal', () => {
    expect(resolvePublicPath('/../index.js')).toBeNull();
    expect(resolvePublicPath('/..%2Findex.js')).toBeNull();
    expect(resolvePublicPath('/../../etc/passwd')).toBeNull();
  });
});