// sim/kernel/pipeline.js — Command → Event → Effect, one writer (M001).
//
// Flow per dispatch:
//   validate shape → idempotency check → resolver → events (caused_by = cmd_id)
//   → reactions in FIFO order (caused_by = parent seq) → effects via applier
// Same-tick order: clock → dues → seeds → reactions → director(phase only).
// M001 has no dues/seeds/director yet; order is still locked by construction:
// reactions run FIFO, same-timestamp ties break by event seq (stable order).
// Cascade depth 8 → CascadeGuardTripped, then halt that branch.

import { assertId } from './ids.js';
import { createRng } from './rng.js';
import { createClock } from './clock.js';

export const CASCADE_MAX = 8;
// Snapshot structural version, owned here (single source; sim/save aliases it
// as SCHEMA_VERSION for the envelope). v2 = v1 + comms store (M008). The
// kernel speaks exactly one version and stays strict: old snapshots arrive
// via sim/save migration, never via lenient restore.
export const SNAPSHOT_VERSION = 2;
// Doctrine §1/§9: per-command event budget. A single command may not flood the
// journal: breadth cap complements the depth cap. Starting bound; retune with
// a test if M003+ workloads legitimately need more.
export const COMMAND_EVENT_BUDGET = 256;
const JOURNAL_CAP = 500;
const SEEN_CAP = 2000;

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
  }
  return value;
}

export function createKernel({ seed = 'dev-seed', stepMinutes } = {}) {
  const rng = createRng(seed);
  const clock = createClock(stepMinutes === undefined ? {} : { stepMinutes });
  const state = { flags: {}, journal: [], seen: {} }; // seen: cmd_id -> { status, firstSeq }
  let seq = 0;
  let inStep = false;

  const validators = new Map(); // type -> validate(params): null | reason
  const resolvers = new Map(); // type -> resolve(cmd, query): [{kind,data}] | {rejected}
  const reactions = new Map(); // eventKind -> [fn(event, ctx)]
  const appliers = new Map(); // eventKind -> [fn(event)]; module-owned mutation, single dispatch point
  const stores = new Map(); // name -> {getState, setState}; snapshot composition only
  const queryFns = new Map();
  const BUILTIN_QUERIES = new Set(['time', 'flags', 'journal', 'event', 'trace']);

  /** M002: modules register commands. Duplicate type → throw (one owner). */
  function registerCommand(type, { validate, resolve }) {
    if (validators.has(type)) throw new Error(`duplicate_command: ${type}`);
    validators.set(type, validate);
    resolvers.set(type, resolve);
  }

  /** M002: modules register snapshot fragments. Duplicate name → throw. */
  function registerStore(name, api) {
    if (stores.has(name)) throw new Error(`duplicate_store: ${name}`);
    stores.set(name, api);
  }

  /** M002: modules register event appliers. Duplicate kind → throw (one writer per kind). */
  function onApply(kind, fn) {
    if (appliers.has(kind)) throw new Error(`duplicate_applier: ${kind}`);
    appliers.set(kind, [fn]);
  }

  /** M002: modules extend the read-only query surface. Duplicate → throw. */
  function registerQuery(name, fn) {
    if (BUILTIN_QUERIES.has(name) || queryFns.has(name)) throw new Error(`duplicate_query: ${name}`);
    queryFns.set(name, fn);
  }

  // ---- built-in commands (M001 surface, now on the registry) ----
  registerCommand('set_flag', {
    validate: (p) =>
      p && typeof p.key === 'string' && p.key.length > 0 && p.key.length <= 64 && 'value' in p
        ? null : 'set_flag needs {key: non-empty string<=64, value}',
    resolve: (cmd) => [{ kind: 'FlagSet', data: { key: cmd.params.key, value: cmd.params.value } }],
  });
  registerCommand('emit_marker', {
    validate: (p) =>
      p && typeof p.note === 'string' && p.note.length > 0 && p.note.length <= 280
        ? null : 'emit_marker needs {note: non-empty string<=280}',
    resolve: (cmd) => [{ kind: 'MarkerEmitted', data: { note: cmd.params.note, actor: cmd.actor } }],
  });
  registerCommand('advance_time', {
    validate: (p) =>
      p && Number.isInteger(p.steps) && p.steps >= 1 && p.steps <= 100000
        ? null : 'advance_time needs {steps: int 1..100000}',
    resolve: (cmd) => {
      const out = [];
      for (let i = 0; i < cmd.params.steps; i++) {
        const crossed = clock.advance(1);
        out.push({ kind: 'StepAdvanced', data: { step: clock.stepCount, minutes: clock.minutes, phase: clock.phase(), crossed } });
      }
      return out;
    },
  });

  function pushEvent(kind, data, causedBy) {
    const ev = { seq: ++seq, kind, data: data ?? {}, caused_by: causedBy ?? null, t: clock.minutes };
    state.journal.push(ev);
    if (state.journal.length > JOURNAL_CAP) state.journal.shift();
    return ev;
  }

  // THE ONLY dispatch point allowed to mutate state. Module appliers run here,
  // each touching only its own store (review + boundary test enforce it).
  function applyEffect(ev) {
    if (ev.kind === 'FlagSet') {
      state.flags[ev.data.key] = ev.data.value;
    }
    // MarkerEmitted / StepAdvanced / CommandRejected / CascadeGuardTripped: journal only.
    for (const fn of appliers.get(ev.kind) || []) fn(ev);
  }

  function ctxFor() {
    return {
      clockMinutes: clock.minutes,
      rngNext: (streamName) => rng.next(streamName),
      // Frozen read views for reactions that must check before emitting
      // (e.g. consequence mapping skips pairs with no relationship).
      q: createQueryView(),
      // Quiesce proof: any snapshot attempt mid-dispatch throws.
      snapshot: () => snapshot(),
    };
  }

  function dispatch(cmd) {
    if (inStep) {
      // Programmer-invariant violation: fail LOUD, never swallow (doctrine §2).
      const fatal = new Error('ReentrantDispatch: commands cannot nest; finish the step first');
      fatal.fatal = true;
      throw fatal;
    }
    if (!cmd || typeof cmd.cmd_id !== 'string' || cmd.cmd_id.length === 0) {
      return reject(cmd, 'bad_command: cmd_id must be a non-empty string');
    }
    if (typeof cmd.type !== 'string') return reject(cmd, 'bad_command: type must be a string');
    try { assertId(cmd.cmd_id, 'cmd_id'); } catch { return reject(cmd, `bad_command: cmd_id must match stable-id pattern`); }
    if (Object.prototype.hasOwnProperty.call(state.seen, cmd.cmd_id)) {
      return { status: 'duplicate', cmd_id: cmd.cmd_id, firstSeq: state.seen[cmd.cmd_id].firstSeq };
    }
    const validate = validators.get(cmd.type);
    if (!validate) return reject(cmd, `unknown_command: ${cmd.type}`);
    const reason = validate(cmd.params);
    if (reason) return reject(cmd, reason);

    inStep = true;
    try {
      // State-aware refusal: resolvers see frozen query views (never mutable
      // state) and may decline with a reason instead of producing events.
      const resolved = resolvers.get(cmd.type)(cmd, createQueryView());
      if (resolved && resolved.rejected) return reject(cmd, resolved.rejected);

      const firstSeq = seq + 1;
      state.seen[cmd.cmd_id] = { status: 'applied', firstSeq };
      // Seen-table bound: evict the OLDEST firstSeq. This must be a pure
      // function of table content (never insertion order): after a restore,
      // insertion history is gone, and a different victim would make redelivery
      // behave differently on the two sides — a real consistency defect.
      // Documented; M006 compacts with history instead of dropping.
      const seenKeys = Object.keys(state.seen);
      if (seenKeys.length > SEEN_CAP) {
        let victim = seenKeys[0];
        for (const k2 of seenKeys) {
          if (state.seen[k2].firstSeq < state.seen[victim].firstSeq) victim = k2;
        }
        delete state.seen[victim];
      }

      const initial = resolved.map((e) => ({ ...e, depth: 0 }));
      const queue = initial.map((e) => ({ ...e, causedBy: cmd.cmd_id }));
      const produced = [];
      let eventCount = 0;
      while (queue.length > 0) {
        // Doctrine §9: breadth bound. Halt with evidence, never spin forever.
        if (eventCount >= COMMAND_EVENT_BUDGET) {
          pushEvent('BudgetGuardTripped', { produced: eventCount, budget: COMMAND_EVENT_BUDGET }, cmd.cmd_id);
          break;
        }
        const item = queue.shift();
        const ev = pushEvent(item.kind, item.data, item.causedBy);
        eventCount++;
        produced.push(ev.seq);
        applyEffect(ev);
        if (item.depth >= CASCADE_MAX) {
          pushEvent('CascadeGuardTripped', { atDepth: item.depth + 1, fromKind: item.kind }, ev.seq);
          continue; // halt this branch; journal records the trip (content bug signal)
        }
        const fns = reactions.get(item.kind) || [];
        for (let ri = 0; ri < fns.length; ri++) {
          let out;
          try {
            out = fns[ri](ev, ctxFor()) || [];
          } catch (err) {
            // Doctrine §2: fatal programmer-invariant violations propagate;
            // runtime/content failures degrade into journaled evidence.
            if (err && err.fatal === true) throw err;
            pushEvent('ReactionFailed', { kind: item.kind, reaction: ri, error: String((err && err.message) || err) }, ev.seq);
            continue;
          }
          for (const o of out) {
            if (!o || typeof o.kind !== 'string') throw new Error('bad_reaction_event: kind required');
            queue.push({ kind: o.kind, data: o.data ?? {}, causedBy: ev.seq, depth: item.depth + 1 });
          }
        }
      }
      return { status: 'applied', cmd_id: cmd.cmd_id, firstSeq, produced };
    } finally {
      inStep = false;
    }
  }

  function reject(cmd, reason) {
    inStep = true;
    try {
      const ev = pushEvent('CommandRejected', { reason, type: cmd?.type ?? null, actor: cmd?.actor ?? null }, cmd?.cmd_id ?? null);
      return { status: 'rejected', reason, seq: ev.seq };
    } finally {
      inStep = false;
    }
  }

  function snapshot() {
    if (inStep) throw new Error('NotQuiesced: snapshots only at step boundaries');
    const storeStates = {};
    for (const [name, api] of stores) storeStates[name] = api.getState();
    return JSON.stringify(sortKeys({
      v: SNAPSHOT_VERSION, seed: rng.getState().rootSeed,
      clock: clock.getState(),
      rng: rng.getState(),
      flags: state.flags,
      journal: state.journal,
      seen: state.seen,
      seq,
      stores: storeStates,
    }));
  }

  function applySnapshot(s) {
    clock.setState(s.clock);
    rng.setState(s.rng);
    state.flags = s.flags;
    state.journal = s.journal;
    state.seen = s.seen;
    seq = s.seq;
    for (const [name, api] of stores) {
      api.setState(s.stores[name]);
    }
  }

  function validateSnapshotShape(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      throw new Error('bad_snapshot: snapshot must be an object');
    }
    if (s.v !== SNAPSHOT_VERSION) {
      throw new Error(`bad_snapshot_version: ${s.v} (code speaks ${SNAPSHOT_VERSION}; migrate old saves through sim/save)`);
    }
    for (const k of ['clock', 'rng', 'flags', 'journal', 'seen', 'seq', 'stores']) {
      if (!(k in s)) throw new Error(`bad_snapshot: snapshot missing ${k}`);
    }
    if (!Array.isArray(s.journal)) throw new Error('bad_snapshot: journal is not an array');
    if (typeof s.seq !== 'number') throw new Error('bad_snapshot: seq must be a number');
    if (!s.stores || typeof s.stores !== 'object') throw new Error('bad_snapshot: stores must be an object');
    for (const [name] of stores) {
      if (!(name in s.stores)) throw new Error(`missing_store_in_snapshot: ${name}`);
    }
  }

  function restore(json) {
    let s;
    try {
      s = JSON.parse(json);
    } catch {
      throw new Error('bad_snapshot: snapshot is not valid JSON');
    }
    // Validate everything checkable BEFORE touching live state: version,
    // required keys, and every registered store present.
    validateSnapshotShape(s);
    // Atomicity: a store setState can still throw mid-apply, so capture the
    // live state first (one canonical snapshot; restores are rare and saves
    // are KBs, so a single full copy is the bounded-safe option) and roll
    // back on any failure. A failed restore leaves the kernel byte-identical.
    const backup = snapshot(); // throws NotQuiesced mid-step, before mutation
    try {
      applySnapshot(s);
    } catch (err) {
      try {
        applySnapshot(JSON.parse(backup)); // self-produced: always applies
      } catch (rollbackErr) {
        throw new Error(`restore_failed_and_rollback_failed: ${err.message} | rollback: ${rollbackErr.message}`);
      }
      throw err;
    }
  }

  return {
    dispatch,
    snapshot,
    restore,
    on: (eventKind, fn) => {
      if (!reactions.has(eventKind)) reactions.set(eventKind, []);
      reactions.get(eventKind).push(fn);
    },
    registerCommand,
    registerStore,
    onApply,
    registerQuery,
    query: () => createQueryView(),
  };

  function createQueryView() {
    const freezeDeep = (v) => {
      if (Array.isArray(v)) return Object.freeze(v.map(freezeDeep));
      if (v && typeof v === 'object') {
        return Object.freeze(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, freezeDeep(x)])));
      }
      return v;
    };
    const view = {
      time: () => freezeDeep({ minutes: clock.minutes, day: clock.day(), phase: clock.phase(), steps: clock.stepCount }),
      flags: () => freezeDeep({ ...state.flags }),
      journal: (limit = 50) => {
        const n = Math.min(Math.max(limit, 0), JOURNAL_CAP);
        return freezeDeep(n === 0 ? [] : state.journal.slice(-n));
      },
      event: (sq) => freezeDeep(state.journal.find((e) => e.seq === sq) ?? null),
      /** caused_by chain: command or event seqs back to origin. Foundation of why-*. */
      trace: (sq) => {
        const chain = [];
        let cur = state.journal.find((e) => e.seq === sq);
        let guard = 0;
        while (cur && guard++ < 64) {
          chain.unshift(freezeDeep({ ...cur }));
          const c = cur.caused_by;
          if (typeof c === 'number') cur = state.journal.find((e) => e.seq === c) ?? null;
          else break; // reached a cmd_id origin
        }
        return freezeDeep(chain);
      },
    };
    for (const [name, fn] of queryFns) view[name] = (...a) => freezeDeep(fn(...a));
    return view;
  }
}
