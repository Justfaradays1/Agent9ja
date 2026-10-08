# Decision — M000 stack + REQUIRED red-team patches (2026-10-08)

Locked to unblock M001. All reversible except sim/presentation split.

- Sim language: TypeScript on Node 20 LTS (headless CLI, no engine imports). Why: agents + tests run headless; Godot stays presentation-only.
- Test: `npm test` → `tools/run-tests.js` (node:test per-file + boundary stub). Why: one command, no framework until M006.
- Content: JSON + JSON Schema Day 1. Why: diffable, agent-editable, linter-validated.
- Phone proxy: Tecno Spark 10 (4GB, Android 13) or documented substitute. Emulator ≠ evidence.
- VCS: Git + Git LFS for assets/. Builds ignored.
- Kernel: same-tick order clock→dues→seeds→reactions→director; quiesce at step boundary; cascade depth 8 → CascadeGuardTripped; cmd_id idempotency; CommandRejected on invalid. Why: kills same-tick races, mid-save corruption, double-tap duplicates.
- Verbs: added Decline as 5th command; mapped Offer/Accept/Buy/Work/Give/Borrow/Introduce/Warn/Invite/Leave; no new verbs without milestone. Deleted `Confidence` obligation kind (privacy flag, not debt).
- Vouch optional at M004, required M005. Why: don't gate track on riskiest item.
- Debug console contract locked (inspect/advance/send/seed/replay/diff/trace + why-available/believe/storylet/consequence).
- Gates numeric: M010 ≥4/5 because-explanations, ≥3 divergences, ≥3/5 continue intent, ≥1 unprompted share; M016 same in 3D + “my compound”.
- Future-proof: roles are derived states (never person class); owns(person,asset) transferable via events; disputes generic claim escalable Conversation→…→Court; sim money vs future real-money strictly separate.
