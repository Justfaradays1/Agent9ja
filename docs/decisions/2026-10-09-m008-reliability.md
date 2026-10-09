# Decision — M008 hypothesis verdict + reliability report (2026-10-09)

M008 implementation is complete (commit `693b186`, suite green). This note
answers the two commissioning questions: (1) is the retention hypothesis
worth building on, and (2) is the built subsystem reliable enough to carry it.

## 1. Hypothesis verdict: plausible, UNPROVEN — M008 is the minimal probe

Claim: communication becomes a retention mechanism and a reason to care.
Evidence weighed (see `docs/PLAYER_RESEARCH.md` R-007/R-008, new 2026-10-09):

- FOR: a real segment plays for contact (Eke's "steady connections",
  Ademola's 4h/day social phase); help-seeking and humour in chat are
  observed; Lagos Life ships DMs/rooms as core surface.
- AGAINST: the same social player churned anyway (novelty fade); solo
  players retain without chat; observed chat includes begging/spam dynamics;
  boredom anecdotes persist with chat present. No rates exist anywhere —
  Lagos Life is days old.
- Recorded as H7 (OPEN). Confidence in the hypothesis itself: LOW-MEDIUM.

Recommendation: keep the M008 design exactly as built — consequence-linked,
optional, async, no-stranger — as the smallest falsifiable probe. The M010
gate already requires ≥3/5 continue; add return-visit-with-unread-developments
as an explicit M010 playtest lens rather than building more chat now.

## 2. Rejected / deferred / validation list

REJECTED (evidence + cost, no M010 re-test unless H7 surprises):
- Voice notes — zero observed evidence (founder recollection unverified);
  bandwidth/storage/moderation/accessibility costs unassessed. Reject.
- Per-message deletion, editing, retraction — no observed demand; both-sides
  delete semantics are a support burden (Lagos Life only deletes on account
  close). Reject.
- Chat push notifications — Lagos Life deliberately restricts push to
  rent/meters ("nothing else ever pushed"); fatigue risk. Reject; M008 has
  in-world derived notifications only.
- Contact-acceptance gate before DMs — NOT observed in the reference game
  (block-after-the-fact is the pattern); adds friction against H-R1
  readability. Reject for NPC/async scope.
- Plaza/presence/typing indicators — H5 + R-004. Reject.

DEFERRED (revisit with trigger stated):
- Blocking/reporting/muting — no strangers exist in our sim; nobody to
  block. Trigger: first human-to-human contact.
- Read receipts — collected by Lagos Life but no demand evidence; privacy
  cost. Trigger: M010 players ask for delivery confidence.
- Extra groups beyond the compound — M009 places must define co-presence
  first (arch order).
- First-start walkthrough + no-reload interaction standard — UI-layer
  hypotheses; no client exists yet. Trigger: client milestone.

VALIDATE at M010 (already scheduled H2–H4 + H7 lens above).

## 3. Reliability report — what was tested, protected, unverified, new risks

Full suite green at commit: 16 unit files (15 comms tests), 1 save file,
content-lint, boundary-check, 6 replay proofs (`proof-m008` identical hash
`8e623d82` across `--twice`).

Failure cases actually injected (all in `tests/unit/comms.test.js`):
- Validation-first rejection: empty/dup members, unknown persons/groups,
  bad ids, self-DM, bad topic, >140-char detail, unknown command paths —
  all `CommandRejected` with reasons, no state touched.
- Unknown world-event kinds → no chatter, no crash (fail-closed rule loop).
- Duplicate `cmd_id` redelivery → `duplicate`, exactly one message.
- Duplicate group open / double member-add → rejected.
- `dm_tell` without speaker belief or unknown fact → rejected (no invented
  provenance); volunteered speech asserts speaker belief as-is, documented.
- Repeat rumour delivery → no second belief (reaction skips + applier
  backstop, journal stays clean).
- Caps: 205 DMs → 200 retained oldest-evicted; event storm → 300 group cap;
  23 competing notifications → 20 by priority, deterministic across seeded
  twins; overdue-vs-due ordering with grace semantics.
- Persistence: snapshot→restore byte-identical; missing comms store fails
  LOUD (`missing_store_in_snapshot`), never silent-empty.
- Content: unknown template refs and origin-less claims fail lint with
  reasons; repo content boots through `tools/world.js` (console smoke-tested
  `--chats/--book/--notifications` end to end).

Invariants protected (verified in code, not just asserted):
- Failure isolation: reaction throws → `ReactionFailed` journaled, siblings
  continue (pipeline.js). Comms reactions return `[]` on absent group and
  never throw on plausible input; appliers guard (`if (g)`) except
  `missing_group_in_apply`, unreachable via the resolver's pre-check.
- Boundaries: resolvers read frozen views; queries deep-clone; no nested
  dispatch (`draft_action` is a pure constructor); sim/ never imports game/.
- Duplicate safety: `cmd_id` seen-table + `msg_seq` id backstop +
  belief-exists skip at two layers.
- Determinism: sorted threads/groups, priority→time→ref tiebreaks,
  seeded-RNG replay proof identical.
- Bounded work: 200/thread, 300/group, 20 notifications, cascade depth 8,
  per-command event budget 256 (group-cap test staggers dues to respect it).
- Security: stable-id validation on every id; topic allowlist; no free text
  anywhere (templates only — injection-proof by construction); DMs excluded
  from the book; hidden truth never in queries (`--truth` dev-only).
  Rejection reasons are bridge-diagnostic strings; game/ must map them to
  player copy at the client milestone (noted, not built).

UNVERIFIED (stated, not hidden):
- No live players: ordinary-play interestingness, empty-quiet-period feel,
  and H7 itself await M010 playtests. Quiet stretches WILL show an empty
  group — honest (no filler invented), but untested feel.
- Crash-mid-write with a comms payload: covered by M006's generic
  atomic-write + newest-valid-wins design, not re-fault-injected for comms.
- Performance at scale: worst cases are small by construction (≤300 msgs,
  notifications O(obligations+threads+requests)); no perf test exists.
- Pre-M008 saves need a fresh start (envelope `contentMismatch` flags it).

New/adjacent risks created or noticed (no rewrite undertaken):
- Event-storm eviction: a burst of world events can push meaningful chatter
  out of the 300 window. Bounded per command, unbounded per history.
  Accepted for M008; revisit if chatter volume grows.
- Unbounded counts adjacent to M008 (pre-existing, NOT changed here):
  number of DM threads, `requests` store growth, obligation counts feeding
  `notifications()` cost. Watch-items for M009+ if populations grow.
- M009 multi-group must re-budget the per-member-per-claim rumour fan-out.

## 4. Answer to the commission

Communication as built CAN carry retention weight only if H7 survives M010
contact with players; nothing in the evidence justifies expanding scope
before that. Reliability is demonstrated to the standard asked: every listed
failure case has a test, every invariant names its mechanism, unverified
areas are explicit, and no new infrastructure was introduced. No M009 work
started; no arch changes made.
