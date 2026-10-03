# Progression and Automation Audit

This document records the economy targets behind the October 2026 balance pass.
It is a guardrail for future systems, not a promise that every number is final.

## Core progression rhythm

| Phase | Player experience | Intended duration | Main unlock |
| --- | --- | ---: | --- |
| Handwork | Learn mining, woodcraft, fire and smithing | 15–30 min | First persistent tools |
| First network | Repair rooms and connect one extractor to one processor | 30–90 min | Narag-Bund + Stockpile |
| Automation | Tune extraction, hauling and processing separately | 1–4 hr | Coal drill, harvesters, engines |
| Deep craft | Garden materials, deepstone and rare refinement | Multi-session | True-metals and advanced tools |
| Legacy | Choose a meaningful stopping point and rekindle | Multi-session | Remembrance and permanent legacies |

The interesting game begins when two systems depend on one another. Level gates
must teach handwork without postponing that network behind hundreds of identical
clicks.

## Findings corrected

- Mining 8 previously required 8,282 XP: more than 1,000 successful copper
  strikes without automation. The global curve is now `35 × level^1.8`, putting
  Mining 8 at 3,511 cumulative XP while preserving super-linear mastery.
- The separation of Remembrance from Insight removed the old prestige Insight
  windfall, but infrastructure prices still assumed it existed. Work now converts
  to Insight at 10% of earned XP; Remembrance remains prestige-only.
- Repeatable machine upgrades grew 38–42% in price for only 20–25% throughput.
  Their price growth now sits near 24–27%, so reinvestment compounds before it
  becomes ceremonial.
- Tier-1 Narag-Bund moved only 0.4 resources/s while serving every input and
  output lane. His base is now 1 resource/s and each tier creates a clear new
  logistics ceiling.
- Coal is infrastructure fuel and therefore intentionally out-produces metal.
  A tier-3 rank-9 coal drill now supplies roughly 1.4 coal/s with shaft speed.
- Higher-tier smelting automation now awards XP appropriate to the metal rather
  than treating deepstone as copper.
- Manual Garden actions now use the same dwarf, legacy and True-metal XP bonuses
  as every other craft, and grant Insight consistently.

## System contract

Every automatable chain should expose three independent investments:

1. **Extraction** — units created per second.
2. **Logistics** — units moved between local buffers and the Stockpile.
3. **Processing** — inputs consumed into useful outputs.

If one leg is idle, its local buffer must reveal why. Upgrading one leg should
move the bottleneck to another leg, creating the desired idle-game cycle rather
than merely shortening a hidden timer.

## Remaining deliberate gaps

- Brewing has a skill identity and ingredients but no production station yet.
- Deep Tree Grove tiers beyond Gemwood remain designed but not implemented.
- Tinkering is supplied passively by drills, but gem cutting itself remains a
  manual batch action until a later precision-machine tier exists.
- Rates need another playtest with a mature save. The tests protect broad pacing
  relationships; they do not replace observing where real players stop making
  meaningful choices.
