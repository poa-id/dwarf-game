import type { WorldState, ZoneDefinition, Position, UnlockCondition } from "./types";
import { ZONES, LIGHT_SOURCES, HEARTH_CENTER, FORGE_CENTER, KILN_POSITION } from "./hubMap";
import { FORGE_UPGRADES } from "./smithing";

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

/**
 * Human-readable text for what would unlock a given condition - used
 * by the blocked-movement message (movement.ts) so a player standing
 * at a locked zone's boundary learns WHAT unlocks it, not just that
 * it's locked. Added 2026-06-23, fixing a real reported gap: the
 * Tunnel Entrance's boundary gave the same generic "something blocks
 * the way" flavor line regardless of how far the player actually was
 * from meeting its real unlock condition (forge_tier_at_least: 2).
 * Looks up the real Forge upgrade name (e.g. "Bellows of the Deep")
 * rather than showing a raw tier number, consistent with how the rest
 * of the game names things.
 */
export function describeUnlockCondition(condition: UnlockCondition): string {
  switch (condition.type) {
    case "always":
      return "";
    case "forge_tier_at_least": {
      const upgrade = FORGE_UPGRADES.find((u) => u.tier === condition.tier);
      return upgrade ? `Requires the Forge upgraded to "${upgrade.name}".` : `Requires Forge tier ${condition.tier}.`;
    }
    case "hearth_color_stage_at_least":
      return `Requires the Hearth to reach color stage ${condition.stage}.`;
    case "lore_flag":
      return "Requires something not yet discovered.";
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
 * Bresenham line-of-sight check between two grid cells. Returns true
 * if there is a clear path from `from` to `to` without passing through
 * any solid cell. The source and target cells themselves are not
 * checked — only the cells in between matter for occlusion purposes
 * (a dwarf standing inside the hall should still see the hall walls
 * immediately around him, even though those wall cells are solid).
 *
 * The `isSolid` callback accepts a col/row pair and returns true if
 * that cell blocks line of sight. Passed in rather than imported so
 * this engine function stays decoupled from the render layer.
 */
export function hasLineOfSight(
  from: Position,
  to: Position,
  isSolid: (col: number, row: number) => boolean
): boolean {
  let x0 = from.col;
  let y0 = from.row;
  const x1 = to.col;
  const y1 = to.row;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  // Walk the line — skip the first cell (the dwarf's position) and
  // the last cell (the target itself), only check cells in between.
  while (true) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 <  dx) { err += dx; y0 += sy; }

    // Reached target — clear path
    if (x0 === x1 && y0 === y1) return true;

    // Intermediate cell is solid — line of sight blocked
    if (isSolid(x0, y0)) return false;
  }
}

/**
 * True if any currently-LIT torch's radius reaches this cell. Broken
 * (unrepaired) torches contribute no light at all - they're just
 * inert map content (the renderer can still draw them, dimly, once
 * within the dwarf's own radius or explored memory, same as any other
 * cell - but they don't push back the dark themselves until repaired).
 */
export function isWithinAnyLitTorch(col: number, row: number, world: WorldState): boolean {
  // Corridor torches (LIGHT_SOURCES) — now empty, kept for backward compat
  for (const torch of LIGHT_SOURCES) {
    if (!world.litTorches[torch.id]) continue;
    if (isWithinLightRadius(col, row, torch.position, torch.radius)) return true;
  }
  // Player-placed torches
  for (const [key, isLit] of Object.entries(world.placedTorches)) {
    if (!isLit) continue;
    const [tc, tr] = key.split(",").map(Number);
    if (isWithinLightRadius(col, row, { col: tc, row: tr }, 3)) return true;
  }
  return false;
}

/**
 * Combines the dwarf's own (larger, mobile) light with every lit
 * torch's (smaller, fixed) light. A cell is actively lit if EITHER
 * source reaches it - this is the full "what is lit right now"
 * answer, used both for rendering and for marking new exploration.
 */
/**
 * Combines the dwarf's own (larger, mobile) light with every lit
 * torch's (smaller, fixed) light, and the permanent structure lights
 * (Hearth, Forge). A cell is actively lit if ANY source reaches it
 * AND has clear line of sight to it.
 *
 * The optional `isSolid` callback enables line-of-sight occlusion —
 * walls between the light source and the cell block the light. When
 * omitted (e.g. in tests), falls back to the old circle-only behaviour.
 */
export function isActivelyLit(
  col: number,
  row: number,
  dwarfPosition: Position,
  world: WorldState,
  dwarfRadius: number = DEFAULT_LIGHT_RADIUS,
  isSolid?: (col: number, row: number) => boolean
): boolean {
  const target = { col, row };

  const los = (from: Position) =>
    !isSolid || hasLineOfSight(from, target, isSolid);

  // Dwarf's own mobile light — strict LOS
  if (isWithinLightRadius(col, row, dwarfPosition, dwarfRadius) && los(dwarfPosition)) return true;

  // Torches — strict LOS (a wall between you and a torch blocks its light)
  for (const torch of LIGHT_SOURCES) {
    if (!world.litTorches[torch.id]) continue;
    if (isWithinLightRadius(col, row, torch.position, torch.radius) && los(torch.position)) return true;
  }

  // Permanent structure lights — NO LOS check. The Hearth and Forge are
  // ambient room lighting: the whole hall basks in hearth-warmth, the
  // forge room glows from its furnace. Unlike a torch or the dwarf's
  // lantern, these are not point sources — applying LOS would cause the
  // Hearth to block its own light (its center is inside its own solid
  // 4×4 footprint, so every ray from (40,25) immediately hits stone).
  // Placed torches — player-mounted on walls, lit individually
  for (const [key, isLit] of Object.entries(world.placedTorches)) {
    if (!isLit) continue;
    const [c, r] = key.split(",").map(Number);
    if (isWithinLightRadius(col, row, { col: c, row: r }, 3) && los({ col: c, row: r })) return true;
  }

  if (isWithinLightRadius(col, row, HEARTH_CENTER, 5)) return true;
  if (world.forgeTier >= 1 && isWithinLightRadius(col, row, FORGE_CENTER, 4)) return true;
  // Kiln — always burning when built, emits warm ambient light in the garden room
  if (isWithinLightRadius(col, row, KILN_POSITION, 3)) return true;

  return false;
}

/**
 * Three-state visibility for a single cell, used directly by the
 * renderer to decide what to draw:
 *
 * - "hidden": never seen, not currently lit, OR belongs to a locked
 *   zone - draw nothing (true void).
 * - "remembered": previously explored, not currently lit - draw dim/
 *   memory version.
 * - "lit": within the dwarf's current light radius OR a lit torch's
 *   radius - draw at full brightness.
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
  _dwarfPosition: Position,
  world: WorldState,
  _exploredKey: string,
  _radius: number = DEFAULT_LIGHT_RADIUS,
  _cellKind?: string,
  _isSolid?: (col: number, row: number) => boolean
): CellVisibility {
  // Locked zones are always hidden
  if (!isCellPartOfUnlockedWorld(col, row, world)) return "hidden";

  // Everything unlocked is actively lit — no LOS, no fog of war.
  // Fire sources (hearth, forge, torches) add a warm color overlay
  // through the renderer's palette, but don't gate visibility.
  // This removes all the buggy dark gaps and half-lit corridors.
  return "lit";
}
