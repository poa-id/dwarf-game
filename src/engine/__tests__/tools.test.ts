import { describe, it, expect } from "vitest";
import {
  TOOL_RECIPES,
  nextToolRecipe,
  attemptForgeTool,
  applyForgeToolResult,
} from "../smithing";
import type { SkillState, ResourceBag, ToolsForgedState } from "../types";

const smithingLvl1: SkillState = { id: "smithing", level: 1, xp: 0 };
const smithingLvl10: SkillState = { id: "smithing", level: 10, xp: 0 };

const copperPickaxe = TOOL_RECIPES.find((r) => r.id === "copper_pickaxe")!;
const ironPickaxe = TOOL_RECIPES.find((r) => r.id === "iron_pickaxe")!;
const copperAxe = TOOL_RECIPES.find((r) => r.id === "copper_axe")!;

const inventoryWith = (overrides: ResourceBag): ResourceBag => ({ ...overrides });
const bareHands: ToolsForgedState = { pickaxe: 0, axe: 0 };

describe("TOOL_RECIPES", () => {
  it("has tier-1, tier-2, and tier-3 recipes for both pickaxe and axe slots", () => {
    const pickaxeTiers = TOOL_RECIPES.filter((r) => r.slot === "pickaxe").map((r) => r.tier);
    const axeTiers = TOOL_RECIPES.filter((r) => r.slot === "axe").map((r) => r.tier);
    expect(pickaxeTiers).toEqual([1, 2, 3]);
    expect(axeTiers).toEqual([1, 2, 3]);
  });

  it("every recipe has ingotCost > 0", () => {
    for (const recipe of TOOL_RECIPES) {
      expect(recipe.ingotCost).toBeGreaterThan(0);
    }
  });

  it("tier 1 uses regular wood; tier 2 uses ironwood, tier 3 uses gemwood (via woodAltId)", () => {
    const tier1 = TOOL_RECIPES.filter((r) => r.tier === 1);
    const tier2 = TOOL_RECIPES.filter((r) => r.tier === 2);
    const tier3 = TOOL_RECIPES.filter((r) => r.tier === 3);
    for (const r of tier1) expect(r.woodCost).toBeGreaterThan(0);
    for (const r of tier2) {
      expect(r.woodCost).toBe(0);
      expect(r.woodAltId).toBe("ironwood");
      expect(r.woodAltCost).toBeGreaterThan(0);
    }
    for (const r of tier3) {
      expect(r.woodCost).toBe(0);
      expect(r.woodAltId).toBe("gemwood");
      expect(r.woodAltCost).toBeGreaterThan(0);
    }
  });
});

describe("nextToolRecipe", () => {
  it("returns the tier-1 recipe when nothing has been forged yet", () => {
    expect(nextToolRecipe("pickaxe", bareHands)?.id).toBe("copper_pickaxe");
    expect(nextToolRecipe("axe", bareHands)?.id).toBe("copper_axe");
  });

  it("returns the tier-2 recipe once tier 1 has been forged", () => {
    const afterTier1: ToolsForgedState = { pickaxe: 1, axe: 0 };
    expect(nextToolRecipe("pickaxe", afterTier1)?.id).toBe("iron_pickaxe");
  });

  it("returns the tier-3 recipe once tier 2 has been forged", () => {
    const afterTier2: ToolsForgedState = { pickaxe: 2, axe: 2 };
    expect(nextToolRecipe("pickaxe", afterTier2)?.id).toBe("deepstone_pickaxe");
    expect(nextToolRecipe("axe", afterTier2)?.id).toBe("deepstone_axe");
  });

  it("returns null once the highest defined tier (3) has been forged", () => {
    const maxedOut: ToolsForgedState = { pickaxe: 3, axe: 3 };
    expect(nextToolRecipe("pickaxe", maxedOut)).toBeNull();
    expect(nextToolRecipe("axe", maxedOut)).toBeNull();
  });

  it("slots are independent - forging a pickaxe doesn't advance the axe slot", () => {
    const pickaxeOnly: ToolsForgedState = { pickaxe: 1, axe: 0 };
    expect(nextToolRecipe("axe", pickaxeOnly)?.id).toBe("copper_axe");
  });
});

describe("attemptForgeTool", () => {
  it("throws if smithing level is below the recipe requirement", () => {
    const inv = inventoryWith({ iron_ingot: 10, wood: 10, coal: 10 });
    expect(() => attemptForgeTool(ironPickaxe, smithingLvl1, inv, bareHands, 0.1)).toThrow();
  });

  it("throws if tiers are forged out of order (skipping tier 1)", () => {
    const inv = inventoryWith({ iron_ingot: 10, wood: 10, coal: 10 });
    expect(() => attemptForgeTool(ironPickaxe, smithingLvl10, inv, bareHands, 0.1)).toThrow();
  });

  it("throws if re-forging a tier already held (not out of order, just redundant)", () => {
    const inv = inventoryWith({ copper_ingot: 10, wood: 10, coal: 10 });
    const alreadyTier1: ToolsForgedState = { pickaxe: 1, axe: 0 };
    expect(() => attemptForgeTool(copperPickaxe, smithingLvl1, inv, alreadyTier1, 0.1)).toThrow();
  });

  it("throws if not enough ingot", () => {
    const inv = inventoryWith({ copper_ingot: 0, wood: 10, coal: 10 });
    expect(() => attemptForgeTool(copperPickaxe, smithingLvl1, inv, bareHands, 0.1)).toThrow();
  });

  it("throws if not enough wood", () => {
    const inv = inventoryWith({ copper_ingot: 10, wood: 0, coal: 10 });
    expect(() => attemptForgeTool(copperPickaxe, smithingLvl1, inv, bareHands, 0.1)).toThrow();
  });

  it("throws if not enough fuel", () => {
    const inv = inventoryWith({ copper_ingot: 10, wood: 10, coal: 0, charcoal: 0 });
    expect(() => attemptForgeTool(copperPickaxe, smithingLvl1, inv, bareHands, 0.1)).toThrow();
  });

  it("accepts charcoal as a valid fuel for copper-tier tool", () => {
    const inv = inventoryWith({ copper_ingot: 10, wood: 10, charcoal: 10 });
    const result = attemptForgeTool(copperPickaxe, smithingLvl1, inv, bareHands, 0.01, "charcoal");
    expect(result.success).toBe(true);
  });

  it("on success, reports the tier forged and consumes ingot+wood+fuel", () => {
    const inv = inventoryWith({ copper_ingot: 10, wood: 10, coal: 10 });
    const result = attemptForgeTool(copperPickaxe, smithingLvl1, inv, bareHands, 0.01);
    expect(result.success).toBe(true);
    expect(result.slot).toBe("pickaxe");
    expect(result.tierForged).toBe(1);
    expect(result.ingotSpent).toBe(copperPickaxe.ingotCost);
    expect(result.woodSpent).toBe(copperPickaxe.woodCost);
    expect(result.woodMaterialId).toBe("wood");
    expect(result.fuelSpent).toBe(copperPickaxe.fuelCost);
  });

  it("on failure, still spends materials but tierForged reflects the UNCHANGED tier", () => {
    const inv = inventoryWith({ copper_ingot: 10, wood: 10, coal: 10 });
    const result = attemptForgeTool(copperPickaxe, smithingLvl1, inv, bareHands, 0.99);
    expect(result.success).toBe(false);
    expect(result.tierForged).toBe(0);
    expect(result.ingotSpent).toBe(copperPickaxe.ingotCost);
  });

  it("grants smithing xp on success", () => {
    const inv = inventoryWith({ copper_ingot: 10, wood: 10, coal: 10 });
    const result = attemptForgeTool(copperPickaxe, smithingLvl1, inv, bareHands, 0.01);
    expect(result.xpGained).toBe(copperPickaxe.baseXp);
  });
});

describe("applyForgeToolResult", () => {
  it("on success, deducts materials AND bumps toolsForged for the right slot only", () => {
    const inv = inventoryWith({ copper_ingot: 10, wood: 10, coal: 10 });
    const result = attemptForgeTool(copperPickaxe, smithingLvl1, inv, bareHands, 0.01);
    const { inventory, toolsForged } = applyForgeToolResult(inv, bareHands, result);

    expect(inventory.copper_ingot).toBe(10 - copperPickaxe.ingotCost);
    expect(inventory.wood).toBe(10 - copperPickaxe.woodCost);
    expect(inventory.coal).toBe(10 - copperPickaxe.fuelCost);
    expect(toolsForged.pickaxe).toBe(1);
    expect(toolsForged.axe).toBe(0);
  });

  it("on failure, deducts materials but does NOT bump toolsForged", () => {
    const inv = inventoryWith({ copper_ingot: 10, wood: 10, coal: 10 });
    const result = attemptForgeTool(copperPickaxe, smithingLvl1, inv, bareHands, 0.99);
    const { inventory, toolsForged } = applyForgeToolResult(inv, bareHands, result);

    expect(inventory.copper_ingot).toBe(10 - copperPickaxe.ingotCost);
    expect(toolsForged.pickaxe).toBe(0);
  });

  it("forging a second slot (axe) after the first (pickaxe) preserves both independently", () => {
    const inv = inventoryWith({ copper_ingot: 10, wood: 10, coal: 10 });
    const pickaxeResult = attemptForgeTool(copperPickaxe, smithingLvl1, inv, bareHands, 0.01);
    const afterPickaxe = applyForgeToolResult(inv, bareHands, pickaxeResult);

    const axeResult = attemptForgeTool(
      copperAxe,
      smithingLvl1,
      afterPickaxe.inventory,
      afterPickaxe.toolsForged,
      0.01
    );
    const afterAxe = applyForgeToolResult(afterPickaxe.inventory, afterPickaxe.toolsForged, axeResult);

    expect(afterAxe.toolsForged).toEqual({ pickaxe: 1, axe: 1 });
  });
});
