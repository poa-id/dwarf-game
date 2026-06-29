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

Five skills currently defined: **Mining**, **Smithing**, **Hearthkeeping**,
**Woodcraft**, **Tinkering** (added 2026-06-23, alongside the Gemcutting
station — see §5's Tinkering/Gemcutting writeup for the full mechanic).

- Mining, Smithing, Woodcraft, and Tinkering are **active** (player-
  initiated strikes/attempts). Tinkering currently has exactly ONE
  action (cutting gems at the Gemcutting station) — more (jewelry,
  gadgets) are deferred to later backlog items, not yet designed.
- Hearthkeeping is **idle** (ticks via real elapsed time, including while
  the tab is closed, capped at 24h offline catch-up) AND has a real
  active source too (the Charcoal Kiln's burning action) - see §5.
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
the game at the time (the Tunnel Entrance - §6 - had no content placed
in it yet then; it does now, see below). Per explicit project
direction, basic starter materials are now infinite by design,
functioning as a slow, reliable "idle engine" the player can always
fall back on - mine/gather, craft, repair, forever. The finite-node
MECHANISM
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

**Narag-Bund, the Companion** — befriended via the "Friend of Burden"
Hearth upgrade (tier 1, 250 Insight - see §5 for the full discovery-
gating rationale on that cost). Once befriended
(`WorldState.companion.befriended`), he hauls 1 unit
(`HAUL_AMOUNT_PER_TRIP`) of whichever fuel material the player
currently holds the MOST of (`hearth.ts`'s `nextHaulMaterial` - coal,
wood, or charcoal, never a fixed preference order) from carried
inventory into the Hearth's `fuelReserve`, every 10 seconds
(`HAUL_INTERVAL_MS`), real elapsed time including offline. This is
genuinely useful (banks fuel for `tickHearth`'s passive auto-burn
without the player needing to manually stoke) but was, for a long
stretch, also genuinely invisible.

**Fixed 2026-06-23, a real reported gap ("you unlock it and it just
disappears... it's mysterious"):** the ONLY feedback that ever existed
for Narag-Bund was a one-time narrator toast at the exact moment of
befriending (`companion_befriended`) - after that, total silence,
forever, while fuel quietly moved from carried inventory into the
reserve with zero attribution. Added a persistent status line in the
Hearth panel (only shown once befriended at all), live-computing what
he'll haul next and a countdown to his next trip
(`nextHaulMaterial`/`secondsUntilNextHaul`, both pure presentation
functions reading current state rather than waiting for an actual
haul event to log). `nextHaulMaterial` was extracted out of
`advanceCompanionHauling`'s own selection logic rather than
duplicated, so the preview and the real mechanic can never silently
drift apart.

## 5. Materials & Economy

Flexible `MaterialId`-keyed inventory (`Partial<Record<MaterialId,
number>>`), NOT fixed fields — supports adding new ore/fuel tiers as pure
content. Every material has a `MaterialDefinition`: category (ore/ingot/
fuel/wood/currency), tier, and (for fuel and wood) `heatValue`.

Currently defined: `copper_ore`, `iron_ore`, `coal` (heatValue 10),
`charcoal` (heatValue 7), `wood` (heatValue 4 - weaker than coal, real
fuel not just a construction material), `copper_ingot`, `iron_ingot`,
`insight`.

**Insight — earned two ways, not one (fixed 2026-06-23, a real gap, not
just a balance tweak):** `LORE.md` always described Insight as "earned
BOTH from Hearth-tending (slow trickle over time) AND from rekindling
itself," but for a long stretch of the project's life only the
rekindling half was ever implemented - a player who hadn't rekindled
recently had no way to earn Insight at all, directly contradicting
"Insight is a synonym for experience, used as a resource" (the
project's own framing for what Insight is meant to be). Found via a
direct playtesting question ("How do I gain insight? I'm sitting at 105
and it doesn't move up").

- **Per-action trickle**: EVERY XP-granting action across every skill
  now also grants Insight - 5% of that action's already-multiplied XP
  (`xpCurve.ts`'s `insightFromXp`), using the post-`dwarfCount`/True-
  metal-perk-bonus value, so Insight scales up right alongside however
  fast the player is currently leveling. Deliberately broader than
  "Hearth-tending" alone, per explicit direction - Mining, Smithing, the
  Kiln, the Smelter, Gemcutting all contribute, not only Hearthkeeping.
  **Deliberately fractional, never rounded per-action** -
  `WorldState.insightBanked` accumulates the raw fractional value (same
  precedent as `hearth.ts`'s `HEARTHKEEPING_XP_PER_FUEL_VALUE`); only
  the UI display (`Math.floor`, in `render.ts`) rounds, and only down,
  so the number shown never overstates what's actually spendable. This
  matters because most common actions grant under 20 XP, and 5% of that
  rounds to exactly 0 for many of the cheapest, most frequent ones
  (copper strikes, charcoal burns, copper smelts) - rounding per-action
  would have silently broken the entire feature for early-game play.
- **Tinkering's XP multiplier gap closed in the same pass**: Tinkering
  previously did NOT get the `dwarfCount`/True-metal-perk multiplier
  every other skill's XP already got (a gap explicitly flagged in an
  earlier comment, left for "revisit if/when... not yet decided") -
  now fixed, for consistency, so Insight (and faster leveling) applies
  there the same way it does everywhere else.
- **Rekindling's lump-sum payout is unchanged** and stacks on top of
  whatever was earned passively along the way - see §13's Rekindling
  section below for the full diminishing-returns mechanic. Per explicit
  direction, rekindling should still feel like a real event, not be
  made redundant by the per-action trickle existing alongside it.
- **Spent on**: Forge tier upgrades, Hearth tier upgrades AND its yield-
  perk tree, the Smelter (build cost + its own tier track), the
  Gemcutting station (build cost + its own tier track) - see each
  structure's own writeup below for exact costs.

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

**The Smelter — built 2026-06-23, a Forge Room addon answering two
problems at once:** (1) Smithing had no repeatable, XP-efficient action
beyond raw ingot-spam — tools are forged exactly once per tier, ever,
so they can't serve as a sink; (2) players ended up with a pile of
unused ingots after making one pickaxe and repairing torches, with
nothing else to spend them on. The Smelter (`smelter.ts`,
`smelterPanel.ts`, sits at `SMELTER_POSITION` — col 49, row 26, the open
floor strip directly below the Forge building) purifies common ingots
into rare **True-metals** ("True Copper" now; "True Iron" etc. once
those metals are real, reachable content — deliberately not added yet).

- **Must be BUILT first** — 1200 Insight + 20 Copper Ingot + 15 Copper
  Ore + 30 Wood (`SMELTER_BUILD_COST`/`SMELTER_BUILD_INSIGHT_COST`).
  1200 Insight is the new ceiling, above Heartfire-Tempered Anvil's
  1000 — deliberately "the new top investment in the game." The
  material cost is iron-free BY DESIGN: using iron here would create a
  circular dependency, since iron access itself requires `forgeTier 2`
  and the Smelter's own appeal partly depends on having something to
  purify before that's even reachable. This is also the first upgrade
  in the game funded by BOTH Insight AND materials together — every
  prior Forge/Hearth upgrade was Insight-only.
- **Purifying ALWAYS succeeds** at consuming 5 Copper Ingot
  (`PURIFY_INGOT_COST`) and granting 12 Smithing XP
  (`PURIFY_BASE_XP`, deliberately above `copper_ingot`'s own smelting
  baseXp of 10 — meant to be Smithing's best repeatable XP/effort
  ratio) — there's no separate success/failure roll, unlike nearly
  every other action in this engine. The ONLY randomness is whether
  that purification ALSO yields a True-metal on top, at a real but
  genuinely low chance.
- **The True-metal drop-chance curve is deliberately conservative:**
  0.05% at base (just-built, unupgraded), rising to 0.2% / 0.5% / 1%
  across three Insight-funded Smelter-specific tiers
  (`SMELTER_TIERS` — "Truer Flame," "Patient Crucible," "Mountain's
  Own Heat," 300/700/1500 Insight). This is a real, explicit
  correction from an initial proposal of 3/8/15/25%, which was judged
  far too generous for a currency meant to fund permanent, account-
  wide upgrades — True-metals should stay genuinely rare even at max
  tier, not become a steady trickle.
- **Smelter tiers are a SEPARATE upgrade track from the Forge's own**
  (Bellows of the Deep, Heartfire-Tempered Anvil) — an explicit design
  call, not bundled into `forgeTier`.
- **The Mountain's XP perk tree — the first thing True-metals actually
  buy:** a permanent, GLOBAL (all skills, not just Smithing) XP
  multiplier bonus, in 3 cumulative-spend tiers (`XP_PERK_TIERS`: spend
  1 total True-metal → +5%, spend 3 total → +10%, spend 6 total →
  +15%). Tracked as `WorldState.trueMetalSpentOnXpPerk` — a running
  lifetime total, not a per-purchase deduction check, since the tiers
  are cumulative thresholds. Stacks ADDITIVELY with the dwarfCount
  multiplier (§ above) into ONE combined value, both capped together
  at the same 3x ceiling — see `xpCurve.ts`'s `applyDwarfCountXpMultiplier`,
  which now takes a `trueMetalXpBonus` parameter alongside `dwarfCount`,
  so spending True-metals can't blow past "mastery should stay rare and
  earned even late." The perk section of the Smelter's panel shows
  REGARDLESS of `smelterBuilt` — it's Mountain-wide content, not
  Smelter-room content, so a future True-metal source wouldn't need
  the Smelter built to spend it here.
- **Discovery-gated UI throughout**, same principle as Narag-Bund's
  upgrade row: the Smelter's own tier-upgrade row and the perk-tree
  section only render when actually affordable, never as a permanently
  visible disabled row naming a cost far out of reach.
- **Reference art exists but isn't integrated yet** —
  `docs/reference-art/Smelter.png` (and three sibling workshop images)
  are real Vettlingr-style assets, but as a 96x118px multi-cell room
  composite, not a single 32x32 tile matching `tilesetManifest.ts`'s
  convention. The Smelter currently renders as a placeholder (reused
  ore texture, tinted) in both ASCII and tileset mode — real slicing/
  integration work is still open, see OPEN_QUESTIONS.md.

**The Hearth's global yield perk — built 2026-06-23, the genuine
counterpart to the Smelter's XP perk:** that one governs HOW FAST you
level; this one governs HOW MUCH you get per action — every action,
any skill, per explicit project direction ("applied everywhere
uniformly"). `hearth.ts`'s `YIELD_PERK_TIERS` mirrors `XP_PERK_TIERS`'
shape exactly (1/3/6 cumulative True-metal spend → +5%/+10%/+15%), but
tracks a SEPARATE running total (`WorldState.trueMetalSpentOnYieldPerk`,
distinct from `trueMetalSpentOnXpPerk`) — the player allocates each
True-metal independently between the two trees, a real resource-
allocation choice even though both spend the same currency. Per
explicit direction ("let's not have this overlap with other upgrade
stations"): sharing the CURRENCY is fine, the mechanic and the spend-
tracking stay fully separate.

- **`yieldCurve.ts`'s `applyHearthYieldBonus`** is the single shared
  function every yield-producing call site uses — applied ON TOP of
  whatever yield-variance an action already had (Mining/Woodcraft's
  existing tool-based `yieldMultiplier`), additive, capped at the same
  3x ceiling as the XP multiplier.
- **Wired into every real yield call site**: `gathering.ts`'s
  `attemptGatherStrike` (Mining/Woodcraft), `smithing.ts`'s
  `attemptSmith` (ingots), `kiln.ts`'s `attemptCharcoalBurn`.
  Deliberately NOT applied to tool-forging (`attemptForgeTool`) —
  tools produce a discrete tier, not a multipliable quantity, there's
  nothing for a yield bonus to act on.
- **Honest caveat**: every current Smithing/Kiln recipe has a flat-1
  yield (`ingotYield`/`charcoalYield`), so at low perk tiers
  `Math.round(1 * 1.05)` etc. rounds right back down to 1 — the bonus
  has NO visible effect there yet. Not a bug; the effect becomes real
  once either base yields increase elsewhere or a future bulk-action
  multiplier (still on the backlog) lets multiple attempts compound.
  Mining/Woodcraft, whose yields can already exceed 1 at higher tool
  tiers, are where this perk is actually visible today.
- **Spent via the Hearth panel** (`hearthPanel.ts`'s
  `performSpendTrueMetalOnYield`), same discovery-gating principle as
  everywhere else — the perk row only renders once actually
  affordable.

**Tinkering — a new 5th skill, and the Gemcutting station — built
2026-06-23, the third permanent-multiplier track:** alongside the
Smelter's XP perk and the Hearth's yield perk, Tinkering's own
self-reinforcing loop (more gem-drop chance → more cut gems → more
loop bonus) is funded by **cut gems**, a third currency, genuinely
separate from True-metals. Tinkering launches with exactly one action
(Gemcutting) — more (jewelry, gadgets) are deferred to later backlog
items.

- **Gems are a MINING byproduct, not a Smithing one** — added to
  `gathering.ts`'s `GatherableNode` as an optional `gemDrop` config
  (`materialId` + `baseChance`), checked via a SECOND, independent
  roll (`gemRoll`) from the strike's own success roll. Reusing one
  roll for both would incorrectly couple two unrelated probabilities.
  A failed strike never reaches the gem check at all. Only Mining's
  rock nodes populate `gemDrop` — Woodcraft's wood formations never
  do, since `GatherableNode` is shared infrastructure between the two
  skills.
- **One gem type per ore vein TIER, rarity compounding with vein
  rarity** (an explicit design call — rarer veins drop their OWN gem
  less often too, rather than offsetting their rarity): `copper_vein`
  → Rough Quartz (2% base), `iron_vein` → Rough Garnet (1%),
  `deepstone` → Rough Amethyst (0.3%, the rarest of both axes).
  `coal_seam` deliberately drops nothing — not gem-bearing rock
  thematically.
- **The Gemcutting station** (`gemcutting.ts`, `gemcuttingPanel.ts`,
  sits at `GEMCUTTING_POSITION` — col 37, row 28, in the Hearth Hall
  near the copper vein, NOT the Forge Room — gems are a Mining
  byproduct, so the station belongs near where the player already
  gathers) refines rough gems into cut gems. Build cost: 800 Insight +
  15 Copper Ingot + 20 Wood (`GEMCUTTING_BUILD_COST`/
  `GEMCUTTING_BUILD_INSIGHT_COST`) — below the Smelter's 1200 ceiling,
  reachable a bit earlier; iron-free for the same circular-dependency
  reason as the Smelter.
- **Cutting has a REAL success/failure chance**, unlike the Smelter's
  always-succeeds purification — an explicit design call ("mirrors
  most other crafting actions in this game"): a failed cut wastes the
  rough gem entirely, no XP, no cut gem. Base 60% (`CUT_BASE_SUCCESS_CHANCE`,
  deliberately lower than most starter-tier actions — "gem-cutting is
  meant to be a real craft you get better at"), governed by Tinkering,
  granting 10 XP per attempt (`CUTTING_BASE_XP`) regardless of
  success/failure status at the call site (the XP only actually lands
  on success, per `attemptCutGem`'s result).
- **The Gemcutting station's own tier track** (`GEMCUTTING_TIERS` —
  "Steadier Hands," "Loupe and Wheel," "Master's Bench," 300/700/1500
  Insight, mirroring `SMELTER_TIERS`' costs exactly) raises BOTH the
  raw gem-drop chance AND the cutting-success chance TOGETHER — one
  combined track, not two separate ones, unlike the Smelter's single-
  effect tiers.
- **Tinkering's self-reinforcing perk tree** (`TINKERING_PERK_TIERS` —
  1/3/6 cumulative cut-gem spend, mirroring `XP_PERK_TIERS`'/
  `YIELD_PERK_TIERS`' shape, +5%/+10%/+15% to BOTH drop chance and
  cutting success) is the loop's reinforcement: better tools (Tinkering
  level gates what's available at the station) and more cut gems spent
  here make future gems easier to find AND cut, which makes the next
  perk tier easier to reach. `totalGemDropChanceBonus`/
  `totalCuttingSuccessBonus` combine the station's own tier with this
  perk tree into the single numbers actually used by
  `attemptMineStrike`/`attemptCutGem`.
- **Three rough gem types, each independently discovery-gated in the
  UI** — `gemcuttingPanel.ts` only shows a cutting row for a gem type
  the player actually holds at least one of, never a permanently
  visible disabled row for a gem never found.
- **`gem_found` narrator trigger** — always fires (not throttled, since
  the drop chance itself already gates rarity), distinct from routine
  `mine_strike` lines, marking a genuinely rare event as one.

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
been deliberately set aside for it. See §4's Narag-Bund subsection
above, who automates the "setting aside" step once befriended.

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
  below):** befriends Narag-Bund (§4's Narag-Bund subsection) AND
  unlocks `tickHearth`'s
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
at the time this fix was made, Insight only came from rekindling
(`calculateRekindleInsight`, 5 per total skill level), so the old 30
cost was reachable after almost no play at all - far too cheap a gate
for something meant to be rare and major, and not even a meaningful
threshold for discovery-gating purposes. (Insight gained a second,
broader source later - see §5's Insight writeup below - but the 250
cost still stands as the right number; nothing about that conclusion
depended on Insight being rekindle-only.)

**Rekindling has a UI affordance now, and it must stay silent
beforehand (added 2026-06-22):** the "Rekindle" option appears in the
Hearth panel once `hearth.lifetimeFuel` crosses
`REKINDLE_FUEL_THRESHOLD` (500, defined in `rekindle.ts` - moved there
2026-06-23 from `hearthPanel.ts` since `calculateRekindleInsight` below
also needs it, and the engine can't depend on a UI file) - deliberately
the SAME threshold that triggers the world's first color, not a
separate number. Per project owner's explicit direction, this must give
no warning beforehand anywhere in the UI - no counter, no narrator
foreshadowing. The option simply exists, or doesn't, the next time the
panel renders. Confirmed via `window.confirm()` (mirrors the existing
reset-save pattern) since the action is permanent. See hearthPanel.ts's
`performRekindle`, and §13/§14's "knowledge itself becomes progression"
framing - this is that principle applied to the single most important
action in the game.

**Rekindling has real pacing now, added 2026-06-23 after explicit
playtesting feedback ("rekindling is harsh... but also too easy to spam
for marginal gains"):** two separate, complementary mechanisms:

1. **Diminishing-returns Insight penalty for rekindling too soon.**
   `hearth.lifetimeFuel` never decreases, so without this, the moment
   the 500 threshold first cleared, it stayed permanently cleared -
   nothing stopped rekindling again 30 seconds later for whatever
   Insight a fresh level-1 dwarf's skills happened to be worth.
   `WorldState.lifetimeFuelAtLastRekindle` now records the fuel level
   at each rekindle; the NEXT rekindle's Insight payout scales linearly
   by how much fuel has grown since then, from 0 (zero growth, zero
   Insight) up to the full payout once growth reaches a full
   `REKINDLE_FUEL_THRESHOLD`'s worth (growing beyond that doesn't
   over-reward - the multiplier caps at 1.0). The very first-ever
   rekindle always gets the full multiplier, since `lifetimeFuelAtLastRekindle`
   starts at 0 and any real progress counts as growth. See
   `calculateRekindleInsight` in rekindle.ts.
2. **A permanent per-dwarf XP-gain-rate bonus, scaling with
   `dwarfCount`.** "The Mountain has learned" - a fresh dwarf gains
   skill XP meaningfully faster than the very first dwarf did: +15% per
   prior dwarf, capped at 3x. Deliberately a flat multiplier applied at
   every XP-granting call site (mining/woodcraft strikes, smithing
   ingots/tools, the charcoal kiln), NOT a change to the underlying
   `xpForLevel` curve itself - individual recipe/action balance stays
   untouched, this is one separate lever. See
   `applyDwarfCountXpMultiplier` in xpCurve.ts - the single shared
   source of truth every call site uses, rather than each
   reimplementing the formula. **Important implementation detail:**
   because the multiplier is applied at the call-site layer (not inside
   the pure `attempt*` engine functions), every call site must recompute
   the skill's new level via `levelForXp(newTotalXp)` rather than
   trusting the engine result's `newLevel`/`leveledUp` fields directly -
   those were computed from the UN-multiplied `xpGained`.

**colorStage is capped at 0 until the player has actually rekindled
once (fixed 2026-06-23 - a real bug, not just polish):** `colorStage`
used to be a pure function of `hearth.lifetimeFuel` alone, meaning the
world's first color appeared the MOMENT `lifetimeFuel` crossed the
Stage 1 threshold - the same moment the Rekindle option became
available, but NOT the same moment the player actually clicked it.
Found in playtesting: the hearth and torches visibly colored
themselves before any rekindle had happened, contradicting the
explicit lore framing that crossing this threshold "IS the rekindling
event" (colorStages.ts's own comment) - in the actual implementation,
color and rekindling had quietly become two independent things sharing
a coincidental threshold. Fixed with `capColorStageBeforeFirstRekindle`
in colorStages.ts: both `stokeFireDirectly` and `tickHearth` now take a
`hasRekindledOnce` parameter (derived from `dwarfCount > 0`) and pin
`colorStage` at 0 regardless of `lifetimeFuel` until that's true.
Stages 2 and 3 are untouched once the cap lifts - they remain pure
functions of `lifetimeFuel`, exactly as before this fix, since only
Stage 1 was ever meant to be gated on the act of rekindling itself.

**Smithing panel hides recipes the player's level doesn't qualify for
yet, rather than showing them disabled (fixed 2026-06-23):** found in
playtesting - a level-1 dwarf saw a permanently grayed-out "Iron Ingot -
Requires Smithing level 6" row the instant they opened the Forge panel,
which read as "iron is already available" when it wasn't remotely
reachable. `SMITH_RECIPES`/tool rows in smithingPanel.ts are now
filtered to only render for recipes the current Smithing level actually
meets - the row simply doesn't exist below that level, rather than
existing-but-disabled. Deliberately LEVEL-gated, not holdings-gated
(seeing zero iron_ore held doesn't hide the row once level 6 is
reached) - per explicit project reasoning, the recipe appearing the
moment level qualifies is what should prompt the player to go look for
iron, not the reverse.

**Smithing's iron-tier `requiredLevel` lowered 10 → 6 (2026-06-23):**
the first-ever climb to Smithing level 10 needed roughly 1,727
`copper_ingot` smelts (`cumulativeXpForLevel(10) / baseXp 10`) -
genuinely daunting, and notably NOT helped by the dwarfCount multiplier
above, since that only kicks in after several rekindles, not on a
fresh save's first climb. Level 6 needs roughly 315 smelts instead -
still real, but a fifth of the original. Applies to `iron_ingot`,
`iron_pickaxe`, and `iron_axe` (smithing's gate) - `iron_vein`'s Mining
`requiredLevel` (8, in mining.ts) is a SEPARATE, independent skill gate
and was deliberately left untouched, since the original complaint was
specifically about Smithing.

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



**Movement and keyboard controls (changed 2026-06-23 - WASD/arrows
dual-mapped to movement until then):** WASD is now the SOLE movement
input. Arrow keys are fully reserved for contextual-panel navigation -
Up/Down move a highlighted-row selection, clamping at the panel's ends
(no wraparound), Space confirms the highlighted row. This is real, not
just a remap: a player can walk to the Forge/Hearth/Kiln, see the first
available action pre-selected the instant the panel has content (no
arrow-key press needed first), and confirm with Space alone - genuinely
mouse-free play, per explicit project direction. Implementation
(`panelNavigation.ts`) is deliberately panel-agnostic: it operates
purely on the `.recipe-row`/`.recipe-row-disabled` DOM convention every
panel already shared, confirming by dispatching a real `.click()` on
the highlighted element so each panel's existing onClick wiring fires
unchanged - no panel's render logic needed to know anything about
keyboard state. `render.ts` tracks which panel was active on the
previous render (`lastActivePanelKind`) purely to reset the highlight
to row 0 when the panel's IDENTITY changes (e.g. walking from Forge to
Hearth), so an index that made sense for one panel's row count doesn't
carry over nonsensically to a different one.

Real grid movement, with collision against solid terrain
(`SOLID_CELL_KINDS`: walls, hearth, forge, ore veins, tunnel_edge —
deliberately excludes torches and the dwarf himself).

**The Forge's walkable approach (fixed 2026-06-23 - was a real,
reproducible geometry bug, not a feel issue):** the Forge building
(`FORGE_BUILDING` in exampleSprites.ts) is a 4x4 sprite - solid wall
frame around a 2x2 forge interior, with `null`/non-overriding corners.
The OLD proximity check (`FORGE_CENTER`, a separately-guessed center
point) pointed at one of the building's own SOLID interior cells -
walled in on every side except one lucky diagonal corner, so "near the
forge" was only ever reachable from that single tile. Root cause:
`hubContent.ts` (rendering, stamps the sprite) and `proximity.ts`
(interaction, decides where the player can stand) each independently
computed their own guess at the forge's position, and the two never
matched. Fixed by introducing `FORGE_BUILDING_FOOTPRINT` (hubMap.ts) as
the single shared source of truth both files now derive from (from the
REAL `forge_room` zone bounds, not a separate hardcoded copy) -
`isNearForge()` now checks the building's actual footprint rather than
a center-point-plus-radius. Per explicit direction, all four sides are
walkable ("the illusion of a huge masterforge") - 20 perimeter cells
now count as near the forge, up from 1.

**Blocked-movement messages now name the specific zone and what
unlocks it (fixed 2026-06-23):** found in playtesting - a player at the
Tunnel Entrance's boundary (correctly blocked, `forgeTier < 2`) saw
only "Something blocks the way - not yet rebuilt, not yet open to him,"
the same generic flavor line shown for any locked zone regardless of
which one or how far from its real unlock condition. Added
`describeUnlockCondition` (visibility.ts) - human-readable text per
`UnlockCondition` type, looking up the real Forge upgrade name (e.g.
"Bellows of the Deep") rather than a raw tier number; `lore_flag`
conditions deliberately stay vague ("Requires something not yet
discovered") rather than naming the flag, to avoid spoiling discovery
content. `MoveResult` (movement.ts) gained a `blockedZone` field,
populated whenever `blockedReason === "locked_zone"`, so the game-layer
message can say e.g. `"Tunnel Entrance is sealed. Requires the Forge
upgraded to \"Bellows of the Deep\"."` - falling back to the old
generic line only if zone info is somehow unavailable.

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

**Two renderer implementations, genuinely switched between as of
2026-06-23 (previously, tileset mode existed fully asset-backed and
type-complete but was never once instantiated or selected anywhere -
this was discovered, not by reading the code, but by a direct
playtesting question: "is there a stage where we implement [real
sprite art] like the Dwarf Fortress one we talked about?" The honest
answer at the time was no, despite `ATTRIBUTION.md` and the tileset
asset files having existed since early in the project):**

- **ASCII/glyph mode** (`GridRenderer`, monospace characters + the
  4-stage color palette described above) - active at colorStage 0 and
  1.
- **Tileset mode** (`TilesetRenderer`, real sprite art from the
  Vettlingr 32×32 Dwarf Fortress tileset, used with explicit artist
  permission for this non-commercial project — see `ATTRIBUTION.md`) -
  active at colorStage 2+. Per explicit project direction, this maps
  directly onto the Perception-Is-Progression framing above: Stage 0/1
  stay glyphs-only ("the world is forgotten"), Stage 2 is where
  "objects gain form, sprites replace glyphs." Stage 3 does NOT change
  the tileset's own appearance further - one fixed look from Stage 2
  onward, by explicit choice (`TileDefinition` has exactly one tint per
  `CellKind`, no per-stage variants) - the big visual jump is the
  glyph→sprite transition itself; further stage progress is meant to
  be felt other ways (architecture/memory beats, not yet built - see
  OPEN_QUESTIONS.md).

**What actually had to be fixed**, since the two renderers had quietly
diverged despite an old docstring claiming "drop-in alternative, same
input shape": `GridRenderer.render()` takes lazy per-cell lookup
callbacks (`CellLookup`/`VisibilityLookup`) and does its own viewport-
centering math around the dwarf; the original `TilesetRenderer.render()`
instead took a flat pre-built `GridCell[]` array with NO viewport
windowing and NO fog-of-war/visibility handling at all - genuinely
incompatible shapes, not actually swappable. Rewrote `TilesetRenderer`
to share `GridRenderer`'s exact signature and viewport/visibility logic
(same `REMEMBERED_OPACITY` dimming, same void-background baseline), and
added a shared `Renderer` interface (`GridRenderer.ts`) both classes now
explicitly implement, so `render.ts`'s `render()` can hold either one
polymorphically and pick via a simple `activeRenderer(colorStage)`
helper. Material-type variants (copper/iron ore) reuse one base texture
with canvas multiply-tinting rather than unique art per mineral,
mirroring how DF itself recolors generic stone. Tile assets preload
asynchronously at startup (`TilesetRenderer.preload()`, kicked off in
main.ts but not awaited before the first frame) - safe because a fresh
save starts at colorStage 0, giving real playtime for the (small,
mostly base64-inlined-by-Vite) assets to finish loading well before
colorStage 2 is ever reached. **Isometric rendering was considered and
explicitly rejected** — too large a scope change for the visual gain.

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

