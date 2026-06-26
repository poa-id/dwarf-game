import type { Position, WorldState, ZoneDefinition } from "./types";
import { isCellPartOfUnlockedWorld, zoneContaining } from "./visibility";
import { HUB_WIDTH, HUB_HEIGHT } from "./hubMap";

export type Direction = "up" | "down" | "left" | "right";

const DELTAS: Record<Direction, { dCol: number; dRow: number }> = {
  up: { dCol: 0, dRow: -1 },
  down: { dCol: 0, dRow: 1 },
  left: { dCol: -1, dRow: 0 },
  right: { dCol: 1, dRow: 0 },
};

export type BlockedReason = "out_of_bounds" | "locked_zone" | "solid_terrain" | null;

export interface MoveResult {
  position: Position;
  moved: boolean; // false if blocked (locked zone, map edge, or solid terrain) - position unchanged
  /** Why the move failed, or null if it succeeded. Lets callers react differently to "that's a wall" vs "that area is locked" rather than treating every block identically. */
  blockedReason: BlockedReason;
  /**
   * WHICH zone blocked the move, when blockedReason is "locked_zone" -
   * null otherwise. Added 2026-06-23 fixing a real reported gap: the
   * blocked-movement message used to be the same generic flavor line
   * regardless of which zone (or how far from its real unlock
   * condition) the player actually hit. Callers can use this plus
   * visibility.ts's describeUnlockCondition to tell the player WHAT
   * unlocks the zone, not just that it's locked.
   */
  blockedZone: ZoneDefinition | null;
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
 * (or `.blockedReason` for WHY) only if they care to react to a
 * blocked attempt.
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
    return { position: current, moved: false, blockedReason: "out_of_bounds", blockedZone: null };
  }

  if (!isCellPartOfUnlockedWorld(targetCol, targetRow, world)) {
    return {
      position: current,
      moved: false,
      blockedReason: "locked_zone",
      blockedZone: zoneContaining(targetCol, targetRow),
    };
  }

  if (isSolid(targetCol, targetRow)) {
    return { position: current, moved: false, blockedReason: "solid_terrain", blockedZone: null };
  }

  return { position: { col: targetCol, row: targetRow }, moved: true, blockedReason: null, blockedZone: null };
}
