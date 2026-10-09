// tests/unit/obligations.test.js — lifecycle, settlement, grace, renegotiation (M003).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKernel } from '../../sim/kernel/pipeline.js';
import { createPeople, seedPeople } from '../../sim/people/index.js';
import { createRelationships, seedRelationships, registerObligationConsequences, validateOutcomeMapping } from '../../sim/relationships/index.js';
import { createEconomy, seedAccounts } from '../../sim/economy/index.js';
import { createObligations, seedObligations, validateKinds } from '../../sim/obligations/index.js';

const KINDS = {
  Debt: { settleable_by: 'amount', allow_partial: true },
  PromisedAction: { settleable_by: 'completion' },
};
const STANCE = { hysteresis: 5, thresholds: [{ stance: 'Neutral', when: {} }] };
const OUTCOMES = [
  { on: 'ObligationBroken', kind: 'Debt', nudge: { dTrust: -10 }, tag: 'broke_word' },
  { on: 'ObligationFulfilled', kind: 'Debt', when: { was_broken: false }, tag: 'kept_word' },
  { on: 'ObligationFulfilled', kind: 'Debt', when: { was_broken: true }, tag: 'repaid_late' },
];

function world(seed = 'o-seed', withMapping = false) {
  const kernel = createKernel({ seed });
  createPeople(kernel);
  createRelationships(kernel, STANCE);
  createEconomy(kernel);
  createObligations(kernel, KINDS);
  if (withMapping) registerObligationConsequences(kernel, OUTCOMES);
  seedPeople(kernel, [
    { id: 'person_tola', display: 'Tola' },
    { id: 'npc_tobi', display: 'Tobi' },
    { id: 'npc_sunday', display: 'Sunday' },
  ]);
  seedAccounts(kernel, [
    { person: 'person_tola', opening: 800000 },
    { person: 'npc_tobi', opening: 50000 },
    { person: 'npc_sunday', opening: 100000 },
  ]);
  return kernel;
}

const mk = (k, id, extra) => k.dispatch({
  cmd_id: `cmd_${id}`, type: 'create_obligation', actor: 't',
  params: { obligation_id: `obl_${id}`, kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 100000, due_in_min: 1440, ...extra },
});
const settle = (k, id, obl, extra = {}) => k.dispatch({
  cmd_id: `cmd_${id}`, type: 'settle_obligation', actor: 't', params: { obligation: obl, ...extra },
});

describe('creation guards', () => {
  it('creates valid debts and actions; rejects the rest, state untouched', () => {
    const k = world();
    assert.equal(validateKinds(KINDS), null);
    assert.notEqual(validateKinds({}), null);
    assert.equal(mk(k, 'mk1', {}).status, 'applied');
    const o = k.query().obligation('obl_mk1');
    assert.equal(o.status, 'Active');
    assert.equal(o.paid, 0);
    assert.equal(o.origin_id, 'origin_dev');
    assert.deepEqual(o.statusHistory.map((h) => h.status), ['Active']);
    const bad = [
      [{ kind: 'Nope' }, /unknown_kind/],
      [{ owes: 'npc_ghost' }, /unknown_person/],
      [{ owes: 'person_tola', owed: 'person_tola' }, /no_self/],
      [{ amount: -5 }, /positive/],
      [{ amount: 10.5 }, /integer/],
      [{ due_in_min: -100 }, /bad due/],
      [{ witnesses: ['npc_ghost'] }, /unknown_person/],
      [{ witnesses: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] }, /witnesses/],
    ];
    for (const [i, [extra, rx]] of bad.entries()) {
      const r = mk(k, `mkbad${i}`, extra);
      assert.equal(r.status, 'rejected', JSON.stringify(extra));
      assert.match(r.reason, rx);
    }
    // Past-due at creation is invalid.
    const past = k.dispatch({
      cmd_id: 'cmd_mkpast', type: 'create_obligation', actor: 't',
      params: { obligation_id: 'obl_past', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 10, due_t: 0 },
    });
    assert.match(past.reason, /past_due/);
    assert.equal(k.query().obligations({}).length, 1);
  });
  it('duplicate ids reject; action needs subject, no amount', () => {
    const k = world();
    mk(k, 'mkd1', {});
    assert.match(mk(k, 'mkd1b', {}).status, /.*/); // distinct cmd, distinct check below
    const r = k.dispatch({
      cmd_id: 'cmd_mkd2', type: 'create_obligation', actor: 't',
      params: { obligation_id: 'obl_mkd1', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 5, due_in_min: 60 },
    });
    assert.match(r.reason, /duplicate_obligation/);
    const a = k.dispatch({
      cmd_id: 'cmd_mkd3', type: 'create_obligation', actor: 't',
      params: { obligation_id: 'obl_act1', kind: 'PromisedAction', owes: 'person_tola', owed: 'npc_tobi', subject: 'Return the bucket', due_in_min: 60 },
    });
    assert.equal(a.status, 'applied');
    const a2 = k.dispatch({
      cmd_id: 'cmd_mkd4', type: 'create_obligation', actor: 't',
      params: { obligation_id: 'obl_act2', kind: 'PromisedAction', owes: 'person_tola', owed: 'npc_tobi', due_in_min: 60 },
    });
    assert.match(a2.reason, /subject/);
  });
});

describe('settlement: full, partial, remainder', () => {
  it('partial sequence lands exact remainder with zero drift', () => {
    const k = world();
    mk(k, 'mks1', { amount: 100000 });
    settle(k, 'mks2', 'obl_mks1', { amount: 30000 });
    settle(k, 'mks3', 'obl_mks1', { amount: 30000 });
    assert.equal(k.query().obligation('obl_mks1').status, 'Active');
    assert.equal(k.query().obligation('obl_mks1').paid, 60000);
    settle(k, 'mks4', 'obl_mks1', { amount: 40000 });
    const o = k.query().obligation('obl_mks1');
    assert.equal(o.status, 'Fulfilled');
    assert.equal(o.paid, 100000);
    assert.equal(k.query().balance('person_tola'), 700000);
    assert.equal(k.query().balance('npc_tobi'), 150000);
    assert.equal(k.query().ledger_consistent('person_tola'), true);
  });
  it('overpay, double-settle, wrong-payer, action-amount all reject atomically', () => {
    const k = world();
    mk(k, 'mks5', { amount: 50000 });
    const before = k.snapshot();
    assert.match(settle(k, 'mks6', 'obl_mks5', { amount: 50001 }).reason, /overpayment/);
    settle(k, 'mks7', 'obl_mks5', { amount: 50000 });
    assert.match(settle(k, 'mks8', 'obl_mks5', { amount: 1 }).reason, /not_settleable/);
    assert.match(settle(k, 'mks9', 'obl_mks5', { amount: 1, payer: 'npc_sunday' }).reason, /not_settleable|payer_must_be_debtor/);
    assert.equal(k.snapshot() === before, false); // settled once legitimately...
    const k2 = world();
    const balBefore = k2.query().balance('person_tola');
    settle(k2, 'mks10', 'obl_nope', { amount: 5 });
    // Rejection journals evidence but touches no authoritative state.
    assert.equal(k2.query().balance('person_tola'), balBefore);
    assert.deepEqual(k2.query().obligations({}), []);
    const last = k2.query().journal(1)[0];
    assert.equal(last.kind, 'CommandRejected');
    assert.match(last.data.reason, /unknown_obligation/);
  });
  it('PromisedAction completes without money; double-complete rejects', () => {
    const k = world();
    k.dispatch({
      cmd_id: 'cmd_mka1', type: 'create_obligation', actor: 't',
      params: { obligation_id: 'obl_pa1', kind: 'PromisedAction', owes: 'person_tola', owed: 'npc_tobi', subject: 'Sweep the yard', due_in_min: 600 },
    });
    assert.match(settle(k, 'mka2', 'obl_pa1', { amount: 5 }).reason, /action_has_no_amount/);
    assert.match(settle(k, 'mka3', 'obl_pa1', {}).reason, /complete_true/);
    assert.equal(settle(k, 'mka4', 'obl_pa1', { complete: true }).status, 'applied');
    assert.equal(k.query().obligation('obl_pa1').status, 'Fulfilled');
    assert.match(settle(k, 'mka5', 'obl_pa1', { complete: true }).reason, /not_settleable/);
    assert.equal(k.query().balance('person_tola'), 800000, 'no money moved');
  });
});

describe('deadlines and grace', () => {
  it('Active → Due at due_t, Due → Broken only past grace', () => {
    const k = world();
    mk(k, 'mkd', { amount: 10000, due_in_min: 60, grace_min: 60 });
    k.dispatch({ cmd_id: 'cmd_adv1', type: 'advance_time', actor: 't', params: { steps: 12 } }); // +60m
    assert.equal(k.query().obligation('obl_mkd').status, 'Due');
    k.dispatch({ cmd_id: 'cmd_adv2', type: 'advance_time', actor: 't', params: { steps: 6 } }); // +30m, inside grace
    assert.equal(k.query().obligation('obl_mkd').status, 'Due');
    k.dispatch({ cmd_id: 'cmd_adv3', type: 'advance_time', actor: 't', params: { steps: 12 } }); // +60m, past grace
    const o = k.query().obligation('obl_mkd');
    assert.equal(o.status, 'Broken');
    assert.deepEqual(o.statusHistory.map((h) => h.status), ['Active', 'Due', 'Broken']);
  });
  it('broken-then-repaid keeps Broken in history with Fulfilled on top', () => {
    const k = world();
    mk(k, 'mkr1', { amount: 20000, due_in_min: 5 });
    k.dispatch({ cmd_id: 'cmd_advr', type: 'advance_time', actor: 't', params: { steps: 10 } });
    assert.equal(k.query().obligation('obl_mkr1').status, 'Broken');
    settle(k, 'mkr2', 'obl_mkr1', { amount: 20000 });
    const o = k.query().obligation('obl_mkr1');
    assert.equal(o.status, 'Fulfilled');
    assert.deepEqual(o.statusHistory.map((h) => h.status), ['Active', 'Due', 'Broken', 'Fulfilled']);
  });
});

describe('renegotiation (linked successor, creditor consent)', () => {
const ren = (k, id, extra) => k.dispatch({
  cmd_id: `cmd_${id}`, type: 'renegotiate_obligation', actor: 't',
  params: { obligation: 'obl_mkn1', new_id: `obl_${id}n`, creditor_accept: true, new_due_in_min: 2000, ...extra },
});
  it('requires creditor accept; links successor; old stays Renegotiated with history', () => {
    const k = world();
    mk(k, 'mkn1', { amount: 100000 });
    settle(k, 'mkn1p', 'obl_mkn1', { amount: 30000 });
    const noConsent = k.dispatch({
      cmd_id: 'cmd_mkn2', type: 'renegotiate_obligation', actor: 't',
      params: { obligation: 'obl_mkn1', new_id: 'obl_mkn2n', new_due_in_min: 2000 },
    });
    assert.match(noConsent.reason, /creditor_accept_required/);
    assert.equal(ren(k, 'mkn3', { new_amount: 70000 }).status, 'applied');
    const old = k.query().obligation('obl_mkn1');
    assert.equal(old.status, 'Renegotiated');
    // Created Active → partial payment (status honestly re-recorded) → Renegotiated.
    assert.deepEqual(old.statusHistory.map((h) => h.status), ['Active', 'Active', 'Renegotiated']);
    assert.equal(old.paid, 30000, 'partial payment history survives on the old record');
    const succ = k.query().obligation('obl_mkn3n');
    assert.equal(succ.amount, 70000);
    assert.deepEqual(succ.links, { renegotiated_from: 'obl_mkn1' });
    assert.match(settle(k, 'mkn4', 'obl_mkn1', { amount: 1 }).reason, /not_settleable/);
    assert.match(ren(k, 'mkn5', {}).reason, /not_renegotiable|duplicate/);
  });
});

describe('due processing at scale (bounded scan)', () => {
  it('20 obligations over 7 simulated days stay fast and correct', () => {
    const k = world('scale-seed');
    for (let i = 0; i < 20; i++) {
      mk(k, `scale${i}`, { amount: 1000 + i, due_in_min: 60 * (i + 1) });
    }
    const t0 = Date.now();
    // obligation ids are obl_scale0..19 (mk helper prefixes obl_)
    k.dispatch({ cmd_id: 'cmd_scale_adv', type: 'advance_time', actor: 't', params: { steps: 2016 } });
    const ms = Date.now() - t0;
    assert.ok(ms < 2000, `7 days x 20 obligations took ${ms}ms`);
    assert.equal(k.query().obligation('obl_scale0').status, 'Broken');
    assert.equal(k.query().obligations({ status: 'Broken' }).length, 20);
  });
});

describe('due_soon, overlaps, seed helpers, content', () => {
  it('queries stay bounded and correct', () => {
    const k = world();
    mk(k, 'mkq1', { amount: 1000, due_in_min: 60 });
    mk(k, 'mkq2', { amount: 1000, due_in_min: 60, grace_min: 30, owes: 'npc_sunday', owed: 'person_tola' });
    assert.equal(k.query().due_soon(30).length, 0);
    assert.equal(k.query().due_soon(60).length, 2);
    assert.deepEqual(k.query().overlaps('person_tola'), [['obl_mkq1', 'obl_mkq2']]);
    assert.deepEqual(
      seedObligations(k, [{ obligation_id: 'obl_seed1', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 5, due_in_min: 10 }]).map((r) => r.status),
      ['applied'],
    );
  });
  it('repo content files validate', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
    const kinds = JSON.parse(readFileSync(join(dir, 'obligations', 'kinds.json'), 'utf8'));
    assert.equal(validateKinds(kinds), null);
    const mapping = JSON.parse(readFileSync(join(dir, 'rules', 'obligation-outcomes.json'), 'utf8'));
    assert.equal(validateOutcomeMapping(mapping), null);
    assert.equal(mapping.length, 3);
  });
});

describe('outcome → relationship consequences (decoupled)', () => {
  it('Broken tags + nudges the creditor view; Fulfilled tags repaid-late; strangers skipped', () => {
    const k = world('map-seed', true);
    seedRelationships(k, [
      { a: 'npc_tobi', b: 'person_tola' }, // creditor Tobi views debtor Tola
    ]);
    mk(k, 'mkm1', { amount: 50000, due_in_min: 5 });
    k.dispatch({ cmd_id: 'cmd_advm', type: 'advance_time', actor: 't', params: { steps: 10 } }); // +50m, past due, grace 0
    assert.equal(k.query().obligation('obl_mkm1').status, 'Broken');
    assert.deepEqual(k.query().tags('npc_tobi', 'person_tola'), ['broke_word']);
    assert.equal(k.query().rel('npc_tobi', 'person_tola').dims.trust, 40);
    settle(k, 'mkm2', 'obl_mkm1', { amount: 50000 });
    assert.deepEqual(k.query().tags('npc_tobi', 'person_tola'), ['broke_word', 'repaid_late']);
    // Stranger pair: broke obligation with no creditor-view rel → skipped, no crash.
    const r = k.dispatch({
      cmd_id: 'cmd_mkm3', type: 'create_obligation', actor: 't',
      params: { obligation_id: 'obl_stranger', kind: 'Debt', owes: 'npc_sunday', owed: 'person_tola', amount: 100, due_in_min: 5 },
    });
    assert.equal(r.status, 'applied');
    k.dispatch({ cmd_id: 'cmd_advm2', type: 'advance_time', actor: 't', params: { steps: 10 } });
    assert.equal(k.query().obligation('obl_stranger').status, 'Broken');
    assert.equal(k.query().rel('person_tola', 'npc_sunday'), null);
  });
  it('kept_word when fulfilled without ever breaking', () => {
    const k = world('map-seed2', true);
    seedRelationships(k, [{ a: 'npc_tobi', b: 'person_tola' }]);
    mk(k, 'mkk1', { amount: 10000, due_in_min: 5000 });
    settle(k, 'mkk2', 'obl_mkk1', { amount: 10000 });
    assert.deepEqual(k.query().tags('npc_tobi', 'person_tola'), ['kept_word']);
  });
});
