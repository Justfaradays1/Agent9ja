# Decision — M010 Phase 1 debug front end (2026-10-09)

Founder-authorized Phase 1 only (CP1 checkpoint, then pause). No slice
content, no audio, no players, no M011.

## Why a protocol split, not a fork

Browser saves need the envelope protocol without Node file I/O, and the
protocol's tested API is synchronous (browsers offer only async SubtleCrypto).
The seam: `sim/save/protocol.js` (pure, shared) + thin Node file wrapper
(`index.js`, behavior unchanged — full save suite passes unmodified) +
browser adapter over the same protocol. Forking the format per platform was
the rework risk; sharing the module eliminates the class. `CONTENT_VERSION`
untouched (no content changed).

## Why a sync SHA-256 ships in game/bridge

SubtleCrypto is async-only; the protocol is sync. A ~80-line dependency-free
SHA-256 in the bridge (not sim — hashing is a platform capability) closes
the gap. Byte-identity with Node crypto is proven by vectors incl. unicode,
100KB inputs, and a real snapshot — not assumed.

## Why game/bridge, not game/debug, touches sim

Boundary-check forbids game→sim contact outside `game/bridge`. All sim
imports live in `game/bridge/world-client.js` (+ protocol/sha imports in the
adapter); `game/debug/app.js` imports bridge only and contains no `sim/`
literal anywhere (enforced by the boundary stage). The UI is rendering +
wiring; every logic path it calls (boot, scenario apply, save/load) is
covered by `tests/unit/bridge.test.js` with a memory-Storage shim.

## Why a dev-only static server script

Browser ESM needs http (file:// blocks module CORS). `tools/serve-debug.js`
is stdlib-only (`node:http`), localhost-only, path-whitelisted
(/game /sim /content /tests/scenario — tools, tests, .git, package 404),
no-cache, no listing, no uploads. Same trust as the console tools.

## Deferred explicitly

DOM rendering has no automated harness (no browser deps per doctrine §11)
— founder CP1 review IS the UI test. Audio enters after CP1 (muted-first
validates independence). Overhead text, auth, polish: later milestones.
Terminal alternative rejected per founder browser priority (cost delta: save
adapter + serving + DOM, all now built and tested except DOM paint).
