// Wanderlisi V2.0 — static frontend MVP server.
//
// The MVP has no database and no login: all hike data lives in the browser
// (localStorage + IndexedDB). This server only serves the static app and a
// health endpoint, which keeps local testing and Dokku deploys trivial.
import { join, normalize, extname } from 'node:path';

const APP_NAME = 'wanderlisi';
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const PUBLIC_DIR = join(import.meta.dir, 'public');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.gpx': 'application/gpx+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function contentType(path) {
  return CONTENT_TYPES[extname(path).toLowerCase()] || 'application/octet-stream';
}

/** Resolve a request path safely inside PUBLIC_DIR (blocks traversal). */
export function resolvePublicPath(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]);
  const relative = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  const resolved = normalize(join(PUBLIC_DIR, relative));
  if (!resolved.startsWith(PUBLIC_DIR)) {
    return null;
  }
  return resolved;
}

async function serveFile(path) {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  return new Response(file, {
    headers: { 'Content-Type': contentType(path), 'Cache-Control': 'no-cache' },
  });
}

export function createServer(port = PORT) {
  return Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/health') {
        return new Response('ok', { headers: { 'Content-Type': 'text/plain' } });
      }

      const path = resolvePublicPath(url.pathname);
      if (!path) return new Response('Not found', { status: 404 });

      const response = await serveFile(path);
      if (response) return response;

      // Single-page app routes fall back to index.html.
      if (!extname(url.pathname)) {
        const fallback = await serveFile(join(PUBLIC_DIR, 'index.html'));
        if (fallback) return fallback;
      }

      return new Response('Not found', { status: 404 });
    },
  });
}

if (import.meta.main) {
  createServer();
  console.log(`${APP_NAME} serving on port ${PORT}`);
}