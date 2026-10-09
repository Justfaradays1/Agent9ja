// sim/memory/index.js — bounded individual memory. Owner: sim/memory (M005).
//
// Doctrine: memory is storage, consequence is moat. A record exists only if a
// gate reads its kind (lint-enforced). No global reputation, no karma.
// Journal ≠ memory: an event in global history is known to NOBODY until a rule
// forms a record for a participant along a real social path (M005: direct
// participants only; hearsay transfer arrives with M008 comms).
// Eviction: per-person cap on NON-SCAR records, lowest (salience, seq) first.
// Scars are exempt and permanent; total growth is bounded by journal × rules
// in practice (revisit at M006 if scar counts ever matter).

import { assertId } from '../kernel/ids.js';

export const PERSON_CAP = 50;

// Every kind here MUST be read by a gate below, or lint fails the build.
export const GATE_READS = {
  'disclosure-downgrade': ['was_owed_broken'],
  'disclosure-upgrade': ['was_repaid'],
  'vouch-eligibility': ['broke_promise', 'was_owed_broken'],
  'grace-terms': ['broke_promise'],
};

const KNOWN_KINDS = new Set(Object.values(GATE_READS).flat());

export function validateMemoryRules(rules) {
  if (!Array.isArray(rules)) return 'memory rules must be an array';
  for (const [i, r] of rules.entries()) {
    if (!r || typeof r.on !== 'string') return `memory[${i}].on required`;
    if (!Array.isArray(r.for) || r.for.length === 0) return `memory[${i}].for needs roles`;
    if (!Array.isArray(r.memories) || r.memories.length === 0) return `memory[${i}].memories needed`;
    for (const f of r.for) {
      if (typeof f.role !== 'string') return `memory[${i}].for[].role required`;
    }
    for (const [j, m] of r.memories.entries()) {
      if (typeof m.for !== 'string') return `memory[${i}].memories[${j}].for required`;
      if (!KNOWN_KINDS.has(m.kind)) return `memory[${i}].memories[${j}].kind ${m.kind} is consumed by no gate`;
      if (typeof m.salience !== 'number' || m.salience < 0) return `memory[${i}].memories[${j}].salience must be >= 0`;
      if (typeof m.scar !== 'boolean') return `memory[${i}].memories[${j}].scar must be boolean`;
    }
    if (r.when !== undefined && (typeof r.when !== 'object' || r.when === null)) {
      return `memory[${i}].when must be an exact-match object`;
    }
  }
  return null;
}

/** Lint: every stored kind must be gate-consumed. Returns orphan kinds. */
export function lintMemoryContent(rules) {
  const used = new Set();
  for (const r of rules) for (const m of r.memories) used.add(m.kind);
  return [...used].filter((k) => ![...Object.values(GATE_READS).flat()].includes(k));
}

export function createMemory(kernel, rules) {
  const verr = validateMemoryRules(rules);
  if (verr) throw new Error(verr);
  const mems = {}; // person -> [records] (insertion order = seq order)

  kernel.registerStore('memory', {
    getState: () => ({ mems }),
    setState: (s) => {
      // Orphan policy (documented): records whose kind no longer exists in the
      // loaded rules are dropped on load — a removed kind has no gate that can
      // read it, so keeping it would be unconsumed state. Everything else loads
      // verbatim, including scars.
      const known = new Set();
      for (const r of rules) for (const m of r.memories || []) known.add(m.kind);
      for (const k of Object.keys(mems)) delete mems[k];
      for (const [person, list] of Object.entries(s.mems || {})) {
        mems[person] = (Array.isArray(list) ? list : []).filter((m) => m && known.has(m.kind));
      }
    },
  });

  const evict = (person) => {
    const list = mems[person] || [];
    const droppable = list.filter((m) => !m.scar);
    // Lowest (salience, seq) non-scar goes first. Fully deterministic.
    droppable.sort((a, b) => a.salience - b.salience || a.seq - b.seq);
    while (droppable.length > PERSON_CAP) {
      const victim = droppable.shift();
      const idx = list.indexOf(victim);
      if (idx === -1) break;
      list.splice(idx, 1);
    }
  };

  for (const rule of rules) {
    kernel.on(rule.on, (ev) => {
      if (rule.when && !Object.entries(rule.when).every(([k, v]) => ev.data[k] === v)) return [];
      const out = [];
      for (const m of rule.memories) {
        const person = ev.data[m.for];
        if (typeof person !== 'string') continue; // role absent: skip, never invent
        out.push({
          kind: 'MemoryFormed',
          data: {
            person,
            kind: m.kind,
            subject: m.subjectFrom ? ev.data[m.subjectFrom] ?? null : null,
            salience: m.salience,
            scar: m.scar,
            origin_id: ev.data.origin_id ?? ev.data.obligation?.origin_id ?? 'origin_dev',
          },
        });
      }
      return out;
    });
  }

  kernel.onApply('MemoryFormed', (ev) => {
    const d = ev.data;
    const id = `mem_${ev.seq}_${d.person}_${d.kind}`;
    const list = (mems[d.person] = mems[d.person] || []);
    if (list.some((m) => m.id === id)) return; // duplicate processing can never duplicate
    list.push({
      id, kind: d.kind, subject: d.subject, eventSeq: ev.seq,
      t: ev.t, salience: d.salience, scar: d.scar, origin_id: d.origin_id,
    });
    evict(d.person);
  });

  // Player-safe summary: kinds + subjects + times. No values, no beliefs.
  kernel.registerQuery('what_they_remember', (person) => {
    const list = mems[person] || [];
    return list.map((m) => ({ kind: m.kind, subject: m.subject, t: m.t })).sort((a, b) => a.t - b.t);
  });

  // Privileged reads for resolvers (gates). Never queries.
  const reads = {
    memoriesOf: (person) => (mems[person] || []).map((m) => ({ ...m })),
    hasKind: (person, kind, subject) =>
      (mems[person] || []).some((m) => m.kind === kind && (subject === undefined || m.subject === subject)),
    scarredBy: (person, subject) =>
      (mems[person] || []).filter((m) => m.scar && m.subject === subject).map((m) => m.id),
  };

  return {
    reads,
    // Dev-only full records. NOT a query: player paths must never reach this.
    debugMemories: (person) => JSON.parse(JSON.stringify(mems[person] || [])),
  };
}
