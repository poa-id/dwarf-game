# The Smelter & True-Metals

The Smelter is a Forge Room addon that purifies common ingots into rare **True-metals** — a permanent, account-wide upgrade currency, separate from Insight. It solves two problems at once: Smithing had no repeatable XP sink beyond one-off tool forges, and ingots piled up with nothing left to spend them on.

## Building it

| | Cost |
|---|---|
| Build | 1,200 Insight + 20 Copper Ingot + 15 Copper Ore + 30 Wood |

The material cost is deliberately iron-free — using iron here would create a circular dependency, since iron itself needs a forge tier the Smelter's own appeal depends on being reachable before.

## Purifying

Purifying **always succeeds** at consuming ingots and granting XP — there's no separate success/failure roll. The only randomness is whether that purification *also* yields a True-metal on top.

| | Ingots consumed | Coal cost | Base XP |
|---|---|---|---|
| Copper purification | 5 Copper Ingot | — | 12 |
| Iron purification | 5 Iron Ingot | — | 20 |

## True-metal drop chance

Deliberately conservative — True-metals should stay genuinely rare even at max tier, not become a steady trickle.

### Copper Smelter tiers

| Tier | Name | Insight cost | True Copper chance |
|---|---|---|---|
| Base (built, unupgraded) | — | — | 0.05% |
| 1 | Truer Flame | 300 | 0.2% |
| 2 | Patient Crucible | 700 | 0.5% |
| 3 | Mountain's Own Heat | 1,500 | 1% |

### Iron Smelter tiers

Iron purifying must be separately unlocked (500 Insight, once you're holding iron ingots), then has its own, harder tier track:

| Tier | Name | Insight cost | True Iron chance |
|---|---|---|---|
| Base (unlocked, unupgraded) | — | — | 0.02% |
| 1 | Hungry Bellows | 600 | 0.1% |
| 2 | Iron Patience | 1,400 | 0.3% |
| 3 | The Deep Refinery | 3,000 | 0.7% |

## What True-metals buy

The Smelter tier track above is entirely separate from the two things True-metals themselves are spent on:

- **The Mountain's XP perk tree** — a permanent, *global* XP multiplier (every skill, not just Smithing). 1/3/6 cumulative True-metal spend → +5%/+10%/+15%, stacking additively with the [rekindle multiplier](Rekindling-and-Insight.md), capped together at 3×.
- **The Hearth's yield perk tree** — see [Hearthkeeping](Hearthkeeping.md). A separate running total; you allocate each True-metal independently between the two trees.

## True Deepstone

A purification track for `deepstone_ingot → true_deepstone` is planned but its Smelter tier track hasn't been designed yet.
