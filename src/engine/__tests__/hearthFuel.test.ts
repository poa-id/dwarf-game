import { describe, it, expect } from "vitest";
import {
  totalHearthFuelValue,
  HEARTH_FUEL_MATERIALS,
  reserveBurnSecondsRemaining,
  FUEL_ABSORPTION_RATE_PER_SEC,
} from "../hearth";
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

  it("HEARTH_FUEL_MATERIALS includes coal, wood, AND charcoal", () => {
    expect(HEARTH_FUEL_MATERIALS).toContain("coal");
    expect(HEARTH_FUEL_MATERIALS).toContain("wood");
    // charcoal was a real oversight, fixed 2026-06-23 - it's a genuine
    // fuel material (heatValue 7, see types.ts) but was never wired
    // into the Hearth's own accepted-fuels list, even though it was
    // already a valid Smithing/Kiln fuel. Playtesting caught this.
    expect(HEARTH_FUEL_MATERIALS).toContain("charcoal");
  });
});

describe("reserveBurnSecondsRemaining", () => {
  it("is 0 for an empty reserve", () => {
    expect(reserveBurnSecondsRemaining({})).toBe(0);
  });

  it("converts fuel value into seconds using FUEL_ABSORPTION_RATE_PER_SEC", () => {
    const reserve: ResourceBag = { coal: 5 }; // fuel value 50
    expect(reserveBurnSecondsRemaining(reserve)).toBe(50 / FUEL_ABSORPTION_RATE_PER_SEC);
  });

  it("a single coal lasts longer than a single wood (higher heatValue)", () => {
    const coalReserve: ResourceBag = { coal: 1 };
    const woodReserve: ResourceBag = { wood: 1 };
    expect(reserveBurnSecondsRemaining(coalReserve)).toBeGreaterThan(reserveBurnSecondsRemaining(woodReserve));
  });
});
