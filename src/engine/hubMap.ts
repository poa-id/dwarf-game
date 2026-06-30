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
    // Changed from hearth_color_stage_at_least (2026-06-23, playtesting
    // feedback): the mine unlocking at the exact same threshold as
    // rekindle-eligibility was confusing in play - both happening at
    // once read as "rekindling cleared the rubble," which wasn't true,
    // it just LOOKED that way since they shared a trigger. Per explicit
    // project direction, decoupled to its own forge-progress milestone
    // instead: forgeTier 2 (Bellows of the Deep, 250 Insight) requires
    // having rekindled at least once for real, which is a more
    // deliberate gate than "stoke the hearth a bunch."
    unlock: { type: "forge_tier_at_least", tier: 2 },
  },
];

export function zoneById(id: string): ZoneDefinition | undefined {
  return ZONES.find((z) => z.id === id);
}

/**
 * The Forge building's exact 4x4 footprint within the Forge Room -
 * derived from the REAL `forge_room` zone entry above, not a separately
 * hardcoded guess. The single source of truth both hubContent.ts
 * (which stamps the FORGE_BUILDING sprite here) and proximity.ts
 * (which decides where the player can stand to interact with it) now
 * share. Added 2026-06-23 to fix a real, reproducible bug: the two
 * files previously computed their own independent guesses at "where is
 * the forge" that never matched - proximity.ts's old `FORGE_CENTER`
 * pointed at one of the building's own SOLID interior cells, walled in
 * on every side except one lucky diagonal corner. "The forge is only
 * accessible through the lower right corner" was an exact, reproducible
 * consequence of that mismatch, not a vague feel issue. See
 * exampleSprites.ts's `FORGE_BUILDING` for the actual 4x4 layout (solid
 * wall frame around a 2x2 forge interior, with `null`/non-overriding
 * corners).
 */
const forgeRoomBounds = zoneById("forge_room")!.bounds;
export const FORGE_BUILDING_FOOTPRINT = {
  originCol: forgeRoomBounds.col + Math.floor((forgeRoomBounds.width - 4) / 2),
  originRow: forgeRoomBounds.row + Math.floor((forgeRoomBounds.height - 4) / 2),
  width: 4,
  height: 4,
};

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
  // Iron and coal - the Tunnel Entrance's first real content (added
  // 2026-06-23, fixing a genuine "the mine unlocked but is empty"
  // gap found in playtesting). Both embedded against the zone's own
  // walls (col 20 left, col 29 right - the zone spans col 20-29, row
  // 30-37), at row 34, clear of the entrance corridor (which runs
  // along col 25) and the Tunnel Mouth Torch at (25, 31). Finite, NOT
  // infinite like the starter copper vein/wood node - see mining.ts's
  // comments on those for why basic/foundational materials are
  // infinite while better materials staying finite/gated is fine and
  // expected (LORE.md's "Never Deadlock the Engine" principle).
  {
    id: "tunnel_entrance_iron",
    rockNodeId: "iron_vein",
    position: { col: 20, row: 34 },
  },
  {
    id: "tunnel_entrance_coal",
    rockNodeId: "coal_seam",
    position: { col: 29, row: 34 },
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

/** Geometric center of the Hearth Hall, also the visual/light center of the Hearth structure. */
export const HEARTH_CENTER: Position = {
  col: ZONES.find((z) => z.id === "hearth_hall")!.bounds.col + Math.floor(ZONES.find((z) => z.id === "hearth_hall")!.bounds.width / 2),
  row: ZONES.find((z) => z.id === "hearth_hall")!.bounds.row + Math.floor(ZONES.find((z) => z.id === "hearth_hall")!.bounds.height / 2),
};

/** Center of the Forge building, used as the light emission point once repaired. */
export const FORGE_CENTER: Position = {
  col: FORGE_BUILDING_FOOTPRINT.originCol + Math.floor(FORGE_BUILDING_FOOTPRINT.width / 2),
  row: FORGE_BUILDING_FOOTPRINT.originRow + Math.floor(FORGE_BUILDING_FOOTPRINT.height / 2),
};

/**
 * The Smelter - a Forge Room addon (added 2026-06-23, see
 * smelter.ts), centered on the bottom open-floor strip directly below
 * the Forge building (which occupies col 48-51, row 22-25 - see
 * FORGE_BUILDING_FOOTPRINT). Clear of the row-25 corridor that enters
 * the room from the Hearth Hall. Unlike the Kiln, the Smelter must be
 * BUILT (Insight + materials) before it's usable at all - it's not
 * simply always-available like the Kiln/Forge-room-itself; see
 * WorldState.smelterBuilt and smelterPanel.ts.
 */
export const SMELTER_POSITION: Position = { col: 49, row: 26 };

/**
 * The Gemcutting station (added 2026-06-23, alongside the Tinkering
 * skill) - placed in the Hearth Hall, near the copper vein and kiln,
 * rather than the Forge Room like the Smelter. Thematic reasoning:
 * gems are a MINING byproduct (gathering.ts's gemDrop config on rock
 * nodes), not a Smithing one - it makes more sense for the cutting
 * station to sit near where the player is already gathering, not
 * bundled into "Forge Room addons." Clear of the corridor (row 25,
 * and the vertical legs at col 36/44) and every existing Hearth Hall
 * fixture (copper vein at 36,23; wood node at 44,23; kiln at 43,23;
 * hearth at 40,25).
 */
export const GEMCUTTING_POSITION: Position = { col: 37, row: 28 };
