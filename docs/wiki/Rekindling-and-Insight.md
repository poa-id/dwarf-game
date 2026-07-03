# Rekindling & Insight

## Rekindling

The current dwarf can feed himself to the Hearth. His spirit rekindles in a new body — dwarves share kinship, made of the same original material, but are individual souls. This is the game's prestige/reset mechanic, framed as myth rather than "start over."

| What resets | What persists |
|---|---|
| Skill levels & XP | The Forge, its tier, and every tool ever forged |
| Held inventory | Mine Shaft depth, Hearth state |
| Current position | Every torch ever lit, every cell ever explored |
| — | Room restoration stages, vein depletion state, lore |

A new dwarf always wakes at the Hearth, regardless of where the last one died. Re-grinding is meant to be **faster, not free** — gear and forge tier persist and reduce the grind, but skill levels genuinely reset and must be re-earned.

> **⚠ Spoiler:** the game deliberately gives no warning before your first rekindle becomes available — no counter, no narrator foreshadowing. The option simply appears in the Hearth panel once you've fed it enough, and it's a one-way, confirmed action.

### Rekindling's rewards

- **A lump-sum Insight payout**, scaled by your total skill levels at the moment of rekindling (`5 × total levels`).
- **A diminishing-returns penalty** if you rekindle again too soon: the payout scales by how much the Hearth's lifetime fuel has grown *since* your last rekindle, from 0% (no growth) up to 100% (a full threshold's worth of growth). This stops rekindling from being spammable for marginal gains.
- **A permanent per-dwarf XP-rate bonus** — "the Mountain has learned." Each prior dwarf adds +15% to all future skill XP gain, capped at 3× (after roughly 13 rekindles). This stacks additively with the Smelter's True-metal XP perk, both capped together at the same 3× ceiling.

The very first rekindling also triggers the mountain's first Color Stage — see [Color Stages](Color-Stages.md).

## Insight

Insight is the game's primary spendable currency — a synonym for experience. It's earned two ways:

1. **Per-action trickle** — every XP-granting action, across every skill, also grants Insight equal to 5% of that action's already-multiplied XP. Deliberately broad: Mining, Smithing, the Kiln, the Smelter, Gemcutting, all contribute — not only Hearthkeeping.
2. **Rekindling's lump sum** — see above. This stacks on top of whatever was earned passively along the way.

Insight is fractional under the hood (never rounded per-action) — only the displayed number rounds down, so it never shows more than is actually spendable.

### What Insight buys

- Forge tier upgrades (beyond the initial materials-only repair)
- Hearth tier upgrades and its yield-perk tree
- The Smelter (build cost + its own tier track)
- The Gemcutting station (build cost + its own tier track)
- Room restoration stages (Stockpile, Trade Hall, Deep Foundry, Archive)
- Garden planter slot unlocks
- Mine Shaft depth upgrades
