// game/bridge/save-adapter.js — save slots over a Web Storage interface.
// Same envelope protocol as the file layer (sim/save/protocol.js, shared —
// the format cannot fork by platform) with the same 3-deep rotation policy.
// Takes any {getItem,setItem,removeItem,key,length}-shaped store: localStorage
// in the browser, a shim in Node tests. All synchronous (protocol is sync).
// Single-writer model, same as files: last write wins, no locking.
import {
  SCHEMA_VERSION, BACKUPS,
  createEnvelope as createEnvelopeWith, parseEnvelope as parseEnvelopeWith,
} from '../../sim/save/protocol.js';
import { sha256Hex } from './sha256.js';

export { SCHEMA_VERSION };
export { sha256Hex as adapterSha256 };

// Never throws, even where window brass is absent (Node) or storage access
// is denied (blocked cookies/site data — which throws on property access in
// some browsers). A null return means saving is unavailable; the game itself
// must never depend on storage to boot or play.
export function platformStorage() {
  try {
    if (typeof window === 'undefined' || !window) return null;
    const s = window.localStorage;
    if (!s || typeof s.getItem !== 'function') return null;
    return s;
  } catch {
    return null;
  }
}

const SLOT_RE = /^[A-Za-z0-9_-]{1,64}$/;
const keyOf = (slot, suffix) => `${slot}.json${suffix}`;

function checkSlot(slot) {
  if (!SLOT_RE.test(slot)) throw new Error('bad_slot: name required');
}

export function createAdapter(storage) {
  function save(slot, snapshotString) {
    checkSlot(slot);
    // Validate envelope parses before touching storage (fail before effects).
    parseEnvelopeWith(createEnvelopeWith(snapshotString, sha256Hex), sha256Hex);
    const live = keyOf(slot, '');
    const prev = storage.getItem(live);
    if (prev !== null && prev !== undefined) {
      const bak1 = keyOf(slot, BACKUPS[0]);
      const bak2 = keyOf(slot, BACKUPS[1]);
      const prevBak1 = storage.getItem(bak1);
      if (prevBak1 !== null && prevBak1 !== undefined) {
        const prevBak2 = storage.getItem(bak2);
        if (prevBak2 !== null && prevBak2 !== undefined) storage.removeItem(bak2);
        storage.setItem(bak2, prevBak1);
      }
      storage.setItem(bak1, prev);
    }
    const text = createEnvelopeWith(snapshotString, sha256Hex);
    storage.setItem(live, text);
    return { bytes: text.length };
  }

  /** Newest-valid-wins. Returns {snapshot, source, migratedFrom, contentMismatch}. */
  function load(slot) {
    checkSlot(slot);
    const attempts = [];
    for (const suffix of ['', ...BACKUPS]) {
      const key = keyOf(slot, suffix);
      const text = storage.getItem(key);
      if (text === null || text === undefined) {
        attempts.push(`${key}: missing`);
        continue;
      }
      try {
        const parsed = parseEnvelopeWith(text, sha256Hex);
        return { ...parsed, source: key };
      } catch (err) {
        attempts.push(`${key}: ${err.message}`);
      }
    }
    throw new Error(`no_valid_save: ${attempts.join(' | ')}`);
  }

  function slots() {
    const out = [];
    const n = storage.length || 0;
    for (let i = 0; i < n; i++) {
      const k = storage.key(i);
      if (k && k.endsWith('.json') && !k.includes('.bak') && !k.includes('.tmp-')) {
        out.push(k.slice(0, -'.json'.length));
      }
    }
    return out.sort();
  }

  function remove(slot) {
    checkSlot(slot);
    for (const suffix of ['', ...BACKUPS]) storage.removeItem(keyOf(slot, suffix));
  }

  return { save, load, slots, remove };
}
