import type { ResourceBag } from "./types";
import { canAffordMaterials, deductMaterials } from "./types";
import { drillDefinitionByVeinId, type DrillState } from "./drill";
import type { HarvesterState } from "./harvester";
import { SMELTING_ENGINE_DEFINITIONS, type SmeltingEngineState } from "./smeltingEngine";

/**
 * Narag-Bund's own haul-speed/capacity upgrade track (2026-07-06).
 *
 * Direct design brief: "Narag-Bund is the conveyor belt of Factorio of
 * ours, he is the hauling beast. So upgrading infinitely will improve
 * his capacity." Previously his haul speed was tied to a single
 * boolean (whether the Turbine was built) - a hacky one-shot doubling
 * that conflated "the Forge got faster" with "the hauling beast got
 * faster." This replaces that entirely: Narag-Bund now has his own
 * independent tier ladder, and the Turbine went back to being purely
 * about Smelting Engine speed (see turbine.ts).
 *
 * Each tier improves BOTH the fuel-reserve haul (player inventory ->
 * shared fuelReserve, base case) and the drill-coal haul (fuelReserve
 * -> individual drill buffers, unlocked at Hearth tier 2) by the same
 * factor - he's one beast with one capacity, not two separate
 * mechanics that happen to share a name.
 *
 * Tier 1 is his ORIGINAL base rate (not "unupgraded") - matches the
 * pre-existing HAUL_INTERVAL_MS/HAUL_AMOUNT_PER_TRIP values exactly,
 * so a freshly-befriended Narag-Bund feels identical to before this
 * system existed. Every tier above that is a genuine, paid upgrade.
 *
 * These numbers are an initial ladder shape, not measured - flagged
 * for the broader balancing pass, same as the Turbine's own numbers.
 */
export interface CompanionHaulTier {
  tier: number;
  name: string;
  haulIntervalMs: number;   // how often he makes a fuel-reserve trip
  haulAmountPerTrip: number; // how much fuel per fuel-reserve trip
  drillHaulCap: number;      // how much coal per trip to an individual drill
  upgradeCost: ResourceBag;
  upgradeInsightCost: number;
}

export const COMPANION_HAUL_TIERS: CompanionHaulTier[] = [
  { tier: 1, name: "Coal-Beetle", haulIntervalMs: 4_000, haulAmountPerTrip: 4, drillHaulCap: 10, upgradeCost: {}, upgradeInsightCost: 0 },
  { tier: 2, name: "Laden Beetle", haulIntervalMs: 3_000, haulAmountPerTrip: 8, drillHaulCap: 20, upgradeCost: { iron_ingot: 20, copper_ingot: 10 }, upgradeInsightCost: 500 },
  { tier: 3, name: "Armored Hauler", haulIntervalMs: 2_500, haulAmountPerTrip: 15, drillHaulCap: 35, upgradeCost: { iron_ingot: 40, deepstone_ingot: 10 }, upgradeInsightCost: 1_500 },
  { tier: 4, name: "Tireless Hauler", haulIntervalMs: 1_500, haulAmountPerTrip: 30, drillHaulCap: 75, upgradeCost: { deepstone_ingot: 30, true_iron: 5 }, upgradeInsightCost: 4_000 },
  { tier: 5, name: "Unburdened Beast", haulIntervalMs: 750, haulAmountPerTrip: 60, drillHaulCap: 160, upgradeCost: { true_iron: 10, true_copper: 10 }, upgradeInsightCost: 10_000 },
];

export const MAX_COMPANION_TRAINING_RANK = 100;

export function companionTrainingCost(rank: number): ResourceBag {
  const nextRank = Math.max(1, rank + 1);
  const cost: ResourceBag = {
    coal: Math.ceil(16 * Math.pow(1.27, nextRank - 1)),
    copper_ingot: Math.ceil(2 * Math.pow(1.24, nextRank - 1)),
  };
  if (nextRank >= 10) {
    const echoId = nextRank >= 30 ? "echo_amethyst" : nextRank >= 20 ? "echo_garnet" : "echo_quartz";
    cost[echoId] = Math.ceil((nextRank - 9) / 5);
  }
  return cost;
}

/** Each repeatable rank adds 25% to carrying capacity. */
export function applyCompanionTraining(tier: CompanionHaulTier, rank: number): CompanionHaulTier {
  const multiplier = 1 + Math.max(0, rank) * 0.25;
  return {
    ...tier,
    haulAmountPerTrip: Math.max(1, Math.round(tier.haulAmountPerTrip * multiplier)),
    drillHaulCap: Math.max(1, Math.round(tier.drillHaulCap * multiplier)),
  };
}

export function canAffordCompanionTraining(rank: number, inventory: ResourceBag): boolean {
  return rank < MAX_COMPANION_TRAINING_RANK && canAffordMaterials(inventory, companionTrainingCost(rank));
}

export interface MachineHaulResult {
  stockpile: Record<string, number>;
  drills: Record<string, DrillState>;
  harvesters: Record<string, HarvesterState>;
  lastHaulAt: number;
  hauled: number;
}

export type LogisticsMode = "balanced" | "fuel_first" | "outputs_first";
export type LogisticsLane = "outputs" | "extractors" | "processors" | "hearth";
export interface LogisticsPolicy {
  /** Material held back in the central Stockpile before any consumer may draw it. */
  reserveMinimums: Record<string, number>;
  /** Share of Narag-Bund's carrying budget assigned to each route family. */
  laneWeights: Record<LogisticsLane, number>;
}

export const DEFAULT_LOGISTICS_POLICY: LogisticsPolicy = {
  reserveMinimums: { coal: 10 },
  laneWeights: { outputs: 25, extractors: 30, processors: 30, hearth: 15 },
};

export function normalizeLogisticsPolicy(policy?: LogisticsPolicy): LogisticsPolicy {
  return {
    reserveMinimums: { ...DEFAULT_LOGISTICS_POLICY.reserveMinimums, ...(policy?.reserveMinimums ?? {}) },
    laneWeights: { ...DEFAULT_LOGISTICS_POLICY.laneWeights, ...(policy?.laneWeights ?? {}) },
  };
}

export interface UnifiedLogisticsResult {
  stockpile: Record<string, number>;
  fuelReserve: ResourceBag;
  drills: Record<string, DrillState>;
  harvesters: Record<string, HarvesterState>;
  engines: Record<string, SmeltingEngineState>;
  lastHaulAt: number;
  moved: number;
}

/**
 * Narag-Bund's single logistics budget. Every unit picked up from an
 * extractor, delivered as fuel, fed into a smelting engine, or removed
 * as finished ingots competes for the same carrying capacity.
 */
export function advanceUnifiedLogistics(
  stockpile: Record<string, number>,
  fuelReserve: ResourceBag,
  drills: Record<string, DrillState>,
  harvesters: Record<string, HarvesterState>,
  engines: Record<string, SmeltingEngineState>,
  lastHaulAt: number,
  now: number,
  tier: CompanionHaulTier,
  capacityPerMaterial: number,
  mode: LogisticsMode = "balanced",
  policy?: LogisticsPolicy,
): UnifiedLogisticsResult {
  const trips = Math.floor(Math.max(0, now - lastHaulAt) / tier.haulIntervalMs);
  if (trips <= 0) return { stockpile, fuelReserve, drills, harvesters, engines, lastHaulAt, moved: 0 };

  let budget = trips * tier.haulAmountPerTrip;
  let moved = 0;
  const nextStockpile = { ...stockpile };
  const nextFuelReserve = { ...fuelReserve };
  const nextDrills = { ...drills };
  const nextHarvesters = { ...harvesters };
  const nextEngines = { ...engines };
  const activePolicy = policy
    ? normalizeLogisticsPolicy(policy)
    : { reserveMinimums: {}, laneWeights: { ...DEFAULT_LOGISTICS_POLICY.laneWeights } };
  let laneBudget = Number.POSITIVE_INFINITY;

  const transfer = (available: number, space: number): number => {
    const amount = Math.min(Math.max(0, available), Math.max(0, space), budget, laneBudget);
    budget -= amount;
    laneBudget -= amount;
    moved += amount;
    return amount;
  };

  const stockAvailable = (materialId: string): number =>
    Math.max(0, (nextStockpile[materialId] ?? 0) - (activePolicy.reserveMinimums[materialId] ?? 0));

  const collectOutputs = () => {
    for (const [veinId, drill] of Object.entries(nextDrills)) {
      if (budget <= 0) return;
      const def = drillDefinitionByVeinId(veinId);
      if (!def) continue;
      const stored = nextStockpile[def.oreMaterialId] ?? 0;
      const amount = transfer(drill.oreBuffer, capacityPerMaterial - stored);
      if (amount > 0) {
        nextDrills[veinId] = { ...drill, oreBuffer: drill.oreBuffer - amount };
        nextStockpile[def.oreMaterialId] = stored + amount;
      }
      for (const [bonusId, bonusAmount] of Object.entries(drill.bonusBuffer ?? {})) {
        if (budget <= 0) return;
        const bonusStored = nextStockpile[bonusId] ?? 0;
        const bonusMoved = transfer(bonusAmount ?? 0, capacityPerMaterial - bonusStored);
        if (bonusMoved > 0) {
          const current = nextDrills[veinId];
          nextDrills[veinId] = { ...current, bonusBuffer: { ...(current.bonusBuffer ?? {}), [bonusId]: (current.bonusBuffer?.[bonusId] ?? 0) - bonusMoved } };
          nextStockpile[bonusId] = bonusStored + bonusMoved;
        }
      }
    }
    for (const [nodeId, harvester] of Object.entries(nextHarvesters)) {
      if (budget <= 0) return;
      const stored = nextStockpile.wood ?? 0;
      const amount = transfer(harvester.woodBuffer, capacityPerMaterial - stored);
      if (amount > 0) {
        nextHarvesters[nodeId] = { ...harvester, woodBuffer: harvester.woodBuffer - amount };
        nextStockpile.wood = stored + amount;
      }
    }
    for (const def of SMELTING_ENGINE_DEFINITIONS) {
      if (budget <= 0) return;
      const engine = nextEngines[def.id];
      if (!engine) continue;
      const stored = nextStockpile[def.ingotMaterialId] ?? 0;
      const amount = transfer(engine.ingotBuffer, capacityPerMaterial - stored);
      if (amount > 0) {
        nextEngines[def.id] = { ...engine, ingotBuffer: engine.ingotBuffer - amount };
        nextStockpile[def.ingotMaterialId] = stored + amount;
      }
    }
  };

  const fuelExtractors = () => {
    for (const [veinId, drill] of Object.entries(nextDrills)) {
      if (budget <= 0) return;
      const def = drillDefinitionByVeinId(veinId);
      if (!def || def.coalPerCycle <= 0) continue;
      const target = drill.coalBufferMax ?? 20;
      const amount = transfer(stockAvailable("coal"), target - drill.coalBuffer);
      if (amount > 0) {
        nextStockpile.coal = (nextStockpile.coal ?? 0) - amount;
        nextDrills[veinId] = { ...drill, coalBuffer: drill.coalBuffer + amount };
      }
    }
    for (const [nodeId, harvester] of Object.entries(nextHarvesters)) {
      if (budget <= 0) return;
      const target = harvester.coalBufferMax ?? 20;
      const amount = transfer(stockAvailable("coal"), target - harvester.coalBuffer);
      if (amount > 0) {
        nextStockpile.coal = (nextStockpile.coal ?? 0) - amount;
        nextHarvesters[nodeId] = { ...harvester, coalBuffer: harvester.coalBuffer + amount };
      }
    }
  };

  const feedEngines = () => {
    for (const def of SMELTING_ENGINE_DEFINITIONS) {
      if (budget <= 0) return;
      let engine = nextEngines[def.id];
      if (!engine) continue;
      let amount = transfer(stockAvailable(def.oreMaterialId), (engine.oreBufferMax ?? 20) - engine.oreBuffer);
      if (amount > 0) {
        nextStockpile[def.oreMaterialId] = (nextStockpile[def.oreMaterialId] ?? 0) - amount;
        engine = { ...engine, oreBuffer: engine.oreBuffer + amount };
      }
      const fuelId = def.fuelMaterialId ?? "coal";
      const fuelBuffer = fuelId === "hearthsap" ? engine.hearthsapBuffer : engine.coalBuffer;
      amount = transfer(stockAvailable(fuelId), engine.coalBufferMax - fuelBuffer);
      if (amount > 0) {
        nextStockpile[fuelId] = (nextStockpile[fuelId] ?? 0) - amount;
        engine = fuelId === "hearthsap"
          ? { ...engine, hearthsapBuffer: engine.hearthsapBuffer + amount }
          : { ...engine, coalBuffer: engine.coalBuffer + amount };
      }
      nextEngines[def.id] = engine;
    }
  };

  const feedHearth = () => {
    const fuels = ["coal", "charcoal", "wood"];
    const reserveTarget = 50 + tier.tier * 25;
    let reserveUnits = fuels.reduce((sum, id) => sum + (nextFuelReserve[id] ?? 0), 0);
    for (const fuelId of fuels) {
      if (budget <= 0 || reserveUnits >= reserveTarget) return;
      const amount = transfer(stockAvailable(fuelId), reserveTarget - reserveUnits);
      if (amount > 0) {
        nextStockpile[fuelId] = (nextStockpile[fuelId] ?? 0) - amount;
        nextFuelReserve[fuelId] = (nextFuelReserve[fuelId] ?? 0) + amount;
        reserveUnits += amount;
      }
    }
  };

  const lanes: Record<LogisticsLane, () => void> = {
    outputs: collectOutputs,
    extractors: fuelExtractors,
    processors: feedEngines,
    hearth: feedHearth,
  };
  const order: LogisticsLane[] = mode === "outputs_first"
    ? ["outputs", "extractors", "processors", "hearth"]
    : mode === "fuel_first"
      ? ["extractors", "processors", "hearth", "outputs"]
      : ["extractors", "outputs", "processors", "hearth"];

  // First pass guarantees each lane its configured share. Fractional
  // transfers are already supported throughout the resource model.
  if (!policy) {
    // Compatibility path for callers/saves predating allocation policies.
    laneBudget = Number.POSITIVE_INFINITY;
    for (const lane of order) lanes[lane]();
  } else {
    const startingBudget = budget;
    const weightTotal = Object.values(activePolicy.laneWeights).reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
    const hungryLanes: LogisticsLane[] = [];
    for (const lane of order) {
      laneBudget = startingBudget * Math.max(0, activePolicy.laneWeights[lane]) / weightTotal;
      lanes[lane]();
      if (laneBudget <= 0.000001) hungryLanes.push(lane);
    }
    // Idle lanes yield their unused share. Only lanes that exhausted their
    // first allocation compete for it, retaining the configured ratio.
    const hungryWeight = hungryLanes.reduce((sum, lane) => sum + Math.max(0, activePolicy.laneWeights[lane]), 0);
    const overflowBudget = budget;
    if (overflowBudget > 0 && hungryWeight > 0) {
      for (const lane of hungryLanes) {
        laneBudget = overflowBudget * Math.max(0, activePolicy.laneWeights[lane]) / hungryWeight;
        lanes[lane]();
      }
    }
  }

  return {
    stockpile: nextStockpile,
    fuelReserve: nextFuelReserve,
    drills: nextDrills,
    harvesters: nextHarvesters,
    engines: nextEngines,
    lastHaulAt: lastHaulAt + trips * tier.haulIntervalMs,
    moved,
  };
}

/**
 * Generic production logistics: Narag-Bund empties every automated
 * extractor into the central stockpile. New drill materials join this
 * route automatically through their DrillDefinition; wood harvesters
 * use the same budget and deposit raw wood.
 */
export function advanceMachineHauling(
  stockpile: Record<string, number>,
  drills: Record<string, DrillState>,
  harvesters: Record<string, HarvesterState>,
  lastHaulAt: number,
  now: number,
  tier: CompanionHaulTier,
  capacityPerMaterial: number,
): MachineHaulResult {
  const elapsed = Math.max(0, now - lastHaulAt);
  const trips = Math.floor(elapsed / tier.haulIntervalMs);
  if (trips <= 0) return { stockpile, drills, harvesters, lastHaulAt, hauled: 0 };

  let budget = trips * tier.haulAmountPerTrip;
  let hauled = 0;
  let nextStockpile = { ...stockpile };
  let nextDrills = { ...drills };
  let nextHarvesters = { ...harvesters };

  for (const [veinId, drill] of Object.entries(drills)) {
    if (budget <= 0) break;
    const def = drillDefinitionByVeinId(veinId);
    if (!def || drill.oreBuffer <= 0) continue;
    const stored = nextStockpile[def.oreMaterialId] ?? 0;
    const moved = Math.min(drill.oreBuffer, budget, Math.max(0, capacityPerMaterial - stored));
    if (moved <= 0) continue;
    nextStockpile[def.oreMaterialId] = stored + moved;
    nextDrills[veinId] = { ...drill, oreBuffer: drill.oreBuffer - moved };
    budget -= moved;
    hauled += moved;
  }

  for (const [nodeId, harvester] of Object.entries(harvesters)) {
    if (budget <= 0) break;
    if (harvester.woodBuffer <= 0) continue;
    const stored = nextStockpile.wood ?? 0;
    const moved = Math.min(harvester.woodBuffer, budget, Math.max(0, capacityPerMaterial - stored));
    if (moved <= 0) continue;
    nextStockpile.wood = stored + moved;
    nextHarvesters[nodeId] = { ...harvester, woodBuffer: harvester.woodBuffer - moved };
    budget -= moved;
    hauled += moved;
  }

  return {
    stockpile: nextStockpile,
    drills: nextDrills,
    harvesters: nextHarvesters,
    lastHaulAt: lastHaulAt + trips * tier.haulIntervalMs,
    hauled,
  };
}

export function companionHaulTierDef(tier: number): CompanionHaulTier {
  return COMPANION_HAUL_TIERS.find((t) => t.tier === tier) ?? COMPANION_HAUL_TIERS[0];
}

export function nextCompanionHaulTier(currentTier: number): CompanionHaulTier | null {
  return COMPANION_HAUL_TIERS.find((t) => t.tier === currentTier + 1) ?? null;
}

export function canAffordCompanionUpgrade(
  currentTier: number,
  inventory: ResourceBag,
  insightBanked: number
): boolean {
  const next = nextCompanionHaulTier(currentTier);
  if (!next) return false;
  return insightBanked >= next.upgradeInsightCost && canAffordMaterials(inventory, next.upgradeCost);
}

export function applyCompanionUpgrade(
  currentTier: number,
  inventory: ResourceBag,
  insightBanked: number
): { tier: number; inventory: ResourceBag; insightBanked: number } {
  const next = nextCompanionHaulTier(currentTier);
  if (!next) return { tier: currentTier, inventory, insightBanked };
  return {
    tier: next.tier,
    inventory: deductMaterials(inventory, next.upgradeCost),
    insightBanked: insightBanked - next.upgradeInsightCost,
  };
}
