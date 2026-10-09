# Engineering Doctrine — Lightweight, Resilient, Change-Safe
*Standing constraint for Agent9ja. Adopted 2026-10-08. Applies to every milestone.*
*Read with `AGENTS.md` (session rules) and `AGENT9JA_ARCHITECTURE.md` (system design).*

> **Simple enough to understand. Isolated enough to change. Resilient enough to fail safely.**

This is NOT permission for premature infrastructure: no microservices, no Kubernetes,
no queues-everywhere, no distributed-system prestige. Optimize for
**low operational complexity + clear boundaries + safe evolution.**

Each section is marked with its enforcement status:
**ENFORCED** (tested now) · **CONVENTION** (review-checked, no test yet) ·
**WHEN-SERVER** (applies once a server/network layer exists) ·
**DEFERRED** (explicitly later; see trigger).

## 1. Traffic resilience — ENFORCED (sim) / WHEN-SERVER (network)
Every system carries explicit workload boundaries. Never assume NPC/user/task
counts stay small forever.

Enforced in sim now:
- Cascade depth 8 → `CascadeGuardTripped` (no infinite loops).
- Per-command event budget → `BudgetGuardTripped` (no unbounded work per tick).
- Bounded journal (500), bounded seen-table (2000, documented for M006 compaction).
- Fixed-step clock: frame rate never affects outcomes.
- `journal(limit)` clamped; pagination, never unbounded dumps.
- Deterministic seeded RNG only; no wall-clock, no unseeded randomness in `sim/`
  (grep-tested).

When a server exists: bounded bodies, trust-boundary validation, timeouts,
rate limits on abuse-prone endpoints, paginated queries, no N+1, no full-world
loads for slice reads, no expensive sync work on request paths.

## 2. Graceful failure — ENFORCED
One non-critical failure must not take down unrelated systems.
Fail one operation safely → preserve authoritative state → report the failure.
Never fail silently.

Enforced in sim now:
- Reaction isolation: a throwing reaction journals `ReactionFailed` and the
  pipeline continues with remaining reactions. Same input → same failure
  (deterministic), so it is debuggable, not hidden.
- Programmer-invariant violations still fail LOUD (reentrant dispatch,
  malformed reaction output, duplicate registrations): these are agent bugs,
  and swallowing them would hide corruption. Rule: *content/runtime failures
  degrade gracefully; invariant violations throw.*
- Rejected commands journal `CommandRejected` with reason; state untouched.
- Atomic saves (temp file + replace), rolling backups, corruption fallback (M006).

## 3. Change-safe architecture — CONVENTION (boundary-tested)
Keep `sim` owning truth; `game` mutates only via bridge Commands; content stays
data/schema-driven; queries stay read-only; derived state is never authoritative.
A change to relationships must not require rewriting money; a housing change
must not require rewriting the character system; a UI redesign must not change
rules. (This is why sim comes before 3D.) Boundary tool enforces import rules
on every test run.

## 4. Version everything that outlives code — ENFORCED (partial)
Snapshots carry schema + content versions; migrations are ordered functions with
fixture tests; never silently reinterpret a saved field. Save compat is tested
(round-trip, continued-run equality, migration fixtures). WHEN-SERVER: same
discipline for API contracts, DB migrations, config.

## 5. Safe deployment — WHEN-SERVER (prepare, don't build)
No heavyweight rollout machinery now. When users approach: health checks,
graceful startup/shutdown, env separation, reproducible builds, pinned deps
(zero deps today — keep it that way per §11), migration discipline, rollback,
backups + restore tests, error monitoring, smoke tests. Prefer
deploy → verify → monitor → expand.

## 6. Database safety — WHEN-SERVER
No database exists yet. When one does: no unbounded queries, no full-table ops
in request paths, transactions for atomic changes, constraints, validated
inputs, migration discipline, least-privilege credentials, RLS where hosted.
The simulation server stays authoritative — clients never write truth directly.

## 7. Security hygiene — ENFORCED (repo) / WHEN-SERVER (endpoints)
- No secrets/tokens/passwords in source; `.env*` ignored (audited at adoption).
- Never commit credentials, dumps, saves, logs, artifacts (`.gitignore` enforced).
- Validate all external input (command validators reject with reasons).
- WHEN-SERVER: rate-limit auth/abuse endpoints, lock + review deps, scan where
  practical, never trust client authorization, review AI-generated
  security/auth/payment/ownership code.
- Agent9ja-specific, permanent: **the 3D client is never authoritative.**
  It may request commands only. It must not manufacture `GiveMoney`,
  `ChangeRelationship`, `CompleteObligation`, `ChangeHousing`, `SetReputation`,
  or `UnlockKnowledge` — the simulation decides legality. (Already true by
  construction: no game layer exists and the bridge rule will enforce it.)

## 8. Observability without noise — ENFORCED (sim) / CONVENTION (ops)
Structured failure evidence, not log floods: `CommandRejected`,
`CascadeGuardTripped`, `BudgetGuardTripped`, `ReactionFailed` are journaled
facts with causes, queryable via `trace`. Never log passwords, tokens, secrets,
or unnecessary personal data. Debug tooling is verbose locally; production
logging stays controlled.

## 9. Runaway-work protection — ENFORCED
Cascade depth limit, per-command event budget, deterministic order, `cmd_id`
idempotency, bounded journal/seen tables, explicit guard events with
diagnostics. A theoretically elegant sim that can consume unlimited CPU is
rejected by this doctrine.

## 10. Performance as budget — CONVENTION
No premature optimization; budgets early enough that architecture can't make
optimization impossible. Tracked now: sim-step time (7 days < 2000ms test),
save size implicitly via bounded structures. Cheap-Android constraint stands:
small world + meaningful sim over huge world + shallow sim.

## 11. Dependency discipline — ENFORCED
Zero runtime dependencies today. Before adding any package: can the stack solve
it? Does it reduce complexity? New failure point? Maintainable in 6 months?
Material product help? If not all yes, don't add.

## 12. No premature distribution — ENFORCED (by absence)
Monolith sim, local-first, no queues/workers/caches/services/replicas until an
observed workload justifies them. The M000–M010 sim has no network at all.

## 13. Tests protect future changes — ENFORCED
Invariants under test now: money/unit conservation patterns, relationship
bounds + direction, obligation lifecycle (M003+), information boundaries
(no-truth-leak, independent corroboration), save/load compat, migrations (M006),
idempotency, cascade + budget guards, deterministic replay, content validation,
boundary imports, perf budgets where set. Failing test = information; never
edit tests to green.
