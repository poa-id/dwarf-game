import { describe, it, expect } from "vitest";
import {
  COMPANION_HAUL_TIERS,
  companionHaulTierDef,
  nextCompanionHaulTier,
  canAffordCompanionUpgrade,
  applyCompanionUpgrade,
} from "../companion";

describe("companionHaulTierDef / nextCompanionHaulTier", () => {
  it("tier 1 is his original base rate - not a locked/unupgraded state", () => {
    const tier1 = companionHaulTierDef(1);
    expect(tier1.haulIntervalMs).toBe(10_000);
    expect(tier1.haulAmountPerTrip).toBe(1);
    expect(tier1.drillHaulCap).toBe(5);
    expect(tier1.upgradeInsightCost).toBe(0);
  });

  it("falls back to tier 1 for an unknown tier number", () => {
    expect(companionHaulTierDef(999)).toEqual(companionHaulTierDef(1));
  });

  it("nextCompanionHaulTier returns the next tier, or null at the top", () => {
    expect(nextCompanionHaulTier(1)?.tier).toBe(2);
    const topTier = COMPANION_HAUL_TIERS[COMPANION_HAUL_TIERS.length - 1].tier;
    expect(nextCompanionHaulTier(topTier)).toBeNull();
  });

  it("every tier strictly improves on the one before it", () => {
    for (let i = 1; i < COMPANION_HAUL_TIERS.length; i++) {
      const cur = COMPANION_HAUL_TIERS[i - 1];
      const next = COMPANION_HAUL_TIERS[i];
      expect(next.haulIntervalMs).toBeLessThan(cur.haulIntervalMs);
      expect(next.haulAmountPerTrip).toBeGreaterThan(cur.haulAmountPerTrip);
      expect(next.drillHaulCap).toBeGreaterThan(cur.drillHaulCap);
    }
  });
});

describe("canAffordCompanionUpgrade / applyCompanionUpgrade", () => {
  it("cannot afford without enough Insight even with all materials", () => {
    const tier2 = companionHaulTierDef(2);
    expect(canAffordCompanionUpgrade(1, { ...tier2.upgradeCost }, tier2.upgradeInsightCost - 1)).toBe(false);
  });

  it("cannot afford without enough materials even with enough Insight", () => {
    const tier2 = companionHaulTierDef(2);
    expect(canAffordCompanionUpgrade(1, {}, tier2.upgradeInsightCost)).toBe(false);
  });

  it("can afford with both", () => {
    const tier2 = companionHaulTierDef(2);
    expect(canAffordCompanionUpgrade(1, { ...tier2.upgradeCost }, tier2.upgradeInsightCost)).toBe(true);
  });

  it("returns false at the top tier - nothing left to afford", () => {
    const topTier = COMPANION_HAUL_TIERS[COMPANION_HAUL_TIERS.length - 1].tier;
    expect(canAffordCompanionUpgrade(topTier, {}, 1_000_000)).toBe(false);
  });

  it("applyCompanionUpgrade advances the tier and deducts materials/Insight", () => {
    const tier2 = companionHaulTierDef(2);
    const inv = { iron_ingot: 100, copper_ingot: 100 };
    const result = applyCompanionUpgrade(1, inv, 5000);
    expect(result.tier).toBe(2);
    expect(result.insightBanked).toBe(5000 - tier2.upgradeInsightCost);
    expect(result.inventory.iron_ingot).toBe(100 - tier2.upgradeCost.iron_ingot!);
    expect(result.inventory.copper_ingot).toBe(100 - tier2.upgradeCost.copper_ingot!);
  });

  it("applyCompanionUpgrade is a no-op at the top tier", () => {
    const topTier = COMPANION_HAUL_TIERS[COMPANION_HAUL_TIERS.length - 1].tier;
    const result = applyCompanionUpgrade(topTier, { coal: 5 }, 100);
    expect(result.tier).toBe(topTier);
    expect(result.inventory.coal).toBe(5);
    expect(result.insightBanked).toBe(100);
  });
});
