// sim/save/index.js — Save/Load v1 file layer. Owner: sim/save (M006).
//
// Local files only. No cloud, no network, no encryption, no compression.
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

export const SCHEMA_VERSION = 1;
export const CONTENT_VERSION = 1;
// Autosave hook points. Triggers are wired later (M010+); the API exists now.
export const AUTOSAVE_POINTS = ['phaseBoundary', 'afterInteraction', 'onBackground'];

const BACKUPS = ['.bak1', '.bak2']; // newest first; plus live file = 3 deep

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function createEnvelope(snapshotString, contentVersion = CONTENT_VERSION) {
  return JSON.stringify({
    schema: SCHEMA_VERSION,
    content: contentVersion,
    sha256: sha256(snapshotString),
    snapshot: snapshotString,
  });
}

// ---- migrations: small ordered functions, old version -> next ----
function migrateV0toV1(obj) {
  for (const k of ['clock', 'rng', 'flags', 'journal', 'seen', 'seq']) {
    if (!(k in obj)) throw new Error(`unmigratable_v0: missing ${k}`);
  }
  return {
    v: 1,
    seed: obj.seed ?? obj.rng?.rootSeed ?? 'migrated-seed',
    clock: obj.clock, rng: obj.rng, flags: obj.flags,
    journal: obj.journal, seen: obj.seen, seq: obj.seq,
    stores: obj.stores ?? {},
  };
}

const MIGRATIONS = { 0: migrateV0toV1 };

export function migrateSnapshot(obj) {
  if (typeof obj?.v === 'number' && obj.v > SCHEMA_VERSION) {
    throw new Error(`no_migration_path: v${obj.v} is newer than code v${SCHEMA_VERSION} (cannot migrate forward)`);
  }
  let cur = obj;
  while (typeof cur.v === 'number' && cur.v < SCHEMA_VERSION) {
    const fn = MIGRATIONS[cur.v];
    if (!fn) throw new Error(`no_migration_path: v${cur.v} -> v${SCHEMA_VERSION}`);
    cur = fn(cur);
  }
  return cur;
}

function checkPayloadShape(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('corrupt_save: envelope snapshot is not an object');
  for (const k of ['clock', 'rng', 'flags', 'journal', 'seen', 'seq', 'stores']) {
    if (!(k in obj)) throw new Error(`corrupt_save: snapshot missing ${k}`);
  }
  if (!Array.isArray(obj.journal)) throw new Error('corrupt_save: journal is not an array');
  if (typeof obj.seq !== 'number') throw new Error('corrupt_save: seq is not a number');
  return obj;
}

export function parseEnvelope(text) {
  let env;
  try {
    env = JSON.parse(text);
  } catch {
    throw new Error('corrupt_save: not valid JSON');
  }
  if (!env || typeof env !== 'object' || typeof env.snapshot !== 'string') {
    throw new Error('corrupt_save: bad envelope shape');
  }
  if (typeof env.schema !== 'number') throw new Error('corrupt_save: missing schema version');
  if (env.schema > SCHEMA_VERSION) throw new Error(`incompatible_schema: save v${env.schema} newer than code v${SCHEMA_VERSION}`);
  if (sha256(env.snapshot) !== env.sha256) throw new Error('corrupt_save: checksum mismatch');
  let snap;
  try {
    snap = JSON.parse(env.snapshot);
  } catch {
    throw new Error('corrupt_save: snapshot payload is not valid JSON');
  }
  const migratedFrom = env.schema < SCHEMA_VERSION ? env.schema : null;
  if (migratedFrom !== null) snap = migrateSnapshot({ ...snap, v: env.schema });
  return { snapshot: JSON.stringify(snap), snapshotObj: checkPayloadShape(snap), migratedFrom, contentMismatch: env.content !== CONTENT_VERSION };
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

/** Human-readable summary for tools/save-inspector.js (no truth judgments). */
export function inspectSnapshot(snapshotObj) {
  const stores = {};
  for (const [name, frag] of Object.entries(snapshotObj.stores || {})) {
    const keys = frag && typeof frag === 'object' ? Object.keys(frag) : [];
    let count = 0;
    for (const k of keys) {
      const v = frag[k];
      // Count records inside collections only; scalars (e.g. playerId) are not records.
      if (Array.isArray(v)) count += v.length;
      else if (v && typeof v === 'object') count += Object.keys(v).length;
    }
    stores[name] = { sections: keys, records: count };
  }
  return {
    schema: snapshotObj.v,
    seed: snapshotObj.seed ?? null,
    clock: snapshotObj.clock,
    seq: snapshotObj.seq,
    journalLength: Array.isArray(snapshotObj.journal) ? snapshotObj.journal.length : -1,
    stores,
  };
}
