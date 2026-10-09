// sim/relationships/index.js — directional relationships, owner: sim/relationships (M002).
//
// Stored raw per (A→B): trust/warmth/tension in 0..100, tags[], origin_id,
// stance (derived, cached), updatedBy (last event seq for traceability).
// Stance labels are DERIVED from content thresholds with hysteresis and never
// saved as authority; standing is derived per observer (own relationship only
// at M002 — contextual standing arrives with later milestones).
// Favour balance: DERIVED from the obligation ledger (M003 owns it); until
// then favour is 0 by contract. No favour numbers are stored here.

import { assertId } from '../kernel/ids.js';

export const DIM_MIN = 0;
export const DIM_MAX = 100;
const TAG_RE = /^[a-z][a-z0-9_]{0,31}$/;
const DEFAULTS = { trust: 50, warmth: 50, tension: 10 };

const keyOf = (a, b) => `${a}>${b}`;

function checkProvidedDims(d) {
  for (const n of ['trust', 'warmth', 'tension']) {
    if (d[n] === undefined) continue;
    if (typeof d[n] !== 'number' || !Number.isFinite(d[n]) || d[n] < DIM_MIN || d[n] > DIM_MAX) {
      return `bad_dimension: ${n} must be a number ${DIM_MIN}..${DIM_MAX}`;
    }
  }
  return null;
}

function checkTag(t) {
  return typeof t === 'string' && TAG_RE.test(t) ? null : 'bad_tag: lowercase id<=32';
}

export function validateStanceRules(rules) {
  if (!rules || !Array.isArray(rules.thresholds) || rules.thresholds.length === 0) {
    return 'stance rules need a non-empty thresholds array';
  }
  const known = new Set(['Burned', 'Frosty', 'Cool', 'Neutral', 'Warm']);
  for (const r of rules.thresholds) {
    if (!known.has(r.stance)) return `unknown stance: ${r.stance}`;
    if (typeof r.when !== 'object' || r.when === null) return `bad rule for ${r.stance}`;
    for (const [k, v] of Object.entries(r.when)) {
      if (!/^(trust|warmth|tension)_(gte|lte)$/.test(k) || typeof v !== 'number') {
        return `bad condition ${k} in ${r.stance}`;
      }
    }
  }
  if (typeof rules.hysteresis !== 'number' || rules.hysteresis < 0) return 'hysteresis must be a non-negative number';
  return null;
}

function matches(dims, when) {
  for (const [k, v] of Object.entries(when)) {
    const [dim, op] = k.split('_');
    if (op === 'gte' ? !(dims[dim] >= v) : !(dims[dim] <= v)) return false;
  }
  return true;
}

/** First matching rule wins. Relaxed=true expands current stance's band (hysteresis). */
function evaluate(dims, rules, { relaxStance = null } = {}) {
  for (const r of rules.thresholds) {
    let when = r.when;
    if (relaxStance && r.stance === relaxStance) {
      const m = rules.hysteresis;
      when = Object.fromEntries(Object.entries(r.when).map(([k, v]) => {
        const [dim, op] = k.split('_');
        return [k, op === 'gte' ? v - m : v + m];
      }));
    }
    if (matches(dims, when)) return r.stance;
  }
  return 'Neutral';
}

export function deriveStance(dims, rules, current) {
  const candidate = evaluate(dims, rules);
  if (candidate === current || current === undefined) return candidate;
  // Hysteresis: current stance persists if it still matches with relaxed bounds.
  if (evaluate(dims, rules, { relaxStance: current }) === current) return current;
  return candidate;
}

export function createRelationships(kernel, stanceRules) {
  const err = validateStanceRules(stanceRules);
  if (err) throw new Error(err);
  const rels = {}; // "a>b" -> record

  kernel.registerStore('relationships', {
    getState: () => ({ rels }),
    setState: (s) => {
      for (const k of Object.keys(rels)) delete rels[k];
      Object.assign(rels, s.rels);
    },
  });

  const needPersons = (q, a, b) => {
    if (!q.person(a)) return `unknown_person: ${a}`;
    if (!q.person(b)) return `unknown_person: ${b}`;
    return null;
  };

  kernel.registerCommand('open_relationship', {
    validate: (p) => {
      if (!p || typeof p.a !== 'string' || typeof p.b !== 'string') return 'open needs {a, b}';
      try { assertId(p.a, 'a'); assertId(p.b, 'b'); } catch { return 'open needs stable person ids'; }
      if (p.a === p.b) return 'no_self_relationship';
      return checkProvidedDims(p); // absent dims fall back to DEFAULTS in resolve
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      const missing = needPersons(q, p.a, p.b);
      if (missing) return { rejected: missing };
      if (rels[keyOf(p.a, p.b)]) return { rejected: `relationship_exists: ${p.a}>${p.b}` };
      const dims = {
        trust: p.trust ?? DEFAULTS.trust,
        warmth: p.warmth ?? DEFAULTS.warmth,
        tension: p.tension ?? DEFAULTS.tension,
      };
      const origin = p.origin_id === undefined ? 'origin_dev' : p.origin_id;
      try { assertId(origin, 'origin_id'); } catch { return { rejected: 'bad origin_id' }; }
      return [{
        kind: 'RelationshipOpened',
        data: { a: p.a, b: p.b, dims, tags: [...(p.tags || [])], origin_id: origin },
      }];
    },
  });

  kernel.registerCommand('nudge_relationship', {
    validate: (p) => {
      if (!p || typeof p.a !== 'string' || typeof p.b !== 'string') return 'nudge needs {a, b}';
      try { assertId(p.a, 'a'); assertId(p.b, 'b'); } catch { return 'nudge needs stable person ids'; }
      if (p.a === p.b) return 'no_self_relationship';
      for (const n of ['dTrust', 'dWarmth', 'dTension']) {
        if (p[n] !== undefined && (typeof p[n] !== 'number' || !Number.isFinite(p[n]))) {
          return `bad_delta: ${n} must be a finite number`;
        }
      }
      if (p.dTrust === undefined && p.dWarmth === undefined && p.dTension === undefined) {
        return 'bad_delta: nudge needs at least one delta';
      }
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      const missing = needPersons(q, p.a, p.b);
      if (missing) return { rejected: missing };
      if (!rels[keyOf(p.a, p.b)]) return { rejected: `no_relationship: ${p.a}>${p.b}` };
      return [{
        kind: 'RelationshipNudged',
        data: { a: p.a, b: p.b, d: { trust: p.dTrust || 0, warmth: p.dWarmth || 0, tension: p.dTension || 0 } },
      }];
    },
  });

  kernel.registerCommand('tag_relationship', {
    validate: (p) => {
      if (!p || typeof p.a !== 'string' || typeof p.b !== 'string') return 'tag needs {a, b}';
      try { assertId(p.a, 'a'); assertId(p.b, 'b'); } catch { return 'tag needs stable person ids'; }
      if (p.a === p.b) return 'no_self_relationship';
      const t = checkTag(p.tag);
      if (t) return t;
      if (p.op !== 'add' && p.op !== 'remove') return 'bad_op: add|remove';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      const missing = needPersons(q, p.a, p.b);
      if (missing) return { rejected: missing };
      if (!rels[keyOf(p.a, p.b)]) return { rejected: `no_relationship: ${p.a}>${p.b}` };
      return [{ kind: 'RelationshipTagged', data: { a: p.a, b: p.b, tag: p.tag, op: p.op } }];
    },
  });

  const clamp = (v) => Math.min(DIM_MAX, Math.max(DIM_MIN, v));

  kernel.onApply('RelationshipOpened', (ev) => {
    const d = ev.data;
    const dims = { ...d.dims };
    rels[keyOf(d.a, d.b)] = {
      a: d.a, b: d.b, dims, tags: [...d.tags], origin_id: d.origin_id,
      stance: deriveStance(dims, stanceRules, undefined), updatedBy: ev.seq,
    };
  });

  kernel.onApply('RelationshipNudged', (ev) => {
    const r = rels[keyOf(ev.data.a, ev.data.b)];
    r.dims.trust = clamp(r.dims.trust + ev.data.d.trust);
    r.dims.warmth = clamp(r.dims.warmth + ev.data.d.warmth);
    r.dims.tension = clamp(r.dims.tension + ev.data.d.tension);
    r.stance = deriveStance(r.dims, stanceRules, r.stance);
    r.updatedBy = ev.seq;
  });

  kernel.onApply('RelationshipTagged', (ev) => {
    const r = rels[keyOf(ev.data.a, ev.data.b)];
    const i = r.tags.indexOf(ev.data.tag);
    if (ev.data.op === 'add' && i === -1) r.tags.push(ev.data.tag);
    if (ev.data.op === 'remove' && i !== -1) r.tags.splice(i, 1);
    r.updatedBy = ev.seq;
  });

  // Queries: stance/tags/rel from the observer's own record (M002 scope).
  // Full contextual standing (memories, vouches, hearsay) arrives later.
  kernel.registerQuery('rel', (a, b) => {
    const r = rels[keyOf(a, b)];
    return r ? { ...r, dims: { ...r.dims }, tags: [...r.tags] } : null;
  });
  kernel.registerQuery('stance', (a, b) => {
    const r = rels[keyOf(a, b)];
    return r ? r.stance : null;
  });
  kernel.registerQuery('tags', (a, b) => {
    const r = rels[keyOf(a, b)];
    return r ? [...r.tags] : null;
  });
  kernel.registerQuery('standing', (observer, subject) => {
    const r = rels[keyOf(observer, subject)];
    if (!r) return null;
    return { stance: r.stance, tags: [...r.tags], favour: 0 }; // favour: M003 ledger owns it
  });

  return {};
}

/** Seed helper through the pipeline (journaled, idempotent via stable cmd_ids). */
export function seedRelationships(kernel, defs) {
  const out = [];
  defs.forEach((d, i) => {
    out.push(kernel.dispatch({
      cmd_id: `seed_rel_${d.a}_${d.b}_${i}`, type: 'open_relationship', actor: 'seed', params: d,
    }));
  });
  return out;
}

// ---- Obligation-outcome consequences (M003 wiring, content-driven) ----

export function validateOutcomeMapping(mapping) {
  if (!Array.isArray(mapping)) return 'mapping must be an array';
  for (const [i, e] of mapping.entries()) {
    if (!e || (e.on !== 'ObligationBroken' && e.on !== 'ObligationFulfilled')) {
      return `mapping[${i}].on must be ObligationBroken|ObligationFulfilled`;
    }
    if (typeof e.kind !== 'string') return `mapping[${i}].kind required`;
    if (e.nudge !== undefined) {
      for (const n of ['dTrust', 'dWarmth', 'dTension']) {
        if (e.nudge[n] !== undefined && (typeof e.nudge[n] !== 'number' || !Number.isFinite(e.nudge[n]))) {
          return `mapping[${i}].nudge.${n} must be a finite number`;
        }
      }
    }
    if (e.tag !== undefined) {
      if (typeof e.tag !== 'string' || !TAG_RE.test(e.tag)) return `mapping[${i}].tag invalid`;
    }
    if (e.when !== undefined && (typeof e.when !== 'object' || e.when === null)) {
      return `mapping[${i}].when must be an exact-match object`;
    }
  }
  return null;
}

/**
 * Content rules mapping obligation outcomes → relationship effects.
 * Direction: the CREDITOR's view of the debtor changes (owed → owes).
 * Pairs with no relationship are skipped (never auto-created).
 * Money logic is untouched here — this only reads outcome events.
 * Wired at most once per kernel: double wiring would double-apply every
 * consequence, so the second call throws instead of silently stacking.
 */
const wiredKernels = new WeakMap();
export function registerObligationConsequences(kernel, mapping) {
  if (wiredKernels.has(kernel)) throw new Error('duplicate_wiring: consequences already registered on this kernel');
  const err = validateOutcomeMapping(mapping);
  if (err) throw new Error(err);
  wiredKernels.set(kernel, true);
  const handle = (ev, ctx) => {
    const out = [];
    for (const e of mapping) {
      if (e.on !== ev.kind || e.kind !== ev.data.kind) continue;
      if (e.when && !Object.entries(e.when).every(([k, v]) => ev.data[k] === v)) continue;
      const observer = ev.data.owed, subject = ev.data.owes; // creditor's view of debtor
      if (!observer || !subject) continue;
      if (!ctx.q.rel(observer, subject)) continue; // skip: never invent relationships
      if (e.nudge) {
        out.push({
          kind: 'RelationshipNudged',
          data: {
            a: observer, b: subject,
            d: { trust: e.nudge.dTrust || 0, warmth: e.nudge.dWarmth || 0, tension: e.nudge.dTension || 0 },
          },
        });
      }
      if (e.tag) out.push({ kind: 'RelationshipTagged', data: { a: observer, b: subject, tag: e.tag, op: 'add' } });
    }
    return out;
  };
  kernel.on('ObligationBroken', handle);
  kernel.on('ObligationFulfilled', handle);
}
