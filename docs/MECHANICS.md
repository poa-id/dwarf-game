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
Forged tool tier (`WorldState.toolsForged`, see Smithing's Tools
subsection below) boosts success chance and yield — this is how
"regrind but faster" is mechanically expressed: a new dwarf at Mining
level 1 can still swing whatever pickaxe was already forged, since
forged tools are World-persistent and survive rekindling.

**Depletion:** nodes can have a `totalYieldCapacity` (finite) or `null`
(never depletes). **Every currently-placed node is infinite as of
2026-06-23** (changed from an earlier design where the starter copper
vein and wood node were deliberately finite "tutorial props"):
exhausting them turned out to be a genuine, permanent, unrecoverable
deadlock, since they were the ONLY source of copper/wood anywhere in
the game (the real mine isn't built yet - see §6's Tunnel Entrance
zone). Per explicit project direction, basic starter materials are now
infinite by design, functioning as a slow, reliable "idle engine" the
player can always fall back on - mine/gather, craft, repair, forever,
even before the real mine is reachable. The finite-node MECHANISM
itself (`totalYieldCapacity`/`NodeDepletionState`/`isExhausted`) is
unchanged and still real - it's just that no game content currently
uses it. It's expected to matter again once the real mine introduces
nodes that SHOULD deplete (to make exploring further into the mine
meaningful), at which point depletion stops being theoretical. Depletion
state is per-placed-instance (`NodeDepletionState`), stored on World
(`veinDepletion`), persists across rekindling — a vein worked thin (on
a future finite node) stays thin for the next dwarf.

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
`root_tangle` node is now infinite (`totalYieldCapacity: null`, changed
2026-06-23 - see the Depletion note above; it went through two earlier
finite values, 30 then 50, before this) and sits near spawn
alongside the copper vein - both gatherable from the very start, since
the first Forge repair needs wood AND ore together.

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

**Tools - "metal + wood = tool" (added 2026-06-23), smithed at the
Forge, World-persistent like the Forge itself:**

Replaces an earlier, simpler design where pickaxe/axe quality was a
free, automatic side-effect of Forge UPGRADE tier (`world.forgeTier`)
with no crafting step at all. Per explicit project direction, tools are
now real things the player forges: a `ToolRecipe` (`smithing.ts`'s
`TOOL_RECIPES`) consumes an ingot + wood + fuel, same risk/fuel-heat
rules as an ingot recipe, but produces a tool-tier bump instead of a
stackable material.

- **`ToolSlot`** (`types.ts`): currently `"pickaxe" | "axe"`. Each slot
  holds exactly one active tier at a time - forging a better tier
  automatically supersedes the old one, no separate equip step (an
  explicit design call: tiers are strictly sequential, there's nothing
  to choose between).
- **`WorldState.toolsForged: Record<ToolSlot, number>`** - the highest
  tier ever forged per slot, 0 = bare hands. Lives in `WorldState`, NOT
  `VesselState` - a forged tool is a real, physical object the mountain
  keeps; it survives rekindling, and the next dwarf picks it right back
  up. This was a deliberate decision distinguishing tools from
  everything else a dwarf personally carries (inventory, skills), which
  IS lost on rekindle.
- **Recipes are ingot-based, not raw-ore** ("you smelt first, then
  shape") - `copper_pickaxe`/`copper_axe` need `copper_ingot` + wood;
  `iron_pickaxe`/`iron_axe` need `iron_ingot` + wood. Tiers must be
  forged in order (`attemptForgeTool` throws if you try to skip tier 1
  and go straight to tier 2, or re-forge a tier you already hold).
- **The actual mechanical bonus** (`successChanceBonus`/
  `yieldMultiplier`) still lives in `gathering.ts`'s `ToolTier`/
  `bestAvailableTool` - unchanged in SHAPE, just re-keyed: `ToolTier.tier`
  (was `requiredForgeTier`) now matches against `toolsForged[slot]`
  rather than `world.forgeTier`. `attemptMineStrike`/`attemptWoodGather`
  now take the forged tier for their slot directly, not `forgeTier`.
- **Steel Pickaxe/Axe (tier 3) deliberately not built yet** - no
  `steel_ingot` MaterialDefinition exists anywhere in the game (the old
  free-tier system had a "Steel Pick" entry, but never had real ore/
  smithing content behind it either). See OPEN_QUESTIONS.md.
- **Displayed in the sidebar's new "tools" stats-section**
  (`render.ts`'s `updateStatsPanel`), showing the currently-equipped
  name for both slots via `bestAvailablePickaxe`/`bestAvailableAxe` -
  unlike Narag-Bund, there's no discovery-gating here; knowing
  bare-handed mining exists isn't a spoiler worth hiding.

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
`charcoal` (heatValue 7), `wood` (heatValue 4 - weaker than coal, real
fuel not just a construction material), `copper_ingot`, `iron_ingot`,
`insight`.

**Fuel philosophy:** coal is mined directly (not a smithing byproduct,
which was the old design — explicitly removed). Purer, rarer fuels are
planned for later, with higher `heatValue`, unlocking recipes a weak fire
can't touch ("super-heat metals and gems").

**The Charcoal Kiln — built, fixes a real progression dead end (added
2026-06-22):** `coal_seam` is defined in mining.ts but has no placement
on the Hub map — there is currently no way to obtain real coal at all.
Without a fuel substitute, `copper_ingot` (and therefore torch repair,
which costs `copper_ingot`) was completely unreachable — a genuine
vertical-slice blocker, not a balance nitpick. The Charcoal Kiln is a
fixed structure in the Hearth Hall (`KILN_POSITION` in hubMap.ts,
contextual panel triggered by proximity exactly like the Forge/Hearth —
see §6a) that converts wood into charcoal (`kiln.ts`, governed by
Hearthkeeping — its first XP source anywhere in the game). Charcoal's
heatValue (7) clears `copper_ingot`'s `minHeatRequired` (5) but
deliberately NOT `iron_ingot`'s (10) — charcoal bootstraps copper-tier
smithing only; iron still requires real coal once `coal_seam` gets an
actual map placement. `SmithRecipe.fuelMaterialId` (singular) was
changed to `SmithRecipe.acceptedFuels` (a list) to support this — see
`chooseFuelForRecipe` in smithing.ts, which prefers coal over charcoal
whenever both are held. The kiln itself has no broken/repaired state
(unlike the Forge) — it's simply usable from the start, same
accessibility tier as the starter copper vein and wood node.

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

**The burn gauge — real, persisted feedback, added after playtesting
found stoking had none (2026-06-22):** the Hearth panel shows a live
"Burning (auto)" bar once auto-tending is unlocked, reading
`reserveBurnSecondsRemaining()` - actual seconds the banked
`fuelReserve` can sustain `tickHearth`'s passive draw at
`FUEL_ABSORPTION_RATE_PER_SEC` (0.5/sec), draining in real time as the
reserve is actually consumed. This is NOT cosmetic - it's the same
value the engine itself uses, just exposed. Direct "feed the fire"
stokes (which bypass the reserve and burn instantly) instead get a
separate, genuinely cosmetic CSS flash, since that path has no ongoing
state to show a gauge for. Deliberately does NOT show `lifetimeFuel` or
distance-to-the-next-color-stage anywhere - see the rekindle-gating
principle below for why that specific number stays hidden.

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
- **Tier 1, "Friend of Burden" (250 Insight, raised from 30 — see
  below):** befriends Narag-Bund (§10a) AND unlocks `tickHearth`'s
  passive continuous draw. Before this tier, the Hearth does NOTHING
  passively - manual stoking is the entire mechanic, by deliberate
  design choice.
- **Tier 2, "Deepened Hearth" (400 Insight, raised from 150):** the
  hearth burns fuel more efficiently (described in content, not yet
  mechanically wired to an actual efficiency multiplier - flagged in
  §11). Raised so it stays above its own tier-1 prerequisite's cost.

**Discovery gating - the upgrade row doesn't exist below its own
cost, not just disabled (added 2026-06-22, after playtesting):**
`Friend of Burden`'s description names Narag-Bund and his nature
outright. Rendering it as a grayed-out-but-visible row (the original
implementation) spoiled him before the player could plausibly have
met him - a real violation of UI-as-progression (§15). The row now
renders nothing at all - no header, no row, no hint - until
`insightBanked` actually reaches the cost; reaching it IS the discovery
moment. This is also why the cost itself needed raising from 30 to 250:
Insight only comes from rekindling (`calculateRekindleInsight`, 5 per
total skill level), so the old 30 cost was reachable after almost no
play at all - far too cheap a gate for something meant to be rare and
major, and not even a meaningful threshold for discovery-gating
purposes.

**Rekindling has a UI affordance now, and it must stay silent
beforehand (added 2026-06-22):** the "Rekindle" option appears in the
Hearth panel once `hearth.lifetimeFuel` crosses
`COLOR_STAGES[1].fuelThreshold` (500) - deliberately the SAME threshold
that triggers the world's first color, not a separate number. Per
project owner's explicit direction, this must give no warning
beforehand anywhere in the UI - no counter, no narrator foreshadowing.
The option simply exists, or doesn't, the next time the panel renders.
Confirmed via `window.confirm()` (mirrors the existing reset-save
pattern) since the action is permanent. See hearthPanel.ts's
`performRekindle`/`REKINDLE_FUEL_THRESHOLD`, and §13/§14's "knowledge
itself becomes progression" framing - this is that principle applied
to the single most important action in the game.

## 6. The Hub Map

**The camera decision (confirmed, not new — but now explicit):** no
scrolling world, no infinite map, no procedural overworld, no
camera-follow system. The viewport stays fixed; the dwarf moves, the
camera doesn't. This keeps the Hearth psychologically central — the
player should always feel connected to home. The game is not a journey
away from the mountain; it's a journey deeper into it. This is already
how the renderer works today (fixed viewport, no camera code exists) —
recorded here as a deliberate constraint, not an accidental omission.

**One mountain, not multiple maps/biomes/regions.** The mountain grows
through *revelation* — uncovering hidden halls, collapsed chambers,
forgotten roads, sealed vaults, deep delves within the one existing hand-
placed map — not through generating new chunks or new locations. The map
feels larger because the player's perception of it grows (see "Perception
Is Progression" below), not because the world itself expands outward.

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
- 1 ore vein (`hearth_hall_copper`, copper, **infinite** — see the
  Depletion note above) embedded against the Hearth Hall's left wall.
- 1 wood node (`hearth_hall_roots`, **infinite**, same reasoning)
  embedded against the Hearth Hall's right wall, directly adjacent to
  the Charcoal Kiln.
- 1 Charcoal Kiln (`KILN_POSITION`) — see Materials & Economy's Tools/
  Charcoal Kiln subsection above; always usable, no broken/repaired
  state.
- 3 torches (`torch_corridor_forge`, `torch_corridor_tunnel`,
  `torch_tunnel_mouth`) along corridors — repaired via walking adjacent +
  pressing E, cost in copper_ingot, permanently lit once repaired.

### Hub vs. Systems

The Hub is physical; the deep systems are interfaces. This is already
the existing interaction pattern (walk to Forge, press E, open Smithing
Panel) — recorded explicitly so future systems keep following it rather
than drifting toward a global menu: walk to Mine Entrance → press E →
open Mining Panel; walk to Archive → press E → open Archive Panel. The
player must always physically reach a place first; the activity itself
can then scale arbitrarily through that place's panel/interface. Never
skip the physical-reach step for a new system, no matter how deep its
interface gets.

### Travel Philosophy

Walking is valuable early (it's how the mountain remains a *place*, not
a menu) and becomes tedious later as the map's revealed area grows. The
intended solution is restoring infrastructure — mine carts, lifts,
elevators, pulley systems, rail networks — which reduce friction while
preserving physical presence. **Never replace movement with a global
travel menu** ("teleport to Forge" dropdown, fast-travel list, etc.) —
the fix for tedious walking is always an in-world object the player
walks to and uses, not removing the walk. This connects directly to the
not-yet-started Building skill and the not-yet-built Mine Entrance UI
(cart speed/auto-collection upgrades) — both are travel-infrastructure,
not menu shortcuts.



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

**Torches follow Stage 0's flat-gray rule like everything else** (reversed
2026-06-22, after playtesting — an earlier version of this doc had torches
glow warm at every stage including Stage 0, on the theory that "earned
light should read independent of world progress." Seeing it in actual
play, that read as visually wrong rather than thematically meaningful —
a warm-colored object sitting in an otherwise genuinely 2-color world
undercut Stage 0's flatness more than it added anything. Torches now
join the hearth and forge as part of the Stage 1 "first color enters the
world" moment, not an exception to Stage 0).

### Perception Is Progression

This system — the player literally restoring their own ability to
perceive the mountain, not just unlocking prettier graphics — is the
project's strongest unique feature and should be treated as core design,
not a cosmetic upgrade track. The framing to hold onto for future stage
work: Stage 0 is glyphs-only, the world is forgotten; later stages
should read as "materials gain identity" (a player can tell copper from
coal at a glance, not just by hovering), then "objects gain form" (sprites
replace glyphs, important objects become recognizable), then eventually
"architecture returns" (murals, statues, banners — the mountain gains
identity) and "memory returns" (the player understands what was lost).
**Current code implements 4 stages (0–3 above), not the fuller framing
implied here** — whether/how to extend ColorStage to capture the later
"architecture returns" / "memory returns" beats is an open question, not
yet decided or built; see OPEN_QUESTIONS.md.

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

## 13. The Four Layers of Restoration

A categorization scheme for evaluating future content — every new
feature should belong to at least one of these four layers. Useful as a
filter ("what layer is this actually serving?") more than as a literal
to-do list.

- **Survival** — restore function. Forge repair, gathering, fuel,
  torches. Question it answers: *can the dwarf survive?*
- **Infrastructure** — restore utility. Lifts, tracks, workshops,
  storage. Question: *can the mountain function?*
- **Civilization** — restore culture. Halls, brewery, archive, shrines.
  Question: *can the mountain live?*
- **Memory** — restore identity. Relics, murals, names, history.
  Question: *can the mountain remember?*

Currently-built content is almost entirely Survival layer (Forge, basic
gathering, torches, fuel). Infrastructure is just starting (the planned
Building skill, Mine Entrance UI). Civilization and Memory are
essentially unbuilt — Relics (LORE.md §1) and Rooms-as-progression
(§14 below) are the main planned entry points into those two layers.

## 14. Rooms As Progression

A room is more meaningful than a stat, and restoring places — not
accumulating numbers — should be the primary unit of visible long-term
progress (see LORE.md's "Progress Should Be Visible"). The Forge already
proves the pattern in miniature: it starts broken (rendered as rubble,
`forge_broken`), and the player restores it with materials. The
direction is to generalize this into a formal **four-stage room state**
that future rooms (Archive, Great Hall, Brewery, Shrine, Treasury,
Liftworks, Cartographer's Chamber, Ancestor Vault, and eventually a
deeper version of the Forge itself) all share:

1. **Ruined** — visually broken/rubble, not yet interactable beyond
   "this is wrecked."
2. **Cleared** — debris removed, the room's basic shape and purpose are
   now visible, but nothing inside actually works yet.
3. **Restored** — functional. The room does what it's for (a working
   Forge, a working Archive you can actually read).
4. **Masterwork** — a visibly distinct, best-in-class version, not just
   a higher number behind the same sprite — the room's restoration is
   "complete" in a way that should be rare and earned.

Each room must have a **visible transformation** between every stage —
this is a hard requirement, not an aspiration, per the visible-progress
rule. A room upgrade that doesn't change what the room looks like on
screen does not satisfy this framework, no matter what numbers it
changes underneath.

**STATUS: not yet built as a formal framework.** The Forge currently
only has two states in code (broken / repaired), not four, and no other
room has any state at all yet (Forge Room itself is always reachable
once the engine exists; other named zones like `tunnel_entrance` are
binary locked/unlocked, not staged). Generalizing the Forge's
broken→repaired pattern into the full four-stage model above — and
deciding what "Cleared" and "Masterwork" concretely mean for the Forge
specifically — is real, undone design/implementation work. See
OPEN_QUESTIONS.md.

## 15. UI As Progression

The UI itself should be restored alongside the mountain — the player
should not start with every panel/menu already available. Early game:
Inventory, Skills, Hearth. Later, as the corresponding room/system is
restored: Forge, then Archive, then Relics, then Cartography, then
Genealogy, then Deep Delve Records. Knowledge itself becomes a form of
progression, not just a static set of tabs that happen to gate their
*content* behind progress while the tab itself is always visible.

**STATUS: not yet built.** All UI that currently exists (Inventory,
Skills/stats panel, Smithing panel, Hearth panel) is simply available
from the start; there's no panel-unlock mechanism yet. Implementing this
means deciding where "panel exists but is greyed out" vs. "panel doesn't
render at all until unlocked" lands, and wiring each future panel
(Archive, Relics, Cartography, etc.) to its corresponding room's
restoration stage (§14) once those rooms exist. Tracked in
OPEN_QUESTIONS.md.

