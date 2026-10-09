# PROGRESS.md — Agent9ja build log

## YOU ARE HERE → CP1 batch (reload honesty, titles, ask amount, derived defaults) + cp1-start scenario built, re-review pending; Phase 2 needs authorization

Standing: `docs/ENGINEERING_DOCTRINE.md` (ENFORCED/CONVENTION/WHEN-SERVER/DEFERRED) + `AGENTS.md` §11–14.
Product: player-led doctrine adopted 2026-10-08 — `docs/PLAYER_RESEARCH.md` is the evidence record, `AGENTS.md` §15 governs; storyboard/prior docs are hypotheses (H1 supported; H2–H4 open into M010; H5 standing constraint).

| ID | Status | Proof |
| M000 | DONE (2026-10-08, tag `M000`) | `npm test` green; skeleton; decisions recorded |
| M001 | DONE (2026-10-08, uncommitted) | 25/25 tests; replay-identical; 7 proofs in log below |
| M002 | DONE (2026-10-08, uncommitted) | 45/45 tests; directional proofs in log below |
| M003 | DONE (2026-10-08, uncommitted) | 72/72 tests; money/obligation proofs below |
| M004 | DONE (2026-10-08, uncommitted) | 101/101 tests; knowledge/verb proofs below |
| M005 | DONE (2026-10-08, uncommitted) | 118/118 tests (101 prior + 17 new); proofs below |
| M006 | DONE (2026-10-08, uncommitted) | file persistence contract proven, see M006 notes; re-verified under second authorization (18 save tests) |
| M007 | DONE (2026-10-08, commit `58c629b`) | storylets + threads + director v1 proven, see M007 notes |
| M008 | DONE (2026-10-09, commit `693b186`) | DMs + compound group + overhearing + book + notifications proven, see M008 notes |
| M009 | DONE (2026-10-09, commit `72c56b0`) | places + routines + intent + resources + levy chain proven, see M009 notes |

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
- `npm test` → 45/45 pass (25 M001 + 20 M002) + boundary ok.
- M002 proofs: directional asymmetry (A→B without B→A); creation guards (self/dup/missing/bad-id/bad-dim); clamp 0..100 + cmd_id-safe repeats; tag round-trip + safe absent-remove no-op; threshold crossing; ±1 hysteresis (Frosty held at 21, released at 26); content-only rule swap changes stance; standing {stance,tags,favour:0}; origin_dev provenance; seed-helper replay equality; trace→cmd for nudges; save/restore with people+rels continues identically; M000/M001 still green.
- Two test-caught bugs fixed honestly: open-validator rejected defaulted dims; checkDims conflated open/nudge contracts (split into checkProvidedDims + explicit delta rule).

## M002 implementation notes (no arch change)- Pipeline gained additive registries only: registerCommand/Store/onApply/registerQuery (+resolver {rejected} path, stores in snapshot/restore). M001 behavior verified unchanged (25 green before + after).
- Favour balance intentionally 0 with contract comment — M003 ledger owns it. No traits stored (M004 owns them with disclosure rules). No roles stored anywhere.
- Console: --person/--rel read-only views verified live.
- M001 proofs (all recorded 2026-10-08):
  1. Suite green, boundary green.
  2. Replay: `scenario-runner proof-replay.json --twice` → identical, hash `76a8c615`.
  3. Idempotency: `cmd_once` sent twice → applied once + duplicate, value stays 1.
  4. Ordering: reactions FIFO in registration order, children queue behind; seqs monotonic.
  5. Cascade: self-loop trips `CascadeGuardTripped` at depth 8, branch halted.
  6. No unauthorized path: query views frozen (mutation throws), sim/ grep clean of Math.random/Date.now, bridge-only rule intact.
  7. why-*: console `--trace 1` returns FlagSet←cmd_w1 chain; rejections carry reason on journal.

## Architecture deviations found while building (honest log)
- Restore-into-differently-seeded kernel diverged on `seed` field → fixed: restore takes rootSeed from save (save fully determines future). Kernel + test updated, no doc change needed (matches §10 intent).
- `node --test <dir>` fails on this machine → runner passes explicit file list. Tooling-only.
- Two proof-script assertion errors were mine (stepCount 12 not 15; phase is derived, not saved) — sim was right both times. No doc change.
- JS ESM kept (see m000-baseline note); strict tsc trigger stays M006.

## Proven
- One-command headless run works on Node 25.2.1 (dev laptop newer than Node 20 LTS target — note).
- Sim/game/content/tests skeleton exists; boundaries enforceable.

## Uncertain / Open
- Engine choice (spike pending), exact phone in hand, 5 playtester names, step size 5-min, stance thresholds, disclosure strictness, director params, content volume.
- Node version drift (dev 25 vs target 20) — pin or verify before M001.

## Next (M001)
Kernel only: IDs, clock+phases, seeded RNG streams, command/event/effect + applier, cascade guard, query skeleton, debug console command set, scenario runner. No people/money/UI. Acceptance: 7 days headless in budget, replay-identical, causal chain prints, guard trips on loop, boundary green.

## M005 notes (2026-10-08, no arch change)
- Modules: `sim/memory` (content rules, scars, caps, lint, gates registry, what_they_remember, debug accessor) + `sim/story` (schedule/cancel/fire, cap 100, no consumers yet — documented).
- Gates wired: disclosure downgrade/upgrade (reasons cite memory ids), vouch refusal (burn cited), grace halving (cited on record). Downgrades only conceal; upgrades never override rule Refuse/Mislead.
- M003 follow-up fixed in passing: seen-table eviction is lowest-firstSeq (restore/continue divergence eliminated).
- Bugs the tests caught: verb/disclosure case mismatch (fixed M004, verified green here); test-side cmd_ids, counts, double wiring; my own assertion slips on supersede/history/overlap semantics (sim correct in each case).
- Risks remaining: scars unbounded in theory (M006 revisit); seeds have no consumers until M007; shading/favour still await M006+ gates; no concurrency/crash-safety claims.

## M004 notes (2026-10-08, no arch change)
- Modules: `sim/knowledge` (facts/beliefs/player-claims/learned-incentives, deterministic disclosure, claim cards, supersede) + `sim/verbs` (ask×4 topics, promise templates, vouch-record-only, repay, decline, interaction menu). Requests store lives in obligations (pre-commitment family). Favour kind added to content kinds; settles like an action.
- Shared builders: verbs reuse obligations' buildCreate/buildSettle (no duplicated rules). Resolvers may import owner-module read helpers; state flows only via events (documented pattern).
- M003 regression gate (new file, all green): compaction→restore→continue identical; duplicate consequence-wiring now throws (WeakMap guard — the double-nudge hazard, made impossible); same-due ordering by (due_t,id); exact-boundary Due-then-Broken; due_in_min 0 rejected. One genuine M003 defect found: seen-table eviction used insertion order → restore/continue diverged; now evicts lowest firstSeq (content-deterministic).
- Bugs the tests caught in M004: verb/disclosure case mismatch (`Shade` vs `shade` — claims silently defused); test-side cmd_id underscores, opening-txn counts, duplicate wiring in test setup.
- Replay hashes for proof-replay/proof-m003 shifted vs M003 (snapshots now carry knowledge/request stores) — self-equality holds on all three scenarios.
- Risks remaining: Ask always indebts (by design, watch in playtests); shading has no mechanical weight until M005 gates; no claim expiry; favour due defaults are slice constants.

## M003 notes (2026-10-08, no arch change)
- Modules: `sim/economy` (accounts, integer-kobo transfers, checkpoint compaction, bands) + `sim/obligations` (Debt/PromisedAction, Active→Due→Fulfilled/Broken/Renegotiated, partials, creditor-consent renegotiation, per-step due scan) + outcome→relationship mapping wired in `sim/relationships` (content-driven, skips stranger pairs).
- Pipeline deltas (additive): reactions receive frozen `ctx.q`; scenario-runner boots full world (M001 replay still identical, hash unchanged).
- Locked semantics in `docs/decisions/2026-10-08-m003-semantics.md`. Favour derivation deliberately stays 0 until M004.
- Bugs the tests caught (all fixed, none in prior milestones): partial-settle marked Fulfilled (split Settled/Fulfilled events); my cmd_ids missing underscores; opening-txn off-by-one counts; rejected-settle snapshot expectation (rejections journal evidence — authority untouched); history includes honest Due step; double-registered mapping (visible as double nudge).
- Risks remaining: due scan O(obligations) per step is fine now, revisit if obligation counts grow 100x; seen-table bound still documents M006 compaction; no concurrency/crash-safety claims (single-process, local saves only).

## Verification audit (2026-10-08, no milestone, no arch change)
- `npm test` now runs 4 stages: unit + content-lint + boundary + replay proofs
  (previously scenarios were manual-only). Discipline recorded in docs/TESTING.md.
- boundary-check rewritten from stub to real scan (sim→game imports any form,
  debug accessors confined, bridge rule); proven both directions with a temp
  probe (removed). Runner exit-1 proven with a temp failing script (removed).
- Added: JSON-validity lint for all content files; slice.json loadability test;
  direct promise_templates assertion. No existing test weakened.
- Suite: 119/119. Standing: uncommitted, no tags.

## M006 notes (2026-10-08, no arch rewrite)- New `sim/save/` (envelope, atomic writes, rotation, newest-valid-wins load, migrations, inspector data, autosave API) + `tools/save-inspector.js` + `tests/save/` stage in run-tests.
- Contract: save → restart → load → continue equals uninterrupted run, proven across money/obligations/relationships/knowledge/memories/seeds/ids/seq.
- Failure handling: garbage/truncation/checksum-tamper fall back file-by-file with reasons; all-invalid and newer-schema fail loudly; live world untouched on failed load; bad slot names rejected pre-disk.
- Stance kept as hysteresis anchor (reasoned §10.1 deviation, tested across save/load). Orphan memory kinds drop on load, rest verbatim. Seeds exactly-once via booking (obligations precedent); 56-duplicate bug found and fixed by test.
- Scar verdict (measured): 52 scars ≈ 8.5KB of a 210KB stressed save (~4%). No new cap; revisit if scar counts reach thousands.
- Risks remaining: no multi-process safety (last-writer-wins, documented); no crash-mid-dispatch recovery beyond backups (restore-from-backup after fatal errors, documented); NPC rename table deferred to first rename; RNG continuity preserved byte-exact but has no consumer until M007 director.
- Second authorization pass (2026-10-08): re-verified tree state matches prior report; added settled-obligation persistence (Fulfilled + split-across-save settlement) and post-load disclosure equivalence tests. Suite now 119 unit + 17 save. No arch changes, no new decisions.
- Final audit (2026-10-08): parseEnvelope inner-payload parse now wrapped as corrupt_save (was raw SyntaxError); stale crash-residue tmp files cleared on save with test; suite 119 unit + 18 save. No arch changes.

## M007 notes (2026-10-08, no arch rewrite)
- `sim/story` gains threads (open/close/expire, deadlines, defaults from existing event kinds), closed condition vocabulary (6 kinds), director v1 (crisis cap, breather, no-stacking, joy-first ordering), `threads()`/`situations()` queries. Seeds untouched.
- Content: `content/story/slice.json` (10 storylets) + `content/rules/director.json`; lint validates both. Console gains --situations/--threads.
- Bugs caught by tests: duplicated file tail (syntax), double-registered story store, asymmetric test helper, snapshot-vs-stores assertion on rejections, multi-step budget overflow in test advances, real 56-duplicate seed-style expiry hazard (fixed via booking precedent).
- Risks remaining: default outcomes referencing future-unstable entities fail loud by design; joy cadence deferred; surfacing is query-side only until M008 comms consumes it.

## M008 notes (2026-10-09, no arch rewrite)
- `sim/comms` (new): open_group/group_add (one compound group, M009 places refine co-presence), dm_tell (volunteered speech asserts speaker belief as-is, authored errors included), dm_request (pre-commitment record, NO favour — formal Ask owns that), draft_action (decline closes request via decline_request; ask prefills only fully-specified choices), chats()/book()/notifications() frozen queries.
- Chatter: world events (ObligationBroken etc.) become witnessed group messages via content rules; unknown event kinds fail closed. Rumour spread: non-speaker members without a prior belief gain one-step-weaker hearsay (same origin_id); existing beliefs never overwritten/duplicated (reaction skips + applier backstop).
- Book: group claim-bearing messages with speaker + origin_id; DMs never appear (information boundary). Notifications: derived/prioritized (overdue > due > crisis > request), capped 20, deterministic; no unread-DM section (no read-tracking — inventing it would be dishonest).
- Bounds: 200/thread, 300/group (oldest evicted), queries return full retained history (caps ARE the bound). Missing comms store in snapshot fails loud (guard against truncation); pre-M008 saves surface via envelope contentMismatch, not silent defaults.
- Content: `content/rules/chatter.json` + `content/strings/chat.json`; lint validates. Console gains --chats/--book/--notifications. Proof `tests/scenario/proof-m008.json` (6 replay proofs total).
- Bugs caught by tests: hardcoded `groups.compound` vs stable-id `group_compound` (×3: chatter reaction, book, + test ids), query window slice(-50) hiding retained history, dead Broken branch in notifications (due_soon is future-only — overdue now reads obligations Due directly), cmd_id pattern in test ids, per-command event budget in group-cap test (staggered dues).
- Suite: all stages green (16 unit files incl. 15 comms tests, 1 save file, 6 replay proofs). Risks remaining: pre-M008 saves need fresh start (documented); H5 standing constraint holds (no stranger DMs, no plaza).

## Save-compat + atomic-restore patch (2026-10-09, authorized reliability correction)
- Root causes (audited live): pre-M008 saves share envelope versions (schema 1/content 1) so `loadSlot` accepts them, then `kernel.restore` throws `missing_store_in_snapshot: comms`; the throw came after earlier stores were already applied (non-atomic restore proven: live snapshot differed post-failure).
- Fix: `SNAPSHOT_VERSION = 2` owned by `sim/kernel/pipeline.js` (single source; `SCHEMA_VERSION` aliases it). `migrateV1toV2` injects canonical empty comms (`emptyCommsState()`, owned by `sim/comms`) only when absent; CONTENT_VERSION stays 1 (no content changed — bumping it would be mechanical noise). `restore()` now validates shape/version/stores before touching state, snapshots live state, and rolls back byte-identical on any mid-apply failure (original error preserved).
- Fixture: `tests/save/fixtures/pre-m008-save.json` is a genuine envelope produced by M007 code @58c629b (schema 1, v1, 8 stores, 34 events) — not a faked current-minus-comms file. Pre-patch it failed as audited; post-patch it migrates (`migratedFrom: 1`), preserves money/obligations/tags/claims/scars/threads, starts comms empty, and continues deterministically (twin loads, same script, identical snapshots).
- Suite: all stages green (16 unit files, save file now 24 tests incl. 6 new, 6 replay proofs). v0-fixture assertion updated for the v1→v2 injection (intended contract change, not green-editing).
- Risks remaining: crash-mid-write with comms payload still covered only by M006's generic atomic-write design (not re-fault-injected); DM-thread/request-store counts remain unbounded (pre-existing, untouched).

## M009 notes (2026-10-09, no arch rewrite)
- `sim/world` (new): place/anchor/activity presence with reasons, content travel times via in-transit state, 4-level intent (emergency → obligation → routine → idle; commitments deferred, no RNG flavour), shared resources (NEPA schedule + generator/fuel-minutes + water + levy ledger), transformer-fault → chatter → levy → repair chain. Queries `where_is()`/`world()`; console `--where`/`--world`.
- Levy money is real: `pay_levy` moves kobo payer → collector via `MoneyMoved` (caretaker brokerage, no fake kitty account); collector self-share receipted without movement; funded target = content repair price (underfunded levies rejected at open); surplus converts to integer fuel-minutes; failed levies tag ghosts collector → ghost (bounded) and leave the fault for re-levy. `open_levy` opens the story thread in the same validated batch.
- Content: `content/places/places.json` (compound + danfo_stop + market), `content/people/routines.json`, `content/rules/world.json`, +7 chatter templates (fault alarm, light back/lost, levy ask/thanks/failed, water low) — ordinary texture plus relief, no filler, no forced crises.
- Migration: `SNAPSHOT_VERSION` 2 → 3, `migrateV2toV3` injects `emptyWorldState()`; v1 fixture now exercises the full v1→v2→v3 chain; v2-shape test covers 029a6a8-era saves. CONTENT_VERSION stays 1 (M007/M008 precedent).
- Bugs caught by tests (all fixed, none edited green): multi-step booking hazard — 71 duplicate phase batches in a 2-day run (story-seed booking-mark precedent applied to arrivals/init/phase/fuel/levy edges); q.time()-in-reactions timing audit (routines/light fired hours early; now per-step ev.data with crossed trigger); travel steamrolled by placement; silent NEPA↔generator swaps diverging from store (quiet sync event); collector self-relationship/ghost nonsense (collector exempt).
- Suite: all stages green (17 unit files incl. 31 world tests, save file 26+ tests, 7 replay proofs incl. `proof-m009.json` identical across `--twice`).
- Risks remaining: single-shot reactions evaluate at command-end time (skew bounded by advance chunk size; M010 clients advance small); thread-named-person overrides need an assignee model (future); collector spending the pot is future gameplay (noted, unbuilt); quiet stretches still untested with players (M010).

## M010 Phase 1 notes (2026-10-09, CP1 pending — implementation paused for founder review)
- Crude browser front end in `game/debug` (lists + buttons + time controls over queries/commands; reset; save/resume via `localStorage` adapter). No audio, no slice content beyond M009, no players.
- Seams: `sim/save/protocol.js` split out pure (file layer behavior unchanged — save suite unmodified and green); bridge-only sim contact (`game/bridge/world-client.js`, save adapter, sync SHA-256); `tools/serve-debug.js` localhost-only path-whitelisted static server; `npm run debug` shortcut.
- Parity proven: bridge boot ≡ Node boot snapshots; adapter envelopes byte-identical to file envelopes; pre-M008 fixture migrates through the adapter; rotation fallback matches. DOM paint has no harness (no browser deps) — CP1 review is the UI test.
- Suite: all stages green (18 unit files incl. 6 bridge tests, save files, 7 replay proofs). Boundary stage enforces the bridge-only crossing (incl. no `sim/` literal in debug UI).
- Risks remaining: DOM rendering unverified by automation; `localStorage` quota/eviction behavior untested (single-slot dev use only); server script is dev-only (no auth, localhost).

## M010 Phase 1 usability correction (2026-10-09, same authorization — no sim changes)
- Founder report: controls/labels visually merged, undifferentiated wall of dev operations. Root cause: equal-weight sections, bare repeated "Send" buttons, unlabeled inputs, dev escape hatches competing with play actions, no result visibility. (The literal pasted concatenation is partly a text-copy artifact of flex rows, but the hierarchy complaint stands on inspection.)
- Fix (presentation only): situation-first panel with query-derived next-step pointers; grouped fieldsets with legends; action-specific button labels; every input inside a `<label>`; Advanced `<details>` disclosure for fault/routine/raw; result banner live region + save/load feedback; UI double-submit guard (kernel idempotency unchanged); focus states; mobile-safe widths.
- Verification: bridge UI-structure tests (labels, disclosure, boundary literal), tag/ID/reference structure check, full suite green. No browser paint automation available (no browser, no harness deps) — visual confirmation is the founder re-review.
- Risks remaining: same as Phase 1, plus: situation pointers cover levy/fault/light/threads only (new situations need pointer updates with content).

## M010 Phase 1 interaction repair (2026-10-09, P0 — no sim changes)
- Founder report: visible controls, nothing clickable. Root cause (proven by execution, not inspection): top-level `window.localStorage` access in `app.js` throws where browsers deny storage — the module died at import, zero handlers attached. It was the only synchronous top-level environment touch; everything else was function defs or internally-caught async boot. (CSS gaps were innocent: verified `gap` present; pasted concatenation is a text-copy artifact.)
- Fix: `platformStorage()` (never throws; null = no saving) + lazy adapter; game fully playable without storage with an explicit message; boot failures set the banner (not just the log); inline watchdog turns any future silent module death into a visible page message with the boot-ok flag set after handlers attach.
- Verification: headless real-module execution (load clean, all 24 buttons wired, scenario/advance/pay/duplicate-pay decline/boot all behave; denied-storage run: import survives, game plays, save degrades with message); 3 new regression tests; full suite green. No browser paint automation exists — visual confirmation is the founder re-review.
- Risks remaining: if the founder's failure was NOT storage denial (no console access to confirm), the watchdog now surfaces the true error on-page instead of silence — report its exact text.
- Follow-up (same authorization): inline favicon kills the noise 404; watchdog now captures real error/resource details into the page message; UI-structure tests extended. Awaiting the founder's captured error text.
- Follow-up 2: founder console showed `GET /app.js 404` — document-relative script src resolved against the `/` mount instead of the file path. Fixed with root-absolute src; regression test asserts served-root script URLs. My earlier curl checks hit the disk path, not the browser-resolved one — recorded as the verification gap.

## CP1 batch: playable start + presentation honesty (2026-10-09, authorized; game/debug + tests only, zero sim changes)
- Diagnosis B confirmed: `proof-m009.json` is a full replay (setup + funding + 2 days), so loading it leaves day-3 funded state — the founder's t=3360/funded/no-open-levy evidence matches exactly. No stale state, no wiring bug: the scenario meant "prove determinism," not "start playing."
- Fix: `tests/scenario/proof-cp1-start.json` (setup-only: register/accounts/rels/routines/group/fault/open levy; distinct ids; replay-proof asserts lock the start: fault active, levy open unpaid, t=480). UI scenario button loads it; proof-m009 untouched.
- Batch: (1) all-duplicate reloads report "already loaded," partials report counts (pure `scenarioLoadSummary`, tested); (2) situations render humanized titles — storylets carry no title/text fields, so no narrative invented (full writing is Phase 2 content); (3) Ask form gains optional Amount (UI refuses non-integers without dispatching; kernel validation untouched); (4) pay/levy/fault defaults derive from the loaded scenario file (`scenarioFormDefaults`, tested), never hardcoded.
- Verification: suite green (18 unit, 8 proofs); headless real-handler click-through (load/reload/ask/forms/titles); serve checks. Visual paint remains founder-verified.
