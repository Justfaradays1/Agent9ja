// tests/unit/relationships.test.js — directional state, stance, hysteresis (M002).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKernel } from '../../sim/kernel/pipeline.js';
import { createPeople, seedPeople } from '../../sim/people/index.js';
import { createRelationships, seedRelationships, validateStanceRules, deriveStance } from '../../sim/relationships/index.js';

const RULES = {
  hysteresis: 5,
  thresholds: [
    { stance: 'Burned', when: { tension_gte: 80 } },
    { stance: 'Frosty', when: { trust_lte: 20 } },
    { stance: 'Cool', when: { warmth_lte: 35 } },
    { stance: 'Warm', when: { trust_gte: 70, warmth_gte: 60, tension_lte: 25 } },
    { stance: 'Neutral', when: {} },
  ],
};

function world(seed = 'r-seed', rules = RULES) {
  const kernel = createKernel({ seed });
  createPeople(kernel);
  createRelationships(kernel, rules);
  seedPeople(kernel, [
    { id: 'person_tola', display: 'Tola' },
    { id: 'npc_tobi', display: 'Tobi' },
    { id: 'npc_sunday', display: 'Sunday' },
  ]);
  return kernel;
}

const open = (k, id, a, b, extra = {}) =>
  k.dispatch({ cmd_id: id, type: 'open_relationship', actor: 't', params: { a, b, ...extra } });
const nudge = (k, id, a, b, d) =>
  k.dispatch({ cmd_id: id, type: 'nudge_relationship', actor: 't', params: { a, b, ...d } });

describe('directionality (no symmetric score)', () => {
  it('A→B exists without B→A; each mutates independently', () => {
    const k = world();
    assert.equal(open(k, 'cmd_r1', 'person_tola', 'npc_tobi').status, 'applied');
    assert.equal(k.query().stance('person_tola', 'npc_tobi'), 'Neutral');
    assert.equal(k.query().stance('npc_tobi', 'person_tola'), null);
    nudge(k, 'cmd_r2', 'person_tola', 'npc_tobi', { dTrust: 30, dWarmth: 20 });
    assert.equal(k.query().stance('person_tola', 'npc_tobi'), 'Warm');
    assert.equal(k.query().stance('npc_tobi', 'person_tola'), null);
  });
});

describe('creation guards', () => {
  it('rejects self, duplicates, missing counterparts, bad ids, bad dims', () => {
    const k = world();
    assert.match(open(k, 'cmd_g1', 'person_tola', 'person_tola').reason, /no_self_relationship/);
    assert.match(open(k, 'cmd_g2', 'person_tola', 'npc_ghost').reason, /unknown_person/);
    assert.match(open(k, 'cmd_g3', 'bogus!!', 'npc_tobi').reason, /stable person ids|bad/);
    assert.equal(open(k, 'cmd_g4', 'person_tola', 'npc_tobi', { trust: 50, warmth: 50, tension: 10 }).status, 'applied');
    assert.match(open(k, 'cmd_g5', 'person_tola', 'npc_tobi', {}).reason, /relationship_exists/);
    assert.match(open(k, 'cmd_g6', 'person_tola', 'npc_sunday', { trust: 500, warmth: 50, tension: 10 }).reason, /bad_dimension/);
    assert.match(open(k, 'cmd_g7', 'person_tola', 'npc_sunday', { trust: 'lots', warmth: 50, tension: 10 }).reason, /bad_dimension/);
  });
});

describe('mutation bounds + idempotency', () => {
  it('clamps at 0..100 and repeats are cmd_id-safe', () => {
    const k = world();
    open(k, 'cmd_b1', 'person_tola', 'npc_tobi', {});
    nudge(k, 'cmd_b2', 'person_tola', 'npc_tobi', { dTrust: 9999, dTension: -9999 });
    const r = k.query().rel('person_tola', 'npc_tobi');
    assert.equal(r.dims.trust, 100);
    assert.equal(r.dims.tension, 0);
    const dup = k.dispatch({ cmd_id: 'cmd_b2', type: 'nudge_relationship', actor: 't', params: { a: 'person_tola', b: 'npc_tobi', dTrust: -50 } });
    assert.equal(dup.status, 'duplicate');
    assert.equal(k.query().rel('person_tola', 'npc_tobi').dims.trust, 100);
  });
  it('nudging a missing relationship rejects; empty nudge rejects', () => {
    const k = world();
    assert.match(nudge(k, 'cmd_b3', 'person_tola', 'npc_sunday', { dTrust: 5 }).reason, /no_relationship/);
    assert.match(k.dispatch({ cmd_id: 'cmd_b4', type: 'nudge_relationship', actor: 't', params: { a: 'person_tola', b: 'npc_tobi' } }).reason, /at least one delta/);
  });
});

describe('tags', () => {
  it('add/remove round-trips; bad tags and ops reject; absent-remove is a safe no-op', () => {
    const k = world();
    open(k, 'cmd_t1', 'person_tola', 'npc_tobi', {});
    const tag = (id, op, t = 'housed_me') =>
      k.dispatch({ cmd_id: id, type: 'tag_relationship', actor: 't', params: { a: 'person_tola', b: 'npc_tobi', tag: t, op } });
    assert.equal(tag('cmd_t2', 'add').status, 'applied');
    assert.deepEqual(k.query().tags('person_tola', 'npc_tobi'), ['housed_me']);
    assert.equal(tag('cmd_t3', 'add').status, 'applied'); // idempotent add
    assert.deepEqual(k.query().tags('person_tola', 'npc_tobi'), ['housed_me']);
    assert.equal(tag('cmd_t4', 'remove').status, 'applied');
    assert.deepEqual(k.query().tags('person_tola', 'npc_tobi'), []);
    assert.equal(tag('cmd_t5', 'remove').status, 'applied'); // safe no-op
    assert.match(tag('cmd_t6', 'add', 'Bad Tag!').reason, /bad_tag/);
    assert.match(tag('cmd_t7', 'explode').reason, /bad_op/);
  });
});

describe('stance thresholds + hysteresis (content-driven)', () => {
  it('crossing a threshold moves stance', () => {
    const k = world();
    open(k, 'cmd_s1', 'person_tola', 'npc_tobi', {});
    nudge(k, 'cmd_s2', 'person_tola', 'npc_tobi', { dTension: 75 }); // 10 -> 85
    assert.equal(k.query().stance('person_tola', 'npc_tobi'), 'Burned');
  });
  it('±1 around a boundary does not flicker', () => {
    const k = world();
    open(k, 'cmd_s3', 'person_tola', 'npc_tobi', { trust: 21, warmth: 50, tension: 10 });
    assert.equal(k.query().stance('person_tola', 'npc_tobi'), 'Neutral');
    nudge(k, 'cmd_s4', 'person_tola', 'npc_tobi', { dTrust: -1 }); // 20 -> Frosty
    assert.equal(k.query().stance('person_tola', 'npc_tobi'), 'Frosty');
    nudge(k, 'cmd_s5', 'person_tola', 'npc_tobi', { dTrust: 1 }); // 21, inside relaxed band -> stays
    assert.equal(k.query().stance('person_tola', 'npc_tobi'), 'Frosty');
    nudge(k, 'cmd_s6', 'person_tola', 'npc_tobi', { dTrust: 5 }); // 26 clears band -> Neutral
    assert.equal(k.query().stance('person_tola', 'npc_tobi'), 'Neutral');
  });
  it('thresholds live in content: same code, different rules, different stance', () => {
    assert.equal(validateStanceRules(RULES), null);
    // Unit-level: deriveStance obeys whatever rules object it is given.
    const dims = { trust: 50, warmth: 50, tension: 10 };
    assert.equal(deriveStance(dims, RULES, undefined), 'Neutral');
    const strict = { hysteresis: 0, thresholds: [{ stance: 'Cool', when: { warmth_lte: 90 } }, { stance: 'Neutral', when: {} }] };
    assert.equal(validateStanceRules(strict), null);
    assert.equal(deriveStance(dims, strict, undefined), 'Cool');
  });
  it('repo content/rules/stance.json validates and drives a kernel', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'rules');
    const rules = JSON.parse(readFileSync(join(dir, 'stance.json'), 'utf8'));
    assert.equal(validateStanceRules(rules), null);
    const kernel = createKernel({ seed: 'content-rules' });
    createPeople(kernel);
    createRelationships(kernel, rules);
    seedPeople(kernel, [{ id: 'person_a', display: 'A' }, { id: 'npc_b', display: 'B' }]);
    kernel.dispatch({ cmd_id: 'cmd_c1', type: 'open_relationship', actor: 't', params: { a: 'person_a', b: 'npc_b' } });
    assert.equal(kernel.query().stance('person_a', 'npc_b'), 'Neutral');
  });
});

describe('standing + provenance', () => {
  it('standing derives from the observer record; favour is 0 by contract until M003', () => {
    const k = world();
    assert.equal(k.query().standing('person_tola', 'npc_tobi'), null);
    open(k, 'cmd_p1', 'person_tola', 'npc_tobi', {});
    assert.deepEqual(k.query().standing('person_tola', 'npc_tobi'), { stance: 'Neutral', tags: [], favour: 0 });
  });
  it('every seeded record carries origin_id (default origin_dev)', () => {
    const k = world();
    open(k, 'cmd_p2', 'person_tola', 'npc_sunday', {});
    assert.equal(k.query().rel('person_tola', 'npc_sunday').origin_id, 'origin_dev');
    assert.equal(k.query().person('npc_sunday').origin_id, 'origin_dev');
  });
  it('seedRelationships helper journals stable, replay-safe ids', () => {
    const a = world('same'), b = world('same');
    const defs = [{ a: 'person_tola', b: 'npc_tobi' }, { a: 'npc_tobi', b: 'npc_sunday' }];
    for (const r of [...seedRelationships(a, defs), ...seedRelationships(b, defs)]) {
      assert.equal(r.status, 'applied');
    }
    assert.equal(a.snapshot(), b.snapshot());
  });
});

describe('why-* explainability for relationships', () => {
  it('a nudge is traceable to its command; updatedBy points at the event', () => {
    const k = world();
    open(k, 'cmd_w1', 'person_tola', 'npc_tobi', {});
    const r = nudge(k, 'cmd_w2', 'person_tola', 'npc_tobi', { dTrust: 5 });
    const rel = k.query().rel('person_tola', 'npc_tobi');
    assert.equal(rel.updatedBy, r.produced[0]);
    const chain = k.query().trace(rel.updatedBy);
    assert.equal(chain[chain.length - 1].caused_by, 'cmd_w2');
  });
  it('save/restore preserves people+relationships and continues identically', () => {
    const a = world('save-seed');
    open(a, 'cmd_v1', 'person_tola', 'npc_tobi', {});
    const snap = a.snapshot();
    const c = world('other-seed');
    c.restore(snap);
    assert.equal(c.snapshot(), snap);
    nudge(a, 'cmd_v2', 'person_tola', 'npc_tobi', { dTrust: 5 });
    nudge(c, 'cmd_v2', 'person_tola', 'npc_tobi', { dTrust: 5 });
    assert.equal(c.snapshot(), a.snapshot());
  });
});
