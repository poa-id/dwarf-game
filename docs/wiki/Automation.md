# Automation

The idle layer sitting on top of active gathering and crafting: drills that mine on their own, smelting engines that turn stockpiled ore into ingots, and a companion who hauls fuel without being asked.

## Narag-Bund

> **⚠ Spoiler:** this section names and explains a companion some players prefer to discover naturally through the Hearth's upgrade panel. If you'd rather meet him in-game first, skip to [Drills](#drills) below.

<details>
<summary>Reveal Narag-Bund</summary>

A coal-beetle hauling-beast, found and befriended in the dark of the mountain — not built, not player-named. He's befriended automatically as the effect of the Hearth's Tier-1 upgrade ("Friend of Burden," 250 Insight), not a separate taming mechanic.

Once befriended:
- He hauls **1 unit** of whichever fuel (coal or wood) you currently hold the *most* of, from your personal inventory into the Hearth's `fuelReserve`, every **10 seconds** of real time — including while the game is closed.
- He only hauls materials you've already discovered yourself — he shares your knowledge, not an outsider's omniscience.
- At Hearth Tier 2+, he also hauls coal to drills.
- He has no visible sprite on the map — a felt presence (fuel quietly arriving), not a seen one.

The Hearth panel shows a live status line once he's befriended: what he'll haul next, and a countdown to his next trip.

</details>

## Drills

One drill per ore vein. Building a drill for one metal requires ingots of the *next* tier — you need iron to build the tooling that automates copper extraction. Each drill runs a fixed cycle: draws coal from its own buffer, produces ore into its own buffer, and stops when either runs dry.

| Drill | Vein | Build cost | Coal / cycle | Gate |
|---|---|---|---|---|
| Copper Drill | Copper | 20 Copper Ingot, 10 Wood, 5 Iron Ingot | 1 | — |
| Iron Drill | Iron | 20 Iron Ingot, 10 Wood, 5 Deepstone Ingot | 2 | Deep Foundry restored |
| Coal Drill | Coal | 15 Iron Ingot, 10 Copper Ingot, 10 Wood | 1 | Mine Shaft depth 1 |

### Drill tiers (Copper Drill example — Iron and Coal drills mirror this shape)

| Tier | Name | Cycle time | Ore / cycle | Upgrade cost |
|---|---|---|---|---|
| 1 | Basic Drill | 30s | 1 | — (build cost) |
| 2 | Sharpened Bits | 20s | 1 | 10 Iron Ingot |
| 3 | Reinforced Housing | 15s | 2 | 20 Iron Ingot |
| 4 | Deep Core Drill | 10s | 3 | 30 Iron Ingot + 5 True Copper |

### Buffer upgrades

Separate from the cycle-speed tiers above — these raise how much coal/ore a drill can hold before it needs manual attention.

| Tier | Coal/Ore buffer | Cost (Copper Drill) | Cost (Iron Drill) |
|---|---|---|---|
| 1 | 40 / 40 | 10 Copper Ingot | 10 Iron Ingot |
| 2 | 80 / 80 | 20 Copper Ingot + 5 Iron Ingot | 20 Iron Ingot + 2 Deepstone Ingot |
| 3 | 160 / 160 | 15 Iron Ingot | 8 Deepstone Ingot |

Base buffer (before any upgrade) is 20 coal / 20 ore.

### Mine Shaft speed bonus

Once the [Mine Shaft](Mine-Shaft.md) reaches depth 1, all drill cycles run **10% faster**.

## Smelting Engines

Automated per-ore-type smelters that consume from the shared stockpile and produce an ingot buffer — the automation counterpart to manually smelting at the Forge.

## The Mountain Console

The **first** thing to unlock in the game — before the Forge, before mining. Walk to it and press F. Once awakened, it shows a production dashboard: ore/min, drill status, hearth metrics, and overall restoration progress.
