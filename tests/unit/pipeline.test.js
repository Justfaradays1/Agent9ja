// tests/unit/pipeline.test.js — validation, idempotency, ordering, cascade,
// quiesce, determinism, perf, no-hidden-randomness (M001).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKernel, CASCADE_MAX } from '../../sim/kernel/pipeline.js';

const SIM_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'sim');

function fresh(seed = 't-seed') { return createKernel({ seed }); }

describe('validation / rejection (no silent mutation)', () => {
  it('rejects unknown commands and bad params with reason, flags untouched', () => {
    const k = fresh();
    const r1 = k.dispatch({ cmd_id: 'cmd_a1', type: 'fly_away', actor: 't', params: {} });
    assert.equal(r1.status, 'rejected');
    assert.match(r1.reason, /unknown_command/);
    const r2 = k.dispatch({ cmd_id: 'cmd_a2', type: 'set_flag', actor: 't', params: {} });
    assert.equal(r2.status, 'rejected');
    assert.deepEqual(k.query().flags(), {});
    // Rejection itself is journaled (auditable) but mutates nothing else.
    assert.ok(k.query().journal(10).some((e) => e.kind === 'CommandRejected'));
  });
  it('rejects malformed command shape', () => {
    const k = fresh();
    assert.equal(k.dispatch({ type: 'set_flag', params: {} }).status, 'rejected');
    assert.equal(k.dispatch({ cmd_id: 'cmd_x1', type: 'set_flag', actor: 't', params: { key: '' } }).status, 'rejected');
  });
});

describe('idempotency (double-tap safe)', () => {
  it('same cmd_id twice applies once; journal gains no second FlagSet', () => {
    const k = fresh();
    const cmd = { cmd_id: 'cmd_idem1', type: 'set_flag', actor: 't', params: { key: 'a', value: 1 } };
    const r1 = k.dispatch(cmd);
    const r2 = k.dispatch({ ...cmd, params: { key: 'a', value: 999 } });
    assert.equal(r1.status, 'applied');
    assert.equal(r2.status, 'duplicate');
    assert.equal(r2.firstSeq, r1.firstSeq);
    assert.equal(k.query().flags().a, 1);
    assert.equal(k.query().journal(50).filter((e) => e.kind === 'FlagSet').length, 1);
  });
});

describe('same-step ordering (FIFO + stable seq)', () => {
  it('reactions fire in registration order; children queue behind siblings', () => {
    const k = fresh();
    const order = [];
    const onlyRoot = (label, note) => (ev) => {
      if (ev.data.note !== 'root') return [];
      order.push(label);
      return [{ kind: 'MarkerEmitted', data: { note } }];
    };
    k.on('MarkerEmitted', onlyRoot('first', 'child-1'));
    k.on('MarkerEmitted', onlyRoot('second', 'child-2'));
    k.dispatch({ cmd_id: 'cmd_ord1', type: 'emit_marker', actor: 't', params: { note: 'root' } });
    // Root's two reactions run in registration order; children queue FIFO behind.
    assert.deepEqual(order, ['first', 'second']);
    const notes = k.query().journal(50).filter((e) => e.kind === 'MarkerEmitted').map((e) => e.data.note);
    assert.deepEqual(notes, ['root', 'child-1', 'child-2']);
    const seqs = k.query().journal(50).map((e) => e.seq);
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b));
  });
});

describe('cascade guard (loops cannot hang the sim)', () => {
  it(`self-triggering rule trips CascadeGuardTripped at depth ${CASCADE_MAX}`, () => {
    const k = fresh();
    k.on('MarkerEmitted', () => [{ kind: 'MarkerEmitted', data: { note: 'loop' } }]);
    k.dispatch({ cmd_id: 'cmd_loop1', type: 'emit_marker', actor: 't', params: { note: 'start' } });
    const kinds = k.query().journal(200).map((e) => e.kind);
    assert.ok(kinds.includes('CascadeGuardTripped'), 'guard event must be journaled');
    assert.ok(kinds.filter((e) => e === 'MarkerEmitted').length <= CASCADE_MAX + 2, 'branch halted at guard');
  });
});

describe('quiesce (snapshots only at step boundaries)', () => {
  it('snapshot inside a reaction throws NotQuiesced; outside works', () => {
    const k = fresh();
    let threw = null;
    k.on('MarkerEmitted', (ev, ctx) => {
      try { ctx.snapshot(); } catch (e) { threw = e; }
      return [];
    });
    k.dispatch({ cmd_id: 'cmd_q1', type: 'emit_marker', actor: 't', params: { note: 'x' } });
    assert.match(String(threw && threw.message), /NotQuiesced/);
    assert.doesNotThrow(() => k.snapshot());
  });
  it('reentrant dispatch throws instead of corrupting the step', () => {
    const k = fresh();
    k.on('MarkerEmitted', () => {
      k.dispatch({ cmd_id: 'cmd_nested', type: 'emit_marker', actor: 't', params: { note: 'nested' } });
      return [];
    });
    assert.throws(() => k.dispatch({ cmd_id: 'cmd_q2', type: 'emit_marker', actor: 't', params: { note: 'outer' } }), /ReentrantDispatch/);
  });
});

describe('determinism (same seed + same commands = identical snapshot)', () => {
  function script(k) {
    k.dispatch({ cmd_id: 'cmd_d1', type: 'set_flag', actor: 't', params: { key: 'room', value: 'couch' } });
    k.dispatch({ cmd_id: 'cmd_d2', type: 'emit_marker', actor: 't', params: { note: 'met musa' } });
    k.dispatch({ cmd_id: 'cmd_d3', type: 'advance_time', actor: 't', params: { steps: 12 } });
    k.dispatch({ cmd_id: 'cmd_d4', type: 'set_flag', actor: 't', params: { key: 'naira', value: 8000 } });
  }
  it('two fresh kernels replay byte-identical', () => {
    const a = fresh('replay-seed'), b = fresh('replay-seed');
    script(a); script(b);
    assert.equal(a.snapshot(), b.snapshot());
  });
  it('restore-then-continue equals uninterrupted run', () => {
    const a = fresh('replay-seed'); script(a);
    const snap = a.snapshot();
    const c = fresh('other-seed'); c.restore(snap);
    c.dispatch({ cmd_id: 'cmd_d5', type: 'advance_time', actor: 't', params: { steps: 3 } });
    const d = fresh('replay-seed'); script(d);
    d.dispatch({ cmd_id: 'cmd_d5', type: 'advance_time', actor: 't', params: { steps: 3 } });
    assert.equal(c.snapshot(), d.snapshot());
  });
});

describe('unauthorized paths stay shut', () => {
  it('query views are frozen (UI cannot cache-and-mutate)', () => {
    const k = fresh();
    k.dispatch({ cmd_id: 'cmd_f1', type: 'set_flag', actor: 't', params: { key: 'a', value: 1 } });
    assert.throws(() => { k.query().flags().a = 2; }, TypeError);
    assert.throws(() => { k.query().journal(1).push({ fake: true }); }, TypeError);
    assert.equal(k.query().flags().a, 1);
  });
  it('sim/ uses no wall-clock or unseeded randomness (headless determinism)', () => {
    const hits = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith('.js')) {
          const src = readFileSync(p, 'utf8');
          for (const pat of ['Math.random', 'Date.now', 'performance.now']) {
            if (src.includes(pat)) hits.push(`${p}: ${pat}`);
          }
        }
      }
    };
    walk(SIM_DIR);
    assert.deepEqual(hits, []);
  });
});

describe('perf budget (7 simulated days headless)', () => {
  it('2016 steps complete well under budget', () => {
    const k = fresh('perf-seed');
    const t0 = Date.now();
    k.dispatch({ cmd_id: 'cmd_p1', type: 'advance_time', actor: 't', params: { steps: 2016 } });
    const ms = Date.now() - t0;
    assert.ok(ms < 2000, `7 days took ${ms}ms, budget 2000ms`);
  });
});
