# Smithing & The Forge

Active skill. The Forge Room itself is always walkable — only the forge object inside starts broken.

## Repairing the Forge

| | Cost |
|---|---|
| Tier 0 → 1 (repair) | 15 Wood + 10 Copper Ore |

This is a **materials-only repair**, not an Insight purchase — deliberately, so a fresh save isn't gated behind a currency you have no way to earn yet.

## Forge upgrades

Once the forge is working, further tiers are Insight-funded upgrades, not repairs:

| Tier | Name | Insight cost |
|---|---|---|
| 2 | Bellows of the Deep | 250 |
| 3 | Heartfire-Tempered Anvil | 1,000 |

## Smelting: ore → ingots

Ore and fuel are both consumed **even on a failed attempt** — smithing carries real risk, not just a yield penalty. A fuel must meet the recipe's minimum heat or the attempt can't be made at all, regardless of how much of it you're carrying.

| Ingot | Level req. | Ore cost | Accepted fuel | Fuel cost | Min. heat | Base XP | Base success |
|---|---|---|---|---|---|---|---|
| Copper Ingot | 1 | 2 Copper Ore | Coal or Charcoal | 1 | 5 | 10 | 85% |
| Iron Ingot | 6 | 3 Iron Ore | Coal | 2 | 10 | 22 | 70% |
| Deepstone Ingot | 18 | 4 Deepstone Ore | Hearthsap | 1 | 18 | 60 | — |

Charcoal (heat 7) is hot enough for copper but **not** iron (needs heat 10) — it's a bootstrap fuel, not a permanent substitute for real coal.

## Forging tools

Tools are real crafted items — not an automatic side-effect of forge tier. Each `ToolSlot` (pickaxe, axe) holds exactly one active tier; forging a better one automatically supersedes the old, no separate equip step. Tiers must be forged in order.

Tools are **World-persistent**: once forged, they survive every future rekindling. The next dwarf picks the same pickaxe back up.

| Tool | Slot | Tier | Level req. | Ingot cost | Wood cost | Fuel | Min. heat | Base XP | Base success |
|---|---|---|---|---|---|---|---|---|---|
| Copper Pickaxe | pickaxe | 1 | 1 | 2 Copper Ingot | 3 Cave-Root Wood | Coal/Charcoal (1) | 5 | 15 | 75% |
| Copper Axe | axe | 1 | 1 | 2 Copper Ingot | 3 Cave-Root Wood | Coal/Charcoal (1) | 5 | 15 | 75% |
| Iron Pickaxe | pickaxe | 2 | 6 | 3 Iron Ingot | 3 Ironwood | Coal (2) | 10 | 30 | 60% |
| Iron Axe | axe | 2 | 6 | 3 Iron Ingot | 3 Ironwood | Coal (2) | 10 | 30 | 60% |
| Deepstone Pickaxe | pickaxe | 3 | 14 | 4 Deepstone Ingot | 3 Gemwood | Hearthsap (1) | 18 | 80 | 65% |
| Deepstone Axe | axe | 3 | 14 | 4 Deepstone Ingot | 3 Gemwood | Hearthsap (1) | 18 | 80 | 65% |

Notice the wood requirement climbs alongside the tool tier: copper tools use plain Cave-Root Wood, iron tools need Ironwood, deepstone tools need Gemwood. Wood tier matches tool tier 1:1.

## Related

- [The Smelter & True-Metals](Smelter-and-True-Metals.md) — purifying ingots further, once built
- [Materials](Materials.md) — full material reference
