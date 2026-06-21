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
    if (state.world.veinDepletion === undefined) state.world.veinDepletion = {};
    if (state.world.woodDepletion === undefined) state.world.woodDepletion = {};
    if (state.world.hearthTier === undefined) state.world.hearthTier = 0;
    if (state.world.fuelReserve === undefined) state.world.fuelReserve = {};
    if (state.world.companion === undefined) {
      state.world.companion = { befriended: false, lastHaulAt: Date.now() };
    }
  }
  if (state.vessel?.skills && state.vessel.skills.woodcraft === undefined) {
    state.vessel.skills.woodcraft = { id: "woodcraft", level: 1, xp: 0 };
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
  } catch (err) {
    // localStorage can throw (quota exceeded, private browsing
    // restrictions, etc) - a failed save should never crash the game,
    // just silently fail to persist this particular write.
    console.error("Failed to save game:", err);
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
