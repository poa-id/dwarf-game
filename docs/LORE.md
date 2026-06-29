# The Hearth & The Deep — Lore & Voice

*Part of the design doc set — see ../DESIGN.md for the index.*

## 1. Core Pitch

**The Hearth & The Deep is a restoration game.** Not a colony sim, not a
survival sandbox, not a traditional idle game, not a roguelike, not a
management sim. A solitary dwarf wakes beside a dying Hearth in a dead
mountain. The Hearth is dying. The mountain is dead. The player's purpose
is to restore both — everything else (skills, materials, the Forge,
Insight) exists in support of that goal, not as an end in itself.

Influences: RuneScape (skill/XP grinding), idle/clicker games (Cookie
Clicker, Bitcoin Billionaire — engine-building, exponential curves),
base-building survival games (bare bones → discovery), Dwarf Fortress
(artisan dwarves, hand-placed world), Bastion (narrator voice). Tone:
bleak, mythic, quietly hopeful. Personal project first — "personality
over portfolio." Enjoyment and storytelling matter more than showcase
polish.

**This is explicitly NOT a colony sim.** One dwarf. No roster, no population
management, no job assignment UI. Other characters are rare events, not
controllable units.

### The Core Fantasy

The fantasy is explicitly **not** "become rich" and explicitly **not**
"build a production empire." Both are natural failure-modes for an
idle/economy game to drift toward, and both are wrong for this project.

The fantasy is: *"I found the last ember of a forgotten mountain kingdom
and refused to let it die."*

Every future feature should be evaluated against this distinction.
Numbers (yields, speed, efficiency) support the fantasy but are never
themselves the point — see "Progress Should Be Visible" below for what
the point actually is.

### The Three Protagonists

The existing World/Vessel/Narrator state split (§2 in MECHANICS.md) isn't
just an engineering convenience — it mirrors three actual protagonists,
and design should keep treating it that way:

- **The Dwarf** (Vessel) — temporary. Learns, works, dies, returns.
- **The Hearth** (World) — persistent. Grows stronger, returns color,
  returns memory, returns life.
- **The Mountain** (World) — persistent. Expands through revelation,
  reveals itself, remembers.

The Hearth and the Mountain are as important as the dwarf — arguably
more important, since they're what actually persists and accumulates
meaning across every rekindling. The dwarf is the player's hands; the
Hearth and Mountain are what the player is actually working to restore.

### Progress Should Be Visible

**The single most important design rule in this document.** A player
should be able to compare two screenshots — say, hour 1 and hour 50 — and
understand progress without reading a single number.

Good progression *looks like something*: a repaired forge, a restored
hall, lit torches, newly revealed rooms, recovered murals, a visible
inhabitant, an upgraded sprite, more color in the world. Weak progression
is invisible: +5% speed, +10 storage, +15% efficiency. Numbers support
progress — they tune pacing under the hood — but they are never a
substitute for something the player can actually *see* change. Any new
feature that only manifests as a bigger number, with no visible
counterpart, should be treated as incomplete.

### Resource Philosophy

Materials and depth should read as history, not as a power ladder.
Mechanically, ore/ingot/fuel categories and numeric tiers stay exactly as
implemented (see MECHANICS.md §5) — this is about *flavor and framing*,
not new fields or a rename of existing materials. The aspiration is that
future depth/area names lean toward "Fallen Workings," "Silent Delves,"
"King's Veins," "Ancestor Roads," "Forgotten Below" rather than a generic
Copper → Iron → Steel → Mithril ladder — each depth should feel like it's
revealing a chapter of the mountain's past, not just a bigger number tier.
Not yet applied to any shipped content; a principle to write new material/
area names against going forward, not a retroactive relabel.

### Never Deadlock the Engine

Added 2026-06-23, after the starter copper vein and wood node — both
finite by original design — exhausted in actual play and left no way
to ever obtain copper or wood again, for the rest of that save's
existence. No smelting, no tool-forging, no torch repair, ever again.
A genuine, permanent, unrecoverable dead end, found only by someone
actually playing the game to that point — exactly the kind of gap this
project's "catch architectural issues via real playtesting" workflow
exists to surface.

The principle going forward: **basic, foundational materials should be
infinite**, providing a slow, reliable "idle engine" — gather, craft,
repair, at a modest pace — that the player can always fall back on, no
matter how far they've drifted from optimal play or how long the
session. This is what makes the early game feel like an engine, not a
puzzle with a wrong-answer state. Better/rarer materials (iron, coal,
deepstone — currently all gated behind the not-yet-built real mine) are
allowed, and expected, to stay finite or otherwise gated — that
scarcity is what makes unlocking deeper content meaningful. The
distinction is "foundational, can't recover without it" vs. "better,
nice to have more of" — only the former needs to be unconditionally
renewable.

### Relics

Relics are planned to become major content in their own right — not
collectibles, not vendor trash, not another resource category. The bar
is that finding a relic should feel more exciting than finding ore.
Examples from design discussion: a Cracked Crown, Survey Maps, Ancestor
Journals, the Smith-King's Hammer, the Hearthkeeper's Bell. **Not yet
designed mechanically or implemented** — no `RelicId` or relic system
exists in code yet; tracked as a gap in OPEN_QUESTIONS.md.

---

## 3. Rekindling — The Sacrifice Mechanic

The current dwarf can choose to feed himself to the Hearth. His spirit
rekindles in a new vessel (dwarves share kinship, made of the same
original material, but are individual souls). This is the prestige/reset
mechanic, reframed as myth rather than "start over."

- **What resets:** skill levels/XP, inventory, position.
- **What persists:** literally everything on World — forge tier, mine
  depth, hearth state, lore, torches, vein depletion.
- **Insight** — the kinship currency. Earned from EVERY XP-granting
  action across every skill (a small fractional trickle, 5% of that
  action's XP — see `xpCurve.ts`'s `insightFromXp`) AND from rekindling
  itself (lump sum, scaled by the dwarf's total skill levels at time of
  death — `5 × total levels` currently, with a diminishing-returns
  penalty if rekindled too soon after the last one — see
  `rekindle.ts`'s `calculateRekindleInsight`). This corrects a real gap
  found in playtesting (2026-06-23): this passage always described
  Insight as earned "BOTH from Hearth-tending and from rekindling," but
  for a long stretch of the project's life, only the rekindling half
  was ever actually implemented — a player who hadn't rekindled
  recently had no way to earn Insight at all, which contradicted
  "Insight is a synonym for experience, used as a resource." The
  per-action trickle is now real, and deliberately broader than just
  Hearth-tending — every skill's actions contribute, not only
  Hearthkeeping's. Spent on Forge/Hearth/Smelter/Gemcutting upgrades
  (World-permanent).
- **First rekindling specifically** triggers the world's first color
  (Hearth colorStage 0→1). Later rekindlings do NOT grant color directly
  — color progress is purely a function of the Hearth's lifetime fuel,
  decoupled from the act of rekindling itself (rekindling crossing that
  threshold for the first time is a narrative coincidence/payoff, not a
  rule that "rekindling = color").
- New dwarf always wakes at `HEARTH_SPAWN_POSITION`, regardless of where
  the previous dwarf died.
- Re-grinding is meant to be **faster, not free** — gear/forge tier persist
  and reduce the grind, but skill levels genuinely reset and must be
  re-earned each cycle.

## 9. Narrator (Bastion-style)

Third-person, past-tense, mythic, weary prose. NOT dialogue — the world
narrating the player's actions back to them. This is the primary
"companionship" substitute for a lone-dwarf game with no party members.

- Triggers map to meaningful moments: waking (first-ever vs. rekindled),
  first/routine mine strikes, level-ups, color stage changes, torch
  repairs, first zone visits, stranger arrivals.
- **One-time triggers** (`wake_first_ever`, `mine_first_strike`,
  `color_stage_1`) fire exactly once ever, never replay even across many
  rekindlings.
- **Throttled triggers** (routine `mine_strike` at 15%, `area_revealed`
  at 60%) deliberately DON'T fire every time — "the narrator comments on
  the grind, he doesn't provide play-by-play of every swing." This was a
  direct fix after user feedback that early narration fired too often.
- Display: non-blocking toast, real queue (one visible at a time, ~4.2s
  + fade), never stacks, never pauses input.
- Anti-repeat: won't show the same line twice in a row within one
  trigger's pool (pools with only 1 line are exempt, by necessity).

## 9a. Permanent Residents — Stay Extremely Rare

The mountain remains lonely by design. Narag-Bund (§10a) already proves
the principle in code: he's the **one** deliberate exception, not the
start of a roster. Future permanent residents (design discussion has
floated "The Last Smith," "The Widow," possibly one or two others total)
should stay just as rare and just as narratively weighty. Concretely:
**never build a population system, a workforce/job-assignment mechanic,
or anything resembling a colony roster.** The loneliness is intentional
and is load-bearing for the whole pitch (§1) — diluting it with more than
a small handful of named residents, ever, would undercut the fantasy.

## 10. NPCs / Other Characters

**Decided model:** rare wandering strangers who can offer concrete base
improvements (trade, lore, etc.), then leave. NOT a roster, NOT a
managed population. Most "social" content is actually the Narrator
(see §9), not NPC dialogue — strangers are the rare exception to an
otherwise solitary game.

**CORRECTION:** an earlier draft of this doc said recurring named
companions were "considered and not chosen" - that's now superseded.
See §10a below: Narag-Bund is exactly that, a deliberate, considered
exception to the lone-dwarf premise, not a contradiction of it.

**STATUS: wandering strangers not yet designed mechanically or
implemented.** Only the narrator's `stranger_arrival` trigger exists as
a placeholder hook.

## 10a. Narag-Bund — the Companion

A coal-beetle hauling-beast, found and befriended in the dark of the
mountain - NOT built (he's not a construct/automaton), NOT player-named
(he has a fixed lore name the player discovers). "Narag-Bund" is plain
ASCII (not "Nar\u00e2g-Bund") deliberately - the special character risked
encoding issues across saves/fonts/systems.

This is a genuine, considered exception to the game's lone-dwarf
premise: the first and only thing in the world that chooses to stay.
Treated with narrative weight accordingly - `companion_befriended` is a
ONE-TIME narrator trigger (never replays, same category as
`wake_first_ever`), and the line is deliberately understated rather
than sentimental ("he doesn't tell it to leave," not "finally, he's not
alone") to stay consistent with the established weary/mythic voice.

**Mechanically**, befriending him is the effect of the Hearth's tier-1
upgrade, "Friend of Burden" (30 Insight) - NOT a separate creature-taming
mechanic. Once befriended:
- He hauls a FIXED AMOUNT (`HAUL_AMOUNT_PER_TRIP`, currently 1) of
  whichever fuel material (coal or wood) the player currently holds in
  greater quantity, every `HAUL_INTERVAL_MS` (currently 10s) of real
  time, from personal inventory into the Hearth's `fuelReserve`.
- He only ever hauls materials that already appear in the player's
  inventory - he shares the dwarf's discoveries, not an outsider's
  omniscience. If the player carries nothing haulable, time still
  advances (no backlog accumulates) but nothing is moved.
- Pacing uses the same offline-catch-up-safe pattern as `tickHearth` -
  `advanceCompanionHauling` computes elapsed whole intervals and
  applies them in one step, safe to call after a closed tab.
- **Deliberately abstracted, no visible sprite on the map** - a felt
  presence (fuel quietly arriving) rather than a seen one. This was a
  scope choice (no new art needed) that also fit the tone - something
  unseen attending to you in the dark.
