// tools/serve-debug.js — development-only static server for the M010 Phase 1
// debug client. Localhost only, no listing, no uploads, no auth (single
// operator debugging a local sim — same trust as the console tools).
// Serves ONLY these URL prefixes: / (redirects to the client), /game/,
// /sim/, /content/, /tests/scenario/ (read-only scenario JSON). Everything
// else 404s, including .git, tools/, and saves. Usage:
//   node tools/serve-debug.js [--port 8130]
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const ROOTS = ['/game/', '/sim/', '/content/', '/tests/scenario/'];

let port = 8130;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--port') port = Number(process.argv[++i]);
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('bad --port (1024..65535)');
  process.exit(2);
}

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/game/debug/index.html';
    if (!ROOTS.some((r) => path === r.slice(0, -1) || path.startsWith(r))) {
      res.writeHead(404); res.end('not found');
      return;
    }
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT + sep)) { res.writeHead(404); res.end('not found'); return; }
    const st = statSync(file, { throwIfNoEntry: false });
    if (!st || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(500); res.end('error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`debug client: http://127.0.0.1:${port}/ (localhost only, dev only)`);
});
