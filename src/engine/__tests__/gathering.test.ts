import { describe, it, expect } from "vitest";
import {
  attemptGatherStrike,
  applyGatherResult,
  bestAvailableTool,
  createFreshDepletionState,
  remainingYield,
  isExhausted,
  type GatherableNode,
  type ToolTier,
} from "../gathering";
import type { SkillState, ResourceBag } from "../types";

const testNode: GatherableNode = {
  id: "test_node",
  name: "Test Node",
  materialId: "wood",
  requiredLevel: 1,
  baseXp: 5,
  baseYield: 1,
  baseSuccessChance: 0.8,
  totalYieldCapacity: 10,
};

// A gem-bearing variant, added 2026-06-23 alongside the Gemcutting
// station - only Mining's real rock nodes have a gemDrop config in
// production (mining.ts), but the mechanism itself lives in this
// shared file, so it's tested here against a synthetic fixture.
const gemBearingNode: GatherableNode = {
  ...testNode,
  id: "test_gem_node",
  gemDrop: { materialId: "rough_quartz", baseChance: 0.1 },
};

const testTiers: ToolTier[] = [
  { tier: 0, successChanceBonus: 0, yieldMultiplier: 1, name: "Bare Hands" },
  { tier: 1, successChanceBonus: 0.15, yieldMultiplier: 1.5, name: "Copper Axe" },
];

const skillLvl1: SkillState = { id: "mining", level: 1, xp: 0 };
const fresh = () => createFreshDepletionState();

describe("bestAvailableTool", () => {
  it("returns the base tier at forged tool tier 0", () => {
    expect(bestAvailableTool(testTiers, 0).name).toBe("Bare Hands");
  });

  it("returns the upgraded tier once the forged tool tier meets the requirement", () => {
    expect(bestAvailableTool(testTiers, 1).name).toBe("Copper Axe");
  });
});

describe("attemptGatherStrike - skill agnostic behavior", () => {
  it("works identically regardless of which 'skill' (SkillId) is passed - it's just a level check", () => {
    const woodcraftSkill: SkillState = { id: "hearthkeeping", level: 1, xp: 0 }; // deliberately a mismatched id, to prove this function doesn't care
    expect(() =>
      attemptGatherStrike(testNode, woodcraftSkill, testTiers[0], fresh(), 0.1)
    ).not.toThrow();
  });

  it("throws if skill level is below the node's requirement", () => {
    const tooWeak: SkillState = { id: "mining", level: 0, xp: 0 };
    const demandingNode = { ...testNode, requiredLevel: 5 };
    expect(() => attemptGatherStrike(demandingNode, tooWeak, testTiers[0], fresh(), 0.1)).toThrow();
  });

  it("throws if the node is already exhausted", () => {
    const exhausted = { totalYielded: testNode.totalYieldCapacity! };
    expect(() => attemptGatherStrike(testNode, skillLvl1, testTiers[0], exhausted, 0.1)).toThrow();
  });

  it("better tools increase both success chance and yield", () => {
    const bare = attemptGatherStrike(testNode, skillLvl1, testTiers[0], fresh(), 0.79);
    const upgraded = attemptGatherStrike(testNode, skillLvl1, testTiers[1], fresh(), 0.79);
    // 0.79 succeeds with bare hands (0.8 chance) already - check yield difference instead
    expect(upgraded.amountGained).toBeGreaterThanOrEqual(bare.amountGained);

    const justBeyondBase = 0.85; // fails bare hands (0.8), succeeds with +0.15 bonus tool (0.95)
    const bareFail = attemptGatherStrike(testNode, skillLvl1, testTiers[0], fresh(), justBeyondBase);
    const upgradedSuccess = attemptGatherStrike(testNode, skillLvl1, testTiers[1], fresh(), justBeyondBase);
    expect(bareFail.success).toBe(false);
    expect(upgradedSuccess.success).toBe(true);
  });

  it("respects the node's own materialId, regardless of tool used", () => {
    const result = attemptGatherStrike(testNode, skillLvl1, testTiers[1], fresh(), 0.1);
    expect(result.materialId).toBe("wood");
  });
});

describe("depletion - generic", () => {
  it("a fresh node has its full capacity remaining", () => {
    expect(remainingYield(testNode, fresh())).toBe(10);
  });

  it("isExhausted is false for a totalYieldCapacity=null node no matter how much was yielded", () => {
    const neverDepletes = { ...testNode, totalYieldCapacity: null };
    expect(isExhausted(neverDepletes, { totalYielded: 999999 })).toBe(false);
  });
});

describe("applyGatherResult", () => {
  it("adds yielded material to an arbitrary resource bag, regardless of which skill produced it", () => {
    const inv: ResourceBag = {};
    const result = attemptGatherStrike(testNode, skillLvl1, testTiers[0], fresh(), 0.1);
    const newInv = applyGatherResult(inv, result);
    if (result.success) {
      expect(newInv.wood).toBe(result.amountGained);
    }
  });
});

describe("gem drops (added 2026-06-23, alongside the Gemcutting station)", () => {
  it("a node with no gemDrop config never produces a gem, regardless of gemRoll", () => {
    const result = attemptGatherStrike(testNode, skillLvl1, testTiers[0], fresh(), 0.1, 0.0001);
    expect(result.gemGained).toBeNull();
  });

  it("gemRoll and the strike's own success roll are INDEPENDENT - a roll that wins the gem check still requires the strike itself to succeed", () => {
    // roll=0.99 fails the strike (baseSuccessChance 0.8) regardless of
    // how favorable gemRoll is - a failed strike never reaches the gem
    // check at all, per attemptGatherStrike's early return on failure.
    const result = attemptGatherStrike(gemBearingNode, skillLvl1, testTiers[0], fresh(), 0.99, 0.0001);
    expect(result.success).toBe(false);
    expect(result.gemGained).toBeNull();
  });

  it("a successful strike with a winning gemRoll produces the configured gem material", () => {
    const result = attemptGatherStrike(gemBearingNode, skillLvl1, testTiers[0], fresh(), 0.01, 0.05); // gemRoll 0.05 < baseChance 0.1
    expect(result.success).toBe(true);
    expect(result.gemGained).toBe("rough_quartz");
  });

  it("a successful strike with a losing gemRoll produces no gem", () => {
    const result = attemptGatherStrike(gemBearingNode, skillLvl1, testTiers[0], fresh(), 0.01, 0.5); // gemRoll 0.5 > baseChance 0.1
    expect(result.success).toBe(true);
    expect(result.gemGained).toBeNull();
  });

  it("gemDropChanceBonus raises the effective chance additively, capped at 1", () => {
    // baseChance 0.1 + bonus 0.85 = 0.95 effective chance - a gemRoll
    // of 0.92 should now win, even though it would lose against the
    // base chance alone.
    const result = attemptGatherStrike(gemBearingNode, skillLvl1, testTiers[0], fresh(), 0.01, 0.92, 0.85);
    expect(result.gemGained).toBe("rough_quartz");
  });

  it("gemRoll defaults to 1 (never wins) for callers not yet passing it - existing callers stay unaffected", () => {
    const result = attemptGatherStrike(gemBearingNode, skillLvl1, testTiers[0], fresh(), 0.01);
    expect(result.gemGained).toBeNull();
  });

  it("applyGatherResult adds the gem to inventory alongside the normal material, on a win", () => {
    const inv: ResourceBag = {};
    const result = attemptGatherStrike(gemBearingNode, skillLvl1, testTiers[0], fresh(), 0.01, 0.05);
    const newInv = applyGatherResult(inv, result);
    expect(newInv.wood).toBeGreaterThan(0); // the normal yield still happens
    expect(newInv.rough_quartz).toBe(1); // the bonus gem on top
  });

  it("applyGatherResult adds nothing extra when gemGained is null", () => {
    const inv: ResourceBag = {};
    const result = attemptGatherStrike(gemBearingNode, skillLvl1, testTiers[0], fresh(), 0.01, 0.99);
    const newInv = applyGatherResult(inv, result);
    expect(newInv.rough_quartz ?? 0).toBe(0);
  });
});
