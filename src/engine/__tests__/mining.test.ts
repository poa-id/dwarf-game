import { describe, it, expect } from "vitest";
import {
  attemptMineStrike,
  applyMineResult,
  ROCK_NODES,
  bestAvailablePickaxe,
  PICKAXE_TIERS,
  createFreshDepletionState,
  remainingYield,
  isExhausted,
} from "../mining";
import type { SkillState, ResourceBag } from "../types";

const miningLvl1: SkillState = { id: "mining", level: 1, xp: 0 };
const copperVein = ROCK_NODES.find((n) => n.id === "copper_vein")!;
const ironVein = ROCK_NODES.find((n) => n.id === "iron_vein")!;
const fresh = () => createFreshDepletionState();

describe("bestAvailablePickaxe", () => {
  it("returns bare hands at forge tier 0", () => {
    expect(bestAvailablePickaxe(0).name).toBe("Bare Hands");
  });

  it("returns the highest tier the forge supports", () => {
    expect(bestAvailablePickaxe(2).name).toBe("Iron Pick");
  });

  it("caps at the best tool even if forgeTier exceeds defined tiers", () => {
    expect(bestAvailablePickaxe(99).name).toBe(PICKAXE_TIERS[PICKAXE_TIERS.length - 1].name);
  });
});

describe("attemptMineStrike", () => {
  it("throws if mining level is below the node requirement", () => {
    expect(() => attemptMineStrike(ironVein, miningLvl1, 0, fresh(), 0.1)).toThrow();
  });

  it("throws if the node is already exhausted", () => {
    const exhausted = { totalYielded: copperVein.totalYieldCapacity! };
    expect(() => attemptMineStrike(copperVein, miningLvl1, 0, exhausted, 0.1)).toThrow();
  });

  it("succeeds when roll is below success chance, fails when above", () => {
    const successResult = attemptMineStrike(copperVein, miningLvl1, 0, fresh(), 0.5);
    expect(successResult.success).toBe(true);

    const failResult = attemptMineStrike(copperVein, miningLvl1, 0, fresh(), 0.95);
    expect(failResult.success).toBe(false);
  });

  it("grants no xp or material on a failed strike", () => {
    const result = attemptMineStrike(copperVein, miningLvl1, 0, fresh(), 0.99);
    expect(result.xpGained).toBe(0);
    expect(result.amountGained).toBe(0);
  });

  it("reports the correct materialId from the node", () => {
    const result = attemptMineStrike(copperVein, miningLvl1, 0, fresh(), 0.1);
    expect(result.materialId).toBe("copper_ore");
  });

  it("better tools increase yield on success", () => {
    const bareHands = attemptMineStrike(copperVein, miningLvl1, 0, fresh(), 0.1);
    const ironPick = attemptMineStrike(copperVein, miningLvl1, 2, fresh(), 0.1);
    expect(ironPick.amountGained).toBeGreaterThan(bareHands.amountGained);
  });

  it("better tools increase success chance (fewer rolls fail)", () => {
    const bareHands = attemptMineStrike(copperVein, miningLvl1, 0, fresh(), 0.92);
    const ironPick = attemptMineStrike(copperVein, miningLvl1, 2, fresh(), 0.92);
    expect(bareHands.success).toBe(false);
    expect(ironPick.success).toBe(true);
  });

  it("reports leveledUp correctly when xp crosses a level boundary", () => {
    const almostLevel2: SkillState = { id: "mining", level: 1, xp: 40 };
    const result = attemptMineStrike(copperVein, almostLevel2, 0, fresh(), 0.1);
    expect(result.newLevel).toBe(1);
    const closer: SkillState = { id: "mining", level: 1, xp: 45 };
    const result2 = attemptMineStrike(copperVein, closer, 0, fresh(), 0.1);
    expect(result2.leveledUp).toBe(true);
    expect(result2.newLevel).toBe(2);
  });
});

describe("depletion", () => {
  it("a fresh node has its full capacity remaining", () => {
    expect(remainingYield(copperVein, fresh())).toBe(copperVein.totalYieldCapacity);
  });

  it("a node with totalYieldCapacity=null never reports exhausted, regardless of yielded amount", () => {
    expect(ironVein.totalYieldCapacity).toBeNull();
    const heavilyMined = { totalYielded: 1_000_000 };
    expect(remainingYield(ironVein, heavilyMined)).toBeNull();
    expect(isExhausted(ironVein, heavilyMined)).toBe(false);
  });

  it("successive successful strikes reduce remaining yield", () => {
    let depletion = fresh();
    const result = attemptMineStrike(copperVein, miningLvl1, 0, depletion, 0.1);
    depletion = result.newDepletion;
    const remaining = remainingYield(copperVein, depletion);
    expect(remaining).toBe(copperVein.totalYieldCapacity! - result.amountGained);
  });

  it("a failed strike does not change depletion state", () => {
    const depletion = fresh();
    const result = attemptMineStrike(copperVein, miningLvl1, 0, depletion, 0.99);
    expect(result.newDepletion).toEqual(depletion);
  });

  it("yield is capped at whatever remains - cannot overdraw an almost-exhausted node", () => {
    const almostGone = { totalYielded: copperVein.totalYieldCapacity! - 1 };
    const result = attemptMineStrike(copperVein, miningLvl1, 3, almostGone, 0.01);
    expect(result.amountGained).toBeLessThanOrEqual(1);
    expect(remainingYield(copperVein, result.newDepletion)).toBe(0);
  });

  it("isExhausted becomes true exactly when remaining hits zero", () => {
    const exactlyDepleted = { totalYielded: copperVein.totalYieldCapacity! };
    expect(isExhausted(copperVein, exactlyDepleted)).toBe(true);
  });
});

describe("applyMineResult", () => {
  const emptyInventory: ResourceBag = {};

  it("adds the correct material and amount on success", () => {
    const result = attemptMineStrike(copperVein, miningLvl1, 0, fresh(), 0.1);
    const newInv = applyMineResult(emptyInventory, result);
    expect(newInv.copper_ore).toBe(result.amountGained);
  });

  it("does not change inventory on a failed strike", () => {
    const result = attemptMineStrike(copperVein, miningLvl1, 0, fresh(), 0.99);
    const newInv = applyMineResult(emptyInventory, result);
    expect(newInv).toEqual(emptyInventory);
  });

  it("accumulates correctly across multiple applications", () => {
    let inventory: ResourceBag = {};
    let depletion = fresh();
    for (let i = 0; i < 3; i++) {
      const result = attemptMineStrike(copperVein, miningLvl1, 0, depletion, 0.1);
      inventory = applyMineResult(inventory, result);
      depletion = result.newDepletion;
    }
    expect(inventory.copper_ore).toBeGreaterThan(0);
  });
});
