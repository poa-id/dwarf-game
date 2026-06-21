import { getState, setState, narrate } from "./gameState";
import { attemptMove, type Direction } from "../engine/movement";
import { markVisibleCellsExplored } from "../engine/exploration";
import { zoneContaining } from "../engine/visibility";
import { hubCellAt } from "../render/hubContent";
import { isSolidCellKind } from "../render/palette";

export const KEY_TO_DIRECTION: Record<string, Direction> = {
  w: "up",
  ArrowUp: "up",
  s: "down",
  ArrowDown: "down",
  a: "left",
  ArrowLeft: "left",
  d: "right",
  ArrowRight: "right",
};

function isSolidAt(col: number, row: number): boolean {
  const { litTorches, veinDepletion, woodDepletion, forgeTier } = getState().world;
  return isSolidCellKind(hubCellAt(col, row, litTorches, veinDepletion, woodDepletion, forgeTier).kind);
}

export interface MoveOutcome {
  moved: boolean;
  blockedMessage: string | null;
}

/**
 * Attempt to move the dwarf one cell. Handles the full side-effect
 * chain: collision, exploration marking, first-zone-visit narration.
 * Returns whether anything actually changed (so the caller knows
 * whether a render/persist is warranted) and an optional message for
 * a blocked attempt the caller can show.
 */
export function handlePlayerMove(direction: Direction): MoveOutcome {
  const state = getState();
  const moveResult = attemptMove(state.vessel.position, direction, state.world, isSolidAt);

  if (!moveResult.moved) {
    const blockedMessage =
      moveResult.blockedReason === "locked_zone"
        ? "Something blocks the way - not yet rebuilt, not yet open to him."
        : null;
    return { moved: false, blockedMessage };
  }

  const newExplored = markVisibleCellsExplored(state.world.exploredCells, moveResult.position);
  const enteredZone = zoneContaining(moveResult.position.col, moveResult.position.row);
  const isFirstVisitToThisZone =
    enteredZone !== null && !state.world.loreFlags.includes(`visited_${enteredZone.id}`);

  setState({
    ...state,
    world: {
      ...state.world,
      exploredCells: newExplored,
      loreFlags: isFirstVisitToThisZone
        ? [...state.world.loreFlags, `visited_${enteredZone!.id}`]
        : state.world.loreFlags,
    },
    vessel: { ...state.vessel, position: moveResult.position },
  });

  if (isFirstVisitToThisZone) narrate("area_revealed");

  return { moved: true, blockedMessage: null };
}
