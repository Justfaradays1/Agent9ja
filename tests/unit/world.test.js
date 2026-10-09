// tests/unit/world.test.js — places, routines, intent, shared resources,
// levy chain (M009). Two simulated days run with no commands; overrides,
// travel times, and resource consequences are proven, not asserted by symbol.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKernel } from '../../sim/kernel/pipeline.js';
import { createPeople, seedPeople } from '../../sim/people/index.js';
import { createRelationships } from '../../sim/relationships/index.js';
import { createEconomy, seedAccounts } from '../../sim/economy/index.js';
import { createObligations } from '../../sim/obligations/index.js';
import { createKnowledge } from '../../sim/knowledge/index.js';
import { createMemory } from '../../sim/memory/index.js';
import { createStory } from '../../sim/story/index.js';
import { createComms } from '../../sim/comms/index.js';
import {
  createWorld, validatePlaces, validateRoutines, validateWorldRules, emptyWorldState,
} from '../../sim/world/index.js';

const STANCE = { hysteresis: 5, thresholds: [{ stance: 'Neutral', when: {} }] };
const KINDS = { Debt: {}, PromisedAction: {}, Favour: {}, Vouch: {} };

const PLACES = {
  places: [
    { id: 'compound', anchors: ['gate', 'room'] },
    { id: 'market', anchors: ['stall'] },
  ],
  travel_min: [{ from: 'compound', to: 'market', min: 30 }],
};
const ROUTINES = [
  {
    id: 'routine_home',
    blocks: {
      Morning: { place: 'compound', anchor: 'room', activity: 'resting' },
      Afternoon: { place: 'compound', anchor: 'gate', activity: 'gisting' },
      Evening: { place: 'compound', anchor: 'room', activity: 'eating' },
      Night: { place: 'compound', anchor: 'room', activity: 'sleeping' },
    },
  },
  {
    id: 'routine_walk',
    blocks: {
      Morning: { place: 'market', anchor: 'stall', activity: 'selling' },
      Afternoon: { place: 'market', anchor: 'stall', activity: 'selling' },
      Evening: { place: 'compound', anchor: 'gate', activity: 'gisting' },
      Night: { place: 'compound', anchor: 'room', activity: 'sleeping' },
    },
  },
];
const RULES = {
  nepa_schedule: { Night: 'off', Morning: 'on', Afternoon: 'off', Evening: 'on' },
  repair_cost: 20000, gen_cost_per_hour: 5000,
  water_per_phase_per_resident: 5, levy_history_cap: 5,
};

function world(seed = 'world-seed', opts = {}) {
  const kernel = createKernel({ seed });
  const people = createPeople(kernel);
  createRelationships(kernel, STANCE);
  createEconomy(kernel);
  const memory = createMemory(kernel, []);
  createObligations(kernel, KINDS, { memoryReads: memory.reads });
  const knowledge = createKnowledge(kernel, { disclosure: [] });
  createStory(kernel, { storylets: [], director: null });
  createComms(kernel, { knowledge, chatter: opts.chatter ?? [], templates: opts.templates ?? [] });
  createWorld(kernel, {
    places: opts.places ?? PLACES,
    routines: opts.routines ?? ROUTINES,
    rules: opts.rules ?? RULES,
  });
  seedPeople(kernel, [
    { id: 'person_tola', display: 'Tola' },
    { id: 'npc_musa', display: 'Musa' },
    { id: 'npc_seyi', display: 'Seyi' },
  ]);
  seedAccounts(kernel, [
    { person: 'person_tola', opening: 800000 },
    { person: 'npc_musa', opening: 50000 },
    { person: 'npc_seyi', opening: 50000 },
  ]);
  return kernel;
}

function d(k, id, type, params) {
  const r = k.dispatch({ cmd_id: id, type, actor: 't', params });
  assert.equal(r.status, 'applied', `${id}: ${r.reason || 'ok'}`);
  return r;
}

function rej(k, id, type, params) {
  const r = k.dispatch({ cmd_id: id, type, actor: 't', params });
  assert.equal(r.status, 'rejected', `${id} should reject`);
  return r.reason;
}

function routine(k, person, template = 'routine_home', home = 'compound') {
  d(k, `cmd_rt_${person}_${template}`, 'set_routine', { person, template, home });
}

function relate(k, a, b) {
  d(k, `cmd_rel_${a}_${b}`, 'open_relationship', { a, b });
}

function faultLevy(k, tag, o = {}) {
  const faultId = o.fault ?? `fault_${tag}`;
  if (!o.skipFault) {
    d(k, `cmd_f_${tag}`, 'trigger_fault', { fault_id: faultId, place: 'compound', kind: 'transformer' });
  }
  d(k, `cmd_l_${tag}`, 'open_levy', {
    levy_id: o.levy ?? `levy_${tag}`, convenor: o.convenor ?? 'npc_musa', collector: o.collector ?? 'npc_musa',
    per_head: o.per_head ?? 8000, due_in_min: o.due ?? 500, cause: faultId,
  });
}

describe('content validation fails loud at boot, not mid-sim', () => {
  it('places: bad ids, empty anchors, unknown travel, bad minutes', () => {
    assert.match(validatePlaces({ places: [], travel_min: [] }), /non-empty/);
    assert.match(validatePlaces({ places: [{ id: 'Bad Place', anchors: ['x'] }], travel_min: [] }), /must match/);
    assert.match(validatePlaces({ places: [{ id: 'compound', anchors: [] }], travel_min: [] }), /non-empty anchors/);
    assert.match(validatePlaces({ places: [{ id: 'compound', anchors: ['gate', 'gate'] }], travel_min: [] }), /duplicate anchor/);
    assert.match(validatePlaces({ ...PLACES, travel_min: [{ from: 'compound', to: 'nowhere', min: 5 }] }), /unknown place/);
    assert.match(validatePlaces({ ...PLACES, travel_min: [{ from: 'compound', to: 'market', min: 0 }] }), /min must be/);
    assert.equal(validatePlaces(PLACES), null);
  });

  it('routines: unknown place/anchor, missing phase, unwalkable transition', () => {
    const badPlace = [{ id: 'routine_x1', blocks: { Morning: { place: 'nowhere', anchor: 'a', activity: 'x' }, Afternoon: { place: 'compound', anchor: 'gate', activity: 'x' }, Evening: { place: 'compound', anchor: 'gate', activity: 'x' }, Night: { place: 'compound', anchor: 'gate', activity: 'x' } } }];
    assert.match(validateRoutines(badPlace, PLACES), /unknown place/);
    const badAnchor = JSON.parse(JSON.stringify(ROUTINES));
    badAnchor[0].blocks.Morning.anchor = 'nope';
    assert.match(validateRoutines(badAnchor, PLACES), /unknown anchor/);
    const missingPhase = JSON.parse(JSON.stringify(ROUTINES));
    delete missingPhase[0].blocks.Night;
    assert.match(validateRoutines(missingPhase, PLACES), /block for Night required/);
    const noRoutePlaces = { places: PLACES.places, travel_min: [] };
    assert.match(validateRoutines(ROUTINES, noRoutePlaces), /no route/);
    assert.match(validateRoutines([{ id: 'nope', blocks: {} }], PLACES), /stable-id pattern/);
    assert.equal(validateRoutines(ROUTINES, PLACES), null);
  });

  it('world rules: schedule values and positive integers', () => {
    assert.match(validateWorldRules({}), /nepa_schedule/);
    assert.match(validateWorldRules({ ...RULES, repair_cost: 0 }), /repair_cost/);
    assert.match(validateWorldRules({ ...RULES, levy_history_cap: 99 }), /levy_history_cap/);
    assert.equal(validateWorldRules(RULES), null);
  });

  it('constructor throws on bad content (fail loud at boot)', () => {
    const kernel = createKernel({ seed: 'badboot' });
    assert.throws(() => createWorld(kernel, { places: { places: [], travel_min: [] }, routines: ROUTINES, rules: RULES }), /non-empty places/);
  });
});

describe('placement and movement', () => {
  it('set_routine rejects unknowns; places immediately with reason', () => {
    const k = world();
    assert.match(rej(k, 'cmd_x1', 'set_routine', { person: 'npc_ghost', template: 'routine_home', home: 'compound' }), /unknown_person/);
    assert.match(rej(k, 'cmd_x2', 'set_routine', { person: 'person_tola', template: 'routine_nope', home: 'compound' }), /unknown_template/);
    assert.match(rej(k, 'cmd_x3', 'set_routine', { person: 'person_tola', template: 'routine_home', home: 'nowhere' }), /unknown_place/);
    routine(k, 'person_tola');
    assert.deepEqual(k.query().where_is('person_tola'), {
      place: 'compound', anchor: 'room', activity: 'resting', reason: 'routine', since_t: 480,
    });
  });

  it('where_is: unknown person errors, unplaced known person is null', () => {
    const k = world();
    assert.match(k.query().where_is('npc_ghost').error, /unknown_person/);
    assert.equal(k.query().where_is('person_tola'), null);
  });

  it('travel consumes content time; arrival lands with anchor', () => {
    const k = world();
    routine(k, 'person_tola');
    d(k, 'cmd_mv1', 'move_person', { person: 'person_tola', place: 'market' });
    const enroute = k.query().where_is('person_tola');
    assert.equal(enroute.activity, 'travelling');
    assert.equal(enroute.arrive_t, 480 + 30, 'compound>market is 30 content minutes');
    d(k, 'cmd_adv1', 'advance_time', { steps: 6 }); // +30m: arrival
    assert.deepEqual(k.query().where_is('person_tola'), {
      place: 'market', anchor: 'stall', activity: 'arrived', reason: 'arrived', since_t: 510,
    });
  });

  it('already_there, no_route, unknown anchor fail closed', () => {
    const k = world();
    routine(k, 'person_tola');
    assert.match(rej(k, 'cmd_m1', 'move_person', { person: 'person_tola', place: 'compound', anchor: 'room' }), /already_there/);
    assert.match(rej(k, 'cmd_m2', 'move_person', { person: 'person_tola', place: 'market', anchor: 'nope' }), /unknown_anchor/);
    assert.match(rej(k, 'cmd_m3', 'move_person', { person: 'person_tola', place: 'nowhere' }), /unknown_place/);
  });

  it('no_route when places are disconnected', () => {
    const places = {
      places: [...PLACES.places, { id: 'island', anchors: ['hut'] }],
      travel_min: [...PLACES.travel_min],
    };
    const k = world('island-seed', { places });
    routine(k, 'person_tola');
    assert.match(rej(k, 'cmd_mi1', 'move_person', { person: 'person_tola', place: 'island' }), /no_route: compound>island/);
  });

  it('new move while travelling restarts from the original departure', () => {
    const places = {
      places: [...PLACES.places, { id: 'island', anchors: ['hut'] }],
      travel_min: [...PLACES.travel_min, { from: 'market', to: 'island', min: 10 }],
    };
    const k = world('restart-seed', { places });
    routine(k, 'person_tola');
    d(k, 'cmd_mr1', 'move_person', { person: 'person_tola', place: 'market' });
    d(k, 'cmd_advr1', 'advance_time', { steps: 1 }); // 5 min along, still travelling
    // From the destination (market) island IS reachable — but legs restart
    // from the original departure (compound), which has no island route.
    assert.match(rej(k, 'cmd_mr2', 'move_person', { person: 'person_tola', place: 'island' }), /no_route: compound>island/);
  });
});

describe('two simulated days with no commands', () => {
  function twoDays(seed) {
    const k = world(seed);
    routine(k, 'person_tola', 'routine_home');
    routine(k, 'npc_musa', 'routine_home');
    routine(k, 'npc_seyi', 'routine_walk');
    for (let i = 0; i < 12; i++) {
      d(k, `cmd_2d${i}`, 'advance_time', { steps: 48 });
    }
    return k;
  }

  it('routines are followed across phases; clock, light, water evolve', () => {
    const k = twoDays('twodays-seed');
    assert.equal(k.query().time().minutes, 480 + 2880);
    // Final phase is Morning again: walker sells at market, homebodies rest.
    assert.equal(k.query().where_is('npc_seyi').place, 'market');
    assert.equal(k.query().where_is('npc_seyi').activity, 'selling');
    assert.equal(k.query().where_is('person_tola').activity, 'resting');
    assert.equal(k.query().world().resources.light.source, 'nepa', 'Morning schedule');
    assert.equal(k.query().world().resources.water, 0, '3 residents x 5 x 9 phases, clamped');
    assert.equal(k.query().world().resources.fuel_min, 0, 'no levy, no fuel');
  });

  it('deterministic across identical twins; no guard trips on quiet days', () => {
    const a = twoDays('same-seed');
    const b = twoDays('same-seed');
    assert.equal(a.snapshot(), b.snapshot());
    const kinds = a.query().journal(5000).map((e) => e.kind);
    assert.ok(!kinds.includes('BudgetGuardTripped'), 'chunked advances stay under budget');
    assert.ok(!kinds.includes('CascadeGuardTripped'));
    assert.ok(!kinds.includes('ReactionFailed'));
  });

  it('low water fires exactly once per emptying', () => {
    const k = twoDays('lowwater-seed');
    const lows = k.query().journal(5000).filter((e) => e.kind === 'WorldWaterLow');
    assert.equal(lows.length, 1);
  });
});

describe('intent overrides: obligations and emergencies outrank routine', () => {
  it('sorely-overdue debtor lays low at home; owed creditor waits', () => {
    const k = world();
    routine(k, 'person_tola');
    routine(k, 'npc_musa');
    d(k, 'cmd_debt1', 'create_obligation', { obligation_id: 'obl_shame', kind: 'Debt', owes: 'person_tola', owed: 'npc_musa', amount: 5000, due_in_min: 5, grace_min: 5000 });
    d(k, 'cmd_advd1', 'advance_time', { steps: 10 }); // past due, in grace: pressure without breaking
    assert.equal(k.query().where_is('person_tola').activity, 'laying_low');
    assert.equal(k.query().where_is('person_tola').reason, 'obligation');
    assert.equal(k.query().where_is('npc_musa').activity, 'waiting_on_payment');
  });

  it('fault at your place switches activity; elsewhere unaffected', () => {
    const k = world();
    routine(k, 'person_tola'); // compound, Morning
    routine(k, 'npc_seyi', 'routine_walk'); // market, Morning
    d(k, 'cmd_ef1', 'trigger_fault', { fault_id: 'fault_em1', place: 'compound', kind: 'transformer' });
    assert.equal(k.query().where_is('person_tola').activity, 'dealing_with_fault');
    assert.equal(k.query().where_is('person_tola').reason, 'emergency');
    assert.equal(k.query().where_is('npc_seyi').activity, 'selling', 'market routine continues');
  });

  it('explicit moves hold until the next phase evaluation', () => {
    const k = world();
    routine(k, 'person_tola');
    d(k, 'cmd_hold1', 'move_person', { person: 'person_tola', place: 'market' });
    d(k, 'cmd_advh1', 'advance_time', { steps: 2 }); // same Morning: still en route/at market
    assert.equal(k.query().where_is('person_tola').place, 'market');
    d(k, 'cmd_advh2', 'advance_time', { steps: 46 }); // into Afternoon: routine resumes
    assert.deepEqual(k.query().where_is('person_tola'), {
      place: 'compound', anchor: 'gate', activity: 'gisting', reason: 'routine', since_t: 720,
    });
  });

  it('trigger_fault rejects dup kinds, unknown places, second faults', () => {
    const k = world();
    assert.match(rej(k, 'cmd_tf1', 'trigger_fault', { fault_id: 'fault_a1', place: 'nowhere', kind: 'transformer' }), /unknown_place/);
    assert.match(rej(k, 'cmd_tf2', 'trigger_fault', { fault_id: 'fault_a1', place: 'compound', kind: 'flood' }), /transformer only/);
    d(k, 'cmd_tf3', 'trigger_fault', { fault_id: 'fault_a1', place: 'compound', kind: 'transformer' });
    assert.match(rej(k, 'cmd_tf4', 'trigger_fault', { fault_id: 'fault_a2', place: 'market', kind: 'transformer' }), /fault_active/);
  });
});

describe('levy chain: fault chatter, repair levy, funded relief', () => {
  function levyWorld(seed = 'levy-seed', chatter = [], templates = []) {
    const k = world(seed, { chatter, templates });
    routine(k, 'person_tola');
    routine(k, 'npc_musa');
    routine(k, 'npc_seyi', 'routine_walk');
    relate(k, 'npc_musa', 'person_tola');
    relate(k, 'npc_musa', 'npc_seyi');
    return k;
  }

  it('open_levy validates everything up front, loudly', () => {
    const k = levyWorld();
    assert.match(rej(k, 'cmd_lo1', 'open_levy', { levy_id: 'levy_x1', convenor: 'npc_musa', collector: 'npc_musa', per_head: 8000, due_in_min: 500, cause: 'fault_x1' }), /levy_needs_active_fault/);
    assert.match(rej(k, 'cmd_lo2', 'open_levy', { levy_id: 'levy_x1', convenor: 'npc_ghost', collector: 'npc_musa', per_head: 8000, due_in_min: 500, cause: 'fault_x1' }), /unknown_person/);
    d(k, 'cmd_lf1', 'trigger_fault', { fault_id: 'fault_x1', place: 'compound', kind: 'transformer' });
    assert.match(rej(k, 'cmd_lo3', 'open_levy', { levy_id: 'levy_x1', convenor: 'npc_musa', collector: 'npc_musa', per_head: 100, due_in_min: 500, cause: 'fault_x1' }), /underfunded_levy/);
    assert.match(rej(k, 'cmd_lo4', 'open_levy', { levy_id: 'levy_x1', convenor: 'npc_musa', collector: 'npc_musa', per_head: 8000, due_in_min: 0, cause: 'fault_x1' }), /bad due_in_min/);
    faultLevy(k, 'ok1', { fault: 'fault_x1', levy: 'levy_ok1', skipFault: true });
    assert.match(rej(k, 'cmd_lo5', 'open_levy', { levy_id: 'levy_x2', convenor: 'npc_musa', collector: 'npc_musa', per_head: 8000, due_in_min: 500, cause: 'fault_x1' }), /levy_already_open/);
  });

  it('open_levy needs collector accounts and relationships', () => {
    const k = world();
    routine(k, 'person_tola');
    routine(k, 'npc_musa');
    d(k, 'cmd_p4', 'register_person', { id: 'npc_kemi', display: 'Kemi' });
    d(k, 'cmd_lf2', 'trigger_fault', { fault_id: 'fault_r1', place: 'compound', kind: 'transformer' });
    assert.match(rej(k, 'cmd_lr1', 'open_levy', { levy_id: 'levy_r1', convenor: 'npc_kemi', collector: 'npc_kemi', per_head: 20000, due_in_min: 500, cause: 'fault_r1' }), /no_collector_account/);
    d(k, 'cmd_a4', 'open_account', { person: 'npc_kemi', opening: 1000 });
    assert.match(rej(k, 'cmd_lr2', 'open_levy', { levy_id: 'levy_r1', convenor: 'npc_kemi', collector: 'npc_kemi', per_head: 20000, due_in_min: 500, cause: 'fault_r1' }), /no_relationship/);
  });

  it('open_levy needs members and fresh ids', () => {
    const k = world();
    d(k, 'cmd_lf3', 'trigger_fault', { fault_id: 'fault_m1', place: 'compound', kind: 'transformer' });
    assert.match(rej(k, 'cmd_lm1', 'open_levy', { levy_id: 'levy_m1', convenor: 'person_tola', collector: 'person_tola', per_head: 8000, due_in_min: 500, cause: 'fault_m1' }), /levy_needs_members/);
    routine(k, 'person_tola');
    relate(k, 'person_tola', 'npc_musa');
    relate(k, 'person_tola', 'npc_seyi');
    d(k, 'cmd_ot1', 'open_thread', { thread_id: 'thread_levy_m1', deadline_in_min: 500 });
    assert.match(rej(k, 'cmd_lm2', 'open_levy', { levy_id: 'levy_m1', convenor: 'person_tola', collector: 'person_tola', per_head: 20000, due_in_min: 500, cause: 'fault_m1' }), /levy_id_reused/);
  });

  it('pay_levy validates share, funds, duplicates, closed levies', () => {
    const k = levyWorld();
    faultLevy(k, 'pay1');
    assert.match(rej(k, 'cmd_py0', 'pay_levy', { person: 'person_tola', levy_id: 'levy_nope', amount: 8000 }), /no_open_levy/);
    assert.match(rej(k, 'cmd_py1', 'pay_levy', { person: 'npc_ghost', levy_id: 'levy_pay1', amount: 8000 }), /unknown_person/);
    assert.match(rej(k, 'cmd_py2', 'pay_levy', { person: 'person_tola', levy_id: 'levy_pay1', amount: 7999 }), /underpayment/);
    assert.match(rej(k, 'cmd_py3', 'pay_levy', { person: 'person_tola', levy_id: 'levy_pay1', amount: 8001 }), /overpayment/);
    d(k, 'cmd_poor', 'register_person', { id: 'npc_poor', display: 'Poor' });
    d(k, 'cmd_poor_a', 'open_account', { person: 'npc_poor', opening: 10 });
    assert.match(rej(k, 'cmd_py4', 'pay_levy', { person: 'npc_poor', levy_id: 'levy_pay1', amount: 8000 }), /insufficient_funds/);
    d(k, 'cmd_py5', 'pay_levy', { person: 'person_tola', levy_id: 'levy_pay1', amount: 8000 });
    assert.match(rej(k, 'cmd_py6', 'pay_levy', { person: 'person_tola', levy_id: 'levy_pay1', amount: 8000 }), /already_paid/);
  });

  it('funded levy repairs, thanks, fuels, moves real money, closes thread', () => {
    const chatter = [
      { on_event: 'LevyFunded', template: 'levy_thanks', speaker: 'npc_seyi', params: {} },
      { on_event: 'WorldFault', template: 'fault_alarm', speaker: 'npc_musa', params: {} },
    ];
    const k = world('funded-seed', { chatter, templates: ['levy_thanks', 'fault_alarm'] });
    routine(k, 'person_tola');
    routine(k, 'npc_musa');
    routine(k, 'npc_seyi', 'routine_walk');
    relate(k, 'npc_musa', 'person_tola');
    relate(k, 'npc_musa', 'npc_seyi');
    d(k, 'cmd_gg1', 'open_group', { group_id: 'group_compound', members: ['person_tola', 'npc_musa', 'npc_seyi'] });
    d(k, 'cmd_ff1', 'trigger_fault', { fault_id: 'fault_f1', place: 'compound', kind: 'transformer' });
    assert.equal(k.query().world().resources.light.source, 'fault');
    faultLevy(k, 'f1', { fault: 'fault_f1', levy: 'levy_f1', skipFault: true });
    d(k, 'cmd_fp1', 'pay_levy', { person: 'person_tola', levy_id: 'levy_f1', amount: 8000 });
    d(k, 'cmd_fp2', 'pay_levy', { person: 'npc_seyi', levy_id: 'levy_f1', amount: 8000 });
    d(k, 'cmd_fp3', 'pay_levy', { person: 'npc_musa', levy_id: 'levy_f1', amount: 8000 });
    const w = k.query().world();
    assert.equal(w.fault, null, 'funded levy repairs the fault');
    assert.equal(w.levy, null, 'no open levy after funding');
    assert.equal(w.levies_history[0].status, 'funded');
    assert.equal(w.resources.light.source, 'nepa', 'Morning relief');
    assert.equal(w.resources.fuel_min, Math.floor(4000 * 60 / 5000), 'surplus converts to integer fuel');
    // Real money moved payer -> collector; collector self-share moves nothing.
    assert.equal(k.query().balance('person_tola'), 800000 - 8000);
    assert.equal(k.query().balance('npc_seyi'), 50000 - 8000);
    assert.equal(k.query().balance('npc_musa'), 50000 + 16000);
    const journal = k.query().journal(5000);
    assert.ok(!journal.some((e) => e.kind === 'MoneyMoved' && e.data.from === 'npc_musa'), 'collector self-share moves no money');
    assert.ok(journal.some((e) => e.kind === 'LevyPaid' && e.data.person === 'npc_musa'), 'but the receipt is real');
    // Thread closed with resolution; chatter thanked exactly once.
    assert.equal(k.query().threads({}).find((t) => t.id === 'thread_levy_f1').status, 'closed');
    assert.equal(journal.filter((e) => e.kind === 'MessagePosted' && e.data.template === 'levy_thanks').length, 1);
    assert.equal(journal.filter((e) => e.kind === 'MessagePosted' && e.data.template === 'fault_alarm').length, 1);
    // Residents resume routine immediately (relief visible now).
    assert.equal(k.query().where_is('person_tola').activity, 'resting');
  });

  it('failed levy tags ghosts, keeps the fault, allows re-levy', () => {
    const k = levyWorld('failed-seed');
    faultLevy(k, 'fail1', { due: 60 });
    d(k, 'cmd_fp1', 'pay_levy', { person: 'person_tola', levy_id: 'levy_fail1', amount: 8000 });
    d(k, 'cmd_advf', 'advance_time', { steps: 15 }); // past due: failed close
    const w = k.query().world();
    assert.equal(w.levy, null);
    assert.equal(w.levies_history[0].status, 'failed');
    assert.deepEqual(w.levies_history[0].ghosts, ['npc_seyi'], 'collector exempt, payer spared');
    assert.ok(w.fault !== null, 'darkness persists until funded');
    assert.deepEqual(k.query().tags('npc_musa', 'npc_seyi'), ['levy_ghost']);
    assert.deepEqual(k.query().tags('npc_musa', 'person_tola'), [], 'payers are not tagged');
    assert.ok(k.query().threads({}).find((t) => t.id === 'thread_levy_fail1').status !== 'open', 'thread terminal');
    // A closed levy never blocks the next one; the fault still needs repair.
    faultLevy(k, 'fail2', { fault: 'fault_fail1', levy: 'levy_fail2', due: 500, skipFault: true });
    assert.equal(k.query().world().levy.id, 'levy_fail2');
  });

  it('levy appears in notifications while open, vanishes when closed', () => {
    const k = levyWorld('notif-seed');
    d(k, 'cmd_ident9', 'identify_player', { person: 'person_tola' });
    faultLevy(k, 'notif1');
    const kinds = k.query().notifications().map((n) => n.kind);
    assert.ok(kinds.includes('levy_open'), 'open levy reaches the player');
    d(k, 'cmd_np1', 'pay_levy', { person: 'person_tola', levy_id: 'levy_notif1', amount: 8000 });
    d(k, 'cmd_np2', 'pay_levy', { person: 'npc_seyi', levy_id: 'levy_notif1', amount: 8000 });
    d(k, 'cmd_np3', 'pay_levy', { person: 'npc_musa', levy_id: 'levy_notif1', amount: 8000 });
    assert.ok(!k.query().notifications().some((n) => n.kind === 'levy_open'), 'closed levy leaves notifications');
  });
});

describe('shared resources: light schedule, generator fuel, water', () => {
  it('first step sets light quietly; schedule losses speak exactly once', () => {
    const k = world();
    routine(k, 'person_tola');
    d(k, 'cmd_rl1', 'advance_time', { steps: 1 }); // init: nepa, no chatter for boot state
    assert.equal(k.query().world().resources.light.source, 'nepa');
    assert.equal(k.query().journal(5000).filter((e) => e.kind === 'WorldLightRestored').length, 0);
    d(k, 'cmd_rl2', 'advance_time', { steps: 47 }); // into Afternoon (off): one loss
    assert.equal(k.query().world().resources.light.source, 'none');
    assert.equal(k.query().journal(5000).filter((e) => e.kind === 'WorldLightLost').length, 1);
  });

  it('generator refuses without fuel; burns fuel then speaks the loss once', () => {
    const k = world();
    routine(k, 'person_tola');
    routine(k, 'npc_musa');
    relate(k, 'npc_musa', 'person_tola');
    faultLevy(k, 'gen1', { per_head: 12000, due: 500 }); // 2 members x 12000 = 24000, surplus 4000
    assert.match(rej(k, 'cmd_gen0', 'set_generator', { person: 'person_tola', on: true }), /no_fuel/);
    d(k, 'cmd_gpay1', 'pay_levy', { person: 'person_tola', levy_id: 'levy_gen1', amount: 12000 });
    d(k, 'cmd_gpay2', 'pay_levy', { person: 'npc_musa', levy_id: 'levy_gen1', amount: 12000 });
    assert.equal(k.query().world().resources.fuel_min, Math.floor(4000 * 60 / 5000));
    d(k, 'cmd_gen1', 'set_generator', { person: 'person_tola', on: true });
    assert.equal(k.query().world().resources.light.source, 'generator');
    assert.match(rej(k, 'cmd_gen2', 'set_generator', { person: 'person_tola', on: true }), /already_on/);
    d(k, 'cmd_advgen', 'advance_time', { steps: 50 }); // 250 min > 48 fuel: exhaustion mid-run
    assert.equal(k.query().world().resources.light.source, 'none', 'Afternoon schedule, fuel spent');
    assert.equal(k.query().journal(5000).filter((e) => e.kind === 'WorldLightLost').length, 1, 'exactly one loss for the burn');
  });

  it('water refills; full tank rejects', () => {
    const k = world();
    routine(k, 'person_tola');
    assert.match(rej(k, 'cmd_w0', 'refill_tank', { person: 'person_tola' }), /tank_already_full/);
    d(k, 'cmd_advw', 'advance_time', { steps: 48 }); // one phase: -5
    assert.equal(k.query().world().resources.water, 95);
    d(k, 'cmd_w1', 'refill_tank', { person: 'person_tola' });
    assert.equal(k.query().world().resources.water, 100);
  });
});

describe('bounds: closed-levy history is capped, event storms stay budgeted', () => {
  it('six funded levies keep the last five histories', () => {
    const k = world('cap-seed');
    routine(k, 'person_tola');
    routine(k, 'npc_musa');
    relate(k, 'npc_musa', 'person_tola');
    for (let i = 1; i <= 6; i++) {
      faultLevy(k, `cap${i}`, { fault: `fault_cap${i}`, levy: `levy_cap${i}`, per_head: 15000, due: 500 });
      d(k, `cmd_capp${i}a`, 'pay_levy', { person: 'person_tola', levy_id: `levy_cap${i}`, amount: 15000 });
      d(k, `cmd_capp${i}b`, 'pay_levy', { person: 'npc_musa', levy_id: `levy_cap${i}`, amount: 15000 });
    }
    const hist = k.query().world().levies_history;
    assert.equal(hist.length, 5, 'history cap holds');
    assert.equal(hist[0].id, 'levy_cap2', 'oldest dropped first');
    assert.equal(hist[4].id, 'levy_cap6');
    assert.ok(hist.every((l) => l.status === 'funded'));
  });

  it('failed-then-refunded cycles stay under the per-command event budget', () => {
    const k = world('storm-seed');
    routine(k, 'person_tola');
    routine(k, 'npc_musa');
    routine(k, 'npc_seyi', 'routine_walk');
    relate(k, 'npc_musa', 'person_tola');
    relate(k, 'npc_musa', 'npc_seyi');
    faultLevy(k, 'storm1', { due: 60 });
    d(k, 'cmd_storm_adv', 'advance_time', { steps: 48 }); // failed close + tags + chatter in one step
    const kinds = k.query().journal(5000).map((e) => e.kind);
    assert.ok(!kinds.includes('BudgetGuardTripped'));
    assert.ok(!kinds.includes('CascadeGuardTripped'));
    assert.ok(!kinds.includes('ReactionFailed'));
  });
});

describe('repo content boots and validates', () => {
  it('shipped places, routines, and world rules validate and run', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
    const places = JSON.parse(readFileSync(join(dir, 'places', 'places.json'), 'utf8'));
    const routinesDoc = JSON.parse(readFileSync(join(dir, 'people', 'routines.json'), 'utf8'));
    const rules = JSON.parse(readFileSync(join(dir, 'rules', 'world.json'), 'utf8'));
    assert.equal(validatePlaces(places), null);
    assert.equal(validateRoutines(routinesDoc.routines, places), null);
    assert.equal(validateWorldRules(rules), null);
    assert.match(validateRoutines([{ id: 'routine_x', blocks: {} }], places), /block for Night required/);
    const kernel = createKernel({ seed: 'repoboot' });
    assert.doesNotThrow(() => createWorld(kernel, { places, routines: routinesDoc.routines, rules }));
    assert.deepEqual(kernel.query().world().places, ['compound', 'danfo_stop', 'market']);
  });
});

describe('world persistence: store round-trips byte-identical', () => {
  it('presence, transit, levy, and resources survive save/restore', () => {
    const k = world('persist-seed');
    routine(k, 'person_tola');
    routine(k, 'npc_musa');
    relate(k, 'npc_musa', 'person_tola');
    d(k, 'cmd_pm1', 'move_person', { person: 'person_tola', place: 'market' });
    faultLevy(k, 'persist1', { per_head: 12000 });
    d(k, 'cmd_pp1', 'pay_levy', { person: 'person_tola', levy_id: 'levy_persist1', amount: 12000 });
    const before = k.snapshot();
    assert.ok(JSON.parse(before).stores.world.levy !== null);
    const k2 = world('persist-restore');
    k2.restore(before);
    assert.equal(k2.snapshot(), before);
    assert.equal(k2.query().where_is('person_tola').activity, 'travelling');
    assert.equal(k2.query().world().levy.id, 'levy_persist1');
  });
});
