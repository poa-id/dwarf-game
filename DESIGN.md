# The Hearth & The Deep — Design Document

*Living document. Update this as decisions are made or revised — this should
always reflect the current truth of the game, not a frozen plan. If chat and
this doc ever disagree, this doc wins; update it the moment something changes.*

---

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

## 2. The Three-Tier State Model

This is the foundational architecture decision everything else hangs off.

- **World** — persists forever, across every rekindling. The mountain
  remembers. Forge tier, hearth/color stage, explored map, lit torches,
  vein depletion, lore flags, banked Insight.
- **Vessel** — the current dwarf's body. Resets on rekindling: skill
  levels, XP, held inventory, current position (resets to hearth spawn).
  "The next dwarf has not swung this pickaxe, even if the pickaxe is fine."
- **Narrator** — what THIS PLAYER has heard, independent of dwarf or world.
  Survives rekindling untouched (one-time lines like the first-ever wake
  line must never replay). Neither World nor Vessel — its own category.

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

## 4. Skills

Three skills currently defined: **Mining**, **Smithing**, **Hearthkeeping**.

- Mining and Smithing are **active** (player-initiated strikes).
- Hearthkeeping is **idle** (ticks via real elapsed time, including while
  the tab is closed, capped at 24h offline catch-up).
- XP curve is polynomial (`BASE_XP × level^EXPONENT`), not RuneScape's
  exact table — tuned to be ~400x harder at level 99 vs level 1, gentler
  than pure exponential. Dwarves are persistent, not naturally gifted;
  the curve should reward steady play over binge bursts (still tunable).

### Mining
Strike a `RockNode` (deterministic via injected `roll`, for testability).
Tool tier (from Forge tier, a World value) boosts success chance and
yield — this is how "regrind but faster" is mechanically expressed: a new
dwarf at Mining level 1 can still swing a Steel Pick if the World's forge
is already tier 3.

**Depletion:** nodes can have a `totalYieldCapacity` (finite) or `null`
(never depletes). The starter copper vein is intentionally finite (40
total yield) — a tutorial prop, not the long-term loop. Depletion state
is per-placed-instance (`NodeDepletionState`), stored on World
(`veinDepletion`), persists across rekindling — a vein worked thin stays
thin for the next dwarf.

### Smithing
Consumes ore + fuel to produce ingots. Recipes specify `minHeatRequired`
— a fuel's `heatValue` must meet or exceed this, so weak fuels can't
smith demanding recipes regardless of quantity held. Ore AND fuel are
both consumed even on a failed attempt (real risk, not just a yield
penalty).

### Hearthkeeping / The Hearth
Idle. Absorbs fuel from `bankedFuelAvailable` at a constant rate
(`FUEL_ABSORPTION_RATE_PER_SEC`), capped by what's actually available —
**the Hearth cannot tend itself out of nothing**, it requires the player
to have fed it via mining/smithing activity. `lifetimeFuel` (monotonic,
never decreases) drives `ColorStage` thresholds.

## 5. Materials & Economy

Flexible `MaterialId`-keyed inventory (`Partial<Record<MaterialId,
number>>`), NOT fixed fields — supports adding new ore/fuel tiers as pure
content. Every material has a `MaterialDefinition`: category (ore/ingot/
fuel/currency), tier, and (for fuel) `heatValue`.

Currently defined: `copper_ore`, `iron_ore`, `coal` (heatValue 10),
`copper_ingot`, `iron_ingot`, `insight`.

**Fuel philosophy:** coal is mined directly (not a smithing byproduct,
which was the old design — explicitly removed). Purer, rarer fuels are
planned for later, with higher `heatValue`, unlocking recipes a weak fire
can't touch ("super-heat metals and gems").

**OPEN QUESTION (unresolved):** coal is wanted by both Smithing (as forge
fuel) and Hearthkeeping (as hearth fuel) — they currently compete for the
same pool with no resolved allocation logic or UI. Needs a decision.

## 6. The Hub Map

One **fixed, hand-placed** map (not procedurally generated) — 80×50
currently. The Hearth sits at the spawn/center. Named zones
(`hearth_hall`, `forge_room`, `tunnel_entrance`) are rectangular bounds
gated by `UnlockCondition`s (forge tier, hearth color stage, lore flags).
Cells outside any named zone are open connective hallway, always
passable — only specific rooms gate behind progress, to avoid an
early-game maze of invisible walls.

**Reference art direction (from user-provided mockups, Dwarf Fortress-
style colony-sim screenshots):** the AGREED takeaways were the organic,
irregular, radial-from-hearth cave shape and the "rubble until built"
visual treatment for locked zones. The REJECTED takeaways were the
isometric rendering style (too large a scope change, would require
redoing the renderer) and the colony-roster UI (wrong genre — this is a
lone dwarf, not a managed population).

**STATUS: not yet implemented in code.** Current zones are still
rectangular bounds; rubble-vs-built rendering doesn't exist yet. This was
explored as ASCII-art mockups during design discussion, agreed upon in
principle, then explicitly deferred — mockups discarded, not preserved as
dead code. Real follow-up work.

### Fixed content currently placed on the Hub
- 1 ore vein (`hearth_hall_copper`, copper, depletes) near spawn.
- 3 torches (`torch_corridor_forge`, `torch_corridor_tunnel`,
  `torch_tunnel_mouth`) along corridors — repaired via walking adjacent +
  pressing E, cost in copper_ingot, permanently lit once repaired.

## 7. Visibility & Movement

Real grid movement (WASD/arrows), with collision against solid terrain
(`SOLID_CELL_KINDS`: walls, hearth, forge, ore veins, tunnel_edge —
deliberately excludes torches and the dwarf himself).

**Fog of war, three states per cell:**
- `hidden` — never seen, not currently lit, OR in a locked zone. True
  void, undrawn.
- `remembered` — previously explored, not currently lit. Drawn dim (35%
  opacity).
- `lit` — within light radius right now. Full brightness.

**Light sources compose:** the dwarf's own radius (mobile, larger,
default 4) OR any currently-lit torch's radius (fixed, smaller, default
2) — a cell is lit if EITHER reaches it. Exploration is **permanent**
once a cell is lit (classic roguelike memory) — never re-darkens.
Repairing a torch immediately reveals its surrounding radius rather than
waiting for the player to walk past it again.

## 8. Visual Identity — 2-bit to Color

Stage 0 ("The Dark") is a genuine 2-color constraint: true black
background, ONE uniform foreground gray for literally everything —
walls, floor, ore, the dwarf, the unlit hearth. Only shape (glyph)
carries meaning. This is deliberate impoverishment, not "haven't added
color yet."

Stage progression (`ColorStage`, driven by Hearth `lifetimeFuel`):
0 (Dark) → 1 (First Ember — hearth/forge alone gain warm color, first
rekindling) → 2 (Hearthlight — materials differentiate, embery muted
palette) → 3 (True Color — full natural palette, a different *kind* of
light than stage 2, not just more saturated).

Lit torches glow warm at EVERY stage including Stage 0 — earned light is
meant to read independent of overall world progress.

Two renderer implementations exist with the same interface:
**ASCII/glyph mode** (`GridRenderer`, monospace characters + CSS-like
color) and **tileset mode** (`TilesetRenderer`, real sprite art from the
Vettlingr 32×32 Dwarf Fortress tileset, used with explicit artist
permission for this non-commercial project — see `ATTRIBUTION.md`).
Material-type variants (copper/iron ore) reuse one base texture with
canvas multiply-tinting rather than unique art per mineral, mirroring how
DF itself recolors generic stone. **Isometric rendering was considered
and explicitly rejected** — too large a scope change for the visual gain.

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
improvements (trade, lore, etc.), then leave. NOT a roster, NOT
recurring named companions (that was considered and not chosen). Most
"social" content is actually the Narrator (see §9), not NPC dialogue —
NPCs are the rare exception to an otherwise solitary game.

**STATUS: not yet designed mechanically or implemented.** Only the
narrator's `stranger_arrival` trigger exists as a placeholder hook.

## 11. Open Questions / Explicit Gaps

Tracked here so they don't get silently forgotten. Remove from this list
once resolved (and reflect the resolution in the relevant section above).

- **Coal contention** (§5): Smithing and Hearthkeeping both want coal,
  no resolved split logic.
- **No forge interaction in `main.ts` yet**: Smithing engine logic is
  tested but has zero UI wiring — can't actually smith through play.
- **Mine Entrance has no placed nodes**: `iron_vein`/`coal_seam` exist as
  `RockNode` content but aren't placed anywhere on the actual map.
- **Organic cave shape / rubble rendering** (§6): agreed direction, not
  implemented.
- **NPC/stranger mechanics** (§10): model agreed, nothing built.
- **Save/load**: does not exist yet. Refreshing the page restarts fresh
  every time.
- **Torch repair cost balance**: current costs (3-5 copper_ingot) are
  placeholder guesses, unplaytested against real ingot production rate.
