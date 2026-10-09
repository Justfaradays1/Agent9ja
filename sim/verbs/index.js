// sim/verbs/index.js — Ask, Promise, Vouch, Repay, Decline. Owner: sim/verbs (M004).
//
// Verbs hold NO state. They read through queries + privileged owner-module
// readers, and emit events that owner-module appliers apply. Obligation
// creation/settlement reuse obligations' shared builders (no duplicated rules).
// Favour obligations use the same lifecycle; their settlement is completion.
// Vouch creates a contingent record ONLY — inheritance consequences are M005.
//
// Favour cost defaults (slice constants, documented): due in 7 days, grace 3.
// Asking always costs a favour, even when refused: attention is the price.

import { assertId } from '../kernel/ids.js';
import { buildCreateEvents, buildSettleEvents } from '../obligations/index.js';
import { evaluateDisclosure, STEP_DOWN } from '../knowledge/index.js';

const TOPICS = new Set(['information', 'money', 'shelter', 'introduction']);
const FAVOUR_DUE_MIN = 10080;
const FAVOUR_GRACE_MIN = 1440;

export function validateTemplates(templates) {
  if (!Array.isArray(templates)) return 'templates must be an array';
  for (const [i, t] of templates.entries()) {
    if (!t || typeof t.id !== 'string') return `template[${i}] needs an id`;
    try { assertId(t.id, 'template'); } catch { return `template[${i}] bad id`; }
    if (t.kind !== 'Debt' && t.kind !== 'PromisedAction') return `template[${i}].kind must be Debt|PromisedAction`;
    if (t.kind === 'Debt' && (!Number.isInteger(t.amount) || t.amount <= 0)) {
      return `template[${i}].amount must be a positive integer`;
    }
    if (t.kind === 'PromisedAction' && (typeof t.subject !== 'string' || !t.subject)) {
      return `template[${i}].subject required`;
    }
    if (!Number.isInteger(t.due_in_min) || t.due_in_min < 1) return `template[${i}].due_in_min must be >= 1`;
  }
  return null;
}

export function createVerbs(kernel, { templates = [], knowledge, peopleReads, kinds, memoryReads = null }) {
  const terr = validateTemplates(templates);
  if (terr) throw new Error(terr);
  const byId = new Map(templates.map((t) => [t.id, t]));
  if (!knowledge || !peopleReads || !kinds) throw new Error('verbs need {templates, knowledge, peopleReads, kinds}');
  // memoryReads is optional: without memory wiring, gates stay open exactly as
  // in M004 (documented safe default, never a silent behavior change).

  const readsFor = (q) => {
    // Verbs require the obligations module (favour + lookups). Fail loud on
    // miswiring rather than crashing deep inside a builder.
    if (typeof q.obligation !== 'function' || typeof q.balance !== 'function') {
      throw new Error('verbs_need_obligations: wire createObligations before createVerbs');
    }
    return {
      obligationById: (id) => q.obligation(id),
      personExists: (id) => !!q.person(id),
      balanceOf: (id) => q.balance(id),
      now: () => q.time().minutes,
      scarred: memoryReads
        ? (owes, owed) => {
            const hit = memoryReads.memoriesOf(owes).find((m) => m.kind === 'broke_promise' && m.subject === owed);
            return hit ? hit.id : null;
          }
        : () => null,
    };
  };

  const favourFor = (asker, target, topic, detail) => ({
    obligation_id: null, // filled per-command below (deterministic from cmd_id)
    kind: 'Favour',
    owes: asker,
    owed: target,
    subject: `asked ${topic}${detail ? `:${detail}` : ''}`.slice(0, 280),
    due_in_min: FAVOUR_DUE_MIN,
    grace_min: FAVOUR_GRACE_MIN,
    reason: 'implicit favour of asking',
  });

  kernel.registerCommand('ask', {
    validate: (p) => {
      if (!p || typeof p.asker !== 'string' || typeof p.target !== 'string') return 'ask needs {asker, target, topic}';
      try { assertId(p.asker, 'asker'); assertId(p.target, 'target'); } catch { return 'ask needs stable person ids'; }
      if (!TOPICS.has(p.topic)) return 'bad topic: information|money|shelter|introduction';
      if (p.topic === 'information') {
        try { assertId(p.fact, 'fact'); } catch { return 'information ask needs a fact id'; }
      }
      if (p.topic === 'money') {
        if (!Number.isInteger(p.amount) || p.amount <= 0) return 'money ask needs a positive integer amount';
      }
      if (p.topic === 'introduction') {
        try { assertId(p.person, 'person'); } catch { return 'introduction ask needs a person id'; }
      }
      if (p.detail !== undefined && (typeof p.detail !== 'string' || p.detail.length > 140)) return 'bad detail';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (!q.person(p.asker)) return { rejected: `unknown_person: ${p.asker}` };
      if (!q.person(p.target)) return { rejected: `unknown_person: ${p.target}` };
      if (p.asker === p.target) return { rejected: 'no_self_ask' };
      const out = [];
      // Implicit favour of asking (arch §8.8): attention costs, even when refused.
      const fav = favourFor(p.asker, p.target, p.topic, p.detail ?? (p.fact ?? null));
      fav.obligation_id = `fav_${cmd.cmd_id}`;
      const created = buildCreateEvents(fav, kinds, readsFor(q));
      if (created.rejected) return created;
      out.push(...created);

      if (p.topic === 'information') {
        if (!knowledge.reads.factExists(p.fact)) return { rejected: `unknown_fact: ${p.fact}` };
        const belief = knowledge.reads.beliefOf(p.target, p.fact);
        if (!belief) {
          return [...out, {
            kind: 'DisclosureDefused',
            data: { fact: p.fact, speaker: p.target, asker: p.asker, kind: 'Deflect', steps: [{ kind: 'no-belief' }] },
          }];
        }
        const stanceFn = typeof q.stance === 'function' ? (a, b) => q.stance(a, b) : () => null;
        const mem = memoryReads ? memoryReads.memoriesOf(p.target) : [];
        const burnedBy = mem.find((m) => m.kind === 'was_owed_broken' && m.subject === p.asker);
        const repaidBy = !burnedBy && mem.find((m) => m.kind === 'was_repaid' && m.subject === p.asker);
        const { outcome: base, steps } = evaluateDisclosure({
          rule: knowledge.reads.ruleFor(p.target, p.fact),
          stance: stanceFn(p.target, p.asker),
          npcTags: peopleReads.incentivesOf(p.target) || [],
          factTags: knowledge.reads.factTags(p.fact) || [],
        });
        // M005 memory gate: a burn downgrades one step (mislead stands);
        // a clean repayment upgrades Shade/Deflect one step (rule Refuse/Mislead stand).
        let outcome = base;
        if (burnedBy && outcome !== 'mislead' && outcome !== 'refuse') {
          const from = outcome;
          outcome = STEP_DOWN[outcome];
          steps.push({ kind: 'memory', memory: burnedBy.id, from, to: outcome });
        } else if (repaidBy && (outcome === 'shade' || outcome === 'deflect')) {
          const from = outcome;
          outcome = from === 'shade' ? 'tell' : 'shade';
          steps.push({ kind: 'memory', memory: repaidBy.id, from, to: outcome });
        }
        if (outcome === 'tell' || outcome === 'shade' || outcome === 'mislead') {
          const asserted = outcome === 'mislead'
            ? knowledge.reads.ruleFor(p.target, p.fact).false_value
            : belief.value;
          out.push({
            kind: 'ClaimHeard',
            data: {
              claim: {
                fact: p.fact, asserted, speaker: p.target, asker: p.asker,
                origin_id: belief.origin_id, certainty: belief.certainty,
                shading: outcome === 'shade' ? 'partial' : null,
              },
            },
          });
        } else {
          out.push({
            kind: 'DisclosureDefused',
            data: { fact: p.fact, speaker: p.target, asker: p.asker, kind: outcome, steps },
          });
        }
        return out;
      }

      // money / shelter / introduction: recorded request, fulfilment deferred.
      const detail = p.topic === 'money' ? `amount:${p.amount}`
        : p.topic === 'introduction' ? `person:${p.person}`
        : (p.detail ?? '');
      if (p.topic === 'introduction' && !q.person(p.person)) {
        return { rejected: `unknown_person: ${p.person}` };
      }
      out.push({
        kind: 'RequestOpened',
        data: { asker: p.asker, target: p.target, topic: p.topic, detail, origin_id: 'origin_dev' },
      });
      return out;
    },
  });

  kernel.registerCommand('promise', {
    validate: (p) => {
      if (!p || typeof p.template !== 'string') return 'promise needs {template, owes, owed}';
      try { assertId(p.template, 'template'); } catch { return 'bad template id'; }
      if (typeof p.owes !== 'string' || typeof p.owed !== 'string') return 'promise needs parties';
      try { assertId(p.owes, 'owes'); assertId(p.owed, 'owed'); } catch { return 'parties need stable ids'; }
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      const t = byId.get(p.template);
      if (!t) return { rejected: `unknown_template: ${p.template}` };
      return buildCreateEvents({
        obligation_id: `prom_${cmd.cmd_id}`,
        kind: t.kind, owes: p.owes, owed: p.owed,
        amount: t.amount, subject: t.subject,
        due_in_min: t.due_in_min, grace_min: t.grace_min,
        reason: `promise:${t.id}`,
      }, kinds, readsFor(q));
    },
  });

  kernel.registerCommand('vouch', {
    validate: (p) => {
      if (!p || typeof p.voucher !== 'string' || typeof p.subject !== 'string' || typeof p.audience !== 'string') {
        return 'vouch needs {voucher, subject, audience}';
      }
      try { assertId(p.voucher, 'voucher'); assertId(p.subject, 'subject'); assertId(p.audience, 'audience'); }
      catch { return 'vouch needs stable ids'; }
      if (p.reason !== undefined && (typeof p.reason !== 'string' || p.reason.length > 140)) return 'bad reason';
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      // M005 vouch-eligibility gate: a burned history with the audience (or
      // the audience's burn scar naming the voucher) refuses with the memory
      // cited. Clean histories pass through untouched.
      if (memoryReads) {
        const own = memoryReads.memoriesOf(p.voucher).find((m) => m.kind === 'broke_promise' && m.subject === p.audience);
        if (own) return { rejected: `voucher_burned_with_audience (memory:${own.id})` };
        const theirs = memoryReads.memoriesOf(p.audience).find((m) => m.kind === 'was_owed_broken' && m.subject === p.voucher);
        if (theirs) return { rejected: `voucher_burned_with_audience (memory:${theirs.id})` };
      }
      // Creation only. Inheritance consequences are M005+ story work, not here.
      return buildCreateEvents({
        obligation_id: `vouch_${cmd.cmd_id}`,
        kind: 'Vouch', owes: p.voucher, owed: p.audience, subject: p.subject,
        due_in_min: p.due_in_min ?? FAVOUR_DUE_MIN, grace_min: p.grace_min ?? FAVOUR_GRACE_MIN,
        reason: p.reason ?? 'vouch',
      }, kinds, readsFor(q));
    },
  });

  kernel.registerCommand('repay', {
    validate: (p) => {
      if (!p || typeof p.obligation !== 'string') return 'repay needs {obligation}';
      try { assertId(p.obligation, 'obligation'); } catch { return 'bad obligation ref'; }
      if (p.payer !== undefined) { try { assertId(p.payer, 'payer'); } catch { return 'bad payer'; } }
      return null;
    },
    resolve: (cmd, q) => {
      const o = q.obligation(cmd.params.obligation);
      if (!o) return { rejected: `unknown_obligation: ${cmd.params.obligation}` };
      return buildSettleEvents(o, cmd.params, { balanceOf: (id) => q.balance(id) });
    },
  });

  kernel.registerCommand('decline', {
    validate: (p) => {
      if (!p || typeof p.request !== 'string') return 'decline needs {request}';
      try { assertId(p.request, 'request'); } catch { return 'bad request ref'; }
      if (p.decliner !== undefined) { try { assertId(p.decliner, 'decliner'); } catch { return 'bad decliner'; } }
      return null;
    },
    resolve: (cmd, q) => {
      const r = q.request(cmd.params.request);
      if (!r) return { rejected: `unknown_request: ${cmd.params.request}` };
      const decliner = cmd.params.decliner === undefined ? r.target : cmd.params.decliner;
      if (decliner !== r.target) return { rejected: 'only_target_declines' };
      if (r.status !== 'open') return { rejected: `already_closed: ${r.status}` };
      return [{ kind: 'RequestDeclined', data: { id: r.id } }];
    },
  });

  kernel.registerQuery('promise_templates', () => byId.size > 0
    ? [...byId.values()].map((t) => ({ id: t.id, kind: t.kind }))
    : []);

  // Interaction menu: available verbs with reasons + cost previews.
  // Never lists topics the target knows (no existence leak); repay/decline
  // availability derives from real state. Tolerates unwired modules (queries
  // may be absent in partial test kernels) by reporting unknown, never throwing.
  kernel.registerQuery('interaction_menu', (asker, target) => {
    const q = kernel.query();
    if (!q.person(asker)) return { error: `unknown_person: ${asker}` };
    if (!q.person(target)) return { error: `unknown_person: ${target}` };
    if (asker === target) return { error: 'no_self_menu' };
    const stance = typeof q.stance === 'function' ? q.stance(target, asker) : null;
    const settleable = typeof q.obligations === 'function'
      ? (q.obligations({ party: asker }) || []).filter((o) => o.owed === target && ['Active', 'Due', 'Broken'].includes(o.status))
      : null;
    const openCount = typeof q.requests === 'function'
      ? (q.requests({ target: asker, status: 'open' }) || []).length
      : null;
    const menu = [
      {
        verb: 'ask_information', available: true,
        reasons: stance ? [`${target} is ${stance} toward you`] : ['no relationship yet'],
        cost: { favour: true },
      },
      {
        verb: 'ask_money', available: true, reasons: ['creates a favour + open request'],
        cost: { favour: true },
      },
      {
        verb: 'ask_shelter', available: true, reasons: ['creates a favour + open request'],
        cost: { favour: true },
      },
      {
        verb: 'ask_introduction', available: true, reasons: ['creates a favour + open request'],
        cost: { favour: true },
      },
      {
        verb: 'promise', available: true, reasons: [`${byId.size} templates available`],
        cost: { obligation: true },
      },
      {
        verb: 'vouch', available: true,
        reasons: ['contingent liability; consequences deferred to M005'],
        cost: { contingent: true },
      },
      settleable === null
        ? { verb: 'repay', available: false, reasons: ['obligation ledger not wired'], cost: {} }
        : settleable.length > 0
          ? {
              verb: 'repay', available: true,
              reasons: [`${settleable.length} open obligation(s) to ${target}`],
              cost: { money: 'outstanding remainder' },
            }
          : { verb: 'repay', available: false, reasons: [`no outstanding obligation to ${target}`], cost: {} },
      openCount === null
        ? { verb: 'decline', available: false, reasons: ['request ledger not wired'], cost: {} }
        : openCount > 0
          ? {
              verb: 'decline', available: true,
              reasons: [`${openCount} open request(s) addressed to you`], cost: {},
            }
          : { verb: 'decline', available: false, reasons: ['no open requests addressed to you'], cost: {} },
    ];
    return menu;
  });

  return {};
}
