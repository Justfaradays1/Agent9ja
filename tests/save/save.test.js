// tests/save/save.test.js — Save/Load v1 persistence contract (M006).
// Proves behavior after file round-trips, not just serialization.
// All file I/O goes to os.tmpdir() and is removed in t.after(); the repo is
// never polluted with saves.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootWorld } from '../../tools/world.js';
import { createKernel } from '../../sim/kernel/pipeline.js';
import {
  SCHEMA_VERSION, saveSlot, loadSlot, parseEnvelope, createEnvelope,
  migrateSnapshot, inspectSnapshot, saveAutosave,
} from '../../sim/save/index.js';

function freshTmp(t) {
  const dir = mkdtempSync(join(tmpdir(), 'agent9ja-save-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function scriptedWorld(seed = 'm006-save') {
  const { kernel } = bootWorld(seed);
  const d = (id, type, params) => {
    const r = kernel.dispatch({ cmd_id: id, type, actor: 't', params });
    assert.equal(r.status, 'applied', `${id}: ${r.reason || 'ok'}`);
    return r;
  };
  d('cmd_p1', 'register_person', { id: 'person_tola', display: 'Tola' });
  d('cmd_p2', 'register_person', { id: 'npc_tobi', display: 'Tobi' });
  d('cmd_p3', 'register_person', { id: 'npc_musa', display: 'Musa' });
  d('cmd_a1', 'open_account', { person: 'person_tola', opening: 800000 });
  d('cmd_a2', 'open_account', { person: 'npc_tobi', opening: 50000 });
  d('cmd_a3', 'open_account', { person: 'npc_musa', opening: 200000 });
  d('cmd_r1', 'open_relationship', { a: 'person_tola', b: 'npc_tobi', trust: 60, warmth: 60, tension: 10 });
  d('cmd_t1', 'tag_relationship', { a: 'person_tola', b: 'npc_tobi', tag: 'housed_me', op: 'add' });
  d('cmd_o1', 'create_obligation', { obligation_id: 'obl_rent', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 100000, due_in_min: 60, grace_min: 30, witnesses: ['npc_musa'] });
  d('cmd_s1', 'settle_obligation', { obligation: 'obl_rent', amount: 30000 }); // partial: stays Active, paid 30000
  d('cmd_o2', 'create_obligation', { obligation_id: 'obl_old', kind: 'Debt', owes: 'person_tola', owed: 'npc_musa', amount: 20000, due_in_min: 5 });
  d('cmd_adv1', 'advance_time', { steps: 12 }); // +60m: obl_rent Due, obl_old Broken (grace 0)
  d('cmd_o3', 'create_obligation', { obligation_id: 'obl_new', kind: 'Debt', owes: 'npc_tobi', owed: 'person_tola', amount: 5000, due_in_min: 5000 });
  d('cmd_o4', 'renegotiate_obligation', { obligation: 'obl_new', new_id: 'obl_new2', creditor_accept: true, new_due_in_min: 9000 });
  d('cmd_f1', 'set_fact', { fact_id: 'fact_gate_code', value: 4410, tags: ['security'] });
  d('cmd_b1', 'set_belief', { person: 'npc_musa', fact: 'fact_gate_code', value: 4410, certainty: 'sure', source: 'saw' });
  d('cmd_i1', 'identify_player', { person: 'person_tola' });
  d('cmd_n1', 'note_incentive', { person: 'npc_tobi', tag: 'fair_rent' });
  d('cmd_k1', 'ask', { asker: 'person_tola', target: 'npc_musa', topic: 'information', fact: 'fact_gate_code' });
  d('cmd_seed1', 'schedule_seed', { seed_id: 'seed_callback', fire_t: 2000, memo: 'tobi brings it up' });
  d('cmd_seed2', 'schedule_seed', { seed_id: 'seed_cancelled', fire_t: 3000, memo: 'never fires' });
  d('cmd_seed3', 'cancel_seed', { seed_id: 'seed_cancelled' });
  return kernel;
}

function saveAndReload(t, kernel, slot = 'slot1') {
  const dir = freshTmp(t);
  saveSlot(dir, slot, kernel.snapshot());
  const loaded = loadSlot(dir, slot);
  const { kernel: fresh } = bootWorld('other-seed');
  fresh.restore(loaded.snapshot);
  return { dir, loaded, fresh };
}

describe('file round-trip preserves the whole world', () => {
  it('save → new kernel → load → snapshot equals source', (t) => {
    const kernel = scriptedWorld();
    const before = kernel.snapshot();
    const { fresh, loaded } = saveAndReload(t, kernel);
    assert.equal(loaded.source.endsWith('slot1.json'), true);
    assert.equal(loaded.migratedFrom, null);
    assert.equal(fresh.snapshot(), before);
  });

  it('continued execution matches uninterrupted execution', (t) => {
    const kernel = scriptedWorld();
    const { fresh } = saveAndReload(t, kernel);
    const more = [
      ['cmd_c1', 'settle_obligation', { obligation: 'obl_rent', amount: 70000 }],
      ['cmd_c2', 'ask', { asker: 'person_tola', target: 'npc_tobi', topic: 'money', amount: 5000 }],
    ];
    for (const [id, type, params] of more) {
      assert.equal(kernel.dispatch({ cmd_id: id, type, actor: 't', params }).status, 'applied');
      assert.equal(fresh.dispatch({ cmd_id: id, type, actor: 't', params }).status, 'applied');
    }
    kernel.dispatch({ cmd_id: 'cmd_c3', type: 'advance_time', actor: 't', params: { steps: 20 } });
    fresh.dispatch({ cmd_id: 'cmd_c3', type: 'advance_time', actor: 't', params: { steps: 20 } });
    assert.equal(fresh.snapshot(), kernel.snapshot());
  });

  it('duplicate command after load is still a duplicate, seq continues', (t) => {
    const kernel = scriptedWorld();
    const { fresh } = saveAndReload(t, kernel);
    const r = fresh.dispatch({ cmd_id: 'cmd_s1', type: 'settle_obligation', actor: 't', params: { obligation: 'obl_rent', amount: 1 } });
    assert.equal(r.status, 'duplicate');
    assert.equal(r.firstSeq, kernel.query().journal(5000).find((e) => e.caused_by === 'cmd_s1').seq);
  });
});

describe('state coverage after load', () => {
  it('money, obligations, relationships, knowledge, memories, seeds all intact', (t) => {
    const kernel = scriptedWorld();
    const { fresh } = saveAndReload(t, kernel);
    const q = fresh.query();
    // Money + history integrity.
    assert.equal(q.balance('person_tola'), 800000 - 30000);
    assert.equal(q.ledger_consistent('person_tola'), true);
    // Obligations: partial, broken, renegotiated chain.
    assert.equal(q.obligation('obl_rent').status, 'Due');
    assert.equal(q.obligation('obl_rent').paid, 30000);
    assert.equal(q.obligation('obl_old').status, 'Broken');
    assert.deepEqual(q.obligation('obl_old').statusHistory.map((h) => h.status), ['Active', 'Due', 'Broken']);
    assert.equal(q.obligation('obl_new').status, 'Renegotiated');
    assert.equal(q.obligation('obl_new2').status, 'Active');
    assert.deepEqual(q.obligation('obl_new2').links, { renegotiated_from: 'obl_new' });
    // Relationships: dims, tags, stance (hysteresis anchor preserved).
    assert.equal(q.stance('person_tola', 'npc_tobi'), 'Neutral');
    assert.deepEqual(q.tags('person_tola', 'npc_tobi'), ['housed_me']);
    assert.equal(q.rel('person_tola', 'npc_tobi').dims.trust, 60);
    // Knowledge: claims, incentives, disclosure still gated (no leak by load).
    assert.equal(q.claims({ fact: 'fact_gate_code' }).length, 1);
    assert.equal(q.claims({ fact: 'fact_gate_code' })[0].asserted, 4410);
    assert.deepEqual(q.known_incentives('npc_tobi'), ['fair_rent']);
    assert.equal(q.claim_card('fact_gate_code').independent_sources, 1);
    // Memories + scars survive with provenance.
    const mems = q.what_they_remember('person_tola');
    assert.ok(mems.some((m) => m.kind === 'broke_promise' && m.subject === 'npc_musa'));
    // Seeds: pending intact, cancelled stays cancelled.
    q2check(fresh);
  });

  function q2check(fresh) {
    // Pending seed still fires exactly once after load; cancelled never fires.
    // Advances stay under COMMAND_EVENT_BUDGET (256) per command — a single
    // 400-step command would trip BudgetGuardTripped by design.
    fresh.dispatch({ cmd_id: 'cmd_advx1', type: 'advance_time', actor: 't', params: { steps: 200 } });
    fresh.dispatch({ cmd_id: 'cmd_advx2', type: 'advance_time', actor: 't', params: { steps: 200 } });
    const fired = fresh.query().journal(2000).filter((e) => e.kind === 'SeedFired');
    assert.equal(fired.length, 1);
    assert.equal(fired[0].data.seed_id, 'seed_callback');
  }

  it('hysteresis anchor survives: held stance holds after load', (t) => {
    const { kernel } = bootWorld('stance-seed');
    const d = (id, type, params) => kernel.dispatch({ cmd_id: id, type, actor: 't', params });
    d('cmd_p1', 'register_person', { id: 'person_tola', display: 'Tola' });
    d('cmd_p2', 'register_person', { id: 'npc_tobi', display: 'Tobi' });
    d('cmd_r1', 'open_relationship', { a: 'person_tola', b: 'npc_tobi', trust: 21, warmth: 50, tension: 10 });
    d('cmd_n1', 'nudge_relationship', { a: 'person_tola', b: 'npc_tobi', dTrust: -1 }); // 20 → Frosty
    d('cmd_n2', 'nudge_relationship', { a: 'person_tola', b: 'npc_tobi', dTrust: 1 }); // 21, held Frosty
    assert.equal(kernel.query().stance('person_tola', 'npc_tobi'), 'Frosty');
    const dir = freshTmp(t);
    saveSlot(dir, 's', kernel.snapshot());
    const { kernel: fresh } = bootWorld('other');
    fresh.restore(loadSlot(dir, 's').snapshot);
    assert.equal(fresh.query().stance('person_tola', 'npc_tobi'), 'Frosty');
    fresh.dispatch({ cmd_id: 'cmd_n3', type: 'nudge_relationship', actor: 't', params: { a: 'person_tola', b: 'npc_tobi', dTrust: 3 } });
    assert.equal(fresh.query().stance('person_tola', 'npc_tobi'), 'Frosty', 'anchor preserved: 24 still inside relaxed band');
    fresh.dispatch({ cmd_id: 'cmd_n4', type: 'nudge_relationship', actor: 't', params: { a: 'person_tola', b: 'npc_tobi', dTrust: 10 } });
    assert.equal(fresh.query().stance('person_tola', 'npc_tobi'), 'Neutral', '34 clears the band');
  });
});

describe('failure paths: corruption, incompatibility, partial writes', () => {
  it('garbage live file falls back to backup; all-garbage fails clearly', (t) => {
    const dir = freshTmp(t);
    const { kernel } = bootWorld('fb-seed');
    saveSlot(dir, 'slot1', kernel.snapshot());
    saveSlot(dir, 'slot1', kernel.snapshot()); // rotate: bak1 now valid
    writeFileSync(join(dir, 'slot1.json'), '{garbage!!!');
    const loaded = loadSlot(dir, 'slot1');
    assert.ok(loaded.source.endsWith('.bak1'), `fell back to ${loaded.source}`);
    const { kernel: fresh } = bootWorld('other');
    assert.doesNotThrow(() => fresh.restore(loaded.snapshot));
    writeFileSync(join(dir, 'slot1.json.bak1'), 'nope');
    writeFileSync(join(dir, 'slot1.json.bak2'), 'nah');
    assert.throws(() => loadSlot(dir, 'slot1'), /no_valid_save/);
  });

  it('truncated write (partial envelope) falls back; checksum tamper falls back', (t) => {
    const dir = freshTmp(t);
    const { kernel } = bootWorld('pw-seed');
    saveSlot(dir, 'slot1', kernel.snapshot());
    saveSlot(dir, 'slot1', kernel.snapshot());
    const full = readFileSync(join(dir, 'slot1.json'), 'utf8');
    writeFileSync(join(dir, 'slot1.json'), full.slice(0, Math.floor(full.length / 2)));
    assert.ok(loadSlot(dir, 'slot1').source.endsWith('.bak1'));
    // Valid JSON, wrong checksum: hand-edited balance.
    const tampered = JSON.parse(readFileSync(join(dir, 'slot1.json.bak1'), 'utf8'));
    tampered.snapshot = tampered.snapshot.replace('"minutes":480', '"minutes":481');
    writeFileSync(join(dir, 'slot1.json'), JSON.stringify(tampered));
    const loaded = loadSlot(dir, 'slot1');
    assert.ok(loaded.source.endsWith('.bak1'), 'checksum mismatch must not load');
  });

  it('newer schema refuses loudly; current world never touched', (t) => {
    const dir = freshTmp(t);
    const { kernel } = bootWorld('ver-seed');
    const before = kernel.snapshot();
    const env = JSON.parse(createEnvelope(kernel.snapshot()));
    env.schema = 99;
    writeFileSync(join(dir, 'future.json'), JSON.stringify(env));
    assert.throws(() => loadSlot(dir, 'future'), /incompatible_schema/);
    assert.equal(kernel.snapshot(), before, 'failed load leaves the live world alone');
  });

  it('bad slot names rejected before any disk touch', (t) => {
    const dir = freshTmp(t);
    const { kernel } = bootWorld('slot-seed');
    assert.throws(() => saveSlot(dir, '../evil', kernel.snapshot()), /bad_slot/);
    assert.throws(() => loadSlot(dir, ''), /bad_slot/);
  });

  it('stale crash-residue tmp files are cleared, never loaded', (t) => {
    const dir = freshTmp(t);
    const { kernel } = bootWorld('tmp-seed');
    writeFileSync(join(dir, 'slot1.json.tmp-99999'), '{crash residue');
    saveSlot(dir, 'slot1', kernel.snapshot());
    const leftovers = readdirSync(dir).filter((e) => e.includes('.tmp-'));
    assert.deepEqual(leftovers, []);
    assert.ok(loadSlot(dir, 'slot1').source.endsWith('slot1.json'));
  });
});

describe('migrations: ordered, tested, no invented values', () => {
  it('v0 fixture migrates and restores into a matching (bare) kernel', () => {
    const fixture = JSON.parse(readFileSync(new URL('./fixtures/v0-minimal.json', import.meta.url), 'utf8'));
    const migrated = migrateSnapshot({ ...fixture });
    assert.equal(migrated.v, SCHEMA_VERSION);
    assert.deepEqual(migrated.stores, {});
    assert.equal(migrated.seed, 'fixture-seed');
    // Bare kernel has no module stores: migrated snapshot restores cleanly.
    const bare = createKernel({ seed: 'x' });
    assert.doesNotThrow(() => bare.restore(JSON.stringify(migrated)));
    assert.equal(bare.query().flags().rent, 'due');
    assert.equal(bare.query().time().minutes, 480);
  });

  it('no migration path fails loudly instead of guessing', () => {
    assert.throws(() => migrateSnapshot({ v: 7, foo: 1 }), /no_migration_path/);
  });

  it('orphan memory kinds are dropped on load, everything else intact', (t) => {
    const kernel = scriptedWorld('orphan-seed');
    const snap = JSON.parse(kernel.snapshot());
    snap.stores.memory.mems['person_tola'].push({
      id: 'mem_1_person_tola_ghost_kind', kind: 'ghost_kind', subject: null,
      eventSeq: 1, t: 480, salience: 99, scar: false, origin_id: 'origin_dev',
    });
    const dir = freshTmp(t);
    saveSlot(dir, 's', JSON.stringify(snap));
    const { kernel: fresh } = bootWorld('other');
    fresh.restore(loadSlot(dir, 's').snapshot);
    const kinds = fresh.query().what_they_remember('person_tola').map((m) => m.kind);
    assert.ok(!kinds.includes('ghost_kind'), 'obsolete kind dropped per orphan policy');
    assert.ok(kinds.includes('broke_promise'), 'real memories intact');
  });
});

describe('budgets and inspector', () => {
  it('stressed world stays far under the save-size budget', (t) => {
    const { kernel } = bootWorld('size-seed');
    const d = (id, type, params) => kernel.dispatch({ cmd_id: id, type, actor: 't', params });
    d('cmd_p1', 'register_person', { id: 'person_tola', display: 'Tola' });
    d('cmd_p2', 'register_person', { id: 'npc_tobi', display: 'Tobi' });
    d('cmd_a1', 'open_account', { person: 'person_tola', opening: 100000000 });
    d('cmd_a2', 'open_account', { person: 'npc_tobi', opening: 0 });
    for (let i = 0; i < 400; i++) {
      d(`cmd_t${i}`, 'transfer', { from: i % 2 ? 'npc_tobi' : 'person_tola', to: i % 2 ? 'person_tola' : 'npc_tobi', amount: 100 + i });
    }
    for (let i = 0; i < 30; i++) {
      d(`cmd_o${i}`, 'create_obligation', { obligation_id: `obl_s${i}`, kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 1000, due_in_min: 60 * (i + 1) });
    }
    d('cmd_adv', 'advance_time', { steps: 500 });
    const dir = freshTmp(t);
    const { bytes } = saveSlot(dir, 'big', kernel.snapshot());
    assert.ok(bytes < 512 * 1024, `save is ${bytes} bytes, budget 512KB`);
    const snap = JSON.parse(kernel.snapshot());
    const scarBytes = Buffer.byteLength(JSON.stringify(
      Object.values(snap.stores.memory.mems).flat().filter((m) => m.scar),
    ), 'utf8');
    assert.ok(scarBytes < bytes * 0.5, 'scars are a small fraction today (revisit if worlds run months)');
  });

  it('inspector summarizes without dumping the world', () => {
    const kernel = scriptedWorld('insp-seed');
    const summary = inspectSnapshot(JSON.parse(kernel.snapshot()));
    assert.equal(summary.seq, kernel.query().journal(100000).at(-1).seq);
    assert.ok(summary.journalLength > 0);
    assert.equal(summary.clock.minutes, kernel.query().time().minutes);
    assert.ok(summary.stores.people && summary.stores.economy && summary.stores.memory);
  });

  it('autosave API writes a loadable autosave slot (triggers wired later)', (t) => {
    const dir = freshTmp(t);
    const kernel = scriptedWorld('auto-seed');
    saveAutosave(kernel, dir);
    const loaded = loadSlot(dir, 'autosave');
    assert.ok(loaded.source.endsWith('autosave.json'));
    const { kernel: fresh } = bootWorld('other');
    assert.doesNotThrow(() => fresh.restore(loaded.snapshot));
    assert.equal(fresh.snapshot(), kernel.snapshot());
  });
});

describe('settled obligations and post-load disclosure', () => {
  it('fully settled pre-save stays Fulfilled with history; split settlement works across save', (t) => {
    const { kernel } = bootWorld('settled-seed');
    const d = (id, type, params) => {
      const r = kernel.dispatch({ cmd_id: id, type, actor: 't', params });
      assert.equal(r.status, 'applied', `${id}: ${r.reason || 'ok'}`);
      return r;
    };
    d('cmd_p1', 'register_person', { id: 'person_tola', display: 'Tola' });
    d('cmd_p2', 'register_person', { id: 'npc_tobi', display: 'Tobi' });
    d('cmd_a1', 'open_account', { person: 'person_tola', opening: 800000 });
    d('cmd_a2', 'open_account', { person: 'npc_tobi', opening: 0 });
    d('cmd_o1', 'create_obligation', { obligation_id: 'obl_full', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 60000, due_in_min: 5000 });
    d('cmd_s1', 'settle_obligation', { obligation: 'obl_full', amount: 60000 });
    // Partial before save, remainder after: settlement split across the boundary.
    d('cmd_o2', 'create_obligation', { obligation_id: 'obl_split', kind: 'Debt', owes: 'person_tola', owed: 'npc_tobi', amount: 90000, due_in_min: 5000 });
    d('cmd_s2', 'settle_obligation', { obligation: 'obl_split', amount: 40000 });
    const dir = freshTmp(t);
    saveSlot(dir, 's', kernel.snapshot());
    const { kernel: fresh } = bootWorld('other');
    fresh.restore(loadSlot(dir, 's').snapshot);
    assert.equal(fresh.query().obligation('obl_full').status, 'Fulfilled');
    assert.deepEqual(fresh.query().obligation('obl_full').statusHistory.map((h) => h.status), ['Active', 'Fulfilled']);
    assert.equal(fresh.query().obligation('obl_split').paid, 40000);
    assert.equal(fresh.dispatch({ cmd_id: 'cmd_s3', type: 'settle_obligation', actor: 't', params: { obligation: 'obl_split', amount: 50000 } }).status, 'applied');
    assert.equal(fresh.query().obligation('obl_split').status, 'Fulfilled');
    assert.equal(fresh.query().balance('person_tola'), 800000 - 60000 - 90000);
    assert.equal(fresh.query().ledger_consistent('person_tola'), true);
    assert.match(
      fresh.dispatch({ cmd_id: 'cmd_s4', type: 'settle_obligation', actor: 't', params: { obligation: 'obl_full', amount: 1 } }).reason,
      /not_settleable/,
    );
  });

  it('post-load disclosure matches uninterrupted disclosure exactly', (t) => {
    const build = (seed) => {
      const { kernel } = bootWorld(seed);
      const d = (id, type, params) => kernel.dispatch({ cmd_id: id, type, actor: 't', params });
      d('cmd_p1', 'register_person', { id: 'person_tola', display: 'Tola' });
      d('cmd_p2', 'register_person', { id: 'npc_musa', display: 'Musa' });
      d('cmd_f1', 'set_fact', { fact_id: 'fact_gate_code', value: 4410, tags: ['security'] });
      d('cmd_b1', 'set_belief', { person: 'npc_musa', fact: 'fact_gate_code', value: 4410, certainty: 'sure', source: 'saw' });
      d('cmd_i1', 'identify_player', { person: 'person_tola' });
      return kernel;
    };
    const askParams = { asker: 'person_tola', target: 'npc_musa', topic: 'information', fact: 'fact_gate_code' };
    const live = build('disc-seed');
    const dir = freshTmp(t);
    saveSlot(dir, 's', live.snapshot());
    const { kernel: fresh } = bootWorld('other');
    fresh.restore(loadSlot(dir, 's').snapshot);
    assert.equal(live.dispatch({ cmd_id: 'cmd_ask1', type: 'ask', actor: 't', params: askParams }).status, 'applied');
    assert.equal(fresh.dispatch({ cmd_id: 'cmd_ask1', type: 'ask', actor: 't', params: askParams }).status, 'applied');
    assert.deepEqual(fresh.query().claims({ fact: 'fact_gate_code' }), live.query().claims({ fact: 'fact_gate_code' }));
    assert.equal(fresh.snapshot(), live.snapshot());
  });
});

