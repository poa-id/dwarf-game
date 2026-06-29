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
  - **(3) The Smelter - RESOLVED, fully built 2026-06-23.** All open
    design questions settled through direct discussion and built:
    purified material naming pattern is "True-X" (True Copper now,
    True Iron etc. once those metals are real reachable content);
    drop-chance curve corrected from an initial 3/8/15/25% proposal
    (judged far too generous) down to a genuinely conservative
    0.05/0.2/0.5/1%; build cost is 1200 Insight + 20 Copper Ingot + 15
    Copper Ore + 30 Wood (deliberately iron-free, avoiding a circular
    dependency with the Tunnel Entrance's own forgeTier-2 gate); the
    first thing True-metals buy is a permanent, global, 3-tier XP
    perk (+5/+10/+15%, cumulative True-metal spend thresholds),
    stacking additively with the dwarfCount multiplier under the same
    3x cap. See MECHANICS.md's full "The Smelter" writeup for every
    number and the engine/UI implementation (`smelter.ts`,
    `smelterPanel.ts`). Real reference art was provided
    (`docs/reference-art/`) but is NOT yet integrated - still renders
    as a placeholder; see the dedicated entry on this further down.
  - **(4) A Hearth-room station for permanent, account-wide passive
    perks - RESOLVED, fully built 2026-06-23, and grew into a much
    larger feature than originally scoped.** What started as "a Hearth
    station for passive perks" turned into THREE coordinated permanent-
    multiplier tracks, each with its own currency and effect, per
    explicit direction ("let's not have this overlap with other
    upgrade stations" + "always think about how everything ties with
    idle mechanics - Bitcoin Billionaire, Cookie Clicker"):
    1. The Smelter's XP perk (already resolved above) - True-metals →
       faster leveling, all skills.
    2. **The Hearth's yield perk (new)** - True-metals → more output
       per action, all skills. Genuine Cookie-Clicker-style "each click
       does more" lever, explicitly chosen over passive-idle-generation
       or offline-acceleration alternatives that were also considered.
       Mirrors the XP perk's tier shape exactly but tracks a SEPARATE
       running total, so the player allocates each True-metal
       independently between the two trees - real design tension,
       explicitly accepted as fine ("sharing the CURRENCY is fine, the
       mechanic and tracking are separate, that's not the overlap I
       wanted to avoid").
    3. **Tinkering (new 5th skill) + the Gemcutting station (new)** - a
       third, fully independent currency (cut gems, not True-metals) and
       a self-reinforcing loop (more gems found → more cut → bigger
       loop bonus → easier to find/cut more) rather than another global
       multiplier. This is the biggest single addition of the whole
       session - a new skill touches `SkillId`, `VesselState`, save
       migration, the stats panel, and more.
    - **Real corrections made during design, worth recording**: the
      True-metal drop-chance curve was originally proposed at
      3/8/15/25% and explicitly corrected down to a far more
      conservative 0.05/0.2/0.5/1% once framed against "permanent,
      account-wide upgrades" rather than a per-craft ingredient.
      Similarly, gem rarity was explicitly INVERTED from an initial
      "rarer veins drop gems more often" instinct to "rarer veins drop
      their OWN gem less often too" - compounding rarity on both axes
      rather than one offsetting the other.
    - See MECHANICS.md's full writeups (Smelter, Hearth yield perk,
      Tinkering/Gemcutting) for every number, file, and design
      rationale. `yieldCurve.ts` (new) holds the shared yield-
      multiplier function, deliberately kept separate from
      `xpCurve.ts` despite structural similarity.
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
  - **(k) Resolved - investigation found a much bigger gap than
    expected.** The actual question behind "colorStage-2 didn't trigger
    a visual change" turned out to be "is there a stage where we
    implement real sprite art like the Dwarf Fortress tileset we
    discussed?" - and the honest answer, on investigation, was no:
    `TilesetRenderer` existed fully asset-backed (real PNGs, real
    artist permission, full `CellKind` coverage in `tilesetManifest.ts`,
    kept in sync all session) but was NEVER ONCE instantiated or
    selected anywhere in the actual game - every "Stage 2/3 should look
    different" comment written earlier this session was describing
    ASCII color changes only, since that's all that could possibly run.
    Worse, the two renderers had quietly diverged: `TilesetRenderer`'s
    original `render(grid: GridCell[])` took a flat pre-built array
    with no viewport-centering and no fog-of-war/visibility handling at
    all - genuinely incompatible with `GridRenderer`'s lazy-callback,
    viewport-centered signature, despite an old docstring claiming
    "drop-in alternative." **Fixed properly, not just switched on**:
    rewrote `TilesetRenderer` to share `GridRenderer`'s exact signature
    and visibility/viewport logic, added a shared `Renderer` interface
    both now implement, and wired `render.ts`'s `render()` to pick
    between them via `activeRenderer(colorStage)`. Per explicit
    direction: ASCII for Stage 0/1, tileset from Stage 2 onward, with
    Stage 3 NOT changing the tileset's own appearance further (one
    fixed look once it activates - the big jump is glyphs→sprites
    itself). See MECHANICS.md's rewritten "Two renderer
    implementations" section for the full account.
  - **(e) Confirmed already satisfied, no changes needed.** Direct
    confirmation from project owner: the existing burn gauge (real-time
    draining bar + "~Ns left" text, active once `hearthTier >= 1`) IS
    the Minecraft-furnace-style feedback wanted - manual/direct stoking
    correctly keeps just its brief cosmetic flash, nothing more
    persistent. No gap here after all; this was resolved by re-checking
    intent rather than by writing code.
  - **(f) Resolved - a real, reproducible geometry bug, not a feel
    issue.** The Forge building (`FORGE_BUILDING`, a 4x4 sprite: solid
    wall frame around a 2x2 forge interior, with `null`/non-overriding
    corners) had its proximity check (`FORGE_CENTER`) pointing at one
    of the building's OWN solid interior cells - walled in on every
    side except one lucky diagonal corner. "Only accessible through the
    lower right corner" was an exact, computable consequence of that
    mismatch. Root cause: `hubContent.ts` (rendering) and `proximity.ts`
    (interaction) each independently GUESSED the forge's position, and
    the two guesses never matched. **Fixed properly**: added
    `FORGE_BUILDING_FOOTPRINT` (hubMap.ts), the single source of truth
    both files now derive from (deriving from the REAL `forge_room`
    zone entry, not a separate hardcoded copy); rewrote `isNearForge()`
    to check the building's actual footprint rather than a center-point-
    plus-radius. Per explicit direction, all four sides of the building
    are now walkable/interactable ("the illusion of a huge masterforge"
    you can walk all the way around) - verified computationally: 20
    walkable perimeter cells now count as "near the forge," up from 1.
  - **(g) Resolved - real new interaction infrastructure, not a small
    fix.** Built per the full design discussed much earlier this
    session: WASD is now the SOLE movement input (arrow keys removed
    from `KEY_TO_DIRECTION` entirely, per explicit direction - they
    never move the dwarf again, even with no panel open); arrow
    Up/Down navigate the currently-open contextual panel's rows,
    CLAMPING at the ends (no wraparound, explicit choice); Space
    confirms the highlighted row (not Enter, not reusing F). New
    `panelNavigation.ts` is deliberately panel-agnostic - it operates
    purely on the existing `.recipe-row`/`.recipe-row-disabled` DOM
    convention every panel already shared, so zero changes were needed
    to any individual panel's render logic; confirming dispatches a
    real `.click()` on the highlighted element, firing each panel's
    existing onClick wiring unchanged. The first enabled row is
    pre-selected the instant a panel has any content (no arrow-key
    press needed first) - this is what makes "pre-select on proximity"
    work. Highlight resets to row 0 when the active panel's IDENTITY
    changes (e.g. walking from Forge to Hearth), tracked via
    `render.ts`'s `lastActivePanelKind`. Repeat-key guard extended to
    cover Space/arrows too, preventing held-key spam-firing.
  - **(h) Resolved.** `baseSuccessChance` already existed on every
    Smithing/tool/Kiln recipe - this was purely a display gap. Added a
    `.recipe-success-rate` line (e.g. "85% chance") to every recipe row
    across the Forge and Kiln panels, visually distinct from the cost/
    status line since "what this costs" and "how likely it is to work"
    are different questions. Explicitly NOT added to mining/woodcraft's
    F-key actions - confirmed those are fine as quick keybind actions
    without a displayed rate; "stations" specifically meant the
    panel-based Forge/Kiln UIs.

This closes out the full third-playtesting-round batch (a-k), every
item now either resolved or confirmed not needed.

- **Fourth playtesting round (2026-06-23) - three real fixes, plus new
  backlog items queued for later:**
  - **Resolved: colorStage jumped ahead of the actual Rekindle action.**
    `colorStage` was a pure function of `lifetimeFuel` alone, so the
    world's first color appeared the MOMENT `lifetimeFuel` crossed 500
    - the same moment the Rekindle option became available, but NOT
    the same moment the player actually clicked it. This contradicted
    the explicit lore framing ("crossing this threshold IS the
    rekindling event") - in the implementation, the two had quietly
    become independent. Fixed with `capColorStageBeforeFirstRekindle`
    (colorStages.ts): `colorStage` now stays pinned at 0 until
    `dwarfCount > 0` (the player has actually rekindled), regardless of
    how far `lifetimeFuel` has climbed past any threshold. Stages 2/3
    remain untouched once unlocked - pure functions of `lifetimeFuel`
    exactly as before, since only Stage 1 was ever meant to be gated on
    the act itself. Threaded `hasRekindledOnce` through both
    `stokeFireDirectly` and `tickHearth` (hearth.ts).
  - **Resolved: blocked-movement message gave zero indication of WHAT
    unlocks a locked zone.** Reported as "the dark halls... shows, no
    option to unlock or rebuild" - "the dark halls" turned out to be
    `render.ts`'s generic fallback label for any unzoned corridor tile,
    and the player was specifically at the Tunnel Entrance's boundary,
    correctly blocked (forgeTier < 2) but given only a flavor line with
    no real information. Added `describeUnlockCondition` (visibility.ts)
    - human-readable text per `UnlockCondition` type, looking up the
    real Forge upgrade name (e.g. "Bellows of the Deep") rather than a
    raw tier number. Threaded a new `blockedZone` field through
    `MoveResult` (movement.ts engine + game layer) so the blocked
    message can name the specific zone and its unlock condition,
    falling back to the old generic line only if zone info is somehow
    unavailable.
  - **Resolved: Smithing panel showed iron recipes before they were
    remotely reachable.** `SMITH_RECIPES`/tool rows rendered
    unconditionally for every recipe, disabled-but-visible if Smithing
    level wasn't met - so a level-1 dwarf saw a permanently grayed-out
    "Iron Ingot - Requires Smithing level 6" row. Per explicit
    direction: hidden entirely now (filtered out, not just disabled)
    until Smithing level actually qualifies - deliberately LEVEL-gated,
    not holdings-gated, since seeing the recipe appear the moment level
    is high enough (even with zero iron_ore held) is what should prompt
    the player to go look for iron, not the reverse. Same fix applied
    to both ingot rows and tool rows in smithingPanel.ts.
  - **New backlog item, NOT yet designed or built:** per explicit
    direction, unlocking iron mining should ALSO unlock some form of
    automation/tech-advance for the PREVIOUS tier's gathering (copper) -
    slow at first, improvable via a resource sink. This is a real new
    idea connecting to the long-standing "idle automatization
    mechanics" item already in the backlog (see the original
    DIRECTION_RESET.md absorption and the project's RuneScape-adjacent
    framing) - needs real design work before implementation: what the
    automation structure actually looks like, its base rate, what sink
    improves it, and how it relates to the also-still-unbuilt Building
    skill.
  - **Reference art provided, STILL not integrated (Smelter is built,
    art integration is the remaining gap):** four 3x3 workshop tileset
    images (Magma Forge, Metalsmith's Forge, Smelter, Wood Furnace) in
    the same Vettlingr-style aesthetic already in the game
    (`docs/reference-art/`). The Smelter itself is now fully built and
    playable (see "(3) The Smelter - RESOLVED" above), but renders as a
    placeholder (reused ore texture, tinted) in both ASCII and tileset
    mode - the reference images are 96x118px multi-cell room
    composites, not single 32x32 tiles matching `tilesetManifest.ts`'s
    convention, so using them needs real slicing/integration work
    (deciding how a multi-cell room concept maps onto the Smelter's
    single-cell `CellKind`) that hasn't happened yet.
  - **Fixed alongside the Smelter: Insight was never displayed
    anywhere.** A real, separate gap found while designing the
    Smelter's build cost - `insightBanked` was only ever used
    internally to gate whether an upgrade row showed, never shown as
    an actual number. A player could have 0 or 900 Insight and see
    identical UI until crossing whatever threshold made a row appear -
    directly undercutting "Progress Should Be Visible." Added a
    persistent "Insight: N" readout under a new "the mountain" sidebar
    section (main.ts/render.ts) - World-level, shown separately from
    "the dwarf"'s personal skill stats, since Insight survives
    rekindling and isn't a personal stat.

- **Insight only ever earnable from rekindling - RESOLVED, a real gap,
  not a balance tweak (2026-06-23):** reported directly during
  playtesting - "How do I gain insight? I'm sitting at 105 and it
  doesn't move up." Investigation found `LORE.md` always described
  Insight as earned "BOTH from Hearth-tending (slow trickle) AND from
  rekindling itself," but only the rekindling half was EVER actually
  implemented - the lore doc was right all along, the implementation
  had simply never caught up to it. Project owner's reframe went
  further than just "add the trickle back": "Insight is a synonym for
  experience, and we are using it as a resource... every single
  pickaxe swing, charcoal burning, ore smelting, rebuilding, repairing"
  should grant it - a universal experience-derived resource, not a
  Hearth-only one.
  - **Resolved**: every XP-granting action now also grants Insight (5%
    of the action's already-multiplied XP - `xpCurve.ts`'s
    `insightFromXp`), wired into all 8 real XP call sites (mining,
    woodcraft, Hearthkeeping's passive tick AND direct stoke, Smithing
    ingots/tools, the Kiln, the Smelter, Gemcutting). Deliberately
    fractional (never rounded per-action - most common actions grant
    under 20 XP, and 5% of that rounds to 0 for many of the cheapest,
    most frequent ones, which would have silently broken the feature
    for early-game play); only the UI display floors for presentation.
    Rekindling's lump-sum payout is unchanged and stacks on top, per
    explicit direction ("rekindling should still give a real lump-sum
    bonus on top of whatever was earned passively along the way").
  - **Side effect, also fixed**: Tinkering's XP previously did NOT get
    the `dwarfCount`/True-metal-perk multiplier every other skill's XP
    already got - a gap explicitly flagged in an earlier session's
    code comment as "not yet decided." Now extended to Tinkering too,
    for consistency, per explicit direction.
  - See MECHANICS.md's new Insight writeup (§5) and LORE.md's updated
    Rekindling section for the full account.

