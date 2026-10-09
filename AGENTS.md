# AGENTS.md — rules every coding agent must follow (M000)

1. Six questions sim must answer (§1 arch): who knows what+sure; who owes whom what+wording; what they remember+what changes; what can I do + why not; what due + if ignored; where is everyone + doing.
2. Principles P1–P12: sim/presentation split; one writer (Command→Event→Effect); deterministic seeded; data over code; place-level; every option explains itself; memory must be consumed (lint); no player truth access; bounded; local headless; smallest first; flavour≠mechanics.
3. Hard boundaries: sim/ never imports game/; game/ writes sim only via bridge Commands; ground truth only via knowledge/verbs resolvers; content/ data-only.
4. One milestone at a time. Read only current milestone + prereqs + cited sections.
5. Never build milestone DO NOT BUILD list.
6. Never edit/delete tests to green. Failing test = information; ask human.
7. Run `npm test` before and after. Report results in commit note.
8. Update docs/PROGRESS.md + Resume Tracker per milestone; note decision changes in docs/decisions/.
9. Rules belong in sim/content, never UI. Unsure scope → stop and ask.
10. Same-tick order locked: clock → dues → seeds → reactions → director (phase only); stable-ID tiebreak. Saves at step boundaries only. Commands carry cmd_id (idempotent). Cascade depth 8 → CascadeGuardTripped.
11. Engineering Doctrine (`docs/ENGINEERING_DOCTRINE.md`) is standing law: lightweight, resilient, change-safe. No premature infra/services/queues. Every new system needs an explicit workload bound (caps, depth/breadth limits, bounded histories). Content/runtime failures degrade gracefully with journaled evidence (`CommandRejected`/`CascadeGuardTripped`/`BudgetGuardTripped`/`ReactionFailed`); invariant violations fail loud, never swallowed.
12. Boundaries from doctrine, enforced: sim owns truth; game mutates only via bridge Commands (client is never authoritative — no manufactured GiveMoney/ChangeRelationship/etc.); content is data-only; queries are frozen read views; derived state is never saved as authority. Snapshots carry versions; migrations are tested; never reinterpret a saved field silently.
13. Hygiene: zero new dependencies without passing the 5 doctrine questions; no secrets/env/logs/saves/artifacts in Git (check `.gitignore`); validate all external input with reasons; no personal data in logs; failing test = information, never edit tests green.
14. Ops rules activate WHEN-SERVER (not now): bounded bodies, timeouts, rate limits, pagination, health checks, graceful shutdown, pinned builds, rollback, backups + restore tests. Do not build any of this prematurely.
15. Player-led product rule (`docs/PLAYER_RESEARCH.md` is the record): storyboard and prior docs are hypotheses, not spec. Significant product decisions need an evidence note (what players said + source/date, need inferred, confidence + counterevidence, alternatives, hypothesis ID). Never invent quotes/stats. Weak evidence → say so, keep the change small and reversible. Later milestones inherit open hypotheses H2–H4; H5 is a standing constraint.
