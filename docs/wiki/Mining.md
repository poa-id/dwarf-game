# Mining

Active skill. Strike a vein, get ore, gain XP. Success chance and yield both scale with your best forged pickaxe.

## Veins

| Vein | Ore | Level req. | Base XP | Base yield | Base success | Notes |
|---|---|---|---|---|---|---|
| Copper Vein | Copper Ore | 1 | 8 | 1 | 90% | Infinite — never depletes |
| Iron Vein | Iron Ore | 8 | 30 | 1 | 75% | Infinite |
| Coal Seam | Coal | 8 | 6 | 1 | 85% | Infinite |
| Deepstone Seam | Deepstone Ore | 15 | 45 | 2 | 60% | Infinite |

All currently-placed veins are **infinite** by design — the mountain always gives you *something* back for the effort, even at a slow pace. Depletion exists as a mechanism in the code but nothing uses it yet.

## Pickaxe tiers

| Tier | Pickaxe | Success bonus | Yield multiplier |
|---|---|---|---|
| 0 | Bare Hands | +0% | 1.0× |
| 1 | Copper Pickaxe | +10% | 1.5× |
| 2 | Iron Pickaxe | +20% | 2.5× |
| 3 | Deepstone Pickaxe | +30% | 4.0× |

Tools are forged at the [Forge](Smithing.md) and are **World-persistent** — once forged, every future dwarf (even after rekindling) picks the same pickaxe back up.

## Gem drops

Some strikes have a small independent chance to also drop a rough gem, on top of the ore itself. One gem type per vein tier — rarer veins drop their own gem *less* often too.

| Vein | Gem | Base drop chance |
|---|---|---|
| Copper Vein | Rough Quartz | 2% |
| Iron Vein | Rough Garnet | 1% |
| Deepstone Seam | Rough Amethyst | 0.3% |
| Coal Seam | — | (coal doesn't drop gems) |

Gems are cut at the [Gemcutting station](Tinkering.md) for Tinkering.

## Where to find veins

Copper and the root tangle sit in the Hearth Hall from the start. Iron, coal, and deepstone are in **The Mine** room — accessible once the [Mine Shaft](Mine-Shaft.md) is repaired.
