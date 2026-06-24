import type { GameState, VesselState, WorldState, SkillState, SkillId } from "./types";
import { HEARTH_SPAWN_POSITION } from "./hubMap";
import { createInitialHearth } from "./hearth";
import { createInitialNarratorState } from "../narration/narrator";

/**
 * Insight earned at the moment of rekindling — separate from the slow
 * trickle of Insight the Hearth generates over time just by being tended.
 * Scaled by how far the dwarf got, so a longer-lived dwarf leaves more
 * behind for the one who follows him.
 */
export function calculateRekindleInsight(vessel: VesselState): number {
  const totalLevels = Object.values(vessel.skills).reduce((sum, s) => sum + s.level, 0);
  // Simple for v1: 5 Insight per total skill level across all skills.
  // A dwarf who reached Mining 20 + Smithing 15 leaves 175 Insight behind.
  return totalLevels * 5;
}

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
    companion: { befriended: false, lastHaulAt: now },
    unlockedMineDepth: 0,
    hearth: createInitialHearth(now),
    insightBanked: 0,
    dwarfCount: 0,
    loreFlags: [],
    exploredCells: {},
    litTorches: {},
    veinDepletion: {},
    woodDepletion: {},
    toolsForged: { pickaxe: 0, axe: 0 },
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
  insightEarned: number;
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
  const insightEarned = calculateRekindleInsight(state.vessel);
  const isFirstRekindling = state.world.dwarfCount === 0;

  const newState: GameState = {
    ...state,
    world: {
      ...state.world,
      insightBanked: state.world.insightBanked + insightEarned,
      dwarfCount: state.world.dwarfCount + 1,
    },
    vessel: createFreshVessel(),
  };

  return {
    newState,
    insightEarned,
    isFirstRekindling,
    dwarfNumber: newState.world.dwarfCount + 1,
  };
}
