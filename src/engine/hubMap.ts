import type { ZoneDefinition, Position, LightSourceDefinition } from "./types";

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
    unlock: { type: "always" }, // the ROOM is always reachable - the forge inside it starts broken/rubble, repaired via materials, not a zone-unlock gate
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

/**
 * Torches, hand-placed along the corridors connecting the hearth hall
 * to other zones - exactly where the player feels the dark most
 * (the stretch between known rooms), and where a repaired torch reads
 * as a clear, visible act of reclaiming ground. Positions follow the
 * same L-shaped corridor paths hubContent.ts carves (horizontal leg
 * along the hearth hall's row, then vertical leg into the target).
 */
export const LIGHT_SOURCES: LightSourceDefinition[] = [
  {
    id: "torch_corridor_forge",
    name: "Corridor Torch (Forge Road)",
    position: { col: 44, row: 25 }, // partway along the horizontal leg toward the forge room
    radius: 2,
    repairCost: { copper_ingot: 3 },
  },
  {
    id: "torch_corridor_tunnel",
    name: "Corridor Torch (Tunnel Road)",
    position: { col: 25, row: 25 }, // partway along the horizontal leg toward the tunnel entrance
    radius: 2,
    repairCost: { copper_ingot: 3 },
  },
  {
    id: "torch_tunnel_mouth",
    name: "Tunnel Mouth Torch",
    position: { col: 25, row: 31 }, // just inside the tunnel entrance zone itself
    radius: 2,
    repairCost: { copper_ingot: 5 },
  },
];

export function lightSourceById(id: string): LightSourceDefinition | undefined {
  return LIGHT_SOURCES.find((l) => l.id === id);
}

/**
 * Fixed ore vein placements on the Hub map. Just one for now (copper,
 * embedded in the hearth hall's left wall, always reachable from spawn
 * with zero unlock requirement) - this is intentionally the very first
 * thing a new dwarf can interact with, mirroring "mine_first_strike"
 * being the first narrator trigger after waking.
 *
 * Placed against the wall (col 36, the hearth hall's left boundary -
 * see ZONES) rather than floating mid-room, deliberately offset from
 * row 25 (the tunnel corridor's exit row) so it never blocks that
 * path. Reads as rock embedded in the wall face, not a pile of stuff
 * sitting in the open - reinforcing that this is a permanent geological
 * feature (see mining.ts's copper_vein comment on why it's now
 * infinite, not a depleting resource).
 */
export interface OreVeinPlacement {
  id: string;
  rockNodeId: string; // matches a RockNode.id in mining.ts
  position: Position;
}

export const ORE_VEINS: OreVeinPlacement[] = [
  {
    id: "hearth_hall_copper",
    rockNodeId: "copper_vein",
    position: { col: 36, row: 23 },
  },
];

/**
 * Fixed wood node placements - cave-root tangles. Embedded against the
 * hearth hall's right wall (col 44), directly adjacent to the Charcoal
 * Kiln - "gather wood, then immediately burn it" reads as one short
 * step, not a walk across the room. Offset from row 25 (the forge
 * corridor's exit row) so it never blocks that path. Gatherable from
 * the very start, since the first forge repair needs BOTH wood and ore
 * together - the player shouldn't have to fully unlock one before
 * discovering the other exists.
 */
export interface WoodNodePlacement {
  id: string;
  woodNodeId: string; // matches a WoodNode.id in woodcraft.ts
  position: Position;
}

export const WOOD_NODE_PLACEMENTS: WoodNodePlacement[] = [
  {
    id: "hearth_hall_roots",
    woodNodeId: "root_tangle",
    position: { col: 44, row: 23 },
  },
];

/**
 * The Charcoal Kiln - one fixed structure in the Hearth Hall, on the
 * way between the wood node and the corridor to the Forge Room (so
 * "gather wood, burn it, carry charcoal to the forge" reads as a
 * single short walk, not a backtrack). Unlike the Forge or torches,
 * the kiln has no broken/repaired state - it's always usable from the
 * start (see kiln.ts), so it needs only a position, not a tier or
 * unlock condition.
 */
export const KILN_POSITION: Position = { col: 43, row: 23 };
