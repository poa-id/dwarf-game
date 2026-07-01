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
  COMPANION_POSITION,
  CONSOLE_POSITION,
  STOCKPILE_CHEST_POSITION,
} from "../engine/hubMap";
import { ROCK_NODES, isExhausted as isOreExhausted, createFreshDepletionState } from "../engine/mining";
import { WOOD_NODES, isExhausted as isWoodExhausted } from "../engine/woodcraft";
import type { LitTorchSet, WorldState } from "../engine/types";

/**
 * Builds the Hub's static terrain. Called once, result cached.
 *
 * Layout: octagonal star. Central hall is a circle (r=9) carved
 * cell-by-cell. Eight L-shaped corridors (3 tiles wide each) radiate
 * outward to four active rooms and four sealed rubble stubs.
 *
 * Sealed passages are NOT carved as full rooms — the corridor simply
 * ends at a rubble wall face. This prevents the "walkable perimeter
 * around the rubble" bug where the player could circumnavigate the
 * locked area by walking around the room's floor border.
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

  // ── 1. Central Hall: circle r=9 ─────────────────────────────────────
  const { col: CX, row: CY } = MAP_CENTER;
  const HALL_R = 9;
  for (let r = CY - HALL_R; r <= CY + HALL_R; r++) {
    for (let c = CX - HALL_R; c <= CX + HALL_R; c++) {
      if (Math.sqrt((c - CX) ** 2 + (r - CY) ** 2) <= HALL_R) {
        set(c, r, "rock_floor");
      }
    }
  }

  // ── 2. Active rooms ──────────────────────────────────────────────────
  fill(52, 9,  63, 19, "rock_floor"); // NE: Forge Room
  fill( 6, 20, 18, 30, "rock_floor"); // W:  Mine Room
  fill( 6, 35, 18, 45, "rock_floor"); // SW: Garden Room
  fill(52, 36, 63, 46, "rock_floor"); // SE: Tinkering Room

  // ── 3. L-shaped corridors, exactly 3 tiles wide ──────────────────────
  //
  // Each corridor exits where the hall circle naturally ends at that
  // row/col band. Verified flush via circle edge analysis:
  //   Right edge rows 21-29 = col 48 → exit starts col 49
  //   Left edge rows 21-29  = col 32 → exit starts col 31 (leftward)
  //   Top edge cols 39-41   = row 17 → exit starts row 16 (upward)
  //   Bottom edge cols 39-41= row 33 → exit starts row 34 (downward)

  // N stub (to sealed rubble face)
  fill(39, 5, 41, 17, "rock_floor");

  // NE: vert leg cols 49-51, rows 9-22; horiz leg rows 9-11 rightward
  fill(49,  9, 51, 22, "rock_floor"); // NE vert
  fill(49,  9, 63, 11, "rock_floor"); // NE horiz (enters Forge Room top)

  // E stub (to sealed rubble face)
  fill(49, 23, 63, 25, "rock_floor");

  // SE: vert leg cols 49-51, rows 27-37; horiz leg rows 35-37 rightward
  fill(49, 27, 51, 37, "rock_floor"); // SE vert
  fill(49, 35, 63, 37, "rock_floor"); // SE horiz (enters Tinkering Room top)

  // S stub (to sealed rubble face)
  fill(39, 33, 41, 45, "rock_floor");

  // SW: vert leg cols 29-31, rows 27-44; horiz leg rows 42-44 leftward
  fill(29, 27, 31, 44, "rock_floor"); // SW vert
  fill( 6, 42, 31, 44, "rock_floor"); // SW horiz (enters Garden Room bottom)

  // W: straight left, rows 23-25
  fill( 6, 23, 31, 25, "rock_floor");

  // NW stub: vert cols 29-31, rows 9-22; horiz rows 9-11 leftward
  fill(29,  9, 31, 22, "rock_floor"); // NW vert
  fill( 6,  9, 31, 11, "rock_floor"); // NW horiz

  // ── 4. Sealed rubble faces at corridor ends ──────────────────────────
  // These are solid rubble walls that terminate each sealed corridor.
  // The corridor leads up to them and stops — no floor room beyond.
  fill(35,  5, 45,  8, "rubble"); // N  face (4 rows of rubble)
  fill(53, 23, 63, 25, "rubble"); // E  face (right end of E stub)
  fill(35, 42, 45, 45, "rubble"); // S  face (bottom of S stub)
  fill( 6,  9, 18, 11, "rubble"); // NW face (left end of NW horiz)

  // ── 5. Hearth 4×4 ────────────────────────────────────────────────────
  const { originCol: hc, originRow: hr } = HEARTH_FOOTPRINT;
  for (let dr = 0; dr < 4; dr++)
    for (let dc = 0; dc < 4; dc++)
      set(hc + dc, hr + dr, "hearth");

  // ── 6. Forge 4×4 (forge_broken until repaired) ───────────────────────
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

  // ── 12. Mountain Console ──────────────────────────────────────────────
  // Always present as a static cell — the console was always here.
  // The dwarf just needs to find and awaken it.
  set(CONSOLE_POSITION.col, CONSOLE_POSITION.row, "mountain_console");

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
  gemcuttingBuilt: boolean = false,
  companionBefriended: boolean = false,
  _consoleAwakened: boolean = false,
  stockpileRoomStage: string = "ruined"
): GridCell {
  if (col < 0 || col >= HUB_WIDTH || row < 0 || row >= HUB_HEIGHT) {
    return { kind: "void" };
  }

  const staticCell = getHubGrid()[row * HUB_WIDTH + col];

  if (staticCell.kind === "torch_broken") {
    const torch = LIGHT_SOURCES.find(
      (t) => t.position.col === col && t.position.row === row
    );
    if (torch && litTorches[torch.id]) return { kind: "torch_lit" };
  }

  if (staticCell.kind === "forge_broken" && forgeTier >= 1) {
    return { kind: "forge" };
  }

  if (
    smelterBuilt &&
    col >= SMELTER_POSITION.col &&
    col < SMELTER_POSITION.col + 2 &&
    row >= SMELTER_POSITION.row &&
    row < SMELTER_POSITION.row + 2
  ) {
    return { kind: "smelter" };
  }

  if (staticCell.kind === "gemcutting_unbuilt" && gemcuttingBuilt) {
    return { kind: "gemcutting" };
  }

  // Narag-Bund appears at his resting spot once befriended.
  // Walkable — the player can share the cell with him.
  if (companionBefriended && col === COMPANION_POSITION.col && row === COMPANION_POSITION.row) {
    return { kind: "companion" };
  }

  // Stockpile room — east wing (cols 52-63, rows 20-30).
  // When cleared+, rubble dissolves and the room opens.
  const inEastRoom = col >= 52 && col <= 63 && row >= 20 && row <= 30;
  const stockpileCleared =
    stockpileRoomStage === "cleared" ||
    stockpileRoomStage === "restored" ||
    stockpileRoomStage === "masterwork";

  if (inEastRoom && stockpileCleared) {
    if (col === STOCKPILE_CHEST_POSITION.col && row === STOCKPILE_CHEST_POSITION.row) {
      return { kind: "stockpile_chest" };
    }
    const staticCell = getHubGrid()[row * HUB_WIDTH + col];
    if (staticCell.kind === "rubble" || staticCell.kind === "rock_wall") {
      return { kind: "rock_floor" };
    }
    return staticCell;
  }

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
