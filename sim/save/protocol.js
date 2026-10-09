// sim/save/protocol.js — save envelope protocol, platform-free. Owner: sim/save.
// Everything here runs in Node AND in a browser (no node: imports): the file
// layer (index.js) and the browser adapter (game/bridge) share this module,
// so the envelope format cannot fork by platform. The SHA-256 function is
// injected because Node (sync crypto) and browsers (SubtleCrypto, async-only)
// differ — and the protocol's tested API is synchronous, so browser builds
// ship a small sync SHA-256 instead. Parity is tested, not assumed.
import { SNAPSHOT_VERSION } from '../kernel/pipeline.js';
import { emptyCommsState } from '../comms/index.js';
import { emptyWorldState } from '../world/index.js';

// Snapshot structural version: single source is the kernel (it speaks exactly
// one version and stays strict). CONTENT_VERSION is untouched by content
// additions (M007/M008/M009 precedent): content files changed, but the
// envelope meaning did not — bumping it would be mechanical noise.
export const SCHEMA_VERSION = SNAPSHOT_VERSION;
export const CONTENT_VERSION = 1;
// Autosave hook points. Triggers are wired later (M010+); the API exists now.
export const AUTOSAVE_POINTS = ['phaseBoundary', 'afterInteraction', 'onBackground'];

export const BACKUPS = ['.bak1', '.bak2']; // newest first; plus live copy = 3 deep

export function createEnvelope(snapshotString, sha256Hex, contentVersion = CONTENT_VERSION) {
  if (typeof sha256Hex !== 'function') throw new Error('createEnvelope needs a sha256Hex function');
  return JSON.stringify({
    schema: SCHEMA_VERSION,
    content: contentVersion,
    sha256: sha256Hex(snapshotString),
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

// v1 -> v2 (M008 added the comms store): pre-M008 snapshots have no comms
// fragment. Inject the canonical empty state owned by sim/comms. Only fills
// when absent — a present store is never overwritten — and nothing else is
// touched, so player state passes through byte-identical.
function migrateV1toV2(obj) {
  const stores = { ...(obj.stores ?? {}) };
  if (!('comms' in stores)) stores.comms = emptyCommsState();
  return { ...obj, v: 2, stores };
}

// v2 -> v3 (M009 added the world store): same contract. Persons start
// unplaced (where_is null) until routines are assigned; resources start at
// canonical boot state. History is never invented.
function migrateV2toV3(obj) {
  const stores = { ...(obj.stores ?? {}) };
  if (!('world' in stores)) stores.world = emptyWorldState();
  return { ...obj, v: 3, stores };
}

const MIGRATIONS = { 0: migrateV0toV1, 1: migrateV1toV2, 2: migrateV2toV3 };

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

export function parseEnvelope(text, sha256Hex) {
  if (typeof sha256Hex !== 'function') throw new Error('parseEnvelope needs a sha256Hex function');
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
  if (sha256Hex(env.snapshot) !== env.sha256) throw new Error('corrupt_save: checksum mismatch');
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

/** Human-readable summary (no truth judgments). */
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
