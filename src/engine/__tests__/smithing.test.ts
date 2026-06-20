import { describe, it, expect } from "vitest";
import {
  attemptSmith,
  applySmithResult,
  SMITH_RECIPES,
  nextForgeUpgrade,
  canAffordForgeUpgrade,
  FORGE_UPGRADES,
} from "../smithing";
import type { SkillState, ResourceBag } from "../types";

const smithingLvl1: SkillState = { id: "smithing", level: 1, xp: 0 };
const copperIngotRecipe = SMITH_RECIPES.find((r) => r.id === "copper_ingot")!;
const ironIngotRecipe = SMITH_RECIPES.find((r) => r.id === "iron_ingot")!;

const inventoryWith = (overrides: ResourceBag): ResourceBag => ({ ...overrides });

describe("attemptSmith", () => {
  it("throws if smithing level is below requirement", () => {
    const inv = inventoryWith({ iron_ore: 10, coal: 10 });
    expect(() => attemptSmith(ironIngotRecipe, smithingLvl1, inv, 0.1)).toThrow();
  });

  it("throws if not enough ore", () => {
    const inv = inventoryWith({ copper_ore: 0, coal: 10 });
    expect(() => attemptSmith(copperIngotRecipe, smithingLvl1, inv, 0.1)).toThrow();
  });

  it("throws if not enough fuel", () => {
    const inv = inventoryWith({ copper_ore: 10, coal: 0 });
    expect(() => attemptSmith(copperIngotRecipe, smithingLvl1, inv, 0.1)).toThrow();
  });

  it("burns ore AND fuel even on a failed attempt (risk is real)", () => {
    const inv = inventoryWith({ copper_ore: 10, coal: 10 });
    const result = attemptSmith(copperIngotRecipe, smithingLvl1, inv, 0.99);
    expect(result.success).toBe(false);
    expect(result.oreSpent).toBe(copperIngotRecipe.oreCost);
    expect(result.fuelSpent).toBe(copperIngotRecipe.fuelCost);
    expect(result.ingotsGained).toBe(0);
  });

  it("grants ingots and xp on success", () => {
    const inv = inventoryWith({ copper_ore: 10, coal: 10 });
    const result = attemptSmith(copperIngotRecipe, smithingLvl1, inv, 0.01);
    expect(result.success).toBe(true);
    expect(result.ingotsGained).toBe(copperIngotRecipe.ingotYield);
    expect(result.ingotMaterialId).toBe("copper_ingot");
    expect(result.xpGained).toBe(copperIngotRecipe.baseXp);
  });
});

describe("applySmithResult", () => {
  it("correctly debits ore+fuel and credits the ingot on success", () => {
    const inv = inventoryWith({ copper_ore: 10, coal: 10 });
    const result = attemptSmith(copperIngotRecipe, smithingLvl1, inv, 0.01);
    const newInv = applySmithResult(inv, result);
    expect(newInv.copper_ore).toBe(10 - copperIngotRecipe.oreCost);
    expect(newInv.coal).toBe(10 - copperIngotRecipe.fuelCost);
    expect(newInv.copper_ingot).toBe(copperIngotRecipe.ingotYield);
  });

  it("on failure, still debits ore+fuel (the burn) but credits no ingot", () => {
    const inv = inventoryWith({ copper_ore: 10, coal: 10 });
    const result = attemptSmith(copperIngotRecipe, smithingLvl1, inv, 0.99);
    const newInv = applySmithResult(inv, result);
    expect(newInv.copper_ore).toBe(10 - copperIngotRecipe.oreCost);
    expect(newInv.coal).toBe(10 - copperIngotRecipe.fuelCost);
    expect(newInv.copper_ingot).toBeUndefined();
  });
});

describe("forge upgrades", () => {
  it("nextForgeUpgrade returns tier 1 from tier 0", () => {
    expect(nextForgeUpgrade(0)?.tier).toBe(1);
  });

  it("returns null once all upgrades are exhausted", () => {
    const maxTier = FORGE_UPGRADES[FORGE_UPGRADES.length - 1].tier;
    expect(nextForgeUpgrade(maxTier)).toBeNull();
  });

  it("canAffordForgeUpgrade respects insight cost", () => {
    expect(canAffordForgeUpgrade(10, 0)).toBe(false); // costs 50
    expect(canAffordForgeUpgrade(50, 0)).toBe(true);
  });

  it("cannot afford an upgrade that doesn't exist (max tier reached)", () => {
    const maxTier = FORGE_UPGRADES[FORGE_UPGRADES.length - 1].tier;
    expect(canAffordForgeUpgrade(1_000_000, maxTier)).toBe(false);
  });
});
