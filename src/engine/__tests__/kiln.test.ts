import { describe, it, expect } from "vitest";
import {
  attemptCharcoalBurn,
  applyCharcoalBurnResult,
  canAffordCharcoalBurn,
  CHARCOAL_RECIPE,
} from "../kiln";
import type { SkillState, ResourceBag } from "../types";

const hearthkeepingLvl1: SkillState = { id: "hearthkeeping", level: 1, xp: 0 };

const inventoryWith = (overrides: ResourceBag): ResourceBag => ({ ...overrides });

describe("canAffordCharcoalBurn", () => {
  it("is false with too little wood", () => {
    expect(canAffordCharcoalBurn(inventoryWith({ wood: CHARCOAL_RECIPE.woodCost - 1 }))).toBe(false);
  });

  it("is true with enough wood", () => {
    expect(canAffordCharcoalBurn(inventoryWith({ wood: CHARCOAL_RECIPE.woodCost }))).toBe(true);
  });
});

describe("attemptCharcoalBurn", () => {
  it("throws if hearthkeeping level is below requirement", () => {
    const belowLevel: SkillState = { id: "hearthkeeping", level: 0, xp: 0 };
    const inv = inventoryWith({ wood: 10 });
    expect(() => attemptCharcoalBurn(belowLevel, inv, 0.1)).toThrow();
  });

  it("throws if not enough wood", () => {
    const inv = inventoryWith({ wood: 0 });
    expect(() => attemptCharcoalBurn(hearthkeepingLvl1, inv, 0.1)).toThrow();
  });

  it("burns wood even on a failed attempt (risk is real, mirrors attemptSmith)", () => {
    const inv = inventoryWith({ wood: 10 });
    const result = attemptCharcoalBurn(hearthkeepingLvl1, inv, 0.99);
    expect(result.success).toBe(false);
    expect(result.woodSpent).toBe(CHARCOAL_RECIPE.woodCost);
    expect(result.charcoalGained).toBe(0);
    expect(result.xpGained).toBe(0);
  });

  it("grants charcoal and xp on success", () => {
    const inv = inventoryWith({ wood: 10 });
    const result = attemptCharcoalBurn(hearthkeepingLvl1, inv, 0.01);
    expect(result.success).toBe(true);
    expect(result.charcoalGained).toBe(CHARCOAL_RECIPE.charcoalYield);
    expect(result.xpGained).toBe(CHARCOAL_RECIPE.baseXp);
  });

  it("levels up hearthkeeping when enough xp accumulates", () => {
    const nearLevelUp: SkillState = { id: "hearthkeeping", level: 1, xp: 1000 };
    const inv = inventoryWith({ wood: 10 });
    const result = attemptCharcoalBurn(nearLevelUp, inv, 0.01);
    expect(result.newLevel).toBeGreaterThanOrEqual(nearLevelUp.level);
  });
});

describe("applyCharcoalBurnResult", () => {
  it("deducts wood and credits charcoal on success", () => {
    const inv = inventoryWith({ wood: 10 });
    const result = attemptCharcoalBurn(hearthkeepingLvl1, inv, 0.01);
    const newInv = applyCharcoalBurnResult(inv, result);
    expect(newInv.wood).toBe(10 - CHARCOAL_RECIPE.woodCost);
    expect(newInv.charcoal).toBe(CHARCOAL_RECIPE.charcoalYield);
  });

  it("only deducts wood on failure, grants no charcoal", () => {
    const inv = inventoryWith({ wood: 10 });
    const result = attemptCharcoalBurn(hearthkeepingLvl1, inv, 0.99);
    const newInv = applyCharcoalBurnResult(inv, result);
    expect(newInv.wood).toBe(10 - CHARCOAL_RECIPE.woodCost);
    expect(newInv.charcoal ?? 0).toBe(0);
  });
});
