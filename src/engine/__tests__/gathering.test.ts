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

const testTiers: ToolTier[] = [
  { requiredForgeTier: 0, successChanceBonus: 0, yieldMultiplier: 1, name: "Bare Hands" },
  { requiredForgeTier: 1, successChanceBonus: 0.15, yieldMultiplier: 1.5, name: "Copper Axe" },
];

const skillLvl1: SkillState = { id: "mining", level: 1, xp: 0 };
const fresh = () => createFreshDepletionState();

describe("bestAvailableTool", () => {
  it("returns the base tier at forge tier 0", () => {
    expect(bestAvailableTool(testTiers, 0).name).toBe("Bare Hands");
  });

  it("returns the upgraded tier once forge tier meets the requirement", () => {
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
