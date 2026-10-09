// sim/kernel/ids.js — stable ID conventions (M001).
// IDs are never reused; renames go through a rename table (M006).

const ID_RE = /^[a-z]+_[A-Za-z0-9_]+$/;

/** Validate a stable ID. Throws on violation (fail-loud, never coerce). */
export function assertId(id, what = 'id') {
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    throw new Error(`bad_${what}: ${String(id)}`);
  }
  return id;
}

/** Build a deterministic ID from prefix + counter (tests/fixtures only). */
export function makeId(prefix, counter) {
  return assertId(`${prefix}_${counter}`, 'generated_id');
}
