// tests/unit/story-engine.test.js — storylets, threads, director v1 (M007).
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
import { createStory, storyletEligible, validateStoryContent } from '../../sim/story/index.js';

const STANCE = { hysteresis: 5, thresholds: [{ stance: 'Neutral', when: {} }] };
const KINDS = { Debt: {}, PromisedAction: {} };
const DIRECTOR = { maxOpenCrises: 1, breatherMin: 1440 };

const SET = [
  { id: 's_crisis_a', tags: ['crisis'], when: [{ kind: 'obligations', status: 'Active', gte: 1 }] },
  { id: 's_crisis_b', tags: ['crisis'], when: [{ kind: 'obligations', status: 'Broken', gte: 1 }] },
  { id: 's_joy_a', tags: ['joy'], when: [{ kind: 'memories', person: 'npc_tobi', kind_name: 'was_repaid', gte: 1 }] },
  { id: 's_info_a', tags: ['info'], when: [{ kind: 'claims', fact: 'fact_x', gte: 1 }] },
  { id: 's_calm', tags: ['joy'], when: [{ kind: 'threads', status: 'open', tag: 'crisis', lte: 0 }] },
  { id: 's_late', tags: ['info'], when: [{ kind: 'time_past', t: 1320 }] },
  { id: 's_flag', tags: ['info'], when: [{ kind: 'flag', key: 'met_musa', equals: true }] },
  { id: 's_always', tags: ['info'], when: [] },
];

function world(seed = 'story-seed', storylets = SET, director = DIRECTOR) {
  const kernel = createKernel({ seed });
  createPeople(kernel);
  createRelationships(kernel, STANCE);
  createEconomy(kernel);
  const memory = createMemory(kernel, []);
  createObligations(kernel, KINDS, { memoryReads: memory.reads });
  createKnowledge(kernel, { disclosure: [] });
  createStory(kernel, { storylets, director });
  seedPeople(kernel, [
    { id: 'person_tola', display: 'Tola' },
    { id: 'npc_tobi', display: 'Tobi' },
  ]);
  seedAccounts(kernel, [
    { person: 'person_tola', opening: 800000 },
    { person: 'npc_tobi', opening: 0 },
  ]);
  return kernel;
}

const open = (k, id, params) => k.dispatch({ cmd_id: id, type: 'open_thread', actor: 't', params });

describe('storylet eligibility (closed vocabulary)', () => {
  it('each condition kind evaluates; empty when[] always matches', () => {
    const q = {
      obligations: () => [{ status: 'Active' }, { status: 'Broken' }],
      what_they_remember: () => [{ kind: 'was_repaid' }],
      claims: () => [{ fact: 'fact_x' }],
      time: () => ({ minutes: 1400 }),
      flags: () => ({ met_musa: true }),
    };
    const threads = {};
    for (const s of SET) assert.equal(storyletEligible(s, q, threads), true, s.id);
    assert.equal(storyletEligible({ id: 'x', tags: [], when: [{ kind: 'nope' }] }, q, threads), false);
  });
  it('ineligible states exclude: counts, time, flags, threads', () => {
    const q = {
      obligations: () => [],
      what_they_remember: () => [],
      claims: () => [],
      time: () => ({ minutes: 100 }),
      flags: () => ({}),
    };
    const got = Object.fromEntries(SET.map((s) => [s.id, storyletEligible(s, q, {})]));
    assert.deepEqual(got, {
      s_crisis_a: false, s_crisis_b: false, s_joy_a: false, s_info_a: false,
      s_calm: true, s_late: false, s_flag: false, s_always: true,
    });
  });
});

describe('content validation', () => {
  it('rejects dup ids, bad tags, unknown conditions, bad on_expire, bad director', () => {
    assert.match(validateStoryContent([{ id: 's_crisis_a', tags: [], when: [] }, { id: 's_crisis_a', tags: [], when: [] }], DIRECTOR), /duplicate/);
    assert.match(validateStoryContent([{ id: 'BadId', tags: [], when: [] }], DIRECTOR), /invalid/);
    assert.match(validateStoryContent([{ id: 's_x', tags: ['Nope!'], when: [] }], DIRECTOR), /bad tag/);
    assert.match(validateStoryContent([{ id: 's_x', tags: [], when: [{ kind: 'vibes' }] }], DIRECTOR), /unknown condition/);
    assert.match(validateStoryContent([{ id: 's_x', tags: [], on_expire: [{ kind: 'Nuke', data: {} }] }], DIRECTOR), /bad on_expire/);
    assert.match(validateStoryContent([], { maxOpenCrises: -1, breatherMin: 0 }), /maxOpenCrises/);
    assert.equal(validateStoryContent([], DIRECTOR), null);
  });
  it('repo slice content boots end-to-end', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
    const storylets = JSON.parse(readFileSync(join(dir, 'story', 'slice.json'), 'utf8'));
    const director = JSON.parse(readFileSync(join(dir, 'rules', 'director.json'), 'utf8'));
    assert.equal(validateStoryContent(storylets, director), null);
    assert.ok(storylets.length >= 8, 'slice stays small but non-trivial');
  });
});

describe('thread lifecycle', () => {
  it('open validates: dup, unknown storylet, past deadline, exclusive forms, cap', () => {
    const k = world();
    assert.equal(open(k, 'cmd_o1', { thread_id: 'thread_a', storylet: 's_always', deadline_in_min: 60 }).status, 'applied');
    assert.match(open(k, 'cmd_o2', { thread_id: 'thread_a', storylet: 's_always', deadline_in_min: 60 }).reason, /duplicate_thread/);
    assert.match(open(k, 'cmd_o3', { thread_id: 'thread_b', storylet: 's_nope', deadline_in_min: 60 }).reason, /unknown_storylet/);
    assert.match(open(k, 'cmd_o4', { thread_id: 'thread_c', deadline_in_min: 0 }).reason, /deadline_in_past|deadline must be future|past/);
    assert.match(open(k, 'cmd_o5', { thread_id: 'thread_d', deadline_t: 99999, deadline_in_min: 60 }).reason, /mutually exclusive/);
    assert.match(open(k, 'cmd_o6', { thread_id: 'bad id!', deadline_in_min: 60 }).reason, /bad thread_id/);
  });
  it('close resolves; double-close and unknown reject; rejection leaves state', () => {
    const k = world();
    open(k, 'cmd_c1', { thread_id: 'thread_z', deadline_in_min: 600 });
    const storesBefore = JSON.stringify(JSON.parse(k.snapshot()).stores);
    const rejected = k.dispatch({ cmd_id: 'cmd_c2', type: 'close_thread', actor: 't', params: { thread_id: 'thread_nope', resolution: 'x' } });
    assert.equal(rejected.status, 'rejected');
    assert.match(rejected.reason, /unknown_thread/);
    // Rejection journals evidence but touches no authoritative store.
    assert.equal(JSON.stringify(JSON.parse(k.snapshot()).stores), storesBefore);
    assert.equal(k.dispatch({ cmd_id: 'cmd_c3', type: 'close_thread', actor: 't', params: { thread_id: 'thread_z', resolution: 'paid in full' } }).status, 'applied');
    const t = k.query().threads().find((x) => x.id === 'thread_z');
    assert.equal(t.status, 'closed');
    assert.equal(t.resolution, 'paid in full');
    assert.match(k.dispatch({ cmd_id: 'cmd_c4', type: 'close_thread', actor: 't', params: { thread_id: 'thread_z', resolution: 'again' } }).reason, /already_closed/);
  });
  it('expiry fires once with default outcome applied through the pipeline', () => {
    const k = world();
    k.dispatch({ cmd_id: 'cmd_r1', type: 'open_relationship', actor: 't', params: { a: 'person_tola', b: 'npc_tobi' } });
    open(k, 'cmd_e1', {
      thread_id: 'thread_rent', storylet: 's_crisis_a', deadline_in_min: 10, tags: ['crisis'],
      default_events: [{ kind: 'RelationshipTagged', data: { a: 'person_tola', b: 'npc_tobi', tag: 'rent_late', op: 'add' } }],
    });
    k.dispatch({ cmd_id: 'cmd_adv1', type: 'advance_time', actor: 't', params: { steps: 1 } }); // +5m: before deadline
    assert.equal(k.query().threads().find((t) => t.id === 'thread_rent').status, 'open');
    k.dispatch({ cmd_id: 'cmd_adv2', type: 'advance_time', actor: 't', params: { steps: 2 } }); // +10m: past deadline
    const t = k.query().threads().find((x) => x.id === 'thread_rent');
    assert.equal(t.status, 'expired');
    assert.deepEqual(k.query().tags('person_tola', 'npc_tobi'), ['rent_late']);
    const expired = k.query().journal(50).filter((e) => e.kind === 'ThreadExpired');
    assert.equal(expired.length, 1, 'exactly-once even across multi-step advances');
    k.dispatch({ cmd_id: 'cmd_adv3', type: 'advance_time', actor: 't', params: { steps: 50 } });
    assert.equal(k.query().journal(500).filter((e) => e.kind === 'ThreadExpired').length, 1);
  });
  it('open threads cap at 50 (bounded work)', () => {
    const k = world('cap-seed');
    for (let i = 0; i < 50; i++) {
      assert.equal(open(k, `cmd_cap${i}`, { thread_id: `thread_cap${i}`, deadline_in_min: 60000 }).status, 'applied');
    }
    assert.match(open(k, 'cmd_cap51', { thread_id: 'thread_cap51', deadline_in_min: 60000 }).reason, /thread_cap_reached/);
  });
  it('default outcome validates refs at open, not at fire', () => {
    const k = world();
    assert.match(open(k, 'cmd_d1', {
      thread_id: 'thread_bad', deadline_in_min: 60,
      default_events: [{ kind: 'MoneyMoved', data: { from: 'npc_ghost', to: 'person_tola', amount: 5 } }],
    }).reason, /dangling/);
    assert.match(open(k, 'cmd_d2', {
      thread_id: 'thread_bad2', deadline_in_min: 60,
      default_events: [{ kind: 'Nuke', data: {} }],
    }).reason, /bad default event kind/);
    assert.equal(k.query().threads().length, 0);
  });
});

describe('director v1 (caps, breather, no-stack, joy-first)', () => {
  it('cap hides crises while one is open; no-stacking hides the played storylet', () => {
    const k = world();
    k.dispatch({ cmd_id: 'cmd_m1', type: 'create_obligation', actor: 't', params: { obligation_id: 'obl_a', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 100, due_in_min: 5000 } });
    k.dispatch({ cmd_id: 'cmd_m2', type: 'create_obligation', actor: 't', params: { obligation_id: 'obl_b', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 100, due_in_min: 5000 } });
    const before = k.query().situations().map((s) => s.id);
    assert.ok(before.includes('s_crisis_a'), 'crisis eligible before any thread');
    // An unrelated open crisis thread trips the cap for ALL crisis storylets.
    open(k, 'cmd_m3', { thread_id: 'thread_c1', deadline_in_min: 5000, tags: ['crisis'] });
    const capped = k.query().situations().map((s) => s.id);
    assert.ok(!capped.includes('s_crisis_a'), 'cap hides crisis while one is open');
    assert.ok(capped.includes('s_always'), 'non-crisis still surfaces under cap');
    // No stacking is independent of caps: same storylet hidden by its own thread.
    const k2 = world('nostack-seed');
    k2.dispatch({ cmd_id: 'cmd_n1', type: 'create_obligation', actor: 't', params: { obligation_id: 'obl_n', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 100, due_in_min: 5000 } });
    open(k2, 'cmd_n2', { thread_id: 'thread_n1', storylet: 's_crisis_a', deadline_in_min: 5000 });
    assert.ok(!k2.query().situations().map((s) => s.id).includes('s_crisis_a'));
  });
  it('breather hides crises after a crisis closes', () => {
    const k = world();
    k.dispatch({ cmd_id: 'cmd_b1', type: 'create_obligation', actor: 't', params: { obligation_id: 'obl_c', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 100, due_in_min: 5000 } });
    open(k, 'cmd_b2', { thread_id: 'thread_cc', storylet: 's_crisis_a', deadline_in_min: 5000, tags: ['crisis'] });
    k.dispatch({ cmd_id: 'cmd_b3', type: 'close_thread', actor: 't', params: { thread_id: 'thread_cc', resolution: 'handled' } });
    const ids = k.query().situations().map((s) => s.id);
    assert.ok(!ids.includes('s_crisis_a'), 'breather suppresses crisis right after close');
    assert.ok(ids.includes('s_always'), 'non-crisis still surfaces');
    k.dispatch({ cmd_id: 'cmd_b4a', type: 'advance_time', actor: 't', params: { steps: 200 } });
    k.dispatch({ cmd_id: 'cmd_b4b', type: 'advance_time', actor: 't', params: { steps: 100 } }); // +1500m total > breather
    assert.ok(k.query().situations().map((s) => s.id).includes('s_crisis_a'), 'crisis returns after breather');
  });
  it('joy sorts first and order is deterministic', () => {
    const k = world();
    const ids = k.query().situations().map((s) => s.id);
    assert.deepEqual(ids, [...ids].sort((a, b) => {
      const aj = SET.find((s) => s.id === a).tags.includes('joy') ? 0 : 1;
      const bj = SET.find((s) => s.id === b).tags.includes('joy') ? 0 : 1;
      return aj - bj || (a < b ? -1 : 1);
    }));
    assert.equal(ids[0], 's_calm', 'joy first');
  });
});

describe('divergence, persistence, idempotency', () => {
  it('different earlier choices surface different situations', () => {
    const a = world('div-a'), b = world('div-b');
    for (const [k, id] of [[a, 'cmd_x1'], [b, 'cmd_x2']]) {
      k.dispatch({ cmd_id: id, type: 'create_obligation', actor: 't', params: { obligation_id: `obl_${id}`, kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 100, due_in_min: 5000 } });
    }
    b.dispatch({ cmd_id: 'cmd_x3', type: 'close_thread', actor: 't', params: { thread_id: 'thread_nope', resolution: 'x' } });
    const sa = a.query().situations().map((s) => s.id);
    open(a, 'cmd_x4', { thread_id: 'thread_ca', storylet: 's_crisis_a', deadline_in_min: 5000, tags: ['crisis'] });
    const sa2 = a.query().situations().map((s) => s.id);
    const sb = b.query().situations().map((s) => s.id);
    assert.ok(sa.includes('s_crisis_a') && !sa2.includes('s_crisis_a'));
    assert.deepEqual(sb, sa, 'untouched twin matches pre-choice state');
  });
  it('threads + director state survive save/restore, including pre-M007 snapshots', () => {
    const k = world('persist-seed');
    open(k, 'cmd_sv1', { thread_id: 'thread_sv', storylet: 's_always', deadline_in_min: 500 });
    const snap = JSON.parse(k.snapshot());
    assert.ok(snap.stores.story.threads.thread_sv);
    const k2 = world('other');
    k2.restore(JSON.stringify(snap));
    assert.equal(k2.snapshot(), k.snapshot());
    // Pre-M007 snapshot tolerance: missing threads/director default empty.
    delete snap.stores.story.threads;
    delete snap.stores.story.director;
    const k3 = world('third');
    k3.restore(JSON.stringify(snap));
    assert.deepEqual(k3.query().threads(), []);
    assert.ok(Array.isArray(k3.query().situations()));
  });
  it('duplicate open_thread is a duplicate; rejected ops change nothing', () => {
    const k = world();
    open(k, 'cmd_d1', { thread_id: 'thread_dup', deadline_in_min: 60 });
    const before = k.snapshot();
    const dup = open(k, 'cmd_d1', { thread_id: 'thread_dup', deadline_in_min: 60 });
    assert.equal(dup.status, 'duplicate');
    assert.equal(k.snapshot(), before);
  });
});
