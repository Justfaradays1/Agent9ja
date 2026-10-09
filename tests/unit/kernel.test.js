// tests/unit/kernel.test.js — ids, clock, RNG streams (M001).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertId, makeId } from '../../sim/kernel/ids.js';
import { createRng } from '../../sim/kernel/rng.js';
import { createClock } from '../../sim/kernel/clock.js';

describe('ids', () => {
  it('accepts stable ids, rejects the rest', () => {
    assert.equal(assertId('npc_tobi'), 'npc_tobi');
    assert.equal(makeId('cmd', 3), 'cmd_3');
    for (const bad of ['', 'Nope', 'npc-tobi', 'npc tobi', 42, null]) {
      assert.throws(() => assertId(bad), /bad_id/);
    }
  });
});

describe('clock', () => {
  it('starts 08:00 Morning day 1, advances in fixed steps', () => {
    const c = createClock({});
    assert.equal(c.minutes, 480);
    assert.equal(c.phase(), 'Morning');
    assert.equal(c.day(), 1);
    c.advance(1);
    assert.equal(c.minutes, 485);
  });
  it('derives phases and day rollover from content boundaries', () => {
    const c = createClock({ startMinutes: 0 });
    assert.equal(c.phase(), 'Night');
    const crossed = c.advance(60); // 300 min -> Morning
    assert.equal(c.phase(), 'Morning');
    assert.ok(crossed.some((x) => x.from === 'Night' && x.to === 'Morning'));
    c.advance(228); // to 1440 -> day 2
    assert.equal(c.day(), 2);
  });
  it('rejects non-positive steps', () => {
    assert.throws(() => createClock({}).advance(0), /bad_steps/);
  });
});

describe('rng streams', () => {
  it('same seed + same calls = same values', () => {
    const a = createRng('s1'), b = createRng('s1');
    assert.deepEqual([a.next('x'), a.int('y', 100)], [b.next('x'), b.int('y', 100)]);
  });
  it('streams are independent: A rolls never reshuffle B', () => {
    const busy = createRng('s1');
    for (let i = 0; i < 50; i++) busy.next('a');
    const fresh = createRng('s1');
    assert.equal(busy.next('b'), fresh.next('b'));
  });
  it('state round-trips and continues identically', () => {
    const a = createRng('s9');
    a.next('k'); a.next('k');
    const snap = a.getState();
    const v1 = a.next('k');
    const b = createRng('other');
    b.setState(snap);
    assert.equal(b.next('k'), v1);
  });
});
