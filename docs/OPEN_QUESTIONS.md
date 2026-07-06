# The Hearth & The Deep — Open Questions

*Part of the design doc set — see DESIGN.md for the index.*
*Rewritten 2026-07-03 to reflect current actual state after sessions 1-N.*

---

## Current State Summary

463/463 tests passing. TSC clean. Build clean.

**Repo:** https://github.com/poa-id/dwarf-game.git  
**Local:** possorio / poa-id  
**Stack:** TypeScript + Vite + Vitest, canvas renderer, localStorage persistence

---

## What Is Built (complete systems)

### Core loop
- Mine (F) → smelt → purify → forge tools/ingots → feed hearth → rekindle
- 7 skills: Mining, Smithing, Hearthkeeping, Woodcraft, Tinkering, Herblore, Brewing (stub)
- Insight earned from all XP actions (5% of multiplied XP) + rekindle lump sum
- 3 material tiers: copper → iron → deepstone (+ true metals via smelter purification)
- Tool yield curve: bare hands 1×, copper 1.5×, iron 2.5×, deepstone 4× (dramatic)
- Rekindle multiplier: +5% yield per life (capped +50%)

### Map (80×50, hub-and-spoke)
- Central hall (hearth 6×6, mountain console 2×2, Narag-Bund south of hearth)
- Mine room (cols 6-18, rows 20-30): iron N, deepstone mid, copper SW, coal SE (all 3×3)
- Mine shaft (3×3 north wall, depth system)
- Garden room (cols 6-18, rows 35-45): 6 planters (3×2 grid, shifted down 1 row 2026-07-04), wood root, kiln (grown 3×3, moved +5 cols 2026-07-04)
- Forge room (cols 52-63, rows 9-19): forge 7×7 (grown from 6×6, 2026-07-04), smelter below
- Stockpile room (cols 49-63, rows 21-30): 6×7 chest (moved +4 cols 2026-07-04)
- Tinkering room (cols 52-63, rows 36-46): gemcutting 6×6 (recentered 2026-07-04), sawmill 2×2 (relocated here from the Garden Room, 2026-07-04)
- Sealed rooms: Trade Hall (S), Deep Foundry (NW), Archive (N) — full panel arcs

### Automation (idle layer)
- Copper/iron/deepstone/coal drills: mine from veins, coal-fueled, 4 upgrade tiers. Coal drill gated behind Mine Shaft depth 1.
- Smelting engines: per-ore-type auto-smelter (consumes stockpile → ingot buffer)
- Narag-Bund: hauls fuel to reserve every 10s; hauls coal to drills at Hearth tier 2
- Mountain Console: production dashboard (ore/min, drill status, hearth metrics, restoration)

### Sawmill (Tinkering Room, 2×2, near the Gemcutting station)
- Woodcraft-governed wood → wood_planks conversion (woodcraft.ts's own doc comment
  anticipated this: "processing raw wood into planks/lumber" was always meant to
  exist, just wasn't built until now)
- Build-gated like the Smelter (Insight + materials, not free like the Kiln -
  see sawmill.ts's doc comment for why), iron-free build cost
- wood_planks has NO consumers yet - new resource, sink comes later (see gap below)

### Garden
- 6 planters (slots), slot 0 always unlocked, slots 1-5 cost escalating materials+Insight
- Seeds consumable, 4 growth stages per plant, harvesting clears slot
- Plants: Stoneshroom (20min), Cave Fern (40min), Ironwood Sapling (2hr), Gemwood Tree (3hr)
- Herblore skill gates plant tiers; growthSpeedMultiplier hook ready for tool bonuses
- Planter costs exponential: 80 → 250 → 600 → 1500 → 4000 Insight
- Wood ladder so far: Cave-Root Wood (t1, gathered) → Ironwood (t2, Herblore 8) →
  Gemwood (t3, Herblore 15, bonus rough_amethyst on harvest). Tiers 4-6
  (Stonewood/Emberwood/Voidwood) designed but not built - see gap #12 below.

### Trade Hall
- Gems-only currency (cut quartz/garnet/amethyst)
- Exclusive outputs (cave fern spores, ancient seeds, hearthsap, ironwood, deepstone ingots, true metals)
- Merchant arrives every 10/5min by stage; always present at masterwork

### UI
- Left sidebar (220px): tabs Skills | Bag | ⛏ Production. Restoration/Insight/rate
  moved to the top bar (2026-07-03), not shown in the sidebar anymore.
- Skills tab: RuneScape-inspired 2-column icon grid below colorStage 2
  ("Hearthlight"), plain text-row list below it - gated by Perception Is
  Progression, same threshold that switches the world canvas to sprite art.
- Tools display (under Skills tab): same dual-mode split as the skills
  grid - plain "Pickaxe: Bare Hands" text below colorStage 2, tool-tier
  sprite icons (with an "empty slot" icon at tier 0) above it.
- Right sidebar (220px): Context panel (always visible, no tabs)
- Herblore/Brewing tiles hidden until first XP earned
- Batch buttons (×5/×10/×50) on kiln, smelter purify, smithing smelt rows
- Keyboard: WASD move, F gather, E repair/light/remove, R forge (repair only, one-shot), T place torch, Enter confirm
- Arrow Up/Down navigate context panel rows

### Mine shaft depth system
- Independent upgrade path: depth 0 (broken) → depth 1 (surface, coal drill unlocked) → depth 2 (starstone) → depth 3 (future)
- Sprite changes broken → lit at depth 1

### Room panels
- Deep Foundry: smelt success bonus (+5/12/20% by stage)
- Archive: Insight earned bonus (+20/25% by stage)
- Stockpile: 6×7 chest, ore organized display
- Trade Hall: full merchant/offers UI
- Mineshaft: depth upgrade panel

### Lighting
- All unlocked zones always fully lit (no LOS, no fog)
- Torches and fire structures add warm color overlay (but don't gate visibility)
- Player-placed torches: T to place (1 wood + 1 coal), E to light (1 copper ingot), E again to remove

---

## Active Gaps / Next Priorities

### High priority (affects playability)

1. **Brewing skill not implemented** — skill exists, XP never earned, no recipes. Ales from stoneshroom should give buffs. This completes the garden → kiln → brewing loop.

2. **Starstone vein** — shaft depth 2 promises a new vein appears. No starstone `RockNode`, no `MaterialId`, no vein placement in hubMap. Pure stub.

### Medium priority (balance / polish)

3. **Garden tools** — `growthSpeedMultiplier()` exists and is called from the loop but returns 1.0 always. Future: trowel/watering can tiers (Herblore-gated) reduce growth time. Design needed.

4. **Brewing system** — ales from fungi/herbs. Higher tier ales give bigger buffs. Brewing skill levels from brewing. The loop: garden → harvest shrooms → kiln or brewing station → ale → buff.

5. **Trade Hall narrative** — "merchant arrives" narrator line (one-time trigger). Not wired.

6. **Ore colors** — deepstone and coal look similar in the glyph renderer (both dark). Differentiate.

7. **Room visual unlocks** — Deep Foundry / Archive / Trade Hall rooms show rubble clearing correctly? Verify sealed room dynamic override in hubCellAt works for all four sealed rooms.

### Low priority / future content

8. **True Deepstone** — purification track for deepstone_ingot → true_deepstone. Smelter tier track TBD.

9. **Relics system** — named in LORE.md, nothing built. Major content category.

10. **Color stages 4/5** — Architecture Returns / The Mountain Remembers. Gates TBD (restoration score thresholds already in colorStages.ts as stubs).

11. **Wandering strangers** — model agreed, nothing built. Distinct from Narag-Bund.

12. **Deep Tree Grove (wood tiers 4-6)** — designed 2026-07-03, not built. Wood ladder
    continues past Gemwood (t3, sprite integrated) with Stonewood (t4, petrified fossil wood),
    Emberwood (t5, volcanic trees), Voidwood (t6) - accessed via a new tunnel
    system that mirrors the Mine Shaft's depth mechanic (dig deeper → new tier
    unlocks), rather than more Garden planter slots. Needs: map space for the
    tunnel (Garden Room is already fully packed - 6 planters + root tangle +
    kiln fill it), a depth-gate structure parallel to `SHAFT_DEPTHS`, and
    sprite work per tier (t3/Gemwood sprite integrated 2026-07-03; t4-6
    sprites not yet made). An "Ancient Grove" entrance sprite exists
    (uploaded 2026-07-03, not yet wired to anything) - queued for when this
    system gets built.

13. **Garden "periodic drop" harvest mode** — designed 2026-07-03, not built.
    Currently ALL planters work one way: plant → grow → harvest (clears slot,
    must replant). Direction from design review: trees should optionally support
    a second mode - leave a mature tree standing and it periodically drops
    material on its own (closer to Narag-Bund's timer-driven hauling than to
    the current harvest-and-replant model), as an alternative to harvesting
    it outright for a lump batch. Explicitly scoped to Gemwood and future
    trees only, NOT retrofitted onto Ironwood. Needs real design before
    building: what's the drop interval/amount vs. a harvest's lump sum (idle
    passive trickle vs. active batch is a real tradeoff to balance, not just
    an implementation detail), does a "planted, dropping" tree occupy the
    slot indefinitely (blocking replanting) or can slots hold multiple
    states, and how this interacts with the existing `GrowthStage`/`tickGarden`
    model (which currently stops calling anything once stage 3/mature is
    reached - see garden.ts's `tickGarden`).

14. **Deep Foundry + Archive actual content** — panels show unlock costs and bonuses, but what IS the deep foundry beyond a smelt bonus? Design open.

15. **Tinkering room / gemcutting tools** — gemcutting station is built. What does Tinkering level 10+ unlock? Future tool tiers? Equipment system?

16. **MECHANICS.md has no Drills/Automation section** — the whole drill/automation system (DrillDefinition, tiers, buffers, Mine Shaft depth gating) is documented only in this file's "What Is Built" summary and in code comments, never promoted to MECHANICS.md as settled fact. Noticed while wiring the coal drill + shaft speed bonus (2026-07-03); didn't fix in that pass since it's a standalone doc-writing task, not incidental to the code change.

17. **wood_planks has no consumers** — the Sawmill (built 2026-07-03) produces it, but nothing spends it yet. "Building materials" was the original ask; needs a design pass on what actually costs planks (room upgrades? a new construction system? retrofitted onto existing costs?) rather than guessing. Same "new resource, sink comes later" pattern as charcoal/ironwood/gemwood before their consumers existed - not a blocker, just needs a decision eventually.

18. **3 Forge addon stations reserved, not built** (2026-07-06) — Quenching Station, Sharpening Station, and Imbuing Station. Direct instruction: "progress locked for the time being, but reserve the space." Positions reserved in hubMap.ts (`FORGE_ADDON_NW`, `FORGE_ADDON_SW`, `FORGE_ADDON_SE` - all 3x3, flanking the Forge alongside the relocated Smelter, which took the 4th slot `FORGE_ADDON_NE`-equivalent). Sprites received and safely on hand (`quenching-tank.png`, `sharpening-station.png`, `imbuing.png`) but deliberately NOT processed/wired into the tileset yet, since there's no CellKind/mechanic to attach them to until this gets designed - no point creating dead asset files in the repo before that happens. What each station actually DOES (mechanically) is completely open - only the visual/spatial reservation exists right now.

---

## Recently Resolved (changelog)

- **Smelter relocated + reskinned, 4 Forge addon slots reserved** (2026-07-06) — direct instruction, layout sketched on a screenshot: move the Smelter into a dedicated 3×3 slot beside the Forge (grown from 2×2) with a new sprite, and reserve 3 more 3×3 slots flanking the Forge for future stations (Quenching, Sharpening, Imbuing - sprites received and on hand, not yet wired since "progress locked for the time being"). Smelter now sits in the Forge Room's east addon column (cols 61-63, the room's own free space - no bounds change needed); the west column needed one extra column beyond the room's own free space, solved by reusing the existing NE corridor's floor at col 51 rather than widening the room. Updated smelter's tileSpan, dynamic-override footprint, and `isNearSmelter`'s proximity buffer to match the new 3x3 size (same fix pattern as the Kiln/Sawmill/Gemcutting grow-outs from earlier sessions).

- **Coal drill showed the copper drill sprite** (2026-07-05) — reported directly. The drill-kind resolution had explicit checks for `iron_vein` and `deepstone` but silently fell through to `drill_copper` for anything else, including `coal_seam` - despite `drill_coal` being a fully registered, distinct CellKind with its own sprite that was simply never reached. One-line fix, 2 new regression tests.
- **11 sprites replaced with new high-resolution versions** (2026-07-05) — Console, Trade Post, Sawmill, Mine Shaft (lit/repaired state), Iron Drill, Iron Ore, Copper Drill, Copper Ore, Deepstone Ore, Coal Ore, Coal Drill, and the player character (Dwarf) sprite. This directly addresses the earlier "console/ore veins/mineshaft/sawmill look low-res" investigation - these are now sourced from proper high-detail art instead of the original 64×64 placeholders. Caught the same LANCZOS-resize alpha-fringing bug that hit gemwood/sawmill earlier this session on several of these too (mountain_console dropped to 10% fully-opaque, sawmill to 8.4%) - now baked the alpha-binarization fix directly into the processing pipeline itself so it can't be forgotten again on future sprite batches.
- **Narag-Bund grown 1×1 -> 4×4, repositioned north-and-east of the Hearth** (2026-07-05, new high-res sprite + direct instruction) — verified the new 4×4 footprint's every corner falls within the Central Hall's circular floor (radius 9 around MAP_CENTER) and stays clear of both the Hearth's own footprint and the NE corridor.
- **Floor zone system** (2026-07-05, new sprites + direct instruction: "floor2...for the mines and garden, floor4...for the main hearth zone and more developed zones like the forge and gemcutting rooms") — two new floor CellKinds, `rock_floor_mines` and `rock_floor_dev`, applied to their respective rooms (Mine Room + Garden Room get mines; Forge Room + Tinkering Room + the Central Hall/Hearth get developed). Corridors and not-yet-mentioned rooms (Stockpile, Trade Hall, sealed rooms) stay on the plain default floor. Found and fixed a real fill-ordering bug while wiring this: several corridors are carved AFTER their room, and where a corridor overlaps a room's own edge (e.g. the west corridor clipping 3 rows of the Mine Room), the corridor's plain floor was silently overwriting the room's zone-specific floor in that strip. Fixed by re-asserting all 4 room-zone fills again after every corridor runs.
- **South-facing wall variant** (2026-07-05, new sprite + direct instruction: "replace all south facing wall blocks, then I'll do the rest") — first rollout of directional walls. A wall cell is "south-facing" (gets the new `rock_wall_south` sprite) when the cell directly north of it is open floor - i.e. it's the wall a player standing in that room sees as the room's southern boundary. Other orientations (north/east/west-facing walls) intentionally still use the plain `rock_wall` sprite, exactly as scoped - more directional sprites to come. New CellKind added to `SOLID_CELL_KINDS` (still impassable, same as plain rock_wall).
- **Deferred, not yet wired**: the Ancient Grove entrance sprite (`grove.png`) - this is item 5 of 5 in the confirmed sprite-build sequence (Deep Tree Grove depth system), still not built yet, this is expected and not a bug. The new `gemstone-tree.png` upload was confirmed to be the same art already integrated as `planter_gemwood.png` earlier this session - skipped as a duplicate rather than reprocessed.
- **Floor zone system and south-facing wall variant reverted** (2026-07-05, same day) — per direct feedback ("Revert the floor and wall changes it looks super weird"). Both new CellKinds (`rock_floor_mines`/`rock_floor_dev`/`rock_wall_south`), their palette/tileset registrations, the room-fill zone assignments, the fill-ordering fix that went with them, and their sprite files are all removed. Everything else from the same commit (the 11 sprite replacements, the coal-drill sprite bug fix, the Narag-Bund resize/reposition) stayed - this was a surgical revert of just the two new systems, not the whole commit.

- **Trade Hall was functionally cleared but visually empty** (2026-07-05) — reported directly: "I already unlocked it [and] its empty." Root cause: `trade_post.png` had a complete tileset/palette registration (SOLID_CELL_KINDS, colors, glyph, manifest entry) but was never actually placed anywhere on the map - the room's floor cleared correctly, the merchant panel worked from anywhere in the room, but nothing was ever positioned there to look at. Added `TRADE_POST_POSITION` and wired the actual placement into the Trade Hall's room logic, appearing once the room reaches "cleared" stage or beyond, same gate the room's own floor-reveal already used.
- **Sawmill grown 2×2 -> 3×3, repositioned beside Gemcutting** (2026-07-05) — direct feedback: "It should be a 3x3 sprite, and that room is really weird." The Sawmill sitting alone in a far corner of the Tinkering Room while Gemcutting sat elsewhere read as disconnected. Moved the Sawmill to sit directly beside Gemcutting with a 1-column gap (matching the established "paired stations" convention used in the Garden Room), shifting Gemcutting +1 column to make room. Found and fixed `isNearGemcutting`'s proximity buffer while touching this code - it said "4×4 footprint" and used a `+4` buffer despite Gemcutting actually being 6×6 (confirmed against its own fill loop), meaning the far edge had zero interaction buffer at all. Same bug class as `isNearKiln`/`isNearSawmill` from the previous session's fixes - now audited every remaining `isNearX` function in proximity.ts for the same pattern; everything else checks out (either uses dynamic width/height from the footprint constant, like Forge and Hearth, or the hardcoded number already matched the real size).
- **Console/ore veins/mineshaft/sawmill sprites look lower-res than Hearth/Gemcutting** — investigated directly (not fixed - see below). Confirmed this is NOT the alpha/opacity issue from earlier (all four are already 100% fully-opaque). It's native resolution: these sprites are 64×64px source images (a deliberate choice made early in the project - see the `dba154d "New sprites at 64x64, cellSize 32"` commit), while Hearth/Gemcutting arrived later at 192×192px. Displaying a 64×64 source at a 3×3 footprint (96×96 display pixels) with the renderer's deliberate nearest-neighbor scaling (`imageSmoothingEnabled = false`) means a real 1.5× upscale, which reads as blocky next to Hearth/Gemcutting's exact-native-resolution 192×192 display. This became more visible specifically because the Console just grew from 2×2 (64×64 display - no scaling at all) to 3×3 this same week. No higher-resolution source exists anywhere in git history to recover from - these were always 64×64. Needs either new higher-res source art (matching Hearth/Gemcutting's level of detail) or accepting the current look for these specific structures; flagged for direct follow-up rather than guessed at.

- **Smelting ingots silently stopped working entirely once a Smelting Engine was unlocked** (2026-07-05) — reported directly: "I have the materials and I can't smelt, clicking nor pressing enter." Root cause: `renderSmeltingEnginePanel` used `container.innerHTML += x` to append its own content into the same contextual-panel container the Smithing panel had just rendered into (both render into the Forge's context - see render.ts). `container.innerHTML += x` is equivalent to `container.innerHTML = container.innerHTML + x`: it destroys **every** existing DOM node in the container and rebuilds fresh ones from the re-serialized HTML string. The Smithing rows still looked completely normal afterward (markup is identical), but the freshly-created nodes had no event listeners at all - listeners are runtime JS bindings, not something that survives an innerHTML round-trip. This silently broke clicking AND Enter (which just calls `.click()` on the highlighted node) on every row the Smithing panel rendered, but only once `isEngineUnlocked()` had something to show (requires `smelterBuilt`) - before that the function returns early with zero DOM writes, so the bug was invisible earlier in a playthrough. Fixed by switching all three `+=` calls to `insertAdjacentHTML("beforeend", ...)`, which appends without touching existing nodes. Searched the rest of the codebase for the same `innerHTML +=` pattern - this was the only occurrence. New test file `smeltingEnginePanel.test.ts` (3 tests) directly reproduces the scenario (a pre-existing row with a listener, then this function runs on the same container) rather than just testing the fix's own output in isolation.

- **No vertical scroll, ever + reset button tucked away** (2026-07-05) — explicit direction: "we can't have vertical scroll for that single button." Added `overflow: hidden` on both `html` and `body` (body alone doesn't fully suppress page-level scroll - the root scroller is determined by `html`) as a hard backstop, verified via Playwright measurements across viewport heights from 1080px down to 680px: zero scroll at every size now, vs. the old layout genuinely overflowing below ~770px. Reset button pulled out of the document flow entirely (`position: fixed`, bottom-right corner, low opacity until hover) so it can never contribute to page height regardless of what's above it - also just generally more appropriate for a destructive action to not be layout-prominent. Trimmed shell padding/gap and capped the narrator container's height (2.5em max, was an unbounded min-height) to shrink the real content height too, not just rely on the clip.
- **Narrator quotes made rarer and weightier** (2026-07-05) — explicit direction: "quotes should be very sparse or rare, have weight and aid the narrative." `mine_strike`/`wood_strike` throttle lowered 0.05 -> 0.02 (roughly 1-in-50 strikes, down from 1-in-20), `area_revealed` lowered 0.6 -> 0.2. Genuinely rare/milestone triggers (level_up, gem_found, torch_repaired, color stages, companion/console/forge/merchant one-shots) were left untouched - they're already sparse by nature (tied to real progress, not routine action spam), which is exactly the "weight" being preserved here.

- **Input scheme cleanup: F/Enter/contextual-menu clarified** (2026-07-05) — explicit direction: "Enter key is for the context menu, arrow keys navigate the menu, and reserve F for gathering actions." Two concrete fixes: (1) Forge repair moved from a standalone "press R" hotkey (previously the ONLY forge-related action with no contextual-panel presence at all) into a proper menu row - new `renderForgeRepairPanel`/`performForgeRepair` in smithingPanel.ts, same build-gate shape as the Smelter/Sawmill's "not built yet" state. The `R` key handler is gone entirely. (2) Fixed every remaining stale "press F" action-hint that was actually Enter/menu-driven: the Console's "awaken" hint, Hearth's stoke hint, Kiln's burn hint, Forge's smith hint, Smelter's purify hint, Gemcutting's cut hint, and the Stockpile's rubble-clearing hint - all previously told the player to press a key that does nothing there. This closes out gap #18 for good (previously just documented, not fixed). Also added a proper `forge_repaired` entry to the narrator's trigger system - forge repair used to call `showNarratorToast` directly with a hardcoded string, the only action in the game that bypassed the normal `narrate(trigger)` system, which became awkward once the repair flow moved into render.ts (no easy access to the narrator container there, unlike actions.ts).

- **Widespread "ghostly" sprite transparency, 31 files** (2026-07-04) — reported directly: "Console, and many other sprites look ghostly like they have transparency on, while the hearth and forge etc look very crisp." Audited every sliced tileset asset's alpha channel and found this was real and widespread: `mountain_console.png` was only 1.9% fully-opaque pixels (mean alpha 182/255), `sawmill.png` 11.9%, most planter stages under 12%, `trade_post.png` 19.6% (**this is almost certainly why the Trading Post seemed to not exist** - it was rendering at near-total transparency), vs. `hearth_4x4`/`forge_4x4`/`gemcutting_4x4`/`stockpile_chest` at 96%+ opaque. Fixed with an alpha-only binarization (threshold 40: alpha>=40 -> 255, else 0) across all 31 affected files - deliberately NOT touching RGB color values this time, unlike the earlier reverted "de-fringe" attempt that changed color and looked bad. Silhouette shape preserved (~98% of original visible pixels retained per spot-check on mountain_console.png).
- **Wall texture rendering endlessly instead of "one wall, then black"** (2026-07-04) — reported directly with a reference screenshot showing a lit corridor bordered by pure black, wanting that look everywhere: "what's inside the walls and not in a corridor or room to be pitch black, and only one layer of walls to be visible." Root cause: the static grid defaults EVERY cell to `rock_wall`, and only carved rooms/corridors get anything else - so all that uncarved rock, however far light or memory reached, rendered as an endless field of wall texture, not "one wall then void." Added a post-process pass in `buildHubContent()`: any `rock_wall` cell with no carved (non-wall) neighbor among its 8 surrounding cells becomes `void` (which renders as nothing - pure black), leaving exactly one visible wall layer bordering every room/corridor. Added `void` to `SOLID_CELL_KINDS` (it wasn't there before, since void previously only ever appeared *outside* the map's grid bounds where movement was already prevented separately - now that it appears *inside* the bounds too, as former deep-rock cells, it needs its own solidity or the mountain's interior would become walkable).
- **Gemcutting station walkthrough** (2026-07-04) — `gemcutting`/`gemcutting_unbuilt` were missing from `SOLID_CELL_KINDS` entirely. Added both, plus a new regression test (`palette.test.ts`, 23 tests) explicitly listing every structure kind that must be solid, so a future addition missing this doesn't ship silently walkthrough again.
- **Room repositioning per direction** (2026-07-04): Gemcutting moved to horizontally center in the Tinkering Room (col55 - the room is 12 wide, matches the requested "+1 column" exactly); vertical position is a judgment call (row38, i.e. centered) since the literal "2 rows up" instruction wasn't geometrically possible from the old flush-with-top-wall position - flagged directly for confirmation. Garden planters shifted down 1 row (was blocked by the Kiln's old position). Kiln moved +5 columns to align directly above the planter column it now sits over, resolving the path-blocking. Sawmill relocated from the Garden Room to the Tinkering Room (direction: "sawmill could be placed in gemcutting room if it doesn't have a place yet" - the Kiln's move would have collided with its old spot anyway). Stockpile chest moved +4 columns. Forge (and Smelter, which is positioned relative to it) grown 6×6 -> 7×7, the preferred of two offered options, which inherently keeps it flush with the Forge Room's north wall and gets it much closer to horizontally centered (was 2 cols left margin / 4 right - genuinely off-center before this). Found two more hardcoded-`6` spots that needed updating alongside the footprint constant itself (hubContent.ts's fill loop, tilesetManifest.ts's `forge`/`forge_broken` tileSpan) - the footprint constant alone wouldn't have actually changed anything on screen.
- **Sawmill likely explains its own "I don't see it" report** — sawmill.png was one of the 31 ghostly sprites (11.9% opaque) fixed above; combined with the collision-driven relocation, it should now actually be visible.
- **Ancient Grove entrance confirmed NOT yet built** — asked about directly ("You talked about the sawmill and the grove entrance, but I don't see them on the map"). Unlike the Sawmill, this one genuinely isn't implemented yet - it's item 5 of 5 in the confirmed sprite-build sequence (see the numbered list above), not a bug.

- **Batch button (×5/×10/×50) resource-multiplier bug, all stations** (2026-07-04) — reported directly: "×50 doesn't actually equal 50 clicks." Root cause found across Kiln, Smithing, Smelter, and Sawmill's batch loops in render.ts: each one checked whether the PREVIOUS attempt's random roll *succeeded* before continuing the loop, not whether another attempt was actually *affordable*. Since most actions have a real failure chance (~85% success is typical), a ×50 batch would silently stop after the first unlucky roll - typically within 6-7 attempts, not 50. Smelter's purify loop had an even worse version: it checked for the rare (~0.1-3%) True-metal BONUS drop, so it usually stopped after just ONE attempt. Fixed by checking affordability (materials held, via a new exported `canAffordX` helper per station) *before* each iteration instead. Also added the missing ×5/×10/×50 buttons to Gemcutting and the Hearth's stoke actions, which had none at all.
- **Double-fire bug on every batch button** (2026-07-04, found while fixing the above) — the row-click handler's selector (`[data-action]`) was broad enough to also match the batch buttons themselves (which reuse `data-action` for their own click handling), so clicking ×50 fired BOTH the row's default×1 handler AND the batch handler's ×50 - actually executing 51 attempts, or 6 for a ×5 click. Fixed by scoping the row handler to `.recipe-row[data-action]` across every affected panel (Kiln, Sawmill, Smelter, Gemcutting, Hearth).
- **Tool-forging affordability check ignored ironwood/gemwood entirely** (2026-07-04, found while fixing the above) — introduced when tool-tier wood costs were added: the UI's afford-check only ever looked at `wood: recipe.woodCost`, which is 0 for iron/deepstone tier tools (they use `woodAltId`/`woodAltCost` instead - see smithing.ts). This meant an Iron/Deepstone Pickaxe row could show as forgeable with zero ironwood/gemwood held, and clicking it would throw an uncaught exception. Fixed to check the correct material.
- **No level requirements on gem cutting at all** (2026-07-04) — reported directly: "I can cut tier 3 gems with lvl 5 tinkering." There was no Tinkering level gate on cutting whatsoever - any rough gem tier was cuttable from Tinkering 1. Added `cutGemRequiredLevel` (quartz 1, garnet 8, amethyst 15), matching Mining's own tier gap exactly since these gems are already tied 1:1 to the copper/iron/deepstone veins. General rule going forward per explicit direction: every tiered system should level-gate tiers above the first.
- **Deepstone mining yield spike at unlock** (2026-07-04) — reported directly: "one F click in the deepstone node mines like 12 ores" right at Mining 15. Deepstone was the only ore node with `baseYield: 2` (every other node is 1), which combined with the Deepstone Pickaxe's own 4x tool multiplier and any Hearth yield perk stacking compounded into a much higher per-strike yield than any easier tier - backwards from the intended rule ("new unlocks shouldn't be as fast as mining previous tiers"). Fixed to `baseYield: 1`, matching every other node.
- **Tree root / Kiln / Console sprite sizes** — tree root shrunk 3×3 → 2×2, Kiln grown 2×2 → 3×3 (now correctly the bigger of the two, per direction), Mountain Console grown 2×2 → 3×3. Sawmill repositioned to keep the Garden Room's layout consistent after the Kiln's grow-out. Found and fixed two related proximity-check bugs while verifying this: `isNearKiln`'s buffer math was still sized for the old 2×2 footprint (left the far edge with no interaction buffer at all), and `nearestWoodNode`'s was still sized for the old 3×3 (harmlessly over-generous, but inconsistent).
- **Structures "floating on a black square"** (2026-07-04) — reported directly with a screenshot. Root cause: TilesetRenderer filled the whole canvas with flat black once per frame, then drew each cell's content on top - for multi-tile structure sprites (which have an octagonal/diamond silhouette against a square canvas, with real alpha transparency in the corners), any pixel outside that silhouette revealed the flat black fill instead of floor, since the actual floor tile was never drawn underneath a cell a structure occupies. Fixed by adding a floor-compositing pre-pass: draw the base floor tile under every non-void, non-hidden cell before the main content pass, so a structure's transparent negative space now reveals real floor texture instead of black. **Not visually re-verified after the fix** - my own screenshot tooling had repeated display issues this session; verified at the code level (the technique is straightforward: floor first, content on top, standard alpha compositing) but worth a direct look in-browser.
- **"Remembered" (previously-seen, currently-unlit) areas too visible** (2026-07-04) — reported directly with a reference screenshot: wanted the mountain's interior to read as genuinely black outside current light, with only the wall visible at the edge of what's lit, "without messing with line of sight and stuff" (i.e. keep the underlying fog-of-war/exploration logic as-is, just render it darker). TilesetRenderer's `REMEMBERED_OPACITY` dropped from 0.45 (a legible dim-gray replay of the area) to 0.08 (near-black, keeps only the faintest ghost of a previously-seen structure's silhouette). **This exact value is a judgment call, not a spec'd number** - easy to tune further (single constant in TilesetRenderer.ts) if 0.08 isn't quite right. GridRenderer's (ASCII mode's) own REMEMBERED_OPACITY was left untouched - the complaint and reference screenshot were specifically about the sprite-rendered look.

- **Multi-tile sprite anchor bug** (2026-07-03) — reported as "sprites render out of position, then snap into place as the camera approaches." Root cause: the static grid sets every cell within a structure's footprint (e.g. all 36 cells of the 6×6 Hearth) to the same CellKind - correct for the ASCII renderer, but TilesetRenderer was assuming whatever cell it looked at WAS the sprite's top-left anchor. If the camera scrolled such that an interior cell entered the viewport before the true anchor did, the whole sprite got drawn at the wrong position. Fixed by walking backward via `getCell` (bounded by the sprite's own span) to find the true anchor regardless of which cell triggered the draw - extracted as `findSpriteAnchorOffset`, a pure function with its own test coverage (7 new tests) since TilesetRenderer itself needs a real canvas context to test directly. Confirmed working well by direct feedback.
- **Sprite dark-halo fix, attempted and reverted** (2026-07-03, same day) — see gap #19. The blanket "unpremultiply against black" correction across the whole tileset was reverted per direct feedback. The `rock_floor`/`torch_lit` sprite replacements from the same commit were reverted then reapplied on their own right after (plain crop+resize, no halo correction) - those two are staying; it's the broader automated pass that's off the table.

- **Mine shaft speed bonus** (2026-07-03) — `drillSpeedMultiplier(mineshaftDepth)` in drill.ts now returns 1.10 at depth 1+, passed into `tickDrill` from the game loop. Matches the +10% promised in SHAFT_DEPTHS' depth-1 unlock text.
- **Coal drill** (2026-07-03) — added to DRILL_DEFINITIONS, gated behind Mine Shaft depth 1 via new `requiresShaftDepth` field on DrillDefinition. drillPanel.ts shows the gate message before the smelter-built check when unmet.
- **Ironwood tool handles** (2026-07-03) — turned out to be half-done already (deepstone tier already required ironwood). Fixed the actual gap: iron-tier tools now require ironwood too (previously plain wood), and deepstone tier moved up to require the new Gemwood (see below) - tool tier now matches wood tier 1:1 (copper/cave-root, iron/ironwood, deepstone/gemwood).
- **Gemwood (wood tier 3)** (2026-07-03) — new material + `gemwood_tree` PLANT_DEFINITIONS entry, Herblore 15, grown from the previously-orphaned `ancient_seed_rare` (already sold in Trade Hall, had no plant definition until now - this also resolves the old "ancient seeds" gap). Yields gemwood + a small bonus rough_amethyst on harvest.
- **Gemwood tree sprite** (2026-07-03) — wired into the planter's mature stage. Required a small architecture change: `growthStageCellKind` and `PlantDefinition` now support a per-plant `matureCellKind` override (gemwood_tree sets one; ironwood_sapling doesn't, still shares the generic `planter_mature`), since gemwood's art is a full dramatic "shrine tree" scene rather than a plant-in-a-box like every other mature sprite - deliberate per design direction, not a mismatch to fix.

**5 more sprites received 2026-07-03, confirmed build order (not yet built):**
1. ~~Gemwood tree~~ (done, see above)
2. ~~Sawmill~~ (done, see below)
3. Kiln tier system + Hearth Infuser (hearthsap + coal → infused coal) + infused coal's drill-performance effect
4. Brewery + Brewing skill (recipes, ale buffs)
5. Ancient Grove entrance + Deep Tree Grove depth system (see gap #12 above)
- **Sawmill** (2026-07-03) — new Garden Room addon (2×2, immediately east of the Kiln along the same north-wall row - see hubMap.ts SAWMILL_POSITION for the free-space verification). Woodcraft-governed wood → wood_planks conversion, build-gated like the Smelter (Insight + materials) rather than free like the Kiln. New `sawmill.ts` engine module, `sawmillPanel.ts` UI, new `building` MaterialCategory (wood_planks is its first member - has no consumers yet, see gap #17). Sprite processed with the same border-flood-fill approach as the gemwood tree. Tests: 12 new (`sawmill.test.ts`).
- **Tool tier icons** (2026-07-03) — Pickaxe/Axe display under the Skills tab gets the same basic-text/icon dual mode as the skills grid, gated on the same colorStage threshold. New `toolIconManifest.ts` + `toolsIconPanel.ts`; icon swaps automatically as better tools get forged (indexed by ToolTier.tier, 0-3), with a dedicated "empty slot" sprite for Bare Hands rather than a blank gap.

---

## Session Workflow (for next Claude)

```
1. Clone repo from github.com/poa-id/dwarf-game.git
2. Read this file (OPEN_QUESTIONS.md)
3. Check DESIGN.md for architecture index
4. Ask Poa what to work on before building anything
5. npx tsc --noEmit && npx vitest run before starting
6. Commit + push before ending the session
```

**Key files:**
- `src/engine/`: garden.ts, mining.ts, drill.ts, smeltingEngine.ts, hearth.ts, rekindle.ts
- `src/render/`: hubContent.ts, palette.ts, tilesetManifest.ts
- `src/ui/`: all panel files
- `src/game/`: render.ts (main render loop), loop.ts (tick), proximity.ts, actions.ts

**Architecture rules:**
- `main.ts` stays under ~150 lines
- Engine layer = pure functions, fully tested
- `hubCellAt()` is the dynamic cell lookup — all structure overrides go here
- `PLANTER_POSITIONS` / `ORE_VEINS` / `MINE_SHAFT_POSITION` etc. exported from hubMap.ts as single source of truth
