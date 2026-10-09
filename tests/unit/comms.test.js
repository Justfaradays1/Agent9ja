// tests/unit/comms.test.js — messages, compound group, drafts, book, rumour,
// notifications (M008). Player Eve is never required: all social surfaces work
// NPC-to-NPC and stay readable without replying (AGENTS.md §15, H-R1).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKernel } from '../../sim/kernel/pipeline.js';
import { createPeople, seedPeople } from '../../sim/people/index.js';
import { createRelationships } from '../../sim/relationships/index.js';
import { createEconomy, seedAccounts } from '../../sim/economy/index.js';
import { createObligations } from '../../sim/obligations/index.js';
import { createKnowledge, seedFacts, seedBeliefs } from '../../sim/knowledge/index.js';
import { createMemory } from '../../sim/memory/index.js';
import { createVerbs } from '../../sim/verbs/index.js';
import { createStory } from '../../sim/story/index.js';
import { createComms, validateChatterRules } from '../../sim/comms/index.js';

const STANCE = { hysteresis: 5, thresholds: [{ stance: 'Neutral', when: {} }] };
const KINDS = { Debt: {}, PromisedAction: {}, Favour: {}, Vouch: {} };
const TEMPLATES = [
  { id: 'repay_friday', kind: 'Debt', amount: 50000, due_in_min: 4320, grace_min: 1440 },
  { id: 'return_item', kind: 'PromisedAction', subject: 'Return what was borrowed', due_in_min: 1440, grace_min: 720 },
];
const CHAT_TEMPLATES = ['tell_fact', 'request_help', 'promise_repay', 'greet', 'debt_broke'];
const CHATTER = [
  { on_event: 'ObligationBroken', template: 'debt_broke', speaker: 'npc_musa', params: {} },
  {
    on_event: 'ObligationBroken', template: 'debt_broke', speaker: 'npc_seyi', params: {},
    claim: { fact: 'fact_debt_news', asserted: 'somebody no pay wetin dem owe', origin_id: 'origin_compound' },
  },
];

function world(seed = 'comms-seed', chatter = CHATTER) {
  const kernel = createKernel({ seed });
  const people = createPeople(kernel);
  createRelationships(kernel, STANCE);
  createEconomy(kernel);
  const memory = createMemory(kernel, []);
  createObligations(kernel, KINDS, { memoryReads: memory.reads });
  const knowledge = createKnowledge(kernel, { disclosure: [] });
  createStory(kernel, { storylets: [], director: null });
  createVerbs(kernel, { templates: TEMPLATES, knowledge, peopleReads: people.reads, kinds: KINDS, memoryReads: memory.reads });
  createComms(kernel, { knowledge, chatter, templates: CHAT_TEMPLATES });
  seedPeople(kernel, [
    { id: 'person_tola', display: 'Tola' },
    { id: 'npc_seyi', display: 'Seyi' },
    { id: 'npc_musa', display: 'Musa' },
  ]);
  seedAccounts(kernel, [
    { person: 'person_tola', opening: 800000 },
    { person: 'npc_sunday', opening: 0 },
  ]);
  return kernel;
}

function openCompound(k, id = 'cmd_grp1', members = ['person_tola', 'npc_seyi', 'npc_musa']) {
  const r = k.dispatch({ cmd_id: id, type: 'open_group', actor: 't', params: { group_id: 'group_compound', members } });
  assert.equal(r.status, 'applied', r.reason || 'ok');
  return r;
}

function breakDebt(k, id, stale = 0) {
  // Each broken debt needs its own obligation: create, then advance past due.
  // `stale` offsets due_in_min so multiple breaks can share one advance.
  k.dispatch({
    cmd_id: `cmd_mk_${id}`, type: 'create_obligation', actor: 't',
    params: { obligation_id: `obl_${id}`, kind: 'Debt', owes: 'person_tola', owed: 'npc_seyi', amount: 100, due_in_min: 5 + stale },
  });
}

describe('compound group: open, witness, bounds', () => {
  it('opens once; rejects dups, strangers, empty/dup members', () => {
    const k = world();
    assert.match(k.dispatch({ cmd_id: 'cmd_g1', type: 'open_group', actor: 't', params: { group_id: 'group_compound', members: [] } }).reason, /non-empty/);
    assert.match(k.dispatch({ cmd_id: 'cmd_g2', type: 'open_group', actor: 't', params: { group_id: 'group_compound', members: ['person_tola', 'npc_ghost'] } }).reason, /unknown_person/);
    assert.match(k.dispatch({ cmd_id: 'cmd_g3', type: 'open_group', actor: 't', params: { group_id: 'group_compound', members: ['person_tola', 'person_tola'] } }).reason, /duplicate_member/);
    openCompound(k);
    assert.match(k.dispatch({ cmd_id: 'cmd_g4', type: 'open_group', actor: 't', params: { group_id: 'group_compound', members: ['person_tola'] } }).reason, /duplicate_group/);
    assert.match(k.dispatch({ cmd_id: 'cmd_g5', type: 'group_add', actor: 't', params: { group_id: 'group_compound', person: 'npc_musa' } }).reason, /already_member/);
    assert.match(k.dispatch({ cmd_id: 'cmd_g6', type: 'group_add', actor: 't', params: { group_id: 'group_nope', person: 'npc_musa' } }).reason, /unknown_group/);
  });

  it('world event produces witnessed chatter for every member', () => {
    const k = world();
    openCompound(k);
    breakDebt(k, 'w1');
    k.dispatch({ cmd_id: 'cmd_adv1', type: 'advance_time', actor: 't', params: { steps: 10 } });
    const chats = k.query().chats();
    assert.equal(chats.groups.length, 1);
    // Two chatter rules fire on the single break: plain note + gossip claim.
    assert.equal(chats.groups[0].messages.length, 2);
    for (const m of chats.groups[0].messages) {
      assert.deepEqual([...m.witnesses].sort(), ['npc_musa', 'npc_seyi', 'person_tola']);
    }
  });

  it('unknown event kinds fail closed: no chatter, no crash', () => {
    const k = world();
    openCompound(k);
    k.dispatch({ cmd_id: 'cmd_advx', type: 'advance_time', actor: 't', params: { steps: 5 } });
    assert.equal(k.query().chats().groups[0].messages.length, 0);
  });

  it('match filters fire only on matching event data', () => {
    const k = world('match-seed', [
      { on_event: 'ObligationBroken', template: 'debt_broke', speaker: 'npc_musa', params: {}, match: { kind: 'Debt' } },
    ]);
    openCompound(k);
    breakDebt(k, 'mm1');
    k.dispatch({ cmd_id: 'cmd_advm', type: 'advance_time', actor: 't', params: { steps: 10 } });
    assert.equal(k.query().chats().groups[0].messages.length, 1, 'Debt break matches kind Debt');
  });

  it('match rejects non-matching data and validates shape', () => {
    assert.match(validateChatterRules([{ on_event: 'X', template: 'tell_fact', match: [1] }], ['tell_fact']), /match must be a plain object/);
    assert.match(validateChatterRules([{ on_event: 'X', template: 'tell_fact', match: { a: {} } }], ['tell_fact']), /must be a JSON scalar/);
    const k = world('match2-seed', [
      { on_event: 'ObligationBroken', template: 'debt_broke', speaker: 'npc_musa', params: {}, match: { kind: 'Favour' } },
    ]);
    openCompound(k);
    breakDebt(k, 'mm2');
    k.dispatch({ cmd_id: 'cmd_advm2', type: 'advance_time', actor: 't', params: { steps: 10 } });
    assert.equal(k.query().chats().groups[0].messages.length, 0, 'Debt break does not match kind Favour');
  });
});

describe('DMs: tell, request, drafts', () => {
  it('dm_tell records a provenanced claim; needs a real belief', () => {
    const k = world();
    seedFacts(k, [{ fact_id: 'fact_true_rent', value: 450000, tags: ['money'] }]);
    seedBeliefs(k, [{ person: 'npc_seyi', fact: 'fact_true_rent', value: 450000, certainty: 'sure', source: 'saw' }]);
    assert.match(k.dispatch({
      cmd_id: 'cmd_dt0', type: 'dm_tell', actor: 't',
      params: { from: 'npc_musa', to: 'person_tola', fact: 'fact_true_rent' },
    }).reason, /no_belief_to_share/);
    const r = k.dispatch({
      cmd_id: 'cmd_dt1', type: 'dm_tell', actor: 't',
      params: { from: 'npc_seyi', to: 'person_tola', fact: 'fact_true_rent' },
    });
    assert.equal(r.status, 'applied');
    const card = k.query().claim_card('fact_true_rent');
    assert.equal(card.positions[0].value, 450000);
    assert.ok(card.positions[0].speakers.includes('npc_seyi'));
    assert.match(k.dispatch({
      cmd_id: 'cmd_dt2', type: 'dm_tell', actor: 't',
      params: { from: 'person_tola', to: 'person_tola', fact: 'fact_true_rent' },
    }).reason, /no_self_dm/);
  });

  it('dm_request opens a request with no favour; draft decline closes it', () => {
    const k = world();
    const r = k.dispatch({
      cmd_id: 'cmd_dr1', type: 'dm_request', actor: 't',
      params: { from: 'person_tola', to: 'npc_seyi', topic: 'money', detail: 'amount:20000' },
    });
    assert.equal(r.status, 'applied');
    assert.equal(k.query().requests({ target: 'npc_seyi', status: 'open' }).length, 1);
    assert.equal(k.query().obligations({ party: 'person_tola' }).length, 0, 'chat requests stay informal');
    const dmId = k.query().chats().dms[0].messages[0].id;
    const draft = k.query().draft_action(dmId, 'decline');
    assert.equal(draft.type, 'decline');
    assert.equal(k.dispatch({ cmd_id: 'cmd_dr2', type: draft.type, actor: 't', params: draft.params }).status, 'applied');
    assert.equal(k.query().requests({ target: 'npc_seyi', status: 'open' }).length, 0);
  });

  it('draft ask prefills a follow-up; unknown drafts fail closed', () => {
    const k = world();
    seedFacts(k, [{ fact_id: 'fact_true_rent', value: 450000 }]);
    seedBeliefs(k, [{ person: 'npc_seyi', fact: 'fact_true_rent', value: 450000, certainty: 'sure', source: 'saw' }]);
    k.dispatch({
      cmd_id: 'cmd_da1', type: 'dm_tell', actor: 't',
      params: { from: 'npc_seyi', to: 'person_tola', fact: 'fact_true_rent' },
    });
    const dmId = k.query().chats().dms[0].messages[0].id;
    assert.deepEqual(k.query().draft_action(dmId, 'ask'), {
      type: 'ask',
      params: { target: 'npc_seyi', topic: 'information', fact: 'fact_true_rent' },
    });
    assert.match(k.query().draft_action(dmId, 'promise').error, /no_draft_for/);
    assert.match(k.query().draft_action('msg_nope', 'decline').error, /unknown_message/);
  });

  it('duplicate DM commands never double-post', () => {
    const k = world();
    const cmd = { cmd_id: 'cmd_dup1', type: 'dm_request', actor: 't', params: { from: 'person_tola', to: 'npc_seyi', topic: 'help' } };
    assert.equal(k.dispatch(cmd).status, 'applied');
    assert.equal(k.dispatch(cmd).status, 'duplicate');
    assert.equal(k.query().chats().dms[0].messages.length, 1);
  });
});

describe('book: public memory with sources', () => {
  it('group claims appear with speaker + origin; DM claims never do', () => {
    const k = world();
    openCompound(k);
    seedFacts(k, [{ fact_id: 'fact_true_rent', value: 450000 }]);
    seedBeliefs(k, [{ person: 'npc_seyi', fact: 'fact_true_rent', value: 450000, certainty: 'sure', source: 'saw' }]);
    breakDebt(k, 'bk1');
    k.dispatch({
      cmd_id: 'cmd_dm1', type: 'dm_tell', actor: 't',
      params: { from: 'npc_seyi', to: 'person_tola', fact: 'fact_true_rent' },
    });
    k.dispatch({ cmd_id: 'cmd_advb', type: 'advance_time', actor: 't', params: { steps: 10 } });
    const book = k.query().book();
    assert.equal(book.length, 1);
    assert.equal(book[0].speaker, 'npc_seyi');
    assert.equal(book[0].origin_id, 'origin_compound');
    assert.equal(book[0].fact, 'fact_debt_news');
    assert.ok(!book.some((b) => b.fact === 'fact_true_rent'), 'DM claims stay out of the book');
  });
});

describe('rumour spread: weaker, same origin, never overwriting', () => {
  it('members gain likely beliefs; existing sure beliefs stand; no duplicates', () => {
    const k = world();
    openCompound(k);
    // Tola already knows the gossip topic firsthand: must never be overwritten.
    seedFacts(k, [{ fact_id: 'fact_debt_news', value: 'calm' }]);
    seedBeliefs(k, [{ person: 'person_tola', fact: 'fact_debt_news', value: 'calm', certainty: 'sure', source: 'saw' }]);
    breakDebt(k, 'rm1');
    k.dispatch({ cmd_id: 'cmd_advr', type: 'advance_time', actor: 't', params: { steps: 10 } });
    const musaBelief = (person) => {
      const all = k.query().journal(500).filter((e) => e.kind === 'BeliefHeard' && e.data.person === person);
      return all;
    };
    // Musa had no belief: gains exactly one weaker hearsay belief, same origin.
    const musaHeard = musaBelief('npc_musa');
    assert.equal(musaHeard.length, 1);
    assert.equal(musaHeard[0].data.certainty, 'rumour');
    assert.equal(musaHeard[0].data.origin_id, 'origin_compound');
    // Tola's sure belief is untouched: no BeliefHeard for her.
    assert.equal(musaBelief('person_tola').length, 0);
    // Second identical break repeats chatter but creates no second belief.
    breakDebt(k, 'rm2');
    k.dispatch({ cmd_id: 'cmd_advr2', type: 'advance_time', actor: 't', params: { steps: 10 } });
    assert.equal(musaBelief('npc_musa').length, 1, 'repeat delivery must not duplicate');
  });
});

describe('notifications: derived, prioritized, capped, deterministic', () => {
  it('orders overdue > due > crisis > request and caps at 20', () => {
    const k = world();
    openCompound(k);
    k.dispatch({ cmd_id: 'cmd_ident9', type: 'identify_player', actor: 'seed', params: { person: 'person_tola' } });
    for (let i = 0; i < 18; i++) {
      k.dispatch({
        cmd_id: `cmd_nd${i}`, type: 'create_obligation', actor: 't',
        params: { obligation_id: `obl_n${i}`, kind: 'Debt', owes: 'person_tola', owed: 'npc_seyi', amount: 100, due_in_min: 60 + i },
      });
    }
    k.dispatch({ cmd_id: 'cmd_nx', type: 'open_thread', actor: 't', params: { thread_id: 'thread_crisis', deadline_in_min: 5000, tags: ['crisis'] } });
    k.dispatch({ cmd_id: 'cmd_nq', type: 'dm_request', actor: 't', params: { from: 'npc_seyi', to: 'person_tola', topic: 'help' } });
    const notes = k.query().notifications();
    assert.equal(notes.length, 20);
    assert.deepEqual(notes.map((n) => n.kind),
      [...Array(18).fill('obligation_due'), 'crisis_open', 'request_open']);
    // Over cap: lowest priority drops first, highest survives the cut line.
    for (let i = 18; i < 23; i++) {
      k.dispatch({
        cmd_id: `cmd_nd${i}`, type: 'create_obligation', actor: 't',
        params: { obligation_id: `obl_n${i}`, kind: 'Debt', owes: 'person_tola', owed: 'npc_seyi', amount: 100, due_in_min: 60 + i },
      });
    }
    const capped = k.query().notifications();
    assert.equal(capped.length, 20);
    assert.ok(!capped.some((n) => n.kind === 'request_open'), 'lowest priority drops off first');
    assert.ok(!capped.some((n) => n.kind === 'crisis_open'), 'then crisis');
    assert.ok(capped.every((n) => n.kind === 'obligation_due'));
    // Deterministic across identical twins.
    const k2 = world('twin-seed');
    openCompound(k2, 'cmd_grp9');
    k2.dispatch({ cmd_id: 'cmd_ident9', type: 'identify_player', actor: 'seed', params: { person: 'person_tola' } });
    for (let i = 0; i < 23; i++) {
      k2.dispatch({
        cmd_id: `cmd_nd${i}`, type: 'create_obligation', actor: 't',
        params: { obligation_id: `obl_n${i}`, kind: 'Debt', owes: 'person_tola', owed: 'npc_seyi', amount: 100, due_in_min: 60 + i },
      });
    }
    k2.dispatch({ cmd_id: 'cmd_nx', type: 'open_thread', actor: 't', params: { thread_id: 'thread_crisis', deadline_in_min: 5000, tags: ['crisis'] } });
    k2.dispatch({ cmd_id: 'cmd_nq', type: 'dm_request', actor: 't', params: { from: 'npc_seyi', to: 'person_tola', topic: 'help' } });
    assert.deepEqual(k2.query().notifications(), capped);
  });
  it('overdue outranks due', () => {
    const k = world();
    // Past due but inside a long grace window: status Due, due_t < now.
    k.dispatch({ cmd_id: 'cmd_od1', type: 'create_obligation', actor: 't', params: { obligation_id: 'obl_od', kind: 'Debt', owes: 'person_tola', owed: 'npc_seyi', amount: 100, due_in_min: 5, grace_min: 5000 } });
    k.dispatch({ cmd_id: 'cmd_od2', type: 'create_obligation', actor: 't', params: { obligation_id: 'obl_due', kind: 'Debt', owes: 'person_tola', owed: 'npc_seyi', amount: 100, due_in_min: 5000 } });
    k.dispatch({ cmd_id: 'cmd_od3', type: 'advance_time', actor: 't', params: { steps: 10 } });
    const kinds = k.query().notifications().map((n) => n.kind);
    assert.deepEqual(kinds.slice(0, 2), ['obligation_overdue', 'obligation_due']);
  });
});

describe('bounds, persistence, content', () => {
  it('DM thread history caps at 200, oldest dropped first', () => {
    const k = world();
    for (let i = 0; i < 205; i++) {
      const r = k.dispatch({
        cmd_id: `cmd_cap${i}`, type: 'dm_request', actor: 't',
        params: { from: 'person_tola', to: 'npc_seyi', topic: 'help' },
      });
      assert.equal(r.status, 'applied');
    }
    const dm = k.query().chats().dms[0];
    assert.equal(dm.messages.length, 200);
    assert.ok(!dm.messages.some((m) => m.seq === 1), 'oldest evicted first');
  });
  it('group history caps at 300 across many world events', () => {
    const k = world();
    openCompound(k);
    // Stagger dues so each advance stays under the per-command event budget.
    for (let i = 0; i < 305; i++) {
      k.dispatch({
        cmd_id: `cmd_gb${i}`, type: 'create_obligation', actor: 't',
        params: { obligation_id: `obl_gb${i}`, kind: 'Debt', owes: 'person_tola', owed: 'npc_seyi', amount: 100, due_in_min: 5 + i },
      });
    }
    for (let a = 0; a < 35; a++) {
      k.dispatch({ cmd_id: `cmd_gadv${a}`, type: 'advance_time', actor: 't', params: { steps: 10 } });
    }
    const history = k.query().chats().groups[0].messages;
    assert.equal(history.length, 300);
  });
  it('messages, groups, and threads survive save/restore; old snapshots tolerate absence', () => {
    const k = world();
    openCompound(k);
    k.dispatch({
      cmd_id: 'cmd_sv1', type: 'dm_request', actor: 't',
      params: { from: 'person_tola', to: 'npc_seyi', topic: 'money', detail: 'amount:5000' },
    });
    const snap = JSON.parse(k.snapshot());
    assert.ok(snap.stores.comms.messages && snap.stores.comms.groups);
    const k2 = world('restore-seed');
    k2.restore(JSON.stringify(snap));
    assert.equal(k2.snapshot(), k.snapshot());
    assert.equal(k2.query().chats().dms[0].messages.length, 1);
    // A snapshot missing the comms store fails LOUD at restore (kernel guard
    // against truncated snapshots) — it must never boot with silent empty
    // chats. Pre-M008 saves surface via the save envelope's contentMismatch
    // flag, not by guessing here.
    delete snap.stores.comms;
    const k3 = world('old-seed');
    assert.throws(() => k3.restore(JSON.stringify(snap)), /missing_store_in_snapshot: comms/);
  });
  it('repo chatter content validates and boots', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
    const templates = JSON.parse(readFileSync(join(dir, 'strings', 'chat.json'), 'utf8'));
    const chatter = JSON.parse(readFileSync(join(dir, 'rules', 'chatter.json'), 'utf8'));
    assert.equal(validateChatterRules(chatter, templates.map((t) => t.id)), null);
    assert.match(validateChatterRules([{ on_event: 'X', template: 'nope' }], []), /unknown template/);
    assert.match(validateChatterRules([{ on_event: 'X', template: 'tell_fact', claim: { fact: 'x' } }], ['tell_fact']), /origin_id|fact/);
  });
});
