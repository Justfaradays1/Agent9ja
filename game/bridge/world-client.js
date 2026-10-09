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
