/**
 * Smelting Engines — the forge-automation counterpart to the mining drill.
 *
 * Where the drill automates ore extraction, the Smelting Engine automates
 * ingot production. It consumes ore from the Stockpile and coal from the
 * fuel reserve, producing ingots.
 *
 * Design philosophy:
 * - One engine per ore type. Each is built, upgraded, and runs independently.
 * - Consumes from stockpileOre (not the player's bag) — so the idle chain
 *   becomes: drill → stockpile → smelting engine → player's inventory.
 * - Coal consumption mirrors the drill: the same fuel reserve that feeds
 *   the Hearth and drills also feeds the forge engines. Narag-Bund hauls
 *   coal to them at Hearth tier 2.
 * - Ingots flow straight to the player's inventory each tick, same as ore
 *   auto-draining to the stockpile - NOT held in a capped buffer awaiting
 *   manual "Collect" clicks (that was the design through 2026-07-05;
 *   removed 2026-07-06 as one of three concrete inconsistencies flagged
 *   directly: ore moved automatically, ingots didn't, and the buffer cap
 *   never scaled with the Turbine's speed multiplier, so a 3x-faster
 *   engine just stalled 3x more often waiting to be manually emptied).
 *   ingotBuffer/ingotBufferMax remain on SmeltingEngineState only for
 *   save-compatibility with old saves; nothing writes to them anymore.
 *
 * Unlock gates:
 *   Copper engine:    Forge tier 1 + Smelter built (you need the smelter
 *                     to understand the process before automating it)
 *   Iron engine:      Iron purifying unlocked + Smelter tier 1
 *   Deepstone engine: Deep Foundry cleared (the great furnace handles it)
 */

export interface SmeltingEngineDef {
  id: string;
  name: string;
  oreMaterialId: string;
  ingotMaterialId: string;
  orePerCycle: number;
  coalPerCycle: number;
  /** Build cost: what it costs to install in the forge */
  buildCost: Record<string, number>;
  tiers: SmeltingEngineTier[];
}

export interface SmeltingEngineTier {
  tier: number;
  name: string;
  cycleMs: number;     // time between cycles
  ingotsPerCycle: number;
  upgradeCost: Record<string, number>;
}

export const SMELTING_ENGINE_DEFINITIONS: SmeltingEngineDef[] = [
  {
    id: "copper_engine",
    name: "Copper Smelting Engine",
    oreMaterialId: "copper_ore",
    ingotMaterialId: "copper_ingot",
    orePerCycle: 3,       // matches manual smelt cost
    coalPerCycle: 1,
    buildCost: { copper_ingot: 30, iron_ingot: 5, wood_planks: 4 }, // 2026-07-06: was 20 raw wood - see drill.ts's copper_drill comment for the ratio
    tiers: [
      { tier: 1, name: "Slow Bellows",      cycleMs: 60_000, ingotsPerCycle: 1, upgradeCost: {} },
      { tier: 2, name: "Steady Bellows",    cycleMs: 40_000, ingotsPerCycle: 1, upgradeCost: { copper_ingot: 20 } },
      { tier: 3, name: "Driven Bellows",    cycleMs: 25_000, ingotsPerCycle: 1, upgradeCost: { copper_ingot: 40, iron_ingot: 5 } },
      { tier: 4, name: "Masterwork Forge",  cycleMs: 15_000, ingotsPerCycle: 2, upgradeCost: { iron_ingot: 20, true_copper: 2 } },
    ],
  },
  {
    id: "iron_engine",
    name: "Iron Smelting Engine",
    oreMaterialId: "iron_ore",
    ingotMaterialId: "iron_ingot",
    orePerCycle: 3,
    coalPerCycle: 2,
    buildCost: { iron_ingot: 20, copper_ingot: 10, wood_planks: 3 }, // 2026-07-06: was 15 raw wood
    tiers: [
      { tier: 1, name: "Cold Crucible",     cycleMs: 90_000, ingotsPerCycle: 1, upgradeCost: {} },
      { tier: 2, name: "Warm Crucible",     cycleMs: 60_000, ingotsPerCycle: 1, upgradeCost: { iron_ingot: 15 } },
      { tier: 3, name: "Hot Crucible",      cycleMs: 40_000, ingotsPerCycle: 1, upgradeCost: { iron_ingot: 30, true_iron: 1 } },
      { tier: 4, name: "True Furnace",      cycleMs: 25_000, ingotsPerCycle: 2, upgradeCost: { true_iron: 3, deepstone_ingot: 5 } },
    ],
  },
  {
    id: "deepstone_engine",
    name: "Deepstone Smelting Engine",
    oreMaterialId: "deepstone_ore",
    ingotMaterialId: "deepstone_ingot",
    orePerCycle: 4,
    coalPerCycle: 0,   // uses hearthsap instead
    buildCost: { deepstone_ingot: 10, iron_ingot: 20, ironwood: 5 },
    tiers: [
      { tier: 1, name: "Deep Crucible",     cycleMs: 120_000, ingotsPerCycle: 1, upgradeCost: {} },
      { tier: 2, name: "Heated Deep Forge", cycleMs:  80_000, ingotsPerCycle: 1, upgradeCost: { deepstone_ingot: 8 } },
      { tier: 3, name: "Grand Deep Forge",  cycleMs:  50_000, ingotsPerCycle: 2, upgradeCost: { deepstone_ingot: 15, true_iron: 2 } },
    ],
  },
];

export interface SmeltingEngineState {
  tier: number;            // 0 = not built, 1+ = built
  oreBuffer: number;       // pulled from stockpile each cycle
  ingotBuffer: number;     // output buffer
  coalBuffer: number;      // for copper/iron engines
  hearthsapBuffer: number; // for deepstone engine
  lastCycleAt: number;
  coalBufferMax: number;
  ingotBufferMax: number;
}

export const INGOT_BUFFER_DEFAULT = 20;
export const COAL_BUFFER_DEFAULT  = 20;

export function createFreshEngineState(): SmeltingEngineState {
  return {
    tier: 1,
    oreBuffer: 0,
    ingotBuffer: 0,
    coalBuffer: 0,
    hearthsapBuffer: 0,
    lastCycleAt: 0,
    coalBufferMax: COAL_BUFFER_DEFAULT,
    ingotBufferMax: INGOT_BUFFER_DEFAULT,
  };
}

export function engineDefById(id: string): SmeltingEngineDef | undefined {
  return SMELTING_ENGINE_DEFINITIONS.find((d) => d.id === id);
}

export function engineTierDef(def: SmeltingEngineDef, tier: number): SmeltingEngineTier {
  return def.tiers.find((t) => t.tier === tier) ?? def.tiers[0];
}

export interface EngineTickResult {
  engine: SmeltingEngineState;
  ingotsProduced: number;
  oreConsumed: number;
  ranCycle: boolean;
}

export function tickSmeltingEngine(
  engine: SmeltingEngineState,
  def: SmeltingEngineDef,
  now: number,
  stockpileOre: number,
  fuelAvailable: number,  // coal for copper/iron, hearthsap for deepstone
  speedMultiplier: number = 1
): EngineTickResult {
  if (engine.tier === 0) return { engine, ingotsProduced: 0, oreConsumed: 0, ranCycle: false };

  const tierDef = engineTierDef(def, engine.tier);
  // Turbine speed multiplier (2026-07-06) shrinks the effective cycle
  // time (>1 = faster) - deliberately NOT a bonus to ingotsPerCycle.
  // Speeding up the cycle itself means ore and fuel consumption scale
  // up right alongside ingot output, which is what actually creates
  // the intended "ore or fuel becomes the bottleneck" idle-game
  // dynamic (see turbine.ts's doc comment) - a flat ingots-per-cycle
  // bonus would produce more ingots for free from the same ore/fuel,
  // which is the opposite of that.
  const effectiveCycleMs = Math.max(1, Math.round(tierDef.cycleMs / speedMultiplier));
  const elapsed = now - engine.lastCycleAt;
  if (elapsed < effectiveCycleMs) return { engine, ingotsProduced: 0, oreConsumed: 0, ranCycle: false };

  const cycles = Math.floor(elapsed / effectiveCycleMs);
  let totalIngots = 0;
  let totalOre = 0;
  let ran = false;

  for (let i = 0; i < cycles; i++) {
    const oreNeeded = def.orePerCycle;
    const oreAvail = stockpileOre - totalOre;

    if (oreAvail < oreNeeded) break;
    if (fuelAvailable <= 0) break; // fuel check: loop.ts handles exact deduction

    totalOre    += oreNeeded;
    totalIngots += tierDef.ingotsPerCycle;
    ran = true;
  }

  const newEngine: SmeltingEngineState = ran
    ? { ...engine, lastCycleAt: engine.lastCycleAt + cycles * effectiveCycleMs }
    : engine;

  return { engine: newEngine, ingotsProduced: totalIngots, oreConsumed: totalOre, ranCycle: ran };
}
