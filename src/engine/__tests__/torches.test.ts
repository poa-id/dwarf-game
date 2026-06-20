import { describe, it, expect } from "vitest";
import { isNearTorch, canAffordRepair, repairTorch, TORCH_INTERACT_RANGE } from "../torches";
import { createInitialGameState } from "../rekindle";
import { LIGHT_SOURCES } from "../hubMap";
import type { LightSourceDefinition } from "../types";

const testTorch: LightSourceDefinition = {
  id: "test_torch",
  name: "Test Torch",
  position: { col: 10, row: 10 },
  radius: 2,
  repairCost: { copper_ingot: 3 },
};

describe("isNearTorch", () => {
  it("is true when standing exactly on the torch", () => {
    expect(isNearTorch(10, 10, testTorch)).toBe(true);
  });

  it("is true within TORCH_INTERACT_RANGE", () => {
    expect(isNearTorch(10 + TORCH_INTERACT_RANGE, 10, testTorch)).toBe(true);
  });

  it("is false just beyond TORCH_INTERACT_RANGE", () => {
    expect(isNearTorch(10 + TORCH_INTERACT_RANGE + 1, 10, testTorch)).toBe(false);
  });
});

describe("canAffordRepair", () => {
  it("true when inventory meets or exceeds cost", () => {
    const inv = { copper_ingot: 5 };
    expect(canAffordRepair(inv, { copper_ingot: 3 })).toBe(true);
  });

  it("false when inventory is short", () => {
    const inv = { copper_ingot: 2 };
    expect(canAffordRepair(inv, { copper_ingot: 3 })).toBe(false);
  });

  it("false when the material is entirely absent from inventory (not just zero)", () => {
    const inv = {};
    expect(canAffordRepair(inv, { copper_ingot: 1 })).toBe(false);
  });

  it("handles multi-material costs, all must be satisfied", () => {
    const inv = { copper_ore: 5, copper_ingot: 5 };
    expect(canAffordRepair(inv, { copper_ingot: 3, copper_ore: 10 })).toBe(false); // ore short
    expect(canAffordRepair(inv, { copper_ingot: 3, copper_ore: 5 })).toBe(true);
  });
});

describe("repairTorch", () => {
  function stateNearTorch(torch: LightSourceDefinition, ingots: number) {
    const state = createInitialGameState(0);
    return {
      ...state,
      vessel: {
        ...state.vessel,
        position: { ...torch.position },
        inventory: { ...state.vessel.inventory, copper_ingot: ingots },
      },
    };
  }

  it("fails with 'too_far' if the dwarf is not near the torch", () => {
    const state = createInitialGameState(0); // spawns at hearth, far from testTorch
    const outcome = repairTorch(state, testTorch);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("too_far");
  });

  it("fails with 'cannot_afford' if near but lacking resources", () => {
    const state = stateNearTorch(testTorch, 0);
    const outcome = repairTorch(state, testTorch);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("cannot_afford");
  });

  it("fails with 'already_lit' if the torch is already repaired", () => {
    const state = stateNearTorch(testTorch, 10);
    const alreadyLit = {
      ...state,
      world: { ...state.world, litTorches: { [testTorch.id]: true as const } },
    };
    const outcome = repairTorch(alreadyLit, testTorch);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("already_lit");
  });

  it("succeeds when near, affordable, and not already lit", () => {
    const state = stateNearTorch(testTorch, 10);
    const outcome = repairTorch(state, testTorch);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.newState.world.litTorches[testTorch.id]).toBe(true);
    }
  });

  it("deducts the exact repair cost from inventory on success", () => {
    const state = stateNearTorch(testTorch, 10);
    const outcome = repairTorch(state, testTorch);
    if (outcome.ok) {
      expect(outcome.newState.vessel.inventory.copper_ingot).toBe(10 - 3);
    } else {
      throw new Error("expected success");
    }
  });

  it("marks the torch's surrounding area explored immediately on repair", () => {
    const state = stateNearTorch(testTorch, 10);
    const outcome = repairTorch(state, testTorch);
    if (outcome.ok) {
      const key = `${testTorch.position.col},${testTorch.position.row}`;
      expect(outcome.newState.world.exploredCells[key]).toBe(true);
    } else {
      throw new Error("expected success");
    }
  });

  it("does not mutate the original state (pure function)", () => {
    const state = stateNearTorch(testTorch, 10);
    const originalIngots = state.vessel.inventory.copper_ingot;
    repairTorch(state, testTorch);
    expect(state.vessel.inventory.copper_ingot).toBe(originalIngots);
  });

  it("real LIGHT_SOURCES content all have positive repair costs and radii", () => {
    for (const torch of LIGHT_SOURCES) {
      expect(torch.radius).toBeGreaterThan(0);
      expect(Object.values(torch.repairCost).some((v) => (v ?? 0) > 0)).toBe(true);
    }
  });
});
