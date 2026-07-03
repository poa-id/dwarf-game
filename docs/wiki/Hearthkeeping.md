# Hearthkeeping & The Hearth

Hearthkeeping is the game's idle skill — it ticks on real elapsed time, including while the game is closed (capped at 24h of offline catch-up). It also has a real active component: burning charcoal at the Kiln.

## Feeding the Hearth

There are two ways to get fuel into the Hearth:

- **Stoke directly** — burns material from your personal inventory immediately, instant progress.
- **Bank in the reserve** — moves material into the Hearth's own `fuelReserve`, a stockpile separate from your personal inventory, saved for later.

Once auto-tending is unlocked (see upgrades below), the Hearth passively draws *only* from the reserve, burning the highest-heat fuel first (coal before wood). It never touches your personal inventory on its own — **the Hearth cannot tend itself out of nothing.**

The Hearth burns both coal and wood, weighted by heat value — unlike the Forge, it has no hard per-recipe minimum it refuses to compromise on.

## The Charcoal Kiln

Always usable, no broken/repaired state. Converts wood into charcoal — the earliest fuel source before real coal is reachable.

| | Level req. | Wood cost | Yield | Base XP | Base success |
|---|---|---|---|---|---|
| Burn Charcoal | 1 | 4 | 1 Charcoal | 8 | 85% |

At Hearthkeeping 8, the Kiln also renders **Hearthsap** from stoneshrooms — the only fuel hot enough to smelt Deepstone.

| | Level req. | Shroom cost | Yield | Base XP | Base success |
|---|---|---|---|---|---|
| Render Hearthsap | 8 | 6 Stoneshroom | 1 Hearthsap | 25 | 75% |

## Hearth upgrades

> **⚠ Spoiler:** the first upgrade's name and effect are hidden below. In-game, this row doesn't render at all — not even grayed out — until you've actually banked enough Insight to afford it. Reaching that amount *is* the discovery moment.

<details>
<summary>Reveal Hearth upgrade tiers</summary>

| Tier | Name | Insight cost | Effect |
|---|---|---|---|
| 1 | Friend of Burden | 250 | Unlocks passive auto-tending, and befriends a companion who helps haul fuel — see [Automation](Automation.md) |
| 2 | Deepened Hearth | 400 | The hearth burns fuel more efficiently |

Before Tier 1, the Hearth does *nothing* passively — manual stoking is the whole mechanic.
</details>

## The Hearth's yield perk tree

Spent with **True-metals** (from the [Smelter](Smelter-and-True-Metals.md)) — a permanent, global bonus to how much you get per action, any skill. Separate currency-allocation from the Smelter's own XP perk tree; both trees spend the same True-metals but track their spend independently.

| Tier | Cumulative True-metal spend | Yield bonus |
|---|---|---|
| 1 | 1 | +5% |
| 2 | 3 | +10% |
| 3 | 6 | +15% |

Capped at the same overall 3× ceiling as every other multiplier in the game.

## Rekindling

See the dedicated [Rekindling & Insight](Rekindling-and-Insight.md) page.

> **⚠ Spoiler:** the exact fuel threshold that unlocks your first rekindle is intentionally not shown anywhere in the game's UI — no counter, no warning. The option to rekindle simply appears in the Hearth panel once you've reached it.
