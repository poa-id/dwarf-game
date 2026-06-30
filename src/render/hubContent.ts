import type { GridCell } from "./GridRenderer";
import type { CellKind } from "./palette";
import {
  HUB_WIDTH,
  HUB_HEIGHT,
  LIGHT_SOURCES,
  ORE_VEINS,
  WOOD_NODE_PLACEMENTS,
  KILN_POSITION,
  SMELTER_POSITION,
  GEMCUTTING_POSITION,
  FORGE_BUILDING_FOOTPRINT,
  HEARTH_FOOTPRINT,
  MAP_CENTER,
} from "../engine/hubMap";
import { ROCK_NODES, isExhausted as isOreExhausted, createFreshDepletionState } from "../engine/mining";
import { WOOD_NODES, isExhausted as isWoodExhausted } from "../engine/woodcraft";
import type { LitTorchSet, WorldState } from "../engine/types";

/**
 * Builds the Hub's static terrain content once and caches it.
 *
 * Redesigned 2026-06-30: octagonal star layout with circular central
 * hall (r=9, carved cell-by-cell), 8 rooms, and L-shaped corridors.
 * Sealed passages are carved as rooms but filled with rubble — the
 * player can see a corridor ending in collapsed stone, hinting at
 * future content.
 */
function buildHubContent(): GridCell[] {
  const grid: GridCell[] = Array.from(
    { length: HUB_WIDTH * HUB_HEIGHT },
    () => ({ kind: "rock_wall" as CellKind })
  );

  const set = (col: number, row: number, kind: CellKind) => {
    if (col < 0 || col >= HUB_WIDTH || row < 0 || row >= HUB_HEIGHT) return;
    grid[row * HUB_WIDTH + col] = { kind };
  };

  const fill = (c0: number, r0: number, c1: number, r1: number, kind: CellKind) => {
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        set(c, r, kind);
  };

  // ── 1. Central Hall: circular approximation r=9 ─────────────────────
  const { col: CX, row: CY } = MAP_CENTER;
  const HALL_R = 9;
  for (let r = CY - HALL_R; r <= CY + HALL_R; r++) {
    for (let c = CX - HALL_R; c <= CX + HALL_R; c++) {
      if (Math.sqrt((c - CX) ** 2 + (r - CY) ** 2) <= HALL_R) {
        set(c, r, "rock_floor");
      }
    }
  }

  // ── 2. Rooms (rectangular, carved as floor) ──────────────────────────
  // Active rooms
  fill(52, 9,  63, 19, "rock_floor"); // NE: Forge Room
  fill( 6, 20, 18, 30, "rock_floor"); // W:  Mine Room
  fill( 6, 35, 18, 45, "rock_floor"); // SW: Garden Room
  fill(52, 36, 63, 46, "rock_floor"); // SE: Tinkering Room
  // Sealed rooms (carved floor so the L-corridor has something to connect to,
  // but the room interior is overwritten with rubble below)
  fill(35,  5, 45, 12, "rock_floor"); // N:  sealed
  fill(52, 20, 63, 30, "rock_floor"); // E:  sealed
  fill(35, 38, 45, 45, "rock_floor"); // S:  sealed
  fill( 6,  9, 18, 19, "rock_floor"); // NW: sealed

  // ── 3. L-shaped corridors (3 tiles wide) ─────────────────────────────
  // Each L = one horizontal leg + one vertical leg, 3 tiles wide.
  // Width-3 means the "main" tile plus one tile on each side.

  // N: straight up
  fill(38, 13, 40, 16, "rock_floor");

  // NE: vertical leg up from hall, then horizontal leg right to room
  fill(48, 17, 50, 24, "rock_floor"); // vert
  fill(48, 17, 52, 19, "rock_floor"); // horiz

  // E: straight right (to sealed_east)
  fill(50, 23, 53, 25, "rock_floor");

  // SE: vertical leg down from hall, then horizontal leg right to room
  fill(48, 26, 50, 35, "rock_floor"); // vert
  fill(48, 33, 52, 35, "rock_floor"); // horiz

  // S: straight down
  fill(38, 34, 40, 37, "rock_floor");

  // SW: vertical leg down from hall, then horizontal leg left to room
  fill(30, 26, 32, 35, "rock_floor"); // vert
  fill(19, 33, 32, 35, "rock_floor"); // horiz

  // W: straight left
  fill(19, 23, 31, 25, "rock_floor");

  // NW: vertical leg up from hall, then horizontal leg left to room
  fill(30, 17, 32, 24, "rock_floor"); // vert
  fill(19, 17, 32, 19, "rock_floor"); // horiz

  // ── 4. Sealed rooms: fill interior with rubble ───────────────────────
  // Leave a 1-tile border of floor so the room has "walls", but
  // the interior is rubble — visually implies a collapsed passage.
  fill(36,  6, 44, 11, "rubble"); // N
  fill(53, 21, 62, 29, "rubble"); // E
  fill(36, 39, 44, 44, "rubble"); // S
  fill( 7, 10, 17, 18, "rubble"); // NW

  // ── 5. Hearth 4×4 (all 16 cells solid) ──────────────────────────────
  const { originCol: hc, originRow: hr } = HEARTH_FOOTPRINT;
  for (let dr = 0; dr < 4; dr++)
    for (let dc = 0; dc < 4; dc++)
      set(hc + dc, hr + dr, "hearth");

  // ── 6. Forge 4×4 (all 16 cells, overridden to 'forge' once repaired)─
  const { originCol: fc, originRow: fr } = FORGE_BUILDING_FOOTPRINT;
  for (let dr = 0; dr < 4; dr++)
    for (let dc = 0; dc < 4; dc++)
      set(fc + dc, fr + dr, "forge_broken");

  // ── 7. Torches ───────────────────────────────────────────────────────
  for (const torch of LIGHT_SOURCES) {
    set(torch.position.col, torch.position.row, "torch_broken");
  }

  // ── 8. Ore veins ─────────────────────────────────────────────────────
  const VEIN_KIND: Record<string, CellKind> = {
    copper_vein: "ore_copper",
    iron_vein:   "ore_iron",
    coal_seam:   "ore_coal",
    deepstone:   "ore_deep",
  };
  for (const vein of ORE_VEINS) {
    set(vein.position.col, vein.position.row, VEIN_KIND[vein.rockNodeId] ?? "ore_copper");
  }

  // ── 9. Wood nodes ────────────────────────────────────────────────────
  for (const wood of WOOD_NODE_PLACEMENTS) {
    set(wood.position.col, wood.position.row, "wood_node");
  }

  // ── 10. Kiln ─────────────────────────────────────────────────────────
  set(KILN_POSITION.col, KILN_POSITION.row, "kiln");

  // ── 11. Gemcutting unbuilt marker ────────────────────────────────────
  set(GEMCUTTING_POSITION.col, GEMCUTTING_POSITION.row, "gemcutting_unbuilt");

  return grid;
}

let cachedHubGrid: GridCell[] | null = null;

export function getHubGrid(): GridCell[] {
  if (!cachedHubGrid) cachedHubGrid = buildHubContent();
  return cachedHubGrid;
}

export function hubCellAt(
  col: number,
  row: number,
  litTorches: LitTorchSet = {},
  veinDepletion: WorldState["veinDepletion"] = {},
  woodDepletion: WorldState["veinDepletion"] = {},
  forgeTier: number = 0,
  smelterBuilt: boolean = false,
  gemcuttingBuilt: boolean = false
): GridCell {
  if (col < 0 || col >= HUB_WIDTH || row < 0 || row >= HUB_HEIGHT) {
    return { kind: "void" };
  }

  const staticCell = getHubGrid()[row * HUB_WIDTH + col];

  // Torch: broken → lit if WorldState says so
  if (staticCell.kind === "torch_broken") {
    const torch = LIGHT_SOURCES.find(
      (t) => t.position.col === col && t.position.row === row
    );
    if (torch && litTorches[torch.id]) return { kind: "torch_lit" };
  }

  // Forge: broken → repaired once forgeTier >= 1
  if (staticCell.kind === "forge_broken" && forgeTier >= 1) {
    return { kind: "forge" };
  }

  // Smelter: 2×2 footprint, dynamic once built
  if (
    smelterBuilt &&
    col >= SMELTER_POSITION.col &&
    col < SMELTER_POSITION.col + 2 &&
    row >= SMELTER_POSITION.row &&
    row < SMELTER_POSITION.row + 2
  ) {
    return { kind: "smelter" };
  }

  // Gemcutting: unbuilt marker → active once built
  if (staticCell.kind === "gemcutting_unbuilt" && gemcuttingBuilt) {
    return { kind: "gemcutting" };
  }

  // Ore depletion
  const vein = ORE_VEINS.find(
    (v) => v.position.col === col && v.position.row === row
  );
  if (vein) {
    const rockNode = ROCK_NODES.find((n) => n.id === vein.rockNodeId);
    const depletion = veinDepletion[vein.id] ?? createFreshDepletionState();
    if (rockNode && isOreExhausted(rockNode, depletion)) {
      return { kind: "ore_exhausted" };
    }
  }

  // Wood depletion
  const woodPlacement = WOOD_NODE_PLACEMENTS.find(
    (w) => w.position.col === col && w.position.row === row
  );
  if (woodPlacement) {
    const woodNode = WOOD_NODES.find((n) => n.id === woodPlacement.woodNodeId);
    const depletion = woodDepletion[woodPlacement.id] ?? createFreshDepletionState();
    if (woodNode && isWoodExhausted(woodNode, depletion)) {
      return { kind: "wood_exhausted" };
    }
  }

  return staticCell;
}
