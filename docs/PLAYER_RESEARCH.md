# Player Research Record — Agent9ja
*Lightweight, dated, living. Created 2026-10-08. Updated when a decision needs
evidence or new feedback contradicts a standing hypothesis.*
*Rules: sources with links+dates; direct quotes marked QUOTE; never invent
comments/stats; press-mediated items flagged; hypotheses tracked at the bottom.*

## Method limits (read first)
- No direct X/TikTok scraping in this pass; social evidence is press-mediated
  (TechCabal player interviews are firsthand quotes via a reporter — best
  available, not the same as observing threads).
- Lagos Life is ~1 week old: retention claims are unknowable; churn signals
  are anecdotes, not rates.
- Fan/guide domains (lagoslife.net, playlagoslife.com) are SEO/promotional:
  usable for feature description, not for player-sentiment claims.

## R-001 — Access beats appetite (2026-10-08)
- Sources: Technext review 2026-10-05 (https://technext24.com/reviews/lagos-life-1-million-players-nigerian-games/);
  TechCabal 2026-10-08 (https://techcabal.com/2026/10/08/billionaires-online-broke-offline-nigerians-escape-reality-inside-viral-games/);
  BusinessTech 2026-10-06 (https://businesstech.ng/lagos-life/).
- Observed: 1M players in ~3–4 days for a free browser game, no install/APK;
  search breakout +5000%; players cite "opened in browser and played immediately".
- Interpretation: for Nigerian mobile players, distribution friction was the
  binding constraint, not lack of interest in life sims.
- Counterevidence: none found; novelty alone could explain the spike.
- Confidence: MEDIUM-HIGH for signup effect; LOW for retention effect.
- Implication: Agent9ja's 3D/mobile track must protect low-friction access
  (cheap-Android budgets already in architecture §13); never assume demand
  without measuring return visits.

## R-002 — Recognition is the hook; control is the retention talk (2026-10-08)
- Sources: TechCabal 2026-10-08 player interviews (Temitope, Esther, Ademola,
  Victoria Eke, Kheezran, Yemisi Elijah).
- Observed QUOTES: "break out of poverty… funny, high-stakes strategy game";
  "Other games feel disconnected… Lagos Life offers cultural context";
  "In the game I can hit restart. In real life, no reset button";
  landlords, black tax, NEPA, sapa, side hustles named as recognisable pressures.
- Interpretation: players value culturally specific pressure + agency over it
  (strategy, restart), not pressure alone.
- Counterevidence: same article — Ademola quit ("passing trend"), Temitope
  expects hype to fade; recognition did not retain them.
- Confidence: MEDIUM (6 interviewees, reporter-selected).
- Implication: SUPPORTS our consequence/memory thesis and soft-floor +
  played-days clock (no real-time punishment). Warns: recognition without
  evolving consequences churns.

## R-003 — Money fantasy AND money realism are both demanded (2026-10-08)
- Sources: Peller session via Naijapulse 2026-10-06
  (https://naijapulse.ng/peller-lagos-life-game-virtual-money/) — QUOTE
  "U fit withdraw the money?"; Trumpet 2026-10-07 Access Bank meme video
  (https://thetrumpet.ng/…9-8bn-in-game-balance); ThisDay 2026-10-07
  (https://thisday.com.ng/why-lagos-life-is-spiritual-man-shares-hilarious-experience-with-viral-game/ and
  ladies' "why are so many people having billions?" critique).
- Observed: billionaire screenshots/memes go viral; simultaneous complaints
  that easy billions feel unrealistic; one player suggested reflecting real
  struggles instead.
- Interpretation: virtual wealth is shareable status AND, for some, an
  economy-credibility problem. Both directions are real segments.
- Counterevidence: Isakaba reviewer (2026-10-08, https://www.isakaba.com/lagos-life-review/)
  "didn't have an issue with the bastard money… didn't take away from the experience".
- Confidence: MEDIUM (multiple independent viral artifacts, same week).
- Implication: SUPPORTS conserved economy + meaningful scarcity (doctrine §9);
  economy reset precedent (Technext: exploit→trillions→wipe+income tax) is a
  cautionary tale for our faucet/sink discipline. No cash-out mechanics, ever,
  without a separate product decision.

## R-004 — Social is a segment, not the product (2026-10-08)
- Sources: TechCabal 2026-10-08 (Ademola plays FOR interacting with Nigerians;
  Temitope plays solo at night, uninterested in social side); lagoslife.net
  comparison (authoring vs inhabiting).
- Interpretation: multiplayer is a retention driver for some, irrelevant to
  others. Solo-with-consequences retains independently.
- Confidence: MEDIUM-LOW (few voices, but the split is theoretically expected).
- Implication: SUPPORTS private-world + async design (never gate fun on
  concurrent strangers). Do not chase plaza features to satisfy one segment.

## R-005 — Stranger chat is the known industry hazard (2026-10-08)
- Sources: Isakaba review 2026-10-08 (Roblox precedent: age checks, filters,
  lawsuits, country bans); Lagos Life is 18+ with open chat.
- Interpretation: open stranger chat scales moderation cost faster than value.
- Confidence: HIGH (industry history, not just opinion).
- Implication: SUPPORTS our no-stranger-DMs / friends-first / 18+ posture.
  Revisit only with a dedicated safety design, never as a side effect.

## R-006 — Genre boredom comes from consequence-free breadth (2026-10-08)
- Sources: PC Gamer 2026-01-08 (Lauren Morton;
  https://www.pcgamer.com/games/life-sim/life-sims-are-in-a-slump-and-the-only-way-out-is-becoming-strategy-games-again/) —
  Sims players "begging for things to do", InZoi "empty… no challenges and
  consequences"; Isakaba: Lagos Life "a collection of systems waiting to grow".
- Interpretation: life-sim churn driver is breadth without stakes, not lack
  of content. Depth + consequences retain; DLC breadth does not.
- Counterevidence/limits: Western Sims audience; transferability to Nigerian
  mobile players is INFERRED, not shown.
- Confidence: MEDIUM for genre principle; LOW for direct transfer.
- Implication: SUPPORTS milestone order (consequence engine before content
  breadth) and the M010 proof gate. Do not answer boredom with map/features.

## R-007 — Lagos Life messaging: observed design (2026-10-09)
- Sources (fetched live 2026-10-09): official support
  (https://lagoslife.com.ng/support); privacy policy, last updated 5 Oct 2026
  (https://lagoslife.com.ng/privacy); delete-account page
  (https://lagoslife.com.ng/delete-account); official people guide
  (https://lagoslife.com.ng/guide/people/); fan wiki verified in-game
  2026-10-06 (https://lagoslifestyle.wiki/guides/lagos-life-friends-and-messages).
- Observed: rooms readable by any signed-in player; DMs readable only by two
  members; read receipts collected (no UI detail published); NO contact or
  conversation acceptance gate documented — anyone can start a chat, and
  blocking is the post-hoc control ("stops them starting a chat with you",
  immediate, reversible); reporting via long-press, private, acted on
  "usually within a day"; push notifications are rent/meter nudges ONLY
  ("Nothing else is ever pushed", switchable off); Messages app has an
  in-app new-message toggle (wiki); friendship levels Stranger /
  Acquaintance / Padi (30+) / Paddy Mi (60+), @username lookup, group chats
  (wiki); account deletion removes room messages + both sides of DMs that
  phone knew; guest/offline play has NO chat at all.
- NOT observed anywhere: voice notes (any rules), per-message deletion,
  editing/retraction, typing indicators, acceptance gates. Founder
  recollection of restricted voice notes is UNVERIFIED — treat as rumour.
- Conflict noted, unresolved: player-to-player naira transfers — Isakaba
  review says yes; wiki says no (partners only); one SEO guide describes a
  gift button. Official docs do not resolve it. Low-trust sources differ.
- Confidence: HIGH for official-doc items; MEDIUM for wiki (single verifier);
  LOW for transfer details.
- Implication: even the reference game ships stranger-initiated DMs with
  after-the-fact block/report, restrained push, and solo-without-chat as a
  first-class mode. SUPPORTS our M008 posture (no acceptance gate, capped
  derived notifications, no chat push, optional/async). Consent-gate DMs are
  NOT observed industry-standard here.

## R-008 — Chat quality cuts both ways (2026-10-09)
- Sources: Techblit 2026-10-04 (press-mediated X/Reddit posts — not observed
  threads); TechCabal 2026-10-08 interviews; Isakaba review 2026-10-08;
  lagoslifeapp.com (SEO/promotional — weak, flagged).
- Observed: in-game chat used for begging ("asking strangers for virtual
  money"), relationship-seeking, wealth comparison, jokes, and help requests
  — press-mediated QUOTE "I no sabi play this game… Make person teach me
  abeg"; Eke built "steady connections", exchanged Instagram handles,
  continued outside the platform (press-mediated QUOTE); Ademola played ~4h/day
  FOR social interaction, then quit as novelty faded; "I got bored quickly"
  anecdote (weak source); Isakaba: stranger unpredictability is "some of the
  game's funniest moments" AND the top risk section (Roblox precedent).
- Counterevidence: begging/spam dynamics, churn-after-social, solo players
  (Temitope), boredom — channel availability did not itself retain.
- Confidence: MEDIUM-LOW (press-mediated, anecdotes, no rates).
- Implication: communication CAN retain a segment but does not retain by
  itself; the content of contact matters more than the channel. SUPPORTS
  consequence-linked, optional, async design; warns against reading chat
  volume as engagement. Off-platform bridging (IG handles) reinforces H5.

## Hypothesis tracker
| ID | Hypothesis | Status | Evidence |
|----|-----------|--------|----------|
| H1 | Cultural specificity drives trial | SUPPORTED | R-001, R-002 |
| H2 | Consequences + restart-ability drive retention | OPEN | R-002 (mixed), R-006 (genre only) — needs M010 playtests |
| H3 | Conserved scarcity beats easy billions | OPEN | R-003 (split audience) — needs playtest A/B |
| H4 | Solo-with-consequences retains without strangers | OPEN | R-004 — needs prototype with/without social |
| H5 | Open stranger chat costs more than it earns | ACCEPTED (constraint) | R-005 — design rule until safety design exists |
| H6 | Breadth-without-stakes churns | SUPPORTED (genre) | R-006 — scope discipline, not yet player-observed locally |
| H7 | Consequence-linked communication drives return visits | OPEN | R-007 (design patterns only), R-008 (mixed) — needs M010 playtests; M008 is the minimal probe |
