// NEON TIDE v5 — static dev server. Serves the repo root on :8080 so the
// game loads at http://localhost:8080/ (game/index.html) with no build
// step and no network requests. Node 22, standard library only.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let path = url === '/' ? '/game/index.html' : url;
  let file = join(root, path);
  // The game lives under game/ but is served at /: a request for /src/x
  // falls back to game/src/x so the page's relative module paths resolve.
  if ((!existsSync(file) || !statSync(file).isFile()) && path !== '/game/index.html') {
    const alt = join(root, 'game', path.replace(/^\//, ''));
    if (existsSync(alt) && statSync(alt).isFile()) file = alt;
  }
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(readFileSync(file));
});

server.listen(8080, () => console.log('NEON TIDE serving on http://localhost:8080/'));
