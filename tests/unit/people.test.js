// tests/unit/people.test.js — deterministic person seeding, ids, provenance (M002).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKernel } from '../../sim/kernel/pipeline.js';
import { createPeople, seedPeople, validatePersonDef } from '../../sim/people/index.js';

const stanceRules = { hysteresis: 5, thresholds: [{ stance: 'Neutral', when: {} }] };

function world(seed = 'p-seed') {
  const kernel = createKernel({ seed });
  createPeople(kernel);
  return kernel;
}

describe('person validation', () => {
  it('accepts minimal defs, defaults origin_dev', () => {
    assert.equal(validatePersonDef({ id: 'npc_tobi', display: 'Tobi' }), null);
    const k = world();
    const r = k.dispatch({ cmd_id: 'cmd_pv1', type: 'register_person', actor: 't', params: { id: 'npc_tobi', display: 'Tobi' } });
    assert.equal(r.status, 'applied');
    assert.equal(k.query().person('npc_tobi').origin_id, 'origin_dev');
  });
  it('rejects bad ids, blank display, bad origin', () => {
    for (const def of [
      { id: 'nope', display: 'X' },
      { id: 'npc_x', display: '' },
      { id: 'npc_x', display: 'X', origin_id: 'bogus!!' },
      null,
    ]) {
      assert.notEqual(validatePersonDef(def), null);
    }
  });
});

describe('seeding through the pipeline', () => {
  it('duplicate registration rejects safely, state untouched', () => {
    const k = world();
    seedPeople(k, [{ id: 'npc_tobi', display: 'Tobi' }]);
    const r = k.dispatch({ cmd_id: 'cmd_pv2', type: 'register_person', actor: 't', params: { id: 'npc_tobi', display: 'Tobi Again' } });
    assert.equal(r.status, 'rejected');
    assert.match(r.reason, /duplicate_person/);
    assert.equal(k.query().person('npc_tobi').display, 'Tobi');
  });
  it('seeding is deterministic across kernels', () => {
    const a = world('same'), b = world('same');
    const defs = [{ id: 'npc_a', display: 'A' }, { id: 'npc_b', display: 'B' }];
    seedPeople(a, defs); seedPeople(b, defs);
    assert.equal(a.snapshot(), b.snapshot());
  });
  it('content npcs.json loads, validates, seeds cleanly', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'people');
    const defs = JSON.parse(readFileSync(join(dir, 'npcs.json'), 'utf8'));
    assert.equal(defs.length, 6);
    for (const d of defs) assert.equal(validatePersonDef(d), null);
    const k = world();
    for (const r of seedPeople(k, defs)) assert.equal(r.status, 'applied');
    assert.equal(k.query().people().length, 6);
  });
  it('views are frozen and unknown ids return null', () => {
    const k = world();
    assert.equal(k.query().person('npc_ghost'), null);
    assert.throws(() => { k.query().people().push({}); }, TypeError);
  });
});
