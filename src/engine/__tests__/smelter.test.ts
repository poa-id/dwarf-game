import { describe, it, expect } from "vitest";
import {
  SMELTER_BUILD_COST,
  SMELTER_BUILD_INSIGHT_COST,
  canAffordSmelterBuild,
  applySmelterBuild,
  SMELTER_TIERS,
  purifyTrueMetalChance,
  nextSmelterTier,
  canAffordSmelterTier,
  PURIFY_INGOT_COST,
  PURIFY_BASE_XP,
  attemptPurify,
  applyPurifyResult,
  canAffordPurify,
  PURIFY_COAL_COST,
  XP_PERK_TIERS,
  activeXpPerkTier,
  xpPerkBonus,
  nextXpPerkTier,
  trueMetalNeededForNextPerkTier,
} from "../smelter";
import type { SkillState, ResourceBag } from "../types";

const smithingLvl1: SkillState = { id: "smithing", level: 1, xp: 0 };
// Always include plenty of coal so purify tests aren't blocked by the new coal cost
const inventoryWith = (overrides: ResourceBag): ResourceBag => ({ coal: 100, ...overrides });

describe("canAffordPurify (2026-07-04 batch-loop fix)", () => {
  // Extracted so render.ts's batch loop checks affordability BEFORE
  // each iteration. The bug this replaces was even worse for purify
  // specifically: it checked outcome.trueMetalGained (a rare bonus,
  // often well under 1% chance) instead of affordability, so a x50
  // batch would almost always stop after just the FIRST attempt.
  it("is false with insufficient ingots even with plenty of coal", () => {
    const inv: ResourceBag = { copper_ingot: PURIFY_INGOT_COST - 1, coal: 100 };
    expect(canAffordPurify(inv, "copper_ingot")).toBe(false);
  });

  it("is false with insufficient coal even with plenty of ingots", () => {
    const inv: ResourceBag = { copper_ingot: 100, coal: PURIFY_COAL_COST["copper_ingot"] - 1 };
    expect(canAffordPurify(inv, "copper_ingot")).toBe(false);
  });

  it("is true with enough of both", () => {
    const inv: ResourceBag = { copper_ingot: PURIFY_INGOT_COST, coal: PURIFY_COAL_COST["copper_ingot"] };
    expect(canAffordPurify(inv, "copper_ingot")).toBe(true);
  });

  it("uses the correct per-metal coal cost (iron costs more than copper)", () => {
    const inv: ResourceBag = { iron_ingot: PURIFY_INGOT_COST, coal: PURIFY_COAL_COST["copper_ingot"] };
    // Enough coal for copper's cheaper rate, but not iron's pricier one
    expect(canAffordPurify(inv, "iron_ingot")).toBe(false);
  });
});

describe("Smelter build cost", () => {
  it("is iron-free by design - only copper_ingot, copper_ore, and wood", () => {
    expect(Object.keys(SMELTER_BUILD_COST)).not.toContain("iron_ingot");
    expect(Object.keys(SMELTER_BUILD_COST)).not.toContain("iron_ore");
  });

  it("canAffordSmelterBuild requires BOTH enough Insight AND enough materials", () => {
    const fullMaterials = { ...SMELTER_BUILD_COST };
    expect(canAffordSmelterBuild(fullMaterials, SMELTER_BUILD_INSIGHT_COST - 1)).toBe(false); // insight short
    expect(canAffordSmelterBuild({}, SMELTER_BUILD_INSIGHT_COST)).toBe(false); // materials short
    expect(canAffordSmelterBuild(fullMaterials, SMELTER_BUILD_INSIGHT_COST)).toBe(true);
  });

  it("applySmelterBuild deducts both materials and Insight", () => {
    const inv = { copper_ingot: 25, copper_ore: 20, wood: 35 };
    const result = applySmelterBuild(inv, 1500);
    expect(result.inventory.copper_ingot).toBe(25 - SMELTER_BUILD_COST.copper_ingot!);
    expect(result.inventory.copper_ore).toBe(20 - SMELTER_BUILD_COST.copper_ore!);
    expect(result.inventory.wood).toBe(35 - SMELTER_BUILD_COST.wood!);
    expect(result.insightBanked).toBe(1500 - SMELTER_BUILD_INSIGHT_COST);
  });
});

describe("purifyTrueMetalChance", () => {
  it("tier 0 (built, unupgraded) is 0.05%", () => {
    expect(purifyTrueMetalChance(0)).toBeCloseTo(0.0005, 6);
  });

  it("each tier matches the explicit, deliberately conservative curve", () => {
    expect(purifyTrueMetalChance(1)).toBeCloseTo(0.002, 6);
    expect(purifyTrueMetalChance(2)).toBeCloseTo(0.005, 6);
    expect(purifyTrueMetalChance(3)).toBeCloseTo(0.01, 6);
  });

  it("the curve is monotonically increasing - each tier strictly better than the last", () => {
    const chances = [0, 1, 2, 3].map(purifyTrueMetalChance);
    for (let i = 1; i < chances.length; i++) {
      expect(chances[i]).toBeGreaterThan(chances[i - 1]);
    }
  });
});

describe("Smelter tier upgrades", () => {
  it("nextSmelterTier returns tier 1 from base, null past the highest defined tier", () => {
    expect(nextSmelterTier(0)?.name).toBe("Truer Flame");
    const maxTier = SMELTER_TIERS[SMELTER_TIERS.length - 1].tier;
    expect(nextSmelterTier(maxTier)).toBeNull();
  });

  it("canAffordSmelterTier respects insight cost and tier sequencing", () => {
    expect(canAffordSmelterTier(0, 0)).toBe(false);
    expect(canAffordSmelterTier(SMELTER_TIERS[0].insightCost, 0)).toBe(true);
    expect(canAffordSmelterTier(1_000_000, SMELTER_TIERS[SMELTER_TIERS.length - 1].tier)).toBe(false);
  });
});

describe("attemptPurify", () => {
  it("iron_ingot now has a True-metal counterpart (true_iron) — no longer throws", () => {
    const inv = inventoryWith({ iron_ingot: 100 });
    // Should NOT throw — iron is now a valid purifiable metal
    expect(() => attemptPurify("iron_ingot", smithingLvl1, inv, 0, 0.01)).not.toThrow();
    const result = attemptPurify("iron_ingot", smithingLvl1, inv, 0, 0.01);
    expect(result.coalSpent).toBe(12); // iron costs more coal than copper
    expect(result.ingotsSpent).toBe(PURIFY_INGOT_COST);
  });

  it("throws if not enough ingots held", () => {
    const inv = inventoryWith({ copper_ingot: PURIFY_INGOT_COST - 1 });
    expect(() => attemptPurify("copper_ingot", smithingLvl1, inv, 0, 0.01)).toThrow();
  });

  it("ALWAYS consumes the ingot cost and grants XP, regardless of the roll - no separate success/failure", () => {
    const inv = inventoryWith({ copper_ingot: 100 });
    const lowRoll = attemptPurify("copper_ingot", smithingLvl1, inv, 0, 0.0001); // wins the rare drop
    const highRoll = attemptPurify("copper_ingot", smithingLvl1, inv, 0, 0.999); // loses the rare drop
    expect(lowRoll.ingotsSpent).toBe(PURIFY_INGOT_COST);
    expect(highRoll.ingotsSpent).toBe(PURIFY_INGOT_COST);
    expect(lowRoll.xpGained).toBe(PURIFY_BASE_XP);
    expect(highRoll.xpGained).toBe(PURIFY_BASE_XP);
  });

  it("a roll below the drop chance yields the correct True-metal; above it yields null", () => {
    const inv = inventoryWith({ copper_ingot: 100 });
    const tier0Chance = purifyTrueMetalChance(0);
    const winResult = attemptPurify("copper_ingot", smithingLvl1, inv, 0, tier0Chance - 0.0001);
    const loseResult = attemptPurify("copper_ingot", smithingLvl1, inv, 0, tier0Chance + 0.0001);
    expect(winResult.trueMetalGained).toBe("true_copper");
    expect(loseResult.trueMetalGained).toBeNull();
  });

  it("a higher Smelter tier meaningfully raises the win window", () => {
    const inv = inventoryWith({ copper_ingot: 100 });
    const rollThatWinsAtTier3ButNotTier0 = 0.008; // between tier 0's 0.0005 and tier 3's 0.01
    const atTier0 = attemptPurify("copper_ingot", smithingLvl1, inv, 0, rollThatWinsAtTier3ButNotTier0);
    const atTier3 = attemptPurify("copper_ingot", smithingLvl1, inv, 3, rollThatWinsAtTier3ButNotTier0);
    expect(atTier0.trueMetalGained).toBeNull();
    expect(atTier3.trueMetalGained).toBe("true_copper");
  });
});

describe("applyPurifyResult", () => {
  it("deducts ingots and adds the True-metal on a win", () => {
    const inv = inventoryWith({ copper_ingot: 100 });
    const result = attemptPurify("copper_ingot", smithingLvl1, inv, 3, 0.001); // tier 3 chance is 1%, this wins
    const newInv = applyPurifyResult(inv, result);
    expect(newInv.copper_ingot).toBe(100 - PURIFY_INGOT_COST);
    expect(newInv.true_copper).toBe(1);
  });

  it("deducts ingots but adds nothing on a non-drop", () => {
    const inv = inventoryWith({ copper_ingot: 100 });
    const result = attemptPurify("copper_ingot", smithingLvl1, inv, 0, 0.999);
    const newInv = applyPurifyResult(inv, result);
    expect(newInv.copper_ingot).toBe(100 - PURIFY_INGOT_COST);
    expect(newInv.true_copper ?? 0).toBe(0);
  });
});

describe("the Mountain's XP perk tree (spent True-metals)", () => {
  it("activeXpPerkTier is null before any True-metal has been spent", () => {
    expect(activeXpPerkTier(0)).toBeNull();
  });

  it("crosses tier 1 at exactly the first threshold", () => {
    expect(activeXpPerkTier(XP_PERK_TIERS[0].cumulativeTrueMetalCost)?.tier).toBe(1);
  });

  it("xpPerkBonus is 0 before any tier, and matches the active tier's bonus afterward", () => {
    expect(xpPerkBonus(0)).toBe(0);
    expect(xpPerkBonus(XP_PERK_TIERS[0].cumulativeTrueMetalCost)).toBe(XP_PERK_TIERS[0].xpBonus);
  });

  it("nextXpPerkTier and trueMetalNeededForNextPerkTier agree with each other", () => {
    const spent = 2; // between tier 1 (1) and tier 2 (3)
    const next = nextXpPerkTier(spent);
    expect(next?.tier).toBe(2);
    expect(trueMetalNeededForNextPerkTier(spent)).toBe(XP_PERK_TIERS[1].cumulativeTrueMetalCost - spent);
  });

  it("trueMetalNeededForNextPerkTier is null once every tier is purchased", () => {
    const maxCost = XP_PERK_TIERS[XP_PERK_TIERS.length - 1].cumulativeTrueMetalCost;
    expect(trueMetalNeededForNextPerkTier(maxCost)).toBeNull();
  });
});
