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
      litTorches: {},
      veinDepletion: { hearth_hall_copper: { totalYielded: 30 } },
      woodDepletion: { hearth_hall_roots: { totalYielded: 12 } },
    },
    vessel: {
      skills: {
        mining: { id: "mining", level: 20, xp: 50000 },
        smithing: { id: "smithing", level: 15, xp: 30000 },
        hearthkeeping: { id: "hearthkeeping", level: 5, xp: 1000 },
        woodcraft: { id: "woodcraft", level: 3, xp: 200 },
      },
      inventory: { copper_ore: 40, copper_ingot: 12, coal: 8 },
      hasRekindled: false,
      position: { col: 47, row: 23 }, // dwarf wandered into the forge room before this rekindling
    },
    narrator: {
      lastShownByTrigger: { mine_strike: "Ore, this time. Small as it is, it's more than he had an hour ago." },
      firedOnceTriggers: ["wake_first_ever", "mine_first_strike"],
    },
  };
}

describe("calculateRekindleInsight", () => {
  it("scales with total levels across all skills", () => {
    const state = makeStateWithProgress();
    // mining 20 + smithing 15 + hearthkeeping 5 + woodcraft 3 = 43 total levels * 5 = 215
    expect(calculateRekindleInsight(state.vessel)).toBe(215);
  });

  it("is 0 for a fresh vessel (all 4 skills at level 1 -> total 4 -> 20 insight)", () => {
    const fresh = createFreshVessel();
    expect(calculateRekindleInsight(fresh)).toBe(20); // 1+1+1+1=4 levels * 5
  });
});

describe("rekindle", () => {
  it("WORLD state survives untouched: forgeTier, mineDepth, hearth, lore, vein depletion all persist", () => {
    const state = makeStateWithProgress();
    const { newState } = rekindle(state);
    expect(newState.world.forgeTier).toBe(state.world.forgeTier);
    expect(newState.world.unlockedMineDepth).toBe(state.world.unlockedMineDepth);
    expect(newState.world.hearth).toEqual(state.world.hearth);
    expect(newState.world.loreFlags).toEqual(state.world.loreFlags);
    expect(newState.world.veinDepletion).toEqual(state.world.veinDepletion); // a vein worked thin by one dwarf stays thin for the next
    expect(newState.world.woodDepletion).toEqual(state.world.woodDepletion); // same for wood
  });

  it("VESSEL state is fully reset: skills back to level 1, inventory emptied", () => {
    const state = makeStateWithProgress();
    const { newState } = rekindle(state);
    expect(newState.vessel.skills.mining.level).toBe(1);
    expect(newState.vessel.skills.mining.xp).toBe(0);
    expect(newState.vessel.skills.smithing.level).toBe(1);
    expect(newState.vessel.skills.woodcraft.level).toBe(1); // catches any future skill silently missed from the reset
    expect(newState.vessel.inventory).toEqual({});
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

  it("litTorches (World state) survive rekindling untouched - a lit torch stays lit forever", () => {
    const state = makeStateWithProgress();
    const stateWithTorch = {
      ...state,
      world: { ...state.world, litTorches: { torch_corridor_forge: true as const } },
    };
    const { newState } = rekindle(stateWithTorch);
    expect(newState.world.litTorches).toEqual({ torch_corridor_forge: true });
  });

  it("narrator state survives rekindling untouched - one-time lines must never replay across dwarves", () => {
    const state = makeStateWithProgress();
    const { newState } = rekindle(state);
    expect(newState.narrator).toEqual(state.narrator);
    expect(newState.narrator.firedOnceTriggers).toContain("wake_first_ever");
  });

  it("Insight earned is added to world.insightBanked, not reset", () => {
    const state = makeStateWithProgress();
    const { newState, insightEarned } = rekindle(state);
    expect(insightEarned).toBe(215);
    expect(newState.world.insightBanked).toBe(100 + 215);
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
