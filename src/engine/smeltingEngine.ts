/**
 * Smelting Engines — the forge-automation counterpart to the mining drill.
 *
 * Where the drill automates ore extraction, the Smelting Engine automates
 * ingot production. It consumes ore from the Stockpile and coal from the
 * fuel reserve, producing ingots.
 *
 * Design philosophy:
 * - One engine per ore type. Each is built, upgraded, and runs independently.
 * - Narag-Bund fills local ore/fuel buffers from the Stockpile and removes
 *   finished ingots through the same finite logistics budget.
 * - Coal consumption mirrors the drill: the same fuel reserve that feeds
 *   the Hearth and drills also feeds the forge engines. Narag-Bund hauls
 *   coal to them at Hearth tier 2.
 * - Finished ingots wait in a capped output buffer. A faster furnace can
 *   therefore expose weak hauling or insufficient Stockpile capacity.
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
  /** Non-coal engines declare their real fuel explicitly. */
  fuelMaterialId?: string;
  fuelPerCycle?: number;
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
      { tier: 1, name: "Slow Bellows",      cycleMs: 40_000, ingotsPerCycle: 1, upgradeCost: {} },
      { tier: 2, name: "Steady Bellows",    cycleMs: 25_000, ingotsPerCycle: 1, upgradeCost: { copper_ingot: 20 } },
      { tier: 3, name: "Driven Bellows",    cycleMs: 15_000, ingotsPerCycle: 1, upgradeCost: { copper_ingot: 40, iron_ingot: 5 } },
      { tier: 4, name: "Masterwork Forge",  cycleMs: 10_000, ingotsPerCycle: 2, upgradeCost: { iron_ingot: 20, true_copper: 2 } },
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
      { tier: 1, name: "Cold Crucible",     cycleMs: 60_000, ingotsPerCycle: 1, upgradeCost: {} },
      { tier: 2, name: "Warm Crucible",     cycleMs: 40_000, ingotsPerCycle: 1, upgradeCost: { iron_ingot: 15 } },
      { tier: 3, name: "Hot Crucible",      cycleMs: 25_000, ingotsPerCycle: 1, upgradeCost: { iron_ingot: 30, true_iron: 1 } },
      { tier: 4, name: "True Furnace",      cycleMs: 15_000, ingotsPerCycle: 2, upgradeCost: { true_iron: 3, deepstone_ingot: 5 } },
    ],
  },
  {
    id: "deepstone_engine",
    name: "Deepstone Smelting Engine",
    oreMaterialId: "deepstone_ore",
    ingotMaterialId: "deepstone_ingot",
    orePerCycle: 4,
    coalPerCycle: 0,   // uses hearthsap instead
    fuelMaterialId: "hearthsap",
    fuelPerCycle: 1,
    buildCost: { deepstone_ingot: 10, iron_ingot: 20, ironwood: 5 },
    tiers: [
      { tier: 1, name: "Deep Crucible",     cycleMs: 90_000, ingotsPerCycle: 1, upgradeCost: {} },
      { tier: 2, name: "Heated Deep Forge", cycleMs: 60_000, ingotsPerCycle: 1, upgradeCost: { deepstone_ingot: 8 } },
      { tier: 3, name: "Grand Deep Forge",  cycleMs: 35_000, ingotsPerCycle: 2, upgradeCost: { deepstone_ingot: 15, true_iron: 2 } },
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
  oreBufferMax: number;
  ingotBufferMax: number;
  outputRank?: number;
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
    oreBufferMax: 20,
    ingotBufferMax: INGOT_BUFFER_DEFAULT,
    outputRank: 0,
  };
}

export const MAX_ENGINE_OUTPUT_RANK = 100;

export function engineOutputMultiplier(rank: number): number {
  return 1 + Math.max(0, rank) * 0.2;
}

export function engineOutputUpgradeCost(def: SmeltingEngineDef, rank: number): Record<string, number> {
  return { [def.ingotMaterialId]: Math.ceil(9 * Math.pow(1.24, Math.max(0, rank))) };
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
  speedMultiplier: number = 1
): EngineTickResult {
  if (engine.tier === 0) return { engine, ingotsProduced: 0, oreConsumed: 0, ranCycle: false };

  if (engine.lastCycleAt === 0) {
    return { engine: { ...engine, lastCycleAt: now }, ingotsProduced: 0, oreConsumed: 0, ranCycle: false };
  }

  const tierDef = engineTierDef(def, engine.tier);
  // Turbine speed multiplier (2026-07-06) shrinks the effective cycle
  // time (>1 = faster) - deliberately NOT a bonus to ingotsPerCycle.
  // Speeding up the cycle itself means ore and fuel consumption scale
  // up right alongside ingot output, which is what actually creates
  // the intended "ore or fuel becomes the bottleneck" idle-game
  // dynamic (see turbine.ts's doc comment) - a flat ingots-per-cycle
  // bonus would produce more ingots for free from the same ore/fuel,
  // which is the opposite of that.
  const effectiveCycleMs = Math.max(1, Math.round(tierDef.cycleMs / (speedMultiplier * engineOutputMultiplier(engine.outputRank ?? 0))));
  const elapsed = now - engine.lastCycleAt;
  if (elapsed < effectiveCycleMs) return { engine, ingotsProduced: 0, oreConsumed: 0, ranCycle: false };

  const cycles = Math.floor(elapsed / effectiveCycleMs);
  let totalIngots = 0;
  let totalOre = 0;
  let totalFuel = 0;
  let ran = false;
  const fuelPerCycle = def.fuelPerCycle ?? def.coalPerCycle;
  const initialFuel = def.fuelMaterialId === "hearthsap" ? engine.hearthsapBuffer : engine.coalBuffer;

  for (let i = 0; i < cycles; i++) {
    const oreNeeded = def.orePerCycle;
    const oreAvail = engine.oreBuffer - totalOre;

    if (oreAvail < oreNeeded) break;
    if (initialFuel - totalFuel < fuelPerCycle) break;
    if (engine.ingotBuffer + totalIngots + tierDef.ingotsPerCycle > engine.ingotBufferMax) break;

    totalOre    += oreNeeded;
    totalFuel   += fuelPerCycle;
    totalIngots += tierDef.ingotsPerCycle;
    ran = true;
  }

  const newEngine: SmeltingEngineState = ran
    ? {
        ...engine,
        oreBuffer: engine.oreBuffer - totalOre,
        ingotBuffer: engine.ingotBuffer + totalIngots,
        coalBuffer: def.fuelMaterialId === "hearthsap" ? engine.coalBuffer : engine.coalBuffer - totalFuel,
        hearthsapBuffer: def.fuelMaterialId === "hearthsap" ? engine.hearthsapBuffer - totalFuel : engine.hearthsapBuffer,
        lastCycleAt: engine.lastCycleAt + Math.min(cycles, Math.floor(totalOre / def.orePerCycle)) * effectiveCycleMs,
      }
    : engine;

  return { engine: newEngine, ingotsProduced: totalIngots, oreConsumed: totalOre, ranCycle: ran };
}
