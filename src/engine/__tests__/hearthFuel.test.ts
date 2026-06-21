import { describe, it, expect } from "vitest";
import { totalHearthFuelValue, HEARTH_FUEL_MATERIALS } from "../hearth";
import type { ResourceBag } from "../types";

describe("totalHearthFuelValue", () => {
  it("is 0 for an empty inventory", () => {
    expect(totalHearthFuelValue({})).toBe(0);
  });

  it("weights coal by its heatValue (10)", () => {
    const inv: ResourceBag = { coal: 5 };
    expect(totalHearthFuelValue(inv)).toBe(50);
  });

  it("weights wood by its heatValue (4), distinctly lower than coal", () => {
    const inv: ResourceBag = { wood: 5 };
    expect(totalHearthFuelValue(inv)).toBe(20);
  });

  it("sums contributions across multiple fuel materials", () => {
    const inv: ResourceBag = { coal: 2, wood: 3 };
    // 2*10 + 3*4 = 20 + 12 = 32
    expect(totalHearthFuelValue(inv)).toBe(32);
  });

  it("ignores non-fuel materials entirely (ore, ingots don't power the hearth)", () => {
    const inv: ResourceBag = { copper_ore: 100, copper_ingot: 50 };
    expect(totalHearthFuelValue(inv)).toBe(0);
  });

  it("HEARTH_FUEL_MATERIALS includes both coal and wood", () => {
    expect(HEARTH_FUEL_MATERIALS).toContain("coal");
    expect(HEARTH_FUEL_MATERIALS).toContain("wood");
  });
});
