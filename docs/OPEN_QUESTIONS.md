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
  - **Real gap found, NOT yet fixed:** `rekindle()` is fully implemented
    and tested in engine/rekindle.ts, but nothing in main.ts, actions.ts,
    or any UI panel ever calls it. There is currently no button, keybind,
    or other player-facing way to trigger a rekindle. This is the
    single biggest remaining hole in the vertical slice - needs a
    decision on where the affordance lives (Hearth panel is the obvious
    candidate) and what UX gates/confirms such a permanent, deliberate
    action.
  - **"Restore first room" has no real target yet:** only the Forge has
    any state at all, and it's binary (broken/repaired), not the
    Ruined/Cleared/Restored/Masterwork model from §14. No second room
    (Archive, Great Hall, etc.) exists anywhere in the renderer. This is
    exactly the room-state framework work already queued as the next
    task after this audit.
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
- **Woodcraft has no narrator voice yet:** `handleWoodGather` deliberately
  narrates nothing for routine gathers (Mining's "the pick finds rock"
  lines would be wrong for cutting wood) - needs its own line pool once
  Woodcraft's narrative identity is decided.
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

