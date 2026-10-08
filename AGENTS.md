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
