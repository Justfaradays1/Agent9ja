// sim/world/index.js — places, routines, intent, shared resources. Owner: sim/world (M009).
//
// A person is somewhere doing something: presence {place, anchor, activity}
// with a reason (routine, travel, obligation, emergency, placed, arrived).
// Places/anchors/travel are content (no coordinates, no pathfinding —
// arch P5). Intent is a deterministic priority list evaluated at phase
// boundaries and when relevant events name a person:
//   1. hard commitments — DEFERRED (no shift/meeting objects exist yet)
//   2. emergency: an active fault at the person's place
//   3. obligations: sorely-overdue debts owed, or due debts owed to them
//   4. routine block for the current phase
//   5. deterministic idle at home (no RNG flavour in M009 — M010 tuning)
// Explicit moves (`move_person`) hold until the next evaluation overwrites
// them. Travel consumes content travel time via in-transit state; a new move
// while travelling restarts from the original departure place.
//
// Shared resources (Light/Water/Kitty-ledger) follow small content rules.
// The transformer-fault → chatter → levy chain: `trigger_fault` lowers
// Light; content chatter reacts; `open_levy` opens a repair levy AND its
// story thread in one validated batch; `pay_levy` moves real kobo
// payer → collector (caretaker brokerage — no fake kitty account, the
// economy ledger stays consistent); funded levies repair + convert surplus
// to integer generator fuel-minutes; failed levies tag ghosts via the
// collector (bounded, one per ghost) and leave the fault for re-levy.
//
// Architecture notes: resolvers and reactions NEVER mutate module state —
// they read closures/snapshots and return events; only appliers write.
// Reactions take (ev, ctx) and read through ctx.q (frozen views), never
// through bespoke cross-module readers.
//
// Deliberately absent: coordinates, pathfinding, 3D, places beyond the
// compound + two neighbours, thread-named-person overrides (no assignee
// model), seed-driven faults, fuel purchase (surplus-only fuel).

import { assertId } from '../kernel/ids.js';

const PHASES = ['Night', 'Morning', 'Afternoon', 'Evening'];
const PLACE_RE = /^[a-z][a-z0-9_]{0,31}$/; // content-local keys (cf. M008 TAG_RE)
const MAX_PER_HEAD = 1000000;
const MAX_DUE_MIN = 20160; // two weeks
const MAX_TRAVEL_MIN = 480;

// ---- content validation (also called by tools/content-lint.js) ----

export function validatePlaces(doc) {
  if (!doc || !Array.isArray(doc.places) || doc.places.length === 0) return 'places: non-empty places array required';
  if (doc.places.length > 8) return 'places: at most 8 (M009 scope is compound + neighbours)';
  const ids = new Set();
  for (const [i, p] of doc.places.entries()) {
    if (!p || typeof p.id !== 'string' || !PLACE_RE.test(p.id)) return `places[${i}].id must match ${PLACE_RE}`;
    if (ids.has(p.id)) return `places: duplicate id ${p.id}`;
    ids.add(p.id);
    if (!Array.isArray(p.anchors) || p.anchors.length === 0) return `places[${p.id}]: non-empty anchors required`;
    const seen = new Set();
    for (const a of p.anchors) {
      if (typeof a !== 'string' || !PLACE_RE.test(a)) return `places[${p.id}]: bad anchor id ${a}`;
      if (seen.has(a)) return `places[${p.id}]: duplicate anchor ${a}`;
      seen.add(a);
    }
  }
  if (!Array.isArray(doc.travel_min)) return 'places: travel_min array required';
  const pairs = new Set();
  for (const [i, t] of doc.travel_min.entries()) {
    if (!t || !ids.has(t.from) || !ids.has(t.to)) return `travel_min[${i}]: unknown place`;
    if (t.from === t.to) return `travel_min[${i}]: self-travel is not a route`;
    if (!Number.isInteger(t.min) || t.min < 1 || t.min > MAX_TRAVEL_MIN) return `travel_min[${i}]: min must be 1..${MAX_TRAVEL_MIN}`;
    const key = [t.from, t.to].sort().join('>');
    if (pairs.has(key)) return `travel_min[${i}]: duplicate route ${key}`;
    pairs.add(key);
  }
  return null;
}

export function validateRoutines(routines, placesDoc) {
  if (!Array.isArray(routines) || routines.length === 0) return 'routines: non-empty array required';
  const placeById = new Map((placesDoc.places || []).map((p) => [p.id, p]));
  const routeExists = (a, b) => {
    if (a === b) return true;
    return (placesDoc.travel_min || []).some((t) =>
      (t.from === a && t.to === b) || (t.from === b && t.to === a));
  };
  const ids = new Set();
  for (const [i, r] of routines.entries()) {
    if (!r || typeof r.id !== 'string') return `routines[${i}].id required`;
    try { assertId(r.id, 'routine'); } catch { return `routines[${i}].id must match stable-id pattern`; }
    if (ids.has(r.id)) return `routines: duplicate id ${r.id}`;
    ids.add(r.id);
    if (!r.blocks || typeof r.blocks !== 'object') return `routines[${r.id}]: blocks required`;
    for (const ph of PHASES) {
      const b = r.blocks[ph];
      if (!b || typeof b !== 'object') return `routines[${r.id}]: block for ${ph} required`;
      const pl = placeById.get(b.place);
      if (!pl) return `routines[${r.id}].${ph}: unknown place ${b.place}`;
      if (!pl.anchors.includes(b.anchor)) return `routines[${r.id}].${ph}: unknown anchor ${b.anchor} in ${b.place}`;
      if (typeof b.activity !== 'string' || b.activity.length === 0 || b.activity.length > 60) {
        return `routines[${r.id}].${ph}: activity must be 1..60 chars`;
      }
    }
    // Every phase transition must be walkable, or setup fails loudly later.
    // Checked here so broken templates fail at boot/lint, not mid-sim.
    for (let k = 0; k < PHASES.length; k++) {
      const a = r.blocks[PHASES[k]].place, b = r.blocks[PHASES[(k + 1) % PHASES.length]].place;
      if (!routeExists(a, b)) return `routines[${r.id}]: no route ${a}>${b} (phase ${PHASES[k]} exit)`;
    }
  }
  return null;
}

export function validateWorldRules(rules) {
  if (!rules || typeof rules !== 'object') return 'world rules: object required';
  for (const ph of PHASES) {
    if (rules.nepa_schedule?.[ph] !== 'on' && rules.nepa_schedule?.[ph] !== 'off') {
      return `world rules: nepa_schedule.${ph} must be on|off`;
    }
  }
  for (const k of ['repair_cost', 'gen_cost_per_hour']) {
    if (!Number.isInteger(rules[k]) || rules[k] < 1) return `world rules: ${k} must be a positive integer`;
  }
  if (!Number.isInteger(rules.water_per_phase_per_resident) || rules.water_per_phase_per_resident < 0) {
    return 'world rules: water_per_phase_per_resident must be a non-negative integer';
  }
  if (!Number.isInteger(rules.levy_history_cap) || rules.levy_history_cap < 1 || rules.levy_history_cap > 20) {
    return 'world rules: levy_history_cap must be 1..20';
  }
  return null;
}

// Canonical empty world state, owned here so migration (sim/save) builds
// exactly what setState accepts. Deterministic: light starts 'none' and the
// first step's placement sets it correctly (no chatter on boot state).
export function emptyWorldState() {
  return {
    presence: {}, transit: {}, routines: {},
    resources: { light: { source: 'none' }, gen_on: false, fuel_min: 0, fuel_updated_t: 0, fuel_spent_noticed: false, water: 100 },
    levy: null, levies_history: [], fault: null,
    initialized: false, last_phase: null,
  };
}

export function createWorld(kernel, { places, routines = [], rules }) {
  const perr = validatePlaces(places);
  if (perr) throw new Error(perr);
  const rerr = validateRoutines(routines, places);
  if (rerr) throw new Error(rerr);
  const werr = validateWorldRules(rules);
  if (werr) throw new Error(werr);

  const placeById = new Map(places.places.map((p) => [p.id, p]));
  const routineById = new Map(routines.map((r) => [r.id, r]));
  const travelMap = new Map();
  for (const t of places.travel_min) {
    travelMap.set(`${t.from}>${t.to}`, t.min);
    travelMap.set(`${t.to}>${t.from}`, t.min);
  }
  const travelMin = (a, b) => (a === b ? 0 : (travelMap.get(`${a}>${b}`) ?? null));

  const presence = {}; // person -> {place, anchor, activity, reason, since_t}
  const transit = {}; // person -> {from, to, anchor, arrive_t} (+transient arrived mark, never snapshotted)
  const assigned = {}; // person -> {template, home}
  const resources = { light: { source: 'none' }, gen_on: false, fuel_min: 0, fuel_updated_t: 0, fuel_spent_noticed: false, water: 100 };
  let levy = null; // open levy record or null
  let leviesHistory = []; // closed levies, oldest dropped past cap
  let fault = null; // active fault record or null
  let initialized = false;
  let lastPhase = null;

  kernel.registerStore('world', {
    getState: () => ({ presence, transit, routines: assigned, resources, levy, levies_history: leviesHistory, fault, initialized, last_phase: lastPhase }),
    setState: (s) => {
      for (const k of Object.keys(presence)) delete presence[k];
      Object.assign(presence, s.presence || {});
      for (const k of Object.keys(transit)) delete transit[k];
      Object.assign(transit, s.transit || {});
      for (const k of Object.keys(assigned)) delete assigned[k];
      Object.assign(assigned, s.routines || {});
      Object.assign(resources, { light: { source: 'none' }, gen_on: false, fuel_min: 0, fuel_updated_t: 0, fuel_spent_noticed: false, water: 100 }, s.resources || {});
      levy = s.levy ?? null;
      leviesHistory = s.levies_history || [];
      fault = s.fault ?? null;
      initialized = !!s.initialized;
      lastPhase = s.last_phase ?? null;
    },
  });

  const firstAnchor = (place) => placeById.get(place).anchors[0];
  // Display position: destination while travelling (where_is shows arrive_t).
  const effectivePlace = (person) => (transit[person] ? transit[person].to : presence[person]?.place ?? null);
  // Travel legs always restart from the original departure (documented).
  const travelFrom = (person) => transit[person]?.from ?? presence[person]?.place ?? null;
  const residents = () => Object.entries(assigned).filter(([, a]) => a.home === 'compound').map(([p]) => p).sort();

  // Fuel bookkeeping without a per-step event: fuel_min is authoritative as
  // of fuel_updated_t; the live value derives deterministically. Mutations
  // snapshot (fuel_min, fuel_updated_t) together in their own events.
  const fuelNow = (now) => Math.max(0, resources.fuel_min - (resources.gen_on ? Math.max(0, now - resources.fuel_updated_t) : 0));

  function lightSource(phase, now) {
    if (fault) return 'fault';
    if (resources.gen_on && fuelNow(now) > 0) return 'generator';
    return rules.nepa_schedule[phase] === 'on' ? 'nepa' : 'none';
  }

  // Light transitions that deserve chatter. Fault ownership: the alarm
  // covers entry into fault; repair covers exit. Powered-source swaps are
  // silent but still sync the store (no divergence between stored source
  // and derivation); only gaining/losing light speaks.
  function lightTransition(prev, next) {
    const dark = (s) => s === 'none' || s === 'fault';
    if (prev === next) return [];
    if (!dark(next) && dark(prev)) return [{ kind: 'WorldLightRestored', data: { source: next } }];
    if (next === 'none' && prev !== 'none') return [{ kind: 'WorldLightLost', data: { from: prev } }];
    return [{ kind: 'WorldLightSource', data: { source: next } }];
  }

  // Sorely-overdue = Broken, or Due past its due time (in grace but late).
  function debtPressure(person, q, now) {
    let owesBad = false, owedWaiting = false;
    for (const o of q.obligations({ status: 'Due' }) || []) {
      if (o.due_t < now && o.owes === person) owesBad = true;
      if (o.due_t < now && o.owed === person) owedWaiting = true;
    }
    for (const o of q.obligations({ status: 'Broken' }) || []) {
      if (o.owes === person) owesBad = true;
      if (o.owed === person) owedWaiting = true;
    }
    return { owesBad, owedWaiting };
  }

  // Pure intent evaluation. routinesMap is a parameter (not the live map) so
  // resolvers can preview assignments without mutating. current = presence
  // record or null. Returns a PresenceSet-shaped record, or null.
  function evaluate(person, routinesMap, q, now, phase, current) {
    const a = routinesMap[person];
    if (!a) return null; // no routine, no presence: where_is stays null
    const home = a.home;
    if (fault && current?.place === fault.place) {
      return { person, place: current.place, anchor: current.anchor, activity: 'dealing_with_fault', reason: 'emergency' };
    }
    const { owesBad, owedWaiting } = debtPressure(person, q, now);
    if (owesBad) {
      return { person, place: home, anchor: firstAnchor(home), activity: 'laying_low', reason: 'obligation' };
    }
    if (owedWaiting) {
      const at = current ?? { place: home, anchor: firstAnchor(home) };
      return { person, place: at.place, anchor: at.anchor, activity: 'waiting_on_payment', reason: 'obligation' };
    }
    const b = routineById.get(a.template).blocks[phase];
    return { person, place: b.place, anchor: b.anchor, activity: b.activity, reason: 'routine' };
  }

  // Real events only (never pseudo-events): TravelStarted + travelling
  // PresenceSet when the want differs in place, else a direct PresenceSet.
  // allowTransit false (first placement) arrives directly, never in transit.
  function movesFor(person, routinesMap, q, now, phase, allowTransit = true) {
    const current = presence[person] ? { ...presence[person] } : null;
    const want = evaluate(person, routinesMap, q, now, phase, current);
    if (!want) return [];
    if (transit[person] && transit[person].to === want.place) return []; // already heading there
    const from = travelFrom(person);
    if (allowTransit && from && from !== want.place) {
      const min = travelMin(from, want.place);
      if (min === null) return []; // unreachable: routes validated at setup
      return [
        { kind: 'TravelStarted', data: { person, from, to: want.place, anchor: want.anchor, arrive_t: now + min } },
        { kind: 'PresenceSet', data: { person, place: want.place, anchor: null, activity: 'travelling', reason: 'travel' } },
      ];
    }
    const cur = presence[person];
    if (!allowTransit && transit[person]) {
      // First placement never starts in transit: direct arrival instead.
      return [{ kind: 'PresenceSet', data: { person, place: want.place, anchor: want.anchor, activity: want.activity === 'travelling' ? 'arrived' : want.activity, reason: 'placed' } }];
    }
    if (cur && cur.place === want.place && cur.anchor === want.anchor && cur.activity === want.activity) return [];
    return [{ kind: 'PresenceSet', data: { ...want } }];
  }

  kernel.onApply('RoutineSet', (ev) => {
    const d = ev.data;
    assigned[d.person] = { template: d.template, home: d.home };
  });

  kernel.onApply('PresenceSet', (ev) => {
    const d = ev.data;
    presence[d.person] = { place: d.place, anchor: d.anchor, activity: d.activity, reason: d.reason, since_t: ev.t };
    if (transit[d.person] && d.reason !== 'travel') delete transit[d.person];
  });

  kernel.onApply('TravelStarted', (ev) => {
    const d = ev.data;
    transit[d.person] = { from: d.from, to: d.to, anchor: d.anchor, arrive_t: d.arrive_t };
  });

  kernel.onApply('WorldPlaced', (ev) => {
    initialized = true;
    lastPhase = ev.data.phase;
    resources.light.source = ev.data.source; // boot state is quiet: no chatter for initial conditions
  });

  kernel.onApply('WorldPhaseAdvanced', (ev) => {
    lastPhase = ev.data.phase;
  });

  kernel.onApply('WorldFault', (ev) => {
    fault = { ...ev.data.fault };
    resources.light.source = 'fault';
  });

  kernel.onApply('WorldLightRestored', (ev) => { resources.light.source = ev.data.source; });
  kernel.onApply('WorldLightLost', () => { resources.light.source = 'none'; });
  kernel.onApply('WorldLightSource', (ev) => { resources.light.source = ev.data.source; });

  kernel.onApply('GeneratorSet', (ev) => {
    // Snapshot fuel bookkeeping together so derivation never drifts.
    resources.fuel_min = fuelNow(ev.t);
    resources.fuel_updated_t = ev.t;
    resources.gen_on = ev.data.on;
    resources.fuel_spent_noticed = false; // re-arm exhaustion detection
  });

  kernel.onApply('WorldWaterUsed', (ev) => {
    resources.water = Math.max(0, resources.water - ev.data.amount);
  });

  kernel.onApply('WaterRefilled', () => { resources.water = 100; });

  kernel.onApply('LevyOpened', (ev) => { levy = { ...ev.data.levy, paid: {}, status: 'open' }; });

  kernel.onApply('LevyPaid', (ev) => {
    if (levy && levy.id === ev.data.levy) levy.paid[ev.data.person] = ev.data.amount;
  });

  kernel.onApply('LevyFunded', (ev) => {
    if (levy && levy.id === ev.data.levy) {
      levy.status = 'funded';
      levy.closed_t = ev.t;
      resources.fuel_min = fuelNow(ev.t) + ev.data.fuel_min;
      resources.fuel_updated_t = ev.t;
      resources.fuel_spent_noticed = false; // refuel re-arms exhaustion detection
      fault = null; // repair is the funding consequence; light recomputed by reaction
      leviesHistory.push({ ...levy });
      while (leviesHistory.length > rules.levy_history_cap) leviesHistory.shift();
      levy = null;
    }
  });

  kernel.onApply('LevyFailed', (ev) => {
    if (levy && levy.id === ev.data.levy) {
      levy.status = 'failed';
      levy.closed_t = ev.t;
      levy.ghosts = [...ev.data.ghosts];
      delete levy.closing; // transient booking mark must not pollute history
      leviesHistory.push({ ...levy });
      while (leviesHistory.length > rules.levy_history_cap) leviesHistory.shift();
      levy = null;
    }
  });

  const needPerson = (q, id, what) => {
    try { assertId(id, what); } catch { return `bad ${what} id: ${id}`; }
    if (!q.person(id)) return `unknown_person: ${id}`;
    return null;
  };

  kernel.registerCommand('set_routine', {
    validate: (p) => {
      if (!p || typeof p.person !== 'string' || typeof p.template !== 'string' || typeof p.home !== 'string') {
        return 'set_routine needs {person, template, home}';
      }
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      const bad = needPerson(q, p.person, 'person');
      if (bad) return { rejected: bad };
      try { assertId(p.template, 'template'); } catch { return { rejected: `bad template id: ${p.template}` }; }
      if (!routineById.has(p.template)) return { rejected: `unknown_template: ${p.template}` };
      if (!placeById.has(p.home)) return { rejected: `unknown_place: ${p.home}` };
      const now = q.time().minutes;
      const phase = q.time().phase;
      const out = [{ kind: 'RoutineSet', data: { person: p.person, template: p.template, home: p.home } }];
      // Preview map: shared evaluator, zero resolver mutation (applier owns it).
      const preview = { ...assigned, [p.person]: { template: p.template, home: p.home } };
      return out.concat(movesFor(p.person, preview, q, now, phase, true));
    },
  });

  kernel.registerCommand('move_person', {
    validate: (p) => {
      if (!p || typeof p.person !== 'string' || typeof p.place !== 'string') return 'move_person needs {person, place}';
      if (p.anchor !== undefined && typeof p.anchor !== 'string') return 'bad anchor';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      const bad = needPerson(q, p.person, 'person');
      if (bad) return { rejected: bad };
      if (!placeById.has(p.place)) return { rejected: `unknown_place: ${p.place}` };
      const anchor = p.anchor ?? firstAnchor(p.place);
      if (!placeById.get(p.place).anchors.includes(anchor)) return { rejected: `unknown_anchor: ${anchor} in ${p.place}` };
      if (transit[p.person]?.to === p.place && transit[p.person]?.anchor === anchor) return { rejected: 'already_there' };
      const from = travelFrom(p.person);
      const cur = presence[p.person];
      if (!transit[p.person] && from === p.place && cur && cur.anchor === anchor) return { rejected: 'already_there' };
      const now = q.time().minutes;
      if (!from) {
        return [{ kind: 'PresenceSet', data: { person: p.person, place: p.place, anchor, activity: 'arrived', reason: 'placed' } }];
      }
      const min = travelMin(from, p.place);
      if (min === null) return { rejected: `no_route: ${from}>${p.place}` };
      if (min === 0) {
        return [{ kind: 'PresenceSet', data: { person: p.person, place: p.place, anchor, activity: 'arrived', reason: 'placed' } }];
      }
      return [
        { kind: 'TravelStarted', data: { person: p.person, from, to: p.place, anchor, arrive_t: now + min } },
        { kind: 'PresenceSet', data: { person: p.person, place: p.place, anchor: null, activity: 'travelling', reason: 'travel' } },
      ];
    },
  });

  kernel.registerCommand('trigger_fault', {
    validate: (p) => {
      if (!p || typeof p.fault_id !== 'string' || typeof p.place !== 'string' || typeof p.kind !== 'string') {
        return 'trigger_fault needs {fault_id, place, kind}';
      }
      try { assertId(p.fault_id, 'fault_id'); } catch { return `bad fault_id: ${p.fault_id}`; }
      if (p.kind !== 'transformer') return 'bad kind: transformer only (M009 scope)';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (!placeById.has(p.place)) return { rejected: `unknown_place: ${p.place}` };
      if (fault) return { rejected: `fault_active: ${fault.id}` };
      return [{ kind: 'WorldFault', data: { fault: { id: p.fault_id, place: p.place, kind: p.kind } } }];
    },
  });

  kernel.registerCommand('open_levy', {
    validate: (p) => {
      if (!p || typeof p.levy_id !== 'string' || typeof p.convenor !== 'string' || typeof p.collector !== 'string') {
        return 'open_levy needs {levy_id, convenor, collector, per_head, due_in_min, cause}';
      }
      try { assertId(p.levy_id, 'levy_id'); } catch { return `bad levy_id: ${p.levy_id}`; }
      if (!Number.isInteger(p.per_head) || p.per_head < 1 || p.per_head > MAX_PER_HEAD) {
        return `bad per_head: 1..${MAX_PER_HEAD} kobo required`;
      }
      if (!Number.isInteger(p.due_in_min) || p.due_in_min < 1 || p.due_in_min > MAX_DUE_MIN) {
        return `bad due_in_min: 1..${MAX_DUE_MIN} required`;
      }
      if (typeof p.cause !== 'string') return 'bad cause: fault id required';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      for (const [id, what] of [[p.convenor, 'convenor'], [p.collector, 'collector']]) {
        const bad = needPerson(q, id, what);
        if (bad) return { rejected: bad };
      }
      if (q.balance(p.collector) === null || q.balance(p.collector) === undefined) {
        return { rejected: `no_collector_account: ${p.collector}` };
      }
      if (!fault || p.cause !== fault.id) return { rejected: 'levy_needs_active_fault: cause must be the active fault' };
      if (levy) return { rejected: `levy_already_open: ${levy.id}` };
      const threadId = `thread_${p.levy_id}`;
      if ((q.threads({}) || []).some((t) => t.id === threadId)) return { rejected: `levy_id_reused: ${threadId}` };
      const members = Object.keys(assigned).sort();
      if (members.length === 0) return { rejected: 'levy_needs_members: assign routines first' };
      if (p.per_head * members.length < rules.repair_cost) {
        return { rejected: `underfunded_levy: ${p.per_head}x${members.length} cannot reach repair ${rules.repair_cost}` };
      }
      // Ghost tags need existing relationships: the Tagged applier throws on
      // unknown pairs by design, so require them up front, loudly. The
      // collector is exempt (organising labour is their share) and can never
      // be their own ghost.
      for (const m of members) {
        if (m === p.collector) continue;
        if (!q.rel(p.collector, m)) return { rejected: `no_relationship: ${p.collector}>${m} needed for ghost liability` };
      }
      const now = q.time().minutes;
      const dueT = now + p.due_in_min;
      return [
        { kind: 'LevyOpened', data: { levy: { id: p.levy_id, convenor: p.convenor, collector: p.collector, per_head: p.per_head, due_t: dueT, cause: p.cause, members } } },
        {
          kind: 'ThreadOpened',
          data: {
            thread: {
              id: threadId, storylet: null, opened_t: now, deadline_t: dueT,
              context: { levy: p.levy_id }, tags: ['levy'], default_events: [],
              status: 'open', origin_id: 'origin_dev',
            },
          },
        },
      ];
    },
  });

  kernel.registerCommand('pay_levy', {
    validate: (p) => {
      if (!p || typeof p.person !== 'string' || typeof p.levy_id !== 'string') return 'pay_levy needs {person, levy_id, amount}';
      try { assertId(p.person, 'person'); } catch { return `bad person id: ${p.person}`; }
      if (!Number.isInteger(p.amount) || p.amount < 1) return 'bad amount: positive integer kobo required';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (!levy || levy.id !== p.levy_id || levy.status !== 'open') return { rejected: 'no_open_levy: levy is not open' };
      if (!q.person(p.person)) return { rejected: `unknown_person: ${p.person}` };
      if (p.amount !== levy.per_head) {
        return { rejected: p.amount < levy.per_head ? `underpayment: share is ${levy.per_head}` : `overpayment: share is ${levy.per_head}` };
      }
      if (levy.paid[p.person] !== undefined) return { rejected: `already_paid: ${p.person}` };
      const out = [];
      if (p.person !== levy.collector) {
        const bal = q.balance(p.person);
        if (bal === null || bal === undefined) return { rejected: `no_account: ${p.person}` };
        if (bal < p.amount) return { rejected: `insufficient_funds: ${p.person}` };
        out.push({
          kind: 'MoneyMoved',
          data: { from: p.person, to: levy.collector, amount: p.amount, memo: `levy ${levy.id}`, obligation: null, origin_id: 'origin_dev' },
        });
      }
      // Collector self-share moves no money (their wallet IS the pot) but the
      // receipt is real: the pot-holder's hands already hold it.
      out.push({ kind: 'LevyPaid', data: { levy: levy.id, person: p.person, amount: p.amount } });
      const collected = Object.values(levy.paid).reduce((a, b) => a + b, 0) + p.amount;
      if (collected >= rules.repair_cost) {
        const surplus = collected - rules.repair_cost;
        out.push({
          kind: 'LevyFunded',
          data: { levy: levy.id, place: fault?.place ?? null, collected, repair_cost: rules.repair_cost, fuel_min: Math.floor((surplus * 60) / rules.gen_cost_per_hour) },
        });
      }
      return out;
    },
  });

  kernel.registerCommand('set_generator', {
    validate: (p) => {
      if (!p || typeof p.person !== 'string' || typeof p.on !== 'boolean') return 'set_generator needs {person, on}';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      const bad = needPerson(q, p.person, 'person');
      if (bad) return { rejected: bad };
      if (p.on && fuelNow(q.time().minutes) <= 0) return { rejected: 'no_fuel: generator needs levy surplus first' };
      if (p.on === resources.gen_on) return { rejected: p.on ? 'generator_already_on' : 'generator_already_off' };
      return [{ kind: 'GeneratorSet', data: { on: p.on, by: p.person } }];
    },
  });

  kernel.registerCommand('refill_tank', {
    validate: (p) => {
      if (!p || typeof p.person !== 'string') return 'refill_tank needs {person}';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      const bad = needPerson(q, p.person, 'person');
      if (bad) return { rejected: bad };
      if (resources.water >= 100) return { rejected: 'tank_already_full' };
      return [{ kind: 'WaterRefilled', data: { by: p.person } }];
    },
  });

  // ---- reactions (ev, ctx): read through ctx.q, return events, mutate nothing ----

  kernel.on('StepAdvanced', (ev, ctx) => {
    const now = ev.data.minutes;
    const q = ctx.q;
    // Per-step phase from event data, NOT q.time(): the live clock is already
    // at the command's final step by the time reactions run, so q.time()
    // would evaluate every step against the end state (M009 timing audit —
    // routines and light fired hours early in multi-step commands).
    const phase = ev.data.phase ?? q.time().phase;
    const crossed = ev.data.crossed ?? [];
    const out = [];

    // Arrivals: travellers whose time has come land (applier clears transit).
    // Booking mark (story-seed precedent): one multi-step command queues many
    // StepAdvanced events before any arrival applies, so without a synchronous
    // mark every later step would emit a duplicate arrival. The mark is
    // transient — transit is deleted on apply, and step-boundary saves can
    // never observe it mid-dispatch.
    for (const person of Object.keys(transit).sort()) {
      const t = transit[person];
      if (!t.arrived && now >= t.arrive_t) {
        t.arrived = true;
        // Landing on the routine block resumes routine activity immediately;
        // landing anywhere else (manual moves) stays an honest 'arrived'.
        const a = assigned[person];
        const block = a ? routineById.get(a.template).blocks[phase] : null;
        if (block && block.place === t.to && block.anchor === t.anchor) {
          out.push({ kind: 'PresenceSet', data: { person, place: t.to, anchor: t.anchor, activity: block.activity, reason: 'routine' } });
        } else {
          out.push({ kind: 'PresenceSet', data: { person, place: t.to, anchor: t.anchor, activity: 'arrived', reason: 'arrived' } });
        }
      }
    }

    if (!initialized) {
      initialized = true; // booking mark; WorldPlaced applier confirms
      out.push({ kind: 'WorldPlaced', data: { phase, source: lightSource(phase, now) } });
      // Only the truly unplaced: set_routine already places immediately, and
      // in-flight travel must never be steamrolled by boot placement.
      for (const person of Object.keys(assigned).sort()) {
        if (presence[person] || transit[person]) continue;
        out.push(...movesFor(person, assigned, q, now, phase, false));
      }
      return out;
    }

    if (crossed.length > 0) {
      lastPhase = phase; // booking mark; WorldPhaseAdvanced applier confirms
      out.push({ kind: 'WorldPhaseAdvanced', data: { phase } });
      for (const person of Object.keys(assigned).sort()) {
        // Travel holds until arrival: phase evaluations never yank travellers
        // (arrival resumes routine when it lands on the block). Travellers
        // whose arrival is already due are evaluated normally — the arrival
        // loop above placed them, so holding would strand them.
        if (transit[person] && now < transit[person].arrive_t) continue;
        for (const m of movesFor(person, assigned, q, now, phase, true)) {
          out.push(m);
          // Booking mark: appliers for these run after later steps' reactions,
          // so record transit synchronously or every later step re-emits it.
          if (m.kind === 'TravelStarted') transit[person] = { ...m.data };
        }
      }
      // Light + water follow the phase, not every step.
      for (const e of lightTransition(resources.light.source, lightSource(phase, now))) out.push(e);
      const res = residents();
      if (res.length > 0) {
        const prev = resources.water;
        const amt = res.length * rules.water_per_phase_per_resident;
        out.push({ kind: 'WorldWaterUsed', data: { amount: amt, prev } });
      }
    } else if (resources.light.source === 'generator' && resources.gen_on) {
      // Fuel burns while the generator carries the compound. Edge-triggered
      // via booking mark: without it every later step in the command would
      // re-emit the loss (store reads are command-start stale). Scrubbed by
      // refuel/toggle appliers, never by time passing.
      if (fuelNow(now) <= 0 && !resources.fuel_spent_noticed) {
        resources.fuel_spent_noticed = true;
        for (const e of lightTransition('generator', lightSource(phase, now))) out.push(e);
      }
    }

    // Levy deadline: funded levies close early in pay_levy, so a due open
    // levy is always failed. Ghosts = members who never paid, minus the
    // exempt collector (organising labour is their share). Booking-marked:
    // without it every later step in the command would close it again.
    if (levy && levy.status === 'open' && !levy.closing && now >= levy.due_t) {
      levy.closing = true;
      const ghosts = levy.members.filter((m) => m !== levy.collector && levy.paid[m] === undefined);
      out.push({
        kind: 'LevyFailed',
        data: { levy: levy.id, place: fault?.place ?? null, collector: levy.collector, collected: Object.values(levy.paid).reduce((a, b) => a + b, 0), ghosts },
      });
    }
    return out;
  });

  function reevaluatePersons(persons, ctx) {
    const q = ctx.q;
    const now = q.time().minutes;
    const phase = q.time().phase;
    const out = [];
    for (const person of [...new Set(persons)].sort()) {
      if (!assigned[person] || !presence[person] || transit[person]) continue;
      const want = evaluate(person, assigned, q, now, phase, { ...presence[person] });
      if (!want) continue;
      const cur = presence[person];
      if (cur.place === want.place && cur.anchor === want.anchor && cur.activity === want.activity) continue;
      const from = travelFrom(person);
      if (from && from !== want.place) {
        const min = travelMin(from, want.place);
        if (min === null) continue; // validated at setup; never invent a route
        out.push({ kind: 'TravelStarted', data: { person, from, to: want.place, anchor: want.anchor, arrive_t: now + min } });
        out.push({ kind: 'PresenceSet', data: { person, place: want.place, anchor: null, activity: 'travelling', reason: 'travel' } });
      } else {
        out.push({ kind: 'PresenceSet', data: { ...want } });
      }
    }
    return out;
  }

  kernel.on('ObligationDue', (ev, ctx) => reevaluatePersons([ev.data.owes, ev.data.owed], ctx));
  kernel.on('ObligationBroken', (ev, ctx) => reevaluatePersons([ev.data.owes, ev.data.owed], ctx));

  kernel.on('WorldFault', (ev, ctx) => {
    // Residents at the fault place drop routine for the emergency.
    const q = ctx.q;
    const now = q.time().minutes;
    const phase = q.time().phase;
    const out = [];
    for (const person of Object.keys(assigned).sort()) {
      if (transit[person] || effectivePlace(person) !== ev.data.fault.place) continue;
      const cur = presence[person] ? { ...presence[person] } : null;
      const want = evaluate(person, assigned, q, now, phase, cur);
      if (!want || (cur && cur.activity === want.activity)) continue;
      out.push({ kind: 'PresenceSet', data: { ...want } });
    }
    return out;
  });

  kernel.on('WorldWaterUsed', (ev, ctx) => {
    // prev rides in the event (applier already ran): exactly-once low-water.
    if (ev.data.prev > 0 && ctx.q.world().resources.water <= 0) {
      return [{ kind: 'WorldWaterLow', data: { level: 0 } }];
    }
    return [];
  });

  kernel.on('GeneratorSet', (ev, ctx) => {
    const q = ctx.q;
    return lightTransition(resources.light.source, lightSource(q.time().phase, q.time().minutes));
  });

  kernel.on('LevyFunded', (ev, ctx) => {
    const q = ctx.q;
    const out = [{ kind: 'ThreadClosed', data: { id: `thread_${ev.data.levy}`, resolution: 'levy_funded' } }];
    // Fault cleared by the applier before reactions run: recompute against
    // repaired state so relief chatter fires exactly once, here.
    for (const e of lightTransition(resources.light.source, lightSource(q.time().phase, q.time().minutes))) out.push(e);
    // Residents standing at the fault resume routine immediately (relief is
    // visible now, not at the next phase boundary).
    out.push(...resumeAtPlace(ev.data.place, ctx));
    return out;
  });

  kernel.on('LevyFailed', (ev, ctx) => {
    const out = [{ kind: 'ThreadClosed', data: { id: `thread_${ev.data.levy}`, resolution: 'levy_failed' } }];
    // One tag per ghost from the collector (bounded by member count, not
    // pairs). Relationships were required at open_levy, so the applier
    // cannot hit an unknown pair. Collector rides in the event because the
    // applier already closed the levy before reactions run.
    for (const g of [...(ev.data.ghosts || [])].sort()) {
      if (ev.data.collector) out.push({ kind: 'RelationshipTagged', data: { a: ev.data.collector, b: g, tag: 'levy_ghost', op: 'add' } });
    }
    out.push(...resumeAtPlace(ev.data.place, ctx));
    return out;
  });

  // Re-evaluate everyone currently at a place (post-fault resume). Failed
  // levies leave the fault active, so emergency simply re-applies (no-op).
  function resumeAtPlace(place, ctx) {
    if (!place) return [];
    const q = ctx.q;
    const now = q.time().minutes;
    const phase = q.time().phase;
    const out = [];
    for (const person of Object.keys(assigned).sort()) {
      if (transit[person] || effectivePlace(person) !== place) continue;
      const cur = presence[person] ? { ...presence[person] } : null;
      const want = evaluate(person, assigned, q, now, phase, cur);
      if (!want || (cur && cur.place === want.place && cur.anchor === want.anchor && cur.activity === want.activity)) continue;
      const from = travelFrom(person);
      if (from && from !== want.place) {
        const min = travelMin(from, want.place);
        if (min === null) continue;
        out.push({ kind: 'TravelStarted', data: { person, from, to: want.place, anchor: want.anchor, arrive_t: now + min } });
        out.push({ kind: 'PresenceSet', data: { person, place: want.place, anchor: null, activity: 'travelling', reason: 'travel' } });
      } else {
        out.push({ kind: 'PresenceSet', data: { ...want } });
      }
    }
    return out;
  }

  // ---- queries (frozen views) ----

  kernel.registerQuery('where_is', (person) => {
    if (typeof person !== 'string') return { error: 'where_is needs a person id' };
    if (!kernel.query().person(person)) return { error: `unknown_person: ${person}` };
    const p = presence[person];
    if (!p) return null; // known but never placed: no routine assigned yet
    const view = { ...p };
    if (transit[person]) view.arrive_t = transit[person].arrive_t;
    return JSON.parse(JSON.stringify(view));
  });

  kernel.registerQuery('world', () => {
    const now = kernel.query().time().minutes;
    const open = levy ? {
      id: levy.id, convenor: levy.convenor, collector: levy.collector,
      per_head: levy.per_head, due_t: levy.due_t, cause: levy.cause,
      members: [...levy.members], paid: { ...levy.paid },
      collected: Object.values(levy.paid).reduce((a, b) => a + b, 0),
    } : null;
    return JSON.parse(JSON.stringify({
      places: [...placeById.keys()],
      presence: Object.fromEntries(Object.entries(presence).map(([k, v]) => [k, { ...v }])),
      resources: {
        light: { ...resources.light }, gen_on: resources.gen_on,
        fuel_min: fuelNow(now), water: resources.water,
      },
      levy: open,
      levies_history: leviesHistory.map((l) => ({ ...l, paid: { ...l.paid } })),
      fault,
    }));
  });

  return {};
}
