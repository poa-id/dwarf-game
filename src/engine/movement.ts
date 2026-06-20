import type { Position, WorldState } from "./types";
import { isCellPartOfUnlockedWorld } from "./visibility";
import { HUB_WIDTH, HUB_HEIGHT } from "./hubMap";

export type Direction = "up" | "down" | "left" | "right";

const DELTAS: Record<Direction, { dCol: number; dRow: number }> = {
  up: { dCol: 0, dRow: -1 },
  down: { dCol: 0, dRow: 1 },
  left: { dCol: -1, dRow: 0 },
  right: { dCol: 1, dRow: 0 },
};

export interface MoveResult {
  position: Position;
  moved: boolean; // false if blocked (locked zone, map edge, or solid terrain) - position unchanged
}

/**
 * Reports whether a map cell is physically solid (walls, the hearth,
 * furniture, ore veins - anything you can't walk onto). The engine
 * itself has no concept of terrain content (that's render-layer data,
 * see render/hubContent.ts), so this is supplied by the caller rather
 * than imported directly - keeps the engine UI/render-agnostic while
 * still letting movement respect real terrain.
 */
export type SolidityCheck = (col: number, row: number) => boolean;

/**
 * Attempt to move one cell in a direction. Pure function - returns the
 * resulting position whether or not the move succeeded, so callers can
 * always just take `.position` without branching, and check `.moved`
 * only if they care to react to a blocked attempt (e.g. a "the way is
 * dark and unknown" flavor message, bumping-into-wall feedback, etc).
 */
export function attemptMove(
  current: Position,
  direction: Direction,
  world: WorldState,
  isSolid: SolidityCheck
): MoveResult {
  const { dCol, dRow } = DELTAS[direction];
  const targetCol = current.col + dCol;
  const targetRow = current.row + dRow;

  const withinBounds =
    targetCol >= 0 && targetCol < HUB_WIDTH && targetRow >= 0 && targetRow < HUB_HEIGHT;

  if (!withinBounds) {
    return { position: current, moved: false };
  }

  if (!isCellPartOfUnlockedWorld(targetCol, targetRow, world)) {
    return { position: current, moved: false };
  }

  if (isSolid(targetCol, targetRow)) {
    return { position: current, moved: false };
  }

  return { position: { col: targetCol, row: targetRow }, moved: true };
}
