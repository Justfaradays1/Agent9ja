// sim/comms/index.js — messages + compound group. Owner: sim/comms (M008).
//
// A message is a record of something said: template id + params, never free
// text. DMs carry claims (with real provenance) or informal requests.
// The compound group carries chatter fired by real world events; membership
// at post time IS the witness list (public memory). Co-presence for rumour
// spread = group membership until M009 places refine it.
//
// Deliberately absent: additional groups, voice/media, read-tracking (DM
// "unread" notifications are deferred — see notifications()), favour costs on
// chat requests (those belong to the formal Ask path).

import { assertId } from '../kernel/ids.js';

const THREAD_CAP = 200;
const GROUP_CAP = 300;
const NOTIF_CAP = 20;
const TAG_RE = /^[a-z][a-z0-9_]{0,31}$/;

const WEAKER = { sure: 'likely', likely: 'rumour', rumour: 'rumour' };

// Canonical empty comms state, owned here so migration (sim/save) and tests
// construct exactly what setState accepts — no shape drift, no invented data.
export function emptyCommsState() {
  return { messages: {}, groups: {}, dmThreads: {} };
}

export function validateChatterRules(rules, templates) {
  if (!Array.isArray(rules)) return 'chatter rules must be an array';
  for (const [i, r] of rules.entries()) {
    if (!r || typeof r.on_event !== 'string') return `chatter[${i}].on_event required`;
    if (!r || typeof r.template !== 'string') return `chatter[${i}].template required`;
    if (!templates.includes(r.template)) return `chatter[${i}] unknown template: ${r.template}`;
    if (r.speaker !== undefined) {
      try { assertId(r.speaker, 'speaker'); } catch { return `chatter[${i}] bad speaker id`; }
    }
    if (r.params !== undefined && (typeof r.params !== 'object' || r.params === null || Array.isArray(r.params))) {
      return `chatter[${i}].params must be a plain object`;
    }
    // Authored claims only: value AND origin are declared explicitly in
    // content (mirrors mislead false_value). Nothing is inferred, so
    // provenance stays honest.
    if (r.claim !== undefined) {
      try { assertId(r.claim.fact, 'fact'); assertId(r.claim.origin_id, 'origin_id'); } catch {
        return `chatter[${i}].claim needs stable fact + origin_id`;
      }
      if (!['string', 'number', 'boolean'].includes(typeof r.claim.asserted)) {
        return `chatter[${i}].claim.asserted must be a JSON scalar`;
      }
    }
  }
  return null;
}

export function createComms(kernel, { knowledge, chatter = [], templates = [] }) {
  if (!knowledge) throw new Error('comms need {knowledge}');
  const cerr = validateChatterRules(chatter, templates);
  if (cerr) throw new Error(cerr);
  const messages = {}; // id -> message record
  const groups = {}; // id -> {id, members: [], history: [msgIds]}
  const dmThreads = {}; // threadId -> [msgIds], insertion-ordered

  kernel.registerStore('comms', {
    getState: () => ({ messages, groups, dmThreads }),
    setState: (s) => {
      for (const k of Object.keys(messages)) delete messages[k];
      Object.assign(messages, s.messages || {});
      for (const k of Object.keys(groups)) delete groups[k];
      Object.assign(groups, s.groups || {});
      for (const k of Object.keys(dmThreads)) delete dmThreads[k];
      Object.assign(dmThreads, s.dmThreads || {});
    },
  });

  const threadIdFor = (a, b) => `dm:${[a, b].sort().join(':')}`;

  function storeMessage(ev, { thread, to, claims }) {
    const id = `msg_${ev.seq}`;
    if (messages[id]) return messages[id]; // idempotency backstop
    const msg = {
      id, thread, from: ev.data.from, to: to ?? null,
      template: ev.data.template, params: { ...(ev.data.params || {}) },
      claims: claims || [], witnesses: [...(ev.data.witnesses || [])],
      t: ev.t, seq: ev.seq,
    };
    messages[id] = msg;
    if (thread.startsWith('dm:')) {
      const list = (dmThreads[thread] = dmThreads[thread] || []);
      list.push(id);
      while (list.length > THREAD_CAP) list.shift();
    } else {
      const g = groups[thread.slice('group:'.length)];
      if (g) {
        g.history.push(id);
        while (g.history.length > GROUP_CAP) g.history.shift();
      }
    }
    return msg;
  }

  kernel.onApply('MessagePosted', (ev) => {
    storeMessage(ev, { thread: ev.data.thread, to: ev.data.to ?? null, claims: ev.data.claims || [] });
  });

  kernel.registerCommand('open_group', {
    validate: (p) => {
      if (!p || typeof p.group_id !== 'string') return 'open_group needs {group_id, members}';
      try { assertId(p.group_id, 'group_id'); } catch { return 'bad group_id'; }
      if (!Array.isArray(p.members) || p.members.length === 0) return 'open_group needs non-empty members';
      for (const m of p.members) {
        try { assertId(m, 'member'); } catch { return `bad member id: ${m}`; }
      }
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (groups[p.group_id]) return { rejected: `duplicate_group: ${p.group_id}` };
      for (const m of p.members) {
        if (!q.person(m)) return { rejected: `unknown_person: ${m}` };
      }
      if (new Set(p.members).size !== p.members.length) return { rejected: 'duplicate_member' };
      return [{ kind: 'GroupOpened', data: { group_id: p.group_id, members: [...p.members] } }];
    },
  });

  kernel.registerCommand('group_add', {
    validate: (p) => {
      if (!p || typeof p.group_id !== 'string' || typeof p.person !== 'string') {
        return 'group_add needs {group_id, person}';
      }
      try { assertId(p.group_id, 'group_id'); assertId(p.person, 'person'); } catch {
        return 'bad ids';
      }
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      const g = groups[p.group_id];
      if (!g) return { rejected: `unknown_group: ${p.group_id}` };
      if (!q.person(p.person)) return { rejected: `unknown_person: ${p.person}` };
      if (g.members.includes(p.person)) return { rejected: 'already_member' };
      return [{ kind: 'GroupMemberAdded', data: { group_id: p.group_id, person: p.person } }];
    },
  });

  kernel.onApply('GroupOpened', (ev) => {
    groups[ev.data.group_id] = { id: ev.data.group_id, members: [...ev.data.members], history: [] };
  });

  kernel.onApply('GroupMemberAdded', (ev) => {
    const g = groups[ev.data.group_id];
    if (!g) throw new Error('missing_group_in_apply');
    if (!g.members.includes(ev.data.person)) g.members.push(ev.data.person);
  });

  kernel.registerCommand('dm_tell', {
    validate: (p) => {
      if (!p || typeof p.from !== 'string' || typeof p.to !== 'string' || typeof p.fact !== 'string') {
        return 'dm_tell needs {from, to, fact}';
      }
      try { assertId(p.from, 'from'); assertId(p.to, 'to'); assertId(p.fact, 'fact'); } catch {
        return 'bad ids';
      }
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (!q.person(p.from)) return { rejected: `unknown_person: ${p.from}` };
      if (!q.person(p.to)) return { rejected: `unknown_person: ${p.to}` };
      if (p.from === p.to) return { rejected: 'no_self_dm' };
      if (!knowledge.reads.factExists(p.fact)) return { rejected: `unknown_fact: ${p.fact}` };
      const belief = knowledge.reads.beliefOf(p.from, p.fact);
      if (!belief) return { rejected: `no_belief_to_share: ${p.from} has no belief about ${p.fact}` };
      // Volunteered speech asserts the speaker's own belief as-is — including
      // authored errors. No disclosure evaluation: they chose to speak.
      return [{
        kind: 'ClaimHeard',
        data: {
          claim: {
            fact: p.fact, asserted: belief.value, speaker: p.from, asker: p.to,
            origin_id: belief.origin_id, certainty: belief.certainty, shading: null,
          },
        },
      }, {
        kind: 'MessagePosted',
        data: {
          thread: threadIdFor(p.from, p.to), from: p.from, to: p.to,
          template: 'tell_fact',
          params: { fact: p.fact },
          claims: [{ fact: p.fact, asserted: belief.value, origin_id: belief.origin_id, certainty: belief.certainty }],
        },
      }];
    },
  });

  kernel.registerCommand('dm_request', {
    validate: (p) => {
      if (!p || typeof p.from !== 'string' || typeof p.to !== 'string' || typeof p.topic !== 'string') {
        return 'dm_request needs {from, to, topic}';
      }
      try { assertId(p.from, 'from'); assertId(p.to, 'to'); } catch { return 'bad ids'; }
      if (!['money', 'shelter', 'introduction', 'help'].includes(p.topic)) {
        return 'bad topic: money|shelter|introduction|help';
      }
      if (p.detail !== undefined && (typeof p.detail !== 'string' || p.detail.length > 140)) return 'bad detail';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (!q.person(p.from)) return { rejected: `unknown_person: ${p.from}` };
      if (!q.person(p.to)) return { rejected: `unknown_person: ${p.to}` };
      if (p.from === p.to) return { rejected: 'no_self_dm' };
      // Informal chat request: a pre-commitment record only, NO favour
      // obligation (that cost belongs to the formal Ask path — see verbs).
      return [
        { kind: 'RequestOpened', data: { asker: p.from, target: p.to, topic: p.topic, detail: p.detail ?? '', origin_id: 'origin_dev' } },
        {
          kind: 'MessagePosted',
          data: {
            thread: threadIdFor(p.from, p.to), from: p.from, to: p.to,
            template: 'request_help', params: { topic: p.topic, detail: p.detail ?? '' },
          },
        },
      ];
    },
  });

  // Chatter: world events become witnessed group messages. Unknown event kinds
  // fail closed (no rule → no chatter), never invent content.
  for (const rule of chatter) {
    kernel.on(rule.on_event, (ev) => {
      const speaker = rule.speaker ?? null;
      const all = Object.values(groups);
      // The single in-scope group: the one containing the speaker, else the
      // first group. No hardcoded id — group ids are stable ids, not the
      // word 'compound'.
      const g = speaker ? all.find((x) => x.members.includes(speaker)) : all[0];
      if (!g) return [];
      const msg = {
        thread: `group:${g.id}`, from: speaker, to: null,
        template: rule.template, params: { ...(rule.params || {}) },
      };
      if (rule.claim) {
        msg.claims = [{
          fact: rule.claim.fact, asserted: rule.claim.asserted,
          origin_id: rule.claim.origin_id, certainty: 'rumour',
        }];
      }
      return [{
        kind: 'MessagePosted',
        data: { ...msg, witnesses: [...g.members] },
      }];
    });
  }

  // Co-presence rumour spread (M008-small): a group message carrying claims
  // gives each other member a weaker hearsay belief — same origin_id, one
  // certainty step down — but never overwrites an existing belief.
  kernel.on('MessagePosted', (ev) => {
    if (!ev.data.thread.startsWith('group:')) return [];
    const claims = ev.data.claims || [];
    if (claims.length === 0) return [];
    const g = groups[ev.data.thread.slice('group:'.length)];
    if (!g) return [];
    const out = [];
    for (const member of g.members) {
      if (member === ev.data.from) continue;
      for (const c of claims) {
        // Never overwrite, never duplicate: members who already hold a belief
        // about the fact hear nothing new (the applier is a backstop for
        // races, not the mechanism). The journal stays a clean record of
        // minds actually changed.
        if (knowledge.reads.beliefOf(member, c.fact)) continue;
        out.push({
          kind: 'BeliefHeard',
          data: {
            person: member, fact: c.fact, value: c.asserted,
            certainty: WEAKER[c.certainty] || 'rumour',
            origin_id: c.origin_id, source_seq: ev.seq,
          },
        });
      }
    }
    return out;
  });

  // Pure command constructor: a chat response drafts the verb command the
  // caller then dispatches normally through the bridge. No nested dispatch,
  // no resolver duplication. Only choices fully specified by the message.
  kernel.registerQuery('draft_action', (message_id, choice) => {
    const m = messages[message_id];
    if (!m) return { error: `unknown_message: ${message_id}` };
    if (m.thread.startsWith('group:')) return { error: 'draft_action is for DM threads (group messages have no single respondent)' };
    if (choice === 'decline' && m.template === 'request_help') {
      // The message cannot carry the request id (assigned in the applier
      // after resolve), so resolve it by lookup. Ambiguity fails closed.
      // declines target the message recipient: only they may decline.
      const q = kernel.query();
      if (typeof q.requests !== 'function') return { error: 'requests ledger not wired' };
      const open = (q.requests({ asker: m.from, target: m.to, status: 'open' }) || [])
        .filter((r) => r.topic === m.params.topic && (r.detail || '') === (m.params.detail || ''));
      if (open.length !== 1) return { error: open.length === 0 ? 'no_open_request' : 'ambiguous_request' };
      return { type: 'decline', params: { request: open[0].id, decliner: m.to } };
    }
    if (choice === 'ask' && m.template === 'tell_fact') {
      return { type: 'ask', params: { target: m.from, topic: 'information', fact: m.params.fact } };
    }
    return { error: `no_draft_for: ${m.template}+${choice} (promise/repay need terms the message does not carry)` };
  });

  kernel.registerQuery('chats', () => {
    // Full retained history: the store caps (200/thread, 300/group) ARE the
    // bound, so the query exposes everything retained — including proof that
    // oldest-first eviction happened.
    const dms = Object.entries(dmThreads).map(([thread, ids]) => ({
      thread, messages: ids.map((id) => ({ ...messages[id] })),
    }));
    dms.sort((a, b) => (a.thread < b.thread ? -1 : 1));
    const groupList = Object.values(groups).map((g) => ({
      id: g.id,
      members: [...g.members],
      messages: g.history.map((id) => ({ ...messages[id] })),
    }));
    return JSON.parse(JSON.stringify({ dms, groups: groupList }));
  });

  // The Book: compound public memory. Group claim-bearing messages, with
  // sources. DMs never appear here — that is the information boundary.
  kernel.registerQuery('book', () => {
    const g = Object.values(groups)[0];
    if (!g) return [];
    const out = [];
    for (const id of g.history) {
      const m = messages[id];
      if (!m) continue;
      for (const c of m.claims || []) {
        out.push({ fact: c.fact, asserted: c.asserted, speaker: m.from, origin_id: c.origin_id, message_id: id });
      }
    }
    return JSON.parse(JSON.stringify(out));
  });

  // Derived, prioritized, capped. Tolerates unwired modules (absent query =
  // section skipped, never throws). No unread-DM section: M008 has no
  // read-tracking, and inventing "unread" without it would be dishonest.
  kernel.registerQuery('notifications', () => {
    // Composing queries here is safe (building a view never evaluates it).
    const q = kernel.query();
    const notes = [];
    const player = typeof q.player === 'function' ? q.player() : null;
    const dues = typeof q.due_soon === 'function' ? q.due_soon(10080) : [];
    for (const o of dues) {
      notes.push({ kind: 'obligation_due', ref: o.id, t: o.due_t, priority: 1 });
    }
    // Overdue = past its due time but still in grace (status Due, due_t < now).
    // due_soon only covers the future, so read the obligations list directly.
    // Broken is NOT overdue: the break already fired its own chatter.
    if (typeof q.obligations === 'function') {
      const now = typeof q.time === 'function' ? q.time().minutes : 0;
      for (const o of q.obligations({ status: 'Due' }) || []) {
        if (o.due_t < now) notes.push({ kind: 'obligation_overdue', ref: o.id, t: o.due_t, priority: 0 });
      }
    }
    const openThreads = typeof q.threads === 'function' ? q.threads({ status: 'open' }) : [];
    for (const t of openThreads) {
      if ((t.tags || []).includes('crisis')) {
        notes.push({ kind: 'crisis_open', ref: t.id, t: t.opened_t, priority: 2 });
      }
    }
    if (player && typeof q.requests === 'function') {
      for (const r of q.requests({ target: player, status: 'open' }) || []) {
        notes.push({ kind: 'request_open', ref: r.id, t: r.t, priority: 3 });
      }
    }
    // Open repair levy (M009): the compound needs money by a deadline. Same
    // composed-query pattern as above; absent world module = skipped.
    if (typeof q.world === 'function') {
      const open = q.world().levy;
      if (open) notes.push({ kind: 'levy_open', ref: open.id, t: open.due_t, priority: 1 });
    }
    notes.sort((a, b) => a.priority - b.priority || ((a.t ?? 0) - (b.t ?? 0)) || (a.ref < b.ref ? -1 : 1));
    return JSON.parse(JSON.stringify(notes.slice(0, NOTIF_CAP)));
  });

  return {};
}
