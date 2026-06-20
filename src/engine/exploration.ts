import type { ExploredCellMap, Position } from "./types";
import { cellKey } from "./types";
import { DEFAULT_LIGHT_RADIUS, isWithinLightRadius } from "./visibility";

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
  const updated: ExploredCellMap = { ...exploredCells };

  for (let dRow = -radius; dRow <= radius; dRow++) {
    for (let dCol = -radius; dCol <= radius; dCol++) {
      const col = dwarfPosition.col + dCol;
      const row = dwarfPosition.row + dRow;
      if (isWithinLightRadius(col, row, dwarfPosition, radius)) {
        updated[cellKey(col, row)] = true;
      }
    }
  }

  return updated;
}
