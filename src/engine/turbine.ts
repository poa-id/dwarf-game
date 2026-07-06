import type { ResourceBag } from "./types";
import { canAffordMaterials, deductMaterials } from "./types";

/**
 * The Turbine - a Forge addon (2026-07-06, top-left of the 4 reserved
 * Forge addon slots - see hubMap.ts's TURBINE_POSITION, formerly
 * FORGE_ADDON_NW before this got built). Acts as bellows for the
 * Forge, superheating the whole smelting operation.
 *
 * Direct design brief: "The turbine should increase the output of
 * ingots to a much higher level, so Forge should start to accumulate
 * coal or ore... and if you upgrade engines the bottleneck will be
 * either the fuel or the ore or the smelting ratio. Like any idle
 * game." The shared-reserve infrastructure this depends on already
 * existed before this feature (stockpileOre auto-fills from drills
 * once the Stockpile Room is cleared; fuelReserve already feeds both
 * the Hearth and Smelting Engines) - the Turbine's actual job is
 * purely to multiply THROUGHPUT (not to invent a new resource-flow
 * system), which is why this is a single speed multiplier rather than
 * a new material or storage concept.
 *
 * Implemented as a flat multiplier on Smelting Engine cycle speed
 * (TURBINE_SMELT_SPEED_MULTIPLIER) - NOT a bonus to ingotsPerCycle,
 * deliberately: a pure "more ingots per cycle for free" bonus would
 * NOT create the described ore/fuel bottleneck (the ratio would stay
 * the same, just scaled up for free). Speeding up the cycle itself
 * means ore and coal consumption scale up right alongside ingot
 * output, so a well-fed Turbine-era Forge really can out-consume its
 * own supply chain if drills/hauling haven't kept pace - exactly the
 * "idle game bottleneck" being asked for.
 *
 * Unlock gate: "this upgrade has to come right before the mid game is
 * achieved, so deeper mineshaft etc, to trivialize gathering in the
 * base nodes" - gated on Mine Shaft depth 2 ("First Deep"), the
 * existing progression checkpoint already described in
 * mineshaftPanel.ts as reaching genuinely new depth, rather than
 * inventing a separate new gate.
 *
 * The 3x smelting speed multiplier below is an initial balance guess,
 * not measured - flagged for the broader balancing pass already
 * expected later. Narag-Bund's own haul speed used to be boosted
 * alongside this (a single flag doing double duty), but that's been
 * split into his own independent upgrade track since - see
 * companion.ts - so this multiplier is purely about the Forge now.
 */
export const TURBINE_BUILD_COST: ResourceBag = {
  iron_ingot: 40,
  copper_ingot: 30,
  deepstone_ingot: 10,
};
export const TURBINE_BUILD_INSIGHT_COST = 4000;
export const TURBINE_REQUIRED_SHAFT_DEPTH = 2;

export const TURBINE_SMELT_SPEED_MULTIPLIER = 3;

export function canAffordTurbineBuild(
  inventory: ResourceBag,
  insightBanked: number,
  mineshaftDepth: number
): boolean {
  return (
    mineshaftDepth >= TURBINE_REQUIRED_SHAFT_DEPTH &&
    insightBanked >= TURBINE_BUILD_INSIGHT_COST &&
    canAffordMaterials(inventory, TURBINE_BUILD_COST)
  );
}

export function applyTurbineBuild(
  inventory: ResourceBag,
  insightBanked: number
): { inventory: ResourceBag; insightBanked: number } {
  return {
    inventory: deductMaterials(inventory, TURBINE_BUILD_COST),
    insightBanked: insightBanked - TURBINE_BUILD_INSIGHT_COST,
  };
}
