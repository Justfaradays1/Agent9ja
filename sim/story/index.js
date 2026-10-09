// sim/story/index.js — minimal seed scheduler. Owner: sim/story (M005).
//
// A seed is a scheduled journaled reminder: {id, fire_t, memo}. On each step,
// due seeds fire in (fire_t, id) order as SeedFired events. NOTHING consumes
// seeds yet — storylets arrive with M007. This is machinery with a documented
// absence of consumers, built now only because M005 requires the scheduler to
// exist for later milestones to schedule against. Cap 100 active.

export const SEED_CAP = 100;

export function createStory(kernel) {
  const seeds = {}; // id -> {id, fire_t, memo, origin_id}

  kernel.registerStore('story', {
    getState: () => ({ seeds }),
    setState: (s) => {
      for (const k of Object.keys(seeds)) delete seeds[k];
      Object.assign(seeds, s.seeds);
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

  kernel.onApply('SeedFired', (ev) => {
    const s = seeds[ev.data.seed_id];
    if (!s) throw new Error('missing_seed_in_apply');
    if (s.status === 'fired' || s.status === 'cancelled') return; // idempotency backstop; reaction booking is the real guard
    s.status = 'fired';
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
    const due = Object.values(seeds)
      .filter((s) => s.status === 'scheduled' && s.fire_t <= now)
      .sort((a, b) => a.fire_t - b.fire_t || (a.id < b.id ? -1 : 1));
    for (const s of due) s.status = 'firing';
    return due.map((s) => ({ kind: 'SeedFired', data: { seed_id: s.id, memo: s.memo } }));
  });

  return {};
}
