import type { ZoneDefinition, Position, LightSourceDefinition } from "./types";

/**
 * The Hub is one fixed, hand-designed map. These coordinates ARE the
 * level design — changing them changes the game's geography permanently.
 *
 * LAYOUT (redesigned 2026-06-30): octagonal star pattern with the
 * Hearth at the center of a circular hall, and 8 rooms radiating
 * outward connected by L-shaped corridors (horizontal + vertical
 * legs — no diagonal movement required). Four rooms are active
 * content; four are sealed rubble passages reserved for future
 * expansion.
 *
 * Map: 80 wide × 50 tall. Center: col 40, row 25.
 *
 *   [sealed_NW]  [sealed_N]  [forge_room]
 *        NW          N            NE
 *    [mine_room] -- [HEARTH] -- [sealed_E]
 *        W                         E
 *   [garden_room] [sealed_S] [tinkering_room]
 *        SW          S             SE
 *
 * All corridors are L-shaped (right/left then up/down) so WASD
 * navigation never requires diagonal movement.
 */

export const HUB_WIDTH = 80;
export const HUB_HEIGHT = 50;

/** Where a freshly rekindled dwarf wakes — just south of the Hearth. */
export const HEARTH_SPAWN_POSITION: Position = { col: 40, row: 28 };

/** Geometric center of the map and the Hearth structure. */
export const MAP_CENTER: Position = { col: 40, row: 25 };

export const ZONES: ZoneDefinition[] = [
  // ── Central Hall ─────────────────────────────────────────────────
  // Circular approximation (r=9) carved cell-by-cell in hubContent.ts,
  // not a rectangle. The bounding box here is used for zone-unlock
  // checks and fog-of-war exploration only.
  {
    id: "central_hall",
    name: "The Hearth Hall",
    bounds: { col: 31, row: 16, width: 19, height: 19 },
    unlock: { type: "always" },
  },

  // ── NE: Forge Room ───────────────────────────────────────────────
  {
    id: "forge_room",
    name: "Forge Room",
    bounds: { col: 52, row: 9, width: 12, height: 11 },
    unlock: { type: "always" }, // room always reachable; forge starts broken
  },

  // ── W: Mine Room ─────────────────────────────────────────────────
  {
    id: "mine_room",
    name: "The Mine",
    bounds: { col: 6, row: 20, width: 13, height: 11 },
    unlock: { type: "always" },
  },

  // ── SW: Garden Room ──────────────────────────────────────────────
  {
    id: "garden_room",
    name: "The Garden",
    bounds: { col: 6, row: 35, width: 13, height: 11 },
    unlock: { type: "always" }, // open but broken — planters to repair
  },

  // ── SE: Tinkering Room ───────────────────────────────────────────
  {
    id: "tinkering_room",
    name: "Tinkering Room",
    bounds: { col: 52, row: 36, width: 12, height: 11 },
    unlock: { type: "forge_tier_at_least", tier: 2 },
  },

  // ── Sealed passages (rubble — future content) ────────────────────
  {
    id: "sealed_north",
    name: "Collapsed Passage",
    bounds: { col: 35, row: 5, width: 11, height: 8 },
    unlock: { type: "always" }, // zone exists; the RUBBLE cell blocks entry
  },
  {
    id: "sealed_south",
    name: "Collapsed Passage",
    bounds: { col: 35, row: 38, width: 11, height: 8 },
    unlock: { type: "always" },
  },
  {
    id: "sealed_east",
    name: "Collapsed Passage",
    bounds: { col: 52, row: 20, width: 12, height: 11 },
    unlock: { type: "always" },
  },
  {
    id: "sealed_northwest",
    name: "Collapsed Passage",
    bounds: { col: 6, row: 9, width: 13, height: 11 },
    unlock: { type: "always" },
  },
];

export function zoneById(id: string): ZoneDefinition | undefined {
  return ZONES.find((z) => z.id === id);
}

// ── Structure footprints ─────────────────────────────────────────────────────

/** Forge 4×4 building, anchored at top-left of the Forge Room. */
export const FORGE_BUILDING_FOOTPRINT = {
  originCol: 54,
  originRow: 11,
  width: 4,
  height: 4,
};

/**
 * Hearth 4×4 footprint, centered on MAP_CENTER.
 * Anchor = top-left of the 4×4 = center - 2.
 */
export const HEARTH_FOOTPRINT = {
  originCol: MAP_CENTER.col - 2, // 38
  originRow: MAP_CENTER.row - 2, // 23
  width: 4,
  height: 4,
};

/** Light emission center for the Hearth (visual/geometric center). */
export const HEARTH_CENTER: Position = MAP_CENTER;

/** Light emission center for the Forge. */
export const FORGE_CENTER: Position = {
  col: FORGE_BUILDING_FOOTPRINT.originCol + 2,
  row: FORGE_BUILDING_FOOTPRINT.originRow + 2,
};

// ── Structure positions ───────────────────────────────────────────────────────

/** Smelter 2×2 add-on, anchored directly below the Forge building. */
export const SMELTER_POSITION: Position = {
  col: FORGE_BUILDING_FOOTPRINT.originCol,
  row: FORGE_BUILDING_FOOTPRINT.originRow + FORGE_BUILDING_FOOTPRINT.height,
};

/** Gemcutting station 4×4 anchor in the Tinkering Room. */
export const GEMCUTTING_POSITION: Position = { col: 54, row: 38 };

/** Charcoal Kiln in the Garden Room, beside the wood node. */
export const KILN_POSITION: Position = { col: 10, row: 38 };

// ── Ore vein placements ───────────────────────────────────────────────────────

export interface OreVeinPlacement {
  id: string;
  rockNodeId: string;
  position: Position;
}

export const ORE_VEINS: OreVeinPlacement[] = [
  // Mine Room — veins against the walls, open center for future workstations.
  // Copper on the south wall, accessible from start.
  {
    id: "mine_copper",
    rockNodeId: "copper_vein",
    position: { col: 8, row: 29 },
  },
  // Iron on the north wall.
  {
    id: "mine_iron",
    rockNodeId: "iron_vein",
    position: { col: 8, row: 21 },
  },
  // Coal on the east wall (right side of room).
  {
    id: "mine_coal",
    rockNodeId: "coal_seam",
    position: { col: 17, row: 25 },
  },
  // Deepstone near the mine shaft, far west end.
  {
    id: "mine_deepstone",
    rockNodeId: "deepstone",
    position: { col: 8, row: 25 },
  },
];

/** The broken mine shaft — menu-accessed in future, visual marker now. */
export const MINE_SHAFT_POSITION: Position = { col: 8, row: 25 };

// ── Wood node placements ──────────────────────────────────────────────────────

export interface WoodNodePlacement {
  id: string;
  woodNodeId: string;
  position: Position;
}

export const WOOD_NODE_PLACEMENTS: WoodNodePlacement[] = [
  // Garden Room — skylit, living wood. The dwarf harvests from here
  // rather than mining ore. Future: rare tree species in restored planters.
  {
    id: "garden_roots",
    woodNodeId: "root_tangle",
    position: { col: 8, row: 38 },
  },
];

// ── Torches ───────────────────────────────────────────────────────────────────

export const LIGHT_SOURCES: LightSourceDefinition[] = [
  // NE corridor (to Forge Room) — one torch at each leg of the L
  {
    id: "torch_ne_vert",
    name: "Corridor Torch (Forge Road, vertical leg)",
    position: { col: 49, row: 21 },
    radius: 2,
    repairCost: { copper_ingot: 3 },
  },
  {
    id: "torch_ne_horiz",
    name: "Corridor Torch (Forge Road, horizontal leg)",
    position: { col: 50, row: 18 },
    radius: 2,
    repairCost: { copper_ingot: 3 },
  },
  // W corridor (to Mine Room) — straight shot, one torch midway
  {
    id: "torch_w_corridor",
    name: "Corridor Torch (Mine Road)",
    position: { col: 25, row: 24 },
    radius: 2,
    repairCost: { copper_ingot: 3 },
  },
  // SW corridor (to Garden) — two torches for the L
  {
    id: "torch_sw_vert",
    name: "Corridor Torch (Garden Road, vertical leg)",
    position: { col: 31, row: 30 },
    radius: 2,
    repairCost: { copper_ingot: 3 },
  },
  {
    id: "torch_sw_horiz",
    name: "Corridor Torch (Garden Road, horizontal leg)",
    position: { col: 25, row: 34 },
    radius: 2,
    repairCost: { copper_ingot: 3 },
  },
];

export function lightSourceById(id: string): LightSourceDefinition | undefined {
  return LIGHT_SOURCES.find((l) => l.id === id);
}
