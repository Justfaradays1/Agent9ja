// tests/unit/story.test.js — minimal seed scheduler (M005 machinery, no consumers yet).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../../sim/kernel/pipeline.js';
import { createStory, SEED_CAP } from '../../sim/story/index.js';
function world(seed = 's-seed') {
  const kernel = createKernel({ seed });
  createStory(kernel);
  return kernel;
}

const sched = (k, id, fire_t, extra = {}) => k.dispatch({
  cmd_id: `cmd_seed_${id}`, type: 'schedule_seed', actor: 't', params: { seed_id: `seed_${id}`, fire_t, ...extra },
});

describe('seed lifecycle', () => {
  it('schedules, fires at the right step in order, rejects the rest', () => {
    const k = world();
    assert.equal(sched(k, 'a1', 600, { memo: 'musa mentions it' }).status, 'applied');
    assert.equal(sched(k, 'a2', 500, { memo: 'earlier' }).status, 'applied');
    // Same seed_id under a FRESH cmd_id: duplicate seed, not duplicate command.
    assert.match(k.dispatch({
      cmd_id: 'cmd_seed_a1b', type: 'schedule_seed', actor: 't',
      params: { seed_id: 'seed_a1', fire_t: 700 },
    }).reason, /duplicate_seed/);
    assert.match(sched(k, 'a3', 100).reason, /seed_in_past/);
    assert.match(k.dispatch({
      cmd_id: 'cmd_seed_bad1', type: 'schedule_seed', actor: 't',
      params: { seed_id: 'bad id!', fire_t: 700 },
    }).reason, /bad seed_id/);
    k.dispatch({ cmd_id: 'cmd_adv1', type: 'advance_time', actor: 't', params: { steps: 4 } }); // +20m → 500
    const fired = k.query().journal(20).filter((e) => e.kind === 'SeedFired');
    assert.equal(fired.length, 1);
    assert.equal(fired[0].data.memo, 'earlier');
    k.dispatch({ cmd_id: 'cmd_adv2', type: 'advance_time', actor: 't', params: { steps: 20 } }); // → 600
    assert.equal(k.query().journal(40).filter((e) => e.kind === 'SeedFired').length, 2);
  });
  it('cancel closes; unknown/closed cancel rejects; cap holds', () => {
    const k = world();
    sched(k, 'c1', 900);
    assert.equal(k.dispatch({ cmd_id: 'cmd_can1', type: 'cancel_seed', actor: 't', params: { seed_id: 'seed_c1' } }).status, 'applied');
    assert.match(k.dispatch({ cmd_id: 'cmd_can2', type: 'cancel_seed', actor: 't', params: { seed_id: 'seed_c1' } }).reason, /already_closed/);
    assert.match(k.dispatch({ cmd_id: 'cmd_can3', type: 'cancel_seed', actor: 't', params: { seed_id: 'seed_nope' } }).reason, /unknown_seed/);
    k.dispatch({ cmd_id: 'cmd_adv3', type: 'advance_time', actor: 't', params: { steps: 100 } });
    assert.equal(k.query().journal(200).filter((e) => e.kind === 'SeedFired').length, 0);
  });
  it('seeds survive restore and fire identically after', () => {
    const run = (restoreMidway) => {
      const k = world('seed-det');
      sched(k, 'd1', 600, { memo: 'x' });
      if (restoreMidway) {
        const snap = k.snapshot();
        const c = world('other');
        c.restore(snap);
        c.dispatch({ cmd_id: 'cmd_advd', type: 'advance_time', actor: 't', params: { steps: 30 } });
        return c.snapshot();
      }
      k.dispatch({ cmd_id: 'cmd_advd', type: 'advance_time', actor: 't', params: { steps: 30 } });
      return k.snapshot();
    };
    assert.equal(run(true), run(false));
  });
  it('cap holds: the 101st active seed rejects', () => {
    const k = world();
    for (let i = 0; i < 100; i++) {
      assert.equal(sched(k, `cap${i}`, 5000 + i).status, 'applied');
    }
    assert.match(sched(k, 'cap100', 9999).reason, /seed_cap_reached/);
    assert.equal(SEED_CAP, 100);
  });
});
