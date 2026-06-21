# The Hearth & The Deep — Mechanics & Systems

*Part of the design doc set — see ../DESIGN.md for the index.*

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

## 4. Skills

Four skills currently defined: **Mining**, **Smithing**, **Hearthkeeping**,
**Woodcraft**.

- Mining, Smithing, and Woodcraft are **active** (player-initiated strikes).
- Hearthkeeping is **idle** (ticks via real elapsed time, including while
  the tab is closed, capped at 24h offline catch-up).
- XP curve is polynomial (`BASE_XP × level^EXPONENT`), not RuneScape's
  exact table — tuned to be ~400x harder at level 99 vs level 1, gentler
  than pure exponential. Dwarves are persistent, not naturally gifted;
  the curve should reward steady play over binge bursts (still tunable).
- **Interaction feel philosophy:** early gathering actions are
  deliberately simple - a key press, a random roll, a hit-or-miss
  strike. Better tools, refining stations, or gathering nodes are meant
  to eventually unlock RHYTHM/TIMING minigames rather than just better
  numbers - upgrades change how an action *feels*, not only its odds.
  Not yet built; noted as a real future direction.

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

**Implementation note:** Mining is now a thin specialization of a
generic `gathering.ts` module (`GatherableNode`, `attemptGatherStrike`,
etc) - extracted once Woodcraft needed the identical mechanic, rather
than duplicating it. `mining.ts` re-exports everything under its
original names (`RockNode`, `attemptMineStrike`, etc) so nothing calling
it needed to change.

### Woodcraft
Cuts wood from cave-root tangles and underground wood formations (there
is no surface - the mountain is the whole world). Covers BOTH raw
cutting AND processing into planks/lumber within this one skill, the
same way Mining alone covers all ore types - no separate "refining"
skill for wood specifically.

Mechanically identical to Mining (same generic `gathering.ts` strike
mechanic, axes instead of pickaxes as the tool tier). The starter
`root_tangle` node (30 total yield, finite) sits near spawn alongside
the copper vein - both gatherable from the very start, since the first
Forge repair needs wood AND ore together.

**Explicitly deferred:** tree/mushroom-stalk GROWING (planting,
waiting, harvesting) is a planned future expansion, not built now -
today's nodes are all pre-existing formations to cut, nothing is
planted yet.

**Future skill on the horizon (not started):** a **Building** skill,
consuming outputs from multiple gathering skills at once (timber,
metal, stone, gems) to construct decor/furniture/structures. Distinct
from Woodcraft, which stops at raw wood + planks.

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

**The Hearth starts as a bare flickering ember** - not fully dark/inert
(narratively/visually), even though mechanically `ColorStage` is still 0
(no world color yet) until the first rekindling. This ember-state is
personality/mood, distinct from the mechanical color-stage truth.

**Multi-fuel:** the Hearth can burn both coal AND wood (see §5,
`totalHearthFuelValue` in hearth.ts), weighted by each material's
`heatValue` - "the hearth can be powered by other means," unlike the
Forge, which has hard per-recipe heat minimums it won't compromise on.

## 5. Materials & Economy

Flexible `MaterialId`-keyed inventory (`Partial<Record<MaterialId,
number>>`), NOT fixed fields — supports adding new ore/fuel tiers as pure
content. Every material has a `MaterialDefinition`: category (ore/ingot/
fuel/wood/currency), tier, and (for fuel and wood) `heatValue`.

Currently defined: `copper_ore`, `iron_ore`, `coal` (heatValue 10),
`wood` (heatValue 4 - weaker than coal, real fuel not just a
construction material), `copper_ingot`, `iron_ingot`, `insight`.

**Fuel philosophy:** coal is mined directly (not a smithing byproduct,
which was the old design — explicitly removed). Purer, rarer fuels are
planned for later, with higher `heatValue`, unlocking recipes a weak fire
can't touch ("super-heat metals and gems").

**Coal/wood allocation (Smithing vs. Hearthkeeping) — RESOLVED AND
BUILT:** the Hearth has its OWN fuel stockpile, `WorldState.fuelReserve`
- a separate `ResourceBag`, distinct from the dwarf's personal
inventory (which Smithing draws from directly). The player has two
ways to feed the Hearth, both always available regardless of upgrades:
- **Stoke the fire directly** (`stokeFireDirectly`) - burns material
  from personal inventory immediately, instant lifetimeFuel/colorStage
  progress.
- **Bank in the reserve** (`stokeReserve`) - moves material from
  personal inventory into `fuelReserve`, saved for later (either for
  the player to draw on by choice, or for Narag-Bund to find waiting).

`tickHearth`'s passive continuous draw (only active once
`isAutoTendingUnlocked`, hearthTier >= 1) consumes ONLY from
`fuelReserve`, never personal inventory directly -
`deductFuelValueFromReserve` converts an absorbed fuel-VALUE back into
actual material deductions, burning the highest-heat fuel (coal) first,
falling back to wood once coal runs out.

This means Smithing and Hearthkeeping never actually compete for the
same held materials in real time - Smithing always has full access to
whatever's in personal inventory; the Hearth only ever touches what's
been deliberately set aside for it. See §10a for Narag-Bund, who
automates the "setting aside" step once befriended.

**Forge repair vs. Forge upgrades - a real split, not just naming:**
- **Tier 0→1 is a REPAIR**, not an upgrade - the forge starts broken
  (rubble), and the player invests raw materials (wood + copper ore,
  `FORGE_REPAIR_COST`) to fix it. No Insight involved. This sidesteps
  the chicken-and-egg problem of gating forge access behind a currency
  the player has no early way to earn.
- **Tiers 1→2, 2→3+ are INSIGHT-funded upgrades** (`FORGE_UPGRADES`) to
  an already-working forge - this is where the practical/active
  "better tools, materials, yields, speed" upgrade tree lives (see §6
  below for how this differs philosophically from Hearth upgrades).
- The **Forge Room itself is always reachable** (not zone-gated) - only
  the forge OBJECT inside it starts broken. This matches the rubble
  philosophy in §6: walk in, see what's broken, gather materials, fix it.

**Hearth upgrades (`HEARTH_UPGRADES` in hearth.ts) - built, real
content now, not just placeholder tiers:**
- **Tier 1, "Friend of Burden" (30 Insight):** befriends Narag-Bund
  (§10a) AND unlocks `tickHearth`'s passive continuous draw. Before
  this tier, the Hearth does NOTHING passively - manual stoking is the
  entire mechanic, by deliberate design choice.
- **Tier 2, "Deepened Hearth" (150 Insight):** the hearth burns fuel
  more efficiently (described in content, not yet mechanically wired
  to an actual efficiency multiplier - flagged in §11).

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

## 12. Persistence

Save/load via `localStorage`, JSON-serialized `GameState` (deliberately
plain-data: no functions, Map, or Set anywhere in the state tree, so
this stays simple). Saves after every render-triggering action — render()
itself calls persist() as a guaranteed side effect, rather than scattering
save calls across every individual action site.

`saveVersion` exists for forward migration (`CURRENT_SAVE_VERSION`,
currently 1) — a ladder-style migration function exists as a documented
no-op scaffold, ready for the first real schema change. Corrupted or
unrecognized saves are discarded in favor of a fresh state rather than
risking a crash or silently-wrong partial load; the player sees a small
notice when this happens.

A manual "reset save" button exists (with a confirm step) for
testing/starting over - this is a meta/debug action, explicitly NOT the
same thing as in-game rekindling.

**Deliberate non-trigger:** reloading the page does NOT fire
`wake_rekindled` — that narrator trigger is reserved for the actual
in-game rekindle() action (which doesn't have a player-facing trigger
yet either). A page refresh is treated as "the player came back," not
"a new dwarf began."

