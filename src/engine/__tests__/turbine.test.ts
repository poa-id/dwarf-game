import { describe, it, expect } from "vitest";
import {
  TURBINE_BUILD_COST,
  TURBINE_BUILD_INSIGHT_COST,
  TURBINE_REQUIRED_SHAFT_DEPTH,
  TURBINE_SMELT_SPEED_MULTIPLIER,
  canAffordTurbineBuild,
  applyTurbineBuild,
} from "../turbine";
import type { ResourceBag } from "../types";

const fullMaterials: ResourceBag = { ...TURBINE_BUILD_COST };

describe("Turbine build gate", () => {
  it("requires Mine Shaft depth 2 - locked out entirely below that, regardless of materials/Insight", () => {
    expect(canAffordTurbineBuild(fullMaterials, TURBINE_BUILD_INSIGHT_COST, 0)).toBe(false);
    expect(canAffordTurbineBuild(fullMaterials, TURBINE_BUILD_INSIGHT_COST, 1)).toBe(false);
    expect(canAffordTurbineBuild(fullMaterials, TURBINE_BUILD_INSIGHT_COST, TURBINE_REQUIRED_SHAFT_DEPTH)).toBe(true);
  });

  it("requires both enough Insight and enough materials once the depth gate is met", () => {
    expect(canAffordTurbineBuild(fullMaterials, TURBINE_BUILD_INSIGHT_COST - 1, TURBINE_REQUIRED_SHAFT_DEPTH)).toBe(false);
    expect(canAffordTurbineBuild({}, TURBINE_BUILD_INSIGHT_COST, TURBINE_REQUIRED_SHAFT_DEPTH)).toBe(false);
    expect(canAffordTurbineBuild(fullMaterials, TURBINE_BUILD_INSIGHT_COST, TURBINE_REQUIRED_SHAFT_DEPTH)).toBe(true);
  });

  it("even at a much deeper shaft depth, still requires materials/Insight (depth is a gate, not a substitute)", () => {
    expect(canAffordTurbineBuild({}, 0, 10)).toBe(false);
  });

  it("applyTurbineBuild deducts both materials and Insight", () => {
    const inv = { iron_ingot: 100, copper_ingot: 100, deepstone_ingot: 100 };
    const result = applyTurbineBuild(inv, 5000);
    expect(result.insightBanked).toBe(5000 - TURBINE_BUILD_INSIGHT_COST);
    expect(result.inventory.iron_ingot).toBe(100 - TURBINE_BUILD_COST.iron_ingot!);
    expect(result.inventory.copper_ingot).toBe(100 - TURBINE_BUILD_COST.copper_ingot!);
    expect(result.inventory.deepstone_ingot).toBe(100 - TURBINE_BUILD_COST.deepstone_ingot!);
  });
});

describe("TURBINE_SMELT_SPEED_MULTIPLIER", () => {
  it("is a meaningful speedup, not a token bonus", () => {
    expect(TURBINE_SMELT_SPEED_MULTIPLIER).toBeGreaterThanOrEqual(2);
  });
});
