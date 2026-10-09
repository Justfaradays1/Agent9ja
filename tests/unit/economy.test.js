// tests/unit/economy.test.js — integer money, atomicity, consistency (M003).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../../sim/kernel/pipeline.js';
import { createPeople, seedPeople } from '../../sim/people/index.js';
import { createEconomy, seedAccounts, bandOf } from '../../sim/economy/index.js';

function world(seed = 'e-seed') {
  const kernel = createKernel({ seed });
  createPeople(kernel);
  createEconomy(kernel);
  seedPeople(kernel, [
    { id: 'person_tola', display: 'Tola' },
    { id: 'npc_tobi', display: 'Tobi' },
  ]);
  seedAccounts(kernel, [
    { person: 'person_tola', opening: 800000 },
    { person: 'npc_tobi', opening: 50000 },
  ]);
  return kernel;
}

const open = (k, id, p) => k.dispatch({ cmd_id: id, type: 'open_account', actor: 't', params: p });
const xfer = (k, id, p) => k.dispatch({ cmd_id: id, type: 'transfer', actor: 't', params: p });

describe('accounts', () => {
  it('rejects duplicates, strangers, and bad openings', () => {
    const k = world();
    assert.match(open(k, 'cmd_e1', { person: 'npc_tobi' }).reason, /account_exists/);
    assert.match(open(k, 'cmd_e2', { person: 'npc_ghost', opening: 10 }).reason, /unknown_person/);
    assert.match(open(k, 'cmd_e3', { person: 'npc_tobi', opening: -5 }).reason, /positive/);
    assert.match(open(k, 'cmd_e4', { person: 'bogus!!' }).reason, /stable person id/);
    assert.equal(k.query().balance('npc_tobi'), 50000, 'rejections change nothing');
  });
});

describe('money operations', () => {
  it('valid transfer moves exact kobo both sides + txn record', () => {
    const k = world();
    const r = xfer(k, 'cmd_m1', { from: 'person_tola', to: 'npc_tobi', amount: 150000, memo: 'rent help' });
    assert.equal(r.status, 'applied');
    assert.equal(k.query().balance('person_tola'), 650000);
    assert.equal(k.query().balance('npc_tobi'), 200000);
    const txns = k.query().transactions('person_tola');
    assert.equal(txns.length, 2); // opening txn + this transfer
    assert.match(txns[1].id, /^txn_/);
    assert.equal(txns[1].amount, 150000);
  });
  it('rejects zero/negative/float/string amounts, self-transfer, strangers', () => {
    const k = world();
    for (const [id, p, rx] of [
      ['cmd_m2', { from: 'person_tola', to: 'npc_tobi', amount: 0 }, /positive/],
      ['cmd_m3', { from: 'person_tola', to: 'npc_tobi', amount: -5 }, /positive/],
      ['cmd_m4', { from: 'person_tola', to: 'npc_tobi', amount: 10.5 }, /integer/],
      ['cmd_m5', { from: 'person_tola', to: 'npc_tobi', amount: '100' }, /integer/],
      ['cmd_m6', { from: 'person_tola', to: 'person_tola', amount: 10 }, /no_self_transfer/],
      ['cmd_m7', { from: 'person_tola', to: 'npc_ghost', amount: 10 }, /no_account/],
    ]) {
      assert.match(xfer(k, id, p).reason, rx);
    }
    assert.equal(k.query().balance('person_tola'), 800000, 'rejections move nothing');
  });
  it('insufficient funds rejects; balance never negative', () => {
    const k = world();
    assert.match(xfer(k, 'cmd_m8', { from: 'npc_tobi', to: 'person_tola', amount: 50001 }).reason, /insufficient_funds/);
    assert.equal(k.query().balance('npc_tobi'), 50000);
  });
  it('duplicate commands never move money twice', () => {
    const k = world();
    const cmd = { from: 'person_tola', to: 'npc_tobi', amount: 1000 };
    assert.equal(xfer(k, 'cmd_m9', cmd).status, 'applied');
    const dup = xfer(k, 'cmd_m9', cmd);
    assert.equal(dup.status, 'duplicate');
    assert.equal(k.query().balance('person_tola'), 799000);
    assert.equal(k.query().transactions('person_tola').length, 2); // opening + single transfer
  });
  it('ledger invariant holds: balance == carried + signed(txns)', () => {
    const k = world();
    for (let i = 0; i < 30; i++) {
      xfer(k, `cmd_seq${i}`, { from: i % 2 ? 'npc_tobi' : 'person_tola', to: i % 2 ? 'person_tola' : 'npc_tobi', amount: 1000 + i });
    }
    assert.equal(k.query().ledger_consistent('person_tola'), true);
    assert.equal(k.query().ledger_consistent('npc_tobi'), true);
  });
  it('history compacts past cap without breaking the invariant', () => {
    const k = world();
    // 1050 round-trips = 2100 txns on tola's list → forces compaction.
    for (let i = 0; i < 1050; i++) {
      xfer(k, `cmd_cA${i}`, { from: 'person_tola', to: 'npc_tobi', amount: 100 });
      xfer(k, `cmd_cB${i}`, { from: 'npc_tobi', to: 'person_tola', amount: 100 });
    }
    const w = k.query().wallet('person_tola');
    assert.ok(w.carriedCount > 0, 'compaction must have run');
    assert.equal(k.query().ledger_consistent('person_tola'), true);
    assert.equal(k.query().balance('person_tola'), 800000, 'round-trips net zero');
  });
  it('bands label balances; views frozen', () => {
    assert.equal(bandOf(0), 'broke');
    assert.equal(bandOf(999999), 'flush');
    const k = world();
    assert.equal(k.query().wallet('person_tola').band, 'flush');
    assert.throws(() => { k.query().wallet('person_tola').balance = 0; }, TypeError);
    assert.equal(k.query().balance('npc_ghost'), null);
  });
});
