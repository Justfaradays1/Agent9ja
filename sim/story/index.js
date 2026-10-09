// sim/story/index.js — seeds (M005) + storylets, threads, director v1 (M007).
// Owner: sim/story.
//
// Model: storylets are content-defined situations evaluated against live
// state (never scripts); threads are persistent records with deadlines and
// default outcomes; the director orders and paces what surfaces. The player
// acts through existing verbs; M007 adds no dialogue, chat, or 3D.
// Queries (read-only): threads(), situations().
// Director v1 = caps + breather + no-stacking + joy-first ordering. A
// phase-cadence joy guarantee is explicitly deferred (needs surfacing memory,
// which would mutate on read).

export const SEED_CAP = 100;
export const OPEN_THREAD_CAP = 50;

export function createStory(kernel, { storylets = [], director = null } = {}) {
  const serr = validateStoryContent(storylets, director);
  if (serr) throw new Error(serr);
  const seeds = {}; // id -> {id, fire_t, memo, origin_id}
  const threads = {}; // id -> thread record
  const byId = new Map(storylets.map((s) => [s.id, s]));
  const rules = director || { maxOpenCrises: 1, breatherMin: 1440 };
  const state = { lastCrisisEndT: null };

  kernel.registerStore('story', {
    getState: () => ({ seeds, threads, director: { ...state } }),
    setState: (s) => {
      for (const k of Object.keys(seeds)) delete seeds[k];
      Object.assign(seeds, s.seeds);
      // Tolerate pre-M007 snapshots: threads/director default empty.
      for (const k of Object.keys(threads)) delete threads[k];
      Object.assign(threads, s.threads || {});
      state.lastCrisisEndT = (s.director || {}).lastCrisisEndT ?? null;
    },
  });

  kernel.registerCommand('schedule_seed', {
    validate: (p) => {
      if (!p || typeof p.seed_id !== 'string') return 'schedule_seed needs {seed_id, fire_t}';
      if (!/^[a-z]+_[A-Za-z0-9_]+$/.test(p.seed_id)) return 'bad seed_id';
      if (!Number.isInteger(p.fire_t)) return 'bad fire_t: absolute game minutes required';
      if (p.memo !== undefined && (typeof p.memo !== 'string' || p.memo.length > 140)) return 'bad memo';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (seeds[p.seed_id]) return { rejected: `duplicate_seed: ${p.seed_id}` };
      if (Object.keys(seeds).length >= SEED_CAP) return { rejected: 'seed_cap_reached' };
      if (p.fire_t <= q.time().minutes) return { rejected: 'seed_in_past: fire_t must be future' };
      const origin = p.origin_id === undefined ? 'origin_dev' : p.origin_id;
      if (!/^[a-z]+_[A-Za-z0-9_]+$/.test(origin)) return { rejected: 'bad origin_id' };
      return [{ kind: 'SeedScheduled', data: { seed_id: p.seed_id, fire_t: p.fire_t, memo: p.memo ?? null, origin_id: origin } }];
    },
  });

  kernel.registerCommand('cancel_seed', {
    validate: (p) => {
      if (!p || typeof p.seed_id !== 'string' || !/^[a-z]+_[A-Za-z0-9_]+$/.test(p.seed_id)) {
        return 'cancel_seed needs {seed_id}';
      }
      return null;
    },
    resolve: (cmd) => {
      const s = seeds[cmd.params.seed_id];
      if (!s) return { rejected: `unknown_seed: ${cmd.params.seed_id}` };
      if (s.status !== 'scheduled') return { rejected: `already_closed: ${s.status}` };
      return [{ kind: 'SeedCancelled', data: { seed_id: s.id } }];
    },
  });

  kernel.onApply('SeedScheduled', (ev) => {
    const d = ev.data;
    seeds[d.seed_id] = { id: d.seed_id, fire_t: d.fire_t, memo: d.memo, origin_id: d.origin_id, status: 'scheduled' };
  });

  kernel.onApply('SeedCancelled', (ev) => {
    const s = seeds[ev.data.seed_id];
    if (!s) throw new Error('missing_seed_in_apply');
    s.status = 'cancelled';
    s.closed_seq = ev.seq;
  });

  // Due seeds fire in (fire_t, id) order — deterministic across kernels.
  // Exactly-once booking: a multi-step command queues many StepAdvanced events
  // before any queued SeedFired is applied, so without a synchronous mark every
  // step past due would emit a duplicate. The mark is booking-only (never read
  // by queries; a snapshot can only observe it if a dispatch threw fatally
  // mid-way, in which case restore-from-backup is the documented recovery, not
  // continued use of the wounded kernel). The applier confirms.
  // Same precedent as obligations' transition().
  kernel.on('StepAdvanced', (ev) => {
    const now = ev.data.minutes;
    const dueSeeds = Object.values(seeds)
      .filter((s) => s.status === 'scheduled' && s.fire_t <= now)
      .sort((a, b) => a.fire_t - b.fire_t || (a.id < b.id ? -1 : 1));
    for (const s of dueSeeds) s.status = 'firing';
    const out = dueSeeds.map((s) => ({ kind: 'SeedFired', data: { seed_id: s.id, memo: s.memo } }));
    // Threads expire on the same tick, after seeds: deterministic order
    // (seeds → threads) keeps multi-system steps reproducible.
    const dueThreads = Object.values(threads)
      .filter((t) => t.status === 'open' && t.deadline_t <= now)
      .sort((a, b) => a.deadline_t - b.deadline_t || (a.id < b.id ? -1 : 1));
    for (const t of dueThreads) {
      t.status = 'expiring'; // booking mark; applier confirms (seed precedent)
      out.push({ kind: 'ThreadExpired', data: { id: t.id } });
      for (const e of t.default_events) out.push({ ...e, data: { ...e.data } });
    }
    return out;
  });

  kernel.onApply('SeedFired', (ev) => {
    const s = seeds[ev.data.seed_id];
    if (!s) throw new Error('missing_seed_in_apply');
    if (s.status === 'fired' || s.status === 'cancelled') return; // idempotency backstop; reaction booking is the real guard
    s.status = 'fired';
    s.closed_seq = ev.seq;
  });

  kernel.onApply('ThreadOpened', (ev) => {
    const d = ev.data.thread;
    threads[d.id] = { ...d };
  });

  kernel.onApply('ThreadClosed', (ev) => {
    const t = threads[ev.data.id];
    if (!t) throw new Error('missing_thread_in_apply');
    if (t.status !== 'open') return; // idempotency backstop
    t.status = 'closed';
    t.resolution = ev.data.resolution;
    t.closed_seq = ev.seq;
    if (t.tags.includes('crisis')) state.lastCrisisEndT = ev.t;
  });

  kernel.onApply('ThreadExpired', (ev) => {
    const t = threads[ev.data.id];
    if (!t) throw new Error('missing_thread_in_apply');
    if (t.status !== 'open' && t.status !== 'expiring') return; // idempotency backstop
    t.status = 'expired';
    t.closed_seq = ev.seq;
    if (t.tags.includes('crisis')) state.lastCrisisEndT = ev.t;
  });

  kernel.registerCommand('open_thread', {
    validate: (p) => {
      if (!p || typeof p.thread_id !== 'string') return 'open_thread needs {thread_id}';
      if (!/^[a-z]+_[A-Za-z0-9_]+$/.test(p.thread_id)) return 'bad thread_id';
      if (p.storylet !== undefined && typeof p.storylet !== 'string') return 'bad storylet ref';
      if (p.tags !== undefined) {
        if (!Array.isArray(p.tags) || p.tags.length > 8) return 'bad tags: array<=8';
        for (const t of p.tags) {
          if (typeof t !== 'string' || !/^[a-z][a-z0-9_]{0,31}$/.test(t)) return `bad tag: ${t}`;
        }
      }
      if (p.context !== undefined && (typeof p.context !== 'object' || p.context === null || Array.isArray(p.context))) {
        return 'bad context: plain object required';
      }
      if (p.default_events !== undefined && !Array.isArray(p.default_events)) return 'bad default_events';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (threads[p.thread_id]) return { rejected: `duplicate_thread: ${p.thread_id}` };
      const openCount = Object.values(threads).filter((t) => t.status === 'open').length;
      if (openCount >= OPEN_THREAD_CAP) return { rejected: 'thread_cap_reached' };
      let def = [];
      let tags = [...(p.tags || [])];
      if (p.storylet !== undefined) {
        const s = byId.get(p.storylet);
        if (!s) return { rejected: `unknown_storylet: ${p.storylet}` };
        def = s.on_expire || [];
        for (const t of s.tags || []) if (!tags.includes(t)) tags.push(t);
      }
      if (p.default_events !== undefined) def = p.default_events;
      const now = q.time().minutes;
      let deadline;
      if (p.deadline_t !== undefined && p.deadline_in_min !== undefined) {
        return { rejected: 'deadline_t and deadline_in_min are mutually exclusive' };
      } else if (p.deadline_t !== undefined) {
        if (!Number.isInteger(p.deadline_t)) return { rejected: 'bad deadline_t' };
        deadline = p.deadline_t;
      } else if (p.deadline_in_min !== undefined) {
        if (!Number.isInteger(p.deadline_in_min) || p.deadline_in_min < 0) return { rejected: 'bad deadline_in_min' };
        deadline = now + p.deadline_in_min;
      } else {
        return { rejected: 'deadline_t or deadline_in_min required' };
      }
      if (deadline <= now) return { rejected: 'deadline_in_past: deadline must be future' };
      // Default outcome events are validated now (not at fire time): kinds must
      // come from the applier-handled vocabulary and data must be plain JSON,
      // so a content bug fails here loudly instead of mid-simulation.
      // Reference checks (persons, accounts, relationships) also run now —
      // the future cannot be validated, but dangling refs can.
      for (const e of def) {
        const bad = checkDefaultEvent(e, q);
        if (bad) return { rejected: bad };
      }
      return [{
        kind: 'ThreadOpened',
        data: {
          thread: {
            id: p.thread_id, storylet: p.storylet ?? null, opened_t: now,
            deadline_t: deadline, context: p.context ? { ...p.context } : {},
            tags, default_events: def.map((e) => ({ kind: e.kind, data: { ...e.data } })),
            status: 'open', origin_id: 'origin_dev',
          },
        },
      }];
    },
  });

  kernel.registerCommand('close_thread', {
    validate: (p) => {
      if (!p || typeof p.thread_id !== 'string') return 'close_thread needs {thread_id}';
      if (!/^[a-z]+_[A-Za-z0-9_]+$/.test(p.thread_id)) return 'bad thread_id';
      if (typeof p.resolution !== 'string' || p.resolution.length === 0 || p.resolution.length > 140) {
        return 'bad resolution: non-empty string<=140 required';
      }
      return null;
    },
    resolve: (cmd) => {
      const t = threads[cmd.params.thread_id];
      if (!t) return { rejected: `unknown_thread: ${cmd.params.thread_id}` };
      if (t.status !== 'open') return { rejected: `already_closed: ${t.status}` };
      return [{ kind: 'ThreadClosed', data: { id: t.id, resolution: cmd.params.resolution } }];
    },
  });

  kernel.registerQuery('threads', (filter = {}) => {
    let list = Object.values(threads);
    if (filter.status) list = list.filter((t) => t.status === filter.status);
    if (filter.tag) list = list.filter((t) => t.tags.includes(filter.tag));
    list.sort((a, b) => a.deadline_t - b.deadline_t || (a.id < b.id ? -1 : 1));
    return JSON.parse(JSON.stringify(list.slice(0, 100)));
  });

  kernel.registerQuery('situations', () => {
    // Read-only view construction is side-effect free, so composing queries
    // here is safe (no recursion: building a view never evaluates it).
    const q = kernel.query();
    const now = q.time().minutes;
    const eligible = storylets.filter((s) => storyletEligible(s, q, threads));
    // No stacking: a storylet with an open thread is already in play.
    const openStorylets = new Set(
      Object.values(threads).filter((t) => t.status === 'open' && t.storylet).map((t) => t.storylet),
    );
    let list = eligible.filter((s) => !openStorylets.has(s.id));
    const openCrises = Object.values(threads).filter((t) => t.status === 'open' && t.tags.includes('crisis')).length;
    const inBreather = state.lastCrisisEndT !== null && now - state.lastCrisisEndT < rules.breatherMin;
    if (openCrises >= rules.maxOpenCrises || inBreather) {
      list = list.filter((s) => !s.tags.includes('crisis'));
    }
    // Joy sorts first when present; otherwise stable id order. Deterministic.
    list.sort((a, b) => {
      const aj = a.tags.includes('joy') ? 0 : 1, bj = b.tags.includes('joy') ? 0 : 1;
      return aj - bj || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    return list.map((s) => ({ id: s.id, tags: [...s.tags] }));
  });

  return {};
}

// Default-outcome events may only use applier-handled kinds, carry plain-JSON
// data, and reference entities that exist now. Balances and future states are
// unknowable at open time — those failures stay loud at fire time by design.
const DEFAULT_EVENT_KINDS = ['ObligationCreated', 'MoneyMoved', 'RelationshipNudged', 'RelationshipTagged'];

function checkDefaultEvent(e, q) {
  if (!e || typeof e !== 'object') return 'bad default_events: entries must be objects';
  if (!DEFAULT_EVENT_KINDS.includes(e.kind)) return `bad default event kind: ${e.kind}`;
  if (!e.data || typeof e.data !== 'object' || Array.isArray(e.data)) return 'bad default event data';
  try {
    JSON.parse(JSON.stringify(e.data));
  } catch {
    return 'bad default event data: must be plain JSON';
  }
  if (e.kind === 'ObligationCreated') {
    const o = e.data.obligation;
    if (!o || typeof o !== 'object') return 'bad ObligationCreated default: obligation required';
    if (o.kind === 'Debt' && q.balance(o.owes) === null) return `dangling account ref: ${o.owes}`;
    if (o.kind === 'Debt' && q.balance(o.owed) === null) return `dangling account ref: ${o.owed}`;
    if (!q.person(o.owes)) return `dangling person ref: ${o.owes}`;
    if (!q.person(o.owed)) return `dangling person ref: ${o.owed}`;
  }
  if (e.kind === 'MoneyMoved') {
    if (q.balance(e.data.from) === null) return `dangling account ref: ${e.data.from}`;
    if (q.balance(e.data.to) === null) return `dangling account ref: ${e.data.to}`;
    if (!Number.isInteger(e.data.amount) || e.data.amount <= 0) return 'bad MoneyMoved default: positive integer amount required';
  }
  if ((e.kind === 'RelationshipNudged' || e.kind === 'RelationshipTagged') && !q.rel(e.data.a, e.data.b)) {
    return `dangling relationship ref: ${e.data.a}>${e.data.b}`;
  }
  return null;
}

// Closed condition vocabulary. Each kind exists because a test storylet needs
// it; new kinds require a test that demands them (arch: no vocabulary creep).
function conditionHolds(c, q, threads) {
  switch (c.kind) {
    case 'obligations': {
      let list = q.obligations({ status: c.status } || {});
      if (c.party) list = list.filter((o) => o.owes === c.party || o.owed === c.party);
      if (c.gte !== undefined && !(list.length >= c.gte)) return false;
      if (c.lte !== undefined && !(list.length <= c.lte)) return false;
      return true;
    }
    case 'memories': {
      if (!c.person) return false;
      let list = q.what_they_remember(c.person);
      if (c.kind_name) list = list.filter((m) => m.kind === c.kind_name);
      if (c.gte !== undefined && !(list.length >= c.gte)) return false;
      return true;
    }
    case 'claims': {
      const list = q.claims(c.fact ? { fact: c.fact } : {});
      if (c.gte !== undefined && !(list.length >= c.gte)) return false;
      return true;
    }
    case 'threads': {
      let list = Object.values(threads);
      if (c.status) list = list.filter((t) => t.status === c.status);
      if (c.tag) list = list.filter((t) => t.tags.includes(c.tag));
      if (c.gte !== undefined && !(list.length >= c.gte)) return false;
      if (c.lte !== undefined && !(list.length <= c.lte)) return false;
      return true;
    }
    case 'time_past': {
      return q.time().minutes >= c.t;
    }
    case 'flag': {
      return q.flags()[c.key] === c.equals;
    }
    default:
      return false; // unknown kinds never match; loader rejects them first
  }
}

export function storyletEligible(s, q, threads = {}) {
  return (s.when || []).every((c) => conditionHolds(c, q, threads));
}

export function validateStoryContent(storylets, director) {
  if (!Array.isArray(storylets)) return 'storylets must be an array';
  const ids = new Set();
  const kinds = new Set(['obligations', 'memories', 'claims', 'threads', 'time_past', 'flag']);
  for (const [i, s] of storylets.entries()) {
    if (!s || typeof s.id !== 'string' || !/^[a-z]+_[A-Za-z0-9_]+$/.test(s.id)) {
      return `storylets[${i}].id invalid`;
    }
    if (ids.has(s.id)) return `duplicate storylet id: ${s.id}`;
    ids.add(s.id);
    if (!Array.isArray(s.tags)) return `storylets[${i}].tags must be an array`;
    for (const t of s.tags) {
      if (typeof t !== 'string' || !/^[a-z][a-z0-9_]{0,31}$/.test(t)) return `storylets[${i}] bad tag: ${t}`;
    }
    if (s.when !== undefined) {
      if (!Array.isArray(s.when)) return `storylets[${i}].when must be an array`;
      for (const c of s.when) {
        if (!c || !kinds.has(c.kind)) return `storylets[${i}] unknown condition kind: ${c && c.kind}`;
      }
    }
    if (s.on_expire !== undefined) {
      if (!Array.isArray(s.on_expire)) return `storylets[${i}].on_expire must be an array`;
      for (const e of s.on_expire) {
        if (!e || !DEFAULT_EVENT_KINDS.includes(e.kind)) return `storylets[${i}] bad on_expire kind: ${e && e.kind}`;
      }
    }
  }
  if (director !== null && director !== undefined) {
    if (!Number.isInteger(director.maxOpenCrises) || director.maxOpenCrises < 0) {
      return 'director.maxOpenCrises must be a non-negative integer';
    }
    if (!Number.isInteger(director.breatherMin) || director.breatherMin < 0) {
      return 'director.breatherMin must be a non-negative integer';
    }
  }
  return null;
}
