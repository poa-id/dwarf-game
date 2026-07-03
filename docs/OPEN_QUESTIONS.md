# The Hearth & The Deep — Open Questions

*Part of the design doc set — see DESIGN.md for the index.*
*Rewritten 2026-07-03 to reflect current actual state after sessions 1-N.*

---

## Current State Summary

385/385 tests passing. TSC clean. Build clean.

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
- Garden room (cols 6-18, rows 35-45): 6 planters (3×2 grid), wood root, kiln
- Forge room (cols 52-63, rows 9-19): forge 6×6, smelter below
- Stockpile room (cols 49-63, rows 21-30): 6×7 chest
- Tinkering room (cols 52-63, rows 36-46): gemcutting 6×6
- Sealed rooms: Trade Hall (S), Deep Foundry (NW), Archive (N) — full panel arcs

### Automation (idle layer)
- Copper/iron/deepstone/coal drills: mine from veins, coal-fueled, 4 upgrade tiers. Coal drill gated behind Mine Shaft depth 1.
- Smelting engines: per-ore-type auto-smelter (consumes stockpile → ingot buffer)
- Narag-Bund: hauls fuel to reserve every 10s; hauls coal to drills at Hearth tier 2
- Mountain Console: production dashboard (ore/min, drill status, hearth metrics, restoration)

### Garden
- 6 planters (slots), slot 0 always unlocked, slots 1-5 cost escalating materials+Insight
- Seeds consumable, 4 growth stages per plant, harvesting clears slot
- Plants: Stoneshroom (20min), Cave Fern (40min), Ironwood Sapling (2hr)
- Herblore skill gates plant tiers; growthSpeedMultiplier hook ready for tool bonuses
- Planter costs exponential: 80 → 250 → 600 → 1500 → 4000 Insight

### Trade Hall
- Gems-only currency (cut quartz/garnet/amethyst)
- Exclusive outputs (cave fern spores, ancient seeds, hearthsap, ironwood, deepstone ingots, true metals)
- Merchant arrives every 10/5min by stage; always present at masterwork

### UI
- Left sidebar: always-visible mountain stats (Restoration + Insight + rate), tabs: Skills | Bag | ⛏ Production
- Skills tab: RuneScape-inspired 2-column icon grid (framed badge art + level number overlay + XP bar per skill), not the old text-row list
- Right sidebar: Context panel (always visible, no tabs)
- Herblore/Brewing tiles hidden until first XP earned
- Batch buttons (×5/×10/×50) on kiln, smelter purify, smithing smelt rows
- Keyboard: WASD move, F gather, E repair/light/remove, R forge, T place torch, Enter confirm
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

2. **Ironwood tool handles** — higher tier tools should require ironwood handles, not just metal ingots. The design says "higher tier tools require higher tier woods." TOOL_RECIPES in smithing.ts need ironwood added as a cost for iron/deepstone tier tools.

3. **Starstone vein** — shaft depth 2 promises a new vein appears. No starstone `RockNode`, no `MaterialId`, no vein placement in hubMap. Pure stub.

### Medium priority (balance / polish)

4. **Garden tools** — `growthSpeedMultiplier()` exists and is called from the loop but returns 1.0 always. Future: trowel/watering can tiers (Herblore-gated) reduce growth time. Design needed.

5. **Brewing system** — ales from fungi/herbs. Higher tier ales give bigger buffs. Brewing skill levels from brewing. The loop: garden → harvest shrooms → kiln or brewing station → ale → buff.

6. **Trade Hall narrative** — "merchant arrives" narrator line (one-time trigger). Not wired.

7. **Ore colors** — deepstone and coal look similar in the glyph renderer (both dark). Differentiate.

8. **Room visual unlocks** — Deep Foundry / Archive / Trade Hall rooms show rubble clearing correctly? Verify sealed room dynamic override in hubCellAt works for all four sealed rooms.

### Low priority / future content

9. **True Deepstone** — purification track for deepstone_ingot → true_deepstone. Smelter tier track TBD.

10. **Relics system** — named in LORE.md, nothing built. Major content category.

11. **Color stages 4/5** — Architecture Returns / The Mountain Remembers. Gates TBD (restoration score thresholds already in colorStages.ts as stubs).

12. **Wandering strangers** — model agreed, nothing built. Distinct from Narag-Bund.

13. **Ancient seeds / heartwood sapling** — trade hall sells them, but `ancient_seed` and `ancient_seed_rare` have no plant definition in garden.ts PLANT_DEFINITIONS.

14. **Deep Foundry + Archive actual content** — panels show unlock costs and bonuses, but what IS the deep foundry beyond a smelt bonus? Design open.

15. **Tinkering room / gemcutting tools** — gemcutting station is built. What does Tinkering level 10+ unlock? Future tool tiers? Equipment system?

16. **MECHANICS.md has no Drills/Automation section** — the whole drill/automation system (DrillDefinition, tiers, buffers, Mine Shaft depth gating) is documented only in this file's "What Is Built" summary and in code comments, never promoted to MECHANICS.md as settled fact. Noticed while wiring the coal drill + shaft speed bonus (2026-07-03); didn't fix in that pass since it's a standalone doc-writing task, not incidental to the code change.

---

## Recently Resolved (changelog)

- **Mine shaft speed bonus** (2026-07-03) — `drillSpeedMultiplier(mineshaftDepth)` in drill.ts now returns 1.10 at depth 1+, passed into `tickDrill` from the game loop. Matches the +10% promised in SHAFT_DEPTHS' depth-1 unlock text.
- **Coal drill** (2026-07-03) — added to DRILL_DEFINITIONS, gated behind Mine Shaft depth 1 via new `requiresShaftDepth` field on DrillDefinition. drillPanel.ts shows the gate message before the smelter-built check when unmet.

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
