import { describe, it, expect } from "vitest";
import {
  attemptSmith,
  applySmithResult,
  chooseFuelForRecipe,
  SMITH_RECIPES,
  nextForgeUpgrade,
  canAffordForgeUpgrade,
  FORGE_UPGRADES,
  canAffordForgeRepair,
  applyForgeRepair,
  FORGE_REPAIR_COST,
  canAffordSmithRecipe,
} from "../smithing";
import type { SkillState, ResourceBag } from "../types";

const smithingLvl1: SkillState = { id: "smithing", level: 1, xp: 0 };
const copperIngotRecipe = SMITH_RECIPES.find((r) => r.id === "copper_ingot")!;
const ironIngotRecipe = SMITH_RECIPES.find((r) => r.id === "iron_ingot")!;

const inventoryWith = (overrides: ResourceBag): ResourceBag => ({ ...overrides });

describe("canAffordSmithRecipe (2026-07-04 batch-loop fix)", () => {
  // Extracted so render.ts's batch loop can check affordability BEFORE
  // each iteration, fixing a real bug: the loop used to check the
  // PREVIOUS attempt's success/fail roll instead, which had nothing to
  // do with whether materials remained, and caused x50 batches to
  // silently stop after the first failed roll (typically within the
  // first several attempts at a well-under-100% success rate).
  it("is false when ore is short, even with plenty of fuel", () => {
    const inv = inventoryWith({ copper_ore: 1, coal: 10 });
    expect(canAffordSmithRecipe(copperIngotRecipe, inv)).toBe(false);
  });

  it("is false when no accepted fuel is held, even with plenty of ore", () => {
    const inv = inventoryWith({ copper_ore: 10 });
    expect(canAffordSmithRecipe(copperIngotRecipe, inv)).toBe(false);
  });

  it("is true when both ore and an accepted fuel are held", () => {
    const inv = inventoryWith({ copper_ore: 10, coal: 10 });
    expect(canAffordSmithRecipe(copperIngotRecipe, inv)).toBe(true);
  });

  it("picks whichever accepted fuel is actually held (charcoal bootstrap case)", () => {
    const inv = inventoryWith({ copper_ore: 10, charcoal: 10 });
    expect(canAffordSmithRecipe(copperIngotRecipe, inv)).toBe(true);
  });
});

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

describe("forge repair (tier 0 -> 1, materials-based)", () => {
  it("canAffordForgeRepair is false when missing required materials", () => {
    expect(canAffordForgeRepair({ wood: 5, copper_ore: 5 })).toBe(false); // needs 15 wood, 10 ore
  });

  it("canAffordForgeRepair is true when the cost is met exactly", () => {
    expect(canAffordForgeRepair({ ...FORGE_REPAIR_COST })).toBe(true);
  });

  it("applyForgeRepair deducts exactly the repair cost", () => {
    const inv = { wood: 20, copper_ore: 15 };
    const result = applyForgeRepair(inv);
    expect(result.wood).toBe(20 - FORGE_REPAIR_COST.wood!);
    expect(result.copper_ore).toBe(15 - FORGE_REPAIR_COST.copper_ore!);
  });
});

describe("forge upgrades (tier 1+, insight-based)", () => {
  it("nextForgeUpgrade from tier 1 (just repaired) returns tier 2, NOT a tier-1 insight cost", () => {
    expect(nextForgeUpgrade(1)?.tier).toBe(2);
  });

  it("nextForgeUpgrade(0) returns null - there is no insight-funded tier 1, it's the materials repair instead", () => {
    expect(nextForgeUpgrade(0)).toBeNull();
  });

  it("returns null once all upgrades are exhausted", () => {
    const maxTier = FORGE_UPGRADES[FORGE_UPGRADES.length - 1].tier;
    expect(nextForgeUpgrade(maxTier)).toBeNull();
  });

  it("canAffordForgeUpgrade respects insight cost for the first real upgrade (tier 2)", () => {
    expect(canAffordForgeUpgrade(100, 1)).toBe(false); // tier 2 costs 250
    expect(canAffordForgeUpgrade(250, 1)).toBe(true);
  });

  it("cannot afford an upgrade that doesn't exist (max tier reached)", () => {
    const maxTier = FORGE_UPGRADES[FORGE_UPGRADES.length - 1].tier;
    expect(canAffordForgeUpgrade(1_000_000, maxTier)).toBe(false);
  });
});

describe("multi-fuel support (charcoal as copper_ingot's early-game bootstrap fuel)", () => {
  it("copper_ingot accepts both coal and charcoal", () => {
    expect(copperIngotRecipe.acceptedFuels).toEqual(["coal", "charcoal"]);
  });

  it("iron_ingot only accepts coal - charcoal isn't hot enough", () => {
    expect(ironIngotRecipe.acceptedFuels).toEqual(["coal"]);
  });

  it("chooseFuelForRecipe prefers coal when both are held", () => {
    const inv = inventoryWith({ coal: 10, charcoal: 10 });
    expect(chooseFuelForRecipe(copperIngotRecipe, inv)).toBe("coal");
  });

  it("chooseFuelForRecipe falls back to charcoal when coal isn't held", () => {
    const inv = inventoryWith({ charcoal: 10 });
    expect(chooseFuelForRecipe(copperIngotRecipe, inv)).toBe("charcoal");
  });

  it("attemptSmith succeeds burning charcoal alone for a copper ingot", () => {
    const inv = inventoryWith({ copper_ore: 10, charcoal: 10 });
    const result = attemptSmith(copperIngotRecipe, smithingLvl1, inv, 0.01, "charcoal");
    expect(result.success).toBe(true);
    expect(result.fuelMaterialId).toBe("charcoal");
    expect(result.ingotsGained).toBe(1);
  });

  it("attemptSmith throws if charcoal is passed for iron (not hot enough)", () => {
    const inv = inventoryWith({ iron_ore: 10, charcoal: 10 });
    const ironLvl10: SkillState = { id: "smithing", level: 10, xp: 0 };
    expect(() => attemptSmith(ironIngotRecipe, ironLvl10, inv, 0.01, "charcoal")).toThrow();
  });

  it("attemptSmith throws if an unaccepted fuel is explicitly passed", () => {
    const inv = inventoryWith({ copper_ore: 10, wood: 10 });
    expect(() => attemptSmith(copperIngotRecipe, smithingLvl1, inv, 0.01, "wood")).toThrow();
  });
});
