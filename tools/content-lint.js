// tools/content-lint.js — content honesty enforcement.
// 1. Every content/**/*.json file must parse (bootWorld loads them; a broken
//    file would otherwise crash at runtime with an unhelpful error).
// 2. Memory kinds no gate consumes fail the build (P7: memory must be consumed).
// Usage: node tools/content-lint.js (exit 1 with reasons on failure).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATE_READS } from '../sim/memory/index.js';

const failures = [];
let jsonCount = 0;

function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p, { throwIfNoEntry: false });
    if (!s) continue;
    if (s.isDirectory()) { walk(p); continue; }
    if (extname(p) !== '.json') continue;
    jsonCount++;
    try {
      JSON.parse(readFileSync(p, 'utf8'));
    } catch (err) {
      failures.push(`${p}: invalid JSON (${err.message})`);
    }
  }
}

walk(join(dirname(fileURLToPath(import.meta.url)), '..', 'content'));

const consumed = new Set(Object.values(GATE_READS).flat());
const rules = JSON.parse(readFileSync(new URL('../content/rules/memory.json', import.meta.url), 'utf8'));
const orphans = [];
for (const r of rules) {
  for (const m of r.memories || []) {
    if (!consumed.has(m.kind) && !orphans.includes(m.kind)) orphans.push(m.kind);
  }
}
if (orphans.length > 0) failures.push(`unconsumed memory kinds: ${orphans.join(', ')}`);

if (failures.length > 0) {
  console.error('CONTENT LINT FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`content lint ok (${jsonCount} JSON files parse; ${rules.length} memory rules, all kinds gate-consumed)`);
