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
      hearthTier: 1,
      fuelReserve: { coal: 5 },
      companion: { befriended: true, lastHaulAt: 0 },
      unlockedMineDepth: 1,
      // lifetimeFuel set well past REKINDLE_FUEL_THRESHOLD (500) -
      // this fixture represents a dwarf who made REAL progress, not
      // one rushing to rekindle the instant the threshold first clears.
      hearth: { ...createInitialHearth(0), lifetimeFuel: 1500 },
      insightBanked: 100,
      dwarfCount: 0,
      loreFlags: ["met_the_foreman"],
      exploredCells: { "40,25": true, "41,25": true },
      litTorches: {},
      veinDepletion: { hearth_hall_copper: { totalYielded: 30 } },
      woodDepletion: { hearth_hall_roots: { totalYielded: 12 } },
      toolsForged: { pickaxe: 1, axe: 1 }, // non-zero specifically to verify rekindle() carries this through (see "preserves" test below)
      lifetimeFuelAtLastRekindle: 0, // never rekindled before - this fixture's full 1500 counts as growth
      smelterBuilt: true,
      smelterTier: 2,
      ironPurifyingUnlocked: false,
      ironSmelterTier: 0,
      drills: {},
      consoleAwakened: false,
      rekindleMultiplier: 0,
      trueMetalSpentOnXpPerk: 3,
      trueMetalSpentOnYieldPerk: 1,
      gemcuttingBuilt: true,
      gemcuttingTier: 1,
      cutGemsSpentOnPerk: 2,
    },
    vessel: {
      skills: {
        mining: { id: "mining", level: 20, xp: 50000 },
        smithing: { id: "smithing", level: 15, xp: 30000 },
        hearthkeeping: { id: "hearthkeeping", level: 5, xp: 1000 },
        woodcraft: { id: "woodcraft", level: 3, xp: 200 },
        tinkering: { id: "tinkering", level: 2, xp: 100 },
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
  it("scales with total levels across all skills, at full multiplier when growth clears the threshold", () => {
    const state = makeStateWithProgress(); // lifetimeFuel 1500, lifetimeFuelAtLastRekindle 0 - growth 1500, well past the 500 threshold
    // mining 20 + smithing 15 + hearthkeeping 5 + woodcraft 3 + tinkering 2 = 45 total levels * 5 = 225, full multiplier (1.0)
    expect(calculateRekindleInsight(state.vessel, state.world)).toBe(225);
  });

  it("is 20 for a fresh vessel against a world with full growth (all 4 skills at level 1 -> total 4 -> 20 insight)", () => {
    const fresh = createFreshVessel();
    const world = makeStateWithProgress().world;
    expect(calculateRekindleInsight(fresh, world)).toBe(25); // 1+1+1+1+1=5 levels (incl. tinkering) * 5, full multiplier
  });

  it("diminishing returns: zero growth since the last rekindle yields ZERO insight, regardless of skill levels", () => {
    const state = makeStateWithProgress();
    const noGrowthWorld = {
      ...state.world,
      lifetimeFuelAtLastRekindle: state.world.hearth.lifetimeFuel, // rekindled again at the EXACT same lifetimeFuel - no growth at all
    };
    expect(calculateRekindleInsight(state.vessel, noGrowthWorld)).toBe(0);
  });

  it("diminishing returns: half the threshold's worth of growth yields half the insight", () => {
    const state = makeStateWithProgress();
    const halfGrowthWorld = {
      ...state.world,
      hearth: { ...state.world.hearth, lifetimeFuel: 250 },
      lifetimeFuelAtLastRekindle: 0, // grew from 0 to 250 - half of the 500 threshold
    };
    // 45 total levels (incl. tinkering) * 5 = 225 base, * 0.5 scale = 112.5, JS Math.round rounds half-up -> 113
    expect(calculateRekindleInsight(state.vessel, halfGrowthWorld)).toBe(113);
  });

  it("diminishing returns: growth beyond a full threshold's worth still caps at the full multiplier (no bonus for over-waiting)", () => {
    const state = makeStateWithProgress();
    const massiveGrowthWorld = {
      ...state.world,
      hearth: { ...state.world.hearth, lifetimeFuel: 100_000 },
      lifetimeFuelAtLastRekindle: 0,
    };
    expect(calculateRekindleInsight(state.vessel, massiveGrowthWorld)).toBe(225); // same as exactly-enough growth, not more
  });

  it("the very first rekindle (lifetimeFuelAtLastRekindle starts at 0) is never penalized, even if lifetimeFuel just barely cleared the threshold", () => {
    const state = makeStateWithProgress();
    const justClearedWorld = {
      ...state.world,
      hearth: { ...state.world.hearth, lifetimeFuel: 500 }, // exactly at the threshold, first time ever
      lifetimeFuelAtLastRekindle: 0,
    };
    expect(calculateRekindleInsight(state.vessel, justClearedWorld)).toBe(225); // full multiplier - 500 growth from 0 clears the threshold exactly
  });
});

describe("rekindle", () => {
  it("WORLD state survives untouched: forgeTier, mineDepth, hearth, lore, vein depletion, forged tools, the Smelter all persist", () => {
    const state = makeStateWithProgress();
    const { newState } = rekindle(state);
    expect(newState.world.forgeTier).toBe(state.world.forgeTier);
    expect(newState.world.unlockedMineDepth).toBe(state.world.unlockedMineDepth);
    expect(newState.world.hearth).toEqual(state.world.hearth);
    expect(newState.world.loreFlags).toEqual(state.world.loreFlags);
    expect(newState.world.veinDepletion).toEqual(state.world.veinDepletion); // a vein worked thin by one dwarf stays thin for the next
    expect(newState.world.woodDepletion).toEqual(state.world.woodDepletion); // same for wood
    expect(newState.world.toolsForged).toEqual(state.world.toolsForged); // a forged pickaxe/axe is the mountain's, not the dwarf's - the next dwarf picks it right back up
    // The Smelter (built status, tier, and the Mountain's permanent
    // XP-perk spend) is World-level, like the Forge/Hearth - the
    // mountain keeps it regardless of which dwarf is currently alive.
    expect(newState.world.smelterBuilt).toBe(true);
    expect(newState.world.smelterTier).toBe(2);
    expect(newState.world.trueMetalSpentOnXpPerk).toBe(3);
    // Same World-level persistence for the Hearth's yield-perk spend
    // (a SEPARATE running total from the XP-perk spend above, even
    // though both draw on the same True-metal currency) and the
    // Gemcutting station (built status, tier, cut-gem perk spend).
    expect(newState.world.trueMetalSpentOnYieldPerk).toBe(1);
    expect(newState.world.gemcuttingBuilt).toBe(true);
    expect(newState.world.gemcuttingTier).toBe(1);
    expect(newState.world.cutGemsSpentOnPerk).toBe(2);
  });

  it("VESSEL state is fully reset: skills back to level 1, inventory emptied", () => {
    const state = makeStateWithProgress();
    const { newState } = rekindle(state);
    expect(newState.vessel.skills.mining.level).toBe(1);
    expect(newState.vessel.skills.mining.xp).toBe(0);
    expect(newState.vessel.skills.smithing.level).toBe(1);
    expect(newState.vessel.skills.woodcraft.level).toBe(1); // catches any future skill silently missed from the reset
    expect(newState.vessel.skills.tinkering.level).toBe(1); // the newest skill - confirms the "catches any future skill" comment above still holds
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

  it("fuelReserve and companion (World state) survive rekindling untouched - Narag-Bund doesn't forget the next dwarf either", () => {
    const state = makeStateWithProgress();
    const { newState } = rekindle(state);
    expect(newState.world.fuelReserve).toEqual(state.world.fuelReserve);
    expect(newState.world.companion).toEqual(state.world.companion);
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
    expect(insightEarned).toBe(225);
    expect(newState.world.insightBanked).toBe(100 + 225);
  });

  it("records lifetimeFuelAtLastRekindle at the moment of rekindling, for the NEXT rekindle's diminishing-returns check", () => {
    const state = makeStateWithProgress(); // hearth.lifetimeFuel is 1500
    const { newState } = rekindle(state);
    expect(newState.world.lifetimeFuelAtLastRekindle).toBe(1500);
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
