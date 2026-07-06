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

/**
 * Forge building, anchored at top-left of the Forge Room. Grown 6×6 ->
 * 7×7 (2026-07-04, per direction: "increase the size to 7x7 and it
 * will stick to the northern wall, and be centered" - the preferred
 * of two options offered, the other being a plain 1-row shift). Room
 * is cols 52-63 (12 wide); anchor col54 already gives the closest a
 * 7-wide structure can get to centered in a 12-wide room (2 cols
 * margin left, 3 right - can't be perfectly symmetric with an odd
 * leftover of 5). Row unchanged (9 = the room's own top row) - already
 * flush with the north wall before this change, growing height doesn't
 * need a row adjustment to stay that way.
 */
export const FORGE_BUILDING_FOOTPRINT = {
  originCol: 54,
  originRow: 9,
  width: 7,
  height: 7,
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

/**
 * Smelter add-on, grown 2×2 -> 3×3 and moved (2026-07-06, new sprite +
 * direct instruction: "move the smelter + change sprite") from
 * directly-below-the-Forge to the Forge Room's east addon column - the
 * top-right of 4 reserved 3×3 slots flanking the Forge (2 stacked on
 * each side), matching the layout sketched directly on a screenshot.
 * Room is cols 52-63 (12 wide); Forge itself occupies cols 54-60 (7
 * wide), leaving cols 61-63 free on the east side - exactly 3 columns,
 * fits without needing to widen the room at all.
 */
export const SMELTER_POSITION: Position = { col: 61, row: 10 };

/**
 * Reserved Forge addon slots (2026-07-06) - NOT wired to any rendering
 * or game logic yet ("progress locked for the time being, but reserve
 * the space" - direct instruction). Sprites already in hand
 * (quenching-tank.png, sharpening-station.png, imbuing.png) for
 * whenever these get built. Bottom-right (FORGE_ADDON_SE) is the
 * fourth slot in the 2x2-of-slots layout; the Smelter took the
 * top-right slot (see SMELTER_POSITION above).
 *
 * West column needed one more column than the Forge Room's own bounds
 * currently provide (only cols 52-53 are free inside the room to the
 * Forge's west) - cols 51-53 works instead, since col 51 is already
 * open floor via the existing NE vertical corridor that runs through
 * there (fill(49,9,51,22) in hubContent.ts) - no room-bounds change
 * needed, just using floor that's already there.
 */
export const FORGE_ADDON_NW: Position = { col: 51, row: 10 }; // reserved - not yet built
export const FORGE_ADDON_SW: Position = { col: 51, row: 14 }; // reserved - not yet built
export const FORGE_ADDON_SE: Position = { col: 61, row: 14 }; // reserved - not yet built

/**
 * Gemcutting station 6×6 anchor in the Tinkering Room. Repositioned
 * 2026-07-04 per direction ("move it...so it's horizontally
 * centered"). Room is cols 52-63 (12 wide), rows 36-46 (11 tall).
 * Shifted +1 column again on 2026-07-05 (col55 -> col56) to open a
 * 1-column gap for the Sawmill, grown to 3×3 and moved to sit directly
 * beside Gemcutting that same day (see SAWMILL_POSITION) - the two
 * stations now occupy cols 52-61 as a paired group (3+1 gap+6),
 * leaving 2 cols margin on the room's east edge (was 3/3 symmetric
 * before the Sawmill moved in; not exactly centered anymore now that
 * there are two structures to fit, but reads as one coherent group
 * rather than the previous isolated-in-a-corner layout).
 */
export const GEMCUTTING_POSITION: Position = { col: 56, row: 38 };

/**
 * Charcoal Kiln in the Garden Room. Grown 2×2 -> 3×3 (2026-07-04, per
 * direction: "the kiln should be bigger than the tree resource node")
 * - now bigger than the root tangle (also resized down to 2×2 the same
 * day). Moved +5 columns (2026-07-04, direction: "the kiln is blocking
 * the path" + "align vertically with the...planters") from col9 to
 * col14 - lands exactly above the col-14 planter column (slots 2/5),
 * forming a clean north-south line (kiln, gap row 38, planter, gap
 * row 42, planter) instead of sitting in the room's main walking lane.
 */
export const KILN_POSITION: Position = { col: 14, row: 35 }; // 3×3: cols 14-16, rows 35-37

/**
 * Sawmill — Tinkering Room, grown 2×2 -> 3×3 (2026-07-05, direct
 * feedback: "It should be a 3x3 sprite, and that room is really
 * weird"). Repositioned to sit directly beside Gemcutting (1-col gap
 * at col55) instead of isolated in the room's far corner, which read
 * as disconnected/weird - matches the established "paired stations
 * with a walkable gap" convention used elsewhere (Kiln beside the
 * wood root). Gemcutting shifted +1 column to make room (see
 * GEMCUTTING_POSITION).
 */
export const SAWMILL_POSITION: Position = { col: 52, row: 38 };

/**
 * Narag-Bund's resting spot once befriended. Grown 1×1 -> 4×4 and
 * moved north-and-east of the Hearth (2026-07-05, direct feedback +
 * new high-res sprite). Verified against the Central Hall's circular
 * floor (radius 9 around MAP_CENTER, see hubContent.ts's fill loop)
 * - all four corners of this 4×4 footprint fall within the circle,
 * and it stays clear of both the Hearth's own 6×6 footprint (ends at
 * col42) and the NE corridor (starts at col49).
 */
export const COMPANION_POSITION: Position = { col: 43, row: 19 };

/** The Mountain Console — ancient stone terminal in the northwest quadrant of the central hall. */
// Grown 2×2 -> 3×3 (2026-07-04). Shifted one column left (was col 35)
// to keep clear of the Hearth's 6×6 footprint, which starts at col 37
// (see HEARTH_FOOTPRINT above) - the old 2×2 console had exactly one
// column of clearance from it (ending at col 36); growing in place
// would have eaten that clearance and overlapped col 37.
export const CONSOLE_POSITION: Position = { col: 34, row: 22 };

/**
 * Stockpile chest — the ore storage anchor in the east wing once
 * the stockpile_room is cleared. Moved +4 columns (2026-07-04, direct
 * instruction) - was flush with the room's west edge (col52, zero
 * margin), now sits with 4 cols margin left, 2 right in the 12-wide
 * room (cols 52-63). 6×7 footprint: fills rows 21-27, cols 56-61.
 */
export const STOCKPILE_CHEST_POSITION: Position = { col: 56, row: 21 };

/**
 * Trade Post — the merchant's stall/structure in the Trade Hall
 * (sealed_south: cols 35-45, rows 38-45). Added 2026-07-05 - the
 * trade_post sprite and its full palette/tileset registration
 * (SOLID_CELL_KINDS, colors, glyph) already existed, but NOTHING ever
 * actually placed it on the map. The room was fully functional (the
 * merchant panel works from anywhere in the room, gated on
 * tradeHallStage alone) but visually empty once cleared - reported
 * directly: "I already unlocked it [and] its empty." 5×5, centered in
 * the 11×8 room (1 col margin left/right isn't possible with odd
 * leftover space - 3 left/3 right; 1 row margin top, 2 bottom).
 */
export const TRADE_POST_POSITION: Position = { col: 38, row: 39 };

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
  // Garden Room — root tangle on the west wall. Shrunk 3×3 -> 2×2
  // (2026-07-04, per direction: the Kiln should be the bigger of the
  // two, not the raw resource node it processes).
  {
    id: "garden_roots",
    woodNodeId: "root_tangle",
    position: { col: 6, row: 35 },  // 2×2: cols 6-7, rows 35-36 (against north wall)
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
  // Shifted down 1 row (2026-07-04, direction: "the kiln is blocking
  // the path" at the old layout) - rows 38/42 -> 39/43. Columns
  // unchanged. Still fits the room (bounds rows 35-45): bottom row now
  // occupies 43-45, flush with the room's own south edge.
  { col: 6,  row: 39 }, // slot 0 — north-west (rows 39-41), always unlocked
  { col: 10, row: 39 }, // slot 1 — north-centre (rows 39-41)
  { col: 14, row: 39 }, // slot 2 — north-east (rows 39-41)
  { col: 6,  row: 43 }, // slot 3 — south-west (rows 43-45, in corridor zone)
  { col: 10, row: 43 }, // slot 4 — south-centre (rows 43-45)
  { col: 14, row: 43 }, // slot 5 — south-east (rows 43-45)
];
