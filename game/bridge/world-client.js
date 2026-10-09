// game/bridge/world-client.js — browser boot for the debug client. Owner: game/bridge.
// The single legal sim crossing: everything sim-side is imported here, never
// in game/debug. Mirrors tools/world.js wiring exactly (same modules, same
// order, same content documents) so browser boot and Node boot produce
// identical worlds — proven by parity tests, not claimed. Content arrives as
// plain data (fetched JSON in the browser, fs reads in Node tests); this
// module never touches the network or the filesystem itself.
import { createKernel } from '../../sim/kernel/pipeline.js';
import { createPeople } from '../../sim/people/index.js';
import { createRelationships, registerObligationConsequences } from '../../sim/relationships/index.js';
import { createEconomy } from '../../sim/economy/index.js';
import { createObligations } from '../../sim/obligations/index.js';
import { createKnowledge } from '../../sim/knowledge/index.js';
import { createVerbs } from '../../sim/verbs/index.js';
import { createMemory } from '../../sim/memory/index.js';
import { createStory } from '../../sim/story/index.js';
import { createComms } from '../../sim/comms/index.js';
import { createWorld } from '../../sim/world/index.js';

export function bootWorld({ seed = 'dev-seed', content = {} } = {}) {
  const kernel = createKernel({ seed });
  const people = createPeople(kernel);
  createRelationships(kernel, content.stance ?? { hysteresis: 5, thresholds: [{ stance: 'Neutral', when: {} }] });
  createEconomy(kernel);
  const memory = createMemory(kernel, content.memoryRules ?? []);
  createObligations(kernel,
    content.kinds ?? { Debt: {}, PromisedAction: {} },
    { memoryReads: memory.reads });
  const knowledge = createKnowledge(kernel, { disclosure: content.disclosure ?? [] });
  createStory(kernel, {
    storylets: content.storylets ?? [],
    director: content.director ?? null,
  });
  createComms(kernel, {
    knowledge,
    chatter: content.chatter ?? [],
    templates: (content.chatTemplates ?? []).map((t) => t.id),
  });
  createWorld(kernel, {
    places: content.places ?? { places: [], travel_min: [] },
    routines: content.routinesDoc?.routines ?? [],
    rules: content.worldRules ?? {},
  });
  createVerbs(kernel, {
    templates: content.promiseTemplates ?? [],
    knowledge,
    peopleReads: people.reads,
    kinds: content.kinds ?? { Debt: {}, PromisedAction: {} },
    memoryReads: memory.reads,
  });
  try {
    registerObligationConsequences(kernel, content.outcomeMapping ?? []);
  } catch (e) {
    console.error(`warn: outcome mapping skipped (${e.message})`);
  }
  return { kernel };
}

// Presents scenario load outcomes honestly: all-duplicate reloads are NOT
// successes, partial failures are NOT masked. Pure presentation logic,
// tested in tests/unit/bridge.test.js.
export function scenarioLoadSummary(results) {
  const applied = results.filter((r) => r.status === 'applied').length;
  const dup = results.filter((r) => r.status === 'duplicate').length;
  const bad = results.length - applied - dup;
  return { applied, duplicates: dup, rejected: bad, allDuplicate: results.length > 0 && applied === 0 && bad === 0 };
}

// Derives form defaults from a scenario definition (ids actually opened),
// never hardcoded. Absent steps simply contribute nothing.
export function scenarioFormDefaults(steps) {
  const out = {};
  for (const s of steps) {
    if (s.send?.type === 'trigger_fault') { out.fault = s.send.params.fault_id; out.faultPlace = s.send.params.place; }
    if (s.send?.type === 'open_levy') {
      out.levy = s.send.params.levy_id; out.convenor = s.send.params.convenor;
      out.collector = s.send.params.collector; out.perHead = s.send.params.per_head;
      out.dueInMin = s.send.params.due_in_min; out.cause = s.send.params.cause;
    }
  }
  return out;
}

// Human-readable title from a stable id. Presentation only: splits words,
// adds no narrative (full situation writing is Phase 2 slice content).
export function humanizeId(id) {
  return String(id).split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

// Applies scenario steps ({send:{cmd_id,type,actor,params}} | {advance:n}).
// Pure logic shared by the debug UI and Node tests. Advance cmd_ids derive
// deterministically from a counter so replays are identical.
export function applyScenario(kernel, steps, actorDefault = 't') {
  const results = [];
  let advN = 0;
  for (const s of steps) {
    if (s.send) {
      const r = kernel.dispatch({
        cmd_id: s.send.cmd_id, type: s.send.type,
        actor: s.send.actor ?? actorDefault, params: s.send.params,
      });
      results.push({ cmd_id: s.send.cmd_id, status: r.status, reason: r.reason ?? null });
    } else if (typeof s.advance === 'number') {
      const r = kernel.dispatch({ cmd_id: `scenario_adv_${advN++}_${s.advance}`, type: 'advance_time', actor: actorDefault, params: { steps: s.advance } });
      results.push({ advance: s.advance, status: r.status, reason: r.reason ?? null });
    } else {
      results.push({ status: 'rejected', reason: 'bad_scenario_step' });
    }
  }
  return results;
}
