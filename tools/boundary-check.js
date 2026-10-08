// M000 boundary stub: sim/ must never import game/.
// Run via tools/run-tests.js. No gameplay here.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const violations = [];

function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p, { throwIfNoEntry: false });
    if (!s) continue;
    if (s.isDirectory()) { walk(p); continue; }
    if (!['.js', '.mjs', '.cjs', '.ts'].includes(extname(p))) continue;
    const src = readFileSync(p, 'utf8');
    if (p.replace(/\\/g, '/').includes('/sim/') && /from\s+['"]\.\.\/\.\.\/game\//.test(src)) {
      violations.push(p + ': sim imports game');
    }
    if (p.replace(/\\/g, '/').includes('/game/') && /sim\//.test(src) && !p.replace(/\\/g, '/').includes('/game/bridge/')) {
      violations.push(p + ': game touches sim outside bridge (M000 stub check)');
    }
  }
}

try { walk(join(ROOT, 'sim')); walk(join(ROOT, 'game')); } catch { /* skeleton may be empty */ }

if (violations.length) {
  console.error('BOUNDARY FAIL\n' + violations.join('\n'));
  process.exit(1);
} else {
  console.log('boundary ok (M000 stub: no sim/game code yet)');
}
