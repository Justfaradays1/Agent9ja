// sim/save/index.js — Save/Load v1 file layer. Owner: sim/save (M006).
//
// Local files only. No cloud, no network, no encryption, no compression.
// The envelope protocol lives in ./protocol.js (platform-free, shared with
// the browser adapter); this module adds Node file I/O and rotation.
// Contract:
// - saveSlot(dir, slot, snapshotString): envelope + atomic write + rotation.
// - loadSlot(dir, slot): newest-valid-wins across slot.json, .bak1, .bak2,
//   with checksum, version checks, and ordered migrations for old schemas.
// - Anything unrecoverable throws a clear error; current world is never touched
//   (load parses into a fresh object; kernel.restore runs only on success).
// - Concurrent writers: last-writer-wins, no locking (documented limitation;
//   single-process local game has one writer).
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, renameSync, readFileSync, existsSync, unlinkSync, openSync, fsyncSync, closeSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  SCHEMA_VERSION, CONTENT_VERSION, AUTOSAVE_POINTS, BACKUPS,
  createEnvelope as createEnvelopeWith, parseEnvelope as parseEnvelopeWith,
  migrateSnapshot, inspectSnapshot,
} from './protocol.js';

export { SCHEMA_VERSION, CONTENT_VERSION, AUTOSAVE_POINTS, migrateSnapshot, inspectSnapshot };

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function createEnvelope(snapshotString, contentVersion = CONTENT_VERSION) {
  return createEnvelopeWith(snapshotString, sha256, contentVersion);
}

export function parseEnvelope(text) {
  return parseEnvelopeWith(text, sha256);
}

function atomicWriteFile(path, text) {
  const tmp = `${path}.tmp-${process.pid}`;
  const fd = openSync(tmp, 'w');
  try {
    writeFileSync(fd, text, 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
}

export function saveSlot(dir, slot, snapshotString) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(slot)) throw new Error('bad_slot: name required');
  mkdirSync(dir, { recursive: true });
  const live = join(dir, `${slot}.json`);
  // Validate envelope parses before touching disk (fail before side effects).
  parseEnvelope(createEnvelope(snapshotString));
  // Single-writer model: any leftover tmp for this slot is crash residue from a
  // dead process, never a live writer. Clear it so crashes don't litter saves/.
  for (const e of readdirSync(dir)) {
    if (e.startsWith(`${slot}.json.tmp-`)) unlinkSync(join(dir, e));
  }
  if (existsSync(live)) {
    const bak1 = live + BACKUPS[0], bak2 = live + BACKUPS[1];
    if (existsSync(bak1)) {
      if (existsSync(bak2)) unlinkSync(bak2);
      renameSync(bak1, bak2);
    }
    renameSync(live, bak1);
  }
  atomicWriteFile(live, createEnvelope(snapshotString));
  return { bytes: Buffer.byteLength(createEnvelope(snapshotString), 'utf8') };
}

/** Newest-valid-wins. Returns {snapshot, source, migratedFrom, contentMismatch}. */
export function loadSlot(dir, slot) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(slot)) throw new Error('bad_slot: name required');
  const attempts = [];
  for (const suffix of ['', ...BACKUPS]) {
    const path = join(dir, `${slot}.json${suffix}`);
    if (!existsSync(path)) {
      attempts.push(`${path}: missing`);
      continue;
    }
    try {
      const parsed = parseEnvelope(readFileSync(path, 'utf8'));
      return { ...parsed, source: path };
    } catch (err) {
      attempts.push(`${path}: ${err.message}`);
    }
  }
  throw new Error(`no_valid_save: ${attempts.join(' | ')}`);
}

export function saveAutosave(kernel, dir) {
  return saveSlot(dir, 'autosave', kernel.snapshot());
}
