import { describe, it, expect } from "vitest";
import {
  COMPANION_HAUL_TIERS,
  companionHaulTierDef,
  nextCompanionHaulTier,
  canAffordCompanionUpgrade,
  applyCompanionUpgrade,
  advanceMachineHauling,
  applyCompanionTraining,
} from "../companion";
import { createFreshDrillState } from "../drill";
import { createFreshHarvesterState } from "../harvester";

describe("companionHaulTierDef / nextCompanionHaulTier", () => {
  it("tier 1 is his original base rate - not a locked/unupgraded state", () => {
    const tier1 = companionHaulTierDef(1);
    expect(tier1.haulIntervalMs).toBe(5_000);
    expect(tier1.haulAmountPerTrip).toBe(2);
    expect(tier1.drillHaulCap).toBe(8);
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

describe("advanceMachineHauling", () => {
  it("shares one hauling budget across ore and wood buffers", () => {
    const tier = applyCompanionTraining(companionHaulTierDef(1), 0);
    const drill = { ...createFreshDrillState(), oreBuffer: 3 };
    const harvester = { ...createFreshHarvesterState(), woodBuffer: 3 };
    const result = advanceMachineHauling(
      {},
      { mine_copper: drill },
      { garden_roots: harvester },
      1,
      1 + tier.haulIntervalMs * 2,
      tier,
      100,
    );
    expect(result.hauled).toBe(4);
    expect(result.stockpile.copper_ore).toBe(3);
    expect(result.stockpile.wood).toBe(1);
    expect(result.drills.mine_copper.oreBuffer).toBe(0);
    expect(result.harvesters.garden_roots.woodBuffer).toBe(2);
  });

  it("respects per-resource stockpile capacity", () => {
    const tier = applyCompanionTraining(companionHaulTierDef(1), 10);
    const drill = { ...createFreshDrillState(), oreBuffer: 20 };
    const result = advanceMachineHauling(
      { copper_ore: 9 },
      { mine_copper: drill },
      {},
      1,
      1 + tier.haulIntervalMs,
      tier,
      10,
    );
    expect(result.stockpile.copper_ore).toBe(10);
    expect(result.drills.mine_copper.oreBuffer).toBe(19);
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
