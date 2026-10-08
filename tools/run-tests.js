// M000 test runner wrapper: runs unit tests + boundary stub, one command.
import { execSync, execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const files = readdirSync(new URL('../tests/unit/', import.meta.url))
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => `tests/unit/${f}`);

try {
  execFileSync(process.execPath, ['--test', ...files], { stdio: 'inherit', shell: false });
} catch {
  process.exit(1);
}
try {
  execFileSync(process.execPath, ['tools/boundary-check.js'], { stdio: 'inherit', shell: false });
} catch {
  process.exit(1);
}
