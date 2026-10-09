# Decision — Engineering Doctrine adoption (2026-10-08)

Standing constraint, not a milestone. Source: user-supplied doctrine brief.
Persisted as `docs/ENGINEERING_DOCTRINE.md` (13 sections, each marked
ENFORCED / CONVENTION / WHEN-SERVER / DEFERRED) + 4 compact rules in
`AGENTS.md` (§11–14).

Enforced in code this pass (all tested, none behavior-breaking to M001/M002):
- `COMMAND_EVENT_BUDGET = 256` → `BudgetGuardTripped` (breadth cap complements
  depth-8 cascade cap; retune with a test if M003+ workloads need more).
- Reaction isolation: throwing reaction → journaled `ReactionFailed`, pipeline
  continues; deterministic (same input, same failure).
- Fatal invariant violations propagate (`err.fatal`, e.g. ReentrantDispatch,
  malformed reaction output). Rule: content/runtime failures degrade gracefully;
  invariant violations fail loud.
- `journal(limit)` clamped to [0, JOURNAL_CAP]; fixed the `slice(-0)` whole-dump bug.
- WHEN-SERVER items (timeouts, rate limits, health checks, rollback, DB
  discipline, RLS) recorded in doctrine + AGENTS.md §14, deliberately NOT built.

Secrets audit 2026-10-08: grep for key/secret/token/password/private-key
patterns across sim/tools/tests/content/game/docs/package.json → zero hits.
Single-commit history (M000 only) → nothing to purge. `.gitignore` covers
env/logs/saves/artifacts; verified clean staging discipline continues.
