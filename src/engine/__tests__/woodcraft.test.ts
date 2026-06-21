import { describe, it, expect } from "vitest";
import {
  attemptWoodGather,
  applyWoodGatherResult,
  WOOD_NODES,
  bestAvailableAxe,
  AXE_TIERS,
} from "../woodcraft";
import { createFreshDepletionState, remainingYield, isExhausted } from "../gathering";
import type { SkillState, ResourceBag } from "../types";

const woodcraftLvl1: SkillState = { id: "woodcraft", level: 1, xp: 0 };
const rootTangle = WOOD_NODES.find((n) => n.id === "root_tangle")!;
const fresh = () => createFreshDepletionState();

describe("bestAvailableAxe", () => {
  it("returns bare hands at forge tier 0", () => {
    expect(bestAvailableAxe(0).name).toBe("Bare Hands");
  });

  it("returns the better axe once forge tier supports it", () => {
    expect(bestAvailableAxe(1).name).toBe("Copper Hatchet");
  });

  it("caps at the best defined tier", () => {
    expect(bestAvailableAxe(99).name).toBe(AXE_TIERS[AXE_TIERS.length - 1].name);
  });
});

describe("attemptWoodGather", () => {
  it("yields the wood material on success", () => {
    const result = attemptWoodGather(rootTangle, woodcraftLvl1, 0, fresh(), 0.1);
    expect(result.success).toBe(true);
    expect(result.materialId).toBe("wood");
  });

  it("grants no xp/material on a failed gather", () => {
    const result = attemptWoodGather(rootTangle, woodcraftLvl1, 0, fresh(), 0.99);
    expect(result.success).toBe(false);
    expect(result.amountGained).toBe(0);
  });

  it("a better axe increases yield", () => {
    const bare = attemptWoodGather(rootTangle, woodcraftLvl1, 0, fresh(), 0.1);
    const upgraded = attemptWoodGather(rootTangle, woodcraftLvl1, 1, fresh(), 0.1);
    expect(upgraded.amountGained).toBeGreaterThanOrEqual(bare.amountGained);
  });

  it("depletes correctly and matches the generic gathering depletion behavior", () => {
    let depletion = fresh();
    const result = attemptWoodGather(rootTangle, woodcraftLvl1, 0, depletion, 0.1);
    depletion = result.newDepletion;
    expect(remainingYield(rootTangle, depletion)).toBe(
      rootTangle.totalYieldCapacity! - result.amountGained
    );
  });

  it("throws once the node is exhausted", () => {
    const exhausted = { totalYielded: rootTangle.totalYieldCapacity! };
    expect(isExhausted(rootTangle, exhausted)).toBe(true);
    expect(() => attemptWoodGather(rootTangle, woodcraftLvl1, 0, exhausted, 0.1)).toThrow();
  });
});

describe("applyWoodGatherResult", () => {
  it("adds wood to inventory on success", () => {
    const inv: ResourceBag = {};
    const result = attemptWoodGather(rootTangle, woodcraftLvl1, 0, fresh(), 0.1);
    const newInv = applyWoodGatherResult(inv, result);
    expect(newInv.wood).toBe(result.amountGained);
  });
});
