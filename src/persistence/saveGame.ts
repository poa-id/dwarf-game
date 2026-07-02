import type { GameState } from "../engine/types";
import { createInitialGameState } from "../engine/rekindle";

/**
 * Save/load via localStorage. GameState is plain JSON-serializable data
 * (no functions, no Map/Set, no class instances) by design - every
 * "lookup table" in the engine (exploredCells, litTorches,
 * veinDepletion) deliberately uses Record<string, ...> rather than Map
 * specifically so this layer can stay this simple.
 */

const STORAGE_KEY = "dwarf-game-save";

/**
 * CURRENT_SAVE_VERSION must be bumped any time GameState's shape
 * changes in a way that breaks JSON compatibility with older saves
 * (renamed/removed fields, changed types). Bumping it without adding a
 * migration step means old saves get reset rather than corrupted -
 * that's a deliberate safety choice, not an oversight: a save that
 * fails to load is much worse than one that's discarded with the
 * player clearly told why.
 */
export const CURRENT_SAVE_VERSION = 1;

export interface LoadResult {
  state: GameState;
  /** True if no valid save existed and a fresh GameState was created instead. */
  isFreshState: boolean;
  /** True if a save existed but was too old/corrupt to use, and was discarded. */
  discardedIncompatibleSave: boolean;
}

/**
 * Backfills fields that were added to GameState ADDITIVELY after some
 * saves may have already been created, without bumping
 * CURRENT_SAVE_VERSION - these are non-breaking additions (a save
 * missing them is still structurally a valid GameState, just from
 * before the field existed), so a full version-migration step felt
 * heavier than necessary. Bumping the save version is reserved for
 * actually incompatible shape changes (renamed/restructured fields);
 * purely-additive ones get backfilled here instead, every load, cheaply.
 */
function backfillMissingFields(state: any): any {
  if (state.world) {
    if (state.world.litTorches === undefined) state.world.litTorches = {};
    if ((state.world as Record<string,unknown>).placedTorches === undefined) (state.world as Record<string,unknown>).placedTorches = {};
    if (state.world.veinDepletion === undefined) state.world.veinDepletion = {};
    if (state.world.woodDepletion === undefined) state.world.woodDepletion = {};
    if (state.world.drills === undefined) state.world.drills = {};
    if ((state.world as Record<string,unknown>).smeltingEngines === undefined) (state.world as Record<string,unknown>).smeltingEngines = {};
    // Backfill new DrillState fields for saves predating buffer upgrades
    for (const drill of Object.values(state.world.drills)) {
      const d = drill as Record<string, unknown>;
      if (d.coalBufferMax === undefined) d.coalBufferMax = 20;
      if (d.oreBufferMax === undefined) d.oreBufferMax = 20;
      if (d.bufferTier === undefined) d.bufferTier = 0;
    }
    if (state.world.consoleAwakened === undefined) state.world.consoleAwakened = false;
    if (state.world.rekindleMultiplier === undefined) state.world.rekindleMultiplier = 0;
    if (state.world.roomStates === undefined) state.world.roomStates = {};
    if (state.world.stockpileOre === undefined) state.world.stockpileOre = {};
    if (state.world.lastMerchantAt === undefined) state.world.lastMerchantAt = 0;
    if (state.world.gardenSlots === undefined) state.world.gardenSlots = [];
    if (state.world.hearthTier === undefined) state.world.hearthTier = 0;
    if (state.world.fuelReserve === undefined) state.world.fuelReserve = {};
    if (state.world.companion === undefined) {
      state.world.companion = { befriended: false, lastHaulAt: Date.now() };
    }
    if (state.world.toolsForged === undefined) {
      // Old saves predate smithed tools entirely - backfill at 0/0
      // (bare hands for both slots), same as a brand new world. This
      // does mean a save from before this change loses any "free"
      // tool-quality bonus it implicitly had from forgeTier under the
      // old automatic system - an accepted, one-time downgrade on
      // migration, not an ongoing mechanic; the player can re-forge
      // real tools going forward. See OPEN_QUESTIONS.md.
      state.world.toolsForged = { pickaxe: 0, axe: 0 };
    }
    if (state.world.lifetimeFuelAtLastRekindle === undefined) {
      // Old saves predate the rekindle diminishing-returns penalty
      // entirely - backfill at 0, meaning the save's ENTIRE existing
      // hearth.lifetimeFuel counts as "growth since the last rekindle"
      // on its next rekindle. This is the generous direction for a
      // migration (full credit, not a penalty for pre-dating the
      // feature) - see rekindle.ts's calculateRekindleInsight.
      state.world.lifetimeFuelAtLastRekindle = 0;
    }
    if (state.world.smelterBuilt === undefined) {
      // Old saves predate the Smelter entirely - backfill as
      // not-yet-built, same as a brand new world. The player can
      // build one going forward; this doesn't refund or grant
      // anything retroactively.
      state.world.smelterBuilt = false;
      state.world.smelterTier = 0;
      state.world.trueMetalSpentOnXpPerk = 0;
    }
    if (state.world.ironPurifyingUnlocked === undefined) {
      state.world.ironPurifyingUnlocked = false;
      state.world.ironSmelterTier = 0;
    }
    if (state.world.trueMetalSpentOnYieldPerk === undefined) {
      state.world.trueMetalSpentOnYieldPerk = 0;
    }
    if (state.world.gemcuttingBuilt === undefined) {
      // Old saves predate the Gemcutting station/Tinkering economy
      // entirely - same generous, no-retroactive-grant backfill as
      // the Smelter above.
      state.world.gemcuttingBuilt = false;
      state.world.gemcuttingTier = 0;
      state.world.cutGemsSpentOnPerk = 0;
    }
  }
  if (state.vessel?.skills && state.vessel.skills.woodcraft === undefined) {
    state.vessel.skills.woodcraft = { id: "woodcraft", level: 1, xp: 0 };
  }
  if (state.vessel?.skills && state.vessel.skills.tinkering === undefined) {
    // Old saves predate the Tinkering skill entirely - backfill at
    // level 1, same fresh-skill default any new dwarf gets.
    state.vessel.skills.tinkering = { id: "tinkering", level: 1, xp: 0 };
  }
  return state;
}

/**
 * Migrate an older save forward to the current shape. Each case should
 * mutate `raw` (a parsed-JSON blob, not yet typed as GameState) toward
 * the next version's shape, then fall through to the next case - this
 * is the standard "ladder" migration pattern, one step at a time rather
 * than version-to-version special cases for every possible jump.
 *
 * Currently a no-op (CURRENT_SAVE_VERSION is still 1, nothing to
 * migrate FROM yet) - this exists now so the FIRST real BREAKING
 * schema change has an obvious place to add a case, rather than
 * requiring this function to be invented under pressure later. Purely
 * additive changes go through backfillMissingFields above instead.
 */
function migrate(raw: any, fromVersion: number): any {
  let migrated = raw;
  let version = fromVersion;

  // Example shape for the next migration, when CURRENT_SAVE_VERSION becomes 2:
  // if (version === 1) {
  //   migrated = { ...migrated, someNewField: defaultValue };
  //   version = 2;
  // }

  void version; // currently unused - silences noUnusedLocals until the first real migration case exists
  return migrated;
}

/**
 * Very lightweight structural check - NOT full runtime validation of
 * every field. Just enough to catch "this clearly isn't a GameState at
 * all" (corrupted localStorage, a save from something else entirely)
 * before we try to use it. Deeper field-level validation is deliberately
 * not attempted here - a save that's THIS malformed is rare enough that
 * "discard and start fresh" is an acceptable response, and writing a
 * full schema validator for every future field would be a lot of
 * ongoing maintenance for a vanishingly small benefit.
 */
function looksLikeGameState(value: any): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.saveVersion === "number" &&
    typeof value.world === "object" &&
    typeof value.vessel === "object" &&
    typeof value.narrator === "object"
  );
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY + "_savedAt", String(Date.now()));
  } catch (err) {
    console.error("Failed to save game:", err);
  }
}

export function getLastSavedAt(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + "_savedAt");
    return raw ? parseInt(raw, 10) : Date.now();
  } catch {
    return Date.now();
  }
}

export function loadGame(now: number): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.error("Failed to read save:", err);
    return { state: createInitialGameState(now), isFreshState: true, discardedIncompatibleSave: false };
  }

  if (!raw) {
    return { state: createInitialGameState(now), isFreshState: true, discardedIncompatibleSave: false };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("Save data was not valid JSON, discarding:", err);
    return { state: createInitialGameState(now), isFreshState: true, discardedIncompatibleSave: true };
  }

  if (!looksLikeGameState(parsed)) {
    console.error("Save data did not look like a valid GameState, discarding.");
    return { state: createInitialGameState(now), isFreshState: true, discardedIncompatibleSave: true };
  }

  const migrated =
    parsed.saveVersion < CURRENT_SAVE_VERSION ? migrate(parsed, parsed.saveVersion) : parsed;
  const backfilled = backfillMissingFields(migrated);

  return {
    state: backfilled as GameState,
    isFreshState: false,
    discardedIncompatibleSave: false,
  };
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear save:", err);
  }
}
