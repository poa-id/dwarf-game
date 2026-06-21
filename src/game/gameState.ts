import type { GameState, NarratorTrigger } from "../engine/types";
import { loadGame, saveGame } from "../persistence/saveGame";
import { triggerNarration } from "../narration/narrator";
import { showNarratorToast } from "../narration/toast";
import { markVisibleCellsExplored } from "../engine/exploration";

/**
 * Owns the single mutable `state` reference for the whole game. This
 * existed as a bare `let state` at module scope in main.ts before the
 * file got split - that pattern works fine in one file, but multiple
 * files each importing their own copy of a mutable binding doesn't
 * work in JS/TS (each would get a stale snapshot, not a live
 * reference). getState()/setState() is the minimal fix: every module
 * calls these instead of touching a variable directly, so there's
 * exactly one real source of truth regardless of how many files read
 * or update it.
 */

let state: GameState;
let narratorContainer: HTMLElement;

export function getState(): GameState {
  return state;
}

export function setState(next: GameState): void {
  state = next;
}

/** Must be called once, during boot, before getState()/setState() are used anywhere else. */
export function initGameState(container: HTMLElement): { isFreshState: boolean; discardedIncompatibleSave: boolean } {
  narratorContainer = container;
  const loadResult = loadGame(Date.now());
  state = loadResult.state;

  if (loadResult.isFreshState) {
    // True first boot ever - no save existed at all.
    narrate("wake_first_ever");
    // Mark the dwarf's starting position explored immediately, so the
    // very first frame already shows the lit area around him rather
    // than a single empty render before any movement happens.
    state = {
      ...state,
      world: {
        ...state.world,
        exploredCells: markVisibleCellsExplored(state.world.exploredCells, state.vessel.position),
      },
    };
  }
  // Else: a save existed - this is a returning player reopening the
  // game, NOT a rekindling (that's a deliberate in-game action, not
  // "the page reloaded"). Nothing narrates here; waking after a
  // normal reload isn't a meaningful enough moment to comment on, and
  // we don't want wake_rekindled firing every time someone refreshes
  // the tab - that trigger is reserved for the actual rekindle()
  // action (which doesn't have a player-facing trigger yet either).

  return { isFreshState: loadResult.isFreshState, discardedIncompatibleSave: loadResult.discardedIncompatibleSave };
}

/** Fires a narrator trigger, shows the toast if a line was returned, and persists the updated narrator state. */
export function narrate(trigger: NarratorTrigger): void {
  const result = triggerNarration(trigger, state.narrator, Math.random(), Math.random());
  state = { ...state, narrator: result.state };
  if (result.line) showNarratorToast(narratorContainer, result.line);
}

export function persist(): void {
  saveGame(state);
}
