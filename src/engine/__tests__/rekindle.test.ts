import { describe, it, expect } from "vitest";
import { rekindle, calculateRekindleInsight, createFreshVessel } from "../rekindle";
import { createInitialHearth } from "../hearth";
import { HEARTH_SPAWN_POSITION } from "../hubMap";
import type { GameState } from "../types";

function makeStateWithProgress(): GameState {
  return {
    saveVersion: 1,
    world: {
      forgeTier: 2,
      unlockedMineDepth: 1,
      hearth: createInitialHearth(0),
      insightBanked: 100,
      dwarfCount: 0,
      loreFlags: ["met_the_foreman"],
      exploredCells: { "40,25": true, "41,25": true },
    },
    vessel: {
      skills: {
        mining: { id: "mining", level: 20, xp: 50000 },
        smithing: { id: "smithing", level: 15, xp: 30000 },
        hearthkeeping: { id: "hearthkeeping", level: 5, xp: 1000 },
      },
      inventory: { ore: 40, ingot: 12, fuel: 8, insight: 0 },
      hasRekindled: false,
      position: { col: 47, row: 23 }, // dwarf wandered into the forge room before this rekindling
    },
  };
}

describe("calculateRekindleInsight", () => {
  it("scales with total levels across all skills", () => {
    const state = makeStateWithProgress();
    // mining 20 + smithing 15 + hearthkeeping 5 = 40 total levels * 5 = 200
    expect(calculateRekindleInsight(state.vessel)).toBe(200);
  });

  it("is 0 for a fresh vessel (all skills at level 1 -> total 3 -> 15 insight)", () => {
    const fresh = createFreshVessel();
    expect(calculateRekindleInsight(fresh)).toBe(15); // 1+1+1=3 levels * 5
  });
});

describe("rekindle", () => {
  it("WORLD state survives untouched: forgeTier, mineDepth, hearth, lore all persist", () => {
    const state = makeStateWithProgress();
    const { newState } = rekindle(state);
    expect(newState.world.forgeTier).toBe(state.world.forgeTier);
    expect(newState.world.unlockedMineDepth).toBe(state.world.unlockedMineDepth);
    expect(newState.world.hearth).toEqual(state.world.hearth);
    expect(newState.world.loreFlags).toEqual(state.world.loreFlags);
  });

  it("VESSEL state is fully reset: skills back to level 1, inventory emptied", () => {
    const state = makeStateWithProgress();
    const { newState } = rekindle(state);
    expect(newState.vessel.skills.mining.level).toBe(1);
    expect(newState.vessel.skills.mining.xp).toBe(0);
    expect(newState.vessel.skills.smithing.level).toBe(1);
    expect(newState.vessel.inventory.ore).toBe(0);
    expect(newState.vessel.inventory.ingot).toBe(0);
    expect(newState.vessel.hasRekindled).toBe(false); // fresh dwarf hasn't rekindled himself yet
  });

  it("the new dwarf wakes at the hearth, regardless of where the previous dwarf died", () => {
    const state = makeStateWithProgress(); // previous dwarf was at (47, 23), the forge room
    const { newState } = rekindle(state);
    expect(newState.vessel.position).toEqual(HEARTH_SPAWN_POSITION);
  });

  it("exploredCells (World state) survive rekindling untouched - the mountain's map is never forgotten", () => {
    const state = makeStateWithProgress();
    const { newState } = rekindle(state);
    expect(newState.world.exploredCells).toEqual(state.world.exploredCells);
  });

  it("Insight earned is added to world.insightBanked, not reset", () => {
    const state = makeStateWithProgress();
    const { newState, insightEarned } = rekindle(state);
    expect(insightEarned).toBe(200);
    expect(newState.world.insightBanked).toBe(100 + 200);
  });

  it("dwarfCount increments by exactly 1", () => {
    const state = makeStateWithProgress();
    const { newState } = rekindle(state);
    expect(newState.world.dwarfCount).toBe(1);
  });

  it("isFirstRekindling is true only when dwarfCount was 0 before rekindling", () => {
    const state = makeStateWithProgress();
    const { isFirstRekindling } = rekindle(state);
    expect(isFirstRekindling).toBe(true);

    const secondState = { ...state, world: { ...state.world, dwarfCount: 1 } };
    const { isFirstRekindling: secondTime } = rekindle(secondState);
    expect(secondTime).toBe(false);
  });

  it("does not mutate the original state object (pure function)", () => {
    const state = makeStateWithProgress();
    const originalMiningLevel = state.vessel.skills.mining.level;
    rekindle(state);
    expect(state.vessel.skills.mining.level).toBe(originalMiningLevel);
  });
});
