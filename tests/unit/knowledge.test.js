// tests/unit/knowledge.test.js — truth/belief/claim boundaries (M004).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKernel } from '../../sim/kernel/pipeline.js';
import { createPeople, seedPeople } from '../../sim/people/index.js';
import { createKnowledge, seedFacts, seedBeliefs, evaluateDisclosure, validateDisclosureRules } from '../../sim/knowledge/index.js';

const DISCLOSURE = [
  { person: 'npc_seyi', fact: 'fact_true_rent', disposition: 'tell' },
  { person: 'npc_sunday', fact: 'fact_true_rent', disposition: 'mislead', false_value: 500000 },
  { person: 'npc_sunday', fact: 'fact_son_returning', disposition: 'refuse' },
];

function world(seed = 'k-seed', disclosure = DISCLOSURE) {
  const kernel = createKernel({ seed });
  createPeople(kernel);
  const knowledge = createKnowledge(kernel, { disclosure });
  seedPeople(kernel, [
    { id: 'person_tola', display: 'Tola' },
    { id: 'npc_seyi', display: 'Seyi', incentives: ['rent'] },
    { id: 'npc_sunday', display: 'Sunday', incentives: ['commission'] },
    { id: 'npc_musa', display: 'Musa' },
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
  return { kernel, knowledge };
}

describe('facts and beliefs (authored, never rolled)', () => {
  it('sets facts/beliefs; rejects dups, strangers, unknown facts, bad enums', () => {
    const { kernel } = world();
    const set = (id, type, params) => kernel.dispatch({ cmd_id: id, type, actor: 't', params });
    assert.match(set('cmd_k1', 'set_fact', { fact_id: 'fact_true_rent', value: 1 }).reason, /fact_exists/);
    assert.match(set('cmd_k2', 'set_belief', { person: 'npc_ghost', fact: 'fact_true_rent', value: 1, certainty: 'sure', source: 'saw' }).reason, /unknown_person/);
    assert.match(set('cmd_k3', 'set_belief', { person: 'npc_musa', fact: 'fact_nope', value: 1, certainty: 'sure', source: 'saw' }).reason, /unknown_fact/);
    assert.match(set('cmd_k4', 'set_belief', { person: 'npc_musa', fact: 'fact_true_rent', value: 1, certainty: 'maybe', source: 'saw' }).reason, /certainty/);
    assert.match(set('cmd_k5', 'set_belief', { person: 'npc_musa', fact: 'fact_true_rent', value: 1, certainty: 'sure', source: 'dreamt' }).reason, /source/);
    assert.match(set('cmd_k6', 'set_belief', { person: 'npc_seyi', fact: 'fact_true_rent', value: 1, certainty: 'sure', source: 'saw' }).reason, /belief_exists/);
    assert.match(set('cmd_k7', 'identify_player', { person: 'npc_musa' }).reason, /player_already_set/);
    assert.equal(kernel.query().player(), 'person_tola');
  });
  it('disclosure rules validate; mislead without false_value is rejected at wiring', () => {
    assert.equal(validateDisclosureRules(DISCLOSURE), null);
    assert.match(validateDisclosureRules([{ person: 'npc_x', fact: 'fact_y', disposition: 'mislead' }]), /false_value/);
    assert.match(validateDisclosureRules([{ person: 'npc_x', fact: 'fact_y', disposition: 'vibe' }]), /disposition/);
  });
  it('repo disclosure content validates', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'rules');
    const rules = JSON.parse(readFileSync(join(dir, 'disclosure.json'), 'utf8'));
    assert.equal(validateDisclosureRules(rules), null);
  });
  it('repo facts slice is loadable: every entry has a fact_id and a value', () => {
    // slice.json currently has no runtime consumer (future M010 slice content);
    // this test keeps it loadable so it cannot rot silently.
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'facts');
    const facts = JSON.parse(readFileSync(join(dir, 'slice.json'), 'utf8'));
    assert.ok(Array.isArray(facts) && facts.length > 0, 'slice must be a non-empty array');
    for (const f of facts) {
      assert.equal(typeof f.fact_id, 'string', JSON.stringify(f));
      assert.ok('value' in f, `fact ${f.fact_id} needs a value`);
    }
    const fresh = createKernel({ seed: 'slice-load' });
    createPeople(fresh);
    createKnowledge(fresh, { disclosure: [] });
    for (const r of seedFacts(fresh, facts)) assert.equal(r.status, 'applied');
  });
});

describe('evaluateDisclosure (pure, deterministic)', () => {
  it('rule-only paths resolve without stance or incentives', () => {
    assert.deepEqual(
      evaluateDisclosure({ rule: { disposition: 'tell' }, stance: null, npcTags: [], factTags: [] }),
      { outcome: 'tell', steps: [{ kind: 'rule', outcome: 'tell' }] },
    );
    assert.equal(evaluateDisclosure({ rule: null, stance: null, npcTags: [], factTags: [] }).outcome, 'deflect');
  });
  it('hostile stance and incentive conflict each step down once; mislead is sticky', () => {
    const r = evaluateDisclosure({ rule: { disposition: 'tell' }, stance: 'Frosty', npcTags: ['rent'], factTags: ['rent'] });
    assert.equal(r.outcome, 'deflect'); // tell -> shade (stance) -> deflect (incentive)
    assert.deepEqual(r.steps.map((s) => s.kind), ['rule', 'stance', 'incentive']);
    const m = evaluateDisclosure({ rule: { disposition: 'mislead', false_value: 1 }, stance: 'Burned', npcTags: ['rent'], factTags: ['rent'] });
    assert.equal(m.outcome, 'mislead');
  });
});

describe('information boundary (no truth leak)', () => {
  it('no player-facing view contains an undisclosed fact value', () => {
    const { kernel } = world();
    // fact_gate_code value 777 is never disclosed to anyone in this world.
    kernel.dispatch({ cmd_id: 'cmd_s1', type: 'set_fact', actor: 't', params: { fact_id: 'fact_gate_code', value: 777 } });
    const q = kernel.query();
    const views = JSON.stringify({
      claims: q.claims(), card: q.claim_card('fact_gate_code'),
      person: q.person('npc_sunday'), people: q.people(),
    });
    assert.ok(!views.includes('777'), 'undisclosed value must not appear in any player view');
    assert.equal(q.claim_card('fact_gate_code'), null);
  });
  it('person views exclude incentive tags; debug accessor is not a query', () => {
    const { kernel, knowledge } = world();
    assert.deepEqual(Object.keys(kernel.query().person('npc_sunday')).sort(), ['display', 'id', 'origin_id']);
    assert.equal(typeof kernel.query().debugFacts, 'undefined');
    assert.equal(typeof kernel.query().debugInspect, 'undefined');
    assert.equal(knowledge.debugInspect().facts['fact_true_rent'].value, 450000);
  });
  it('knowledge stores alone disclose nothing (verbs own disclosure)', () => {
    const { kernel } = world();
    // No verbs wired here: asking is impossible, so nothing can leak.
    const r = kernel.dispatch({
      cmd_id: 'cmd_ask1', type: 'ask', actor: 't',
      params: { asker: 'person_tola', target: 'npc_musa', topic: 'information', fact: 'fact_true_rent' },
    });
    assert.match(r.reason, /unknown_command/);
    assert.equal(kernel.query().claims({ fact: 'fact_true_rent' }).length, 0);
  });
});
