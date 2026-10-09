// sim/obligations/index.js — persistent agreements. Owner: sim/obligations (M003).
//
// Lifecycle: Active → Due → Fulfilled / Broken / Renegotiated.
// History is append-only: repayment NEVER rewrites a Broken past.
// Settlement is atomic by construction (single synchronous applier, validated
// upfront; resolver refuses before any effect when anything is off).
// Favour derivation for standing: NOT here — M004 verbs consume this ledger.

import { assertId } from '../kernel/ids.js';
import { checkAmount } from '../economy/index.js';

const SETTLEABLE = new Set(['Active', 'Due', 'Broken']);
const TERMINAL = new Set(['Fulfilled', 'Renegotiated']);
const WITNESS_MAX = 8;

export function validateKinds(kinds) {
  if (!kinds || typeof kinds !== 'object') return 'kinds must be an object';
  for (const k of ['Debt', 'PromisedAction']) {
    if (!kinds[k]) return `kinds must define ${k} first (arch M003)`;
  }
  return null;
}

// ---- Shared builders (M004 verbs reuse these; no duplicated rules) ----
// reads: { obligationById(id), personExists(id), balanceOf(id), now(),
//          scarred(owes, owed) } — scarred returns a memory id or null and is
// optional; without it the grace gate stays open (pre-M005 behavior).
// Returns {events} or {rejected}. Pure: no state access except via reads.

export function buildCreateEvents(p, kinds, reads) {
  if (!kinds[p.kind]) return { rejected: `unknown_kind: ${p.kind}` };
  if (reads.obligationById(p.obligation_id)) return { rejected: `duplicate_obligation: ${p.obligation_id}` };
  if (!reads.personExists(p.owes)) return { rejected: `unknown_person: ${p.owes}` };
  if (!reads.personExists(p.owed)) return { rejected: `unknown_person: ${p.owed}` };
  if (p.owes === p.owed) return { rejected: 'no_self_obligation' };
  if (p.witnesses !== undefined) {
    if (!Array.isArray(p.witnesses) || p.witnesses.length > WITNESS_MAX) {
      return { rejected: `bad_witnesses: array<=${WITNESS_MAX}` };
    }
    for (const w of p.witnesses) {
      try { assertId(w, 'witness'); } catch { return { rejected: 'bad_witnesses: stable ids required' }; }
      if (!reads.personExists(w)) return { rejected: `unknown_person: ${w}` };
    }
  }
  const now = reads.now();
  let amount = null, subject = null;
  if (p.kind === 'Debt') {
    const bad = checkAmount(p.amount);
    if (bad) return { rejected: bad };
    amount = p.amount;
  } else if (p.kind === 'PromisedAction' || p.kind === 'Favour') {
    if (typeof p.subject !== 'string' || p.subject.length === 0 || p.subject.length > 280) {
      return { rejected: 'bad subject: non-empty string<=280 required' };
    }
    subject = p.subject;
  } else if (p.kind === 'Vouch') {
    if (typeof p.subject !== 'string') return { rejected: 'bad subject: vouchee person id required' };
    try { assertId(p.subject, 'subject'); } catch { return { rejected: 'bad subject id' }; }
    if (!reads.personExists(p.subject)) return { rejected: `unknown_person: ${p.subject}` };
    if (p.subject === p.owes) return { rejected: 'no_self_vouch' };
    subject = p.subject;
  }
  const due = dueOf(p, now);
  if (due.error) return { rejected: due.error };
  if (due.t <= now) return { rejected: 'past_due_at_creation: due must be in the future' };
  const origin = p.origin_id === undefined ? 'origin_dev' : p.origin_id;
  try { assertId(origin, 'origin_id'); } catch { return { rejected: 'bad origin_id' }; }
  // M005 grace gate: a burned history with the creditor halves starting grace.
  // The adjusting memory is cited on the record; clean histories pass through.
  const scar = typeof reads.scarred === 'function' ? reads.scarred(p.owes, p.owed) : null;
  const grace = scar ? Math.floor((p.grace_min ?? 0) / 2) : (p.grace_min ?? 0);
  return [{
    kind: 'ObligationCreated',
    data: {
      obligation: {
        id: p.obligation_id, kind: p.kind, owes: p.owes, owed: p.owed,
        amount, subject,
        reason: p.reason ?? null, wording_id: p.wording_id ?? null,
        created_t: now, due_t: due.t, grace_min: grace,
        grace_adjusted_by: scar,
        witnesses: [...(p.witnesses || [])], origin_id: origin,
        status: 'Active', paid: 0, statusHistory: [], links: p.links ? { ...p.links } : {},
      },
    },
  }];
}

export function buildSettleEvents(o, p, reads) {
  if (!SETTLEABLE.has(o.status)) return { rejected: `not_settleable: ${o.status}` };
  const payer = p.payer === undefined ? o.owes : p.payer;
  if (payer !== o.owes) return { rejected: 'payer_must_be_debtor (third-party settlement deferred)' };
  const wasBroken = o.status === 'Broken';
  if (o.kind === 'Debt') {
    const bad = checkAmount(p.amount);
    if (bad) return { rejected: bad };
    const remaining = o.amount - o.paid;
    if (p.amount > remaining) return { rejected: `overpayment: remaining ${remaining}` };
    const bal = reads.balanceOf(payer);
    if (bal === null || bal === undefined) return { rejected: `no_account: ${payer}` };
    if (reads.balanceOf(o.owed) === null || reads.balanceOf(o.owed) === undefined) {
      return { rejected: `no_account: ${o.owed}` };
    }
    if (bal < p.amount) return { rejected: `insufficient_funds: ${payer}` };
    const complete = remaining - p.amount === 0;
    const settled = { kind: 'ObligationSettled', data: { id: o.id, kind: o.kind, owes: o.owes, owed: o.owed, paid: p.amount, remaining: remaining - p.amount, was_broken: wasBroken, complete } };
    const moved = { kind: 'MoneyMoved', data: { from: payer, to: o.owed, amount: p.amount, memo: `settle ${o.id}`, obligation: o.id, origin_id: o.origin_id } };
    return complete
      ? [moved, settled, { kind: 'ObligationFulfilled', data: { id: o.id, kind: o.kind, owes: o.owes, owed: o.owed, was_broken: wasBroken } }]
      : [moved, settled];
  }
  if (o.kind === 'Vouch') return { rejected: 'vouch_settles_in_m005 (contingent liability deferred)' };
  // PromisedAction + Favour: completion only, no money, no partial.
  if (p.amount !== undefined) return { rejected: 'action_has_no_amount' };
  if (p.complete !== true) return { rejected: 'action_needs_complete_true' };
  return [
    { kind: 'ObligationSettled', data: { id: o.id, kind: o.kind, owes: o.owes, owed: o.owed, paid: 0, remaining: 0, was_broken: wasBroken, complete: true } },
    { kind: 'ObligationFulfilled', data: { id: o.id, kind: o.kind, owes: o.owes, owed: o.owed, was_broken: wasBroken } },
  ];
}

function dueOf(p, now) {
  if (p.due_t !== undefined) {
    if (!Number.isInteger(p.due_t)) return { error: 'bad due_t: absolute game minutes required' };
    return { t: p.due_t };
  }
  if (p.due_in_min !== undefined) {
    if (!Number.isInteger(p.due_in_min) || p.due_in_min < 0) return { error: 'bad due_in_min' };
    return { t: now + p.due_in_min };
  }
  return { error: 'due_t or due_in_min required' };
}

export function createObligations(kernel, kinds, opts = {}) {
  const kerr = validateKinds(kinds);
  if (kerr) throw new Error(kerr);
  // memoryReads is optional: without memory wiring the grace gate stays open,
  // which is exactly the pre-M005 behavior (documented safe default).
  const memoryReads = opts.memoryReads ?? null;
  const obls = {}; // id -> record

  kernel.registerStore('obligations', {
    getState: () => ({ obls }),
    setState: (s) => {
      for (const k of Object.keys(obls)) delete obls[k];
      Object.assign(obls, s.obls);
    },
  });

  const readsFor = (q) => ({
    obligationById: (id) => obls[id] ?? null,
    personExists: (id) => !!q.person(id),
    balanceOf: (id) => q.balance(id),
    now: () => q.time().minutes,
    scarred: memoryReads
      ? (owes, owed) => {
          const hit = memoryReads.memoriesOf(owes).find((m) => m.kind === 'broke_promise' && m.subject === owed);
          return hit ? hit.id : null;
        }
      : () => null,
  });

  kernel.registerCommand('create_obligation', {
    validate: (p) => {
      if (!p || typeof p.obligation_id !== 'string') return 'create needs {obligation_id, kind, owes, owed}';
      try { assertId(p.obligation_id, 'obligation_id'); } catch { return 'bad obligation_id'; }
      if (!p.kind || typeof p.owes !== 'string' || typeof p.owed !== 'string') return 'create needs {kind, owes, owed}';
      try { assertId(p.owes, 'owes'); assertId(p.owed, 'owed'); } catch { return 'parties need stable ids'; }
      if (p.reason !== undefined && (typeof p.reason !== 'string' || p.reason.length > 140)) return 'bad reason';
      if (p.wording_id !== undefined) { try { assertId(p.wording_id, 'wording_id'); } catch { return 'bad wording_id'; } }
      if (p.grace_min !== undefined && (!Number.isInteger(p.grace_min) || p.grace_min < 0)) return 'bad grace_min';
      return null;
    },
    resolve: (cmd, q) => buildCreateEvents(cmd.params, kinds, readsFor(q)),
  });

  kernel.registerCommand('settle_obligation', {
    validate: (p) => {
      if (!p || typeof p.obligation !== 'string') return 'settle needs {obligation}';
      try { assertId(p.obligation, 'obligation'); } catch { return 'bad obligation ref'; }
      if (p.payer !== undefined) { try { assertId(p.payer, 'payer'); } catch { return 'bad payer'; } }
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      const o = obls[p.obligation];
      if (!o) return { rejected: `unknown_obligation: ${p.obligation}` };
      return buildSettleEvents(o, p, { balanceOf: (id) => q.balance(id) });
    },
  });

  kernel.registerCommand('renegotiate_obligation', {
    validate: (p) => {
      if (!p || typeof p.obligation !== 'string' || typeof p.new_id !== 'string') {
        return 'renegotiate needs {obligation, new_id}';
      }
      try { assertId(p.obligation, 'obligation'); assertId(p.new_id, 'new_id'); } catch { return 'bad refs'; }
      if (p.creditor_accept !== true) return 'creditor_accept_required';
      if (p.new_amount !== undefined) {
        const bad = checkAmount(p.new_amount, { allowZero: true });
        if (bad) return bad; // explicit consensual forgiveness allowed; silent forgiveness never
      }
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      const o = obls[p.obligation];
      if (!o) return { rejected: `unknown_obligation: ${p.obligation}` };
      if (!SETTLEABLE.has(o.status)) return { rejected: `not_renegotiable: ${o.status}` };
      if (obls[p.new_id]) return { rejected: `duplicate_obligation: ${p.new_id}` };
      const now = q.time().minutes;
      let dueT = o.due_t;
      if (p.new_due_t !== undefined || p.new_due_in_min !== undefined) {
        const due = dueOf({ due_t: p.new_due_t, due_in_min: p.new_due_in_min }, now);
        if (due.error) return { rejected: due.error };
        dueT = due.t;
      }
      if (dueT <= now) return { rejected: 'past_due_at_creation: new due must be in the future' };
      const fresh = {
        ...o,
        id: p.new_id,
        amount: o.kind === 'Debt' ? (p.new_amount === undefined ? o.amount - o.paid : p.new_amount) : null,
        paid: 0, created_t: now, due_t: dueT, status: 'Active',
        statusHistory: [], links: { renegotiated_from: o.id },
      };
      return [
        { kind: 'ObligationRenegotiated', data: { id: o.id, successor: p.new_id } },
        { kind: 'ObligationCreated', data: { obligation: fresh } },
      ];
    },
  });

  kernel.onApply('ObligationCreated', (ev) => {
    const src = ev.data.obligation;
    obls[src.id] = { ...src, status: 'Active', statusHistory: [{ status: 'Active', t: ev.t, seq: ev.seq }] };
  });

  kernel.onApply('ObligationSettled', (ev) => {
    const o = obls[ev.data.id];
    if (!o) throw new Error('missing_obligation_in_apply');
    o.paid += ev.data.paid;
    if (!ev.data.complete) {
      // Partial: status unchanged, payment recorded truthfully in history.
      o.statusHistory.push({ status: o.status, t: ev.t, seq: ev.seq, partial: ev.data.paid });
    }
  });

  kernel.onApply('ObligationFulfilled', (ev) => {
    const o = obls[ev.data.id];
    if (!o) throw new Error('missing_obligation_in_apply');
    // History keeps any Broken past — never rewritten.
    o.status = 'Fulfilled';
    o.statusHistory.push({ status: 'Fulfilled', t: ev.t, seq: ev.seq, was_broken: ev.data.was_broken });
  });

  kernel.onApply('ObligationRenegotiated', (ev) => {
    const o = obls[ev.data.id];
    if (!o) throw new Error('missing_obligation_in_apply');
    o.status = 'Renegotiated'; // terminal; full history preserved on the old record
    o.statusHistory.push({ status: 'Renegotiated', t: ev.t, seq: ev.seq, successor: ev.data.successor });
  });

  const transition = (o, to, t, seq) => {
    o.status = to;
    o.statusHistory.push({ status: to, t, seq });
    return to === 'Due'
      ? { kind: 'ObligationDue', data: { id: o.id, kind: o.kind, owes: o.owes, owed: o.owed } }
      : { kind: 'ObligationBroken', data: { id: o.id, kind: o.kind, owes: o.owes, owed: o.owed } };
  };

  // Due processing on every step (M003 acceptance). Scan sorted by (due_t, id)
  // for cross-kernel determinism; bounded by obligation count (noted cost).
  kernel.on('StepAdvanced', (ev) => {
    const now = ev.data.minutes;
    const out = [];
    const ids = Object.keys(obls).sort((x, y) =>
      obls[x].due_t - obls[y].due_t || (x < y ? -1 : x > y ? 1 : 0));
    for (const id of ids) {
      const o = obls[id];
      if (o.status === 'Active' && now >= o.due_t) out.push(transition(o, 'Due', now, ev.seq));
      else if (o.status === 'Due' && now > o.due_t + o.grace_min) out.push(transition(o, 'Broken', now, ev.seq));
    }
    return out;
  });

  kernel.registerQuery('obligation', (id) => {
    const o = obls[id];
    return o ? JSON.parse(JSON.stringify(o)) : null;
  });
  kernel.registerQuery('obligations', (filter = {}) => {
    let list = Object.values(obls);
    if (filter.party) list = list.filter((o) => o.owes === filter.party || o.owed === filter.party);
    if (filter.status) list = list.filter((o) => o.status === filter.status);
    list.sort((a, b) => a.due_t - b.due_t || (a.id < b.id ? -1 : 1));
    return JSON.parse(JSON.stringify(list.slice(0, Math.min(filter.limit ?? 200, 200))));
  });
  kernel.registerQuery('due_soon', (within_min = 1440) => {
    const now = kernel.query().time().minutes;
    const w = Math.min(Math.max(within_min, 0), 525600);
    return JSON.parse(JSON.stringify(Object.values(obls)
      .filter((o) => (o.status === 'Active' || o.status === 'Due') && o.due_t - now >= 0 && o.due_t - now <= w)
      .sort((a, b) => a.due_t - b.due_t)));
  });
  kernel.registerQuery('overlaps', (person) => {
    const list = Object.values(obls).filter((o) =>
      (o.owes === person || o.owed === person) && (o.status === 'Active' || o.status === 'Due'));
    const pairs = [];
    for (let i = 0; i < list.length && pairs.length < 50; i++) {
      for (let j = i + 1; j < list.length && pairs.length < 50; j++) {
        const a = list[i], b = list[j];
        const s = Math.max(a.due_t, b.due_t), e = Math.min(a.due_t + a.grace_min, b.due_t + b.grace_min);
        if (s <= e) pairs.push([a.id, b.id]);
      }
    }
    return pairs;
  });

  // ---- Requests: pre-commitments created by Ask (M004). Fulfillment deferred.
  // A request is not an obligation: no lifecycle, no due processing. Decline
  // closes it; anything else leaves it open for M005+ verbs.
  const requests = {}; // id -> {id, asker, target, topic, detail, status, t, origin_id}

  kernel.registerStore('requests', {
    getState: () => ({ requests }),
    setState: (s) => {
      for (const k of Object.keys(requests)) delete requests[k];
      Object.assign(requests, s.requests);
    },
  });

  kernel.onApply('RequestOpened', (ev) => {
    const id = `req_${ev.seq}`;
    requests[id] = { ...ev.data, id, status: 'open' };
  });

  kernel.onApply('RequestDeclined', (ev) => {
    const r = requests[ev.data.id];
    if (!r) throw new Error('missing_request_in_apply');
    r.status = 'declined';
    r.declined_t = ev.t;
    r.declined_seq = ev.seq;
  });

  kernel.registerQuery('request', (id) => {
    const r = requests[id];
    return r ? { ...r } : null;
  });
  kernel.registerQuery('requests', (filter = {}) => {
    let list = Object.values(requests);
    if (filter.target) list = list.filter((r) => r.target === filter.target);
    if (filter.asker) list = list.filter((r) => r.asker === filter.asker);
    if (filter.status) list = list.filter((r) => r.status === filter.status);
    list.sort((a, b) => a.t - b.t);
    return JSON.parse(JSON.stringify(list.slice(0, 100)));
  });

  return {};
}

/** Seed helper through the pipeline (journaled, idempotent via stable cmd_ids). */
export function seedObligations(kernel, defs) {
  return defs.map((d, i) => kernel.dispatch({
    cmd_id: `seed_obl_${d.obligation_id}_${i}`, type: 'create_obligation', actor: 'seed', params: d,
  }));
}
