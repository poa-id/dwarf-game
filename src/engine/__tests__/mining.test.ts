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
  type RockNode,
} from "../mining";
import type { SkillState, ResourceBag } from "../types";

const miningLvl1: SkillState = { id: "mining", level: 1, xp: 0 };
const copperVein = ROCK_NODES.find((n) => n.id === "copper_vein")!;
const ironVein = ROCK_NODES.find((n) => n.id === "iron_vein")!;
const fresh = () => createFreshDepletionState();

// Every real RockNode is now infinite (totalYieldCapacity: null) -
// copper_vein/wood became infinite on 2026-06-23 specifically to fix a
// permanent-deadlock bug (see mining.ts's comment on copper_vein), and
// iron_vein/coal_seam/deepstone were always null pending the real mine.
// Exhaustion is gathering.ts's GENERIC mechanism though, and still
// needs real test coverage - hence this synthetic finite node, rather
// than relying on any particular game-content node staying finite.
const finiteTestNode: RockNode = {
  id: "test_finite_vein",
  name: "Test Finite Vein",
  materialId: "copper_ore",
  requiredLevel: 1,
  baseXp: 8,
  baseYield: 1,
  baseSuccessChance: 0.9,
  totalYieldCapacity: 40,
};

describe("ROCK_NODES baseYield (2026-07-04 regression - deepstone spike bug)", () => {
  it("every node has the same baseYield of 1 - no tier should out-yield another per hit", () => {
    // Reported bug: deepstone was baseYield:2 (double every other
    // node), which combined with the Deepstone Pickaxe's own 4x tool
    // multiplier produced wildly high per-strike yields right at the
    // moment of unlock ("one F click... mines like 12 ores" at fresh
    // Mining 15). General rule per direction: a newly-unlocked tier
    // should be reachable at higher skill/require better tools, not
    // also out-yield easier tiers per hit.
    for (const node of ROCK_NODES) {
      expect(node.baseYield).toBe(1);
    }
  });
});

describe("bestAvailablePickaxe", () => {
  it("returns bare hands at forged pickaxe tier 0", () => {
    expect(bestAvailablePickaxe(0).name).toBe("Bare Hands");
  });

  it("returns the highest defined tier at or below the forged tier", () => {
    expect(bestAvailablePickaxe(2).name).toBe("Iron Pickaxe");
  });

  it("caps at the best tool even if the forged tier exceeds defined tiers", () => {
    expect(bestAvailablePickaxe(99).name).toBe(PICKAXE_TIERS[PICKAXE_TIERS.length - 1].name);
  });
});

describe("attemptMineStrike", () => {
  it("throws if mining level is below the node requirement", () => {
    expect(() => attemptMineStrike(ironVein, miningLvl1, 0, fresh(), 0.1)).toThrow();
  });

  it("throws if the node is already exhausted", () => {
    const exhausted = { totalYielded: finiteTestNode.totalYieldCapacity! };
    expect(() => attemptMineStrike(finiteTestNode, miningLvl1, 0, exhausted, 0.1)).toThrow();
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

describe("gem drops per vein (added 2026-06-23, alongside the Gemcutting station)", () => {
  it("copper_vein drops Rough Quartz (the common tier)", () => {
    expect(copperVein.gemDrop?.materialId).toBe("rough_quartz");
  });

  it("iron_vein drops Rough Garnet (the uncommon tier)", () => {
    expect(ironVein.gemDrop?.materialId).toBe("rough_garnet");
  });

  it("deepstone drops Rough Amethyst (the rare tier), and its base chance is the LOWEST of the three - rarer veins drop their own gem less often too, by explicit design", () => {
    const deepstone = ROCK_NODES.find((n) => n.id === "deepstone")!;
    expect(deepstone.gemDrop?.materialId).toBe("rough_amethyst");
    expect(deepstone.gemDrop!.baseChance).toBeLessThan(ironVein.gemDrop!.baseChance);
    expect(ironVein.gemDrop!.baseChance).toBeLessThan(copperVein.gemDrop!.baseChance);
  });

  it("coal_seam has NO gem drop at all - not gem-bearing rock thematically", () => {
    const coalSeam = ROCK_NODES.find((n) => n.id === "coal_seam")!;
    expect(coalSeam.gemDrop).toBeUndefined();
  });
});

describe("depletion", () => {
  it("a fresh node has its full capacity remaining", () => {
    expect(remainingYield(finiteTestNode, fresh())).toBe(finiteTestNode.totalYieldCapacity);
  });

  it("a node with totalYieldCapacity=null never reports exhausted, regardless of yielded amount", () => {
    expect(ironVein.totalYieldCapacity).toBeNull();
    const heavilyMined = { totalYielded: 1_000_000 };
    expect(remainingYield(ironVein, heavilyMined)).toBeNull();
    expect(isExhausted(ironVein, heavilyMined)).toBe(false);
  });

  it("copper_vein itself is infinite (2026-06-23 fix - was the only copper source in the game, exhausting it was a permanent deadlock)", () => {
    expect(copperVein.totalYieldCapacity).toBeNull();
    const heavilyMined = { totalYielded: 1_000_000 };
    expect(isExhausted(copperVein, heavilyMined)).toBe(false);
  });

  it("successive successful strikes reduce remaining yield", () => {
    let depletion = fresh();
    const result = attemptMineStrike(finiteTestNode, miningLvl1, 0, depletion, 0.1);
    depletion = result.newDepletion;
    const remaining = remainingYield(finiteTestNode, depletion);
    expect(remaining).toBe(finiteTestNode.totalYieldCapacity! - result.amountGained);
  });

  it("a failed strike does not change depletion state", () => {
    const depletion = fresh();
    const result = attemptMineStrike(finiteTestNode, miningLvl1, 0, depletion, 0.99);
    expect(result.newDepletion).toEqual(depletion);
  });

  it("yield is capped at whatever remains - cannot overdraw an almost-exhausted node", () => {
    const almostGone = { totalYielded: finiteTestNode.totalYieldCapacity! - 1 };
    const result = attemptMineStrike(finiteTestNode, miningLvl1, 3, almostGone, 0.01);
    expect(result.amountGained).toBeLessThanOrEqual(1);
    expect(remainingYield(finiteTestNode, result.newDepletion)).toBe(0);
  });

  it("isExhausted becomes true exactly when remaining hits zero", () => {
    const exactlyDepleted = { totalYielded: finiteTestNode.totalYieldCapacity! };
    expect(isExhausted(finiteTestNode, exactlyDepleted)).toBe(true);
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
