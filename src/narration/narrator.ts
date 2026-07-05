import { NARRATOR_LINES } from "./lines";
import type { NarratorTrigger, NarratorState } from "../engine/types";

/**
 * How often a trigger actually produces a line when it fires, 0-1.
 * Rare/meaningful moments (first strike ever, level ups, color stage,
 * torch repairs) always narrate - they're infrequent enough on their
 * own that hearing about them every time is correct, not spammy.
 * Frequent, repetitive actions (routine mining swings, walking into a
 * newly lit area) narrate only SOMETIMES - the narrator comments on
 * the grind, he doesn't provide play-by-play of every swing. Triggers
 * not listed here default to 1.0 (always narrate).
 */
const NARRATION_CHANCE: Partial<Record<NarratorTrigger, number>> = {
  // Lowered again 2026-07-05 (explicit direction: "quotes should be
  // very sparse or rare, have weight and aid the narrative") - 0.05
  // still meant hearing a line every ~20 strikes during an active
  // mining/chopping session, which reads as commentary on routine
  // grinding rather than an occasional, weighty voice. 0.02 is roughly
  // 1-in-50 - rare enough that a line landing still feels like a real
  // moment, not a running commentary track.
  mine_strike: 0.02,
  wood_strike: 0.02,
  // Lowered from 0.6 - exploring a genuinely new area is fairly
  // frequent during active play (every new corridor/room qualifies),
  // and 60% of those triggering a line was close to "almost always
  // says something," working against the same "sparse and weighty" goal.
  area_revealed: 0.2,
};

function chanceFor(trigger: NarratorTrigger): number {
  return NARRATION_CHANCE[trigger] ?? 1.0;
}

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

const ONE_TIME_TRIGGERS: NarratorTrigger[] = [
  "wake_first_ever",
  "mine_first_strike",
  "wood_first_strike",
  "color_stage_1",
  "companion_befriended",
  "console_awakened",
  "forge_repaired",
  "merchant_arrived",
];

export function hasFiredOnce(state: NarratorState, trigger: NarratorTrigger): boolean {
  return state.firedOnceTriggers.includes(trigger);
}

export interface NarrationResult {
  state: NarratorState;
  line: string | null; // null if a one-time trigger already fired, OR this call lost its throttle roll
}

/**
 * The main entry point: given a trigger and current narrator state,
 * returns the line to show (or null if a one-time trigger already
 * fired and shouldn't repeat, or if this trigger is throttled and lost
 * its roll this time) plus the updated state to persist.
 *
 * Takes TWO independent rolls - throttleRoll decides whether to speak
 * at all, lineRoll decides which line if so - so a caller can't
 * accidentally correlate "did it speak" with "which line" by reusing
 * one Math.random() call for both.
 */
export function triggerNarration(
  trigger: NarratorTrigger,
  state: NarratorState,
  lineRoll: number,
  throttleRoll: number = Math.random()
): NarrationResult {
  if (ONE_TIME_TRIGGERS.includes(trigger) && hasFiredOnce(state, trigger)) {
    return { state, line: null };
  }

  if (throttleRoll >= chanceFor(trigger)) {
    return { state, line: null }; // lost the throttle roll - stays silent this time, state unchanged
  }

  const lastShown = state.lastShownByTrigger[trigger] ?? null;
  const line = pickLine(trigger, lastShown, lineRoll);

  const newState: NarratorState = {
    lastShownByTrigger: { ...state.lastShownByTrigger, [trigger]: line },
    firedOnceTriggers: ONE_TIME_TRIGGERS.includes(trigger)
      ? [...state.firedOnceTriggers, trigger]
      : state.firedOnceTriggers,
  };

  return { state: newState, line };
}
