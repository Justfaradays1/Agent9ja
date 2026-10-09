// tests/unit/doctrine.test.js — workload bounds + graceful failure (doctrine §1/§2/§9).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel, COMMAND_EVENT_BUDGET } from '../../sim/kernel/pipeline.js';

describe('per-command event budget', () => {
  it('fan-out trips BudgetGuardTripped with evidence; dispatch still completes', () => {
    const k = createKernel({ seed: 'budget-seed' });
    k.on('MarkerEmitted', (ev) => {
      if (ev.data.note !== 'root') return [];
      return Array.from({ length: 300 }, (_, i) => ({ kind: 'MarkerEmitted', data: { note: `fan-${i}` } }));
    });
    const r = k.dispatch({ cmd_id: 'cmd_bg1', type: 'emit_marker', actor: 't', params: { note: 'root' } });
    assert.equal(r.status, 'applied');
    const kinds = k.query().journal(600).map((e) => e.kind);
    assert.ok(kinds.includes('BudgetGuardTripped'), 'budget trip must be journaled');
    const trip = k.query().journal(600).find((e) => e.kind === 'BudgetGuardTripped');
    assert.equal(trip.data.budget, COMMAND_EVENT_BUDGET);
    assert.ok(k.query().journal(100000).length <= 501, 'journal stays bounded');
  });
  it('budget trips are deterministic', () => {
    const run = () => {
      const k = createKernel({ seed: 'budget-seed' });
      k.on('MarkerEmitted', (ev) => {
        if (ev.data.note !== 'root') return [];
        return Array.from({ length: 300 }, (_, i) => ({ kind: 'MarkerEmitted', data: { note: `fan-${i}` } }));
      });
      k.dispatch({ cmd_id: 'cmd_bg1', type: 'emit_marker', actor: 't', params: { note: 'root' } });
      return k.snapshot();
    };
    assert.equal(run(), run());
  });
});

describe('reaction isolation (fail one, preserve the rest)', () => {
  it('throwing reaction journals ReactionFailed; healthy reactions still run', () => {
    const k = createKernel({ seed: 'iso-seed' });
    k.on('MarkerEmitted', (ev) => {
      if (ev.data.note !== 'root') return [];
      throw new Error('npc blew up');
    });
    k.on('MarkerEmitted', (ev) => {
      if (ev.data.note !== 'root') return [];
      return [{ kind: 'MarkerEmitted', data: { note: 'healthy-child' } }];
    });
    const r = k.dispatch({ cmd_id: 'cmd_iso1', type: 'emit_marker', actor: 't', params: { note: 'root' } });
    assert.equal(r.status, 'applied');
    const journal = k.query().journal(50);
    const failed = journal.find((e) => e.kind === 'ReactionFailed');
    assert.ok(failed, 'failure must be reported, not hidden');
    assert.match(failed.data.error, /npc blew up/);
    assert.ok(journal.some((e) => e.kind === 'MarkerEmitted' && e.data.note === 'healthy-child'));
  });
  it('isolation is deterministic', () => {
    const run = () => {
      const k = createKernel({ seed: 'iso-seed' });
      k.on('MarkerEmitted', (ev) => {
        if (ev.data.note !== 'root') return [];
        throw new Error('npc blew up');
      });
      k.dispatch({ cmd_id: 'cmd_iso1', type: 'emit_marker', actor: 't', params: { note: 'root' } });
      return k.snapshot();
    };
    assert.equal(run(), run());
  });
  it('fatal invariant violations still throw loud (never swallowed)', () => {
    const k = createKernel({ seed: 'fatal-seed' });
    k.on('MarkerEmitted', () => {
      k.dispatch({ cmd_id: 'cmd_nest', type: 'emit_marker', actor: 't', params: { note: 'nested' } });
      return [];
    });
    let err = null;
    try {
      k.dispatch({ cmd_id: 'cmd_f1', type: 'emit_marker', actor: 't', params: { note: 'outer' } });
    } catch (e) { err = e; }
    assert.ok(err, 'must throw');
    assert.match(String(err.message), /ReentrantDispatch/);
    assert.equal(err.fatal, true);
  });
});

describe('bounded reads', () => {
  it('journal(limit) clamps instead of dumping unbounded history', () => {
    const k = createKernel({ seed: 'clamp-seed' });
    k.dispatch({ cmd_id: 'cmd_c1', type: 'advance_time', actor: 't', params: { steps: 600 } });
    assert.ok(k.query().journal(99999).length <= 500);
    assert.equal(k.query().journal(0).length, 0);
  });
});
