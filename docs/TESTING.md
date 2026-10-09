# Testing Discipline — Agent9ja
*Adopted from verification audit, 2026-10-08. Standing until explicitly revised.*

## The one command
`npm test` runs every stage in order and fails fast with the stage name:
1. **unit** — all `tests/unit/*.test.js` via `node --test`.
2. **content-lint** — all `content/**/*.json` parse + memory kinds gate-consumed.
3. **boundary** — import/blogic boundaries (sim→game, debug accessors, bridge rule).
4. **replay** — every `tests/scenario/proof-*.json` runs `--twice` (identical snapshots).

`npm test` is manual (no hooks, no CI). Run it before and after every change;
`AGENTS.md` already requires this — this doc defines what "green" means.

## What green proves (and does not prove)
- Proves: unit behaviors + rejections, determinism, idempotency, snapshot
  round-trips, guards (cascade/budget), boundary confinement, content loadability,
  replay equality on scripted scenarios.
- Does NOT prove: fun, performance on real phones (budgets are headless,
  except target-device checks at M012/M018), production readiness, traffic
  capacity, multiplayer safety, or real-player behavior. Never present green
  as any of those.

## Rules
1. One command, staged, named failures. A new verification type becomes a new
   stage, not a wiki instruction.
2. No test edits to green. Failing test = information; fix code or, if the
   test is wrong, say so in the report and fix the test openly.
3. Every check must be runnable AND have a negative control on record:
   boundary trips on planted violations, runner exits 1 on failing asserts
   (both demonstrated 2026-10-08 with temp probes, removed after).
4. New behavior ships with: happy path, rejection paths, idempotency,
   determinism, snapshot/restore, frozen-view, and content-validation tests
   where applicable. A happy-path-only test is insufficient — say so in review.
5. Manual-only verification (console demos, device checks) is reported as
   observed, never folded into pass counts.
6. Scenario proofs live in `tests/scenario/proof-*.json` so replay is
   repeatable, not a console transcript in a report.
7. Do not add frameworks, CI, or coverage gates without a concrete failure
   they would have caught. Current scale does not justify them.
