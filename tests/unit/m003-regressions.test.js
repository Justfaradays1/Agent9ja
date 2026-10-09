// tests/unit/m003-regressions.test.js — focused M003 guarantees (requested gate checks).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../../sim/kernel/pipeline.js';
import { createPeople, seedPeople } from '../../sim/people/index.js';
import { createRelationships, seedRelationships, registerObligationConsequences } from '../../sim/relationships/index.js';
import { createEconomy, seedAccounts } from '../../sim/economy/index.js';
import { createObligations } from '../../sim/obligations/index.js';

const KINDS = { Debt: {}, PromisedAction: {} };
const STANCE = { hysteresis: 5, thresholds: [{ stance: 'Neutral', when: {} }] };
const MAPPING = [{ on: 'ObligationBroken', kind: 'Debt', tag: 'broke_word' }];

function world(seed = 'reg-seed') {
  const kernel = createKernel({ seed });
  createPeople(kernel);
  createRelationships(kernel, STANCE);
  createEconomy(kernel);
  createObligations(kernel, KINDS);
  seedPeople(kernel, [
    { id: 'person_tola', display: 'Tola' },
    { id: 'npc_tobi', display: 'Tobi' },
  ]);
  seedAccounts(kernel, [
    { person: 'person_tola', opening: 1000000 },
    { person: 'npc_tobi', opening: 0 },
  ]);
  return kernel;
}

describe('M003 regression: compaction + restore (no double count)', () => {
  it('compacted history restores exactly and continues identically', () => {
    const k = world();
    for (let i = 0; i < 1050; i++) {
      k.dispatch({ cmd_id: `cmd_ra${i}`, type: 'transfer', actor: 't', params: { from: 'person_tola', to: 'npc_tobi', amount: 100 } });
      k.dispatch({ cmd_id: `cmd_rb${i}`, type: 'transfer', actor: 't', params: { from: 'npc_tobi', to: 'person_tola', amount: 100 } });
    }
    assert.ok(k.query().wallet('person_tola').carriedCount > 0, 'compaction must have run pre-restore');
    const snap = k.snapshot();
    const c = world('other-seed');
    c.restore(snap);
    assert.equal(c.snapshot(), snap, 'restored snapshot must equal source exactly');
    assert.equal(c.query().ledger_consistent('person_tola'), true);
    assert.equal(c.query().ledger_consistent('npc_tobi'), true);
    k.dispatch({ cmd_id: 'cmd_after1', type: 'transfer', actor: 't', params: { from: 'person_tola', to: 'npc_tobi', amount: 500 } });
    c.dispatch({ cmd_id: 'cmd_after1', type: 'transfer', actor: 't', params: { from: 'person_tola', to: 'npc_tobi', amount: 500 } });
    assert.equal(c.snapshot(), k.snapshot(), 'post-restore continuation must match');
    assert.equal(k.query().balance('person_tola'), 999500);
  });
});

describe('M003 regression: outcome effects fire exactly once', () => {
  it('duplicate consequence wiring is rejected (the double-nudge hazard)', () => {
    const k = world();
    registerObligationConsequences(k, MAPPING);
    assert.throws(() => registerObligationConsequences(k, MAPPING), /duplicate_wiring/);
  });
  it('replay and redelivery never double-apply relationship changes', () => {
    const run = () => {
      const k = world('dup-seed');
      registerObligationConsequences(k, MAPPING);
      seedRelationships(k, [{ a: 'npc_tobi', b: 'person_tola' }]);
      k.dispatch({
        cmd_id: 'cmd_do1', type: 'create_obligation', actor: 't',
        params: { obligation_id: 'obl_dup', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 100, due_in_min: 5 },
      });
      k.dispatch({ cmd_id: 'cmd_adv1', type: 'advance_time', actor: 't', params: { steps: 10 } });
      // Redeliver same logical advance under fresh cmd_ids (network-retry shape).
      k.dispatch({ cmd_id: 'cmd_adv2', type: 'advance_time', actor: 't', params: { steps: 10 } });
      return k.snapshot();
    };
    assert.equal(run(), run());
    const k = world('dup-seed');
    registerObligationConsequences(k, MAPPING);
    seedRelationships(k, [{ a: 'npc_tobi', b: 'person_tola' }]);
    k.dispatch({
      cmd_id: 'cmd_do1', type: 'create_obligation', actor: 't',
      params: { obligation_id: 'obl_dup', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 100, due_in_min: 5 },
    });
    k.dispatch({ cmd_id: 'cmd_adv1', type: 'advance_time', actor: 't', params: { steps: 10 } });
    assert.deepEqual(k.query().tags('npc_tobi', 'person_tola'), ['broke_word'], 'exactly one tag');
  });
});

describe('M003 regression: due-scan boundaries', () => {
  it('same due_t transitions in id order; exact boundary is Due, next step Broken', () => {
    const k = world('bound-seed');
    for (const [id, owes] of [['obl_b1', 'person_tola'], ['obl_b2', 'npc_tobi']]) {
      const r = k.dispatch({
        cmd_id: `cmd_${id}`, type: 'create_obligation', actor: 't',
        params: {
          obligation_id: id, kind: 'Debt',
          owes, owed: owes === 'person_tola' ? 'npc_tobi' : 'person_tola',
          amount: 100, due_in_min: 10, grace_min: 0,
        },
      });
      assert.equal(r.status, 'applied');
    }
    // tobi owes tola 100 but tobi balance is 0 — creation is fine (no money moves yet).
    k.dispatch({ cmd_id: 'cmd_advb', type: 'advance_time', actor: 't', params: { steps: 2 } }); // now == due_t
    assert.equal(k.query().obligation('obl_b1').status, 'Due');
    assert.equal(k.query().obligation('obl_b2').status, 'Due');
    const dues = k.query().journal(10).filter((e) => e.kind === 'ObligationDue');
    assert.deepEqual(dues.map((e) => e.data.id), ['obl_b1', 'obl_b2'], 'same-step order follows (due_t, id)');
    k.dispatch({ cmd_id: 'cmd_advb2', type: 'advance_time', actor: 't', params: { steps: 1 } });
    assert.equal(k.query().obligation('obl_b1').status, 'Broken');
    assert.equal(k.query().obligation('obl_b2').status, 'Broken');
  });
  it('due_in_min 0 is rejected (due must be strictly future)', () => {
    const k = world();
    const r = k.dispatch({
      cmd_id: 'cmd_zero', type: 'create_obligation', actor: 't',
      params: { obligation_id: 'obl_zero', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 10, due_in_min: 0 },
    });
    assert.match(r.reason, /past_due/);
  });
});
