# Decision — M007 story engine scope (2026-10-08)

No architecture change. Genuine resolutions, smallest form:

- Engine = storylets (closed condition vocabulary) + threads (deadlines,
  defaults from existing event kinds only) + director v1 (caps, breather,
  no-stacking, joy-first ordering). Queries surface; verbs act. No dialogue,
  chat, or 3D surface added.
- Deferred with reason: phase-cadence joy guarantee (needs surfacing memory,
  which would mutate on read — violates read-only queries); quest-log UI;
  new condition/effect kinds (none demanded by the 10 slice storylets).
- Reused, not duplicated: seed exactly-once booking precedent for thread
  expiry; obligations' resolver/applier split for default outcomes; frozen
  query composition inside situations() (safe: view construction is
  side-effect free).
- Default outcomes validate refs at open (dangling refs rejected) and stay
  loud at fire for unknowable futures (balances). Content typos fail in lint.
- Threads capped at 50 open; situations capped at 100; director state is two
  nullable counters in the story store (save-safe, pre-M007 tolerant).
