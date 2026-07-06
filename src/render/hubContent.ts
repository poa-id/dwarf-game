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
  SAWMILL_POSITION,
  FORGE_BUILDING_FOOTPRINT,
  HEARTH_FOOTPRINT,
  GEMCUTTING_POSITION,
  TRADE_POST_POSITION,
  MAP_CENTER,
  COMPANION_POSITION,
  CONSOLE_POSITION,
  STOCKPILE_CHEST_POSITION,
  MINE_SHAFT_POSITION,
  PLANTER_POSITIONS,
} from "../engine/hubMap";
import { ROCK_NODES, isExhausted as isOreExhausted, createFreshDepletionState } from "../engine/mining";
import { WOOD_NODES, isExhausted as isWoodExhausted } from "../engine/woodcraft";
import { growthStageCellKind, plantDefById, type PlanterSlot } from "../engine/garden";
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

  // ── 5. Hearth 6×6 — the heart of the mountain ────────────────────────
  const { originCol: hc, originRow: hr } = HEARTH_FOOTPRINT;
  for (let dr = 0; dr < 6; dr++)
    for (let dc = 0; dc < 6; dc++)
      set(hc + dc, hr + dr, "hearth");

  // ── 6. Forge (forge_broken until repaired) - reads its own width/height
  // from FORGE_BUILDING_FOOTPRINT rather than hardcoding 6, unlike before
  // (2026-07-04) - grown to 7x7 needed this to actually take effect here,
  // not just in the footprint constant itself.
  const { originCol: fc, originRow: fr, width: fw, height: fh } = FORGE_BUILDING_FOOTPRINT;
  for (let dr = 0; dr < fh; dr++)
    for (let dc = 0; dc < fw; dc++)
      set(fc + dc, fr + dr, "forge_broken");

  // Corridor torches removed — they blocked navigation.
  // Players place their own torches with the T key (wall-mounted only).

  // ── 8. Ore veins — 3×3 footprints against the west wall ────────────────
  const VEIN_KIND: Record<string, CellKind> = {
    copper_vein: "ore_copper",
    iron_vein:   "ore_iron",
    coal_seam:   "ore_coal",
    deepstone:   "ore_deep",
  };
  for (const vein of ORE_VEINS) {
    const kind = VEIN_KIND[vein.rockNodeId] ?? "ore_copper";
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        set(vein.position.col + dc, vein.position.row + dr, kind);
  }

  // ── 9. Wood nodes — 2×2 footprint (shrunk from 3×3, 2026-07-04) ────────
  for (const wood of WOOD_NODE_PLACEMENTS) {
    for (let dr = 0; dr < 2; dr++)
      for (let dc = 0; dc < 2; dc++)
        set(wood.position.col + dc, wood.position.row + dr, "wood_node");
  }

  // ── 10. Kiln 3×3 (grown from 2×2, 2026-07-04) ──────────────────────────
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++)
      set(KILN_POSITION.col + dc, KILN_POSITION.row + dr, "kiln");

  // ── 10b. Garden planters — 6 slots in 3×2 grid (from hubMap PLANTER_POSITIONS)
  // Row 1: rows 38-40 (3 planters). Gap: row 41. Row 2: rows 42-44 (3 planters, = corridor zone).
  // Gap cols 9 and 13 allow corridor passage through the second row.
  for (const p of PLANTER_POSITIONS) {
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        set(p.col + dc, p.row + dr, "planter_broken");
  }

  // ── 11. Gemcutting station 6×6 (unbuilt) ────────────────────────────
  for (let dr = 0; dr < 6; dr++)
    for (let dc = 0; dc < 6; dc++)
      set(GEMCUTTING_POSITION.col + dc, GEMCUTTING_POSITION.row + dr, "gemcutting_unbuilt");

  // ── 12. Mountain Console — 3×3 (grown from 2×2, 2026-07-04) ────────────
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++)
      set(CONSOLE_POSITION.col + dc, CONSOLE_POSITION.row + dr, "mountain_console");

  // ── 13. Mine shaft — 3×3, partially into north wall ────────────────────
  // Anchor at row 17 — shaft body rows 17-19 in the wall, mouth at row 20.
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++)
      set(MINE_SHAFT_POSITION.col + dc, MINE_SHAFT_POSITION.row + dr, "mineshaft_broken");

  // ── 14. Void beyond the wall border (2026-07-04) ───────────────────────
  // The grid defaults every cell to rock_wall, and only carved
  // rooms/corridors get anything else - meaning ALL that uncarved rock,
  // however far light or memory reaches, was rendering as an endless
  // field of wall texture rather than "one wall, then pitch black."
  // Reported directly: "I just want what's inside the walls and not in
  // a corridor or room to be pitch black, and only one layer of walls
  // to be visible." Fix: any rock_wall cell with NO carved (non-wall,
  // non-void) neighbor in any of the 8 surrounding cells is interior
  // rock no one should ever see the texture of - convert it to void
  // (which the renderers already skip entirely, rendering as pure
  // black). Cells that ARE adjacent to a carved space stay rock_wall,
  // giving exactly the single visible border layer asked for. Run as
  // a post-process over the whole finished grid rather than tracked
  // during carving, since many rooms/corridors carve independently and
  // a wall cell's adjacency to ANY of them can't be known until
  // everything above has already run.
  const original = grid.slice();
  for (let row = 0; row < HUB_HEIGHT; row++) {
    for (let col = 0; col < HUB_WIDTH; col++) {
      const idx = row * HUB_WIDTH + col;
      if (original[idx].kind !== "rock_wall") continue;
      let hasCarvedNeighbor = false;
      for (let dr = -1; dr <= 1 && !hasCarvedNeighbor; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nc = col + dc, nr = row + dr;
          if (nc < 0 || nc >= HUB_WIDTH || nr < 0 || nr >= HUB_HEIGHT) continue;
          const neighborKind = original[nr * HUB_WIDTH + nc].kind;
          if (neighborKind !== "rock_wall") { hasCarvedNeighbor = true; break; }
        }
      }
      if (!hasCarvedNeighbor) grid[idx] = { kind: "void" };
    }
  }

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
  stockpileRoomStage: string = "ruined",
  tradeHallStage: string = "ruined",
  deepFoundryStage: string = "ruined",
  archiveStage: string = "ruined",
  drillTiers: Record<string, number> = {},
  placedTorches: Record<string, boolean> = {},
  mineshaftDepth: number = 0,
  gardenSlots: PlanterSlot[] = [],
  sawmillBuilt: boolean = false
): GridCell {
  if (col < 0 || col >= HUB_WIDTH || row < 0 || row >= HUB_HEIGHT) {
    return { kind: "void" };
  }

  // Placed torches — player-mounted on wall cells. Override the wall with a torch sprite.
  const torchKey = `${col},${row}`;
  if (placedTorches[torchKey] !== undefined) {
    return { kind: placedTorches[torchKey] ? "torch_lit" : "torch_broken" };
  }

  // Garden planters — each 3×3 slot shows its growth stage dynamically
  for (let i = 0; i < PLANTER_POSITIONS.length; i++) {
    const p = PLANTER_POSITIONS[i];
    if (col >= p.col && col <= p.col + 2 && row >= p.row && row <= p.row + 2) {
      const slot = gardenSlots[i];
      if (!slot || !slot.unlocked) return { kind: "planter_broken" };
      if (!slot.plantId) return { kind: "planter_empty" };
      const def = plantDefById(slot.plantId);
      const kind = growthStageCellKind(slot.stage, def?.category ?? "shroom", def?.matureCellKind);
      return { kind: kind as import("./palette").CellKind };
    }
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
    col < SMELTER_POSITION.col + 3 &&
    row >= SMELTER_POSITION.row &&
    row < SMELTER_POSITION.row + 3
  ) {
    return { kind: "smelter" };
  }

  if (staticCell.kind === "gemcutting_unbuilt" && gemcuttingBuilt) {
    return { kind: "gemcutting" };
  }

  if (
    sawmillBuilt &&
    col >= SAWMILL_POSITION.col &&
    col < SAWMILL_POSITION.col + 3 &&
    row >= SAWMILL_POSITION.row &&
    row < SAWMILL_POSITION.row + 3
  ) {
    return { kind: "sawmill" };
  }

  // Mine shaft — 3×3, partially in the north wall
  const inShaft = col >= MINE_SHAFT_POSITION.col && col <= MINE_SHAFT_POSITION.col + 2 &&
                  row >= MINE_SHAFT_POSITION.row && row <= MINE_SHAFT_POSITION.row + 2;
  if (inShaft) {
    return { kind: mineshaftDepth >= 1 ? "mineshaft_lit" : "mineshaft_broken" };
  }

  // Narag-Bund appears at his resting spot once befriended.
  // Walkable — the player can share the cell with him.
  if (
    companionBefriended &&
    col >= COMPANION_POSITION.col && col < COMPANION_POSITION.col + 4 &&
    row >= COMPANION_POSITION.row && row < COMPANION_POSITION.row + 4
  ) {
    return { kind: "companion" };
  }

  // Stockpile room — east wing + corridor junction (cols 49-63, rows 21-30).
  // Row 20 stays as rock_wall (forge/stockpile separator).
  // Extended to col 49 to clear corridor junction cells that would otherwise
  // appear as orphan wall tiles when the room opens.
  const inEastRoom = col >= 49 && col <= 63 && row >= 21 && row <= 30;
  const stockpileCleared =
    stockpileRoomStage === "cleared" ||
    stockpileRoomStage === "restored" ||
    stockpileRoomStage === "masterwork";

  if (inEastRoom && stockpileCleared) {
    if (col >= STOCKPILE_CHEST_POSITION.col && col <= STOCKPILE_CHEST_POSITION.col + 5 &&
        row >= STOCKPILE_CHEST_POSITION.row && row <= STOCKPILE_CHEST_POSITION.row + 6) {
      return { kind: "stockpile_chest" };
    }
    const staticCell = getHubGrid()[row * HUB_WIDTH + col];
    if (staticCell.kind === "rubble" || staticCell.kind === "rock_wall") {
      return { kind: "rock_floor" };
    }
    return staticCell;
  }

  // Trade Hall (sealed_south: cols 35-45, rows 38-45) — rubble clears when trade_hall cleared+
  const isOpen = (stage: string) => stage === "cleared" || stage === "restored" || stage === "masterwork";
  const inSouthRoom = col >= 35 && col <= 45 && row >= 38 && row <= 45;
  if (inSouthRoom && isOpen(tradeHallStage)) {
    if (
      col >= TRADE_POST_POSITION.col && col < TRADE_POST_POSITION.col + 5 &&
      row >= TRADE_POST_POSITION.row && row < TRADE_POST_POSITION.row + 5
    ) {
      return { kind: "trade_post" };
    }
    const staticCell = getHubGrid()[row * HUB_WIDTH + col];
    if (staticCell.kind === "rubble") return { kind: "rock_floor" };
    return staticCell;
  }

  // Deep Foundry (sealed_northwest: cols 6-18, rows 9-19) — rubble clears when deep_foundry cleared+
  const inNwRoom = col >= 6 && col <= 18 && row >= 9 && row <= 19;
  if (inNwRoom && isOpen(deepFoundryStage)) {
    const staticCell = getHubGrid()[row * HUB_WIDTH + col];
    if (staticCell.kind === "rubble") return { kind: "rock_floor" };
    return staticCell;
  }

  // Archive (sealed_north: cols 35-45, rows 5-12) — rubble clears when archive cleared+
  const inNorthRoom = col >= 35 && col <= 45 && row >= 5 && row <= 12;
  if (inNorthRoom && isOpen(archiveStage)) {
    const staticCell = getHubGrid()[row * HUB_WIDTH + col];
    if (staticCell.kind === "rubble") return { kind: "rock_floor" };
    return staticCell;
  }

  const vein = ORE_VEINS.find(
    (v) => col >= v.position.col && col <= v.position.col + 2 &&
            row >= v.position.row && row <= v.position.row + 2
  );
  if (vein) {
    const rockNode = ROCK_NODES.find((n) => n.id === vein.rockNodeId);
    const depletion = veinDepletion[vein.id] ?? createFreshDepletionState();
    if (rockNode && isOreExhausted(rockNode, depletion)) {
      return { kind: "ore_exhausted" };
    }
    // Show drill sprite on top of the vein once a drill is built there
    const drillTier = drillTiers[vein.id] ?? 0;
    if (drillTier > 0) {
      // Bug fixed 2026-07-05 (reported directly: "the coal drill
      // upgrade is placing the copper drill sprite") - this chain had
      // explicit checks for iron_vein and deepstone but silently fell
      // through to drill_copper for coal_seam, despite drill_coal
      // being a fully registered, distinct CellKind with its own
      // sprite (see tilesetManifest.ts) that was just never reached.
      const drillKind = vein.rockNodeId === "iron_vein" ? "drill_iron"
        : vein.rockNodeId === "deepstone" ? "drill_deep"
        : vein.rockNodeId === "coal_seam" ? "drill_coal"
        : "drill_copper";
      return { kind: drillKind as import("./palette").CellKind };
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
