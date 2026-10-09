// tests/unit/query.test.js — trace chains + frozen views (M001 why-* foundation).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../../sim/kernel/pipeline.js';
import { describeQueryContract } from '../../sim/query/index.js';

describe('query contract', () => {
  it('publishes the locked read surface', () => {
    assert.ok(describeQueryContract().join(' ').includes('trace'));
  });
});

describe('trace (caused_by chain back to origin command)', () => {
  it('links reaction event → parent event → originating cmd_id', () => {
    const k = createKernel({ seed: 'q-seed' });
    k.on('FlagSet', () => [{ kind: 'MarkerEmitted', data: { note: 'echo' } }]);
    const r = k.dispatch({ cmd_id: 'cmd_why1', type: 'set_flag', actor: 'tola', params: { key: 'couch', value: '3-nights' } });
    const echoSeq = r.produced[r.produced.length - 1];
    const chain = k.query().trace(echoSeq);
    assert.equal(chain.length, 2);
    assert.equal(chain[0].caused_by, 'cmd_why1'); // FlagSet from command
    assert.equal(chain[1].caused_by, chain[0].seq); // echo from FlagSet
    assert.equal(chain[1].kind, 'MarkerEmitted');
  });
  it('unknown seq traces to empty chain (no crash, no invention)', () => {
    const k = createKernel({ seed: 'q-seed' });
    assert.deepEqual(k.query().trace(9999), []);
  });
});

describe('rejection explains itself (why-not foundation)', () => {
  it('reason is stored on the journal and returned to caller', () => {
    const k = createKernel({ seed: 'q-seed' });
    const r = k.dispatch({ cmd_id: 'cmd_why2', type: 'set_flag', actor: 't', params: { key: '', value: 1 } });
    assert.equal(r.status, 'rejected');
    const logged = k.query().journal(5).find((e) => e.kind === 'CommandRejected');
    assert.equal(logged.data.reason, r.reason);
  });
});
