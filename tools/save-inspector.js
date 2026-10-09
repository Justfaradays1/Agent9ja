// tools/save-inspector.js — human-readable save summary (M006).
// Usage: node tools/save-inspector.js <save.json> [--full]
// Prints store sections and counts, never judgments. --full prints the raw
// snapshot string (explicit: may contain private playthrough data; local only).
import { readFileSync } from 'node:fs';
import { parseEnvelope, inspectSnapshot } from '../sim/save/index.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/save-inspector.js <save.json> [--full]');
  process.exit(2);
}
try {
  const parsed = parseEnvelope(readFileSync(file, 'utf8'));
  const summary = inspectSnapshot(parsed.snapshotObj);
  console.log(JSON.stringify({
    file,
    migratedFrom: parsed.migratedFrom,
    contentMismatch: parsed.contentMismatch,
    ...summary,
  }, null, 2));
  if (process.argv.includes('--full')) console.log(parsed.snapshot);
} catch (err) {
  console.error(`inspect failed: ${err.message}`);
  process.exit(1);
}
