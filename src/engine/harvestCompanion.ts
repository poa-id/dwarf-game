import type { ResourceBag, WorldState } from "./types";
import { canAffordMaterials, deductMaterials } from "./types";

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
