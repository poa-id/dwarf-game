import { describe, it, expect } from "vitest";
import {
  SAWMILL_BUILD_COST,
  SAWMILL_BUILD_INSIGHT_COST,
  canAffordSawmillBuild,
  applySawmillBuild,
  attemptSawPlanks,
  applySawPlanksResult,
  canAffordPlankSaw,
  PLANK_RECIPE,
} from "../sawmill";
import type { SkillState, ResourceBag } from "../types";

const woodcraftLvl1: SkillState = { id: "woodcraft", level: 1, xp: 0 };
const inventoryWith = (overrides: ResourceBag): ResourceBag => ({ ...overrides });

describe("Sawmill build gate", () => {
  const fullMaterials: ResourceBag = { ...SAWMILL_BUILD_COST };

  it("canAffordSawmillBuild requires BOTH enough Insight AND enough materials", () => {
    expect(canAffordSawmillBuild(fullMaterials, SAWMILL_BUILD_INSIGHT_COST - 1)).toBe(false); // insight short
    expect(canAffordSawmillBuild({}, SAWMILL_BUILD_INSIGHT_COST)).toBe(false); // materials short
    expect(canAffordSawmillBuild(fullMaterials, SAWMILL_BUILD_INSIGHT_COST)).toBe(true);
  });

  it("applySawmillBuild deducts both materials and Insight", () => {
    const inv = inventoryWith({ wood: 100, copper_ingot: 100 });
    const result = applySawmillBuild(inv, 500);
    expect(result.insightBanked).toBe(500 - SAWMILL_BUILD_INSIGHT_COST);
    expect(result.inventory.wood).toBe(100 - SAWMILL_BUILD_COST.wood!);
    expect(result.inventory.copper_ingot).toBe(100 - SAWMILL_BUILD_COST.copper_ingot!);
  });

  it("is iron-free by design, same reasoning as the Smelter's build cost", () => {
    expect(SAWMILL_BUILD_COST.iron_ingot).toBeUndefined();
    expect(SAWMILL_BUILD_COST.iron_ore).toBeUndefined();
  });
});

describe("canAffordPlankSaw", () => {
  it("is false with too little wood", () => {
    expect(canAffordPlankSaw(inventoryWith({ wood: PLANK_RECIPE.woodCost - 1 }))).toBe(false);
  });

  it("is true with enough wood", () => {
    expect(canAffordPlankSaw(inventoryWith({ wood: PLANK_RECIPE.woodCost }))).toBe(true);
  });
});

describe("attemptSawPlanks", () => {
  it("throws if woodcraft level is below requirement", () => {
    const belowLevel: SkillState = { id: "woodcraft", level: 0, xp: 0 };
    const inv = inventoryWith({ wood: 10 });
    expect(() => attemptSawPlanks(belowLevel, inv, 0.1)).toThrow();
  });

  it("throws if not enough wood", () => {
    const inv = inventoryWith({ wood: 0 });
    expect(() => attemptSawPlanks(woodcraftLvl1, inv, 0.1)).toThrow();
  });

  it("burns wood even on a failed attempt (mirrors attemptCharcoalBurn's risk model)", () => {
    const inv = inventoryWith({ wood: 10 });
    const result = attemptSawPlanks(woodcraftLvl1, inv, 0.99);
    expect(result.success).toBe(false);
    expect(result.woodSpent).toBe(PLANK_RECIPE.woodCost);
    expect(result.planksGained).toBe(0);
    expect(result.xpGained).toBe(0);
  });

  it("grants planks and xp on success", () => {
    const inv = inventoryWith({ wood: 10 });
    const result = attemptSawPlanks(woodcraftLvl1, inv, 0.01);
    expect(result.success).toBe(true);
    expect(result.planksGained).toBe(PLANK_RECIPE.plankYield);
    expect(result.xpGained).toBe(PLANK_RECIPE.baseXp);
  });

  it("levels up woodcraft when enough xp accumulates", () => {
    const nearLevelUp: SkillState = { id: "woodcraft", level: 1, xp: 1000 };
    const inv = inventoryWith({ wood: 10 });
    const result = attemptSawPlanks(nearLevelUp, inv, 0.01);
    expect(result.newLevel).toBeGreaterThanOrEqual(nearLevelUp.level);
  });
});

describe("applySawPlanksResult", () => {
  it("deducts wood and credits wood_planks on success", () => {
    const inv = inventoryWith({ wood: 10 });
    const result = attemptSawPlanks(woodcraftLvl1, inv, 0.01);
    const newInv = applySawPlanksResult(inv, result);
    expect(newInv.wood).toBe(10 - PLANK_RECIPE.woodCost);
    expect(newInv.wood_planks).toBe(PLANK_RECIPE.plankYield);
  });

  it("only deducts wood on failure, grants no planks", () => {
    const inv = inventoryWith({ wood: 10 });
    const result = attemptSawPlanks(woodcraftLvl1, inv, 0.99);
    const newInv = applySawPlanksResult(inv, result);
    expect(newInv.wood).toBe(10 - PLANK_RECIPE.woodCost);
    expect(newInv.wood_planks ?? 0).toBe(0);
  });
});

describe("Sawmill wood buffer - spends buffer first, falls back to inventory (2026-07-06)", () => {
  it("spends entirely from the buffer when it covers the full cost, leaving inventory wood untouched", () => {
    const inv = inventoryWith({ wood: 10 });
    const result = attemptSawPlanks(woodcraftLvl1, inv, 0.01, 0, PLANK_RECIPE.woodCost);
    expect(result.woodSpentFromBuffer).toBe(PLANK_RECIPE.woodCost);
    expect(result.woodSpentFromInventory).toBe(0);
    const newInv = applySawPlanksResult(inv, result);
    expect(newInv.wood).toBe(10); // untouched - the buffer covered it all
  });

  it("spends from the buffer first, then tops up from inventory for the remainder", () => {
    const inv = inventoryWith({ wood: 10 });
    const partialBuffer = PLANK_RECIPE.woodCost - 1;
    const result = attemptSawPlanks(woodcraftLvl1, inv, 0.01, 0, partialBuffer);
    expect(result.woodSpentFromBuffer).toBe(partialBuffer);
    expect(result.woodSpentFromInventory).toBe(1);
    const newInv = applySawPlanksResult(inv, result);
    expect(newInv.wood).toBe(10 - 1);
  });

  it("works with an empty buffer exactly as before this system existed (all from inventory)", () => {
    const inv = inventoryWith({ wood: 10 });
    const result = attemptSawPlanks(woodcraftLvl1, inv, 0.01, 0, 0);
    expect(result.woodSpentFromBuffer).toBe(0);
    expect(result.woodSpentFromInventory).toBe(PLANK_RECIPE.woodCost);
  });

  it("canAffordPlankSaw considers the buffer - affordable even with insufficient carried wood alone", () => {
    expect(canAffordPlankSaw({ wood: 1 }, PLANK_RECIPE.woodCost - 1)).toBe(true);
    expect(canAffordPlankSaw({ wood: 0 }, 0)).toBe(false);
  });
});
