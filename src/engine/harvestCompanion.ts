import type { ResourceBag, WorldState } from "./types";
import { canAffordMaterials, deductMaterials } from "./types";
import { plantDefById, type PlanterSlot } from "./garden";

/**
 * The harvest companion - a second, separate companion from Narag-Bund
 * (2026-07-06). Deliberately its own module rather than reusing
 * companion.ts: per direct note, "he might not end up being an Oxen,"
 * so nothing here (including this file's name) commits to that being
 * his final form - oxen.png is a placeholder sprite only.
 *
 * Gate is "related to the garden, harvesting" rather than tied to the
 * Hearth's own upgrade tree the way Narag-Bund's original "Friend of
 * Burden" unlock was - specifically, having at least one Wood
 * Harvester built. No haul-speed tier system yet either (unlike
 * Narag-Bund's 5-tier ladder) - not asked for on this one, loop.ts
 * uses a single fixed interval/amount for now.
 */
export const HARVEST_COMPANION_BEFRIEND_INSIGHT_COST = 400;
export const HARVEST_COMPANION_BEFRIEND_COST: ResourceBag = {
  wood_planks: 10,
};

export const MAX_GARDEN_TENDING_RANK = 100;

export function gardenTendingUpgradeCost(rank: number): ResourceBag {
  const next = Math.max(1, rank + 1);
  const cost: ResourceBag = {
    wood_planks: Math.ceil(5 * Math.pow(1.24, next - 1)),
    hearthsap: Math.ceil(Math.pow(1.14, next - 1)),
  };
  if (next >= 15) cost[next >= 35 ? "echo_amethyst" : next >= 25 ? "echo_garnet" : "echo_quartz"] = Math.ceil((next - 14) / 7);
  return cost;
}

export function canAffordGardenTendingUpgrade(rank: number, inventory: ResourceBag): boolean {
  return rank < MAX_GARDEN_TENDING_RANK && canAffordMaterials(inventory, gardenTendingUpgradeCost(rank));
}

export interface GardenTendingResult {
  slots: PlanterSlot[];
  stockpile: Record<string, number>;
  lastTendAt: number;
  harvested: number;
  xp: number;
}

/** Siginhakhd harvests mature planters and replants from stockpiled seed. */
export function advanceGardenTending(
  slots: PlanterSlot[],
  stockpile: Record<string, number>,
  lastTendAt: number,
  now: number,
  rank: number,
  capacityPerMaterial: number,
): GardenTendingResult {
  const interval = Math.max(3_000, Math.round(30_000 / (1 + Math.max(0, rank) * 0.1)));
  const trips = Math.floor(Math.max(0, now - lastTendAt) / interval);
  if (trips <= 0) return { slots, stockpile, lastTendAt, harvested: 0, xp: 0 };

  let actions = trips * (1 + Math.floor(Math.max(0, rank) / 5));
  let harvested = 0;
  let xp = 0;
  const nextSlots = [...slots];
  const nextStockpile = { ...stockpile };

  for (let i = 0; i < nextSlots.length && actions > 0; i++) {
    const slot = nextSlots[i];
    if (!slot.unlocked || !slot.plantId || slot.stage < 3) continue;
    const def = plantDefById(slot.plantId);
    if (!def) continue;
    const primaryStored = nextStockpile[def.harvestMaterialId] ?? 0;
    if (primaryStored + def.harvestAmount > capacityPerMaterial) continue;
    if (def.secondaryMaterialId && def.secondaryAmount && (nextStockpile[def.secondaryMaterialId] ?? 0) + def.secondaryAmount > capacityPerMaterial) continue;

    nextStockpile[def.harvestMaterialId] = primaryStored + def.harvestAmount;
    if (def.secondaryMaterialId && def.secondaryAmount) {
      nextStockpile[def.secondaryMaterialId] = (nextStockpile[def.secondaryMaterialId] ?? 0) + def.secondaryAmount;
    }
    const hasSeed = (nextStockpile[def.seedMaterialId] ?? 0) > 0;
    if (hasSeed) {
      nextStockpile[def.seedMaterialId] -= 1;
      nextSlots[i] = { ...slot, stage: 0, stageStartedAt: now };
    } else {
      nextSlots[i] = { ...slot, plantId: null, stage: 0, stageStartedAt: 0 };
    }
    harvested += def.harvestAmount + (def.secondaryAmount ?? 0);
    xp += Math.round(def.herbloreXp * 1.5);
    actions--;
  }

  return { slots: nextSlots, stockpile: nextStockpile, lastTendAt: lastTendAt + trips * interval, harvested, xp };
}

export function canAffordBefriendHarvestCompanion(
  world: Pick<WorldState, "harvesters" | "insightBanked">,
  inventory: ResourceBag
): boolean {
  const hasHarvester = Object.values(world.harvesters).some((h) => h.tier > 0);
  return (
    hasHarvester &&
    world.insightBanked >= HARVEST_COMPANION_BEFRIEND_INSIGHT_COST &&
    canAffordMaterials(inventory, HARVEST_COMPANION_BEFRIEND_COST)
  );
}

export function applyBefriendHarvestCompanion(
  inventory: ResourceBag,
  insightBanked: number
): { inventory: ResourceBag; insightBanked: number } {
  return {
    inventory: deductMaterials(inventory, HARVEST_COMPANION_BEFRIEND_COST),
    insightBanked: insightBanked - HARVEST_COMPANION_BEFRIEND_INSIGHT_COST,
  };
}
