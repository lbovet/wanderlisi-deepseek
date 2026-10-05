// Minimal hello-world application scaffolded by dev-center.
const APP_NAME = 'wanderlisi-deepseek';
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/health') {
      return new Response('ok', { headers: { 'Content-Type': 'text/plain' } });
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0a0a0f;
      color: #c8c8d4;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    h1 {
      font-size: 2.6rem;
      letter-spacing: 0.06rem;
      color: #fff;
      text-shadow: 0 0 24px rgba(0, 229, 255, 0.35);
    }
    p { color: #6a6a7a; font-family: 'Courier New', monospace; }
  </style>
</head>
<body>
  <h1>${APP_NAME}</h1>
  <p>hello world · served by dev-center</p>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
});

console.log(`${APP_NAME} serving on port ${PORT}`);
