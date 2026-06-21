# The Hearth & The Deep — Lore & Voice

*Part of the design doc set — see ../DESIGN.md for the index.*

## 1. Core Pitch

A solitary dwarf, alone in a dead mountain, grinding skills to rebuild a
hearth and, eventually, his own world's color. Influences: RuneScape (skill/
XP grinding), idle/clicker games (Cookie Clicker, Bitcoin Billionaire —
engine-building, exponential curves), base-building survival games (bare
bones → discovery), Dwarf Fortress (artisan dwarves, hand-placed world),
Bastion (narrator voice). Tone: bleak, mythic, quietly hopeful. Personal
project first — "personality over portfolio." Enjoyment and storytelling
matter more than showcase polish.

**This is explicitly NOT a colony sim.** One dwarf. No roster, no population
management, no job assignment UI. Other characters are rare events, not
controllable units.

---

## 3. Rekindling — The Sacrifice Mechanic

The current dwarf can choose to feed himself to the Hearth. His spirit
rekindles in a new vessel (dwarves share kinship, made of the same
original material, but are individual souls). This is the prestige/reset
mechanic, reframed as myth rather than "start over."

- **What resets:** skill levels/XP, inventory, position.
- **What persists:** literally everything on World — forge tier, mine
  depth, hearth state, lore, torches, vein depletion.
- **Insight** — the kinship currency. Earned BOTH from Hearth-tending
  (slow trickle over time) and from rekindling itself (lump sum, scaled
  by the dwarf's total skill levels at time of death — `5 × total levels`
  currently). Spent on Forge upgrades (World-permanent).
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
