# Herblore & The Garden

Herblore is an idle-adjacent skill: planting a crop grants XP immediately, then the plant grows on its own real-time timer through four visual stages (empty → sprout → growing → mature), whether or not you're online.

The Garden room has six planter slots. **Slot 0 is always unlocked** as part of restoring the room; the rest cost escalating Insight, materials, and Herblore level.

## Planter unlock costs

| Slot | Insight | Materials | Herblore req. |
|---|---|---|---|
| 0 | — | — | — (always unlocked) |
| 1 | 80 | 20 Copper Ingot, 5 Iron Ingot, 30 Wood | 3 |
| 2 | 250 | 30 Iron Ingot, 50 Wood, 5 Hearthsap | 6 |
| 3 | 600 | 60 Iron Ingot, 10 Deepstone Ingot, 15 Ironwood | 10 |
| 4 | 1,500 | 25 Deepstone Ingot, 30 Ironwood, 3 True Iron | 15 |
| 5 | 4,000 | 50 Deepstone Ingot, 60 Ironwood, 8 True Iron, 4 True Copper | 20 |

## What you can grow

| Plant | Category | Herblore req. | Grow time (base) | Harvest | Secondary harvest |
|---|---|---|---|---|---|
| Stoneshroom | Shroom | 1 | 20 min | 2 Stoneshroom | — |
| Cave Fern | Fern | 1 | 40 min | 1 Hearthsap | — |
| Ironwood Sapling | Tree | 8 | 2 hr | 3 Ironwood | 1 Cave Fern Spore |
| Gemwood Tree | Tree | 15 | 3 hr | 3 Gemwood | 1 Rough Amethyst |

Harvesting clears the slot — there's no auto-replant. Seeds are consumed on planting.

Ironwood and Gemwood feed directly into higher tool tiers — see [Smithing](Smithing.md) and [Woodcraft](Woodcraft.md) for the wood ladder.

## Growth speed

There's a `growthSpeedMultiplier` hook wired into the growth tick, but it currently always returns 1.0 — no tools or bonuses affect grow time yet. The slowness is intentional; future planned sources (garden tools, kiln proximity, Herblore level itself) are designed but not built.

## What's not built yet

- **Deep Tree Grove** — wood tiers 4–6 (Stonewood, Emberwood, Voidwood), accessed via a new tunnel/depth system mirroring the Mine Shaft, not the Garden's planter slots.
- **Periodic-drop harvest mode** — an alternative to harvest-and-replant where a mature tree periodically drops material on its own, scoped to Gemwood and future trees only.
