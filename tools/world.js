// tools/world.js — single full-stack boot for dev tools (M004).
// scenario-runner and sim-console share this so "the world" means one thing.
// Reads repo content with documented fallbacks; warns, never crashes.
import { readFileSync } from 'node:fs';
import { createKernel } from '../sim/kernel/pipeline.js';
import { createPeople } from '../sim/people/index.js';
import { createRelationships, registerObligationConsequences } from '../sim/relationships/index.js';
import { createEconomy } from '../sim/economy/index.js';
import { createObligations } from '../sim/obligations/index.js';
import { createKnowledge } from '../sim/knowledge/index.js';
import { createVerbs } from '../sim/verbs/index.js';
import { createMemory } from '../sim/memory/index.js';
import { createStory } from '../sim/story/index.js';
import { createComms } from '../sim/comms/index.js';

function readJson(url, label, fallback) {
  try {
    return JSON.parse(readFileSync(new URL(url, import.meta.url), 'utf8'));
  } catch (e) {
    console.error(`warn: ${label} unavailable (${e.message}), using fallback`);
    return fallback;
  }
}

export function bootWorld(seed) {
  const kernel = createKernel({ seed });
  const people = createPeople(kernel);
  createRelationships(kernel, readJson('../content/rules/stance.json', 'stance rules', { hysteresis: 5, thresholds: [{ stance: 'Neutral', when: {} }] }));
  createEconomy(kernel);
  const memory = createMemory(kernel,
    readJson('../content/rules/memory.json', 'memory rules', []));
  createObligations(kernel,
    readJson('../content/obligations/kinds.json', 'obligation kinds', { Debt: {}, PromisedAction: {} }),
    { memoryReads: memory.reads });
  const knowledge = createKnowledge(kernel, {
    disclosure: readJson('../content/rules/disclosure.json', 'disclosure rules', []),
  });
  createStory(kernel, {
    storylets: readJson('../content/story/slice.json', 'storylets', []),
    director: readJson('../content/rules/director.json', 'director rules', null),
  });
  createComms(kernel, {
    knowledge,
    chatter: readJson('../content/rules/chatter.json', 'chatter rules', []),
    templates: readJson('../content/strings/chat.json', 'chat templates', []).map((t) => t.id),
  });
  createVerbs(kernel, {
    templates: readJson('../content/obligations/promise-templates.json', 'promise templates', []),
    knowledge,
    peopleReads: people.reads,
    kinds: readJson('../content/obligations/kinds.json', 'obligation kinds', { Debt: {}, PromisedAction: {} }),
    memoryReads: memory.reads,
  });
  try {
    registerObligationConsequences(kernel, readJson('../content/rules/obligation-outcomes.json', 'outcome mapping', []));
  } catch (e) {
    console.error(`warn: outcome mapping skipped (${e.message})`);
  }
  return { kernel, knowledge };
}
