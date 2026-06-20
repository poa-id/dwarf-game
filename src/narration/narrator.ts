import { NARRATOR_LINES } from "./lines";
import type { NarratorTrigger, NarratorState } from "../engine/types";

/**
 * Picks a line for a trigger, avoiding immediate repetition of the
 * last line shown FOR THAT SAME TRIGGER (repeats across different
 * triggers are fine and expected). Pure function - caller supplies the
 * random roll for determinism in tests, and tracks `lastShown` itself
 * (see NarratorState below) rather than this module holding any state.
 *
 * Pools with only one line always return that line - there's nothing
 * to rotate, and that's fine for rare/important one-shot moments.
 */
export function pickLine(
  trigger: NarratorTrigger,
  lastShownForTrigger: string | null,
  roll: number
): string {
  const pool = NARRATOR_LINES[trigger];

  if (pool.length === 1) return pool[0];

  const candidates = pool.filter((line) => line !== lastShownForTrigger);
  // candidates is never empty here since pool.length > 1 and we removed at most one line
  const index = Math.floor(roll * candidates.length);
  return candidates[Math.min(index, candidates.length - 1)];
}

/**
 * Tracks per-trigger "last shown" so pickLine can avoid repeats, plus
 * which one-time-only triggers have already fired (wake_first_ever
 * should never show twice in the same save, even across many
 * rekindlings - it's specifically "the first time the GAME ever
 * started," not "the first time this dwarf woke up"). The NarratorState
 * type itself lives in engine/types.ts alongside World/Vessel, since
 * it's part of the canonical save shape.
 */
export function createInitialNarratorState(): NarratorState {
  return { lastShownByTrigger: {}, firedOnceTriggers: [] };
}

const ONE_TIME_TRIGGERS: NarratorTrigger[] = ["wake_first_ever", "mine_first_strike", "color_stage_1"];

export function hasFiredOnce(state: NarratorState, trigger: NarratorTrigger): boolean {
  return state.firedOnceTriggers.includes(trigger);
}

export interface NarrationResult {
  state: NarratorState;
  line: string | null; // null if this is a one-time trigger that already fired
}

/**
 * The main entry point: given a trigger and current narrator state,
 * returns the line to show (or null if a one-time trigger already
 * fired and shouldn't repeat) plus the updated state to persist.
 */
export function triggerNarration(
  trigger: NarratorTrigger,
  state: NarratorState,
  roll: number
): NarrationResult {
  if (ONE_TIME_TRIGGERS.includes(trigger) && hasFiredOnce(state, trigger)) {
    return { state, line: null };
  }

  const lastShown = state.lastShownByTrigger[trigger] ?? null;
  const line = pickLine(trigger, lastShown, roll);

  const newState: NarratorState = {
    lastShownByTrigger: { ...state.lastShownByTrigger, [trigger]: line },
    firedOnceTriggers: ONE_TIME_TRIGGERS.includes(trigger)
      ? [...state.firedOnceTriggers, trigger]
      : state.firedOnceTriggers,
  };

  return { state: newState, line };
}
