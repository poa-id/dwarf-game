# The Hearth & The Deep — Open Questions

*Part of the design doc set — see ../DESIGN.md for the index. This file changes fastest — update it whenever a gap is resolved or discovered.*

## 11. Open Questions / Explicit Gaps

Tracked here so they don't get silently forgotten. Remove from this list
once resolved (and reflect the resolution in the relevant section above).

- **DIRECTION_RESET.md absorbed (2026-06-21):** the project's identity/
  philosophy reset has been merged into LORE.md (core fantasy, three
  protagonists, visible-progress rule, resource/relic philosophy,
  permanent-residents principle) and MECHANICS.md (camera decision, Hub-
  vs-systems pattern, travel philosophy, Four Layers of Restoration,
  Rooms-As-Progression, UI-As-Progression). It mostly *confirmed* existing
  architecture rather than contradicting it. The genuinely new/undone
  items it surfaced are broken out as their own entries below rather than
  re-stated here.
- **5-stage perception/color framing vs. current 4-stage `ColorStage`:**
  DIRECTION_RESET.md implies stages through "architecture returns" and
  "memory returns" (up to Stage 5), but MECHANICS.md §8 only implements
  and documents 4 stages (0–3). Not resolved — keeping the current
  4-stage system as the documented source of truth for now; the fuller
  framing is recorded as a future direction in MECHANICS.md §8 but no
  decision has been made on whether/how to extend `ColorStage` itself,
  add a parallel system, or fold "architecture/memory returns" into
  Rooms-As-Progression (§14) instead of the color-stage system.
- **Room-State framework (Ruined/Cleared/Restored/Masterwork) not yet
  built:** MECHANICS.md §14 documents the target model, generalizing the
  Forge's existing broken/repaired pattern. Currently the Forge only has
  2 states in code, not 4, and no other room has any state at all. Needs:
  (1) decide what "Cleared" and "Masterwork" mean concretely for the
  Forge, (2) decide which room becomes the next one to get this treatment
  (Archive is the most-referenced candidate), (3) actually implement the
  4-state model as reusable code rather than one-off Forge logic.
- **UI-As-Progression (panel unlocking) not yet built:** MECHANICS.md §15.
  All current panels (Inventory, Skills, Smithing, Hearth) are available
  from game start. Needs a decision on "exists but greyed out" vs. "does
  not render until unlocked," and a wiring point (presumably each future
  panel ties to its room's restoration stage once §14 exists).
- **Relics system not designed or implemented:** LORE.md §1 names the
  ambition (major content, not collectibles) and a few example relic
  names from discussion, but there's no `RelicId`, no relic data model,
  no acquisition mechanic, and no UI for them yet.
- **Resource/depth naming philosophy (history over power-tiers) not yet
  applied to any shipped content:** LORE.md §1 states the principle
  (prefer "Fallen Workings," "King's Veins," etc. over a Copper→Iron→
  Steel ladder framing) but this is a guideline for *future* material/
  area names, not a renaming of `copper_ore`/`iron_ore` — those keep
  their current `id`/`tier`/`category` exactly as-is; only the framing
  around new content should follow this going forward. No content has
  tested this naming approach yet.
- **Vertical-slice audit completed (2026-06-22):** walked the full loop
  (wake → mine copper → gather wood → repair forge → smelt ingots →
  repair torches → feed Hearth → unlock first color → restore first room
  → rekindle → return stronger) against the actual implementation.
  Findings:
  - Wake, mine copper, gather wood, repair forge, repair torches, feed
    Hearth, and unlock first color are all fully built, tested, and
    correctly wired.
  - **Real bug found and fixed:** the loop was NOT actually completable.
    `copper_ingot` (needed to smelt, and to repair torches) required
    `coal` as fuel, but `coal_seam` (defined in mining.ts) had no
    placement anywhere on the Hub map - there was no way for a player
    to ever obtain coal. **Fixed** by adding a Charcoal Kiln: a new
    fixed structure in the Hearth Hall (`KILN_POSITION` in hubMap.ts,
    contextual panel like the Forge/Hearth) that converts wood into a
    new `charcoal` material (heatValue 7 - hot enough for copper_ingot's
    minHeatRequired of 5, deliberately NOT hot enough for iron_ingot's
    10), governed by Hearthkeeping (its first XP source in the game).
    `SmithRecipe` was changed from a single `fuelMaterialId` to an
    `acceptedFuels` list so copper_ingot can burn either coal or
    charcoal - see smithing.ts/kiln.ts. `coal_seam` itself is still not
    placed on the map; charcoal is the deliberate early-game bootstrap,
    not a permanent replacement (see the resource-naming entry above -
    real coal mining still belongs to the future Tunnel Entrance/mine
    work).
  - **Real gap found AND fixed (2026-06-22, same day):** `rekindle()`
    was fully implemented and tested in engine/rekindle.ts, but nothing
    anywhere ever called it - no button, no keybind. **Fixed**: a
    "Rekindle" option now appears in the Hearth panel, but ONLY once
    `hearth.lifetimeFuel` crosses `COLOR_STAGES[1].fuelThreshold` (500) -
    the exact same threshold that triggers the world's first color and
    the `color_stage_1` narrator line. This was a deliberate design
    choice, not an implementation shortcut: per project owner's explicit
    direction, rekindling progress must stay completely silent
    beforehand - no counter, no narrator foreshadowing anywhere in the
    UI. The option simply exists, or doesn't, next time the panel
    renders. Confirmed via `window.confirm()` before committing (mirrors
    the existing reset-save pattern in main.ts) since it's permanent and
    irreversible. See hearthPanel.ts's `performRekindle`/
    `REKINDLE_FUEL_THRESHOLD`.
  - **"Restore first room" has no real target yet:** only the Forge has
    any state at all, and it's binary (broken/repaired), not the
    Ruined/Cleared/Restored/Masterwork model from §14. No second room
    (Archive, Great Hall, etc.) exists anywhere in the renderer. This is
    exactly the room-state framework work already queued as the next
    task after this audit.
- **First real playtest findings (2026-06-22) - several genuine bugs
  caught by actually playing, not just reading code:**
  - **Lit torches no longer glow independent of color stage.** An
    earlier deliberate design choice (torches glow warm even at Stage 0,
    "earned light reads independent of world progress") read as
    visually WRONG once actually seen in play - a warm-colored object
    in an otherwise genuinely 2-color world undercut Stage 0's flatness
    more than it added meaning. **Reversed**: torches now follow Stage
    0's flat-gray rule like everything else, and join the hearth/forge
    as part of Stage 1's "first color enters the world" moment. See
    palette.ts's STAGE_0/STAGE_1 `torch_lit` entries and MECHANICS.md §8.
  - **Contextual interaction range tightened from 2 tiles to 1.** Forge,
    Hearth, and Kiln proximity checks (`isNearForge`/`isNearHearth`/
    `isNearKiln`) used a 2-tile radius, inconsistent with mining/
    woodcraft's existing 1-tile radius and just generally felt too loose
    in play. All three now match the 1-tile standard. See proximity.ts.
  - **Sidebar was forcing page-level vertical scroll - fixed.** The
    `.stats-panel` had no height constraint at all; as the Hearth panel
    grew (fuel rows + reserve + burn gauge + upgrade + rekindle), the
    whole page grew taller and the browser's own scrollbar kicked in.
    **Fixed**: `.stats-panel` is now capped at exactly the canvas's pixel
    height (408px, matching `viewportRows * cellSize`), with each
    individual `.stats-section` scrolling internally if ITS OWN content
    overflows, and `.contextual-panel` given `flex-shrink: 0` so the
    actionable Forge/Hearth/Kiln panel is never squeezed by its
    siblings. The page itself never scrolls; only specific menu boxes
    can, per explicit direction. See style.css.
  - **Narag-Bund's name/nature was spoiled before any in-game discovery
    - fixed via real discovery gating, not just a disabled row.** The
    Hearth's tier-1 upgrade row rendered unconditionally (just grayed
    out if unaffordable), and its description named Narag-Bund and his
    nature outright - visible the moment the panel was ever opened, long
    before the player could plausibly have met him. **Fixed**: the
    upgrade row now doesn't render AT ALL below its Insight cost - no
    header, no disabled row, no hint anything exists there. Reaching the
    cost banked IS the discovery moment. This needed `Friend of Burden`'s
    cost raised from 30 to 250 Insight (the old cost was reachable after
    almost no play at all - clearly too cheap for what's described as a
    rare, major companion) - and `Deepened Hearth` (tier 2) raised from
    150 to 400 to keep ascending order above its own tier-1 prerequisite.
    Insight only comes from rekindling (`calculateRekindleInsight`), so
    250 is a real, multi-rekindle-or-one-long-playthrough milestone, not
    a quick trigger. See hearth.ts's `HEARTH_UPGRADES` and
    hearthPanel.ts's discovery-gating logic.
  - **Hearth stoking had no visible feedback at all - fixed with a real
    gauge plus a separate cosmetic flash.** Clicking "Feed the fire" or
    "Bank in reserve" silently updated a small inventory count with no
    other visible response - a direct violation of LORE.md's "Progress
    Should Be Visible" rule. Investigation found `HearthState.fuel` was
    already a real, designed-but-never-implemented field (doc comment
    described it as "consumed/spent over time," but nothing ever read or
    decayed it). **Fixed** with two distinct pieces, per project owner's
    explicit framing (a Minecraft-furnace analogy): (1) a real "burn
    gauge" in the Hearth panel showing `reserveBurnSecondsRemaining()` -
    actual seconds of auto-burn the banked reserve can sustain at
    `FUEL_ABSORPTION_RATE_PER_SEC`, draining live as `tickHearth`
    consumes it - only shown once auto-tending is unlocked, since the
    reserve isn't drawn from at all before that; (2) a separate, purely
    cosmetic CSS flash (`@keyframes`, not a transition, so it completes
    on its own regardless of whether anything re-renders afterward) on
    direct "feed the fire" clicks, since that path consumes instantly
    with no other persisted trace to show. Explicitly does NOT show
    `lifetimeFuel` or distance-to-next-color-stage anywhere - that stays
    silent, same principle as the rekindle gate above. See hearth.ts's
    `reserveBurnSecondsRemaining` and hearthPanel.ts/style.css.
- **Idle-game bulk action multiplier (agreed, not yet built):** any
  repeatable spend/produce action (stoking, smithing) should support a
  shared x1/x5/x10/MAX multiplier selector (Cookie Clicker convention) -
  needed once quantities scale into the thousands+. Should be ONE
  reusable mechanic, not duplicated per-feature. Still not built -
  current stoke/smith actions are all fixed at quantity 1 per click.
- **"Deepened Hearth" (tier 2) has no actual mechanical effect yet:**
  its description promises fuel efficiency, but nothing in `tickHearth`
  or `deductFuelValueFromReserve` currently reads `hearthTier` to apply
  any multiplier - buying it right now would cost 150 Insight for
  flavor text only. Needs either a real efficiency calculation or
  honest removal until one exists.
- **Mine Entrance UI (shape agreed, not built):** interacting with the
  Mine Entrance zone should open a dedicated panel - depth-gated nodes,
  cart speed + auto-collection upgrades. Still not built. The Tunnel
  Entrance zone itself is currently gated on `hearth_color_stage_at_least(1)`
  - worth revisiting given the forge_room precedent of "always reachable,
  contents start broken/rubble" might fit better here too.
- **Torch upgrades beyond initial repair (agreed, not built):** more
  light radius, other unspecified effects, after the base repair.
- **Organic cave shape / rubble rendering (§6):** PARTIALLY done - the
  forge now genuinely renders as broken/rubble (`forge_broken`) until
  repaired, proving the rubble-state pattern works. The broader organic/
  irregular CAVE SHAPE (vs. the current rectangular zone bounds) is
  still not implemented - this was specifically about wall geometry,
  not the rubble-vs-built rendering, which is now real for the forge.
- **Wandering strangers (§10):** model agreed, nothing built - distinct
  from Narag-Bund (§10a), which IS built.
- **Torch repair cost balance**: current costs (3-5 copper_ingot) are
  placeholder guesses, unplaytested against real ingot production rate.
- **Repeat-key guard doesn't cover the new contextual panel clicks:**
  the `e.repeat` fix only applies to keyboard shortcuts (F/E/R) - the
  Smithing/Hearth panel buttons are mouse clicks with no analogous
  "don't double-fire" guard. Probably fine (mouse click-spam isn't the
  same failure mode as a held key) but worth a deliberate look once
  played with a mouse for real.
- **Narag-Bund's haul interval/amount are unplaytested guesses:**
  `HAUL_INTERVAL_MS=10000`, `HAUL_AMOUNT_PER_TRIP=1` were picked to
  "feel like a creature on its own schedule" per the design discussion,
  but have not been tuned against real play.
- **Keyboard-only menu navigation requested, not yet built:** project
  owner wants to play with keyboard alone, including selecting/clicking
  contextual panel options (currently mouse-only - every Forge/Hearth/
  Kiln panel row is a `<div>` with a `click` listener, no keyboard path
  at all). Proposed shape from design discussion: WASD stays movement;
  arrow keys become menu navigation once a contextual panel is open;
  when the player is in interaction range of something (Forge/Hearth/
  Kiln/etc.), the panel's first option should be pre-selected by
  default, so a single confirm key-press acts on it immediately without
  needing to navigate first. Real design work needed before
  implementation: what's the confirm key (Enter? F, reused?), does
  arrow-key navigation wrap or clamp at the panel's ends, how does focus
  move between separate panel SECTIONS (e.g. Hearth panel currently has
  fuel rows + upgrade + rekindle as visually distinct groups - is that
  one flat list for arrow purposes, or does focus need to jump between
  groups deliberately), and how this interacts with movement input if a
  panel is open AND the player presses a movement key (does that close/
  ignore the panel, or do both stay live). Not started.
- **Starter wood node capacity raised 30 → 50 (2026-06-23, playtesting
  feedback):** forge repair alone costs 15 wood (`FORGE_REPAIR_COST`),
  which left only 15 of the old 30-wood total capacity for everything
  else - barely 3 charcoal-kiln attempts (4 wood each) with zero margin
  for the kiln's 15% failure chance, and nothing left to feed the Hearth
  directly. Project owner suggested either lowering the kiln's 4:1
  wood-to-charcoal ratio or raising wood supply; chose supply, to keep
  charcoal a real cost rather than a near-freebie. The 50 figure: forge
  repair (15) + charcoal for smelting/repairing at least the cheapest
  torch (3 copper_ingot × 4 wood/charcoal = 12 wood) = 27 baseline, ×1.3
  for failure margin + 10 wood buffer for Hearth-feeding ≈ 45, rounded
  up to 50. Deliberately NOT sized to repair all 3 torches (11 ingots
  total) from this one starter node alone - that's not the bar this
  node is meant to clear; a player repairing every torch is expected to
  draw on more than just the first wood formation. **SUPERSEDED same
  day** by the infinite-resource fix below - 50 turned out to still be
  finite, and finite was itself the actual problem. Kept here for the
  record of how the number was originally derived, not because 50
  still matters.
- **Starter copper vein and wood node made infinite - fixes a genuine
  permanent deadlock (2026-06-23):** found in actual play. Both nodes
  were finite, and were the ONLY source of copper/wood anywhere in the
  game (iron_vein/coal_seam/deepstone all require the not-yet-built
  real mine - see Tunnel Entrance in §6). Once exhausted, a save was
  permanently locked out of smelting, tool-forging, and torch repair -
  no recovery path existed. **Fixed**: both nodes' `totalYieldCapacity`
  changed to `null` (never depletes) - see LORE.md's new "Never
  Deadlock the Engine" principle for the design rule this establishes
  going forward (foundational materials infinite; better/rarer
  materials allowed to stay finite/gated). Also repositioned both from
  open floor to embedded against the Hearth Hall's walls (col 36 for
  copper, col 44 for wood, adjacent to the Kiln) - purely visual/
  thematic per project owner's direction, no change to interaction
  range or movement. See mining.ts's `copper_vein` and woodcraft.ts's
  `root_tangle` comments for the full rationale, and hubMap.ts for the
  new positions.
  - **Test fixture note:** every real `RockNode`/`WoodNode` in the game
    is now infinite, so the generic exhaustion mechanism
    (`totalYieldCapacity`/`isExhausted` in `gathering.ts`) no longer has
    any real game-content node to test against. Added synthetic
    `finiteTestNode` fixtures in `mining.test.ts`/`woodcraft.test.ts`
    specifically to keep that coverage real rather than deleting it -
    exhaustion is expected to matter again once the real mine
    introduces nodes that should deplete.
- **Tools are now smithed, not free (2026-06-23) - "metal + wood =
  tool":** previously, pickaxe/axe quality (`PICKAXE_TIERS`/`AXE_TIERS`
  in mining.ts/woodcraft.ts) was a free, automatic side-effect of
  `world.forgeTier` (the Forge's own upgrade tier) - no crafting step,
  no inventory item, nothing to actually DO to get a better pickaxe
  besides upgrading the Forge for an unrelated reason. Per explicit
  project direction, this was replaced: tools are now smithed at the
  Forge (`smithing.ts`'s `TOOL_RECIPES`/`attemptForgeTool`), consuming
  ingot + wood + fuel, same risk/fuel-heat rules as any other smithing
  recipe. The forged tier lives in `WorldState.toolsForged`
  (World-persistent - survives rekindling, unlike everything else a
  dwarf personally carries) rather than being derived from
  `forgeTier`. See MECHANICS.md's new Tools subsection under Smithing
  for the full design. Displayed in a new "tools" stats-section in the
  sidebar (`render.ts`).
  - **Follow-up gap, not yet built:** Steel Pickaxe/Steel Axe (tier 3)
    don't exist as real `ToolRecipe`s - there's no `steel_ingot`
    `MaterialDefinition`, no steel ore, no steel smithing recipe
    anywhere in the game. The OLD free-tier system had a "Steel Pick"
    entry, but it was equally unbacked by real content - this isn't a
    regression from the rework, just an existing gap made more visible
    now that tiers need actual recipes rather than just appearing.
  - **Possible follow-up, not decided:** old saves created before this
    change get backfilled with `toolsForged: {pickaxe: 0, axe: 0}` (see
    saveGame.ts) - meaning a save with `forgeTier >= 1` that previously
    got a free Copper Pickaxe bonus will, on next load, show as bare
    hands until the player re-forges one. Treated as an acceptable
    one-time migration cost, not an ongoing concern, since it only
    affects saves created before 2026-06-23.
- **Sidebar squeeze fixed via a real layout split, not just CSS
  (2026-06-23):** adding the "tools" stats-section made it likely that
  all 4 sidebar boxes (Dwarf, Tools, Carried, Contextual panel) couldn't
  comfortably fit a single 408px-tall column at once - rough math showed
  ~550px of natural content wanting to fit in 408px once the Forge panel
  shows both ingot AND tool recipes together. Rather than patch this
  with more aggressive internal scrolling, the layout itself changed:
  Dwarf/Tools/Carried now live in a LEFT sidebar
  (`.stats-panel-left`), and the Contextual panel (Forge/Hearth/Kiln -
  the thing that actually changes and needs room) now has an entire
  RIGHT sidebar to itself (`.stats-panel-right`). The canvas also grew
  from 25x17 to 32x22 cells (600x408px -> 768x528px) at the same 24px
  cell size - comfortably within the 80x50 Hub map's bounds, so no fog-
  of-war/light-radius side effects (DEFAULT_LIGHT_RADIUS is independent
  of viewport size; a bigger viewport just shows more of the
  already-dark unexplored map at once, not further sight). Both
  sidebars are now capped at 528px (matching the new canvas height)
  with real margin to spare for realistic content. See main.ts and
  style.css.
- **Second design-feedback pass (2026-06-23) - rekindle pacing, iron
  grind, and a queue of bigger systems not yet started:** project owner
  played further and raised several distinct points in one batch. Two
  are done (see MECHANICS.md's Hearthkeeping/Rekindling and Smithing
  sections for full detail): (1) rekindle diminishing-returns penalty +
  the dwarfCount XP multiplier ("the Mountain has learned"), (2) iron's
  Smithing `requiredLevel` 10 → 6. **Still queued, in this explicit
  order, not yet started:**
  - **(3) The Smelter - a new Forge Room addon/room, AND Smithing's
    real repeatable XP/resource sink.** Concept from design discussion:
    an expensive, one-time-build secondary station that purifies common
    ingots into a rare, low-drop-chance higher-quality ore/material,
    used for "special upgrades." This directly answers two things at
    once - the "pile of unused ingots after making one pickaxe + torches"
    problem AND the lack of any repeatable, XP-efficient Smithing action
    beyond raw ingot-spam (one-time tool recipes can't fill that role,
    they're forged exactly once ever). Also the first real test of the
    Room-State framework (§14) on something other than the Forge itself.
    Needs real design work before building: the purified material's
    name/identity (NOT deepstone - that's separately reserved for the
    real mine's tier-3 node, kept deliberately distinct so "refine what
    you have" and "delve deeper for something new" stay two different
    answers), the drop-chance number, build cost, and what "special
    upgrades" it actually unlocks.
  - **(4) A Hearth-room station for permanent, account-wide passive
    perks** ("improve the Mountain itself," distinct from the Smelter's
    Smithing-side sink) - concept only, no mechanical shape decided yet.
  - **(5) Tools should GATE access to better materials, RuneScape-style**
    - not just "mine faster," but "you cannot mine iron at all without at
    least a Copper Pickaxe," etc. Currently tool tiers only affect
    `successChanceBonus`/`yieldMultiplier` (see gathering.ts) - there's
    no hard gate tying a `RockNode.requiredLevel`-style check to
    equipped tool tier. Real implementation work: extending `RockNode`/
    `WoodNode` with a tool-tier requirement, and deciding the exact
    tier-to-material mapping.
  - **(6) Player-placed/buildable torches** - explicitly framed as the
    first real foothold for the still-unstarted Building skill, and as
    another resource sink. Not just "more fixed torches" - the player
    CHOOSES where to place one.
  - **(7) Rubble-clearing should cost resources + require tool tiers.**
    Specific complaint: the empty room revealed after rekindling
    currently has only one torch and no clearing cost/requirement at
    all. Connects directly to the Room-State framework (§14, Ruined →
    Cleared → Restored → Masterwork) - "Cleared" currently has no real
    mechanical definition anywhere in the codebase; this would be the
    first time it means something concrete.
  - Project owner's own framing: once (3)-(7) land, the project should
    be ready to move toward the longer-planned Mineshafts/real-mine
    content and idle-automation mechanics - explicitly NOT started yet,
    sequencing noted for the record.
- **Third playtesting round (2026-06-23) - large batch, several real
  bugs plus UX requests. In progress; this entry tracks what's done vs.
  still queued within the batch.** Reported together:
  (a) a perceived "rubble cleared on rekindle-threshold, not rekindle
  itself" bug, (b) charcoal not accepted by the Hearth, (c) Woodcraft
  has no narrator lines (Mining's lines fire instead/regardless), (d)
  stoking grants no Hearthkeeping XP, (e) passive reserve consumption
  has no visible feedback beyond the existing burn gauge, (f) the
  Forge's walkable approach feels oddly limited to one corner, (g) no
  keyboard way to interact with contextual panels (mouse-only), (h)
  success-rate isn't shown anywhere in station UIs, (i) narrator lines
  for routine Mining repeat too often and feel naggy, (j) no way to
  progress further without iron/coal access, (k) a colorStage-2
  transition didn't read as a visible change.
  - **(a) Resolved - not actually a bug, but the underlying coupling
    was real and is now fixed.** The Tunnel Entrance's unlock was tied
    to `hearth_color_stage_at_least: 1` - the SAME threshold that makes
    rekindling available - so both happening simultaneously looked like
    "rekindling unlocked the room," when actually the room's rubble/
    walls opening was a coincidentally-identical threshold, unrelated
    to rekindling itself. Per explicit direction, decoupled: Tunnel
    Entrance now unlocks at `forge_tier_at_least: 2` (Bellows of the
    Deep, 250 Insight) instead. See hubMap.ts's ZONES.
  - **(j) Resolved as a side effect of (a):** the Tunnel Entrance was
    also completely EMPTY - unlocking it revealed a room with nothing
    in it, since `iron_vein`/`coal_seam` existed in mining.ts's data
    but had never been placed anywhere on the map. Now placed inside
    the Tunnel Entrance (embedded against its walls, col 20/29 row 34 -
    see hubMap.ts's `ORE_VEINS`), kept infinite per explicit direction
    (Never Deadlock the Engine still applies; simpler than introducing
    finite veins now). Also fixed a real rendering bug found in the
    process: every vein rendered as `ore_copper` regardless of what it
    actually contained (a hardcoded shortcut from when copper was the
    only placed vein) - added a real `ore_coal` CellKind (didn't exist
    before at all) and fixed the stamping logic to map each vein to its
    correct kind by `rockNodeId`.
  - **(d) Resolved - Hearthkeeping now actually grants XP from
    stoking, with a real design split.** Per explicit direction:
    banking fuel into the reserve grants NOTHING by itself; XP comes
    from fuel actually being BURNED - either immediately (direct "feed
    the fire" stokes) or later, passively, at the exact moment
    `tickHearth` consumes banked reserve fuel. New shared constant
    `HEARTHKEEPING_XP_PER_FUEL_VALUE` (hearth.ts) used by both
    `performStoke` (hearthPanel.ts, immediate) and `gameTick`
    (loop.ts, passive) so the two paths stay consistent. ~360 XP/hour
    from fully passive, idle tending once auto-tending is unlocked -
    deliberately well below the Kiln's 8 XP per active click.
  - **(b) Resolved:** `charcoal` was a real oversight - genuinely
    missing from `HEARTH_FUEL_MATERIALS` (hearth.ts) even though it had
    a real `MaterialDefinition`/heatValue and was already a valid
    Smithing/Kiln fuel. Added. Also implemented the requested UI
    declutter: the Hearth panel's fuel rows now only render for
    materials the player actually holds (sorted by heatValue
    descending), rather than always showing all 3 fuel types
    regardless of holdings - was 6 rows of mostly "Have: 0" clutter
    with charcoal added. See hearthPanel.ts.
  - **(c) Resolved:** added a real Woodcraft narrator voice
    (`wood_first_strike`/`wood_strike` in lines.ts, wired into
    `handleWoodGather` in actions.ts) - previously genuinely silent.
    Investigation into "Mining lines fire during woodcutting" found no
    dispatch bug (the two materials' positions are 8 tiles apart,
    can't both be in 1-tile range at once) - the most likely
    explanation is the narrator toast's ~5s display duration
    outlasting a quick switch from mining to an unrelated action,
    which reads as "the wrong skill's line is showing." Addressed via
    (i) below rather than shortening the toast itself (explicit
    direction: lower the fire RATE, not the duration).
  - **(i) Resolved:** `mine_strike`'s narration chance lowered 0.15 →
    0.05 (explicit direction: "lower it much further"). `wood_strike`
    uses the same conservative 0.05 rate from the start, rather than
    introducing a brand-new pool at a chattier rate than the
    established skill.
  - **Still queued, not yet addressed:** (e) more explicit passive-
    consumption feedback beyond the existing burn gauge, (f) Forge
    approach-angle feel, (g) contextual-panel keyboard interaction, (h)
    success-rate display in station UIs, (k) colorStage-2 visual-change
    investigation.

