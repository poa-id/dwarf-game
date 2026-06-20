import { describe, it, expect } from "vitest";
import { attemptMineStrike, ROCK_NODES, bestAvailablePickaxe, PICKAXE_TIERS } from "../mining";
import type { SkillState } from "../types";

const miningLvl1: SkillState = { id: "mining", level: 1, xp: 0 };
const copperVein = ROCK_NODES[0];
const ironVein = ROCK_NODES[1];

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
    expect(() => attemptMineStrike(ironVein, miningLvl1, 0, 0.1)).toThrow();
  });

  it("succeeds when roll is below success chance, fails when above", () => {
    // copperVein baseSuccessChance = 0.9, bare hands gives +0 bonus
    const successResult = attemptMineStrike(copperVein, miningLvl1, 0, 0.5);
    expect(successResult.success).toBe(true);

    const failResult = attemptMineStrike(copperVein, miningLvl1, 0, 0.95);
    expect(failResult.success).toBe(false);
  });

  it("grants no xp or ore on a failed strike", () => {
    const result = attemptMineStrike(copperVein, miningLvl1, 0, 0.99);
    expect(result.xpGained).toBe(0);
    expect(result.oreGained).toBe(0);
  });

  it("better tools increase yield on success", () => {
    const bareHands = attemptMineStrike(copperVein, miningLvl1, 0, 0.1);
    const ironPick = attemptMineStrike(copperVein, miningLvl1, 2, 0.1);
    expect(ironPick.oreGained).toBeGreaterThan(bareHands.oreGained);
  });

  it("better tools increase success chance (fewer rolls fail)", () => {
    // roll of 0.92 fails with bare hands (0.9 chance) but succeeds with iron pick (+0.2 = 1.0 capped)
    const bareHands = attemptMineStrike(copperVein, miningLvl1, 0, 0.92);
    const ironPick = attemptMineStrike(copperVein, miningLvl1, 2, 0.92);
    expect(bareHands.success).toBe(false);
    expect(ironPick.success).toBe(true);
  });

  it("reports leveledUp correctly when xp crosses a level boundary", () => {
    // Push xp right up near the level 1->2 boundary, then strike
    const almostLevel2: SkillState = { id: "mining", level: 1, xp: 40 }; // xpForLevel(1) = 50
    const result = attemptMineStrike(copperVein, almostLevel2, 0, 0.1); // copperVein baseXp = 8
    expect(result.newLevel).toBe(1); // 40+8=48, still below 50
    const closer: SkillState = { id: "mining", level: 1, xp: 45 };
    const result2 = attemptMineStrike(copperVein, closer, 0, 0.1); // 45+8=53 >= 50
    expect(result2.leveledUp).toBe(true);
    expect(result2.newLevel).toBe(2);
  });
});
