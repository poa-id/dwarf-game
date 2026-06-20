import type { WorldState, ZoneDefinition, Position, UnlockCondition } from "./types";
import { ZONES } from "./hubMap";

// ---------------------------------------------------------------------------
// Zone unlocking
// ---------------------------------------------------------------------------

export function isUnlockConditionMet(condition: UnlockCondition, world: WorldState): boolean {
  switch (condition.type) {
    case "always":
      return true;
    case "forge_tier_at_least":
      return world.forgeTier >= condition.tier;
    case "hearth_color_stage_at_least":
      return world.hearth.colorStage >= condition.stage;
    case "lore_flag":
      return world.loreFlags.includes(condition.flag);
  }
}

export function isZoneUnlocked(zone: ZoneDefinition, world: WorldState): boolean {
  return isUnlockConditionMet(zone.unlock, world);
}

export function unlockedZones(world: WorldState): ZoneDefinition[] {
  return ZONES.filter((z) => isZoneUnlocked(z, world));
}

/** Which zone (if any) contains a given map coordinate. */
export function zoneContaining(col: number, row: number): ZoneDefinition | null {
  return (
    ZONES.find((z) => {
      const { bounds } = z;
      return (
        col >= bounds.col &&
        col < bounds.col + bounds.width &&
        row >= bounds.row &&
        row < bounds.row + bounds.height
      );
    }) ?? null
  );
}

/**
 * Whether a specific cell is currently reachable/visible-eligible at
 * all - i.e. it belongs to an unlocked zone (or to no zone, which we
 * treat as "open corridor between zones," always present once adjacent
 * areas are unlocked - see isCellPartOfUnlockedWorld for the full rule).
 *
 * For now, cells outside any defined zone are considered part of the
 * always-unlocked connective tissue of the Hub (the halls between
 * rooms) - only the special, named rooms themselves gate behind
 * progress. This keeps early-game movement from feeling like a maze of
 * invisible walls before the player has unlocked anything.
 */
export function isCellPartOfUnlockedWorld(col: number, row: number, world: WorldState): boolean {
  const zone = zoneContaining(col, row);
  if (!zone) return true; // open hall, not a gated room
  return isZoneUnlocked(zone, world);
}

// ---------------------------------------------------------------------------
// Light radius / fog of war
// ---------------------------------------------------------------------------

export const DEFAULT_LIGHT_RADIUS = 4;

/**
 * Simple circular light radius around a position - no line-of-sight/
 * occlusion yet (a torch doesn't care about walls in v1). Returns true
 * if the cell is within the lit radius of the given center.
 *
 * Uses squared distance to avoid a sqrt per cell; fine at our grid
 * sizes (checking a few hundred cells per light query is trivial).
 */
export function isWithinLightRadius(
  col: number,
  row: number,
  center: Position,
  radius: number = DEFAULT_LIGHT_RADIUS
): boolean {
  const dx = col - center.col;
  const dy = row - center.row;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Three-state visibility for a single cell, used directly by the
 * renderer to decide what to draw:
 *
 * - "hidden": never seen, not currently lit, OR belongs to a locked
 *   zone - draw nothing (true void).
 * - "remembered": previously explored, not currently lit - draw dim/
 *   memory version.
 * - "lit": within the dwarf's current light radius - draw at full
 *   brightness.
 *
 * Locked zones are always "hidden" regardless of explored history -
 * exploration from a PREVIOUS unlock state doesn't leak through if a
 * zone somehow became locked again (not currently possible since
 * unlocks are one-way, but keeping the check here makes that
 * invariant explicit rather than assumed.)
 */
export type CellVisibility = "hidden" | "remembered" | "lit";

export function cellVisibility(
  col: number,
  row: number,
  dwarfPosition: Position,
  world: WorldState,
  exploredKey: string,
  radius: number = DEFAULT_LIGHT_RADIUS
): CellVisibility {
  if (!isCellPartOfUnlockedWorld(col, row, world)) return "hidden";

  if (isWithinLightRadius(col, row, dwarfPosition, radius)) return "lit";

  if (world.exploredCells[exploredKey]) return "remembered";

  return "hidden";
}
