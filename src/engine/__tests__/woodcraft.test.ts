import { describe, it, expect } from "vitest";
import {
  attemptWoodGather,
  applyWoodGatherResult,
  WOOD_NODES,
  bestAvailableAxe,
  AXE_TIERS,
  type WoodNode,
} from "../woodcraft";
import { createFreshDepletionState, remainingYield, isExhausted } from "../gathering";
import type { SkillState, ResourceBag } from "../types";

const woodcraftLvl1: SkillState = { id: "woodcraft", level: 1, xp: 0 };
const rootTangle = WOOD_NODES.find((n) => n.id === "root_tangle")!;
const fresh = () => createFreshDepletionState();

// root_tangle became infinite on 2026-06-23 (was the only wood source
// in the game - exhausting it was a permanent deadlock, see its
// comment in woodcraft.ts). Exhaustion is gathering.ts's GENERIC
// mechanism though, and still needs real coverage - hence this
// synthetic finite fixture, rather than depending on any particular
// game-content node staying finite.
const finiteTestNode: WoodNode = {
  id: "test_finite_wood",
  name: "Test Finite Wood",
  materialId: "wood",
  requiredLevel: 1,
  baseXp: 7,
  baseYield: 1,
  baseSuccessChance: 0.88,
  totalYieldCapacity: 50,
};

describe("bestAvailableAxe", () => {
  it("returns bare hands at forged axe tier 0", () => {
    expect(bestAvailableAxe(0).name).toBe("Bare Hands");
  });

  it("returns the better axe once the forged tier supports it", () => {
    expect(bestAvailableAxe(1).name).toBe("Copper Axe");
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
    const result = attemptWoodGather(finiteTestNode, woodcraftLvl1, 0, depletion, 0.1);
    depletion = result.newDepletion;
    expect(remainingYield(finiteTestNode, depletion)).toBe(
      finiteTestNode.totalYieldCapacity! - result.amountGained
    );
  });

  it("throws once the node is exhausted", () => {
    const exhausted = { totalYielded: finiteTestNode.totalYieldCapacity! };
    expect(isExhausted(finiteTestNode, exhausted)).toBe(true);
    expect(() => attemptWoodGather(finiteTestNode, woodcraftLvl1, 0, exhausted, 0.1)).toThrow();
  });

  it("root_tangle itself is infinite (2026-06-23 fix - was the only wood source in the game, exhausting it was a permanent deadlock)", () => {
    expect(rootTangle.totalYieldCapacity).toBeNull();
    const heavilyGathered = { totalYielded: 1_000_000 };
    expect(isExhausted(rootTangle, heavilyGathered)).toBe(false);
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
