// sim/people/index.js — person records, owner: sim/people (M002).
// Minimal fields only. NO traits yet (M004 disclosure/intent owns them).
// NO roles as classes: roles are derived states elsewhere, never stored here.
// origin_id provenance on every seeded record (default origin_dev).

import { assertId } from '../kernel/ids.js';

const DISPLAY_MAX = 64;
const TAG_RE = /^[a-z][a-z0-9_]{0,31}$/;

export function validatePersonDef(def) {
  if (!def || typeof def !== 'object') return 'person must be an object';
  try { assertId(def.id, 'person_id'); } catch { return 'person.id must match stable-id pattern'; }
  if (typeof def.display !== 'string' || def.display.length === 0 || def.display.length > DISPLAY_MAX) {
    return 'person.display must be a non-empty string<=64';
  }
  const origin = def.origin_id === undefined ? 'origin_dev' : def.origin_id;
  try { assertId(origin, 'origin_id'); } catch { return 'person.origin_id must match stable-id pattern'; }
  // Incentive tags (M004 disclosure input) are validated here but NEVER
  // exposed through player-facing person views (see query below).
  if (def.incentives !== undefined) {
    if (!Array.isArray(def.incentives) || def.incentives.length > 8) return 'person.incentives: array<=8';
    for (const t of def.incentives) {
      if (typeof t !== 'string' || !TAG_RE.test(t)) return `bad incentive tag: ${t}`;
    }
  }
  return null;
}

/** Seed helper: registers defs through the command pipeline (journaled, idempotent). */
export function seedPeople(kernel, defs) {
  const out = [];
  for (const def of defs) {
    out.push(kernel.dispatch({
      cmd_id: `seed_person_${def.id}`, type: 'register_person', actor: 'seed', params: def,
    }));
  }
  return out;
}

export function createPeople(kernel) {
  const persons = {}; // id -> {id, display, origin_id, incentives[]}

  kernel.registerStore('people', {
    getState: () => ({ persons }),
    setState: (s) => {
      for (const k of Object.keys(persons)) delete persons[k];
      Object.assign(persons, s.persons);
    },
  });

  kernel.registerCommand('register_person', {
    validate: (p) => validatePersonDef(p),
    resolve: (cmd, q) => {
      if (q.person(cmd.params.id)) return { rejected: `duplicate_person: ${cmd.params.id}` };
      const origin = cmd.params.origin_id === undefined ? 'origin_dev' : cmd.params.origin_id;
      return [{
        kind: 'PersonRegistered',
        data: {
          person: {
            id: cmd.params.id, display: cmd.params.display, origin_id: origin,
            incentives: [...(cmd.params.incentives || [])],
          },
        },
      }];
    },
  });

  kernel.onApply('PersonRegistered', (ev) => {
    persons[ev.data.person.id] = { ...ev.data.person };
  });

  // Player-facing views EXCLUDE incentives (information boundary: what an NPC
  // gains from is known only to disclosure logic until the player learns it).
  kernel.registerQuery('person', (id) => {
    const p = persons[id];
    return p ? { id: p.id, display: p.display, origin_id: p.origin_id } : null;
  });
  kernel.registerQuery('people', () => Object.values(persons).map((p) => ({ id: p.id, display: p.display, origin_id: p.origin_id })));

  // Privileged read for resolvers (disclosure logic). Never a query.
  // Defaults [] so pre-M004 saves (no incentives field) keep working.
  const reads = {
    incentivesOf: (id) => (persons[id] ? [...(persons[id].incentives || [])] : null),
  };

  return { reads };
}
