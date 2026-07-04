import { describe, it, expect } from "vitest";
import {
  GEMCUTTING_BUILD_COST,
  GEMCUTTING_BUILD_INSIGHT_COST,
  canAffordGemcuttingBuild,
  applyGemcuttingBuild,
  GEMCUTTING_TIERS,
  nextGemcuttingTier,
  canAffordGemcuttingTier,
  gemcuttingDropChanceBonus,
  CUTTING_BASE_XP,
  attemptCutGem,
  applyCutGemResult,
  TINKERING_PERK_TIERS,
  activeTinkeringPerkTier,
  nextTinkeringPerkTier,
  cutGemsNeededForNextPerkTier,
  totalGemDropChanceBonus,
  totalCuttingSuccessBonus,
  cutGemRequiredLevel,
  canAffordCutGem,
} from "../gemcutting";
import type { SkillState, ResourceBag } from "../types";

const tinkeringLvl1: SkillState = { id: "tinkering", level: 1, xp: 0 };
const tinkeringLvl8: SkillState = { id: "tinkering", level: 8, xp: 0 };
const tinkeringLvl15: SkillState = { id: "tinkering", level: 15, xp: 0 };
const inventoryWith = (overrides: ResourceBag): ResourceBag => ({ ...overrides });

describe("Gemcutting build cost", () => {
  it("is iron-free by design", () => {
    expect(Object.keys(GEMCUTTING_BUILD_COST)).not.toContain("iron_ingot");
    expect(Object.keys(GEMCUTTING_BUILD_COST)).not.toContain("iron_ore");
  });

  it("is below the Smelter's 1200 Insight ceiling - reachable a bit earlier", () => {
    expect(GEMCUTTING_BUILD_INSIGHT_COST).toBeLessThan(1200);
  });

  it("canAffordGemcuttingBuild requires BOTH enough Insight AND enough materials", () => {
    const fullMaterials = { ...GEMCUTTING_BUILD_COST };
    expect(canAffordGemcuttingBuild(fullMaterials, GEMCUTTING_BUILD_INSIGHT_COST - 1)).toBe(false);
    expect(canAffordGemcuttingBuild({}, GEMCUTTING_BUILD_INSIGHT_COST)).toBe(false);
    expect(canAffordGemcuttingBuild(fullMaterials, GEMCUTTING_BUILD_INSIGHT_COST)).toBe(true);
  });

  it("applyGemcuttingBuild deducts both materials and Insight", () => {
    const inv = { copper_ingot: 20, wood: 25 };
    const result = applyGemcuttingBuild(inv, 1000);
    expect(result.inventory.copper_ingot).toBe(20 - GEMCUTTING_BUILD_COST.copper_ingot!);
    expect(result.inventory.wood).toBe(25 - GEMCUTTING_BUILD_COST.wood!);
    expect(result.insightBanked).toBe(1000 - GEMCUTTING_BUILD_INSIGHT_COST);
  });
});

describe("Gemcutting station tiers", () => {
  it("costs mirror SMELTER_TIERS exactly (300/700/1500), by explicit design", () => {
    expect(GEMCUTTING_TIERS.map((t) => t.insightCost)).toEqual([300, 700, 1500]);
  });

  it("each tier raises BOTH drop chance and cutting success together, not separately", () => {
    for (const tier of GEMCUTTING_TIERS) {
      expect(tier.dropChanceBonus).toBeGreaterThan(0);
      expect(tier.cuttingSuccessBonus).toBeGreaterThan(0);
    }
  });

  it("nextGemcuttingTier and canAffordGemcuttingTier behave consistently with the Smelter's equivalent functions", () => {
    expect(nextGemcuttingTier(0)?.name).toBe("Steadier Hands");
    const maxTier = GEMCUTTING_TIERS[GEMCUTTING_TIERS.length - 1].tier;
    expect(nextGemcuttingTier(maxTier)).toBeNull();
    expect(canAffordGemcuttingTier(0, 0)).toBe(false);
    expect(canAffordGemcuttingTier(GEMCUTTING_TIERS[0].insightCost, 0)).toBe(true);
  });

  it("gemcuttingDropChanceBonus is 0 at tier 0, matches the tier's own bonus otherwise", () => {
    expect(gemcuttingDropChanceBonus(0)).toBe(0);
    expect(gemcuttingDropChanceBonus(1)).toBe(GEMCUTTING_TIERS[0].dropChanceBonus);
  });
});

describe("attemptCutGem", () => {
  it("throws for a rough gem with no cut counterpart", () => {
    const inv = inventoryWith({ copper_ore: 100 });
    expect(() => attemptCutGem("copper_ore", tinkeringLvl1, inv, 0, 0, 0.01)).toThrow();
  });

  it("throws if not enough rough gems held", () => {
    const inv = inventoryWith({ rough_quartz: 0 });
    expect(() => attemptCutGem("rough_quartz", tinkeringLvl1, inv, 0, 0, 0.01)).toThrow();
  });

  it("has a REAL success/failure chance, unlike the Smelter's always-succeeds purification", () => {
    const inv = inventoryWith({ rough_quartz: 10 });
    const winResult = attemptCutGem("rough_quartz", tinkeringLvl1, inv, 0, 0, 0.01);
    const loseResult = attemptCutGem("rough_quartz", tinkeringLvl1, inv, 0, 0, 0.99);
    expect(winResult.success).toBe(true);
    expect(loseResult.success).toBe(false);
  });

  it("on failure, no XP and no cut gem - the rough gem is simply wasted", () => {
    const inv = inventoryWith({ rough_quartz: 10 });
    const result = attemptCutGem("rough_quartz", tinkeringLvl1, inv, 0, 0, 0.99);
    expect(result.xpGained).toBe(0);
    expect(result.success).toBe(false);
  });

  it("on success, grants the baseline XP and the correct cut gem", () => {
    const inv = inventoryWith({ rough_garnet: 10 });
    const result = attemptCutGem("rough_garnet", tinkeringLvl8, inv, 0, 0, 0.01);
    expect(result.success).toBe(true);
    expect(result.xpGained).toBe(CUTTING_BASE_XP);
    expect(result.cutMaterialId).toBe("cut_garnet");
  });

  describe("tier level requirements (2026-07-04)", () => {
    it("quartz (tier 1) is cuttable from level 1", () => {
      expect(cutGemRequiredLevel("rough_quartz")).toBe(1);
      const inv = inventoryWith({ rough_quartz: 1 });
      expect(() => attemptCutGem("rough_quartz", tinkeringLvl1, inv, 0, 0, 0.01)).not.toThrow();
    });

    it("garnet (tier 2) requires level 8, matching Mining's iron vein gate", () => {
      expect(cutGemRequiredLevel("rough_garnet")).toBe(8);
      const inv = inventoryWith({ rough_garnet: 1 });
      expect(() => attemptCutGem("rough_garnet", tinkeringLvl1, inv, 0, 0, 0.01)).toThrow();
      expect(() => attemptCutGem("rough_garnet", tinkeringLvl8, inv, 0, 0, 0.01)).not.toThrow();
    });

    it("amethyst (tier 3) requires level 15, matching Mining's deepstone vein gate - the exact bug reported (cutting it at level 5)", () => {
      expect(cutGemRequiredLevel("rough_amethyst")).toBe(15);
      const inv = inventoryWith({ rough_amethyst: 1 });
      const tinkeringLvl5: SkillState = { id: "tinkering", level: 5, xp: 0 };
      expect(() => attemptCutGem("rough_amethyst", tinkeringLvl5, inv, 0, 0, 0.01)).toThrow();
      expect(() => attemptCutGem("rough_amethyst", tinkeringLvl15, inv, 0, 0, 0.01)).not.toThrow();
    });

    it("canAffordCutGem reflects both the level gate and holdings", () => {
      const inv = inventoryWith({ rough_amethyst: 1 });
      expect(canAffordCutGem("rough_amethyst", 5, inv)).toBe(false); // level too low
      expect(canAffordCutGem("rough_amethyst", 15, {})).toBe(false); // none held
      expect(canAffordCutGem("rough_amethyst", 15, inv)).toBe(true);
    });
  });

  it("the COMBINED station-tier + Tinkering-perk bonus actually affects the success roll", () => {
    const inv = inventoryWith({ rough_quartz: 10 });
    const rollBetween = 0.65;
    const noBonus = attemptCutGem("rough_quartz", tinkeringLvl1, inv, 0, 0, rollBetween);
    const withStationAndPerk = attemptCutGem("rough_quartz", tinkeringLvl1, inv, 3, 6, rollBetween);
    expect(noBonus.success).toBe(false);
    expect(withStationAndPerk.success).toBe(true);
  });
});

describe("applyCutGemResult", () => {
  it("ALWAYS consumes the rough gem, even on failure", () => {
    const inv = inventoryWith({ rough_quartz: 10 });
    const failResult = attemptCutGem("rough_quartz", tinkeringLvl1, inv, 0, 0, 0.99);
    const newInv = applyCutGemResult(inv, failResult);
    expect(newInv.rough_quartz).toBe(9);
    expect(newInv.cut_quartz ?? 0).toBe(0);
  });

  it("adds the cut gem only on success", () => {
    const inv = inventoryWith({ rough_quartz: 10 });
    const winResult = attemptCutGem("rough_quartz", tinkeringLvl1, inv, 0, 0, 0.01);
    const newInv = applyCutGemResult(inv, winResult);
    expect(newInv.rough_quartz).toBe(9);
    expect(newInv.cut_quartz).toBe(1);
  });
});

describe("Tinkering's self-reinforcing perk tree", () => {
  it("mirrors XP_PERK_TIERS' shape exactly: 1/3/6 cumulative spend thresholds", () => {
    expect(TINKERING_PERK_TIERS.map((t) => t.cumulativeCutGemCost)).toEqual([1, 3, 6]);
  });

  it("each tier boosts BOTH drop chance and cutting success together", () => {
    for (const tier of TINKERING_PERK_TIERS) {
      expect(tier.dropChanceBonus).toBeGreaterThan(0);
      expect(tier.cuttingSuccessBonus).toBeGreaterThan(0);
    }
  });

  it("activeTinkeringPerkTier/nextTinkeringPerkTier/cutGemsNeededForNextPerkTier agree with each other", () => {
    expect(activeTinkeringPerkTier(0)).toBeNull();
    expect(activeTinkeringPerkTier(1)?.tier).toBe(1);
    const spent = 2;
    expect(nextTinkeringPerkTier(spent)?.tier).toBe(2);
    expect(cutGemsNeededForNextPerkTier(spent)).toBe(1);
  });

  it("cutGemsNeededForNextPerkTier is null once every tier is purchased", () => {
    const maxCost = TINKERING_PERK_TIERS[TINKERING_PERK_TIERS.length - 1].cumulativeCutGemCost;
    expect(cutGemsNeededForNextPerkTier(maxCost)).toBeNull();
  });
});

describe("totalGemDropChanceBonus / totalCuttingSuccessBonus", () => {
  it("combine station tier and Tinkering perk additively", () => {
    const stationOnly = totalGemDropChanceBonus(1, 0);
    const perkOnly = totalGemDropChanceBonus(0, 1);
    const both = totalGemDropChanceBonus(1, 1);
    expect(both).toBeCloseTo(stationOnly + perkOnly, 6);
  });

  it("are both 0 with nothing built or purchased", () => {
    expect(totalGemDropChanceBonus(0, 0)).toBe(0);
    expect(totalCuttingSuccessBonus(0, 0)).toBe(0);
  });
});
