# Decision — save-compat + atomic-restore patch (2026-10-09)

Authorized reliability correction for the M008 audit findings. No M009, no
content, no product changes.

## Why a schema bump, not a content bump

The missing comms store is snapshot *structure* (the kernel's store set
grew), not content data (no content file changed). `CONTENT_VERSION` stays
1; `SNAPSHOT_VERSION = 2` is owned by `sim/kernel/pipeline.js` (single
source — previously the `v: 1` literal in the kernel and `SCHEMA_VERSION`
in sim/save could drift silently), aliased as `SCHEMA_VERSION` for the
envelope. Bumping content would have been mechanical noise with no
migration mechanism behind it (content has only a mismatch flag, and this
patch deliberately does not invent content migration).

## Why restore wraps in backup/rollback instead of pure pre-validation

Pre-validation (version, keys, every registered store present) catches the
known failure shapes before any mutation — including the pre-M008 case.
But a store `setState` can throw mid-apply on shapes validation cannot see,
so validate-then-apply alone is still non-atomic. The rollback (one
canonical snapshot; restores are rare, saves are KBs) closes the general
case. Cost is bounded and commented at the call site.

## Deliberately preserved

- Kernel strictness: `restore` speaks exactly one version; old snapshots
  arrive via `migrateSnapshot`, never via lenient restore. Direct
  unmigrated restore still fails loud (`bad_snapshot_version`, tested).
- No silent defaults for corrupt data: migration only *adds* an absent
  comms store; present stores are never rewritten; malformed payloads throw.
- No architectural change: same pipeline, same envelope, same backup
  policy, no new dependencies, no new infrastructure.

## Evidence

- Genuine M007 fixture (`tests/save/fixtures/pre-m008-save.json`, from
  commit 58c629b): failed pre-patch with `missing_store_in_snapshot:
  comms` and mutated the live kernel (both demonstrated); loads post-patch
  with state preserved and deterministic continuation.
- 6 new save tests: fixture migration + preservation, twin determinism,
  schema-2 default, missing-store strictness + liveness, malformed/future
  versions, mid-apply rollback with original error.
- Full suite green after the patch (16 unit files, 24 save tests,
  content-lint, boundary, 6 replay proofs).
