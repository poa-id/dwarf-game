# Getting Started

## Controls

| Key | Action |
|---|---|
| **WASD** | Move |
| **F** | Gather / interact (mine, chop, awaken the console) |
| **E** | Repair, light, or remove a torch; interact with a room |
| **R** | Repair the Forge (one-shot, only while it's broken) |
| **T** | Place a torch on a wall |
| **Enter** | Confirm in a context panel |
| **↑ / ↓** | Navigate rows in the open context panel |

Movement is grid-based. Walk up to something interactive (a vein, the Forge, the Hearth, a room entrance) and a **context panel** opens on the right side of the screen — that panel is always in the same place, and only shows options relevant to what you're standing near.

## The first hour

1. **Wake beside the Hearth.** It's barely an ember. The mountain around you is 2-bit gray — shape only, no color yet.
2. **Awaken the Mountain Console** (F) — the very first thing to do. This unlocks the production dashboard.
3. **Gather copper ore and wood.** Both starter nodes (the copper vein and the root tangle in the Hearth Hall) are infinite — you can never permanently run out of the basics.
4. **Repair the Forge** (R) — costs 15 Wood + 10 Copper Ore. The Forge Room is always walkable; only the forge itself starts broken.
5. **Burn charcoal at the Kiln** — you'll need fuel before you have real coal. The Kiln converts wood into charcoal for free (well, for wood).
6. **Smelt Copper Ingots**, then **forge a Copper Pickaxe and Axe** — this is the moment gathering stops being bare-handed.
7. **Feed the Hearth.** Stoke it directly, or bank fuel in its reserve for later. Its `lifetimeFuel` total (never shown directly) is what drives world color and, eventually, your first rekindling.
8. **Repair torches** along the corridors as you find them (E, costs copper ingots) — permanent light, once lit.

## What's *not* explained up front

Some upgrades and one companion are intentionally invisible until you can actually afford or reach them — see the ⚠ Spoiler notes on the [Hearthkeeping](Hearthkeeping.md) page if you want to know what to expect rather than discover it.

## The core loop, once established

```
Mine → Smelt → Forge tools/repair torches → Feed the Hearth → Rekindle → return stronger
```

Rekindling resets your current dwarf's skill levels and inventory, but the world — the Forge, every tool ever forged, every torch ever lit, the map you've explored — stays exactly as you left it. A new dwarf just has to re-earn his own skill.
