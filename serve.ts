// serve.ts — Neon Tide "Golden Hour" local server.
//
// Serves the static files under game/ so the entry can be played in a
// browser without any build step or install (Node 22, standard library
// only):
//   node serve.ts                    game/ on http://localhost:8080
//   node serve.ts --port 8090        another port
//   node serve.ts --host 0.0.0.0     listen on another interface
// Every request is answered from disk with the MIME type a browser game
// needs; anything outside game/ is refused, and nothing is ever written
// back. A development convenience, not a server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

/** Read --port / --host out of argv (both `--flag value` and `--flag=value`). */
function parseArgs(argv) {
  let port = 8080;
  let host = '127.0.0.1';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    let flag = arg;
    let value = argv[i + 1];
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      flag = arg.slice(0, eq);
      value = arg.slice(eq + 1);
    } else if (flag === '--port' || flag === '--host') {
      i++;
    }
    if (flag === '--port') {
      const n = Number(value);
      if (Number.isInteger(n) && n > 0 && n < 65536) port = n;
    } else if (flag === '--host' && typeof value === 'string' && value.length > 0) {
      host = value;
    }
  }
  return { port, host };
}

/** The MIME type for a file path, falling back to a generic binary type. */
function mimeFor(file) {
  return MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Resolve a request path to a file under the game root. Returns null when
 * the path would escape the root, so no request can ever read outside
 * game/ no matter how it is spelled.
 */
function resolveInside(pathname) {
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) return null;
  return file;
}

/** One request: validate, then stream the file (headers only for HEAD). */
function handleRequest(request, response) {
  const started = Date.now();
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolveInside(pathname);
  if (file === null) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let size;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': mimeFor(file),
    'content-length': size,
    'cache-control': 'no-store',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = createReadStream(file);
  stream.on('error', () => response.destroy());
  stream.pipe(response);
  response.on('finish', () => {
    console.log(`${request.method} ${pathname} ${response.statusCode} ${Date.now() - started}ms`);
  });
}

const { port, host } = parseArgs(process.argv.slice(2));
createServer(handleRequest).listen(port, host, () => {
  const shown = host === '127.0.0.1' ? 'localhost' : host;
  console.log(`game/ is on http://${shown}:${port}`);
});
// serve.ts only ever serves game/ — the dossier screenshots live in
// screenshots/ at the repo root and are produced by the shot scripts in
// ~/workspace/makefun/gta6-01-work/ (gta6shots-v7.mjs reads shots.json),
// never by this server and never by hand.
