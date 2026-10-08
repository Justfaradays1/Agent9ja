# AGENT9JA_ARCHITECTURE.md

**The master technical map of Agent9ja.**
Version 0.1 · Written 7 October 2026 · Design and architecture only. This document contains no implementation code.

> **How to use this document.** After any finished milestone, open the **Resume Tracker** below, tick the milestone, move the **YOU ARE HERE** marker down one row, and read that milestone in Section 16. Every milestone says what it needs, what "done" means, what you must not add, and what comes next. If you ever feel lost, go to Section 0.3 (the Resume Protocol).

---

## 0. RESUME TRACKER (edit this section as you work)

**Current stage:** `YOU ARE HERE → M000`

| ID | Milestone | Track | Proves | Status |
|---|---|---|---|---|
| M000 | Project Foundation and Engine Gate | Foundation | The engine runs on your laptop and a cheap phone | ☐ NOT STARTED |
| M001 | Simulation Kernel | Sim | The core can run headless and deterministically | ☐ |
| M002 | People and Relationships | Sim | People have state that is not a number | ☐ |
| M003 | Money and Obligations | Sim | Promises and debts are real objects with a lifecycle | ☐ |
| M004 | Knowledge, Claims and the Four Verbs | Sim | Ask, Promise, Vouch, Repay work and explain themselves | ☐ |
| M005 | Memory and Consequence | Sim | **A remembered action changes a future option** (the moat) | ☐ |
| M006 | Save and Load v1 | Sim | State survives a restart, exactly | ☐ |
| M007 | Story Engine (Storylets, Threads, Seeds, Director) | Sim | Situations arise from state, not from a script | ☐ |
| M008 | Communication (DMs, Group, Overhearing) | Sim | Information and pressure flow through chat | ☐ |
| M009 | World Simulation (Places, Routines, Intent) | Sim | The compound lives with no player input | ☐ |
| M010 | **Proof Gate 1: Text Vertical Slice** | Sim | **The social loop is fun without any 3D** | ☐ |
| M011 | 3D Character Prototype | 3D | One modular body, three animations, phone-speed | ☐ |
| M012 | Compound Greybox, Movement and Camera | 3D | Walking in a real compound feels fine on a cheap phone | ☐ |
| M013 | NPC Presence | 3D | The sim visibly drives the people | ☐ |
| M014 | Interaction, Dialogue and Phone UI | 3D | The four verbs work through the world | ☐ |
| M015 | Character Creator and Appearance Persistence | 3D | The player is *their* character | ☐ |
| M016 | **Proof Gate 2: 3D Vertical Slice** | Integration | Same loop, now physical, three divergent playthroughs | ☐ |
| M017 | Housing and Work Depth | Content+Sim | Act I is a full arc, work is a time tradeoff | ☐ |
| M018 | Mobile Performance and Release Hardening | Release | Stable on target Android devices | ☐ |
| M019 | Expansion Gate | Planning | Decide whether and how to grow past one compound | ☐ |

**Status vocabulary used throughout this document**

| Label | Meaning |
|---|---|
| **PROVEN** | Built and tested in this project. (Nothing is PROVEN yet.) |
| **HYPOTHESIS** | Our best current design. Expected to be right, not yet tested. |
| **EXPERIMENTAL** | Plausible but risky. Build a small spike before committing. |
| **DEFERRED** | Deliberately not now. Do not build until its trigger is met. |
| **UNDECIDED** | A real open choice. Do not invent certainty. |

---

## 0.1 What this document is, and what it is not

It is a **map**: what the finished codebase eventually contains, what depends on what, and the order in which to build it. It is a **hypothesis**: the implementation is allowed to prove parts of it wrong. When that happens, update the tracker, write a short decision note (Section 18), and move on.

It is not a design for screens, a monetization plan, a networking design, or code.

## 0.2 Where this architecture deliberately departs from your brief

You asked for honesty. These are the places where following the brief literally would, in my judgment, raise the chance that a solo developer ends up with a pretty walking demo and no game. Each is a recommendation you can overrule; each is recorded in Section 18.

1. **The simulation is built and proven before the 3D world.** Your example milestone list starts with a 3D character. Mine puts the headless social simulation first (M001 to M010) and the 3D track second (M011 to M016). Reason: the thing that must be proven is that *relationships → obligations → consequences → memory* is fun. That can be tested with a crude list-based debug screen in days, while a 3D character, compound, animation and phone-quality performance take months on your hardware. If the loop is not fun, you find out cheaply. If it is, the 3D work lands on a tested core.
   **Mitigation for motivation:** M000 includes a tiny 3D hardware spike (a capsule walking with ten capsule NPCs), so you see something move and learn early whether your laptop and a cheap phone can cope.
2. **The simulation tracks places and anchors, not continuous 3D positions.** An NPC is "at the gate, standing, talking to Sunday", not at coordinates. The 3D layer animates the walk between anchors. Reason: it keeps the simulation testable without a renderer, cheap to run, identical on every device, and independent of the engine. This is one of the few decisions that is very expensive to change later.
3. **Time is a continuous clock with abstract phases, not action points.** Consistent with your brief; stated here because it shapes the whole kernel (Section 8.2).
4. **3D plus cheap Android is the highest-risk part of the project.** I could not test your hardware, and I did not verify current engine versions or licences live. Everything in the engine and asset sections is labelled accordingly, and M000 is a gate: if the spike fails, you change engine or reduce the 3D ambition before spending months.
5. **Housing is mostly content, not a big system.** In the architecture, a housing crisis is a *Thread with a deadline* plus a small *ShelterArrangement* record, built on obligations and relationships. A large "housing module" would be a trap (it would pull the game back toward a housing game).

## 0.3 Resume Protocol (use this when you come back after a break)

1. Open **Section 0**. Find `YOU ARE HERE`.
2. Open that milestone in Section 16. Read **Purpose**, **Prerequisites** and **Acceptance Criteria** only.
3. Confirm the prerequisites really are done by running the whole test suite. If anything is red, fix it first. Do not start a milestone on red tests.
4. Start a new branch named after the milestone. Do one milestone per branch.
5. When the acceptance criteria and tests pass, update the tracker, write down any decision that changed, tag the commit with the milestone ID, and stop. You can stop after any milestone and the project is still coherent.

---

## 1. PRODUCT CONTEXT IN ARCHITECTURAL TERMS

Agent9ja is a Nigerian social-life simulation in which the player builds a life inside a network of people whose goodwill, information, money and trust affect what happens next. Housing is Act I.

**The repeatable loop** (from your brief):

> Hear conflict → judge who needs you → spend scarce favour/money/reputation → owe or be owed → obligations come due → consequences change future options.

**The four verbs:** Ask, Promise, Vouch, Repay. Verification folds into Ask.

**The moat equation:**

> **past action → remembered state → changed future options**

**What the simulation must be able to answer, deterministically, at any moment.** If the architecture cannot answer all six, it is incomplete:

1. *Who knows what, and how sure are they?*
2. *Who owes whom what, since when, and under what wording?*
3. *What does this person remember about me, and what does that change?*
4. *What can I do with this person right now, and, for each thing I cannot, why not?*
5. *What is due soon, and what happens if I ignore it?*
6. *Where is everyone, and what are they doing, at this phase of the day?*

Question 4's "why not" is a hard requirement. It is what makes consequences *legible*, and legible consequences are what players retell as stories.

---

## 2. ARCHITECTURAL PRINCIPLES

| # | Principle | What it means in practice |
|---|---|---|
| P1 | **Simulation and presentation are separate worlds.** | The simulation never imports engine code. The engine layer never changes state directly. They meet at one narrow bridge. |
| P2 | **One writer.** | All state changes pass through one pipeline (Command → Event → Effect). No system edits another system's data. |
| P3 | **Deterministic and seeded.** | Same starting state + same commands + same seed = same future. Randomness is seeded and only used for flavour and tie-breaking, never for "does the NPC lie". |
| P4 | **Data over code for content.** | NPCs, storylets, dialogue, rules and jobs are data files. Adding content does not mean editing engine logic. |
| P5 | **Place-level simulation.** | The simulation knows *where* (place and anchor) and *what* (activity), not coordinates. |
| P6 | **Every option explains itself.** | If an action is unavailable or costs more, the simulation returns a reason the player can read. |
| P7 | **Memory must be consumed.** | A memory type that no rule reads is a bug. A linter enforces this (Section 8.7). |
| P8 | **No omniscient truth for the player.** | The simulation holds ground truth privately so that NPC statements stay consistent. No player-facing query can return it. |
| P9 | **Bounded everything.** | Small NPC counts, capped memory, capped threads, capped message history. Budgets are written down. |
| P10 | **Local first, headless testable.** | The full simulation runs and is tested from a command line with no screen. Save files are local. |
| P11 | **Prove the smallest thing first.** | No layer is built until the layer below has passing tests and, at the two proof gates, real players. |
| P12 | **Flavour is not mechanics.** | Per your test: if removing the Nigerian context does not change the decision structure, it is flavour. Mechanical Nigerian systems (compound commons, caretaker brokerage, agent incentives, group chat as public memory, levy dilemma) live in rules. Pidgin, names and textures live in content. |

---

## 3. THE LAYERS (revised)

Your brief proposed layers 0 to 12. I kept the spirit and split the dependency structure into **two tracks that meet at an integration layer**, because the simulation does not need 3D to exist, but the 3D needs the simulation.

```text
┌───────────────────────────── PRESENTATION TRACK (engine) ─────────────────────────────┐
│  P1  3D character and animation        P2  World, movement, camera                    │
│  P3  NPC presence (puppeting)          P4  Interaction, dialogue and phone UI         │
└───────────────────────────────────────▲───────────────────────────────────────────────┘
                                        │  bridge (read-only queries up, commands down)
┌───────────────────────────── SIMULATION TRACK (engine-independent) ───────────────────┐
│  L9  Housing and work (content on top of threads and obligations)                     │
│  L8  World simulation (places, routines, intent)                                      │
│  L7  Communication (DMs, groups, overhearing)                                         │
│  L6  Story engine (storylets, threads, seeds, director)                               │
│  L5  Four verbs and interaction logic                                                 │
│  L4  Knowledge, claims, memory and consequence                                        │
│  L3  Money and obligations                                                            │
│  L2  People and relationships                                                         │
│  L1  Simulation kernel (ids, clock, rng, state, command/event/effect, query)          │
└───────────────────────────────────────▲───────────────────────────────────────────────┘
                                        │
                  L0  Foundation (repo, engine gate, test runner, conventions)
```

| Layer | Name | Contains | Brief's layer it replaces or merges |
|---|---|---|---|
| **L0** | Foundation | Repo, engine decision spike, test harness, conventions, agent rules, progress tracker | Layer 0 |
| **L1** | Simulation kernel | Stable IDs, game clock, seeded RNG, state stores, command/event/effect pipeline, query interface, debug console | New (implicit in brief) |
| **L2** | People and relationships | NPC records, traits, wants, relationship records, stance derivation | Layers 3, 4 |
| **L3** | Money and obligations | Wallet, transactions, obligation lifecycle, due-time processing | Layers 5, 6 |
| **L4** | Knowledge, claims, memory and consequence | Beliefs, claims, disclosure rules, memory kinds, consequence rules, gating | Layer 7 (expanded) |
| **L5** | Four verbs | Ask, Promise, Vouch, Repay resolvers; interaction menu; "why not" reasons | Part of Layer 2 |
| **L6** | Story engine | Storylets, threads, seeds, director | Layer 10 |
| **L7** | Communication | DMs, groups, notifications, overhearing, rumour spread | Layer 8 |
| **L8** | World simulation | Places, anchors, routines, intent selection, shared resources | Layer 10 (part), world sim |
| **L9** | Housing and work | Shelter arrangements, shifts as commitments, gig content | Layer 9 |
| **P1** | 3D character | Modular body, skeleton, animations, appearance resolution | Layer 1 |
| **P2** | World, movement, camera | Compound scene, navigation, camera, anchors | Layer 1 |
| **P3** | NPC presence | Puppeting sim state into the scene | Layer 3 |
| **P4** | Interaction and phone UI | Approach, menu, dialogue view, phone views | Layer 2, 8 |
| **L10** | Vertical slices | Integration and content for Proof Gates 1 and 2 | Layer 10 |
| **L11** | Expanded world | Neighbourhood, more compounds, workplaces | Layer 11 |
| **L12** | Optimization and release | Android profiling, graphics settings, interruption handling | Layer 12 |

**Why the sim track is numbered L1 to L9 and the 3D track P1 to P4.** The numbers inside each track are build order; the two tracks are separate so that you can see that **P-layers never block L-layers**.

---

## 4. DEPENDENCY GRAPH

### 4.1 The main spine (what must exist before what)

```text
Foundation (L0)
   ↓
Simulation kernel: ids · clock · rng · state · command/event/effect · query   (L1)
   ↓
People (NPC records)                                                            (L2)
   ↓
Relationships (stance derived from history)                                      (L2)
   ↓
Money (wallet, transactions)                                                     (L3)
   ↓
Obligations (promise/debt lifecycle, uses clock + wallet)                         (L3)
   ↓
Knowledge and claims (what each person knows, what the player has heard)          (L4)
   ↓
The four verbs (Ask, Promise, Vouch, Repay) + option gating with reasons          (L5)
   ↓
Memory kinds + consequence rules (past action → changed option)                   (L4/L5)
   ↓
Save/Load (state shape is now stable enough to freeze v1)                          (L1/L4)
   ↓
Story engine: storylets · threads · seeds · director                              (L6)
   ↓
Communication: DMs · group · overhearing                                          (L7)
   ↓
World simulation: places · routines · intent                                      (L8)
   ↓
Housing pressure as content                                                       (L9)
   ↓
═══ PROOF GATE 1: TEXT VERTICAL SLICE (M010) ═══
   ↓
3D character → compound greybox → NPC presence → interaction + phone UI → creator
   ↓
═══ PROOF GATE 2: 3D VERTICAL SLICE (M016) ═══
   ↓
Housing and work depth → mobile hardening → expansion gate
```

### 4.2 "What must exist before this can work?" (per system)

| System | Needs first | Why |
|---|---|---|
| Clock | IDs, kernel | Everything timed references it |
| Relationship | People, event pipeline | Stance is derived from recorded history |
| Wallet | Kernel | Every transfer is an auditable transaction |
| Obligation | Clock, wallet, relationship | Due times need the clock; settlement needs money; breaking needs relationship effects |
| Knowledge/claims | People | Beliefs belong to people |
| Ask | Knowledge, relationship, wallet | Asking costs favour or money and depends on disclosure rules |
| Vouch | Obligation, relationship | A vouch is a contingent obligation |
| Memory | Event pipeline, relationship | Memories are created from events by rules |
| Consequence | Memory, obligations, relationships | Consequences are rule-driven effects |
| Save/Load | Stable state shapes | Freezing a schema too early wastes effort; too late is painful. After M005 is the right moment |
| Storylets/threads | Query interface, effects | Conditions read state; effects change it |
| Director | Storylets, threads, clock | Chooses what to surface |
| Group chat | Knowledge, story engine, relationship | Posts carry claims and create pressure |
| Routines | Clock, places, obligations | Intent weighs routine against obligations |
| Housing pressure | Threads, obligations, relationships, places | It is content assembled from those |
| 3D character | Engine only | Does not need the sim |
| Compound scene | Engine, anchors list from sim content | Anchors must match place definitions |
| NPC presence | Sim routines, scene anchors, character | Puppets read sim state |
| Interaction UI | Verbs, queries, dialogue content | It only presents what the sim offers |
| Phone UI | Comms, wallet, book queries | Views over sim state |

### 4.3 What can be built in parallel

Because the tracks are separate, a solo developer with coding agents can run two lanes. Rule of thumb: **never start a lane-2 item that depends on an unfinished lane-1 item.**

| Lane 1 (code) | Lane 2 (no code dependency) |
|---|---|
| M001 to M006 simulation core | Collect asset candidates (low-poly packs, licences noted); sketch compound layout on paper; write NPC bios and incentive tags; write the first 40 Pidgin dialogue lines |
| M007 to M009 story, comms, world sim | Model or select the base body in Blender; plan the modular clothing atlas |
| M010 text slice | Playtest recruitment; write playtest questions |
| M011 to M016 3D track | Content for expansion ideas (not built) |

---

## 5. SYSTEM STATUS REGISTRY

| System | Status | Notes |
|---|---|---|
| Sim/presentation split | HYPOTHESIS | Strongly recommended; cost to reverse is very high |
| Command/Event/Effect pipeline | HYPOTHESIS | Standard pattern; prove at M001 |
| Seeded determinism | HYPOTHESIS | Prove with a replay test at M001 |
| Place/anchor-level sim | HYPOTHESIS | Prove at M009; confirm 3D can follow at M013 |
| Continuous clock with phases | EXPERIMENTAL | Test pause rules and fast-forward at M010 |
| Stance derived from history | HYPOTHESIS | Thresholds are content, tuned in M010 |
| Obligation as lifecycle object | HYPOTHESIS | The most important system after memory; prove at M003 |
| Vouch as contingent obligation | EXPERIMENTAL | May need its own type; prove at M004 |
| Claims and corroboration card | EXPERIMENTAL | Must stay light; prove at M004 and M010 |
| Deterministic disclosure rules | HYPOTHESIS | Replace random lying; prove at M004 |
| Memory with consumption lint | EXPERIMENTAL | The key innovation; prove at M005 |
| Rumour spread via co-presence | EXPERIMENTAL | Start tiny at M008; may be cut |
| Storylets + threads + seeds | HYPOTHESIS | Known pattern; prove at M007 |
| Director with breathers | EXPERIMENTAL | Tune only with real players at M010 |
| Save as versioned snapshot | HYPOTHESIS | Prove at M006 |
| Content as validated JSON-like data | HYPOTHESIS | Final format UNDECIDED (Section 18) |
| Godot as engine | UNDECIDED (leaning yes) | Decided at the M000 gate |
| Compatibility-level rendering | HYPOTHESIS | Verify on a real phone at M000 |
| Modular character on shared skeleton | HYPOTHESIS | Prove at M011 |
| Tap-to-move controls | UNDECIDED | Decide at M012 |
| Fixed-angle follow camera | HYPOTHESIS | Decide at M012 |
| Interiors as separate small scenes | UNDECIDED | Decide at M012 |
| Housing as thread + ShelterArrangement | HYPOTHESIS | Prove at M010 |
| Work shift as recurring commitment | HYPOTHESIS | Prove at M017 |
| Ajo, black tax, family obligations | DEFERRED | Trigger: Proof Gate 2 passed |
| Multiple compounds / neighbourhood | DEFERRED | Trigger: M019 |
| Multiplayer, cloud save | DEFERRED | Not designed here |
| AI-generated dialogue | DEFERRED | Flavour only, never state, never before M019 |
| Real-money economy, ads | DEFERRED / out of scope | Not in this document |

---
## 6. REPOSITORY STRUCTURE

Folder names below are engine-neutral except `game/`. The engine itself is **UNDECIDED until the M000 gate** (leaning Godot, see Section 18). Nothing in `sim/`, `content/` or `tests/` may depend on the engine, so an engine change would only touch `game/` and `tools/`.

```text
agent9ja/
├── AGENT9JA_ARCHITECTURE.md      this document
├── AGENTS.md                     rules every coding agent must follow (Section 15)
├── docs/
│   ├── PROGRESS.md               mirror of the Resume Tracker + session log
│   ├── decisions/                one short note per decision change
│   ├── playtests/                notes from Proof Gates 1 and 2
│   └── content-guide.md          how to add NPCs, storylets, dialogue (Section 11)
├── sim/                          the simulation: pure logic, no engine imports
│   ├── kernel/                   ids, clock, rng, state registry, command/event/effect pipeline
│   ├── people/                   NPC and player-person records, intent selection
│   ├── relationships/            relationship records, stance derivation, standing
│   ├── economy/                  wallet, transactions
│   ├── obligations/              obligation lifecycle and due processing
│   ├── knowledge/                ground truth (private), beliefs, claims, disclosure, claim cards
│   ├── memory/                   event journal, memory formation, compaction, consequence rules
│   ├── verbs/                    Ask, Promise, Vouch, Repay resolvers and gating
│   ├── story/                    storylets, threads, seeds, director
│   ├── comms/                    messages, threads, groups, notifications, overhearing, rumours
│   ├── world/                    places, anchors, routines, shared resources
│   ├── housing/                  shelter arrangement, housing status derivation
│   ├── work/                     jobs and shifts (thin; built on obligations)
│   ├── query/                    the read-only API everything else uses to look at state
│   └── save/                     snapshot, versioning, migrations
├── content/                      data only; no logic
│   ├── schema/                   definitions the linter validates against
│   ├── people/                   NPC definitions, incentives, disclosure rules, routines
│   ├── places/                   places, anchors, travel times
│   ├── rules/                    memory rules, consequence rules, stance thresholds, director rules
│   ├── story/                    storylets and threads
│   ├── dialogue/                 line sets by NPC and situation (id + text + variants)
│   ├── obligations/              obligation kinds and terms
│   ├── housing/                  shelter kinds and housing situations
│   ├── work/                     jobs, shifts, gigs
│   └── strings/                  all player-visible text, keyed by id (Pidgin-ready)
├── game/                         the engine project (presentation)
│   ├── bridge/                   the ONLY place that touches both sim and engine
│   ├── character/                builder, appearance resolution, animation state
│   ├── world/                    compound scene, navigation, anchors, triggers
│   ├── npc/                      puppets that follow the simulation
│   ├── interaction/              approach, menu, dialogue view
│   ├── ui/                       phone and HUD views (read-only over queries)
│   ├── camera/
│   ├── audio/
│   └── debug/                    in-game inspector, time controls, "why" explorer
├── assets/                       optimized files the game ships and imports
├── assets_src/                   source art (Blender files etc.), NOT imported by the engine
├── tools/                        content linter, scene-anchor checker, save inspector, scenario runner
├── tests/
│   ├── unit/                     per-module logic
│   ├── scenario/                 scripted multi-day playthroughs with assertions
│   ├── content/                  linter and schema tests
│   ├── save/                     round-trip and migration tests
│   └── perf/                     budgets (sim tick cost, scene counts)
└── builds/                       ignored by version control
```

### 6.1 Folder responsibilities

| Folder | Responsibility | Owns | Must NOT own | Depended on by |
|---|---|---|---|---|
| `sim/kernel` | Make the simulation runnable, ordered, deterministic, and safe to mutate | IDs, clock, RNG, pipeline, state registry | Any game rule | everything in `sim/` |
| `sim/people` | What a person is and wants right now | NPC dynamic records, intent | Relationships, money | world, story, verbs |
| `sim/relationships` | How two people stand | Relationship records, stance, standing | Obligations, memories | verbs, story, comms |
| `sim/economy` | Moving naira, auditable | Wallet, transactions | Why money moved (that is an obligation or event) | obligations, work, housing |
| `sim/obligations` | Promises, debts, commitments | Obligation records, lifecycle | Relationship effects (it emits events; rules apply them) | verbs, story, work |
| `sim/knowledge` | Who knows what | Ground truth (private), beliefs, claims | Memories of events | verbs, comms, story |
| `sim/memory` | What happened and what it changes | Journal, memories, consequence rules | Obligation state | verbs, story, people |
| `sim/verbs` | The four player actions | Resolvers, option lists with reasons | State storage | story, interaction UI |
| `sim/story` | What situation surfaces now | Threads, seeds, director state | Dialogue text | comms, world, housing |
| `sim/comms` | Messages and notifications | Message and group records | Truth of claims | UI, story |
| `sim/world` | Where people are and what is shared | Places, routines, shared resources | 3D coordinates | puppets, story |
| `sim/housing` `sim/work` | Thin domain layers | Shelter arrangement, jobs | Large separate economies | story, UI |
| `sim/query` | Safe, read-only views | Nothing (views only) | Any mutation; any access to ground truth for player-facing views | bridge, UI, tests |
| `sim/save` | Persist and restore | Snapshot format, migrations | Gameplay logic | kernel, tools |
| `content/*` | Describe the world as data | All authored content | Behaviour that needs new engine logic | sim (read at load), tools |
| `game/bridge` | Connect sim to engine | Frame-to-tick scheduling, event translation | Rules; scene code | all of `game/` |
| `game/character` | Turn a character spec into a body | Builder, materials, animation state | Who the person is | npc, interaction, creator |
| `game/world` | The physical compound | Scene, nav, anchors, triggers | Who is where (the sim decides) | npc, camera |
| `game/npc` | Puppets | Spawn, walk, play activity | Decisions | bridge |
| `game/interaction`, `game/ui` | Present options and results | Views | Any game rule | bridge |
| `tools` | Keep content and scenes honest | Linter, validators, inspectors | Game logic | developer, agents |
| `tests` | Prove state transitions | Cases and fixtures | Production code | developer, agents |

**Hard boundary rules (enforced by a tool in `tools/`, run with the tests):**
1. Nothing in `sim/` may import anything in `game/`.
2. Nothing in `game/` may write sim state except by sending a Command through `game/bridge`.
3. Nothing outside `sim/knowledge` and `sim/verbs` resolvers may read ground truth.
4. `content/` contains no executable logic, only data and text.

---

## 7. DATA OWNERSHIP

> **Rule.** Each piece of state has exactly one owner. The owner is the only module that may change it, and it changes it only by applying Effects from the kernel pipeline. Everyone else reads through the owner's query view.

| State | Authoritative owner | Others read it through | Saved? | Notes |
|---|---|---|---|---|
| Game time | `sim/kernel` clock | `query.time` (now, phase, day, due-soon) | Yes | Presentation never keeps its own game clock |
| Random state | `sim/kernel` RNG streams | not readable by UI | Yes | Separate streams per subsystem so adding a roll in one place does not reshuffle another |
| Player money | `sim/economy` wallet | `query.wallet` | Yes | Balance is derived from transactions plus a stored checkpoint |
| NPC money | `sim/economy` | `query` (coarse band: flush, tight, broke) | Yes | Exact amounts only for key NPCs |
| Relationship (A to B) | `sim/relationships` | `query.stance(a,b)`, `query.tags(a,b)` | Yes (raw dimensions and tags) | Stance label is derived, not saved |
| Standing (reputation as seen by X) | derived by `sim/relationships` | `query.standing(observer, subject)` | No (derived) | From relationship + memories + vouches |
| Promise / debt / vouch / commitment | `sim/obligations` | `query.obligations(filter)` | Yes | Append-only status history |
| Ground truth facts | `sim/knowledge` (private) | **No player-facing access** | Yes | Used only by resolvers and rules |
| NPC beliefs | `sim/knowledge` | `query.npc_can_answer(npc, topic)` (internal), never raw | Yes | |
| Claims the player has heard | `sim/knowledge` PlayerKnowledge | `query.claims()`, `query.claim_card(id)` | Yes | Claim card is derived |
| Event journal | `sim/memory` | `query.recent_events` (debug and share cards) | Yes (bounded) | Raw record, not memory |
| NPC memory | `sim/memory` | `query.what_they_remember(npc, player)` | Yes | Compacted by rules |
| Active threads, seeds | `sim/story` | `query.threads()`, `query.due_soon()` | Yes | |
| Director state | `sim/story` | debug only | Yes | Pacing counters, last-surfaced tags |
| Messages, groups | `sim/comms` | `query.chats()` | Yes (bounded) | Stored as template ids plus parameters |
| Notifications | derived by `sim/comms` | `query.notifications()` | No | Rebuilt from state at load |
| NPC location and activity | `sim/world` (place, anchor, activity) | `query.where_is(npc)` | Yes | Not coordinates |
| Shared resources (light, water, kitty) | `sim/world` | `query.world()` | Yes | |
| Housing arrangement | `sim/housing` | `query.housing()` | Yes | Housing status label is derived |
| Jobs and shifts | `sim/work` (definitions in content; shifts are obligations) | `query.work()` | Yes | |
| Player CharacterSpec (appearance) | `sim/people` player record (plain data) | `query.player.appearance` | Yes | Meaning of the data lives in `game/character` |
| NPC CharacterSpec | `content/people` (static) | same | No (static) | Dynamic changes (new clothes) saved as overrides |
| Continuous 3D positions | `game/` (engine scene) | n/a | Player only (as place + anchor + optional offset) | NPC positions are rebuilt from the sim |
| UI state (open tab, scroll) | `game/ui` | n/a | Optional preference file | Never in the world save |
| Settings (graphics, sound) | `game/` settings | n/a | Separate file | Not tied to a playthrough |
| Static content | `content/` loaded into a read-only registry | `content.get(id)` | No (but its version is recorded) | |

**Anti-patterns to reject in review:** two modules each holding "the player's money"; a UI element caching a relationship value; an NPC puppet deciding where an NPC goes; a storylet reading ground truth for a player-facing hint; a dialogue file computing a consequence.

---

## 8. SIMULATION DESIGN

### 8.1 The kernel pipeline (L1)

Everything that changes the world follows one path:

```text
Player intent or system trigger
      ↓
COMMAND   (a request: "Ask Musa about the room", "Repay Tobi ₦2,000", "advance time")
      ↓
RESOLVER  (checks availability and gating, computes the deterministic outcome)
      ↓
EVENTS    (facts that now happened: AskMade, PromiseCreated, MoneyMoved, ...)
      ↓
REACTIONS (rules watching events: memory formation, consequence rules, thread updates)
      ↓
EFFECTS   (small, named changes: change stance, add tag, create obligation, post message, ...)
      ↓
EFFECT APPLIER  ← the only code allowed to mutate state
      ↓
QUERY VIEWS (read-only) → bridge → UI / puppets
```

Key properties:

- **Causality links.** Every event records the event or command that caused it (`caused_by`). Every effect records its event. This gives the debug "why did this happen?" chain, powers the player-visible "why not" reasons, and feeds the shareable story summary (the "Wahala Receipt").
- **Cascade guard.** Reactions may produce events that trigger more reactions. Hard depth limit of 8; hitting it emits a `CascadeGuardTripped` event and stops, logged as content bug. Saves occur only at step boundaries (quiesce point) — never mid-cascade — so load cannot replay half-applied chains.
- **Same-tick order (locked).** Each fixed step processes in this order: clock advance → obligation due processing → seed firing → reactions → director (phase boundaries only). Same-timestamp ties break by stable ID order. Necessary: without fixed order, due-vs-expiry same-step races are nondeterministic across runs.
- **Idempotency.** Every Command carries a client-generated `cmd_id`. Re-sent `cmd_id` returns prior result without new effects (double-tap safe). Rejected commands emit `CommandRejected` with reason instead of mutating.
- **Closed vocabulary.** Conditions and effects come from a fixed, documented list (Section 11.3). New kinds need engine work; new combinations do not.
- **Determinism.** Same snapshot + same command list + same seed gives the same result. Ties break by stable ID order.
- **Headless.** The kernel runs from a command line, which is how tests and coding agents verify it.

### 8.2 Time (L1, clock)

- **Unit:** game minutes. The simulation advances in **fixed steps** (HYPOTHESIS: 5 game minutes per step), independent of frame rate. Frame rate affects smoothness, never outcomes.
- **Phases:** Morning, Afternoon, Evening, Night are derived from the clock using boundaries stored in content, so they can change without code changes.
- **Three modes (EXPERIMENTAL):** *Live* (time flows while the player walks, at a content-set speed), *Paused* (dialogue, phone, menus), *Skip* (advance to the next due item, phase boundary or interruption).
- **Interruption:** Skip stops when something due appears (an obligation due, a thread expiring, a message needing an answer, an NPC asking for you).
- **Offline:** no game time passes while the app is closed. (World persistence while offline is DEFERRED and only makes sense with an online service.)
- **Deadlines** are absolute game times. "Due soon" is a query, not a stored field.
- **Competing commitments** come from a query that lists overlapping windows (shift, meeting, room viewing, levy) so that the Director and the UI can show conflicts.
- **Open question for M010:** whether time should run while the phone is open. Recommendation: pause, because it is kinder to low-end phones and to players with interrupted attention; NPC replies arrive after in-world delays instead.

### 8.3 People (L2)

Each meaningful person has two halves:

- **Static (content):** identity, appearance spec, occupation, home, personality tags, wants, motives, **incentive tags** (what they gain or lose; e.g. "earns commission on rent", "fears the landlord"), fears, loyalties, bias tags, routine template reference, starting knowledge, disclosure rules, dialogue set.
- **Roles are states, not classes (locked for long-term).** Tenant/landlord/agent/caretaker/gateman/employer are derived from current ShelterArrangement, ownership records, and mandate records — never a permanent person type. A person record holds no fixed `role`; queries derive it. Ownership is a transferable `owns(person, asset)` fact changed only by simulation events (buy/inherit/sell), never by editing a class. Disputes are generic `claim(A vs B, subject)` objects escalated Conversation→Negotiation→Mediation→Authority→Court later; never hard-coded per-role suability. Sim money and any future real-money/voucher layer are separate stores; real money may create opportunities but never auto-settles obligations or overrides consequence rules.
- **Dynamic (state):** place, anchor, activity; coarse money; current concern; open threads; availability; overrides to routine.

**Intent selection** (deterministic priority list, evaluated at block boundaries and when something relevant changes):
1. Hard commitments due now (a shift, a meeting).
2. Emergencies and active threads that name this person.
3. Obligations they owe or are owed that have come due.
4. Routine block.
5. Idle.
A seeded RNG may vary *idle flavour* (which stoop to stand on) but never an outcome that affects the player's options.

**Incentive tags are discoverable.** The player learns them through the Book (what others say about a person, what they observe). This is where "incentive literacy" skill comes from: it is knowledge the player acquires, not a dice roll.

### 8.4 Relationships (L2)

- **Directional:** A's view of B is a separate record from B's view of A.
- **Stored raw:** type tags (friend, neighbour, landlord/tenant), three bounded internal dimensions (**trust, warmth, tension**), a list of important memory references, and **tags** ("housed me", "ghosted him", "introduced me to Kunle"). The player never sees the numbers.
- **Stance is derived:** thresholds in `content/rules` map the raw dimensions plus tags to Warm / Neutral / Cool / Frosty / Burned (placeholder labels). Hysteresis prevents a stance from flickering at a threshold.
- **Why this storage:** because raw dimensions and tags are stored and the stance function is content, you can later add richer states (e.g. "owes me", "protective", "jealous") without migrating saves.
- **Favour balance** is *derived* from the obligation ledger (who helped whom, what is owed) and implicit favours created by Asks. It is not a number someone can edit.
- **Standing (reputation)** is contextual and derived: *how does observer X see subject Y*, computed from X's own relationship plus memories (witnessed or hearsay) plus vouches. There is no global reputation number.
- **Propagation** happens through memory transfer (Section 8.10), so reputation only travels along real social paths.

### 8.5 Money and obligations (L3)

**Wallet.** One player wallet. Every change is a **transaction** (amount, reason code, counterparty, time, optional obligation link). The balance cannot go negative; a shortfall is solved by Ask (which creates a debt) or by not doing the thing. Exceptions would have to be an explicit, documented design change. NPCs have coarse money bands, with exact amounts only for the six key NPCs.

**Obligation.** A first-class persistent object:

| Field | Meaning |
|---|---|
| id, kind | Debt, PromisedAction, PromisedIntroduction, Vouch (optional until M005, see below), Favour (informal), Commitment (scheduled, e.g. a shift) |
| creator, recipient | Who owes, who is owed |
| amount or subject | Money, or what action, or which person |
| reason, wording id | Why it exists and the exact phrase used (retellable later) |
| created_at, due window, grace | Time rules |
| witnesses | Who saw it (feeds memory and gossip) |
| terms | Content-defined consequences per outcome |
| status | Active → Due → Fulfilled / Broken / Renegotiated (HYPOTHESIS: Released by creditor) |
| status history | Append-only. A broken promise stays in history even after repayment |
| links | Transactions, renegotiated-from, thread |

**Processing.** At every step, due obligations enter Due; past grace they become Broken; events fire; consequence rules apply effects. A broken promise leaves a **scar** memory that is never compacted away.

**Settlement semantics (locked).** Partial payment splits the obligation (remainder stays Active/Due with same terms); overpayment is refused with reason (no implicit credit); renegotiation creates a linked successor obligation and requires creditor accept via Promise (unilateral edits are rejected). Necessary: without this, double-tap/retry creates duplicate money and repayment erases history.

**Vouch** (EXPERIMENTAL, optional at M004, required at M005): an obligation of kind Vouch where the voucher accepts contingent liability. If the subject later triggers a "default" event with the audience, the voucher inherits a fraction of the consequence (stance change, a tag, sometimes money). This is how "Kunle causes a problem, the player inherits part of it" works without a special reputation system.

**Commitment** is the same machinery applied to scheduled things (shifts, meetings). That reuse is the reason work stays thin (Section 8.12).

### 8.6 Knowledge, claims and disclosure (L4)

Three separate stores prevent the "omniscient truth database" trap:

| Store | Holds | Who can read |
|---|---|---|
| **Ground truth** | What is actually true (true rent, whether the landlord's son is returning) | Only resolvers and rules. Never any player-facing query |
| **Beliefs** | What each NPC believes: value, certainty (sure / likely / rumour), source (saw / told / assumed), when | The NPC's own disclosure logic |
| **Player knowledge** | Claims the player has heard (who said what, when, where), plus incentive tags the player has *learned* | The Book and claim cards |

**NPC errors are authored, not rolled.** Misunderstanding or misremembering is seeded into an NPC's beliefs in content ("Seyi believes the rent is ₦400k; it is ₦450k"). It is never decided at conversation time.

**Disclosure policy (deterministic).** When asked about a topic, an NPC's answer is a function of: their belief, their incentive tags versus the fact's tags, their stance toward the asker, what the asker spent (money or favour), who is listening, and any confidence obligations. The result is one of **Tell, Tell with shading** (omit or exaggerate a detail), **Deflect, Refuse, Mislead** (only where an author flagged a strong incentive). No dice.

**Claim card (the suspicion indicator).** For each claim the player holds, a derived card shows: speaker, how many *independent* sources agree or contradict (independence by `origin_id`, so a rumour repeated five times counts once), what the player knows about the speaker's incentives, and age. It never shows truth.

**Ask folds verification in.** Asking a second person, a different source, or the group, at a different time, produces new claims. The card updates. There is no separate investigation system.

### 8.7 Memory and consequence (L4)

This is the moat, so it is designed to be **consumed**, not just stored.

1. **Event journal** (bounded). Raw record of what happened: kind, participants, witnesses, publicness, time, `caused_by`.
2. **Memory rules** (content). "When event kind K happens, each participant, witness or hearsay recipient forms memory kind M with salience S, tags T and decay class D."
3. **Memory records** (per NPC): kind, subject(s), source event, salience, confidence, created_at, decay class, a **scar** flag, and a hearsay chain.
4. **Gates** are the *only* places memory is read:
   - Option availability and cost ("Musa won't help; you didn't show on Friday")
   - Disclosure policy
   - Storylet conditions
   - Obligation terms (grace length, interest of goodwill)
   - NPC intent (avoids you, seeks you out)
   - Chatter in group chats
5. **Consequence rules** (content) react to events and memories and produce effects or **seeds** (scheduled future effects).
6. **Compaction.** Low-salience memories older than a threshold merge into an "impression" tag. Per-NPC caps apply. Scars and high-salience memories are kept.
7. **Consumption lint (P7).** The linter scans all content: any memory kind that no gate references is an error. This is the architecture's way of enforcing "memory only matters if it changes future possibilities."
8. **Explainability.** Every gate that blocks or changes an option returns a reason token referencing the memory or stance that caused it. The UI turns it into a line of text.

### 8.8 The four verbs (L5)

| Verb | What it is | Cost preview | Creates |
|---|---|---|---|
| **Ask** | Request information, money, shelter, an introduction, a job lead, or an extension | Money and/or favour, and standing risk | Claims, implicit Favour obligation, memory |
| **Promise** | Commit to a structured template (amount, action, date) | Opportunity cost and risk | Obligation |
| **Vouch** | Put your standing behind someone toward someone else | Contingent liability | Vouch obligation |
| **Repay** | Settle an obligation (money or action) | The cost itself | Transaction, status change, memory |
| **Decline** | Refuse a request/offer (creates memory, may cost standing) | Standing risk | Memory, stance effect, thread update |

> `Confidence` as an obligation kind is deleted (it was a privacy flag, not an obligation; use claim visibility rules instead). Proof: keeping it would let privacy state enter the debt lifecycle and corrupt due/broken semantics.

**Verb mapping (locked, prevents silent verb creep).** Offer = Ask-in-reverse (propose terms → creates pending Promise awaiting accept). Accept = Promise-create for pending offer. Refuse/Decline = explicit command above (saying no has memory). Buy/Sell = Transfer + optional Debt remainder. Work shift accept = Commitment-create. Give/Borrow = Transfer + Debt. Introduce/Warn/Invite/Leave = Ask variants with place/group effects (Leave updates membership + memory). No new verbs without milestone + tests.

Every verb has the same shape: **availability check (with reasons) → cost preview → deterministic resolution → events**. Players pick from structured templates, never free text. Tone options (polite, straight, beg) are DEFERRED until the base verbs are fun.

### 8.9 Story engine (L6)

The structure that replaces a linear script:

- **State.** The current world. Everything else reads it.
- **Storylet.** A small authored situation with preconditions (queries over state, memory, time, place), a cast binding (which NPCs fill which roles), a presentation mode (scene, DM, group post, overheard), options (each is a verb with gates), effects, a cooldown, and **director tags** (crisis, relief, joy, commons, personal).
- **Thread.** A persistent unresolved situation with a deadline and a **default outcome if it expires** (this is how time creates consequences). Housing pressure is the first thread.
- **Seed.** A scheduled future consequence created by an effect ("if the player ghosts Musa, in about three days Musa mentions it in the group").
- **Director.** At each phase boundary and after key events, builds a pool of eligible storylets and applies pacing rules from content: a maximum of open crises, a **breather** after a crisis, variety across director tags, a guaranteed joy beat every few phases, no stacking the same NPC, difficulty dial. Picks deterministically; ties use the seeded RNG; the choice is logged.
- **Cause → Choice → Consequence → New Situation** maps directly: cause (an event or memory), choice (a Command), consequence (effects), new situation (a seed, thread or storylet that becomes eligible).

### 8.10 Communication (L7)

- **Messages** are stored as *template id + parameters*, not text, so wording can change, be translated or be re-rendered in Pidgin. A message that asserts something creates a **Claim**.
- **Threads:** DMs (player and one NPC) and **groups**. The compound group is first. Others (friends, work, family, class) reuse the same structure later.
- **Actions inside chat** map to Commands: Promise, Request, Confirm, Decline, Introduce, Warn, Share location.
- **Chatter rules** (content): world events and NPC states produce posts ("NEPA don bring light", "who leave gen on?", a levy request). Posts are **public memory**: every member witnesses them.
- **Notifications** are derived (new message, due item, thread about to expire), prioritized and rate-limited.
- **Overhearing:** when the player is in the same place and anchor group as a scene flagged overhearable, the claim is delivered with source "overheard". NPCs may notice.
- **Rumour spread (EXPERIMENTAL, start tiny):** at phase boundaries, an NPC holding a shareable claim may pass it to a co-present NPC according to sharing rules (motive, relationship, publicness). Each transfer creates a weaker hearsay belief that keeps the same `origin_id`. This is how reputation travels.
- **No generative chat.** All text is authored; flavour variants are chosen with the seeded RNG.

### 8.11 World simulation (L8)

- **Place:** kind, capacity, opening windows, anchors, overhear groups. **Anchor:** a named spot with a kind (stand, sit, lean, gate, door, counter).
- **Routine template:** time blocks mapping to place, anchor and activity (your 06:30 / 08:00 / 09:00 example becomes content).
- **Overrides:** obligations, threads, emergencies and player actions can change where someone goes.
- **Travel time** between places comes from content, so the simulation and the walking animation agree on how long a move takes. Offscreen NPCs simply arrive after that time.
- **Shared resources:** *Light* (NEPA, generator on/off, fuel), *Water*, *Kitty* (the compound's shared money) are world values with small rules. A transformer fault event lowers Light; the group chat reacts; a levy thread appears. This is the "Nigeria as mechanics" layer (Section 8.13).

### 8.12 Housing and work (L9)

- **Housing** is a *ShelterArrangement* record (kind, host or landlord, terms as obligations, start, deadline thread, house rules) plus a derived **housing status** (Secure, Shaky, Borrowed, Shared, Institutional, Floating, Owned later). A crisis is a Thread with a default outcome ("the couch expires on Tuesday"). **Moving** is a Thread with steps and a *Moving Day* storylet, so it is a social event, not a level-up.
- **Soft floor.** If no arrangement is possible, a rule places the player in a costly fallback (family, a church hall, an office floor) with a scar, never a game-over. A no-softlock test enforces this.
- **Work** is shallow: a job is content (employer, schedule windows, pay). **A shift is a recurring Commitment obligation.** Each shift produces a transaction, an optional contact event (a person), and an optional lead (a claim). Gigs and hustles are one-off threads. Conflicts with other commitments come from the competing-commitments query.

### 8.13 The "Nigeria as mechanics" test, applied

| Candidate | Mechanical or flavour? | Where it lives |
|---|---|---|
| Caretaker as broker and gatekeeper | Mechanical: controls information and access, has incentives | People incentives, disclosure rules |
| Agent chain | Mechanical: claims pass through intermediaries who take a cut | Claims with `origin_id`, incentive tags |
| Compound group chat | Mechanical: public memory and social pressure | Comms |
| NEPA / generator | Mechanical: a shared-cost and timing problem | World shared resources, levy thread |
| Levy | Mechanical: collective contribution dilemma | Thread + obligations to the Kitty |
| Pidgin | Flavour (tone) | `content/strings`, `content/dialogue` |
| Names, foods, textures | Flavour | Content and assets |
| Ajo, black tax | Mechanical, DEFERRED | Same obligation system when the time comes |

---

## 9. PRESENTATION ARCHITECTURE

### 9.1 The bridge

`game/bridge` is the only module that knows both worlds. It:
- runs the simulation at a fixed step from the engine's frame loop and applies the current time mode;
- translates sim events into presentation signals (a message arrived, an NPC changed place);
- exposes read-only queries to the UI;
- forwards player intents as Commands.

### 9.2 Character architecture (P1)

Four separate concerns, as your brief requires:

| Concern | Lives in | Content |
|---|---|---|
| **Character data** | `sim/people` and `content/people` | A plain *CharacterSpec*: build, height scale, skin tone, face part ids, hair and colour, facial hair, clothing slot ids, accessory ids |
| **Visual representation** | `game/character` builder | Resolves a spec into meshes and materials |
| **Animation** | `game/character` animation state | A shared animation set on one skeleton |
| **Gameplay state** | `sim/` | Never stored in the visual |

**Modular approach (HYPOTHESIS):** one shared humanoid skeleton; a few base bodies; swappable head, hair and clothing meshes skinned to the same skeleton; accessories attached to bones; skin tone through a material parameter; face features via small decal atlases or a very small number of morph targets; clothing colours from a palette recolour. At spawn, parts may be merged into one skinned mesh to reduce draw calls (EXPERIMENTAL, test on a phone). Traditional clothing is added as extra slot items later (DEFERRED).

**Animations in order of need:** idle, walk, talk gesture (M011); then sit, stand, wave, phone, eat, sleep, knock, point, run as the sim needs them. An *activity* in the sim maps to an animation through content, so adding an activity does not require code.

### 9.3 World and scene (P2)

- A compound scene has **anchors** (named points whose IDs match `content/places`), a **navigation mesh**, **trigger volumes** for each place, **overhear zones**, and **interactables**.
- A checker in `tools/` parses the scene and the content and reports any anchor that exists in one but not the other.
- **Interiors (UNDECIDED, decide at M012):** separate small scenes, or cut-away rooms in the same scene.
- **Camera and controls (UNDECIDED, leaning):** fixed-angle follow camera and tap-to-move with proximity prompts, because they are kind to small screens, avoid occlusion problems, and are cheaper to build than free camera plus virtual sticks.

### 9.4 NPC presence (P3)

Each NPC in the current scene has a **puppet**: a small state machine that follows the sim.
- On entering a scene, puppets are placed at their current anchors. If the sim says an NPC is mid-move, the puppet is placed along the path by estimated arrival.
- When the sim changes an NPC's place, the puppet walks the navigation path and plays the activity animation on arrival.
- NPCs outside the current scene are **not instantiated**.
- Puppets never decide anything. If the puppet is slower than the sim, it speeds up or snaps on arrival.

### 9.5 Interaction flow (P4)

```text
Player approaches or taps an NPC
   ↓
Bridge asks the sim for the interaction menu for that NPC
   ↓
Sim returns verbs with availability, cost previews and "why not" reasons
   ↓
UI shows them; player chooses one
   ↓
Bridge sends a Command
   ↓
Sim returns response line ids and effects
   ↓
Dialogue view plays the lines (text from content), puppet plays a talk animation
   ↓
Events update the phone, the Book and notifications
```

The UI contains no game rules. If a rule seems to be needed in the UI, it belongs in `sim/` or `content/`.

### 9.6 Phone (P4)

The phone is a set of views over queries: **Chats** (DMs and the compound group, with contacts folded in), **Wallet** (balance, owed, owing, promises), **Book** (claims and claim cards, leads, deadlines, what people remember about you), **Notifications**. Nothing else is needed for the first slices. No screen designs here.

---
## 10. SAVE / LOAD

Local only to begin with. Cloud save and sync are DEFERRED.

### 10.1 What is saved, derived and rebuilt

| Category | Examples | Treatment |
|---|---|---|
| **Saved** | Clock; RNG stream states; wallet transactions and checkpoint; people dynamic state; raw relationship dimensions and tags; obligations with full status history; beliefs; player knowledge; event journal (bounded); memories; threads, seeds, director counters; messages and groups; world and shared-resource values; housing arrangement; flags; player CharacterSpec; player place and anchor; schema version; content version | Serialized into one snapshot |
| **Derived (never saved)** | Stance labels; standing; claim cards; due-soon lists; notifications; housing status label; competing-commitment lists | Recomputed from saved state on load |
| **Rebuilt** | NPC puppets and 3D positions; animations; UI state; camera | Reconstructed from sim state and the player's place and anchor |
| **Static content** | NPC definitions, storylets, dialogue | Not saved; only the content version is recorded |
| **Separate file** | Settings (graphics, sound, preferences) | Independent of any playthrough |

### 10.2 The specific questions

- **NPC memories:** saved wholesale, after compaction. Because compaction runs on a rule, a loaded game compacts the same way.
- **Promises and debts:** saved with their full append-only status history, wording id and witnesses. A reloaded broken promise is still broken.
- **World changes:** place and shared-resource values, threads and seeds, flags and housing arrangements are saved. Physical props that change (a gate left open) are saved as world flags, not as scene state.
- **Time:** the game clock and phase boundary counters are saved. Real-world elapsed time is not used.
- **Randomness:** each RNG stream's state is saved, so a loaded game continues exactly as an unsaved one would.

### 10.3 Versioning

- Every snapshot carries a **schema version** (an integer) and a **content version** (a hash or number).
- **Migrations** are small, ordered functions "from version N to N+1". Each has a test with a saved fixture of the old format.
- **Content changes between versions:** if a saved ID no longer exists, a documented *orphan policy* applies (for example: drop an obsolete memory kind, remap a renamed NPC id through a rename table, refuse to load with a clear message if a thread is unrecoverable).
- **Do not freeze the schema before M005.** Freeze v1 at M006, once the shape of relationships, obligations, knowledge and memory has stabilised.

### 10.4 Safety on a phone

- **Autosave** at phase boundaries, after each resolved interaction, and when the app is sent to the background or interrupted.
- **Atomic writes:** write to a temporary file, then replace the old one, so a battery death mid-save cannot corrupt the save.
- **Rolling backups:** keep the last two or three.
- **Corruption handling:** if the newest save fails validation, offer the previous one.
- **Debugging:** a `tools/` save inspector prints a snapshot in readable form; the scenario runner can start from any snapshot.

---

## 11. CONTENT AUTHORING

### 11.1 Principles

- **Content is data.** Adding an NPC, a storylet, a job or a line of Pidgin must not require editing `sim/`.
- **Stable IDs** use readable prefixes (`npc_`, `place_`, `anchor_`, `story_`, `thread_`, `memory_`, `obl_`, `str_`). IDs are never reused; renames go through a rename table so old saves still load.
- **Format:** human-readable text data files validated by a schema in `content/schema`. The exact format (JSON, a friendlier text format compiled to JSON, or spreadsheet-exported data) is **UNDECIDED**; the requirement is "easy for a coding agent to edit, easy to diff, validated by a tool."
- **All player-visible text lives in `content/strings`** and is referenced by ID, so dialogue can be revised, localised or toned (Light/Normal/Deep Pidgin) without touching logic.

### 11.2 How a future developer adds things (checklists)

**A new NPC**
1. Create the person definition in `content/people` (identity, occupation, home place, traits, wants, motives, fears, loyalties, incentive tags).
2. Add a CharacterSpec (appearance).
3. Add a routine template and place it in the compound.
4. Add starting beliefs and any authored misunderstandings.
5. Add disclosure rules for the topics they can be asked about.
6. Add starting relationships to existing people.
7. Add dialogue lines and strings.
8. Run the content linter and the scenario tests.

**A new location:** define the place and anchors in `content/places`, add travel times to neighbouring places, add the matching nodes in the engine scene, run the scene-anchor checker.

**A new relationship seed:** add an entry to the starting relationships list with tags and raw dimensions.

**A new storylet:** write preconditions, cast roles, presentation mode, options, effects, cooldown and director tags; reference only existing IDs and vocabulary; run the linter.

**A new event or consequence:** add a memory rule (event kind to memory kind), a gate that reads the memory kind, and a consequence rule. The linter fails if the memory kind is never consumed.

**New dialogue:** add strings and a line set keyed by NPC, situation and stance; provide at least a neutral fallback so a missing variant never blanks the screen.

**A new promise or obligation kind:** define fields, grace, and outcomes in `content/obligations`. If it needs a new *effect kind*, that is an engine change (Section 11.3).

**A new job or housing situation:** add content in `content/work` or `content/housing`, plus the threads and storylets that use it.

### 11.3 The closed vocabulary (the line between content and engine)

*Conditions* the content may use (HYPOTHESIS, grows deliberately): time or phase is; person is at place; stance at least/at most; relationship has tag; memory of kind exists; obligation exists (kind, status, parties); wallet at least; thread in state; claim known by player; belief held and how sure; shared resource at level; housing status is; cooldown elapsed; director allows tag; flag set.

*Effects* the content may use: change relationship dimension; add or remove tag; create an obligation; change an obligation's status; transfer money; create a memory; create a claim; set a belief; start, resolve or expire a thread; schedule a seed; post a message; override a routine or activity; change a shared resource; set a housing arrangement; set a flag; emit an event.

**The rule:** new *combinations* are content work. A new *kind* of condition or effect is an engine milestone with tests.

### 11.4 What the content linter checks

Unknown IDs; strings missing; memory kinds never consumed (P7); consequence rules no event can trigger; storylets whose preconditions can never be satisfied; threads without a default outcome; NPCs without a routine or fallback dialogue; places without matching scene anchors; obligations without outcome terms; circular seeds. The linter runs in every test pass.

### 11.5 Content volume for the first slices (HYPOTHESIS, adjust after M010)

6 key NPCs, 1 phone-only contact, 1 compound, 6 to 8 places, about 25 to 40 storylets, about 6 thread types, about 8 obligation kinds and terms, one compound group with chatter rules, about 200 to 300 dialogue strings. This is a budget to keep the slice small, not a promise.

---

## 12. TESTING

Focus on **state transitions**, not visuals. Almost all tests run headless from the command line, so a coding agent can run them and report pass or fail.

### 12.1 Test types

| Type | What it checks | Where |
|---|---|---|
| Unit | One module's logic (wallet cannot go negative; stance thresholds) | `tests/unit` |
| Scenario | A scripted multi-day playthrough with assertions at checkpoints | `tests/scenario` |
| Content | Linter and schema rules | `tests/content` |
| Save | Round-trip equality and migration fixtures | `tests/save` |
| Boundary | `sim/` imports nothing from `game/`; ground truth not reachable from player queries | `tools/` + `tests/unit` |
| Perf | Simulation step cost, NPC counts, memory caps | `tests/perf` |

### 12.2 The named tests (your examples, made specific)

| Test | Given / When / Then |
|---|---|
| **Relationship** | Given neutral stance with Tobi, when the player completes a Repay that was due, then Tobi's stance toward the player rises and a "kept my word" memory exists. |
| **Promise expiry** | Given an active promise due Friday with grace 1 day, when the clock passes Saturday with no Repay, then the obligation is Broken, a scar memory exists, and the consequence rule's effects have applied. |
| **Money** | Given a wallet of ₦1,000, when a ₦1,500 spend is attempted, then it is refused with a reason, the balance is unchanged, and no transaction exists. |
| **Memory affects an option** | Given Musa remembers the player ghosted him, when the player opens Ask options with Musa, then the option is unavailable or costlier, and the returned reason cites that memory. When the memory is absent (the earlier decision differs), the option is available. |
| **NPC knowledge** | Given an NPC with no belief about the room's rent, when asked, then they cannot return the real rent, only Deflect or Refuse, regardless of the ground truth value. |
| **Save/load** | Given a game state after three simulated days, when saved and loaded, then the snapshot equals the pre-save snapshot and a further day produces the same result as without saving. |
| **Simulation without the player** | Given no commands for two simulated days, then NPC routines, group chatter, light changes and due obligations continue, and the state differs from day zero in the expected ways. |
| **Consequence divergence** | Given two command scripts that differ only in whether the player kept an early promise, then the later options with that NPC differ. |

### 12.3 Additional tests the architecture needs

- **Determinism:** the same seed and command script produce the same snapshot twice, byte for byte.
- **Explainability:** every option returned as unavailable carries at least one reason token.
- **No omniscience:** no player-facing query can return a ground-truth value or a belief the player has not heard.
- **Independent corroboration:** five hearsay copies of one rumour count as one source.
- **No softlock:** from every reachable scenario checkpoint, at least one sequence of commands leads to some shelter arrangement and some way to earn or ask for money.
- **Director pacing:** over a long scripted run, the number of simultaneous crisis threads never exceeds the cap, and a breather follows each crisis.
- **Cascade guard:** a deliberately looping rule triggers the guard instead of hanging.
- **Migration:** every older saved fixture loads in the current version.
- **Perf budget:** one simulation step with the slice's NPC count completes under the budget set at M001.

### 12.4 Rule for agents

Tests describe intended behaviour. An agent may add tests freely but **must not edit or delete an existing test to make it pass** without the developer's approval. A failing test is information.

---

## 13. PERFORMANCE ARCHITECTURE

The target is cheap Android phones and a modest development laptop. Numbers below are **starting guesses to be replaced by measurements from the M000 spike and M012**, not facts.

### 13.1 Decisions that are expensive to change later (decide early)

| Decision | Why it is costly later | Where decided |
|---|---|---|
| Sim and presentation split | Everything depends on it | M000 / M001 |
| Place and anchor level sim | NPC logic and tests are built on it | M001 / M009 |
| Fixed-step deterministic clock | Affects save, tests, pacing | M001 |
| Stable IDs and save versioning | Old saves and content break | M001 / M006 |
| Content data format and closed vocabulary | All content depends on it | M001 |
| Renderer tier (the lightweight one) | Materials and lighting are authored for it | M000 |
| One shared skeleton for all characters | Retargeting and clothing break otherwise | M011 |
| Texture atlas strategy | Re-authoring all clothing is costly | M011 |
| World scale and unit conventions | Navigation, camera and animation tuned to it | M012 |
| Input scheme (tap-to-move vs sticks) | Camera, interaction and UI depend on it | M012 |
| Interior approach (scenes vs cut-away) | Loading and authoring differ | M012 |

### 13.2 Budgets to start with (GUESSES, verify on a real phone)

- **Frame rate target:** a stable 30 fps on the lowest target phone; a higher cap is optional.
- **Visible characters:** about 8 to 12 at once.
- **Character triangle budget:** a few thousand per character; scene total in the low hundreds of thousands at most.
- **Textures:** small atlases (for example 512 to 1024 pixels) per character and a few for the environment; compressed formats supported by the chosen engine on Android (verify).
- **Lights and shadows:** one main directional light; baked or simple blob shadows; no real-time global illumination.
- **Physics:** minimal; the character moves on a navigation mesh, not a physics simulation.
- **Draw calls and memory:** set from M000 measurements, and tracked in `tests/perf`.
- **Simulation:** one step for the slice's NPC count must be well under a frame budget; memory and message histories are capped.

### 13.3 Do later, not now

Level-of-detail meshes (the scene is small), occlusion culling beyond the engine default, object pooling (only if profiling shows spikes), audio compression tuning, shader tweaks, scene streaming (only when there is more than one compound), graphics quality tiers (M018).

### 13.4 Interruptions and offline

The game must survive phone calls, backgrounding, low battery and a killed process: autosave on background, resume to the same place and anchor, and no real-time penalties. Everything works without a network connection.

### 13.5 Practical notes for your development machine (verify each)

- Use the engine's lightweight renderer in the editor; avoid heavy editor plugins.
- Test on a **real phone over a cable**; an Android emulator on a 6th-generation dual-core with 8 GB of memory will be painful.
- Keep Blender scenes small, use the simplest viewport shading, and do not sculpt; build low-poly by hand or modify free low-poly packs.
- Keep the 256 GB disk healthy: source art outside the engine project, large files in version control with a large-file extension (verify choice), clean `builds/`, and remember the Android SDK takes several gigabytes.
- Close browsers and heavy apps when running the engine and a coding agent together.

---

## 14. ASSET PIPELINE

**Flow (HYPOTHESIS):** author or adapt in Blender (`assets_src/`) → export an open interchange format (glTF 2.0) into `assets/` → import into the engine → verify against budgets.

| Topic | Decision |
|---|---|
| Source of art | Free permissively licensed low-poly packs adapted by you, plus simple custom pieces. **Verify the licence of every pack and record it.** AI-generated 3D assets are UNDECIDED (quality and licence concerns) |
| Rig | One humanoid skeleton for all characters, with a naming convention |
| Animations | Start with idle, walk, talk made or adapted by hand; add others as the sim needs them. Any downloaded animation library must have its licence verified for use in a shipped game |
| Textures | Shared palette and small atlases; hand-painted or flat colours; no photo textures |
| Naming | Prefix by type (`char_`, `prop_`, `env_`, `anim_`) and by status |
| Manifest | `assets/MANIFEST` lists every asset with source, author, licence, date added, and status. This is a legal safeguard |
| Audio | Small, compressed; ambient loops driven by world state (generator hum, compound noise) |
| Git | Large binary files tracked with a large-file mechanism (verify); `assets_src/` is not imported by the engine, which keeps the editor fast |

---

## 15. AGENT-FRIENDLY DEVELOPMENT

You will build this with coding agents. Their failure modes are predictable: they add features you did not ask for, they edit tests to turn them green, they blur module boundaries, and they lose context between sessions. The structure of this document is built to counter those.

### 15.1 `AGENTS.md` (the rules file to create at M000)

Contents it must hold:
1. The six questions the simulation must answer (Section 1).
2. The twelve principles P1 to P12 (Section 2), shortened.
3. The four hard boundary rules (Section 6.1).
4. "Work on **one milestone at a time**. Read only the current milestone, its prerequisites, and the sections it cites."
5. "Do not build anything on the milestone's **DO NOT BUILD** list."
6. "Do not edit or delete existing tests to make them pass."
7. "Run the full test suite before and after. Report the results in the commit note."
8. "At the end, update `docs/PROGRESS.md` and the Resume Tracker, and note any decision that changed."
9. "If a requirement seems to need a rule in the UI, stop and put it in `sim/` or `content/`."
10. "If unsure about scope, stop and ask rather than expanding."

### 15.2 A standard session prompt (structure, not code)

> Milestone: [ID and name]. Read: [the milestone block], [its listed sections]. Goal: [Purpose]. Build only: [Systems to build]. Do not build: [DO NOT BUILD list]. Done means: [Acceptance criteria] and [Tests] pass, and the full suite is green. Finish by updating the tracker and PROGRESS.md.

### 15.3 Working habits

- **One branch per milestone**, small commits, a tag when the milestone is done.
- **Context pack per milestone:** the milestone block, the data-ownership table, the vocabulary list, and the previous milestone's notes. Nothing else.
- **Demo script per milestone:** a short list of commands or actions the developer can run to *see* the milestone work (important for a beginner and for motivation).
- **Human review focus:** boundaries (Section 6.1), ownership (Section 7), and "does this milestone add anything from its DO NOT BUILD list?"

---
## 16. MILESTONES

**Reading each block.** *Status* is edited by you. *Purpose* includes why the milestone sits at this point. *Do not build* is a hard fence: paste it into every agent session. Every milestone ends with a passing full test suite and a tag.

**The two proof gates (M010 and M016) are decision points, not formalities.** If a gate fails, you change the design or content and re-run the gate; you do not proceed to the next layer.

---

### M000: Project Foundation and Engine Gate

**MILESTONE ID:** M000
**NAME:** Project Foundation and Engine Gate
**STATUS:** ☐ NOT STARTED

**PURPOSE:** Create the repository skeleton, the rules file and a one-command headless test run, and decide the engine by measuring a tiny 3D spike on your laptop and on a real cheap phone. *Why first:* every later decision depends on whether 3D is viable on your hardware and targets, and the headless test habit must exist before any logic does.

**PREREQUISITES:** Git; an engine candidate installed (check the current stable version and licence terms yourself); a real Android phone with a USB cable; an editor; a coding agent.

**SYSTEMS TO BUILD:**
- Repository skeleton from Section 6
- `AGENTS.md`, `docs/PROGRESS.md`, `docs/decisions/` with the first decision note
- One command that runs all tests headless and returns pass or fail (with one trivial test)
- A boundary-check tool stub (sim must not import game)
- Hardware spike: flat ground, one capsule the player moves, ten capsule NPCs walking, one light; built to the laptop and the phone
- Written measurements: frame rate, memory, build size, build time, editor responsiveness

**FILES / MODULES AFFECTED:** whole skeleton; `docs/`; `tools/`; `tests/unit`; a throwaway spike scene under `game/`.

**STATE OWNERS:** None yet.

**INTERFACES / CONTRACTS:** The "run all tests" command and its output convention, documented in `AGENTS.md`.

**ACCEPTANCE CRITERIA:**
- The skeleton exists and is committed.
- The test command runs headless on your laptop.
- The spike runs on laptop and phone; numbers are recorded in a decision note.
- A decision is written: engine chosen, or **UNDECIDED** with the reason and the plan.
- If the spike failed, the note lists the fallback (reduce 3D ambition, or evaluate another engine or a web-based approach). **M001 to M010 do not depend on the outcome and may proceed.**

**TESTS:** The trivial test passes headless. The boundary tool runs.

**DO NOT BUILD:** Any gameplay, character models, UI, content, saves, or anything you would keep.

**COMMON FAILURE MODES:** Spending weeks on Android toolchain setup; turning the spike into the game; choosing the engine by enthusiasm instead of measurement; skipping the real-phone test; filling the disk with tools.

**NEXT MILESTONE:** M001

---

### M001: Simulation Kernel

**MILESTONE ID:** M001
**NAME:** Simulation Kernel
**STATUS:** ☐

**PURPOSE:** The runnable, deterministic, headless core: IDs, clock, RNG, state registry, and the command → event → effect pipeline. *Why here:* every other system plugs into it; getting determinism and boundaries right now is cheap, and wrong later is very expensive.

**PREREQUISITES:** M000.

**SYSTEMS TO BUILD:**
- Stable ID conventions and a read-only content registry with a minimal loader
- Fixed-step game clock with phases defined in content
- Seeded RNG with separate streams
- Command bus, bounded event journal with `caused_by`, reaction registry, **effect applier** (initially two effects: set a flag, emit an event), cascade guard
- Query interface skeleton
- Text debug console: issue commands, advance time, print state and the causal chain for an event. Minimum command set (locked): `inspect npc|rel|knowledge|memory|obligations|threads|events|place`, `advance N`, `send <command>`, `seed <n>`, `replay <scenario>`, `diff <snapA> <snapB>`, `trace <eventId>`, `why-available <npc> <verb>`, `why-believe <npc> <topic>`, `why-storylet <id>`, `why-consequence <eventId>`. Proof: without why-* commands the "why did the game do that?" requirement is untestable.
- Scenario runner that feeds a command script and asserts checkpoints

**FILES / MODULES AFFECTED:** `sim/kernel`, `sim/query`, `content/schema` (minimal), `tools/` (scenario runner), `tests/unit`, `tests/perf`.

**STATE OWNERS:** Clock, RNG, event journal → `sim/kernel`.

**INTERFACES / CONTRACTS:** Command (type, actor, parameters); Event (kind, participants, time, `caused_by`); Effect (kind, parameters, source event); Query view (read-only); Step API (advance N steps).

**ACCEPTANCE CRITERIA:**
- Seven simulated days run headless within a stated time budget.
- Same seed + same commands = identical state, twice.
- The causal chain for any event prints.
- The cascade guard stops a deliberately looping rule.
- The boundary tool is green.

**TESTS:** Determinism; cascade guard; phase boundaries; same-time event ordering; boundary rule; perf baseline.

**DO NOT BUILD:** People, money, relationships, UI beyond the text console, any save format beyond a throwaway dump.

**COMMON FAILURE MODES:** Building a general framework instead of the six things listed; using engine types; non-determinism from unordered collections or the system clock; endless tooling.

**NEXT MILESTONE:** M002

---

### M002: People and Relationships

**MILESTONE ID:** M002
**NAME:** People and Relationships
**STATUS:** ☐

**PURPOSE:** NPC records and directional relationship records with derived stance. *Why here:* obligations, verbs and memory all need "who" and "how do they stand".

**PREREQUISITES:** M001.

**SYSTEMS TO BUILD:**
- Static person definitions loaded from content; dynamic person state
- Six placeholder key NPCs (Tobi, Sunday, Musa, Mariam, Seyi, Adewale) with minimal fields
- Relationship records (trust, warmth, tension, tags), directional
- Stance derivation from content thresholds with hysteresis
- Effects: change a relationship dimension; add and remove tags
- Queries for stance and tags; basic standing from the observer's own relationship
- Debug listing of people and stances

**FILES / MODULES AFFECTED:** `sim/people`, `sim/relationships`, `content/people`, `content/rules`, `tests/unit`.

**STATE OWNERS:** Person dynamic state → `sim/people`; relationships → `sim/relationships`.

**INTERFACES / CONTRACTS:** `query.stance(a,b)`, `query.tags(a,b)`, `query.person(id)`; relationship effects.

**ACCEPTANCE CRITERIA:**
- Effects move a relationship across stance thresholds; hysteresis prevents flicker.
- A's view of B can differ from B's view of A.
- Changing thresholds in content changes stance with no code change.

**TESTS:** Threshold crossing; hysteresis; asymmetry; tag add/remove; content-only change.

**DO NOT BUILD:** Routines, locations, dialogue, memory, money, more than the six people.

**COMMON FAILURE MODES:** One symmetric score; showing numbers; thresholds in code; giving NPCs many traits that no rule reads.

**NEXT MILESTONE:** M003

---

### M003: Money and Obligations

**MILESTONE ID:** M003
**NAME:** Money and Obligations
**STATUS:** ☐

**PURPOSE:** The wallet, transactions, and the full obligation lifecycle with due processing. *Why here:* Promise and Repay are two of the four verbs, and money is the cheapest cost to prove the pattern.

**PREREQUISITES:** M002.

**SYSTEMS TO BUILD:**
- Wallet with transactions and a non-negative rule; coarse NPC money bands
- Obligation record with all fields in Section 8.5; kinds Debt and PromisedAction first (others defined in content)
- Lifecycle Active → Due → Fulfilled / Broken / Renegotiated; grace; append-only status history; renegotiation as a linked successor
- Due processing on every step
- Content rules mapping obligation outcomes to relationship effects
- Queries: wallet, obligations, due soon, competing commitments

**FILES / MODULES AFFECTED:** `sim/economy`, `sim/obligations`, `content/obligations`, `content/rules`, `tests/unit`, `tests/scenario`.

**STATE OWNERS:** Wallet → `sim/economy`; obligations → `sim/obligations`.

**INTERFACES / CONTRACTS:** Commands: Transfer, CreateObligation, Settle, Renegotiate. Events: MoneyMoved, ObligationCreated/Due/Fulfilled/Broken/Renegotiated.

**ACCEPTANCE CRITERIA:**
- A promise created today becomes Due and then Broken after grace if unsettled.
- Settling fulfils it; a broken promise remains in history after later repayment.
- The wallet never goes negative.
- Due-soon and conflict queries are correct.
- Everything happens through commands.

**TESTS:** Promise expiry; money; history persistence; renegotiation chain; determinism.

**DO NOT BUILD:** Vouch, knowledge, groups, interest, banks, NPC economies beyond bands.

**COMMON FAILURE MODES:** Treating obligations as relationship flags; deleting history on repayment; UI-editable balances; off-by-one at day and phase boundaries.

**NEXT MILESTONE:** M004

---

### M004: Knowledge, Claims and the Four Verbs

**MILESTONE ID:** M004
**NAME:** Knowledge, Claims and the Four Verbs
**STATUS:** ☐

**PURPOSE:** Private ground truth, NPC beliefs, player knowledge and claims; deterministic disclosure; Ask, Promise, Vouch, Repay with availability reasons. *Why here:* the verbs are the player's whole agency and need people, money and obligations underneath.

**PREREQUISITES:** M003.

**SYSTEMS TO BUILD:**
- Ground truth store (private), beliefs, player knowledge, claims with `origin_id`
- Disclosure rules producing Tell / Shade / Deflect / Refuse / Mislead
- Claim card (derived suspicion indicator)
- Verb resolvers with availability (with reasons), cost preview, resolution
- Ask topics: information, money, shelter, introduction
- Promise templates; Vouch as a contingent-liability obligation; Repay
- Implicit favour obligations from Asks; player learning incentive tags
- Interaction menu query

**FILES / MODULES AFFECTED:** `sim/knowledge`, `sim/verbs`, `sim/query`, `content/people`, `tests/`.

**STATE OWNERS:** Truth, beliefs, player knowledge → `sim/knowledge`. Verbs hold no state.

**INTERFACES / CONTRACTS:** Commands Ask, Promise, Vouch, Repay; `query.interaction_menu(npc)`, `query.claims()`, `query.claim_card(id)`.

**ACCEPTANCE CRITERIA:**
- Ask results follow disclosure rules with no randomness.
- An NPC with no belief cannot reveal the truth.
- Repeated hearsay counts as one source.
- Every unavailable option has a reason.
- Vouch inheritance is OPTIONAL at M004 (prove Debt flow first); required from M005. Proof: requiring experimental Vouch to pass M004 blocks the whole track on the riskiest item.

**TESTS:** NPC knowledge; no omniscience; independent corroboration; explainability; vouch inheritance; determinism.

**DO NOT BUILD:** Free text, AI replies, tone options, an investigation dashboard, dialogue presentation beyond line ids.

**COMMON FAILURE MODES:** Lying by random roll; a claim card that acts as a lie detector; truth leaking through a query; verbs with hidden side effects.

**NEXT MILESTONE:** M005

---

### M005: Memory and Consequence

**MILESTONE ID:** M005
**NAME:** Memory and Consequence
**STATUS:** ☐

**PURPOSE:** Turn events into memories by rule, and make memories change future options through gates. *Why here:* this is the moat; prove it before story and content scale on top of it.

**PREREQUISITES:** M004.

**SYSTEMS TO BUILD:**
- Memory kinds and rules from content; memory formation for participants and witnesses; scar memories
- Gates in option availability, disclosure and obligation grace; an intent hook stub
- Minimal seed scheduler (scheduled future effects)
- Compaction and per-NPC caps
- **Consumption lint** in the content linter
- Reason tokens referencing memory ids; `query.what_they_remember(npc)`
- Hearsay chain structure (transfer arrives in M008)

**FILES / MODULES AFFECTED:** `sim/memory`, `sim/verbs` gating, `sim/story` (minimal seed scheduler), `content/rules`, `tools/` linter, `tests/`.

**STATE OWNERS:** Memories → `sim/memory`; seeds → `sim/story`.

**INTERFACES / CONTRACTS:** Memory rule format; gate contract (input state, output availability, cost and reasons); seed contract.

**ACCEPTANCE CRITERIA:**
- Three canonical chains work from content only: kept promise → later vouch; ghosting → later refusal; paid favour → early tip.
- The linter fails on a memory kind nothing reads.
- Compaction keeps scars and high-salience memories.
- Reasons cite the causing memory.

**TESTS:** Memory affects option; consequence divergence; orphan-memory lint; compaction; scar permanence.

**DO NOT BUILD:** The director, groups, rumour spread, a global reputation number.

**COMMON FAILURE MODES:** An event dump; memory kinds nobody reads; consequences too subtle to notice; unbounded memory.

**NEXT MILESTONE:** M006

---

### M006: Save and Load v1

**MILESTONE ID:** M006
**NAME:** Save and Load v1
**STATUS:** ☐

**PURPOSE:** Freeze the first save schema and prove exact round-trips. *Why here:* the state shapes have now settled enough to freeze; waiting longer makes migration painful.

**PREREQUISITES:** M005.

**SYSTEMS TO BUILD:** Snapshot of every saved store (Section 10.1); schema version and content version; migration scaffold with one fixture; atomic writes; rolling backups; corruption detection and fallback; save inspector tool; autosave API (triggers wired later).

**FILES / MODULES AFFECTED:** `sim/save`, `tools/` (inspector), `tests/save`.

**STATE OWNERS:** Snapshot format → `sim/save`; every store still owned by its module.

**INTERFACES / CONTRACTS:** `save(state) → file`, `load(file) → state`, migration function contract.

**ACCEPTANCE CRITERIA:**
- After a multi-day scenario, save then load produces an equal snapshot, and a further day behaves identically to the unsaved run.
- A corrupted newest save falls back to the previous one.
- An old fixture migrates.

**TESTS:** Round-trip equality; continued-run equality; corruption fallback; migration; RNG continuity.

**DO NOT BUILD:** Cloud saves, slot UI, compression, encryption.

**COMMON FAILURE MODES:** Saving derived data; saving engine objects; unstable serialization ordering; forgetting RNG state.

**NEXT MILESTONE:** M007

---

### M007: Story Engine

**MILESTONE ID:** M007
**NAME:** Story Engine (Storylets, Threads, Seeds, Director)
**STATUS:** ☐

**PURPOSE:** Situations surface from state with pacing, instead of from a script. *Why here:* it consumes everything below (queries, effects, memory) and feeds communication and the world.

**PREREQUISITES:** M006.

**SYSTEMS TO BUILD:** Storylet definitions and evaluation; threads with deadlines and default outcomes; full seeds; **director v1** (caps, breathers, variety, joy beat, no stacking); the housing-pressure thread as the first test case; a deliberately small set (about 10) of test storylets.

**FILES / MODULES AFFECTED:** `sim/story`, `content/story`, `content/rules` (director), `tests/scenario`.

**STATE OWNERS:** Threads, seeds, director state → `sim/story`.

**INTERFACES / CONTRACTS:** Storylet format; thread format; director rule format; `query.threads()`.

**ACCEPTANCE CRITERIA:**
- A thread expires into its default outcome.
- A seed fires at its time.
- The director respects crisis caps and breathers.
- Different earlier choices surface different storylets.

**TESTS:** Director pacing; thread expiry; seed firing; determinism; variety.

**DO NOT BUILD:** A large storylet library, a quest log, narrative polish, any new condition or effect kind unless a test demands it.

**COMMON FAILURE MODES:** Storylets turning into quests; a "clever" director; special-case code for one story; vocabulary creep.

**NEXT MILESTONE:** M008

---

### M008: Communication

**MILESTONE ID:** M008
**NAME:** Communication (DMs, Group, Overhearing)
**STATUS:** ☐

**PURPOSE:** Make chat the channel through which information and pressure flow. *Why here:* it needs claims, story events and relationships, and the compound group is the first real social surface.

**PREREQUISITES:** M007.

**SYSTEMS TO BUILD:** Messages as template id + parameters; DM threads; the compound group with chatter rules; actions inside chat mapping to commands; claims attached to messages; notifications (derived, prioritized, rate-limited); overhearing delivery; **small** rumour spread by co-presence; bounded history.

**FILES / MODULES AFFECTED:** `sim/comms`, `sim/knowledge`, `content/rules` (chatter, sharing), `content/strings`, `tests/`.

**STATE OWNERS:** Messages and groups → `sim/comms`.

**INTERFACES / CONTRACTS:** Message format; chatter rule format; `query.chats()`, `query.notifications()`.

**ACCEPTANCE CRITERIA:**
- A world event produces group chatter and every member witnesses it.
- A DM action creates the right command.
- An overheard claim appears in the Book with its source.
- A rumour transfer creates a weaker hearsay belief with the same `origin_id`.
- Notifications obey the rate limit; history stays within its cap.

**TESTS:** Public memory; echo independence; notification cap; boundedness; determinism.

**DO NOT BUILD:** Friend, work, family or class groups; voice notes; free text; media.

**COMMON FAILURE MODES:** Chat as noise; chatter not tied to state; unbounded history; notification spam.

**NEXT MILESTONE:** M009

---

### M009: World Simulation

**MILESTONE ID:** M009
**NAME:** World Simulation (Places, Routines, Intent)
**STATUS:** ☐

**PURPOSE:** The compound lives without the player. *Why here:* routines depend on the clock, obligations and threads, and the text slice needs people to be somewhere.

**PREREQUISITES:** M008.

**SYSTEMS TO BUILD:** Places and anchors; routine templates; intent selection with overrides; travel times; offscreen resolution; shared resources (Light, Water, Kitty) with small rules; the transformer-fault → chatter → levy thread chain.

**FILES / MODULES AFFECTED:** `sim/world`, `sim/people`, `content/places`, `content/people`, `tests/scenario`.

**STATE OWNERS:** Place, anchor, activity → `sim/world`; shared resources → `sim/world`.

**INTERFACES / CONTRACTS:** `query.where_is(npc)`, `query.world()`; place and routine formats.

**ACCEPTANCE CRITERIA:**
- Two simulated days with no commands: NPCs follow routines, respond to overrides (a due obligation, an emergency), and shared resources change with consequences.
- Movement durations match content travel times.

**TESTS:** Simulation without the player; override priority; travel time; shared-resource reaction; determinism.

**DO NOT BUILD:** Coordinates, pathfinding, 3D, more than the compound plus two or three named nearby places.

**COMMON FAILURE MODES:** Rigid schedules; NPCs that teleport inconsistently; an over-engineered utility AI.

**NEXT MILESTONE:** M010

---

### M010: Proof Gate 1, Text Vertical Slice

**MILESTONE ID:** M010
**NAME:** Proof Gate 1: Text Vertical Slice
**STATUS:** ☐

**PURPOSE:** Prove, without any 3D, that *relationships → obligations → consequences → memory* is fun and that choices visibly change what the player can do next. *Why here:* this is the cheapest possible test of the whole product thesis, and every later investment depends on it.

**PREREQUISITES:** M009.

**SYSTEMS TO BUILD:**
- Slice content: the compound, six key NPCs plus Kunle as a phone-only contact; about ₦8,000 start; a temporary couch with a deadline; a room opportunity; Tobi needing money; a levy; a work gig; about 25 to 40 storylets; the compound group
- A deliberately crude playable front end (plain lists and buttons or text) over the queries, with time controls
- Autosave wired to phase boundaries
- A run summary produced from causal chains (a "Wahala Receipt" as text), to test whether stories are retellable
- A local playtest log
- A balance pass

**FILES / MODULES AFFECTED:** `content/*`, `game/debug` (or a text front end), `tests/scenario`, `docs/playtests`.

**STATE OWNERS:** Unchanged; this milestone adds content and a view.

**INTERFACES / CONTRACTS:** The front end uses only queries and commands.

**ACCEPTANCE CRITERIA (a real test with real players; numeric thresholds locked):**
- At least five people who did not build the game play a full first session.
- ≥4/5 can explain a consequence in their own words with a "because" ("Musa wouldn't help because I ignored him").
- Different players reach different situations from the same start (≥3 divergent playthroughs logged).
- ≥3/5 say they would continue or replay, unprompted by leading questions.
- ≥1 unprompted share/screenshot/retell with "because" (virality signal, not bribed).
- No softlocks. Save and resume work.
- **If these fail: change the simulation and content, not the graphics, and re-run.**

**TESTS:** Three scripted divergent scenario playthroughs; no-softlock; full regression; perf budget.

**DO NOT BUILD:** 3D, art, character creator, sound, extra NPCs, romance, ajo, black tax, monetization, new systems to patch content problems.

**COMMON FAILURE MODES:** Tuning only for yourself; players who skip text; too many options at once; ignoring a negative result because 3D is more exciting; adding systems instead of fixing content.

**NEXT MILESTONE:** M011 (only if the gate passes)

---

### M011: 3D Character Prototype

**MILESTONE ID:** M011
**NAME:** 3D Character Prototype
**STATUS:** ☐

**PURPOSE:** One modular character system on one shared skeleton, at phone-friendly cost. *Why here:* the 3D investment starts only after the thesis is proven, and characters are needed before the world and puppets.

**PREREQUISITES:** M010 passed; M000 engine decision.

**SYSTEMS TO BUILD:** A shared skeleton; one base body; a few hair, top, bottom and footwear parts; a skin tone parameter; a builder that resolves a CharacterSpec into a visible character; idle, walk and talk animations; a test scene with ten characters; measurements on a real phone; a decision on merging parts at spawn.

**FILES / MODULES AFFECTED:** `game/character`, `assets/`, `assets_src/`, `assets/MANIFEST`, `tests/content` (every part id referenced by a spec exists).

**STATE OWNERS:** CharacterSpec data → `sim/people`; visuals → `game/character`.

**INTERFACES / CONTRACTS:** CharacterSpec format; builder input and output; the activity-to-animation mapping.

**ACCEPTANCE CRITERIA:** Changing a spec field changes the look; the three animations play; ten characters meet the phone budget (recorded); the manifest lists every asset with a licence.

**TESTS:** Spec-to-asset consistency; perf measurement recorded.

**DO NOT BUILD:** The creator interface, facial animation, many outfits, full body sets, cloth or hair physics.

**COMMON FAILURE MODES:** Perfecting art; separate skeletons per character; heavy textures; unlicensed assets.

**NEXT MILESTONE:** M012

---

### M012: Compound Greybox, Movement and Camera

**MILESTONE ID:** M012
**NAME:** Compound Greybox, Movement and Camera
**STATUS:** ☐

**PURPOSE:** A walkable compound made of simple shapes, with the sim's places and anchors present in the scene. *Why here:* it exercises the expensive-to-change decisions (scale, controls, camera, interiors) while art is still cheap to throw away.

**PREREQUISITES:** M011.

**SYSTEMS TO BUILD:** Compound exterior greybox (gate, courtyard, stoop, generator spot, room blocks); navigation; player movement with the chosen control scheme; camera; trigger volumes that tell the sim where the player is; anchors matching content; the scene-anchor checker; live-time integration; decisions recorded on controls, camera and interiors.

**FILES / MODULES AFFECTED:** `game/world`, `game/camera`, `game/bridge`, `tools/` (anchor checker), `docs/decisions`.

**STATE OWNERS:** Continuous positions → `game/`; place and anchor → `sim/world`.

**INTERFACES / CONTRACTS:** `PlayerMoved(place, anchor)` command; anchor id conventions.

**ACCEPTANCE CRITERIA:** The player can reach every anchor; place changes reach the sim; the checker passes; a stable frame rate on the phone; decisions written.

**TESTS:** Anchor checker; a place-trigger smoke test or a documented demo script.

**DO NOT BUILD:** Final art, interiors beyond greybox, other compounds, lighting polish.

**COMMON FAILURE MODES:** Art polish too early; coordinates leaking into the sim; a free camera that is hard on small screens.

**NEXT MILESTONE:** M013

---

### M013: NPC Presence

**MILESTONE ID:** M013
**NAME:** NPC Presence
**STATUS:** ☐

**PURPOSE:** The sim visibly drives the people. *Why here:* it joins the character (M011), the scene (M012) and the world simulation (M009).

**PREREQUISITES:** M012.

**SYSTEMS TO BUILD:** Puppets for the key NPCs; following sim place and anchor changes along the navigation mesh; activity-to-animation mapping; catch-up placement on entering the scene; spawn and despawn; proximity detection; overhear zones tied to sim overhear groups.

**FILES / MODULES AFFECTED:** `game/npc`, `game/bridge`, `content/` (activity mapping).

**STATE OWNERS:** Sim owns where; puppets own nothing.

**INTERFACES / CONTRACTS:** Sim location events → puppet commands.

**ACCEPTANCE CRITERIA:** Watching a game day shows NPCs going where routines say, arriving close to sim times; entering mid-day places people correctly; no puppet changes sim state; frame rate holds.

**TESTS:** Catch-up placement; a puppet-follows-sim demo script.

**DO NOT BUILD:** Crowds, pedestrians, new animation sets beyond need, elaborate NPC-to-NPC conversation animation.

**COMMON FAILURE MODES:** Puppets making decisions; desync between sim time and walking; instantiating NPCs that are not in the scene.

**NEXT MILESTONE:** M014

---

### M014: Interaction, Dialogue and Phone UI

**MILESTONE ID:** M014
**NAME:** Interaction, Dialogue and Phone UI
**STATUS:** ☐

**PURPOSE:** The four verbs and the phone are playable through the world. *Why here:* it presents what the sim already offers.

**PREREQUISITES:** M013.

**SYSTEMS TO BUILD:** Approach → menu from the sim → verb → dialogue view; phone views (Chats, Wallet, Book, Notifications); display of reasons; notifications presentation; touch-friendly sizing.

**FILES / MODULES AFFECTED:** `game/interaction`, `game/ui`, `game/bridge`, `content/strings`.

**STATE OWNERS:** None (views only).

**INTERFACES / CONTRACTS:** Queries and commands only.

**ACCEPTANCE CRITERIA:** The entire M010 slice can be played through the 3D world and phone; every verb is reachable; reasons are visible; a review confirms **no game rule lives in the UI**.

**TESTS:** A UI smoke or demo script; a query-only check.

**DO NOT BUILD:** UI polish, extra menus, a tutorial system beyond a minimal first prompt.

**COMMON FAILURE MODES:** Rules creeping into the UI; the UI caching state; text overflowing small screens; too many taps.

**NEXT MILESTONE:** M015

---

### M015: Character Creator and Appearance Persistence

**MILESTONE ID:** M015
**NAME:** Character Creator and Appearance Persistence
**STATUS:** ☐

**PURPOSE:** The player is their own character. *Why here:* the builder and save format are stable by now.

**PREREQUISITES:** M014; M006.

**SYSTEMS TO BUILD:** A creation flow that chooses from available parts and produces a valid CharacterSpec; saving and loading appearance; the same builder for the player and NPCs; spec validation.

**FILES / MODULES AFFECTED:** `game/character`, `game/ui`, `sim/save` (player spec), `tests/save`.

**STATE OWNERS:** Player CharacterSpec → `sim/people`.

**INTERFACES / CONTRACTS:** Spec validation rules.

**ACCEPTANCE CRITERIA:** Create, save, quit, reload: identical look; invalid specs are rejected.

**TESTS:** Spec round-trip; validation.

**DO NOT BUILD:** Body sliders beyond the decided set, shops, paid cosmetics, photo mode.

**COMMON FAILURE MODES:** Letting the creator become the game; unstable part ids breaking old saves.

**NEXT MILESTONE:** M016

---

### M016: Proof Gate 2, 3D Vertical Slice

**MILESTONE ID:** M016
**NAME:** Proof Gate 2: 3D Vertical Slice
**STATUS:** ☐

**PURPOSE:** Prove the same loop works as a physical world on a real phone. *Why here:* it decides whether the 3D investment paid off before adding any more content or systems.

**PREREQUISITES:** M015.

**SYSTEMS TO BUILD:** Integration and bug fixing only; a performance baseline on the target phone; a minimal first-session flow; playtests with new players.

**FILES / MODULES AFFECTED:** Whatever the bugs touch; `docs/playtests`.

**STATE OWNERS:** Unchanged.

**INTERFACES / CONTRACTS:** Unchanged.

**ACCEPTANCE CRITERIA:**
- Gate 1's numeric criteria hold in 3D (≥4/5 because-explanations, ≥3 divergences, ≥3/5 continue intent).
- At least five new players; they notice routines and overhearing; ≥3 speak of "my compound" or similar unprompted.
- Stable on the target phone at the M000-recorded target frame rate; no crashes in a normal session; autosave and resume work.
- Three divergent stories are captured and can be retold.
- **If it fails, decide whether the problem is the 3D (fix presentation) or the loop (go back to M010).**

**TESTS:** Full regression; the three scenario scripts; perf budgets.

**DO NOT BUILD:** Any new system, ajo, black tax, extra compounds, monetization.

**COMMON FAILURE MODES:** Polishing before measuring; confusing "pretty" with "fun"; ignoring phone performance.

**NEXT MILESTONE:** M017

---

### M017: Housing and Work Depth

**MILESTONE ID:** M017
**NAME:** Housing and Work Depth
**STATUS:** ☐

**PURPOSE:** Make Act I a full arc and work a real time tradeoff. *Why here:* only now is the core proven enough to deepen the first act.

**PREREQUISITES:** M016.

**SYSTEMS TO BUILD:** All housing states and transitions as threads; Moving Day as a social event; the soft floor; work as recurring commitments (fixed job, gig, hustle) yielding money, a person and a lead; competing-commitment display; **optionally** a small starting-life generator (a few cards) and a difficulty dial.

**FILES / MODULES AFFECTED:** `sim/housing`, `sim/work`, `content/housing`, `content/work`, `content/story`.

**STATE OWNERS:** Shelter arrangement → `sim/housing`; shifts as obligations → `sim/obligations`.

**INTERFACES / CONTRACTS:** Shelter arrangement format; job format.

**ACCEPTANCE CRITERIA:** Act I is playable from several starts to several endings; a shift conflicts meaningfully with another commitment; the no-softlock test passes from every checkpoint.

**TESTS:** Housing transitions; no softlock; shift obligations; divergence across starts.

**DO NOT BUILD:** Career trees, property ownership, romance, ajo, extra compounds.

**COMMON FAILURE MODES:** Building a housing module so big it becomes the game; making work a click-to-earn button.

**NEXT MILESTONE:** M018

---

### M018: Mobile Performance and Release Hardening

**MILESTONE ID:** M018
**NAME:** Mobile Performance and Release Hardening
**STATUS:** ☐

**PURPOSE:** Make it dependable on cheap phones. *Why here:* optimization is guided by what actually exists.

**PREREQUISITES:** M017.

**SYSTEMS TO BUILD:** Profiling on two or three real low-end devices; graphics tiers; texture compression; build size and load time work; interruption handling (calls, background, low battery); crash recovery; save migration checks; text size and contrast basics; legal and content review of the shipped text; the distribution route decided (APK or store: UNDECIDED).

**FILES / MODULES AFFECTED:** `game/`, `assets/`, build configuration, `tests/perf`.

**STATE OWNERS:** Unchanged.

**INTERFACES / CONTRACTS:** Settings file format.

**ACCEPTANCE CRITERIA:** Stable at target frame rate on the chosen devices; no data loss on interruption; build within the size target; every older save fixture loads.

**TESTS:** Perf budgets; interruption scenario; migration fixtures.

**DO NOT BUILD:** New gameplay, ads, accounts, networked analytics.

**COMMON FAILURE MODES:** Optimizing the wrong thing; testing only on a flagship; breaking saves in a late change.

**NEXT MILESTONE:** M019

---

### M019: Expansion Gate

**MILESTONE ID:** M019
**NAME:** Expansion Gate
**STATUS:** ☐

**PURPOSE:** Decide, using evidence, whether and how to grow. *Why here:* expansion must preserve the core (relationships → obligations → consequences → memory) and more map must not replace deeper simulation.

**PREREQUISITES:** M018 and real playtest evidence.

**SYSTEMS TO BUILD:** None. Produce a written plan and architecture v0.2.

**FILES / MODULES AFFECTED:** This document, `docs/decisions`.

**STATE OWNERS:** n/a.

**INTERFACES / CONTRACTS:** n/a.

**ACCEPTANCE CRITERIA:** A written decision on the next ring (Section 17), which deferred systems earn a place and why, the new milestones, and which assumptions in this document were proven or disproven.

**TESTS:** n/a.

**DO NOT BUILD:** Anything before the plan is written.

**COMMON FAILURE MODES:** Expanding the map instead of deepening the loop; adding every deferred system at once.

**NEXT MILESTONE:** Defined by the plan.

---
## 17. EXPANSION PATH

Expansion happens only after M019, and only in this order, each ring earning its place:

```text
Compound
   ↓   (deepen first: more Act I and Act II storylets, more NPC history)
Neighbourhood        a few named streets, a shop, a bus stop, an agent's junction
   ↓
Campus / city area   a second kind of social space with different incentives
   ↓
Multiple compounds   NPCs and relationships that span places
   ↓
Businesses / workplaces   employers as people with incentives, not menus
   ↓
Broader social network    introductions, vouching and standing across rings
```

**The preservation test.** Every proposed expansion must answer yes to at least one question and no to the last:
1. Does it create new *obligations* between people?
2. Does it create new *relationship* dynamics that memory can read?
3. Does it add new *gates* where memory changes options?
4. Is it *only* more map, more props, or more NPC count with no new decisions?

If the answer to the fourth is yes, do not build it. **More map must never replace deeper simulation.**

### 17.1 Deferred systems and their triggers

| System | Status | Trigger to consider | How it plugs in |
|---|---|---|---|
| Ajo / esusu (rotating savings) | DEFERRED | Proof Gate 2 passed and players ask for group money mechanics | A group of linked obligations with a collection order and default consequences |
| Black tax and family obligations | DEFERRED | Same | Recurring obligations from family NPCs scaled by income |
| Friend, work, class groups | DEFERRED | Compound group proven fun | Reuse the group structure |
| Romance | DEFERRED | After M019, NPC-only and housing-entangled | A relationship type that creates shared-rent and move-in obligations |
| Tone options on verbs | DEFERRED | Base verbs fun but flat | Modifier on cost and disclosure |
| Voice notes | DEFERRED | Presentation polish stage | A message presentation mode for key NPCs |
| AI-written flavour text | DEFERRED | After M019, flavour only | Never touches state; must be reviewable and safe |
| Multiplayer or friends in a shared compound | DEFERRED | Separate design effort | Would require a new persistence and trust model; not designed here |
| Cloud saves | DEFERRED | Players ask | A sync layer over the existing snapshot |
| Monetization and sponsorship | Out of scope | Separate document | Not designed here |
| Real housing infrastructure | Out of scope | Separate product | Not designed here |

---

## 18. ARCHITECTURAL DECISIONS

*Each decision is a hypothesis. When the implementation proves one wrong, change the status and add a note in `docs/decisions`.*

### D01: Engine
- **Decision:** **UNDECIDED.** Leaning **Godot** (a lightweight open-source engine), to be confirmed or rejected by the M000 spike.
- **Why:** Lightweight editor on modest hardware; a lightweight rendering mode for low-end phones; text-based scene and script files that coding agents can read and edit; no per-seat licence cost. (Verify the current version, Android export steps and licence terms before committing.)
- **Alternatives considered:** Unity (heavier editor and builds on a 6th-generation i3 with 8 GB; commercial terms have changed in the past, verify); Unreal (too heavy); a web-based 3D library (the best distribution story and small downloads, but no editor and you build the asset pipeline and tooling yourself); a 2D or 2.5D approach (cheaper, but departs from your 3D direction).
- **Why rejected:** None rejected finally. Decided by measurement at M000.
- **Can this change later?** Yes, because `sim/`, `content/` and `tests/` are engine-independent.
- **Cost of changing later:** Low for the simulation; moderate to high for `game/` and assets (months of presentation work). This is why the spike is first.

### D02: Rendering approach
- **Decision:** Stylized low-poly, the lightest rendering tier of the chosen engine, one main light, baked or blob shadows, small texture atlases, fixed-angle follow camera (HYPOTHESIS).
- **Why:** Targets cheap Android; keeps the editor responsive on integrated graphics.
- **Alternatives:** Realistic lighting and shadows; a free-orbit camera.
- **Why rejected:** Cost, battery, and occlusion problems on small screens.
- **Can this change later?** Camera yes; renderer tier is costly because materials are authored for it.
- **Cost of changing later:** Moderate to high (re-authoring materials and lighting).

### D03: Simulation and presentation split
- **Decision:** The simulation is a separate, engine-independent, headless module that the engine layer drives through one bridge.
- **Why:** Testability, determinism, agent-friendliness, engine independence, and fast proof of the core.
- **Alternatives:** Game logic inside engine scripts attached to scene objects (the common beginner pattern).
- **Why rejected:** Cannot be tested without running the game; couples state to visuals; makes tests slow and fragile.
- **Can this change later?** Technically yes; practically no.
- **Cost of changing later:** Very high.

### D04: Character architecture
- **Decision:** Plain-data CharacterSpec in the sim; builder in the engine; one shared skeleton; modular parts; shared animation set.
- **Why:** Reuse for every character; low memory; separation of data, visuals, animation and gameplay.
- **Alternatives:** A unique model per character; fully procedural faces and bodies.
- **Why rejected:** Asset cost; memory; time.
- **Can this change later?** Part sets yes; the skeleton standard no.
- **Cost of changing later:** Skeleton change is high (re-rigging everything).

### D05: NPC architecture
- **Decision:** Static definition in content + dynamic state in sim; place and anchor level location; deterministic intent selection; deterministic disclosure; beliefs separate from ground truth.
- **Why:** Cheap, testable, explainable; keeps NPCs from being omniscient without randomness.
- **Alternatives:** Continuous-position agents; behaviour trees or utility AI with random lying; AI-driven NPC dialogue.
- **Why rejected:** Cost, untestability, loss of authorial control, unfairness to players.
- **Can this change later?** Intent logic yes; the place-and-anchor basis is hard to change.
- **Cost of changing later:** Moderate for logic; high for the basis.

### D06: Data architecture
- **Decision:** Content as validated data files with a closed vocabulary of conditions and effects; all text in string tables; stable IDs; rename tables.
- **Why:** Agents and non-engineers can add content safely; the linter can prove properties (like memory consumption).
- **Alternatives:** Content written as code; a visual authoring tool first.
- **Why rejected:** Code content defeats the linter; a tool first is premature.
- **Can this change later?** The *format* yes (UNDECIDED); the closed vocabulary idea is hard to reverse.
- **Cost of changing later:** Moderate for format (a converter); high for abandoning the vocabulary.

### D07: Save architecture
- **Decision:** Local versioned snapshot of simulation state; derived data not saved; atomic writes; rolling backups; migrations with fixtures.
- **Why:** Simple, robust on phones, testable.
- **Alternatives:** Event-sourced saves only (replay all commands); cloud-first; a database.
- **Why rejected:** Event-only saves break on content change; cloud is premature; a database is overkill.
- **Can this change later?** Yes (additively).
- **Cost of changing later:** Low to moderate.

### D08: Simulation architecture
- **Decision:** Fixed-step, deterministic, seeded; command → event → effect pipeline with one writer; closed vocabulary; causal links.
- **Why:** Reproducible bugs and tests; the "why" explanation; safe agent work.
- **Alternatives:** Frame-rate-driven updates; system-by-system mutation.
- **Why rejected:** Frame-rate dependence and tangled state.
- **Can this change later?** Hard.
- **Cost of changing later:** Very high.

### D09: Story architecture
- **Decision:** Storylets + threads (with default outcomes) + seeds + director; housing as a thread plus a small shelter record.
- **Why:** Scales authoring without a linear script; time creates consequences.
- **Alternatives:** A branching quest tree; fully random events.
- **Why rejected:** Quest trees do not scale and do not remember; random events are forgettable.
- **Can this change later?** Director rules yes; the structure moderately.
- **Cost of changing later:** Moderate.

### D10: Communication architecture
- **Decision:** Messages as template id + parameters; claims attached; groups as public memory; no generative chat.
- **Why:** Deterministic, testable, translatable, safe.
- **Alternatives:** Free-text AI chat; stored raw strings.
- **Why rejected:** Unbounded state risk and cost; hard to test or translate.
- **Can this change later?** AI flavour can be added over the top.
- **Cost of changing later:** Low.

### D11: Time model
- **Decision:** Game minutes; fixed steps; phases derived in content; live, paused and skip modes; no passage while offline (EXPERIMENTAL on pausing rules).
- **Why:** Competing commitments need real deadlines; absence must not punish.
- **Alternatives:** Action points; real-time clock.
- **Why rejected:** Action points feel mechanical and were rejected in your brief; real-time punishes players with limited connectivity or time.
- **Can this change later?** Pausing rules yes; the clock model hard.
- **Cost of changing later:** Moderate to high.

### D12: Memory design
- **Decision:** Journal ≠ memory; memory by rule; consumption lint; compaction; scars permanent.
- **Why:** Enforces "memory only matters if it changes options".
- **Alternatives:** Log everything and query on demand.
- **Why rejected:** Unbounded and not tied to gameplay.
- **Can this change later?** Yes.
- **Cost of changing later:** Moderate.

### D13: Build order
- **Decision:** Simulation and text slice first; 3D afterward.
- **Why:** Cheapest test of the thesis; safest for a solo developer.
- **Alternatives:** Start with the 3D character and world (as in your example list).
- **Why rejected:** Highest cost, lowest information, easy to stall.
- **Can this change later?** Yes, but you lose the cheap proof.
- **Cost of changing later:** Low in effort, high in risk.

### D14: Controls and camera
- **Decision:** **UNDECIDED**, leaning tap-to-move with proximity prompts and a fixed-angle follow camera.
- **Why:** Small screens, low dev cost.
- **Alternatives:** Virtual sticks and a free camera.
- **Why rejected (for now):** Cost and occlusion; to be tested at M012.
- **Can this change later?** Yes, but UI and interaction depend on it.
- **Cost of changing later:** Moderate.

### D15: Asset pipeline
- **Decision:** Blender → glTF → engine; a manifest with licences; sources kept outside the engine project.
- **Why:** Open formats, legal safety, a fast editor.
- **Alternatives:** Proprietary formats; unlicensed downloads; AI-generated assets.
- **Why rejected:** Lock-in, legal risk, quality and licence uncertainty (UNDECIDED).
- **Can this change later?** Yes.
- **Cost of changing later:** Low to moderate.

### D16: Performance strategy
- **Decision:** Decide the expensive-to-change items early (Section 13.1); measure on a real phone; optimize the rest later.
- **Why:** Avoids premature optimization while avoiding irreversible mistakes.
- **Alternatives:** Optimize everything up front, or ignore until the end.
- **Why rejected:** Wasted effort, or a late rewrite.
- **Can this change later?** Yes.
- **Cost of changing later:** Low.

### D17: Testing and agent protocol
- **Decision:** Headless tests for all simulation behaviour; scenario scripts; content linter; agents never edit tests to pass; one milestone per session.
- **Why:** Agents are fast but drift; tests and fences keep them honest.
- **Alternatives:** Manual testing only.
- **Why rejected:** Cannot detect subtle state regressions.
- **Can this change later?** Yes.
- **Cost of changing later:** Low, but habits are hard to restore.

---

## 19. OPEN QUESTIONS

### 19.1 Decided at M000 (was open questions — locked to unblock M001)

> Proof each is necessary: without language/runner/format/phone/VCS locked, M001 work thrashes (agents pick different stacks, tests unrunnable, content rewritten, perf unmeasurable).

1. **Sim language: TypeScript on Node 20 LTS.** Sim stays engine-independent, headless via CLI, no engine imports. Revisit only if M000 spike proves Node toolchain unusable on dev laptop. (Godot remains presentation-only.)
2. **Test command: `npm test` using Node built-in `node:test` + one `tools/run-tests` wrapper.** No new framework until M006. Output convention: PASS/FAIL per file, non-zero exit on fail, recorded in `AGENTS.md`.
3. **Content format v0: JSON + JSON Schema in `content/schema`.** Human-diffable, agent-editable, linter-validated. Friendlier authoring format may replace JSON later via converter; closed vocabulary unchanged.
4. **Target phone proxy: Tecno Spark 10 (4GB RAM, Android 13) or nearest available low-end device.** All M000/M012 measurements taken on this or documented substitute. Emulator is not evidence.
5. **VCS: Git + Git LFS for `assets/` binaries.** `assets_src/` never imported by engine. `builds/` ignored.
6. **Playtesters: name 5 non-builder testers during M000** (contacts + availability), so M010 cannot slip forever.

### 19.2 Can be answered during the prototype

- Whether time runs while the phone is open (recommendation: pause).
- Simulation step size (starting guess 5 game minutes) and phase boundaries.
- Stance thresholds, hysteresis amounts, and how many relationship dimensions are enough.
- How strict disclosure rules should feel; how many topics each NPC can answer.
- Claim card content and how obvious it should be.
- Director parameters (crisis cap, breather length, joy cadence).
- Whether the difficulty dial earns its place.
- Controls, camera, interior approach.
- Memory caps and compaction thresholds.
- Number of NPCs that feel right (six is a hypothesis).
- Which phone views are truly needed.

### 19.3 Can be deferred

- Local versus cloud persistence beyond local saves.
- Multiplayer requirements and any networking model.
- A graphical content authoring tool.
- Localization beyond English and Pidgin tone.
- Accessibility depth beyond basics.
- Analytics and telemetry (privacy and consent decisions).
- Distribution channel (finalised at M018).
- Ajo, black tax, romance, group types beyond the compound.
- Monetization and sponsorship (separate document).
- Real housing infrastructure (separate product).
- Moderation and legal review for any user-generated content (none planned).

---

## 20. FINAL DEVELOPMENT MAP

```text
CURRENT STAGE
   Design done. Nothing built.
        ↓
NEXT MILESTONE
   M000  Foundation and Engine Gate
        ↓
PROOF REQUIRED
   Tests run headless · a 3D spike runs on laptop and phone · engine decision written
        ↓
NEXT SYSTEM
   M001 → M009   The simulation, one layer at a time, each with tests
        ↓
VERTICAL SLICE (1)
   M010  Text slice with real players. Pass, or fix the loop.
        ↓
3D TRACK
   M011 → M015   Character, compound, NPC presence, interaction, creator
        ↓
VERTICAL SLICE (2)
   M016  The 3D slice on a real phone with real players
        ↓
EXPANSION
   M017 Housing and work depth → M019 Expansion Gate
        ↓
RELEASE
   M018 Mobile hardening, then distribution (UNDECIDED)
```

### "If I start today, what exactly should I build first?"

**M000, in this order:**

1. Create the repository and copy this document in as `AGENT9JA_ARCHITECTURE.md`.
2. Create the empty folder skeleton from Section 6.
3. Write `AGENTS.md` from Section 15.1, and `docs/PROGRESS.md` with the Resume Tracker.
4. Install the engine candidate. Check the current version and Android export instructions yourself.
5. Make **one trivial test run from the command line with no screen**, and get a coding agent to run it and report pass or fail. This is the most important habit in the project.
6. Build the throwaway spike: flat ground, one capsule you can move, ten capsules walking around, one light.
7. Build it to your laptop, then to **a real cheap Android phone over a cable**.
8. Write down: frame rate, memory, build size, how the editor felt.
9. Write the first decision note: engine chosen, or UNDECIDED with the plan.
10. Commit, tag `M000`, tick the tracker.

Do **not** model a character, write dialogue, or design a screen during M000.

### "After I finish that, where do I go next?"

**M001, the simulation kernel**, with no graphics at all: a clock, a command pipeline, a debug console that can fast-forward seven days and print why something happened. When that runs headless and is deterministic, go to **M002, People and Relationships**, and keep following the tracker. You can stop after any milestone and the project is still coherent.

**The one-sentence version:** *Prove the social loop in text first. Spend months on 3D only after real people have shown it is worth it.*

---

## 21. COVERAGE MAP (your brief's sections to this document)

| Brief section | Where it is handled |
|---|---|
| 1 Product context, 2 Core gameplay thesis, 3 Consequence + memory | Section 1, Section 8.7, principles P7 and P8 |
| 4 Compound | Section 8.11, M009, M010 |
| 5 3D world direction, 6 Character system | Sections 9 and 13, M011 to M016 |
| 7 NPC system | Sections 8.3 and 8.6 |
| 8 Relationships, 10 Reputation | Section 8.4 |
| 9 Obligations, 11 Money | Section 8.5, M003 |
| 12 Time | Section 8.2, D11 |
| 13 Housing, 14 Work | Section 8.12, M010, M017 |
| 15 Phone, 16 Group chat | Sections 8.10 and 9.6, M008, M014 |
| 17 Information / verification | Section 8.6, M004 |
| 18 Story system | Section 8.9, M007 |
| 19 World simulation, 20 Physical interaction | Sections 8.11 and 9.2 to 9.5 |
| 21 Nigerian mechanics | Section 8.13 |
| 22, 23 First slice and session | M010, Section 11.5 |
| 24 Layers | Section 3 (revised) |
| 25 Dependency graph | Section 4 |
| 26 Repository structure | Section 6 |
| 27 Data ownership | Section 7 |
| 28 Save / load | Section 10, M006 |
| 29 Content authoring | Section 11 |
| 30 Testing | Section 12 |
| 31 Performance | Section 13 |
| 32 Agent-friendly development, 33 Milestones | Sections 15 and 16 |
| 34 Critical build rule | P11 and every milestone's DO NOT BUILD |
| 35 Expansion path | Section 17 |
| 36 What the architecture must not do | Respected throughout; no code, no UI screens, no monetization, no networking, no generative chat |
| 37 Decision record | Section 18 |
| 38 Open questions | Section 19 |
| 39 Final development map | Section 20 |
| 40 Not the final truth | Status labels (Sections 0 and 5), Section 0.2 |

**Limits of this document.** I did not test any engine or phone, and I did not verify current software versions, licences or app-store rules live; those are flagged "verify". Numeric budgets are starting guesses to be replaced by M000 and M012 measurements. The design of verbs, disclosure and memory follows your brief and my earlier review; whether it is fun is exactly what M010 is for.
