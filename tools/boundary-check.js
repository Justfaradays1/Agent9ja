// tools/boundary-check.js — architecture boundary enforcement (not a stub).
// Fails the suite on: sim→game imports (any form), debug-truth accessors used
// outside their defining modules / tools / tests, game→sim contact outside
// game/bridge. game/ is currently empty, so rule 3 passes vacuously by design
// (it activates the moment game code exists).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const violations = [];
const checked = { sim: 0, game: 0 };

function walk(dir, fn) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return; // missing dir is fine (e.g. game/ before M011)
  }
  for (const e of entries) {
    const p = join(dir, e);
    const s = statSync(p, { throwIfNoEntry: false });
    if (!s) continue;
    if (s.isDirectory()) { walk(p, fn); continue; }
    if (!['.js', '.mjs', '.cjs'].includes(extname(p))) continue;
    fn(p, readFileSync(p, 'utf8'));
  }
}

const norm = (p) => p.split(sep).join('/');
const inDir = (p, d) => norm(p).includes(`/${d}/`);

// Definers of privileged debug accessors (may reference their own names).
const DEBUG_DEFINERS = new Map([
  ['debugInspect', ['sim/knowledge/index.js', 'sim/memory/index.js']],
  ['debugFacts', ['sim/knowledge/index.js']],
  ['debugMemories', ['sim/memory/index.js']],
  ['debugBeliefs', ['sim/knowledge/index.js']],
]);

walk(join(ROOT, 'sim'), (p, src) => {
  checked.sim++;
  const n = norm(p);
  if (/from\s+['"][^'"]*game\//.test(src) || /import\s*\(\s*['"][^'"]*game\//.test(src) || /require\s*\(\s*['"][^'"]*game\//.test(src)) {
    violations.push(`${p}: sim imports game/`);
  }
  for (const [name, definers] of DEBUG_DEFINERS) {
    if (src.includes(name) && !definers.some((d) => n.endsWith(d))) {
      violations.push(`${p}: sim uses privileged debug accessor ${name} outside its defining module`);
    }
  }
});

walk(join(ROOT, 'game'), (p, src) => {
  checked.game++;
  const n = norm(p);
  if (n.includes('/game/bridge/')) return; // the single legal crossing
  if (/sim\//.test(src)) violations.push(`${p}: game touches sim/ outside game/bridge`);
});

if (violations.length) {
  console.error(`BOUNDARY FAIL (${checked.sim} sim files, ${checked.game} game files checked)\n` + violations.join('\n'));
  process.exit(1);
} else {
  console.log(`boundary ok (${checked.sim} sim files, ${checked.game} game files checked; debug accessors confined; bridge rule active)`);
}
