// Minimal static server for the game/ folder (Node standard library only).
// Usage: node serve.ts [--port 8080] [--host 127.0.0.1]

import { createServer } from "node:http";
import { createReadStream, stat } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The folder served, resolved next to this script.
const ROOT = resolve(fileURLToPath(new URL("./game/", import.meta.url)));

// Extension -> Content-Type. Unknown extensions fall back to octet-stream.
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".txt": "text/plain; charset=utf-8",
};

// Read --port / --host from argv, accepting both "--flag value" and
// "--flag=value" spellings. Anything else is ignored.
function parseArgs(argv) {
  const opts = { port: 8080, host: "127.0.0.1" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    let key = arg;
    let value = null;
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      key = arg.slice(0, eq);
      value = arg.slice(eq + 1);
    } else if (arg === "--port" || arg === "--host") {
      value = argv[i + 1];
      i += 1;
    }
    if (key === "--port" && value !== null) {
      const n = Number.parseInt(value, 10);
      if (Number.isFinite(n)) opts.port = n;
    } else if (key === "--host" && value !== null) {
      opts.host = value;
    }
  }
  return opts;
}

function mimeFor(filePath) {
  return MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

// Turn a request path into an absolute path, or null when it would
// escape the served folder.
function resolveInside(requestPath) {
  const cleaned = requestPath === "/" ? "/index.html" : requestPath;
  const candidate = resolve(join(ROOT, cleaned));
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  return candidate;
}

function handleRequest(req, res) {
  const started = Date.now();
  const finish = (status) => {
    const ms = Date.now() - started;
    console.log(`${req.method} ${req.url} ${status} ${ms}ms`);
  };

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  } catch {
    res.writeHead(400, { "cache-control": "no-store" });
    res.end("bad request");
    finish(400);
    return;
  }

  const target = resolveInside(pathname);
  if (target === null) {
    res.writeHead(403, { "cache-control": "no-store" });
    res.end("forbidden");
    finish(403);
    return;
  }

  stat(target, (err, info) => {
    if (err || !info.isFile()) {
      res.writeHead(404, { "cache-control": "no-store" });
      res.end("not found");
      finish(404);
      return;
    }
    const headers = {
      "content-type": mimeFor(target),
      "content-length": info.size,
      "cache-control": "no-store",
    };
    res.writeHead(200, headers);
    if (req.method === "HEAD") {
      res.end();
      finish(200);
      return;
    }
    const stream = createReadStream(target);
    stream.on("error", () => {
      if (!res.headersSent) res.writeHead(404, { "cache-control": "no-store" });
      res.end("not found");
      finish(404);
    });
    stream.on("end", () => finish(200));
    stream.pipe(res);
  });
}

const { port, host } = parseArgs(process.argv.slice(2));
createServer(handleRequest).listen(port, host, () => {
  console.log(`game/ is on http://localhost:${port}`);
});
