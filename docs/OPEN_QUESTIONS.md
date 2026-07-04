# The Hearth & The Deep — Open Questions

*Part of the design doc set — see DESIGN.md for the index.*
*Rewritten 2026-07-03 to reflect current actual state after sessions 1-N.*

---

## Current State Summary

415/415 tests passing. TSC clean. Build clean.

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
- Garden room (cols 6-18, rows 35-45): 6 planters (3×2 grid), wood root, kiln, sawmill
- Forge room (cols 52-63, rows 9-19): forge 6×6, smelter below
- Stockpile room (cols 49-63, rows 21-30): 6×7 chest
- Tinkering room (cols 52-63, rows 36-46): gemcutting 6×6
- Sealed rooms: Trade Hall (S), Deep Foundry (NW), Archive (N) — full panel arcs

### Automation (idle layer)
- Copper/iron/deepstone/coal drills: mine from veins, coal-fueled, 4 upgrade tiers. Coal drill gated behind Mine Shaft depth 1.
- Smelting engines: per-ore-type auto-smelter (consumes stockpile → ingot buffer)
- Narag-Bund: hauls fuel to reserve every 10s; hauls coal to drills at Hearth tier 2
- Mountain Console: production dashboard (ore/min, drill status, hearth metrics, restoration)

### Sawmill (Garden Room, 2×2, east of the Kiln)
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

18. **Kiln/Smelter/Gemcutting action-hints say "press F" but the real confirm key is Enter** — F only does mining/wood-gathering (see main.ts's keydown handler); everything else (charcoal burn, purify, cut gem, and now saw planks) is confirmed via Enter on the highlighted contextual-panel row (panelNavigation.ts). The hint text for the three pre-existing stations is stale copy, probably left over from before the Space→Enter confirm-key change (see MECHANICS.md/memory: "Space key scroll issue... panel confirm moved to Enter"). Noticed while writing the Sawmill's own hint text (written correctly, "press Enter"); didn't fix the other three since it's a one-line-per-file copy fix unrelated to the Sawmill itself, but worth a quick pass.

---

## Recently Resolved (changelog)

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
