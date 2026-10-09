// tools/content-lint.js — content honesty enforcement.
// 1. Every content/**/*.json file must parse (bootWorld loads them; a broken
//    file would otherwise crash at runtime with an unhelpful error).
// 2. Memory kinds no gate consumes fail the build (P7: memory must be consumed).
// Usage: node tools/content-lint.js (exit 1 with reasons on failure).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATE_READS } from '../sim/memory/index.js';
import { validateStoryContent } from '../sim/story/index.js';
import { validateChatterRules, validateChatterVoices } from '../sim/comms/index.js';
import { validatePlaces, validateRoutines, validateWorldRules } from '../sim/world/index.js';
import { validatePersonDef } from '../sim/people/index.js';

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

// Storylets + director rules validate against the closed vocabularies so a
// content typo fails here loudly instead of silently never matching in-game.
try {
  const storylets = JSON.parse(readFileSync(new URL('../content/story/slice.json', import.meta.url), 'utf8'));
  const director = JSON.parse(readFileSync(new URL('../content/rules/director.json', import.meta.url), 'utf8'));
  const serr = validateStoryContent(storylets, director);
  if (serr) failures.push(`story content: ${serr}`);
} catch (err) {
  failures.push(`story content unreadable: ${err.message}`);
}

// Chatter rules + chat templates validate the same way: unknown templates or
// malformed rules fail here, not as silent no-chatter in-game.
try {
  const templates = JSON.parse(readFileSync(new URL('../content/strings/chat.json', import.meta.url), 'utf8'));
  const chatIds = templates.map((t) => t.id);
  const chatter = JSON.parse(readFileSync(new URL('../content/rules/chatter.json', import.meta.url), 'utf8'));
  const cerr = validateChatterRules(chatter, chatIds);
  if (cerr) failures.push(`chatter content: ${cerr}`);
} catch (err) {
  failures.push(`chatter content unreadable: ${err.message}`);
}

// Voice profiles + chatter voice consistency: every chatter speaker needs a
// voice, and none of their templates may carry their taboo phrases.
let chatIds = [];
let chatter = [];
try {
  const templates = JSON.parse(readFileSync(new URL('../content/strings/chat.json', import.meta.url), 'utf8'));
  chatIds = templates.map((t) => t.id);
  chatter = JSON.parse(readFileSync(new URL('../content/rules/chatter.json', import.meta.url), 'utf8'));
  const cerr = validateChatterRules(chatter, chatIds);
  if (cerr) failures.push(`chatter content: ${cerr}`);
} catch (err) {
  failures.push(`chatter content unreadable: ${err.message}`);
}
try {
  const npcs = JSON.parse(readFileSync(new URL('../content/people/npcs.json', import.meta.url), 'utf8'));
  for (const [i, d] of npcs.entries()) {
    const perr = validatePersonDef(d);
    if (perr) failures.push(`npcs[${i}]: ${perr}`);
  }
  const templates = JSON.parse(readFileSync(new URL('../content/strings/chat.json', import.meta.url), 'utf8'));
  const byId = Object.fromEntries(templates.map((t) => [t.id, t.text]));
  const voices = {};
  for (const d of npcs) if (d.voice) voices[d.id] = d.voice;
  const verr = validateChatterVoices(voices, chatter, byId);
  if (verr) failures.push(`chatter voices: ${verr}`);
} catch (err) {
  failures.push(`npc content unreadable: ${err.message}`);
}

// Places + routines + world rules: broken geography or unwalkable routine
// blocks fail here, not as stranded travellers mid-simulation.
try {
  const places = JSON.parse(readFileSync(new URL('../content/places/places.json', import.meta.url), 'utf8'));
  const perr = validatePlaces(places);
  if (perr) failures.push(`places content: ${perr}`);
  const routinesDoc = JSON.parse(readFileSync(new URL('../content/people/routines.json', import.meta.url), 'utf8'));
  const rerr = validateRoutines(routinesDoc.routines, places);
  if (rerr) failures.push(`routines content: ${rerr}`);
  const worldRules = JSON.parse(readFileSync(new URL('../content/rules/world.json', import.meta.url), 'utf8'));
  const werr = validateWorldRules(worldRules);
  if (werr) failures.push(`world rules content: ${werr}`);
} catch (err) {
  failures.push(`world content unreadable: ${err.message}`);
}

if (failures.length > 0) {
  console.error('CONTENT LINT FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`content lint ok (${jsonCount} JSON files parse; ${rules.length} memory rules, all kinds gate-consumed)`);
