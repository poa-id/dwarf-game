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
    name: "The Stockpile",
    bounds: { col: 52, row: 20, width: 12, height: 11 },
    unlock: { type: "always" }, // passage exists; rubble blocks until stockpile_room cleared
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

/** Forge 6×6 building, anchored at top-left of the Forge Room. */
export const FORGE_BUILDING_FOOTPRINT = {
  originCol: 54,
  originRow: 9,
  width: 6,
  height: 6,
};

/**
 * Hearth 4×4 footprint, centered on MAP_CENTER.
 * Anchor = top-left of the 6×6 = center - 3.
 * 6×6 because this is the heart of the mountain — it must dominate the hall.
 */
export const HEARTH_FOOTPRINT = {
  originCol: MAP_CENTER.col - 3, // 37
  originRow: MAP_CENTER.row - 3, // 22
  width: 6,
  height: 6,
};

/** Light emission center for the Hearth (visual/geometric center). */
export const HEARTH_CENTER: Position = MAP_CENTER;

/** Light emission center for the Forge. */
export const FORGE_CENTER: Position = {
  col: FORGE_BUILDING_FOOTPRINT.originCol + 3,
  row: FORGE_BUILDING_FOOTPRINT.originRow + 3,
};

// ── Structure positions ───────────────────────────────────────────────────────

/** Smelter 2×2 add-on, anchored directly below the Forge building. */
export const SMELTER_POSITION: Position = {
  col: FORGE_BUILDING_FOOTPRINT.originCol,
  row: FORGE_BUILDING_FOOTPRINT.originRow + FORGE_BUILDING_FOOTPRINT.height,
};

/** Gemcutting station 6×6 anchor in the Tinkering Room. */
export const GEMCUTTING_POSITION: Position = { col: 54, row: 36 };

/** Charcoal Kiln in the Garden Room, beside the wood node. */
export const KILN_POSITION: Position = { col: 15, row: 35 }; // against north wall, 2×2: cols 15-16, rows 35-36

/**
 * Narag-Bund's resting spot once befriended — just south-east of the
 * Hearth, on open hall floor. Always visible here once the player
 * has unlocked the Friend of Burden upgrade. His map presence
 * confirms he's real rather than just a UI panel status line.
 */
export const COMPANION_POSITION: Position = { col: 42, row: 27 };

/** The Mountain Console — ancient stone terminal in the northwest quadrant of the central hall. */
export const CONSOLE_POSITION: Position = { col: 35, row: 22 };

/**
 * Stockpile chest — the ore storage anchor in the east wing once
 * the stockpile_room is cleared. Centered in the east room (cols 52-63, rows 21-30).
 * 6×7 footprint: anchor so it fills rows 21-27, cols 52-57. */
export const STOCKPILE_CHEST_POSITION: Position = { col: 52, row: 21 };

// ── Ore vein placements ───────────────────────────────────────────────────────

export interface OreVeinPlacement {
  id: string;
  rockNodeId: string;
  position: Position;
}

export const ORE_VEINS: OreVeinPlacement[] = [
  // Mine Room — veins against the walls, open center for future workstations.
  // 3×3 veins against walls. Mine room: cols 6-18, rows 20-30.
  {
    id: "mine_iron",
    rockNodeId: "iron_vein",
    position: { col: 6, row: 20 },  // 3×3: cols 6-8, rows 20-22 (north-west, pushed up)
  },
  {
    id: "mine_deepstone",
    rockNodeId: "deepstone",
    position: { col: 6, row: 24 },  // 3×3: cols 6-8, rows 24-26 (one row lower)
  },
  {
    id: "mine_copper",
    rockNodeId: "copper_vein",
    position: { col: 6, row: 28 },  // 3×3: cols 6-8, rows 28-30 (south-west, pushed down)
  },
  {
    id: "mine_coal",
    rockNodeId: "coal_seam",
    position: { col: 16, row: 28 }, // 3×3: cols 16-18, rows 28-30 (SE corner, opposite copper)
  },
];

/** The mine shaft entrance — 3×3 footprint, partially into north wall.
 * Anchor at row 17 so the mouth is at row 20 (the room floor edge),
 * with the shaft body at rows 17-19 embedded in the north rock wall.
 * Cols 10-12 (centred in the mine room width). */
export const MINE_SHAFT_POSITION: Position = { col: 10, row: 17 };

// ── Wood node placements ──────────────────────────────────────────────────────

export interface WoodNodePlacement {
  id: string;
  woodNodeId: string;
  position: Position;
}

export const WOOD_NODE_PLACEMENTS: WoodNodePlacement[] = [
  // Garden Room — root tangle on the west wall, 3×3 footprint.
  {
    id: "garden_roots",
    woodNodeId: "root_tangle",
    position: { col: 6, row: 35 },  // 3×3: cols 6-8, rows 35-37 (against north wall)
  },
];

// ── Torches ───────────────────────────────────────────────────────────────────

// Corridor torches removed — they blocked navigation and were replaced
// by the player-placed torch system (T key, wall-mounted only).
// LIGHT_SOURCES is kept empty so existing save data with litTorches
// keys doesn't break — the keys just won't match anything.
export const LIGHT_SOURCES: LightSourceDefinition[] = [];

export function lightSourceById(id: string): LightSourceDefinition | undefined {
  return LIGHT_SOURCES.find((l) => l.id === id);
}

/** 6 planter positions in 3 columns × 2 rows.
 * Columns at cols 6, 10, 14 (each 3 wide). Gap columns at 9 and 13 (walkable).
 * Row 1: rows 38-40. Gap row: 41. Row 2: rows 42-44 (= SW corridor zone).
 * The corridor passes through gap cols 9 and 13 at rows 42-44.
 * Tree root (6,35) and kiln (15,35) are against the north wall (rows 35-37). */
export const PLANTER_POSITIONS: Position[] = [
  { col: 6,  row: 38 }, // slot 0 — north-west (rows 38-40), always unlocked
  { col: 10, row: 38 }, // slot 1 — north-centre (rows 38-40)
  { col: 14, row: 38 }, // slot 2 — north-east (rows 38-40)
  { col: 6,  row: 42 }, // slot 3 — south-west (rows 42-44, in corridor zone)
  { col: 10, row: 42 }, // slot 4 — south-centre (rows 42-44)
  { col: 14, row: 42 }, // slot 5 — south-east (rows 42-44)
];
