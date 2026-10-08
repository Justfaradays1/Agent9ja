# AGENT9JA: Independent Review and Redesign

*Prepared 7 October 2026. Research, critique and game design only. No code, UI, schema or architecture.*

**How claims are labelled.** **[S]** = taken from sources I found this session (listed at the end). **[D]** = established game-design knowledge from my own background; I did not re-verify it live. **[J]** = my judgment. Where I could not verify something, I say so.

---

## 0. READ THIS FIRST (the verdict in one page)

**The honest verdict.** You have a strong *premise* and a weak *game*. The premise (survive a city where nothing works unless somebody knows somebody) is culturally exact, funny, and rich. But what you've written is a 33-item feature list, not a game. There is no answer yet to the question "what is the player doing, with their thumbs, in minute 4 of day 19, that is fun on its own?" Until that is answered, more systems will make it worse.

**What changed this week.** Lagos Life launched in early October and, per press, passed 1 million players in three days, with about 55,000 online at one point [S]. It is browser-based, link-to-play, with chat, land, businesses and clubs [S]. That has three consequences:

1. "Nigerian Sims" is no longer a gap. It is an occupied category with a viral incumbent. You cannot win by being "also Nigerian, also a life sim."
2. Access matters more than anything: a link in a browser beat the app store [S]. Agent9ja must be link-to-play and cheap on data.
3. Reports say players joked they don't want real-life struggles in their game [S]. That is a direct warning against your central premise (see Diagnosis, problem 2). It is the most important sentence in this whole document.

**The three structural changes I recommend.**

1. **Make housing Act I, not the game.** Housing is really one instance of a deeper abstraction: *dependence on someone's goodwill*. Your quit-notice, squatting and roommate ideas are all that abstraction. The game's real subject is **trust and social capital in a low-trust city** ("who you know"). The arc is: ask for help → belong to a community → become the person others call (the *agent* in the best sense). That arc is what the name Agent9ja is actually *for*.
2. **Replace "shared world" with "private world, shared people."** Do not build a population-dependent plaza. Lagos Life already owns that. Build small worlds (one compound, 8 to 12 people) where NPCs are the default cast and real friends can be dropped in. A compound *is* a friend group. That is also your viral unit.
3. **Make the phone and the group chat the game, and the map a stage.** Free-roam walking is expensive, not where your fun is, and Lagos Life's turf. Scene-based, text-forward, voice-note-friendly, runs on a cheap Android on bad data. This is a design choice, not a technical one: it decides what the player *does*.

**What I'd cut hardest.** Romance as a system (for now), the Market app, needs bars, careers, proximity chat with strangers, real-player agents, and any ad in the MVP.

**What I'd add that you didn't mention.** A claims-and-evidence "Wahala Board" (without it, the deception mechanic is unplayable); a pacing director with mandatory breathers; ajo/esusu and black tax (the real Nigerian money-trust systems); the compound as a *commons* (light, water, levies); a hidden-but-discoverable *cause* for every quit notice; a "Daily Wahala" seeded puzzle (your Wordle-style on-ramp); player lies (deception must run both ways); and a difficulty choice (Soft Life / Normal / Shege) that answers the escapism problem.

**Biggest risk.** Building the full list shallowly. **Strongest opportunity.** Being the Nigerian game with *memory and consequence*, which a fast-built open world cannot copy quickly.

**What to do first.** Run a seven-day *WhatsApp roleplay pilot* with about 15 people, with you as the agent, caretaker and landlord, before writing any game code. Details in Part H.

---

## PART A: DIAGNOSIS

### A1. What is genuinely strong (keep it)

- **The recognition engine.** The agent/inspection-fee/"house has been taken" experience is mass, specific, and already a comedy genre. People are *already* screenshotting agent chats and fee breakdowns to share [S]. You are not inventing a joke; you are giving an existing joke a game.
- **"People over listings."** Correct and non-obvious. Information held by different people with different incentives is a real mechanic (see Papers, Please, Return of the Obra Dinn, Among Us) [D].
- **Promises and debts as memory.** Relationship-as-ledger beats relationship-as-number. This is your best idea for story generation.
- **Housing transitions as story, not progress.** "Stable → unstable → temporary → shared" is better than "bad house → better house." Keep it, with the pacing caveat in problem 1 below.
- **The cause → choice → consequence → new situation chain.** Right instinct, and the right thing to build the whole engine around.
- **Phasing.** Audience first, money second, housing utility last. Correct, and you were right to say the future vision must not distort the first game.

### A2. What is wrong (the hard part)

**Problem 1. You have a feature list, not a loop.** Every section in your brief says "should create pressure/stories/relationships." None says what the player *does* every few seconds that is satisfying. Games survive on a moment-to-moment verb: *Stardew* has "do the day's chores and spot the heart event," *Papers, Please* has "inspect, compare, decide," *BitLife* has "read an absurd situation and tap a choice." Agent9ja's candidate verb is **"read the room, make the call"**: weigh conflicting claims from people with different motives, spend scarce time and money, and live with it. That can be fun, but only with tools to track claims (see Part E) and only if the situations are short, funny and high-contrast. Currently it is unspecified.

**Problem 2. The premise is stress; the market signal is escapism.** This is the big one. A 60-second skit about a terrible agent works because the viewer is *outside* the pain: laughter is the relief. A game puts the player *inside* it, repeatedly, for hours. Press coverage of Lagos Life reports players saying they don't want real-life struggles in the game [S]. Nigerians do laugh at hardship, but watching a punchline and living a dread-timer are different. Fixes: (a) player agency and cleverness must be the fantasy, not victimhood; (b) the pressure must be *comic and pace-controlled*; (c) players choose their pain level (Soft Life / Normal / Shege); (d) there must be joy, pride and aspiration pockets (your own room, an owambe, a small win), not just crisis.

**Problem 3. Housing is too narrow to sustain 90 days, but too good a spine to drop.** Housing alone will saturate around week three: after two quit notices and three agents, the player has seen the pattern. But the abstraction underneath housing, dependence on someone's goodwill, generalises to jobs, money, family and love. So: housing is the first act and the tutorial for the whole game, not the whole game.

**Problem 4. Scope.** The brief covers a phone with 7 apps, a city with 15+ location types, transport modes, a shopping cart, careers, romance, multiplayer, ads, and a housing business. Even a large studio would build this as a multi-year programme. A student-founder team cannot. The risk is not a bad game; it is a hundred shallow features, none of which produces a story worth sharing.

**Problem 5. The multiplayer assumption.** "Real players as roommates, agents, lenders, rivals" is where social worlds break: population density, griefing, scamming between players, moderation cost, teen safety, and the contradiction between authored consequence and player unpredictability [D]. Habbo, at its peak a giant, lost users after moderation controversies and a server merge that wrecked its economies [S]. Lagos Life itself had to reset its economy after hacked accounts produced trillion-naira balances [S]. A living plaza is the most expensive and fragile thing you could choose.

**Problem 6. Compound vs group chat.** You treat the compound as the core environment. I agree it's the right *stage*: a bounded cast with shared infrastructure and shared problems is exactly what Stardew's Pelican Town and Animal Crossing's island do [D]. But the *group chat* is the stronger engine: it carries the gossip, the information asymmetry, the levies, the rumours and the screenshots. If forced to choose a single core system, choose the group chat, and let the compound be its visible home.

**Problem 7. Phase 3 is leaking into Phase 1.** Several of your ideas (a trust/reputation graph, "verified agents," neighbourhood data) are Phase 3 requirements wearing game clothes. Game behaviour is performative: people lie, joke and role-play. It is not evidence about real agents. Treat the game's reputation systems as *fiction*, designed for story, and keep them legally and conceptually walled off from any real-world product (Part B6).

**Problem 8. Defensibility and timing.** A single developer shipped Lagos Life [S]. If housing/rent/jobs features appear there, they can be copied quickly. Your moat is not the idea; it is the *writing, the memory/consequence engine, the tone, and the community*. Also, the Lagos Life surge is a short window of attention for Nigerian sims. That argues for a *fast, cheap pilot*, not a long build.

---

## PART B: RESEARCH

### B1. Lagos Life: what is known and what is not

**Known from press [S]:** Created by Ijeoma Shalom Rayhamen, inspired by The Sims 3 and the Lagos Run danfo game. Browser-based, no download. Players meet, chat, buy virtual land, run businesses and spend nights in clubs. Counter showed about 1.17 million players, 55,000 online and 9.1 million visits by 5 October. Google search interest broke out by thousands of percent. The game page carries ads; the economy was reset after hacked accounts produced trillion-naira balances; income tax is being added. Reporters caution that a million players is not a million regulars, and that retention is unknown.

**Not known (I could not verify):** its real feature depth, daily-active retention, how chat is moderated, and its roadmap. I only have press, not play time.

**What this teaches you [J]:**
- Distribution beats polish: link, browser, no install, share on X/TikTok.
- The Nigerian audience for this genre is real and *large*.
- The hard part is *retention after novelty*, which is exactly where a consequence/memory engine can win and a plaza cannot.
- Do not compete on "walk around Lagos." Compete on "the story of what happened to me there."

**Field test (do this within 48 hours; two hours of play):** note (1) what you do in minute 10 vs minute 90; (2) whether anything *remembers* you; (3) what people say in chat and whether it's funny, toxic or empty; (4) what you'd screenshot; (5) what's missing that you wanted; (6) how it behaves on a bad connection.

### B2. Comparable games: what to steal, what to avoid

| Game | What it proves | Steal | Avoid |
|---|---|---|---|
| **The Sims** [D] | Sandbox plus needs plus build mode makes stories, but mostly from the player's imagination | Small, readable moments; identity through the home | Needs micromanagement; shallow social memory; no consequence between households |
| **BitLife** [D] | Short text choices, absurd outcomes and a shareable life summary are viral and retentive | Fast decisions; the life-summary artifact; absurdity | Pure randomness that makes choices feel pointless |
| **Animal Crossing** [D] | Calendar-synced events, villager personalities and a *friendly* housing loan create daily habit | Seasonal calendar; the affectionate-debt idea (Agent9ja is its dark-comedy mirror); villager voice | Zero pressure; real-time clock that punishes absence |
| **Stardew Valley** [D] | A clear day structure with hand-authored relationship events beats thousands of random ones | A few deep authored characters; "one more day" structure | Farming-style grind; marriage as a checklist |
| **Habbo** [S][D] | Rooms as identity, a plaza, and micro-transactions can reach tens of millions of monthly users; revenue from sales, ads and sponsorship | Room-as-identity; sponsored spaces | Server merges that break economies; moderation scandals; dependence on crowd density |
| **Avakin / IMVU** [D] | Avatar/fashion expression drives spending; UGC economies work with heavy moderation | Self-expression cosmetics later | Plaza dependency; stranger DMs |
| **Roblox social worlds** (Brookhaven, Bloxburg) [D] | Friends-as-cast roleplay in private servers drives huge play | Friend-group-as-unit | Roleplay with zero systemic consequence |
| **GTA/FiveM roleplay** [D] | Player-run jobs and housing create powerful stories, but need rules, staff and committed roleplayers | Institutions generate story | Player-run agents in an open population; heavy admin burden |
| **Persona series** [D] | Time slots plus relationship ranks plus calendar deadlines create a compulsive rhythm | Time as the central resource; deadline calendar | Dating-sim framing |
| **Crusader Kings** [D] | Emergent stories from characters with traits, motives and relationships | NPCs with wants and leverage | Spreadsheet density |
| **RimWorld / Dwarf Fortress** [D] | A "storyteller" paces events; systems collide into legend | A pacing director; cause-and-effect between systems | Complexity creep |
| **Fallen London / storylet games** [D] | Quality-based narrative scales authored content cheaply | Storylets gated by state; callbacks | Walls of text without game feel |
| **Papers, Please / This War of Mine** [D] | Moral pressure plus rent/family stakes plus *inspect and decide* is gripping | Evidence-weighing; family stakes | Unrelenting bleakness (see Problem 2) |
| **Reigns** [D] | Binary choices with consequence bars are playable in seconds | Speed of decision | Opaque consequences |
| **Wordle / Among Us** [D] | A shared daily puzzle and social deduction create conversation and virality | Daily Wahala; deduction | Competitive anxiety |

### B3. What the design research says (my distilled principles) [D]/[J]

1. **Retention comes from unfinished obligations, not rewards.** People return to check on people and pending outcomes. Streak mechanics work but breed resentment; you've already said you don't want them.
2. **Emergent stories need legible causality.** Players retell stories where they can say "because." Random events ("a rat bit you") are forgotten; consequences of *your* choices are retold.
3. **Few deep characters beat many shallow ones.** Authored depth for 8 to 12 people outperforms procedurally varied strangers.
4. **Memory must be visible to the player.** If the game remembers but never shows it, the player can't enjoy it. "What Tobi remembers about you" should be a screen.
5. **Pacing is a design object.** Crisis → relief → seed of next crisis. Without breathers, pressure becomes fatigue.
6. **Economies fail through faucets without sinks, and through client-trusted state.** Habbo's economy suffered from a merge [S]; Lagos Life's through hacked balances [S]. Conservation (every naira comes from somewhere) is a *design rule*.
7. **Population density is a design problem, not a marketing one.** Solve it by making the unit small, or by making the cast mostly NPC.
8. **Virality needs a native format.** Here it's the *chat screenshot* and the *fee breakdown* (Nigerians already share these [S]), not a coin reward.
9. **Daily shared events create conversation.** Wordle's power was that everyone had the same puzzle.

### B4. Nigerian housing reality, mapped to mechanics

| What is real [S] | Mechanic it suggests |
|---|---|
| People pay inspection fees to many agents; reports of ₦10k to ₦20k per inspection in 2026, often for unsuitable houses | Inspection is a *bet*: time + money for a chance at real information |
| Agents sometimes hand the client off to another agent on the day; "agent chains" | Chain length is visible only through investigation; each link takes a cut |
| A viral fee breakdown: caution fee, rent, legal, service, agency and a "drink" fee | The *fee stack* is a comedic and educational artifact; each line is negotiable or challengeable |
| Realtors say agent commission should be around 10%; agents say 10 to 20% is their pay; tenants report fees rivalling rent | The agent's incentive is rent-proportional, so agents benefit from higher rents |
| Commentators report agents nudging landlords to raise rents because commission rises with rent | **The quit notice can be caused by an agent.** (Hidden cause mechanic, Part F) |
| Lagos notice law (as summarised by legal commentators): about 1 month for monthly tenants, 6 months for yearly, 7 days for tenants at will; 7 days' notice to recover possession; limits on advance rent | Realistic timers (7/14/29-ish days) and legal-literacy as a *skill the player can learn* |
| Enforcement is weak; some landlords ignore the rules | Rules exist but can be bent: the player may know the law and still lack leverage |
| Lagos proposed a 2025 tenancy bill to curb arbitrary hikes and agency fees; some states moved to restrict agent fee collection; agent registration with LASRERA required since 2022 | A "registered vs unregistered" tell; seasonal political events |
| Landlords and tenants clash over generators and noise; a viral video of a landlord confronting a tenant over a generator | Compound rules are comic and real |

**Design caution:** keep the *content* accurate where it teaches (notice periods, fee norms) and *clearly fictional* where it names people. Do not present game rules as legal advice.

### B5. Nigerian humour and chat culture: what lands

From the sources and my own knowledge:

- **Institutional absurdity.** Power cuts, "fuel your generator to run the business that pays the electricity bill" is a joke comedians already make [S]. NEPA, water, fuel, transport.
- **Recognition plus expectation plus twist.** The "house has been taken" beat is funny *because you saw it coming*.
- **Hustle and resilience.** Sapa (being broke) is already a character in a Nigerian mobile game as a pot-bellied enemy [S]. Humour as coping.
- **Family and status.** Expectations, "send small something," owambe flexing, borrowed-car pretence.
- **Absurd specificity.** A "drink" fee [S]; "sample" and "potential" in house descriptions; landlord interview questions.
- **Catchphrases that escape into daily speech.** Comedians' phrases enter everyday urban Nigerian vocabulary [S]. Design signature phrases on purpose so players quote them.
- **A caution.** Academic reading of online skits notes many revolve around bodies, infidelity and gender stereotypes [S]. The audience for that content exists; it is also a trap for a mixed, young audience. Don't import it as your humour engine.

**Group-chat culture.** WhatsApp is the residents' association, noticeboard and court in many African estates [S, Nairobi example]. A Lagos study examined WhatsApp use in a new 144-apartment estate for maintaining shared facilities [S]. Nigerian WhatsApp behaviour includes broadcast messages, status updates, "happy new month" floods and group fatigue [S]. Voice notes are a major mode [D]. These are all *mechanics*: broadcasts, status, mute, leave, voice note, screenshot, "Who added me here?"

**Limit of this research.** I could not scrape TikTok, Reels, X or Nairaland comment threads live. What I found is article-level and snippet-level. I recommend the WhatsApp pilot described in Part H to find the jokes you can't find from outside.

### B6. Law, safety and privacy [S]/[J] (not legal advice; get Nigerian counsel)

- **Data protection.** The Nigeria Data Protection Act 2023 requires fair, lawful, transparent processing and data minimisation; a Nigerian court has treated a platform as a joint data controller for harmful user content (Falana v. Meta) [S]. For a game that stores relationships and money histories, plan for consent, purpose limitation and takedown.
- **Defamation.** Publishing false statements that damage reputation creates civil and criminal exposure [S]. In-game NPCs are fictional; real players or real businesses named in "agent reputation" features are not.
- **Fraud and real money.** Anything that moves real naira, or implies real property transactions, enters payments, consumer-protection and estate-agent regulation territory (Lagos requires registered agents [S]).
- **Advertising.** Regulators such as ARCON and consumer-protection bodies (FCCPC) govern advertising and pricing transparency [S]. Sponsored content must be labelled.
- **Minors.** Your audience will include teenagers. Money, debts, alcohol/clubs and relationships need age-appropriate defaults, no stranger DMs, no gambling-like mechanics, and clear moderation.
- **Relationship content.** Nigerian law and social norms around relationship types are a legal and safety decision, not only a creative one. Take local counsel's view before designing partner/romance systems.
- **The Game ≠ Truth rule.** Game data must never be repurposed as evidence about real people.



---
## PART C: ANSWERS TO YOUR SPECIFIC QUESTIONS

*Verdict first, reasoning short. The full mechanics of each model are in Part F.*

### C1. Game identity

**What should Agent9ja be?** A comic, phone-centred **social-trust life sim**: you manage a small web of people, promises and money in a city where nothing works unless somebody knows somebody. It is closer to *Persona's time-and-relationships rhythm + Papers, Please's inspect-and-decide + Crusader Kings' characters-with-motives + BitLife's speed and shareability*, wearing Nigerian clothes. It is not The Sims (no needs/build), not Lagos Life (no open plaza), not a housing app.

**The player's fantasy.** "I'm clever, I'm connected, and I can make this city work for me." The fantasy is *street-smart social capital*, not victimhood. Emotional arc: **"Who will help me?" → "Where do I belong?" → "People call me when they need help."** The second fantasy is pride of place: *this is my room, my compound.*

**What it is about at the deepest level.** Trust under scarcity. Interdependence. The tension between generosity and self-preservation, handled with humour ("na so life be"). Housing is the first and clearest case of a universal fact: **you live on somebody's goodwill.**

### C2. Core loop

**What the player does repeatedly** (4 to 8 minute session):
1. **Morning Gist:** what happened overnight (messages, rumours, compound state).
2. **Plan:** spend 4 time slots (morning/afternoon/evening/night) across: Work/Hustle, Find Help (ask someone), Check (verify a claim), Help (someone else), Rest/Chop (recover and socialise).
3. **Scenes:** one to three short encounters, each a choice with partial information.
4. **Night Ledger:** money, promises kept/broken, relationship changes, new open threads, and one seed of tomorrow.

**Meaningful decisions.** Who to ask, whom to believe, what to promise, whom to help at your own expense, what to spend time on. **Resources:** naira, time slots, energy (soft), per-person trust, compound standing, housing runway (days of security), strain. **Consequences:** always visible in the ledger and the people's behaviour.

### C3. Opening: exactly how it begins

**Principle:** hook first, setup inside the tension, first shareable moment before the player leaves.

- **First 30 seconds.** No login, no creator. A phone buzzes. A voice note from the caretaker: the landlord wants to see you today and it is not small. A landlord message follows. The player taps one of three reply tones (Polite / Straight / Beg). Why: it teaches that the phone is the interface, that voices matter, and sets stakes before any menu.
- **2 minutes.** Still inside the "Landlord is typing…" pause: name, one of six looks, and **one of three dealt Life Cards** (e.g. "Final-year student, hostel closing, ₦40k"). Why: character creation as play, framed by tension, under a minute.
- **5 minutes.** The landlord meeting. The quit notice arrives with a *reason that sounds plausible but is not the whole truth*. The compound group chat lights up with reactions. First lie opportunity (claim a job you don't have?). Why: teaches chat, claims, and that everyone has an angle.
- **10 minutes.** First **Find Help**: ask Tobi (friend), Sunday (caretaker) or a "friend of a friend" agent DM. One choice costs real money: ₦3k inspection, and "the house has been taken." The player's first promise ("I'll pay you Friday") creates a ledger entry. The session ends on the Night Ledger and a share card ("Day 1: Notice. ₦3k gone. House taken."), plus a teaser: tomorrow's Gist hints at *why* the notice really happened. Why: one comic beat, one real cost, one open thread, one reason to return.

### C4. Continuation: why not leave after housing is solved?

Because the *first crisis is the tutorial for the real game*. After housing resolves, three pulls open:
- **Obligations:** the person who housed you now has a claim on you.
- **Aspiration:** the player chooses a direction (Secure My Own Place / Never Be Broke / Be The Plug / Support My Family).
- **Compound plotlines:** commons problems, a feud, a new caretaker, a landlord with plans.

| When | What the player is doing | Why they return |
|---|---|---|
| **Day 2** | Living with the first consequence: shelter terms, a work shift that conflicts with an inspection | Time pressure and a promise due |
| **Day 7** | First stability or first shake-up; picks an aspiration; discovers the true cause of the notice | A reveal and a goal |
| **Day 30** | Act II: belong. Compound meeting, ajo (rotating savings), levies, a favour called in | People need you; your reputation precedes you |
| **Day 90** | Act III begins: broker, vouch, mentor, or leave a legacy | New verbs, new power, new stakes |
| **Long term** | Seasonal calendar, new compounds, Japa/legacy runs, creator and friend worlds | Fresh seasons and the pull of the group |

### C5. Story: the engine

No linear plot. The engine is **qualities + storylets + threads + seeds + a pacing director + memory** (Part F). Every important choice writes *facts* (what happened), *tags* (how people now see you) and *seeds* (callbacks scheduled for later). The rule: **every big choice must pay off at least once.** Debts and promises are **objects with terms**, not numbers: lender, amount, date, witnesses, and how it was said.

### C6. People: who matters, who is NPC, who is player

- **Always NPC, authored deeply:** landlord, caretaker, gateman, core compound tenants, key agents. These are your Stardew villagers.
- **NPC by default, player later (opt-in, friends-first):** roommates, friends, rivals, lenders.
- **Never player-controlled in early phases:** agents and landlords with power over strangers. This is where fraud and harassment live.
- **Relationships** are **Ties**: type + history of moments + open threads + stance, with a word-based temperature (Warm / Neutral / Cool / Frosty / Burned) *derived* from history, not a score.

### C7. Chat: what players do inside it

- **DMs:** structured replies with tone chips (Polite, Pidgin-straight, Beg, Joke, Lie); in-chat action buttons (Send, Request, Promise-with-date, Introduce, Vouch, Warn, Share location); voice notes from key NPCs; "seen" delays and being left on read.
- **Proximity chat:** reinterpreted as **overhearing**. At a place, ambient snippets reveal information. No live stranger proximity chat (moderation sink; Lagos Life's turf).
- **Group chats:** the main information channel (see F). Players post from a short contextual menu (~6 to 10 lines), react, quote to challenge a claim, mute, leave.
- **Rumours:** carry provenance (who said it first) and a hidden truth value. Spreading a false rumour costs standing.
- **Recommendations:** a *vouch* is a spendable, riskable act: you lend your reputation to someone.

### C8. Phone

**Five icons:** **Chats** (DMs + groups), **Wallet** (balance, owed, owing, promises), **Notebook** (claims, leads, deadlines, "what people remember about me"), **Gist** (daily feed, rumours, share), **Places** (travel with time cost). **Excluded:** a separate Market app, Housing app, Work app, Map-as-world, Calendar-as-app. Those become views inside the Notebook or contacts inside Chats. Reason: menu overload kills a text-forward game.

### C9. Romance

**Verdict: not in the MVP, and not as a standalone system at all.**
- **Evidence:** romance reliably increases attachment and story generation in life games [D]. And there is real audience appetite for relationship comedy in Nigerian skits [S]. So your instinct to defer is right, but "romance improves retention" is not a free pass.
- **Why cut for now:** heavy writing and moderation cost; a generic dating system makes Agent9ja a Sims-clone; real-player romance is a harassment vector; legal and social context needs local counsel (B6).
- **When and how, Phase 2:** NPC-only first, and only as a **housing-entangling relationship type**. A partner changes your rent, time, privacy and obligations; moving in is a housing event; a breakup can be a quit notice. That is distinct from a dating sim. Family comes first (black tax, "come back home," hosting), because for Nigerian housing life family is the heavier system.

### C10. Work

**Depth: shallow, connective, short.** No career trees. Three archetypes per background: a *fixed job* (rigid hours, a boss, salary day), a *gig* (flexible, lumpy), a *hustle* (risky, information-rich). Work is one or two short scenes with a choice, outputting **money + a person + a rumour**. Overwork buys money at the price of strain and missed leads. Coworkers drop housing leads; salary day is a calendar beat ("salary don delay"). A workplace group chat exists. Work's job in the sim is to **burn time and introduce people.**

### C11. Money

- **Naira only, conserved.** Every naira comes from a faucet (work, gifts, ajo payout) and goes to a sink (rent, food, light, transport, data, tips, levies, family).
- **Transfers have states:** sent / pending / received / disputed ("I don send" screenshots are a real comedic genre).
- **Debt is an object** with terms, not a wallet number.
- **Pressure** comes from obligations (rent, levies, black tax, ajo); **status** from visible spending and possessions; **conflict** from broken promises.
- **Not grindy:** income is tuned to "tight, not hopeless"; most progress comes from relationships, not repetition.
- **Not pay-to-win:** nothing premium converts to naira or to relationship power. Monetise cosmetics, sponsorship and seasonal content, never leverage.

### C12. Compound: what happens and why return daily

A commons with memory (Part F). Players return daily not for chores but because **shared problems and people's moods change**: light on/off, water, the kitty, the next meeting, someone's debt, a rumour about the landlord. The compound's **Book** (a noticeboard-diary) records who lived there, who left and why, who helped whom.

### C13. Agents: avoiding "everyone is a scammer"

Model each agent by *economics, not morality*: **mandate, margin, pipeline, reliability, peer reputation, pressure.** Different agents fail in different ways with *learnable tells*. The scam is not the content; the **verification puzzle** is. Add redemption: a hustler agent you helped becomes a loyal source of early leads. Let the player *bypass* agents (go direct to the caretaker, save the fee, anger the agent). Trust is learned through **triangulation tools** (Part F): ask another person, visit at a different hour, request a paper, send a friend, pay a small test, check peer hearsay.

### C14. Housing: friend → squat → quit notice → roommate → apartment as emergent story

Each housing state is defined by **whose goodwill you are living on.** Moving changes *who controls your security*, and therefore *where stress comes from*. Transitions are storylets with terms, costs and clocks. The shape you described is right, with one pacing rule: **a major housing crisis no more than about once every three weeks of play**, and every crisis followed by a breather. Otherwise it becomes a treadmill.

### C15. City: size, essentials, "between housing"

**First world: one neighbourhood, about eight places:** compound, street/junction (POS, provisions shop, mama put), bus stop, friend's place, workplace (three variants), agent's junction/office, community hall/church-mosque, plus campus if the player is a student. Between housing moments: work, chop, family errands, compound events, owambe, charging your phone at someone's shop. Use **fictional neighbourhoods** that echo real archetypes (mainland student area, mid-income family area, island/aspirational). Grow the city in rings, unlocked when an agent shows you a house elsewhere. **9ja, not just Lagos:** later seasons can add other cities (Abuja, Ibadan, Port Harcourt, campus towns), which is a real differentiator against Lagos Life.

### C16. Virality: what becomes TikTok/X/WhatsApp content, and why

- **The in-game chat screenshot** (agent says one thing, tenant says another). Nigerians already share agent chats and fee breakdowns [S].
- **The Fee Stack card** (caution, legal, agency, "drink").
- **The Night Ledger / "Wahala Receipt."**
- **Moving Day** (mattress on a keke) clips.
- **"Who caused my quit notice?"** reveals.
- **Role-reversal: "Be the agent for a day."**
- **Daily Wahala** result grids, Wordle-style.
Why: each is an *artifact of a story*, tells it in seconds, and invites "this happened to me too." Not coins.

### C17. Retention: why play for…

| Horizon | Why they stay |
|---|---|
| **10 min** | A funny, specific hook; a real cost; a first shareable beat |
| **1 hour** | The cast has memory; first resolution; first obligation |
| **7 days** | Open threads, the compound's rhythm, an aspiration, the Daily Gist |
| **30 days** | Act II: belonging, a reputation that changes what people ask of you |
| **90 days** | Act III: new verbs (broker, vouch, mentor), seasons, legacy |
Retention bet: **unfinished obligations and visible memory**, not rewards. Rule of thumb (approximate, industry folklore): if few players return by day 7, fix the first-week loop before adding anything.

### C18. Advertising

Phase 2, after retention is proven. Principles: **in-world, useful, labelled, never interrupting.** Sponsor categories that fit: telcos (data, "data don finish"), fintech (transfer UI, POS), power (inverters, solar, gen fuel), FMCG, transport. Keep **out**: betting, predatory loan apps, and real-estate developers until you can vet them (a trust game cannot sell developer ads without a credibility crisis). Realistic early revenue is **sponsorship and creator partnerships**, not display ads. Display ads on the game page cheapen trust (Lagos Life carries them [S]); consider whether you want that. Comply with advertising and consumer-protection rules [S]. Be honest: sponsors want measurable weekly actives; you cannot sell attention you have not yet proven.

---

## PART D: DO NOT BUILD

Tags: **U** unnecessary · **B** boring · **C** too complex · **R** repetitive · **G** gimmicky · **X** expensive · **RET** harms retention · **SOC** harms social · **IMM** harms immersion · **CLONE** clone risk

| # | Cut | Why | Tags |
|---|---|---|---|
| 1 | Free-roam city, walking, driving, okada/keke driving | Expensive, not where your fun is, Lagos Life's turf | X, CLONE |
| 2 | A shared open plaza as the primary social space | Needs density; moderation burden; clone | X, SOC, CLONE |
| 3 | Proximity chat with strangers | Harassment vector; teen safety | SOC, X |
| 4 | Hunger/hygiene/bladder needs | Sims micromanagement; no decision | B, U |
| 5 | Career trees and many jobs | Content-heavy, shallow in play | C, X |
| 6 | Romance/dating as a standalone system (MVP) | Writing + moderation + clone feel | C, CLONE |
| 7 | Listing browser, filters, map of houses | Exactly what you said you're not building | U, CLONE |
| 8 | A Market app with a catalog and cart | Menu overload; items must change a state or verb | C, R |
| 9 | Visible friendship scores (0 to 100) | Turns people into meters | IMM |
| 10 | Daily login rewards and streaks | Violates your principle | RET, G |
| 11 | Real-time offline penalties (evicted while asleep) | Punishes NEPA and data outages | RET |
| 12 | Free-text AI NPCs that invent facts | Contradicts state; unfair clues; safety | C, IMM |
| 13 | Player-run agents with real reputations (early) | Fraud, harassment, legal exposure | SOC, X |
| 14 | Real-money transactions, play-to-earn, crypto | Regulatory, fraud, gambling-adjacent; also crowded [S] | G, X |
| 15 | Any ads in the MVP | Unproven attention; trust damage | RET |
| 16 | Public "most trusted agent" leaderboards naming real people | Defamation and NDPA risk | X |
| 17 | Multi-city expansion before depth | Content dilution | X |
| 18 | Elaborate character creator | Long creators lose data-limited players | RET |
| 19 | Multiple currencies | Habbo-style confusion [D] | C |
| 20 | Long tutorial and text walls | Bounce | RET |
| 21 | Random events not tied to state ("a rat bit you") | Forgettable; no cause | R |
| 22 | Property ownership/build mode | Phase 3; Sims territory | C, CLONE |
| 23 | Everything-app phone with 9 apps | Overload | C |
| 24 | Clicker mini-games for work | Feel like filler | B, G |
| 25 | A linear authored campaign | Not scalable; against your thesis | X |
| 26 | Hackable client-trusted economy; server merges | Lagos Life and Habbo both paid for this [S] | X, RET |
| 27 | "Everyone is a scammer" as the whole agent concept | Repetitive in a week | R, B |
| 28 | Ten landlords and fifteen agent types at launch | Depth beats breadth | C |

---

## PART E: WHAT YOU ARE MISSING

An experienced designer would flag these immediately.

1. **The Wahala Board (claims and evidence).** Without a place that shows *who said what, how sure, and what contradicts it*, the deception mechanic is unplayable. Papers, Please and Obra Dinn live or die on this. Keep it light: claims tagged with source and stakes; a gentle "something no add up" flag on contradictions.
2. **Verification verbs.** Ask another person, visit at another hour (gateman at 6 a.m. vs 2 p.m.), request a paper, send a friend, pay a small test, ask the group (public, costs standing).
3. **Joy, pride and comfort.** "My Room 1" with small upgrades (fan, mattress, curtains, posters, phone charger), loss when you move, and share-worthy pride. Plus owambe, small wins, and "UP NEPA!" when light returns.
4. **A choice of pain: Soft Life / Normal / Shege.** Answers the escapism signal [S] and costs almost nothing to build.
5. **A pacing director with mandatory breathers.** Crisis, relief, seed; at least one joy beat every two sessions.
6. **Ajo/esusu and black tax.** The real Nigerian money-trust systems. Ajo is a perfect group trust mechanic (who collects first, who defaults). Black tax is the family pressure that competes with your own goals.
7. **The compound as a commons.** Light (NEPA, generator, inverter, prepaid meter), water, waste, security, levies: collective action problems that generate group-chat drama.
8. **Hidden-but-discoverable causes.** Every quit notice has a reason (landlord's family need, an agent chasing a higher rent, the caretaker's side deal, a neighbour's complaint, your own earlier choices, a sale). Investigating it opens negotiation options and replay.
9. **Reciprocal deception.** The player can lie too (to the landlord, an agent, a friend). Lies become claims others can check.
10. **A soft floor and a safety net.** There is no game over. If you run out of options you go to family, church, an office floor, with shame and cost. Dignity matters: the tone must never mock poverty.
11. **Daily Wahala.** A seeded, shared 10-minute scenario (same hand for everyone) with an emoji result grid. It is your cold-start fix, your on-ramp, and your Wordle moment, and it needs no population.
12. **Role reversal.** Play the agent, caretaker or landlord for a day. Reveals the system's moral shape and is highly shareable.
13. **Japa and legacy.** A late-game prestige: leave Nigeria, and a cousin inherits part of your network ("my cousin dey come"). It keeps the game from needing infinite progression and is culturally resonant.
14. **Voice notes and sound.** Voice notes are a core Nigerian chat mode [D]. Generator hum, "light don come," the "UP NEPA" shout.
15. **Language dial.** A Pidgin intensity setting (Light / Normal / Deep) and short text. Reading load and code-switching matter.
16. **Interruption-proof, low-data design.** The game must survive power and data cuts, load quickly from a link, and never punish an absence.
17. **Safety and moderation by design.** Friends-only social, no stranger DMs, teen-safe defaults, no gambling-like mechanics, takedown paths.
18. **Economic integrity.** Conservation, rate-limited transfers, authoritative state, no real-money in or out.
19. **Creator and skit kit.** Replays, chat-screenshot export, seeded challenges: Nigerian skit-makers are your distribution [S].
20. **Success criteria and a capacity plan.** What tells you it's working (share rate per session, return after first crisis, "would replay"), and what the smallest team can actually ship.
21. **Defensibility.** Plan for copycats: writing, memory engine, tone and community are the moat.

---
## PART F: THE BETTER AGENT9JA (DESIGN BIBLE)

### F1. Design Thesis

**Agent9ja is a comic social-trust life sim about who you know in a city where nothing works unless somebody knows somebody.** It is a relationship-and-obligation ledger disguised as funny daily life, played through a phone and a handful of illustrated places, with stories produced by a memory-and-consequence engine and shared as chat screenshots. Housing is Act I. The whole game is *dependence on other people's goodwill, and the slow move from asking for help to being the help.*

### F2. Core Fantasy

"I'm clever and connected enough to make a rigged city work for me, my way." Arc: **Tenant → Neighbour → Connector.** Pride of place ("this is my room, my compound") is the second fantasy and the antidote to pure stress.

### F3. Core Loop

Morning Gist → Plan 4 time slots → 1 to 3 scenes → Night Ledger → seed for tomorrow. Session 4 to 8 minutes; one weighty decision per session. Verb: **read the room, make the call.** Two modes share this loop: **The Life** (persistent, deep) and **Daily Wahala** (seeded, 10 minutes, shared by all players that day).

### F4. Player Model

- **Identity:** name, one of ~6 looks, a Pidgin dial, a **Life Card**, one **Edge** and one **Burden**.
- **Difficulty:** *Soft Life / Normal / Shege* (changes pressure frequency and crisis size, not the rules).
- **Resources:** naira; time slots; energy (soft: affects slots and bargaining); per-person trust; compound standing; housing runway; strain.
- **Standing** is shown as **tags with provenance** ("Pays late, per Tobi"; "Peacemaker, per Mariam"), not a score.
- **Strain** is a soft consequence: overload makes some options unavailable ("too tired to bargain").

### F5. Starting-Life Generator

**Choose-from-dealt:** the game deals three Life Cards from ~8 archetypes (Final-year student; Fresh graduate; Junior bank staff; Apprentice; Hustler with good money and no papers; Family-supported but cut off; Socially connected but broke; Isolated but stable). The player chooses *one card*, one **Edge** (e.g. "good talker," "knows a caretaker," "has a laptop") and one **Burden** (e.g. "black tax requests," "owes ₦15k," "cousin with strings"). Hidden **Luck seeds** deal the crisis (quit notice, rent hike, roommate leaves, family stops paying, friend's couch expires, job loss), its clock (7/14/29 days), its hidden cause, and which contacts are reliable or flaky.
**Fairness rules:** never an unwinnable hand; always at least two viable paths; always one honest helper exists. *Uncomfortable is allowed; powerless is not.*

### F6. Housing Model

Housing is a **dependency on someone's goodwill.** States:

| State | Who controls your security | Cost / privacy / obligation |
|---|---|---|
| **Secure (lease)** | Landlord, via rules and rent date | Rent; privacy; compound rules |
| **Shaky** | Landlord's decision (notice, arrears, hike) | Clock running; bargaining available |
| **Borrowed** (friend/family couch) | A friend's patience | Cheap; zero privacy; favours owed; their clock |
| **Shared** (roommate/room-share) | A peer; two-way dependence | Split costs; negotiated rules |
| **Institutional** (hostel, corper lodge) | The institution | Cheap; rules; end date |
| **Floating** (office, church, transit) | Nobody; shame and risk | Last resort; soft floor |
| **Owned** (late) | You | Responsibility, tenants of your own |

**Transitions are storylets** with terms, costs and clocks, not menu clicks. **Moving Day** is a scene: transport choice, limited carry (about 10 slots), things left behind. **Pacing:** no more than one major housing crisis per ~3 weeks of play; after each, a breather. **Legal texture** (notice periods, advance-rent limits) is accurate where it teaches and never framed as advice [S].

### F7. Compound Model

A **commons with memory**: 8 to 12 residents, a landlord (on-site or absent), a caretaker, a gateman. Shared infrastructure: **Light** (NEPA / generator / inverter / prepaid meter), **Water** (borehole/tank), **Waste**, **Security/Gate**, **Noise/Parking**. **Compound qualities:** Harmony, Light, Water, Kitty (shared fund). **Commons events** (monthly Compound Meeting; ad hoc: transformer fault, levy, generator ban) force contribution decisions. **The Book** (noticeboard/diary) records past tenants, incidents, who helped, who owes. **Rule:** moving does not erase a compound: former neighbours stay in your phone and your history persists.

### F8. Agent Model

Each agent has **mandate** (exclusive/open/none), **margin**, **pipeline** (caretaker, landlord, other agents; chain length), **reliability**, **peer reputation**, and **pressure** (their own rent, quota). Types: *Connected*, *Hustler*, *Lazy*, *Inspection farmer*, *Chain agent*, *Caretaker-agent*, *Relative-agent*, *Premium*, *Ghost*. **Tells are consistent and learnable** (rushes you to pay today; won't name the landlord; sends a different agent on the day; refuses a paper trail). **Agent speech is a comedy asset** ("e dey sample," "just got taken," "I get client wey wan pay today"). **Redemption and bypass** are both allowed. **Incentive fact:** agent commission rises with rent [S]; agents can *cause* rent hikes, which links to the Quit Notice Mystery (F17).

### F9. Caretaker Model

The **information broker and gatekeeper.** Knows the property's true state, tenants, landlord's mood and real rent; may skim levies, double as an agent, favour the landlord or tenants. Relationship tools: small tips ("for the drink"), favours, errands, being quiet. The caretaker can become your best ally or worst enemy, and often *is the cause* of a quit notice.

### F10. Landlord Model

A handful of sharply drawn personas, each with **rules, pressures and triggers**: *Retired Civil Servant* (lectures, rules), *Absentee Abroad* (vague, slow), *Young Heir* (renovate and flip), *Market-Rate Maximiser* (December hikes), *Church-Elder* (guilt and soft power), *Overbearing Landlady* (curfews, visitors register). **Tenant interview** as a scene: the landlord screens *you* (job, marital status, church) and you may lie. Landlords have *reasons*; the player's agency is to discover them.

### F11. Work Model

Three archetypes (fixed job / gig / hustle), one or two scenes each, outputting **money + person + rumour**. Salary-day calendar beat. Workplace group chat with an "Oga." Overwork vs networking vs leaving early is the time tradeoff. **No career trees** until Phase 2.

### F12. Money Model

Conserved naira; **sent / pending / received / disputed** states; debt as an object (lender, amount, due, witnesses); **ajo** (rotating savings, weekly contributions, who collects first, default consequences); **black tax** (family asks that scale with your income); levies; tips; data/power bundles. Sinks: rent, food, light, transport, data, levies, family. Faucets: work, gigs, gifts, ajo payout. **No premium naira, no real-money in or out.** Transfers capped and rate-limited early. **Loan apps** appear only as a satirical NPC hazard, never as an ad.

### F13. Relationship Model

A **Tie** = *type* (family, friend, neighbour, colleague, roommate, partner [P2], mentor, rival, enemy) + *History* (moments: shelter given, money lent, promise broken, intro made) + *Open threads* (debts, promises, favours) + *Stance* (what they want from you). **Temperature** is a word derived from history. **The Return:** favours have half-lives and *call-in events* ("Tobi housed you → Tobi asks for ₦20k"). **Scars remain**: repayment improves temperature but a tag like "You ghosted him once" persists. **"What they remember about me"** is a visible screen.

### F14. Chat Model (DMs)

Structured replies with tone chips; in-chat buttons (Send, Request, **Promise (date)**, Introduce, Vouch, Warn, Share location); voice notes for key NPCs; read/seen delays; typing-then-"Ok." comedy. **Promise cards** are visible to both parties and tracked in the Wallet. A **vouch** lends your reputation to someone and is riskable.

### F15. Group Chat Model

The **centre of the information flow.** Each group (compound, friends, class, workplace, squad) has members, vibe, an admin, and a **topic generator** driven by world state (Light returns → "UP NEPA 🙌"; landlord rumour; levy poll; "who dey outside gate?"). Rules: (1) **group chat is public memory**: what you post is known to all; (2) **rumours carry provenance** and a hidden truth value; (3) **asking publicly** signals your need and creates debts to responders; (4) **side chats can leak**: a screenshot to the landlord is a betrayal event; (5) **mute/leave/remove** are social events; (6) **quote-to-challenge** ("Who told you?") is a verification verb; (7) **screenshot export** is the share artifact. Players post from a short, context-sensitive menu, not free text.

### F16. Phone Model

Five icons: **Chats, Wallet, Notebook (claims, leads, calendar, history), Gist, Places.** Anything else is a view inside these. **Light & Charge:** when the compound has no light, you need to charge elsewhere (a shop, a neighbour), a small social/information beat, with sponsor potential in Phase 2.

### F17. City Model and Event Model

**City:** one neighbourhood (~8 places) in a fictional district; rings unlock as housing leads demand. **Events** come from three layers under a **pacing director (Wahala Director):**
- **Seasonal/scheduled:** Nigerian calendar (resumption, ember months, December, January rent, fuel price shocks, elections), **synchronised across all players** so people compare.
- **Systemic:** derived from compound and NPC states (light fails → gen levy → argument).
- **Personal:** derived from threads, seeds, burdens.

**Quit Notice Mystery:** each notice has a **hidden cause** (landlord's family need; an agent chasing higher rent; the caretaker's side deal; a neighbour's complaint; your own earlier lateness; a sale/renovation). Investigating it changes your options. **Director rules:** show the cause; no stacked crises; **mandatory breathers**; at least one joy beat per two sessions.

### F18. Story Engine

**Qualities** (state on player, people, compound) + **Storylets** (short authored scenes with preconditions and effects) + **Threads** (open obligations with clocks) + **Seeds** (scheduled callbacks) + **Director** (tension and variety). Pipeline per big choice: write *facts*, write *tags*, plant *seeds*, update *threads*. **Callback budget:** every major choice earns at least one future payoff. **Authoring budget (prototype):** ~12 storylet families (Agent, Caretaker, Landlord, Commons, Friend favour, Money/Ajo, Work, Family, Seasonal, Joy beats, Rumour, Quit-Notice causes) × ~5 storylets × 3 relationship variants. **Principle:** systems decide *what happens*; authored text decides *how it's said*. If generative text is ever used, only for flavour (banter, phrasing), never for facts.

### F19. Memory Model

Stores **Moments** (weighted by emotional weight × publicness × recency, with decay for trivial ones), the **Ledger** (money, promises, favours), **Tie tags**, **Housing history** (places, durations, how each ended), **Reputation tags with provenance**, and the compound's **Book.** Uses: callbacks, NPC dialogue variants, event gating, share cards. **Legibility rule:** if the game remembers it, the player can see it.

### F20. Progression

No levels. **Three Acts** with new verbs: *I Tenant* (ask, pay, trust), *II Neighbour* (contribute, organise, mediate, chair the compound), *III Connector* (broker, vouch, mentor, build). **Aspirations (pick one around day 5, revisable):** Secure My Own Place; Never Be Broke; Be The Plug (become a trusted agent/connector); Support My Family. **Endgame/prestige:** *Japa* (leave; a cousin inherits part of your network). **Cut:** "Own Property" (the capstone of Secure), "Leave My Area" (fold into Move Up), "Become Influential" (fold into Plug), "Know Everybody" (a by-product), "Build a Business" (Phase 2 venture).

### F21. Romance and Family

**Family first** (MVP): parents/siblings/aunties as pressure and safety net; black tax; "come back home" as a shame-costing soft floor. **Romance Phase 2, NPC-only, housing-entangled** (move in together, shared rent, breakup as quit notice). No courtship mini-game; PG-level content; legal check first.

### F22. Multiplayer / NPC Balance

**Private world, shared people.** Each player's compound is their own instance with an NPC cast. Phases: **(1)** solo + shareable artifacts; **(1.5)** **Friend Compound**: up to ~8 real friends in one persistent compound, empty rooms filled by NPCs, one friend may be Landlord (opt-in, bounded powers: rent changes within caps); **(2)** cross-compound visits, opt-in matching, a vouch network with reputation gating; **(3)** player-brokers only after safety and legal groundwork. Rule: **strangers never DM freely.** This solves density, moderation, cost and griefing, and a compound *is* a WhatsApp group.

### F23. Retention

Retention levers: unfinished obligations, visible memory, aspiration, the compound's rhythm, synchronised seasons, Daily Wahala. **Away rule:** deadlines run on *played* days, not real time; offline loss is staged ("letter sent," not "you're out"); *While you were away* shows 3 to 5 items, at least one actionable and one funny; no streak rewards; at most one opt-in notification per day.

### F24. Virality

**Share artifacts:** in-game chat screenshots (own style, not imitating any real app), Fee Stack card, Night Ledger / Wahala Receipt, Moving Day, "Who caused my quit notice?" reveal, Daily Wahala grid, role-reversal clips. **Creator skit kit:** replay, seeded challenges ("Can you get a roof in 7 days with ₦40k?"), voice-note packs. **Why they spread:** they tell a story in seconds and invite "that happened to me."

### F25. Advertising (Phase 2)

Sponsored *places and storylets* (labelled), telco data/transfer UI, inverter/solar/power bank sponsors, FMCG in the shop, branded events. Rules: useful in-world, honest, never interrupting a decision, no betting, no loan apps, no developers until vetted. Measure weekly actives first.

### F26. Long-term Housing Opportunity (Phase 3)

Treat as a **separate product** with separate consent and data. The game's lasting contribution is **an audience, a trusted brand, and a renter community trained to ask the right questions** (who owns it, can I see the paper, is the agent registered). Do not import game reputations as evidence. Needs: data-protection impact assessment, takedown, verification, and Nigerian counsel on payments, agent registration and defamation [S].

---

## PART G: STORYBOARD

*The district, compound and people are fictional. Naira values are illustrative.*

### G1. Before playing

On X, a screenshot: an agent's chat reads "House don go, but I get another one, ₦10k inspection" next to a fee stack that includes a ₦30k "drink." The caption: "I played Agent9ja and my own caretaker caused my quit notice 😭". A friend sends a **Daily Wahala #9** result grid in a WhatsApp status. The link opens in the browser in seconds, no login, no app store.

### G2. First 10 minutes (the player, "Tola")

- **0:00** Phone buzz, caretaker Sunday's voice note: "Oga Tola, landlord say make you come see am. E no be small matter." Landlord: "Come see me today." Three reply chips.
- **0:30** "Landlord is typing…" Tola names herself, picks a look, draws **Final-year student, hostel closing, ₦40k**; Edge: *knows a caretaker*; Burden: *cousin with strings*.
- **2:00** Landlord Mr. Adewale: "29 days. My son is coming back." The compound group lights up. Seyi: "Wahala dey." Tola may lie about a job; she doesn't.
- **5:00** First **Find Help**: Tobi offers a couch "for now"; Sunday hints at a room; an agent, Kunle, DMs from nowhere ("I get one for you, ₦3k inspection"). She pays. Kunle's friend shows up; "the house has been taken."
- **8:00** Tola promises Tobi she'll pay Friday for a night's food and light. First ledger entry.
- **10:00** Night Ledger: −₦3k, +1 promise, +1 mystery tag ("Landlord's son? Maybe"). Share card appears: "Day 1: Notice. ₦3k gone. House taken." Gist teaser: *Mariam saw Sunday talking to a stranger at the gate.*

### G3. Days 1 to 7

| Day | What happens |
|---|---|
| **1** | Notice; ₦3k lost; promise to Tobi |
| **2** | Tobi's floor with rules; Mariam charges phones at her shop; Tola learns the gateman Musa remembers every visitor |
| **3** | Conflict: a work shift (₦6k) versus an inspection. Coworker whispers: "my cousin dey leave one room" |
| **4** | Sunday tips: the "son returning" story isn't the whole story. A neighbour hears Sunday brought someone to see the room |
| **5** | Friends' chat: Kunle agented Seyi's friend too. Quote-to-challenge: "Who told you?" Tola learns Kunle works a chain |
| **6** | Tobi: "My brother dey come back Tuesday." **New deadline.** The cousin's room is real but needs a deposit by Monday |
| **7** | Decision: pay via the coworker's cousin (cheaper, riskier) or negotiate with Mr. Adewale using what she learned. Aspiration chosen: *Secure My Own Place*. |

### G4. Days 14, 30, 90

- **Day 14:** Housed via the cousin's room; **still owes Tobi ₦10k.** The Quit Notice Mystery resolves: Sunday had pitched a higher-paying tenant; Mr. Adewale's son is real but not returning soon. Tola can confront, expose in the group chat, or use it as leverage.
- **Day 30:** Act II. New compound meeting: transformer fault, ₦2k levy. Mariam's ajo invitation. Tobi calls in a favour ("introduce me to your agent"). Tola's standing tag now reads *Pays eventually, per Tobi.*
- **Day 90:** Act III. Seyi leaves; two newcomers ask Tola to *vouch* for them to Mr. Adewale. She can vouch honestly, vouch a friend who may default, or refuse. Her reputation is now an asset she can spend.

### G5. Three radically different stories from the same world

**1. The Schemer (Edge: "good talker"; Aspiration: Be The Plug).** She tracks the notice's cause, bypasses Kunle by paying Sunday a small "drink," and gets the first room early. By week 3 she is connecting other tenants to rooms for a tip. By day 60 she is a trusted *hustler agent*, with a rival agent working to ruin her, and a pending temptation to farm inspections. Her reputation tags (*Reliable*, *Sharp*, *Takes a cut*) are visible to everyone. The story's question: will she stay honest when it's profitable not to?

**2. The Provider (Burden: black tax; Aspiration: Support My Family).** He gets a stable but low-paid job. Each month his mother's "send small something" competes with rent. He refuses an ajo turn to send money home and loses standing with Mariam. A family event forces him to move back for three weeks (soft floor: shame cost, but no loss). He returns changed: the compound's chair, who mediates disputes. The story's question: what do you owe family vs yourself, and what does being dependable cost?

**3. The Drifter (Life Card: Socially connected but broke; Difficulty: Shege).** She couch-hops: Tobi (7 days), a friend's hostel (3 days), a cousin (2 weeks). Each host's clock drives the next move; each leaves a tag ("housed her once"). She never pays a single inspection fee. By day 40 she knows more people than anyone, and the compound's elders start asking *her* for introductions. By day 90 she has no lease but the widest network in the game and chooses *Japa* with a visa fund pooled via ajo. A cousin inherits her contacts. The story's question: is a network a home?

**4. Friend Compound (multiplayer).** Eight friends from one class create "Compound 12." One, **Daniel**, volunteers as Landlord; NPC tenants fill empty rooms. Daniel raises rent within caps as a joke; the group chat explodes; Tola's friend **Ife** threatens to leave. The screenshot of that group chat, with real friends in character, is the post that brings in the next 8 players. The story's question: *do you stay friends with your landlord?*

---
## PART H: FINAL VERDICT

### H1. The verdict, item by item

- **What Agent9ja is.** A comic social-trust life sim about dependence on other people's goodwill, played through a phone, a group chat and a small compound. Housing is its first act.
- **What Agent9ja is not.** Not The Sims, not Lagos Life, not a listings app, not a dating sim, not a plaza, not a play-to-earn game, not a stress simulator.
- **Why people would play it.** Instant recognition ("this is my life") plus the fantasy of being sharper than the system, in a game you can start from a link and finish a session in five minutes.
- **Why people would return.** Open obligations, a cast that remembers, a compound whose mood changes, shared seasonal events and a daily puzzle. Not streaks.
- **Why people would invite friends.** A compound *is* a friend group. Making your friend your landlord is funny. Daily Wahala results are worth comparing.
- **Why people would share stories.** The artifacts (chat screenshot, fee stack, Wahala Receipt, "who caused my quit notice") are small, funny and about *them*.
- **What makes it Nigerian.** The agent economy, the compound and its commons, NEPA, ajo, black tax, group-chat culture, voice notes, Pidgin and the Nigerian calendar, treated as *mechanics*, not decoration.
- **Different from Lagos Life.** They built an open plaza with land, business and clubs, with free-roam play [S]. You build a small, consequence-driven story world where memory and trust are the game. They are complementary: their audience is your warm market.
- **Different from The Sims.** No needs micromanagement or build mode; the social ledger and consequence memory are the core.
- **Different from a normal social game.** It does not depend on strangers. It is playable alone and better with friends.
- **Commercially interesting because** it creates a Nigerian-native audience with high shareability, sponsor-friendly contexts (telco, fintech, power, FMCG), creator partnerships, and an option on a later trust product.
- **Biggest risk.** Building a shallow version of everything. Second: the premise's stress versus the audience's wish for escape [S]. Third: copycats.
- **Strongest opportunity.** To be the Nigerian game with *memory and consequence*, the thing a fast-built open world cannot easily copy.
- **Prototype first.** The Quit Notice Week (below).
- **Do NOT prototype yet.** Plaza, romance, ads, real housing, free-roam, careers, marketplace, player-run agents, AI free-text NPCs.

### H2. Prototype plan

**Step 0 (week 1): WhatsApp roleplay pilot, no code.** Run a seven-day game with ~15 people in a real WhatsApp group. You play the landlord, caretaker, agent and gateman; players ask, pay (pretend naira), promise, and gossip. Goals: Is *Find Help* fun? Do people lie, verify, screenshot? What jokes land? What do players ask for that you didn't design? Record: completion, shares, "would you play again," and the funniest 20 messages.

**Step 1 (weeks 2 to 6): The Quit Notice Week vertical slice.** Link-to-play, text-forward, voice-note capable. One compound (9 NPCs), 3 Life Cards, 1 landlord, 1 caretaker, 2 agent types, 1 workplace, 5-icon phone, claims board, ledger/promises, ~60 storylets, the Quit Notice Mystery (4 causes), the Night Ledger share card and chat-screenshot export. **Plus Daily Wahala v0** (one seeded scenario).

**Success criteria (my suggestions; calibrate with your own baseline):** most testers finish week one; a meaningful share screenshot or share something unprompted; testers can retell their story with a "because"; at least some say the game remembered something they did; return intent after the first crisis.

**Step 2:** Friend Compound (async, ≤8 friends). **Step 3 onward:** seasons, aspirations and Act II/III content; only then sponsorship pilots.

**Capacity note.** Whatever your team size, write the plan to what a very small team can ship in weeks, not quarters. Scene-based, text-forward design is *the* cost lever.

### H3. AGENT9JA 1.0 DESIGN DNA

1. **Housing is dependence on goodwill.** Always ask: *whose mercy are you living on?*
2. **People over listings.** Information lives in people with motives, not in menus.
3. **Every cause is discoverable.** No arbitrary misery; the player can always investigate why.
4. **Every big choice pays off later.** Seeds, callbacks and a visible memory.
5. **Promises and debts are objects, not numbers.**
6. **Time is the scarce resource.** Every action costs a slot someone else wanted.
7. **Deception runs both ways.** Players can lie; lies can be checked.
8. **Struggle is comic and chosen.** Soft Life / Normal / Shege; joy and pride are mandatory.
9. **Private world, shared people.** Small groups, NPCs by default; no stranger plaza.
10. **The phone and the group chat are the game.** The map is a stage.
11. **The share artifact is the story.** Chat screenshots, fee stacks, receipts.
12. **Never punish absence.** Deadlines run on played time; offline losses are staged.
13. **Conserved economy, no pay-to-win, no real money.**
14. **Depth over breadth.** Fewer characters with real wants beat many with none.
15. **Game truth is not real truth.** Fictional reputations stay fiction; Phase 3 is a different product.

---

## SOURCES AND CONFIDENCE

**Sourced this session ([S] in the text).**
- Lagos Life reach, features, ads, economy reset and income tax: Technext, "Lagos Life hit 1 million players in three days" (technext24.com/reviews/lagos-life-1-million-players-nigerian-games/); Graphic Online and Arise coverage of Lagos Life.
- Agent and inspection-fee experiences, fee breakdown with a "drink" fee, commission views: Zikoko house-hunting stories; Legit.ng agent-charges post; Prime Business Africa on mobilisation fees; The Guardian Nigeria on estate agents and rent; Nairaland thread on agents and landlords.
- Lagos notice periods, advance rent, LASRERA registration: Lawpadi, "How to protect your rights as a tenant in Nigeria"; Street Lawyer Naija on common tenancy myths.
- Proposed Lagos Tenancy and Recovery of Premises Bill: Gazette NGR and The Guardian Nigeria on Lagos tenancy law.
- State moves on agent fees: Daily Trust via AllAfrica, September 2025; Prime Progress NG.
- Generator confrontation with a landlord: Legit.ng.
- Comedy and catchphrases: African Arguments on Nigerian skit-makers; Ripples Nigeria on a comedian's NEPA joke; a 2025 Nigerian study of online human-angle skits; a call for papers on Nigerian digital drama skits.
- WhatsApp culture and estate groups: Citizen Digital (Nairobi estate groups); an IEEE conference paper on a Lagos estate and WhatsApp; Zikoko on Nigerian WhatsApp habits.
- NDPA and platform liability: Mondaq/Afriwise on defamation and data privacy, Falana v. Meta; Techpoint Africa; Carter-Ruck guide; OAL on social media laws.
- Habbo: Vice and GDC session summaries on its peak audience, economy and decline.
- Nigerian game market notes: Games Industry Africa on Idansquest; Statista overview; Guardian Nigeria on a rewards game; TheCable on the OneChance board game.

**From my own design knowledge ([D]) and judgment ([J]).** Comparisons to The Sims, BitLife, Animal Crossing, Stardew, Avakin/IMVU, Roblox, FiveM, Persona, Crusader Kings, RimWorld, Dwarf Fortress, Fallen London, Papers Please, Reigns, Among Us and Wordle; retention and economy principles; all mechanics in Part F. I did not re-verify these live.

**What I could not do.** I could not play Lagos Life; I could not search TikTok, Reels, X or Nairaland comment threads at depth; I have no data on retention for any Nigerian title. Treat my statements about the Nigerian audience's *tastes* as hypotheses to test in the WhatsApp pilot.

**Not legal advice.** Statements about tenancy law, data protection, advertising rules and relationship-content constraints are orientation only. Get Nigerian counsel before launching anything that touches money, real agents or real property.
