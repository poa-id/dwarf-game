import type { GameState, VesselState, WorldState, SkillState, SkillId } from "./types";
import { HEARTH_SPAWN_POSITION } from "./hubMap";
import { createInitialHearth } from "./hearth";
import { COLOR_STAGES } from "./colorStages";
import { createFreshPlanterSlot } from "./garden";
import { createInitialNarratorState } from "../narration/narrator";

/**
 * The fuel threshold that makes rekindling available at all - same
 * threshold that triggers the world's first color (Stage 1), per the
 * deliberate design call that crossing it IS the rekindling event
 * narratively (see colorStages.ts's comment on COLOR_STAGES[1]). Lives
 * here (engine layer) rather than in hearthPanel.ts (where it
 * originally lived, UI-only) because calculateRekindleInsight below
 * also needs it, and an engine file importing a UI file would be the
 * wrong dependency direction. hearthPanel.ts imports this constant now
 * instead of defining its own copy.
 */
export const REKINDLE_FUEL_THRESHOLD = COLOR_STAGES[1].fuelThreshold;

/**
 * Remembrance earned at the moment of rekindling. Two factors stack:
 *
 * 1. Scaled by how far the dwarf got (skill levels) - a longer-lived
 *    dwarf leaves more behind for the one who follows him. Unchanged
 *    each five levels beyond a fresh dwarf adds one Remembrance.
 *
 * 2. A DIMINISHING-RETURNS penalty based on how much hearth.lifetimeFuel
 *    has grown SINCE THE LAST rekindle, not just whether the current
 *    value clears REKINDLE_FUEL_THRESHOLD. lifetimeFuel never
 *    decreases, so without this, the threshold stays permanently
 *    cleared the instant it's first reached - nothing would stop
 *    rekindling again 30 seconds later for whatever marginal Insight
 *    the (now level-1-again) dwarf's levels are worth. Per explicit
 *    project direction (2026-06-23): each rekindle should feel
 *    meaningful, not spammable. Growing a full threshold's worth of
 *    fuel since the last rekindle earns the FULL multiplier (1.0);
 *    growing less scales linearly down to 0 at no growth at all. The
 *    very first rekindle (lifetimeFuelAtLastRekindle starts at 0) always
 *    gets the full multiplier, since there's no "last rekindle" to have
 *    rushed past.
 */
export function calculateRekindleRemembrance(vessel: VesselState, world: WorldState): number {
  const totalLevels = Object.values(vessel.skills).reduce((sum, s) => sum + s.level, 0);
  const baseRemembrance = Math.max(1, 1 + Math.floor((totalLevels - Object.keys(vessel.skills).length) / 5));

  const fuelGrowthSinceLastRekindle = world.hearth.lifetimeFuel - world.lifetimeFuelAtLastRekindle;
  const diminishingReturnsScale = Math.min(1, Math.max(0, fuelGrowthSinceLastRekindle / REKINDLE_FUEL_THRESHOLD));

  return Math.round(baseRemembrance * diminishingReturnsScale);
}

/** @deprecated Rekindling now awards Remembrance, not Insight. */
export const calculateRekindleInsight = calculateRekindleRemembrance;

function freshSkill(id: SkillId): SkillState {
  return { id, level: 1, xp: 0 };
}

/**
 * Create a brand new Vessel — a new dwarf's body. Skills and inventory
 * reset to nothing; he has not swung this pickaxe, even if the pickaxe
 * (a World object) is a fine one. He wakes at the hearth, same as every
 * dwarf before him - the heart of the mountain is where dwarven life
 * begins, every time.
 */
export function createFreshVessel(): VesselState {
  return {
    skills: {
      mining: freshSkill("mining"),
      smithing: freshSkill("smithing"),
      hearthkeeping: freshSkill("hearthkeeping"),
      woodcraft: freshSkill("woodcraft"),
      tinkering: freshSkill("tinkering"),
      herblore: freshSkill("herblore"),
      brewing: freshSkill("brewing"),
    },
    inventory: {},
    hasRekindled: false,
    position: { ...HEARTH_SPAWN_POSITION },
  };
}

export function createInitialWorld(now: number): WorldState {
  return {
    forgeTier: 0,
    hearthTier: 0,
    fuelReserve: {},
    companion: { befriended: false, lastHaulAt: now, tier: 1, trainingRank: 0, lastMachineHaulAt: now, logisticsMode: "balanced" },
    unlockedMineDepth: 0,
    hearth: createInitialHearth(now),
    insightBanked: 0,
    remembranceBanked: 0,
    legacyRanks: {},
    dwarfCount: 0,
    loreFlags: [],
    exploredCells: {},
    litTorches: {},
    placedTorches: {},
    veinDepletion: {},
    woodDepletion: {},
    drills: {},
    smeltingEngines: {},
    mineshaftDepth: 0,
    consoleAwakened: false,
    rekindleMultiplier: 0,
    roomStates: {},
    stockpileOre: {},
    stockpileExpansionRank: 0,
    lastMerchantAt: 0,
    gardenSlots: [
      createFreshPlanterSlot(true),   // slot 0 — always unlocked
      createFreshPlanterSlot(false),  // slots 1-5 unlock via Herblore + materials
      createFreshPlanterSlot(false),
      createFreshPlanterSlot(false),
      createFreshPlanterSlot(false),
      createFreshPlanterSlot(false),
    ],
    toolsForged: { pickaxe: 0, axe: 0 },
    lifetimeFuelAtLastRekindle: 0,
    smelterBuilt: false,
    smelterTier: 0,
    sawmillBuilt: false,
    turbineBuilt: false,
    harvesters: {},
    sawmillWoodBuffer: 0,
    harvestCompanion: { befriended: false, lastHaulAt: now, tendingRank: 0 },
    ironPurifyingUnlocked: false,
    ironSmelterTier: 0,
    trueMetalSpentOnXpPerk: 0,
    trueMetalSpentOnYieldPerk: 0,
    gemcuttingBuilt: false,
    gemcuttingTier: 0,
    cutGemsSpentOnPerk: 0,
  };
}

/** A brand new save: the very first dwarf, the world entirely unmade. */
export function createInitialGameState(now: number): GameState {
  return {
    saveVersion: 1,
    world: createInitialWorld(now),
    vessel: createFreshVessel(),
    narrator: createInitialNarratorState(),
  };
}

export interface RekindleResult {
  newState: GameState;
  remembranceEarned: number;
  isFirstRekindling: boolean;
  dwarfNumber: number; // the number of the NEW dwarf, e.g. 2nd, 3rd...
}

/**
 * The sacrifice. The current dwarf gives himself to the flame. His
 * personal skills and inventory (Vessel) are gone — he is gone — but
 * everything he built into the World remains exactly as he left it:
 * forge tier, mine depth, the hearth's own fire, all lore unlocked.
 * Insight he earned is banked into the World for the next dwarf to spend.
 *
 * This does NOT touch hearth.colorStage directly — that's purely a
 * function of hearth.lifetimeFuel via tickHearth/colorStageForLifetimeFuel.
 * The first rekindling is reported here for narrative purposes (it's a
 * meaningful moment to show the player), but the actual color change is
 * already governed by the Hearth system, not by this function.
 */
export function rekindle(state: GameState): RekindleResult {
  const remembranceEarned = calculateRekindleRemembrance(state.vessel, state.world);
  const isFirstRekindling = state.world.dwarfCount === 0;

  const newState: GameState = {
    ...state,
    world: {
      ...state.world,
      remembranceBanked: (state.world.remembranceBanked ?? 0) + remembranceEarned,
      dwarfCount: state.world.dwarfCount + 1,
      lifetimeFuelAtLastRekindle: state.world.hearth.lifetimeFuel,
    },
    vessel: createFreshVessel(),
  };

  return {
    newState,
    remembranceEarned,
    isFirstRekindling,
    dwarfNumber: newState.world.dwarfCount + 1,
  };
}
