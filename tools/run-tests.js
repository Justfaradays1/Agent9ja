// M000+ test runner wrapper: unit tests + content lint + boundary + replay proofs.
// One command: npm test. Every stage exits non-zero on failure.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const files = readdirSync(new URL('../tests/unit/', import.meta.url))
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => `tests/unit/${f}`);

const saveFiles = readdirSync(new URL('../tests/save/', import.meta.url))
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => `tests/save/${f}`);

const scenarios = readdirSync(new URL('../tests/scenario/', import.meta.url))
  .filter((f) => f.startsWith('proof-') && f.endsWith('.json'))
  .sort()
  .map((f) => `tests/scenario/${f}`);

function stage(name, args) {
  try {
    execFileSync(process.execPath, args, { stdio: 'inherit', shell: false });
  } catch {
    console.error(`STAGE FAILED: ${name}`);
    process.exit(1);
  }
}

stage('unit', ['--test', ...files]);
if (saveFiles.length) stage('save', ['--test', ...saveFiles]);
stage('content-lint', ['tools/content-lint.js']);
stage('boundary', ['tools/boundary-check.js']);
for (const s of scenarios) stage(`replay:${s}`, ['tools/scenario-runner.js', s, '--twice']);
console.log(`all stages green (${files.length} unit files, ${saveFiles.length} save files, ${scenarios.length} replay proofs)`);

