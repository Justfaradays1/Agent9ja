// M000 trivial test: proves one-command headless run works. No gameplay.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('M000 foundation', () => {
  it('trivial headless pass', () => {
    assert.equal(1 + 1, 2);
  });
  it('causal chain placeholder exists as convention', () => {
    const evt = { kind: 'M000_Boot', caused_by: null };
    assert.equal(evt.caused_by, null);
  });
});
