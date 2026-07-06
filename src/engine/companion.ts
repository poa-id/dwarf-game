import type { ResourceBag } from "./types";
import { canAffordMaterials, deductMaterials } from "./types";

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
  { tier: 1, name: "Coal-Beetle", haulIntervalMs: 10_000, haulAmountPerTrip: 1, drillHaulCap: 5, upgradeCost: {}, upgradeInsightCost: 0 },
  { tier: 2, name: "Laden Beetle", haulIntervalMs: 6_000, haulAmountPerTrip: 3, drillHaulCap: 12, upgradeCost: { iron_ingot: 20, copper_ingot: 10 }, upgradeInsightCost: 500 },
  { tier: 3, name: "Armored Hauler", haulIntervalMs: 3_500, haulAmountPerTrip: 8, drillHaulCap: 25, upgradeCost: { iron_ingot: 40, deepstone_ingot: 10 }, upgradeInsightCost: 1_500 },
  { tier: 4, name: "Tireless Hauler", haulIntervalMs: 2_000, haulAmountPerTrip: 20, drillHaulCap: 60, upgradeCost: { deepstone_ingot: 30, true_iron: 5 }, upgradeInsightCost: 4_000 },
  { tier: 5, name: "Unburdened Beast", haulIntervalMs: 1_000, haulAmountPerTrip: 50, drillHaulCap: 150, upgradeCost: { true_iron: 10, true_copper: 10 }, upgradeInsightCost: 10_000 },
];

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
