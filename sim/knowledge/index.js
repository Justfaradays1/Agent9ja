// sim/knowledge/index.js — truth, beliefs, player knowledge. Owner: sim/knowledge (M004).
//
// Three stores, three audiences:
//   facts    — ground truth. NOBODY player-facing reads this. Resolvers only.
//   beliefs  — per-NPC view. Only that NPC's disclosure logic reads it.
//   claims   — what the player heard, with provenance. Player queries read this.
//
// NPC errors are authored (seeded beliefs), never rolled.
// Disclosure is deterministic: rule + stance + incentive-conflict, no dice.
// Deferred inputs (documented hooks, NOT implemented): amount the asker spent,
// who is listening, confidence obligations. Adding them later changes the
// evaluateDisclosure table, not the stores.

import { assertId } from '../kernel/ids.js';

const CERTAINTY = new Set(['sure', 'likely', 'rumour']);
const SOURCE = new Set(['saw', 'told', 'assumed']);
const TAG_RE = /^[a-z][a-z0-9_]{0,31}$/;
const CLAIM_CAP = 1000;
const STEP_DOWN = { tell: 'shade', shade: 'deflect', deflect: 'refuse', refuse: 'refuse' };
export { STEP_DOWN };

const checkTags = (tags, max = 8) => {
  if (!Array.isArray(tags) || tags.length > max) return `bad tags: array<=${max}`;
  for (const t of tags) if (typeof t !== 'string' || !TAG_RE.test(t)) return `bad tag: ${t}`;
  return null;
};

export function validateDisclosureRules(rules) {
  if (!Array.isArray(rules)) return 'disclosure rules must be an array';
  const dispositions = new Set(['tell', 'shade', 'deflect', 'refuse', 'mislead']);
  for (const [i, r] of rules.entries()) {
    if (!r || typeof r.person !== 'string' || typeof r.fact !== 'string') {
      return `disclosure[${i}] needs {person, fact}`;
    }
    try { assertId(r.person, 'person'); assertId(r.fact, 'fact'); } catch {
      return `disclosure[${i}] needs stable ids`;
    }
    if (!dispositions.has(r.disposition)) return `disclosure[${i}].disposition invalid`;
    if (r.disposition === 'mislead' && r.false_value === undefined) {
      return `disclosure[${i}]: mislead requires authored false_value (never invented)`;
    }
  }
  return null;
}

/**
 * Pure disclosure evaluation. Returns {outcome, steps[]} where steps explain
 * every downgrade for why-* output. Stance/incentives can only conceal, never
 * upgrade; mislead comes solely from an explicit authored rule.
 */
export function evaluateDisclosure({ rule, stance, npcTags, factTags }) {
  const steps = [];
  let outcome = rule ? rule.disposition : 'deflect';
  steps.push({ kind: 'rule', outcome });
  if ((stance === 'Burned' || stance === 'Frosty') && outcome !== 'mislead' && outcome !== 'refuse') {
    const from = outcome;
    outcome = STEP_DOWN[outcome];
    steps.push({ kind: 'stance', from, to: outcome, stance });
  }
  const conflict = (npcTags || []).some((t) => (factTags || []).includes(t));
  if (conflict && outcome !== 'mislead' && outcome !== 'refuse') {
    const from = outcome;
    outcome = STEP_DOWN[outcome];
    steps.push({ kind: 'incentive', from, to: outcome });
  }
  if (outcome === 'mislead' && (!rule || rule.false_value === undefined)) {
    // Safety: mislead without authored falsehood degrades, never invents.
    steps.push({ kind: 'safety', from: 'mislead', to: 'deflect' });
    outcome = 'deflect';
  }
  return { outcome, steps };
}

export function createKnowledge(kernel, { disclosure = [] } = {}) {
  const derr = validateDisclosureRules(disclosure);
  if (derr) throw new Error(derr);
  const rules = new Map(disclosure.map((r) => [`${r.person}>${r.fact}`, r]));

  const facts = {}; // fact_id -> {value, tags, origin_id}
  const beliefs = {}; // person -> {fact -> {value, certainty, source, origin_id, t}}
  const claims = []; // player-heard, append-only + supersede flags
  const learned = {}; // person -> [incentive tags the player noted]
  let playerId = null;

  kernel.registerStore('knowledge', {
    getState: () => ({ facts, beliefs, claims, learned, playerId }),
    setState: (s) => {
      for (const k of Object.keys(facts)) delete facts[k];
      Object.assign(facts, s.facts);
      for (const k of Object.keys(beliefs)) delete beliefs[k];
      Object.assign(beliefs, s.beliefs);
      claims.length = 0;
      claims.push(...s.claims);
      for (const k of Object.keys(learned)) delete learned[k];
      Object.assign(learned, s.learned);
      playerId = s.playerId;
    },
  });

  kernel.registerCommand('set_fact', {
    validate: (p) => {
      if (!p || typeof p.fact_id !== 'string') return 'set_fact needs {fact_id, value}';
      try { assertId(p.fact_id, 'fact_id'); } catch { return 'bad fact_id'; }
      if (!['number', 'string', 'boolean'].includes(typeof p.value) || p.value === null) {
        return 'fact value must be a JSON scalar';
      }
      if (p.tags !== undefined) { const t = checkTags(p.tags); if (t) return t; }
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (facts[p.fact_id]) return { rejected: `fact_exists: ${p.fact_id}` };
      const origin = p.origin_id === undefined ? 'origin_dev' : p.origin_id;
      try { assertId(origin, 'origin_id'); } catch { return { rejected: 'bad origin_id' }; }
      return [{ kind: 'FactRecorded', data: { fact: p.fact_id, value: p.value, tags: [...(p.tags || [])], origin_id: origin } }];
    },
  });

  kernel.registerCommand('set_belief', {
    validate: (p) => {
      if (!p || typeof p.person !== 'string' || typeof p.fact !== 'string') return 'set_belief needs {person, fact, value, certainty, source}';
      try { assertId(p.person, 'person'); assertId(p.fact, 'fact'); } catch { return 'bad ids'; }
      if (!CERTAINTY.has(p.certainty)) return 'bad certainty: sure|likely|rumour';
      if (!SOURCE.has(p.source)) return 'bad source: saw|told|assumed';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (!q.person(p.person)) return { rejected: `unknown_person: ${p.person}` };
      if (!facts[p.fact]) return { rejected: `unknown_fact: ${p.fact}` };
      if (beliefs[p.person]?.[p.fact]) return { rejected: `belief_exists: ${p.person}>${p.fact}` };
      const origin = p.origin_id === undefined ? 'origin_dev' : p.origin_id;
      try { assertId(origin, 'origin_id'); } catch { return { rejected: 'bad origin_id' }; }
      return [{
        kind: 'BeliefRecorded',
        data: { person: p.person, fact: p.fact, value: p.value, certainty: p.certainty, source: p.source, origin_id: origin },
      }];
    },
  });

  kernel.registerCommand('identify_player', {
    validate: (p) => {
      if (!p || typeof p.person !== 'string') return 'identify_player needs {person}';
      try { assertId(p.person, 'person'); } catch { return 'bad person id'; }
      return null;
    },
    resolve: (cmd, q) => {
      if (playerId) return { rejected: `player_already_set: ${playerId}` };
      if (!q.person(cmd.params.person)) return { rejected: `unknown_person: ${cmd.params.person}` };
      return [{ kind: 'PlayerIdentified', data: { person: cmd.params.person } }];
    },
  });

  kernel.registerCommand('note_incentive', {
    validate: (p) => {
      if (!p || typeof p.person !== 'string' || typeof p.tag !== 'string') return 'note_incentive needs {person, tag}';
      try { assertId(p.person, 'person'); } catch { return 'bad person id'; }
      if (!TAG_RE.test(p.tag)) return 'bad tag';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (!q.person(p.person)) return { rejected: `unknown_person: ${p.person}` };
      if ((learned[p.person] || []).includes(p.tag)) return []; // idempotent no-op, no journal noise
      return [{ kind: 'IncentiveNoted', data: { person: p.person, tag: p.tag } }];
    },
  });

  kernel.onApply('FactRecorded', (ev) => {
    facts[ev.data.fact] = { value: ev.data.value, tags: [...ev.data.tags], origin_id: ev.data.origin_id };
  });

  kernel.onApply('BeliefRecorded', (ev) => {
    const d = ev.data;
    (beliefs[d.person] = beliefs[d.person] || {})[d.fact] = {
      value: d.value, certainty: d.certainty, source: d.source, origin_id: d.origin_id, t: ev.t,
    };
  });

  // Hearsay intake (M008 rumour spread): records a weaker belief with the
  // SAME origin_id, and never overwrites an existing belief. Idempotent:
  // repeat delivery finds the belief present and skips.
  kernel.onApply('BeliefHeard', (ev) => {
    const d = ev.data;
    const existing = (beliefs[d.person] || {})[d.fact];
    if (existing) return;
    (beliefs[d.person] = beliefs[d.person] || {})[d.fact] = {
      value: d.value, certainty: d.certainty, source: 'told', origin_id: d.origin_id, t: ev.t,
    };
  });

  kernel.onApply('PlayerIdentified', (ev) => { playerId = ev.data.person; });

  kernel.onApply('IncentiveNoted', (ev) => {
    (learned[ev.data.person] = learned[ev.data.person] || []).push(ev.data.tag);
  });

  kernel.onApply('ClaimHeard', (ev) => {
    const c = ev.data.claim;
    for (const prior of claims) {
      if (prior.fact === c.fact && prior.speaker === c.speaker && prior.status === 'heard') {
        prior.status = 'superseded';
      }
    }
    claims.push({ ...c, id: `claim_${ev.seq}`, status: 'heard', t: ev.t });
    while (claims.length > CLAIM_CAP) claims.shift();
  });

  kernel.registerQuery('claims', (filter = {}) => {
    let list = claims;
    if (filter.fact) list = list.filter((c) => c.fact === filter.fact);
    if (filter.speaker) list = list.filter((c) => c.speaker === filter.speaker);
    if (filter.status) list = list.filter((c) => c.status === filter.status);
    return JSON.parse(JSON.stringify(list.slice(-200)));
  });

  // Derived suspicion card. Shows speakers, independent sources (distinct
  // origin_ids — one rumour repeated five times counts once), learned
  // incentives, and age. NEVER ground truth.
  kernel.registerQuery('claim_card', (fact) => {
    const heard = claims.filter((c) => c.fact === fact && c.status === 'heard');
    if (heard.length === 0) return null;
    const positions = {};
    for (const c of heard) {
      const k = JSON.stringify(c.asserted);
      (positions[k] = positions[k] || { value: c.asserted, speakers: [], origins: [], count: 0 });
      if (!positions[k].speakers.includes(c.speaker)) positions[k].speakers.push(c.speaker);
      if (!positions[k].origins.includes(c.origin_id)) positions[k].origins.push(c.origin_id);
      positions[k].count++;
    }
    const speakers = [...new Set(heard.map((c) => c.speaker))];
    const incentives = {};
    for (const s of speakers) incentives[s] = [...(learned[s] || [])];
    return {
      fact,
      heard_total: heard.length,
      positions: Object.values(positions),
      independent_sources: [...new Set(heard.map((c) => c.origin_id))].length,
      incentives_known: incentives,
      first_t: heard[0].t,
      last_t: heard[heard.length - 1].t,
    };
  });

  kernel.registerQuery('known_incentives', (person) => [...(learned[person] || [])]);
  kernel.registerQuery('player', () => playerId);

  // Privileged reads for resolvers (arch: only resolvers and rules touch
  // truth/beliefs). Imported as code by sim/verbs; never exposed as queries.
  const reads = {
    beliefOf: (person, fact) => beliefs[person]?.[fact] ?? null,
    ruleFor: (person, fact) => rules.get(`${person}>${fact}`) ?? null,
    factTags: (fact) => (facts[fact] ? [...facts[fact].tags] : null),
    factExists: (fact) => !!facts[fact],
  };

  return {
    reads,
    // Dev-only inspection (console/tools). NOT a query: player paths must
    // never reach this. Tests assert its absence from the query surface.
    debugInspect: () => JSON.parse(JSON.stringify({ facts, beliefs })),
  };
}

/** Seed helpers through the pipeline (journaled, idempotent via stable cmd_ids). */
export function seedFacts(kernel, defs) {
  return defs.map((d, i) => kernel.dispatch({
    cmd_id: `seed_fact_${d.fact_id}_${i}`, type: 'set_fact', actor: 'seed', params: d,
  }));
}
export function seedBeliefs(kernel, defs) {
  return defs.map((d, i) => kernel.dispatch({
    cmd_id: `seed_belief_${d.person}_${d.fact}_${i}`, type: 'set_belief', actor: 'seed', params: d,
  }));
}
