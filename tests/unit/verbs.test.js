// tests/unit/verbs.test.js — Ask/Promise/Vouch/Repay/Decline (M004).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKernel } from '../../sim/kernel/pipeline.js';
import { createPeople, seedPeople } from '../../sim/people/index.js';
import { createRelationships, seedRelationships } from '../../sim/relationships/index.js';
import { createEconomy, seedAccounts } from '../../sim/economy/index.js';
import { createObligations } from '../../sim/obligations/index.js';
import { createKnowledge, seedFacts, seedBeliefs } from '../../sim/knowledge/index.js';
import { createMemory } from '../../sim/memory/index.js';
import { createVerbs, validateTemplates } from '../../sim/verbs/index.js';

const STANCE = {
  hysteresis: 5,
  thresholds: [
    { stance: 'Burned', when: { tension_gte: 80 } },
    { stance: 'Frosty', when: { trust_lte: 20 } },
    { stance: 'Cool', when: { warmth_lte: 35 } },
    { stance: 'Warm', when: { trust_gte: 70, warmth_gte: 60, tension_lte: 25 } },
    { stance: 'Neutral', when: {} },
  ],
};
const KINDS = { Debt: {}, PromisedAction: {}, Favour: {}, Vouch: {} };
const DISCLOSURE = [
  { person: 'npc_seyi', fact: 'fact_true_rent', disposition: 'tell' },
  { person: 'npc_sunday', fact: 'fact_true_rent', disposition: 'mislead', false_value: 500000 },
  { person: 'npc_sunday', fact: 'fact_son_returning', disposition: 'refuse' },
];
const TEMPLATES = [
  { id: 'repay_friday', kind: 'Debt', amount: 50000, due_in_min: 4320, grace_min: 1440 },
  { id: 'return_item', kind: 'PromisedAction', subject: 'Return what was borrowed', due_in_min: 1440, grace_min: 720 },
];

function world(seed = 'v-seed') {
  const kernel = createKernel({ seed });
  const people = createPeople(kernel);
  createRelationships(kernel, STANCE);
  createEconomy(kernel);
  const memory = createMemory(kernel, []); // wired for gates; no slice rules here
  createObligations(kernel, KINDS, { memoryReads: memory.reads });
  const knowledge = createKnowledge(kernel, { disclosure: DISCLOSURE });
  createVerbs(kernel, { templates: TEMPLATES, knowledge, peopleReads: people.reads, kinds: KINDS, memoryReads: memory.reads });
  seedPeople(kernel, [
    { id: 'person_tola', display: 'Tola' },
    { id: 'npc_seyi', display: 'Seyi', incentives: ['rent'] },
    { id: 'npc_sunday', display: 'Sunday', incentives: ['commission'] },
    { id: 'npc_musa', display: 'Musa' },
  ]);
  seedAccounts(kernel, [
    { person: 'person_tola', opening: 800000 },
    { person: 'npc_sunday', opening: 100000 },
  ]);
  seedFacts(kernel, [
    { fact_id: 'fact_true_rent', value: 450000, tags: ['money', 'rent'] },
    { fact_id: 'fact_son_returning', value: false, tags: ['housing'] },
  ]);
  seedBeliefs(kernel, [
    { person: 'npc_seyi', fact: 'fact_true_rent', value: 450000, certainty: 'sure', source: 'saw' },
    { person: 'npc_sunday', fact: 'fact_true_rent', value: 450000, certainty: 'sure', source: 'saw' },
    { person: 'npc_sunday', fact: 'fact_son_returning', value: true, certainty: 'likely', source: 'told' },
  ]);
  kernel.dispatch({ cmd_id: 'cmd_ident1', type: 'identify_player', actor: 'seed', params: { person: 'person_tola' } });
  return kernel;
}

const ask = (k, id, params) => k.dispatch({ cmd_id: id, type: 'ask', actor: 't', params });

describe('ask information (disclosure in action)', () => {
  it('tell records a provenanced claim; favour obligation follows every ask', () => {
    const k = world();
    // Seyi: tell rule, but incentive (rent) conflicts with fact tags → shade.
    const r = ask(k, 'cmd_a1', { asker: 'person_tola', target: 'npc_seyi', topic: 'information', fact: 'fact_true_rent' });
    assert.equal(r.status, 'applied');
    const claims = k.query().claims({ fact: 'fact_true_rent' });
    assert.equal(claims.length, 1);
    assert.equal(claims[0].asserted, 450000);
    assert.equal(claims[0].speaker, 'npc_seyi');
    assert.equal(claims[0].origin_id, 'origin_dev');
    assert.equal(claims[0].shading, 'partial');
    const favs = k.query().obligations({ party: 'person_tola' }).filter((o) => o.kind === 'Favour');
    assert.equal(favs.length, 1);
  });
  it('mislead uses the authored falsehood; the truth never appears', () => {
    const k = world();
    ask(k, 'cmd_a2', { asker: 'person_tola', target: 'npc_sunday', topic: 'information', fact: 'fact_true_rent' });
    const claims = k.query().claims({ fact: 'fact_true_rent' });
    assert.equal(claims[0].asserted, 500000);
    const card = k.query().claim_card('fact_true_rent');
    assert.deepEqual(card.positions.map((p) => p.value), [500000]);
  });
  it('no belief → deflect with reasons; refuse stays refused; favour still recorded', () => {
    const k = world();
    const r = ask(k, 'cmd_a3', { asker: 'person_tola', target: 'npc_musa', topic: 'information', fact: 'fact_true_rent' });
    assert.equal(r.status, 'applied');
    assert.equal(k.query().claims({ fact: 'fact_true_rent' }).length, 0);
    const defused = k.query().journal(10).find((e) => e.kind === 'DisclosureDefused');
    assert.equal(defused.data.kind, 'Deflect');
    const r2 = ask(k, 'cmd_a4', { asker: 'person_tola', target: 'npc_sunday', topic: 'information', fact: 'fact_son_returning' });
    assert.equal(r2.status, 'applied');
    assert.equal(k.query().claims({ fact: 'fact_son_returning' }).length, 0);
    assert.equal(k.query().obligations({ party: 'person_tola' }).filter((o) => o.kind === 'Favour').length, 2);
  });
  it('hostile stance downgrades disclosure (Frosty tell → shade)', () => {
    const k = world();
    seedRelationships(k, [{ a: 'npc_seyi', b: 'person_tola', trust: 10, warmth: 50, tension: 10 }]);
    assert.equal(k.query().stance('npc_seyi', 'person_tola'), 'Frosty');
    ask(k, 'cmd_a5', { asker: 'person_tola', target: 'npc_seyi', topic: 'information', fact: 'fact_true_rent' });
    const claims = k.query().claims({ fact: 'fact_true_rent' });
    // tell → shade (stance) → deflect (incentive): no claim recorded.
    assert.equal(claims.length, 0);
    const defused = k.query().journal(10).find((e) => e.kind === 'DisclosureDefused');
    assert.deepEqual(defused.data.steps.map((s) => s.kind), ['rule', 'stance', 'incentive']);
  });
  it('invalid asks reject without mutation', () => {
    const k = world();
    const snap = () => JSON.stringify({ o: k.query().obligations({}), c: k.query().claims() });
    const before = snap();
    for (const [id, params, rx] of [
      ['cmd_x1', { asker: 'person_tola', target: 'npc_seyi', topic: 'gossip' }, /topic/],
      ['cmd_x2', { asker: 'person_tola', target: 'npc_ghost', topic: 'information', fact: 'fact_true_rent' }, /unknown_person/],
      ['cmd_x3', { asker: 'person_tola', target: 'person_tola', topic: 'information', fact: 'fact_true_rent' }, /no_self_ask/],
      ['cmd_x4', { asker: 'person_tola', target: 'npc_seyi', topic: 'information', fact: 'fact_nope' }, /unknown_fact/],
      ['cmd_x5', { asker: 'person_tola', target: 'npc_seyi', topic: 'money', amount: 0 }, /positive/],
      ['cmd_x6', { asker: 'person_tola', target: 'npc_seyi', topic: 'introduction', person: 'npc_ghost' }, /unknown_person/],
    ]) {
      assert.match(ask(k, id, params).reason, rx);
    }
    assert.equal(snap(), before);
  });
});

describe('claim cards (suspicion without truth)', () => {
  it('repeats of one rumour count once; two origins count twice', () => {
    const k = world();
    for (let i = 0; i < 5; i++) {
      ask(k, `cmd_r${i}`, { asker: 'person_tola', target: 'npc_sunday', topic: 'information', fact: 'fact_true_rent' });
    }
    const one = k.query().claim_card('fact_true_rent');
    assert.equal(one.heard_total, 1, 'superseded repeats leave one heard claim');
    assert.equal(one.independent_sources, 1);
    // A second origin asserting the same value counts independently.
    k.dispatch({
      cmd_id: 'cmd_bel1', type: 'set_belief', actor: 't',
      params: { person: 'npc_musa', fact: 'fact_true_rent', value: 500000, certainty: 'likely', source: 'told', origin_id: 'origin_street' },
    });
    assert.equal(k.query().claim_card('fact_true_rent').independent_sources, 1, 'beliefs alone are not claims');
  });
  it('two origins asserting differently produce two positions, two sources', () => {
    const kernel = createKernel({ seed: 'two-origin' });
    const people = createPeople(kernel);
    createRelationships(kernel, STANCE);
    createEconomy(kernel);
    createObligations(kernel, KINDS);
    const knowledge = createKnowledge(kernel, {
      disclosure: [
        ...DISCLOSURE,
        { person: 'npc_musa', fact: 'fact_true_rent', disposition: 'tell' },
      ],
    });
    createVerbs(kernel, { templates: TEMPLATES, knowledge, peopleReads: people.reads, kinds: KINDS });
    seedPeople(kernel, [
      { id: 'person_tola', display: 'Tola' },
      { id: 'npc_sunday', display: 'Sunday' },
      { id: 'npc_musa', display: 'Musa' },
    ]);
    seedFacts(kernel, [{ fact_id: 'fact_true_rent', value: 450000 }]);
    seedBeliefs(kernel, [
      { person: 'npc_sunday', fact: 'fact_true_rent', value: 450000, certainty: 'sure', source: 'saw' },
      { person: 'npc_musa', fact: 'fact_true_rent', value: 430000, certainty: 'likely', source: 'told', origin_id: 'origin_street' },
    ]);
    kernel.dispatch({ cmd_id: 'cmd_ident9', type: 'identify_player', actor: 't', params: { person: 'person_tola' } });
    const ask9 = (id, target) => kernel.dispatch({
      cmd_id: id, type: 'ask', actor: 't', params: { asker: 'person_tola', target, topic: 'information', fact: 'fact_true_rent' },
    });
    ask9('cmd_t1', 'npc_sunday'); // mislead 500000, origin_dev
    ask9('cmd_t2', 'npc_musa'); // tell 430000, origin_street
    const card = kernel.query().claim_card('fact_true_rent');
    assert.equal(card.independent_sources, 2);
    assert.deepEqual(card.positions.map((p) => p.value).sort(), [430000, 500000]);
  });
  it('card shows learned incentives, never ground truth', () => {
    const k = world();
    ask(k, 'cmd_c1', { asker: 'person_tola', target: 'npc_sunday', topic: 'information', fact: 'fact_true_rent' });
    assert.deepEqual(k.query().claim_card('fact_true_rent').incentives_known, { npc_sunday: [] });
    k.dispatch({ cmd_id: 'cmd_c2', type: 'note_incentive', actor: 't', params: { person: 'npc_sunday', tag: 'commission' } });
    assert.deepEqual(k.query().claim_card('fact_true_rent').incentives_known, { npc_sunday: ['commission'] });
    const dup = k.dispatch({ cmd_id: 'cmd_c3', type: 'note_incentive', actor: 't', params: { person: 'npc_sunday', tag: 'commission' } });
    assert.equal(dup.status, 'applied'); // idempotent no-op
    assert.deepEqual(k.query().known_incentives('npc_sunday'), ['commission']);
  });
  it('re-hearing supersedes the older claim from the same speaker', () => {
    const k = world();
    ask(k, 'cmd_s1', { asker: 'person_tola', target: 'npc_seyi', topic: 'information', fact: 'fact_true_rent' });
    ask(k, 'cmd_s2', { asker: 'person_tola', target: 'npc_seyi', topic: 'information', fact: 'fact_true_rent' });
    const all = k.query().claims({ fact: 'fact_true_rent' });
    assert.equal(all.filter((c) => c.status === 'heard').length, 1);
    assert.equal(all.filter((c) => c.status === 'superseded').length, 1);
  });
});

describe('ask money/shelter/introduction + decline', () => {
  it('records favour + open request; target-only decline closes it', () => {
    const k = world();
    const r = ask(k, 'cmd_q1', { asker: 'person_tola', target: 'npc_sunday', topic: 'money', amount: 20000 });
    assert.equal(r.status, 'applied');
    const reqs = k.query().requests({ target: 'npc_sunday', status: 'open' });
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].topic, 'money');
    const wrong = k.dispatch({ cmd_id: 'cmd_q2', type: 'decline', actor: 't', params: { request: reqs[0].id, decliner: 'person_tola' } });
    assert.match(wrong.reason, /only_target_declines/);
    const ok = k.dispatch({ cmd_id: 'cmd_q3', type: 'decline', actor: 't', params: { request: reqs[0].id } });
    assert.equal(ok.status, 'applied');
    assert.equal(k.query().request(reqs[0].id).status, 'declined');
    assert.match(
      k.dispatch({ cmd_id: 'cmd_q4', type: 'decline', actor: 't', params: { request: reqs[0].id } }).reason,
      /already_closed/,
    );
    assert.match(
      k.dispatch({ cmd_id: 'cmd_q5', type: 'decline', actor: 't', params: { request: 'req_99999' } }).reason,
      /unknown_request/,
    );
  });
});

describe('promise templates', () => {
  it('template creates a real obligation; unknown template rejects; content validates', () => {
    assert.equal(validateTemplates(TEMPLATES), null);
    assert.match(validateTemplates([{ id: 'tmpl_x', kind: 'Debt' }]), /amount|due_in_min/);
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'obligations');
    const file = JSON.parse(readFileSync(join(dir, 'promise-templates.json'), 'utf8'));
    assert.equal(validateTemplates(file), null);
    const k = world();
    assert.equal(k.query().promise_templates().length, 2);
    const r = k.dispatch({
      cmd_id: 'cmd_p1', type: 'promise', actor: 't',
      params: { template: 'repay_friday', owes: 'person_tola', owed: 'npc_sunday' },
    });
    assert.equal(r.status, 'applied');
    const o = k.query().obligation('prom_cmd_p1');
    assert.equal(o.kind, 'Debt');
    assert.equal(o.amount, 50000);
    assert.match(k.dispatch({
      cmd_id: 'cmd_p2', type: 'promise', actor: 't',
      params: { template: 'tmpl_nope', owes: 'person_tola', owed: 'npc_sunday' },
    }).reason, /unknown_template/);
  });
});

describe('vouch (record now, consequences M005)', () => {
  it('creates a Vouch record; self-vouch rejects; settle refuses loudly', () => {
    const k = world();
    const r = k.dispatch({
      cmd_id: 'cmd_v1', type: 'vouch', actor: 't',
      params: { voucher: 'person_tola', subject: 'npc_musa', audience: 'npc_sunday' },
    });
    assert.equal(r.status, 'applied');
    const o = k.query().obligation('vouch_cmd_v1');
    assert.equal(o.kind, 'Vouch');
    assert.match(k.dispatch({
      cmd_id: 'cmd_v2', type: 'vouch', actor: 't',
      params: { voucher: 'person_tola', subject: 'person_tola', audience: 'npc_sunday' },
    }).reason, /no_self_vouch/);
    assert.match(k.dispatch({
      cmd_id: 'cmd_v3', type: 'settle_obligation', actor: 't', params: { obligation: 'vouch_cmd_v1', complete: true },
    }).reason, /vouch_settles_in_m005/);
    assert.match(k.dispatch({
      cmd_id: 'cmd_v4', type: 'repay', actor: 't', params: { obligation: 'vouch_cmd_v1', complete: true },
    }).reason, /vouch_settles_in_m005/);
  });
});

describe('repay verb (same semantics as settle_obligation)', () => {
  it('full and partial repay through the repay command; duplicates safe', () => {
    const k = world();
    k.dispatch({
      cmd_id: 'cmd_rp0', type: 'create_obligation', actor: 't',
      params: { obligation_id: 'obl_rp', kind: 'Debt', owes: 'person_tola', owed: 'npc_sunday', amount: 60000, due_in_min: 5000 },
    });
    assert.equal(
      k.dispatch({ cmd_id: 'cmd_rp1', type: 'repay', actor: 't', params: { obligation: 'obl_rp', amount: 20000 } }).status,
      'applied',
    );
    assert.equal(k.query().obligation('obl_rp').status, 'Active');
    assert.equal(
      k.dispatch({ cmd_id: 'cmd_rp2', type: 'repay', actor: 't', params: { obligation: 'obl_rp', amount: 40000 } }).status,
      'applied',
    );
    assert.equal(k.query().obligation('obl_rp').status, 'Fulfilled');
    assert.equal(k.query().balance('person_tola'), 740000);
    assert.match(
      k.dispatch({ cmd_id: 'cmd_rp3', type: 'repay', actor: 't', params: { obligation: 'obl_rp', amount: 1 } }).reason,
      /not_settleable/,
    );
    const dup = k.dispatch({ cmd_id: 'cmd_rp2', type: 'repay', actor: 't', params: { obligation: 'obl_rp', amount: 40000 } });
    assert.equal(dup.status, 'duplicate');
    assert.equal(k.query().balance('person_tola'), 740000);
  });
});

describe('interaction menu (availability with reasons)', () => {
  it('lists verbs; repay/decline reflect real state; unknown persons error', () => {
    const k = world();
    const menu = k.query().interaction_menu('person_tola', 'npc_sunday');
    const byVerb = Object.fromEntries(menu.map((m) => [m.verb, m]));
    assert.equal(byVerb.ask_information.available, true);
    assert.ok(Array.isArray(byVerb.promise.reasons));
    assert.equal(byVerb.repay.available, false);
    assert.match(byVerb.repay.reasons[0], /no outstanding/);
    assert.equal(byVerb.decline.available, false);
    ask(k, 'cmd_m1', { asker: 'person_tola', target: 'npc_sunday', topic: 'money', amount: 5000 });
    const menu2 = k.query().interaction_menu('person_tola', 'npc_sunday');
    const byVerb2 = Object.fromEntries(menu2.map((m) => [m.verb, m]));
    // The request is addressed to Sunday: decline shows on Sunday's menu, not Tola's.
    assert.equal(byVerb2.decline.available, false);
    const sundayMenu = k.query().interaction_menu('npc_sunday', 'person_tola');
    assert.equal(sundayMenu.find((m) => m.verb === 'decline').available, true);
    assert.equal(k.query().interaction_menu('person_tola', 'npc_ghost').error.slice(0, 14), 'unknown_person');
    assert.equal(k.query().interaction_menu('person_tola', 'person_tola').error, 'no_self_menu');
  });
});

describe('verb determinism + persistence', () => {
  it('two kernels, same script, identical snapshots; restore continues identically', () => {
    const run = () => {
      const k = world('verb-det');
      ask(k, 'cmd_d1', { asker: 'person_tola', target: 'npc_seyi', topic: 'information', fact: 'fact_true_rent' });
      ask(k, 'cmd_d2', { asker: 'person_tola', target: 'npc_sunday', topic: 'money', amount: 5000 });
      k.dispatch({ cmd_id: 'cmd_d3', type: 'note_incentive', actor: 't', params: { person: 'npc_sunday', tag: 'commission' } });
      return k.snapshot();
    };
    assert.equal(run(), run());
    const a = world('verb-det');
    ask(a, 'cmd_d1', { asker: 'person_tola', target: 'npc_seyi', topic: 'information', fact: 'fact_true_rent' });
    const snap = a.snapshot();
    const c = world('other');
    c.restore(snap);
    assert.equal(c.snapshot(), snap);
  });
  it('query views stay frozen', () => {
    const k = world();
    ask(k, 'cmd_f1', { asker: 'person_tola', target: 'npc_seyi', topic: 'information', fact: 'fact_true_rent' });
    assert.throws(() => { k.query().claims().push({}); }, TypeError);
    assert.throws(() => { k.query().claim_card('fact_true_rent').heard_total = 0; }, TypeError);
  });
});
