// tests/unit/bridge.test.js — game/bridge parity (M010 Phase 1).
// Proves the browser path (bridge boot + storage adapter) is the SAME world
// as the Node path (tools/world boot + file saves): identical snapshots for
// identical scripts, identical envelopes, identical migrations. The DOM UI
// itself has no test harness here (no browser deps per doctrine) — it is thin
// by construction (rendering + wiring; all logic below is tested), and the
// founder's CP1 review is its UI test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { bootWorld as bootNodeWorld } from '../../tools/world.js';
import { saveSlot, loadSlot } from '../../sim/save/index.js';
import { bootWorld, applyScenario } from '../../game/bridge/world-client.js';
import { createAdapter, SCHEMA_VERSION } from '../../game/bridge/save-adapter.js';
import { sha256Hex } from '../../game/bridge/sha256.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Minimal Web Storage shape: getItem/setItem/removeItem/key/length.
function memoryStorage() {
  const m = new Map();
  return {
    _map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(String(k), String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

function readContent() {
  const get = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
  return {
    places: get('content/places/places.json'),
    routinesDoc: get('content/people/routines.json'),
    worldRules: get('content/rules/world.json'),
    storylets: get('content/story/slice.json'),
    director: get('content/rules/director.json'),
    chatter: get('content/rules/chatter.json'),
    chatTemplates: get('content/strings/chat.json'),
    kinds: get('content/obligations/kinds.json'),
    stance: get('content/rules/stance.json'),
    memoryRules: get('content/rules/memory.json'),
    disclosure: get('content/rules/disclosure.json'),
    promiseTemplates: get('content/obligations/promise-templates.json'),
    outcomeMapping: get('content/rules/obligation-outcomes.json'),
  };
}

function scriptedBridge(seed = 'bridge-seed') {
  const { kernel } = bootWorld({ seed, content: readContent() });
  const sc = JSON.parse(readFileSync(join(ROOT, 'tests/scenario/proof-m009.json'), 'utf8'));
  const results = applyScenario(kernel, sc.steps.slice(0, 17)); // through levy funding
  assert.ok(results.every((r) => r.status === 'applied'), JSON.stringify(results.filter((r) => r.status !== 'applied')));
  return kernel;
}

describe('bridge hash parity: identical digests to Node crypto', () => {
  it('vectors incl. unicode, long inputs, and a real snapshot', () => {
    const ref = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
    for (const v of ['', 'abc', 'UP NEPA! Ẹ káàbọ̀ 🎉', 'x'.repeat(100000)]) {
      assert.equal(sha256Hex(v), ref(v));
    }
    const { kernel } = bootNodeWorld('hash-seed');
    assert.equal(sha256Hex(kernel.snapshot()), ref(kernel.snapshot()));
  });
});

describe('adapter parity: same protocol as the file layer', () => {
  it('save -> load -> restore -> continue equals the file path exactly', (t) => {
    const kernel = scriptedBridge();
    const before = kernel.snapshot();
    // File path.
    const dir = mkdtempSync(join(tmpdir(), 'agent9ja-bridge-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    saveSlot(dir, 's', before);
    const viaFile = loadSlot(dir, 's');
    // Adapter path, same snapshot.
    const storage = memoryStorage();
    const adapter = createAdapter(storage);
    adapter.save('s', before);
    const viaAdapter = adapter.load('s');
    assert.equal(viaAdapter.snapshot, viaFile.snapshot);
    assert.equal(viaAdapter.migratedFrom, viaFile.migratedFrom);
    assert.equal(JSON.parse(viaAdapter.snapshot).v, SCHEMA_VERSION);
    // Envelope bytes identical (schema/content/sha256); only the medium differs.
    const fileEnv = JSON.parse(readFileSync(viaFile.source, 'utf8'));
    const adapterEnv = JSON.parse(storage.getItem('s.json'));
    assert.deepEqual(
      { schema: adapterEnv.schema, content: adapterEnv.content, sha256: adapterEnv.sha256 },
      { schema: fileEnv.schema, content: fileEnv.content, sha256: fileEnv.sha256 },
    );
    assert.equal(adapter.slots().join(','), 's');
    // Both restore into continued twins with identical results.
    const f1 = bootWorld({ seed: 'c1', content: readContent() }).kernel;
    const f2 = bootWorld({ seed: 'c2', content: readContent() }).kernel;
    f1.restore(viaFile.snapshot);
    f2.restore(viaAdapter.snapshot);
    for (const k of [f1, f2]) {
      assert.equal(k.dispatch({ cmd_id: 'cmd_cont1', type: 'advance_time', actor: 't', params: { steps: 10 } }).status, 'applied');
    }
    assert.equal(f1.snapshot(), f2.snapshot());
  });

  it('rotation fallback: garbage live falls back to bak1; bad slots rejected', () => {
    const kernel = scriptedBridge('rot-seed');
    const storage = memoryStorage();
    const adapter = createAdapter(storage);
    adapter.save('s', kernel.snapshot());
    adapter.save('s', kernel.snapshot()); // rotate: bak1 now valid
    storage.setItem('s.json', '{garbage!!!');
    const loaded = adapter.load('s');
    assert.ok(loaded.source.endsWith('.bak1'), `fell back to ${loaded.source}`);
    assert.throws(() => adapter.save('../evil', kernel.snapshot()), /bad_slot/);
    assert.throws(() => adapter.load(''), /bad_slot/);
    adapter.remove('s');
    assert.deepEqual(adapter.slots(), []);
    assert.throws(() => adapter.load('s'), /no_valid_save/);
  });

  it('migration parity: genuine pre-M008 fixture loads through the adapter', () => {
    const text = readFileSync(join(ROOT, 'tests/save/fixtures/pre-m008-save.json'), 'utf8');
    const storage = memoryStorage();
    const adapter = createAdapter(storage);
    storage.setItem('old.json', text);
    const loaded = adapter.load('old');
    assert.equal(loaded.migratedFrom, 1, 'v1 save travels the full v1->v2->v3 chain');
    const snap = JSON.parse(loaded.snapshot);
    assert.equal(snap.v, SCHEMA_VERSION);
    assert.deepEqual(snap.stores.comms, { messages: {}, groups: {}, dmThreads: {} });
    assert.ok(snap.stores.world && snap.stores.world.resources, 'world store injected');
    const { kernel: fresh } = bootWorld({ seed: 'adapter-old', content: readContent() });
    fresh.restore(loaded.snapshot);
    assert.equal(fresh.query().balance('person_tola'), 800000 - 30000, 'M007 money intact');
    assert.equal(fresh.query().where_is('person_tola'), null, 'migrated persons start unplaced');
  });
});

describe('boot parity: bridge boot equals Node boot for identical scripts', () => {
  it('same seed + same scenario steps = identical snapshots', () => {
    const sc = JSON.parse(readFileSync(join(ROOT, 'tests/scenario/proof-m009.json'), 'utf8'));
    const runBridge = () => {
      const { kernel } = bootWorld({ seed: 'parity-seed', content: readContent() });
      const results = applyScenario(kernel, sc.steps);
      assert.ok(results.every((r) => r.status === 'applied'), 'scenario applies cleanly');
      return kernel.snapshot();
    };
    // applyScenario advances use deterministic cmd_ids: same script twice.
    const a = runBridge();
    const b = runBridge();
    assert.equal(a, b);
    // And the Node boot path agrees on the scripted prefix.
    const { kernel: n } = bootNodeWorld('parity-node');
    const d = (id, type, params) => {
      const r = n.dispatch({ cmd_id: id, type, actor: 't', params });
      assert.equal(r.status, 'applied', `${id}: ${r.reason || 'ok'}`);
    };
    d('cmd_p1', 'register_person', { id: 'person_tola', display: 'Tola' });
    const { kernel: br } = bootWorld({ seed: 'parity-node', content: readContent() });
    br.dispatch({ cmd_id: 'cmd_p1', type: 'register_person', actor: 't', params: { id: 'person_tola', display: 'Tola' } });
    assert.equal(br.snapshot(), n.snapshot(), 'bridge and Node boots are the same world');
  });

  it('scenario results report rejections honestly', () => {
    const { kernel } = bootWorld({ seed: 'honest-seed', content: readContent() });
    const results = applyScenario(kernel, [
      { send: { cmd_id: 'cmd_h1', type: 'move_person', actor: 't', params: { person: 'npc_ghost', place: 'market' } } },
      { bogus: true },
    ]);
    assert.equal(results[0].status, 'rejected');
    assert.match(results[0].reason, /unknown_person/);
    assert.equal(results[1].status, 'rejected');
  });
});
