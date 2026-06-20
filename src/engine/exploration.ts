import type { ExploredCellMap, Position } from "./types";
import { cellKey } from "./types";
import { DEFAULT_LIGHT_RADIUS, isWithinLightRadius } from "./visibility";

/**
 * Mark every cell within `radius` of `center` as explored. Generic
 * helper used both for the dwarf's own movement (see
 * markVisibleCellsExplored below) and for one-off reveal events like
 * repairing a torch - the instant a torch lights, its surrounding area
 * should be visible immediately, not wait for the dwarf to happen to
 * walk a lap around it later.
 */
export function markAreaExplored(
  exploredCells: ExploredCellMap,
  center: Position,
  radius: number
): ExploredCellMap {
  const updated: ExploredCellMap = { ...exploredCells };

  for (let dRow = -radius; dRow <= radius; dRow++) {
    for (let dCol = -radius; dCol <= radius; dCol++) {
      const col = center.col + dCol;
      const row = center.row + dRow;
      if (isWithinLightRadius(col, row, center, radius)) {
        updated[cellKey(col, row)] = true;
      }
    }
  }

  return updated;
}

/**
 * Given the dwarf's current position, return an updated ExploredCellMap
 * with every cell currently within light radius marked explored. Pure
 * function, returns a NEW map (does not mutate input) - consistent with
 * the rest of the engine's immutable-update style.
 *
 * Only adds entries, never removes - exploration is permanent, per the
 * "remembered forever" design decision. Cheap to call every move since
 * the radius is small (a few dozen cells at most).
 */
export function markVisibleCellsExplored(
  exploredCells: ExploredCellMap,
  dwarfPosition: Position,
  radius: number = DEFAULT_LIGHT_RADIUS
): ExploredCellMap {
  return markAreaExplored(exploredCells, dwarfPosition, radius);
}
