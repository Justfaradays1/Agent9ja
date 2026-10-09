// tools/scenario-runner.js — scripted playthroughs + deterministic replay proof.
// Usage: node tools/scenario-runner.js <script.json> [--twice]
// Script: { seed, steps: [{send:{...}} | {advance:n}], assert: [{path, equals}] }
// --twice: run the whole script twice from scratch, require identical snapshots.
import { readFileSync } from 'node:fs';
import { bootWorld } from './world.js';

function fnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function runOnce(script) {
  const { kernel } = bootWorld(script.seed || 'dev-seed');
  let n = 0;
  for (const step of script.steps || []) {
    if (step.send) {
      const r = kernel.dispatch(step.send);
      if (r.status === 'rejected') throw new Error(`rejected: ${r.reason}`);
    } else if (step.advance) {
      // Deterministic cmd_id (never Math.random — replay must be identical).
      kernel.dispatch({ cmd_id: `runner_adv_${n++}_${step.advance}`, type: 'advance_time', actor: 'runner', params: { steps: step.advance } });
    }
  }
  const snap = kernel.snapshot();
  const obj = JSON.parse(snap);
  const failures = [];
  for (const a of script.assert || []) {
    const got = getPath(obj, a.path);
    if (JSON.stringify(got) !== JSON.stringify(a.equals)) {
      failures.push({ path: a.path, got, want: a.equals });
    }
  }
  return { snap, hash: fnv1a(snap), failures };
}

const file = process.argv[2];
if (!file) { console.error('usage: node tools/scenario-runner.js <script.json> [--twice]'); process.exit(2); }
const script = JSON.parse(readFileSync(file, 'utf8'));
const twice = process.argv.includes('--twice');

const first = runOnce(script);
if (first.failures.length) {
  console.log(JSON.stringify({ ok: false, hash: first.hash, failures: first.failures }, null, 2));
  process.exit(1);
}
if (twice) {
  const second = runOnce(script);
  const identical = first.hash === second.hash && first.snap === second.snap;
  console.log(JSON.stringify({ ok: identical, hash: first.hash, replay: identical ? 'identical' : 'DIVERGED' }, null, 2));
  process.exit(identical ? 0 : 1);
}
console.log(JSON.stringify({ ok: true, hash: first.hash }, null, 2));
