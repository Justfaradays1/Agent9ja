# PROGRESS.md — Agent9ja build log

## YOU ARE HERE → M000 done, entering M001

| ID | Status | Proof |
| M000 | DONE (2026-10-08) | `npm test` green (2/2 + boundary ok); skeleton committed; decisions recorded |
| M001 | NEXT | Kernel: ids/clock/RNG/pipeline/query/console/runner + determinism/cascade/order tests |

## Decisions made (M000)
- Stack: TS/Node20 sim headless; `npm test` via node:test per-file + boundary stub (dir-glob bug worked around by explicit file list).
- Content: JSON + JSON Schema Day 1. Target phone proxy Tecno Spark 10. Git+LFS.
- Kernel rules locked: tick order clock→dues→seeds→reactions→director; quiesce at step boundary; cascade depth 8 → CascadeGuardTripped; cmd_id idempotency; CommandRejected.
- Verbs: Ask/Promise/Vouch/Repay + Decline (5th); full mapping locked; no new verbs without milestone. Confidence kind deleted.
- Vouch optional M004, required M005. Debug why-* command set locked. Gates numeric (M010 ≥4/5 because, ≥3 divergences, ≥3/5 continue, ≥1 share).
- Future-proof: roles derived not classes; owns() transferable via events; disputes generic escalable; sim vs real money separate.
- Engine 3D spike NOT run (no engine installed); recorded as M000 gap — does not block M001–M010 (sim-first per architecture).

## Tests
- tests/unit/m000.test.js: 2/2 pass. Boundary stub: ok.
- Command: `npm test`.

## Proven
- One-command headless run works on Node 25.2.1 (dev laptop newer than Node 20 LTS target — note).
- Sim/game/content/tests skeleton exists; boundaries enforceable.

## Uncertain / Open
- Engine choice (spike pending), exact phone in hand, 5 playtester names, step size 5-min, stance thresholds, disclosure strictness, director params, content volume.
- Node version drift (dev 25 vs target 20) — pin or verify before M001.

## Next (M001)
Kernel only: IDs, clock+phases, seeded RNG streams, command/event/effect + applier, cascade guard, query skeleton, debug console command set, scenario runner. No people/money/UI. Acceptance: 7 days headless in budget, replay-identical, causal chain prints, guard trips on loop, boundary green.
