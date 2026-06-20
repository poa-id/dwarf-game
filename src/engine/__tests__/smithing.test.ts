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
const copperIngot = SMITH_RECIPES[0];
const ironIngot = SMITH_RECIPES[1];

const inventoryWithOre = (ore: number): ResourceBag => ({
  ore,
  ingot: 0,
  fuel: 0,
  insight: 0,
});

describe("attemptSmith", () => {
  it("throws if smithing level is below requirement", () => {
    expect(() =>
      attemptSmith(ironIngot, smithingLvl1, inventoryWithOre(10), 0.1)
    ).toThrow();
  });

  it("throws if not enough ore", () => {
    expect(() =>
      attemptSmith(copperIngot, smithingLvl1, inventoryWithOre(0), 0.1)
    ).toThrow();
  });

  it("burns ore even on a failed attempt (risk is real)", () => {
    const result = attemptSmith(copperIngot, smithingLvl1, inventoryWithOre(10), 0.99);
    expect(result.success).toBe(false);
    expect(result.oreSpent).toBe(copperIngot.oreCost);
    expect(result.ingotsGained).toBe(0);
    expect(result.fuelByproduct).toBe(0);
  });

  it("grants ingots, xp, and fuel byproduct on success", () => {
    const result = attemptSmith(copperIngot, smithingLvl1, inventoryWithOre(10), 0.01);
    expect(result.success).toBe(true);
    expect(result.ingotsGained).toBe(copperIngot.ingotYield);
    expect(result.xpGained).toBe(copperIngot.baseXp);
    expect(result.fuelByproduct).toBeGreaterThan(0);
  });
});

describe("applySmithResult", () => {
  it("correctly debits ore and credits ingot+fuel on success", () => {
    const inv = inventoryWithOre(10);
    const result = attemptSmith(copperIngot, smithingLvl1, inv, 0.01);
    const newInv = applySmithResult(inv, result);
    expect(newInv.ore).toBe(10 - copperIngot.oreCost);
    expect(newInv.ingot).toBe(copperIngot.ingotYield);
    expect(newInv.fuel).toBeGreaterThan(0);
  });

  it("on failure, still debits ore (the burn) but credits nothing else", () => {
    const inv = inventoryWithOre(10);
    const result = attemptSmith(copperIngot, smithingLvl1, inv, 0.99);
    const newInv = applySmithResult(inv, result);
    expect(newInv.ore).toBe(10 - copperIngot.oreCost);
    expect(newInv.ingot).toBe(0);
    expect(newInv.fuel).toBe(0);
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
