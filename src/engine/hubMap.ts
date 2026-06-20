import type { ZoneDefinition, Position } from "./types";

/**
 * The Hub is one fixed, hand-placed map - not generated. These
 * coordinates ARE the level design. Changing them changes the game's
 * geography permanently, so treat this file as content, not config.
 *
 * Layout intent: the Hearth Hall sits at the center, since the hearth
 * is "the heart of the mountain" - everything else radiates outward
 * from it. The Forge sits adjacent (an early unlock, close by). The
 * tunnel entrance - where mining is represented, where carts will come
 * and go once unlocked - sits further off, since reaching it is itself
 * a milestone.
 */

export const HUB_WIDTH = 80;
export const HUB_HEIGHT = 50;

/** Where a freshly rekindled dwarf wakes - the heart of the hearth hall, always. */
export const HEARTH_SPAWN_POSITION: Position = { col: 40, row: 25 };

export const ZONES: ZoneDefinition[] = [
  {
    id: "hearth_hall",
    name: "Hearth Hall",
    bounds: { col: 36, row: 21, width: 9, height: 9 },
    unlock: { type: "always" },
  },
  {
    id: "forge_room",
    name: "Forge Room",
    bounds: { col: 46, row: 21, width: 8, height: 7 },
    unlock: { type: "forge_tier_at_least", tier: 1 },
  },
  {
    id: "tunnel_entrance",
    name: "Tunnel Entrance",
    bounds: { col: 20, row: 30, width: 10, height: 8 },
    unlock: { type: "hearth_color_stage_at_least", stage: 1 },
  },
];

export function zoneById(id: string): ZoneDefinition | undefined {
  return ZONES.find((z) => z.id === id);
}
