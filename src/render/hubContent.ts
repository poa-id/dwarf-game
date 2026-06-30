import { createEmptyGrid, type GridCell } from "./GridRenderer";
import { stampSprite } from "./sprites";
import { FORGE_BUILDING } from "./exampleSprites";
import type { CellKind } from "./palette";
import {
  HUB_WIDTH,
  HUB_HEIGHT,
  ZONES,
  LIGHT_SOURCES,
  ORE_VEINS,
  WOOD_NODE_PLACEMENTS,
  KILN_POSITION,
  SMELTER_POSITION,
  GEMCUTTING_POSITION,
  FORGE_BUILDING_FOOTPRINT,
} from "../engine/hubMap";
import { ROCK_NODES, isExhausted as isOreExhausted, createFreshDepletionState } from "../engine/mining";
import { WOOD_NODES, isExhausted as isWoodExhausted } from "../engine/woodcraft";
import type { LitTorchSet, WorldState } from "../engine/types";

/**
 * Builds the Hub's static terrain content ONCE - this is hand-designed
 * level content, not generated per-playthrough. The result is cached
 * (see getHubGrid below) since it never changes; only its VISIBILITY
 * (computed separately, per-frame, from game state) changes over time.
 *
 * Carves out open floor inside each zone's bounds, leaves everything
 * else as wall, and connects zones with simple straight corridors so
 * movement between unlocked areas is always possible once both ends
 * are reachable.
 *
 * Torch positions are baked into this static grid as "torch_broken" -
 * that's their permanent terrain identity. Whether a given torch
 * currently reads as broken or lit is a SEPARATE, dynamic question
 * (depends on WorldState.litTorches) answered by hubCellAt below, not
 * by this function - same split as zones (fixed bounds vs dynamic
 * unlock state).
 */
function buildHubContent(): GridCell[] {
  const grid = createEmptyGrid(HUB_WIDTH, HUB_HEIGHT).map(
    () => ({ kind: "rock_wall" }) as GridCell
  );

  const set = (col: number, row: number, kind: GridCell["kind"]) => {
    if (col < 0 || col >= HUB_WIDTH || row < 0 || row >= HUB_HEIGHT) return;
    grid[row * HUB_WIDTH + col] = { kind };
  };

  // Carve floor inside every zone's bounding box.
  for (const zone of ZONES) {
    const { col, row, width, height } = zone.bounds;
    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        set(c, r, "rock_floor");
      }
    }
  }

  // Simple straight-line corridors connecting each zone's center back to
  // the hearth hall's center - good enough for v1, a hand-authored map
  // could replace this with deliberate winding passages later.
  const hearthHall = ZONES.find((z) => z.id === "hearth_hall")!;
  const hearthCenter = {
    col: hearthHall.bounds.col + Math.floor(hearthHall.bounds.width / 2),
    row: hearthHall.bounds.row + Math.floor(hearthHall.bounds.height / 2),
  };

  for (const zone of ZONES) {
    if (zone.id === "hearth_hall") continue;
    const center = {
      col: zone.bounds.col + Math.floor(zone.bounds.width / 2),
      row: zone.bounds.row + Math.floor(zone.bounds.height / 2),
    };
    carveCorridor(set, hearthCenter, center);
  }

  // Drop the forge building sprite into the forge room, using the
  // shared footprint constant (see hubMap.ts's FORGE_BUILDING_FOOTPRINT)
  // rather than recomputing the origin here - this WAS a separate
  // local calculation until 2026-06-23, which is exactly how it drifted
  // out of sync with proximity.ts's own guess and caused the
  // "forge only accessible through the lower right corner" bug.
  const { originCol: forgeOriginCol, originRow: forgeOriginRow } = FORGE_BUILDING_FOOTPRINT;
  const stamped = stampSprite(grid, HUB_WIDTH, HUB_HEIGHT, FORGE_BUILDING, {
    col: forgeOriginCol,
    row: forgeOriginRow,
  });

  // Place the hearth at the top-left of its 4x4 footprint, so the sprite
  // renders centered in the hall. hearthCenter is the geometric center
  // (~col 40, row 25), so the 4x4 top-left anchor is 2 cells up and left.
  const hearthAnchorCol = hearthCenter.col - 2;
  const hearthAnchorRow = hearthCenter.row - 2;
  // Stamp ALL 16 cells of the 4x4 hearth footprint as solid "hearth" -
  // previously only the anchor cell was stamped, leaving the other 15
  // as walkable rock_floor. The player could walk through the sprite.
  for (let dr = 0; dr < 4; dr++) {
    for (let dc = 0; dc < 4; dc++) {
      const idx = (hearthAnchorRow + dr) * HUB_WIDTH + (hearthAnchorCol + dc);
      stamped[idx] = { kind: "hearth" };
    }
  }

  // All 16 cells of the 4x4 forge footprint become forge_broken.
  // Previously only the top-left anchor was stamped, same walkthrough bug.
  // hubCellAt overrides forge_broken -> forge at runtime once repaired.
  for (let dr = 0; dr < 4; dr++) {
    for (let dc = 0; dc < 4; dc++) {
      const idx = (forgeOriginRow + dr) * HUB_WIDTH + (forgeOriginCol + dc);
      stamped[idx] = { kind: "forge_broken" };
    }
  }

  // Place every torch's terrain marker - always "broken" in the static
  // content; hubCellAt overrides to "torch_lit" dynamically per the
  // current WorldState.
  for (const torch of LIGHT_SOURCES) {
    const idx = torch.position.row * HUB_WIDTH + torch.position.col;
    stamped[idx] = { kind: "torch_broken" };
  }

  // Place ore veins - mapped by rockNodeId to the correct CellKind,
  // not hardcoded to copper. Fixed 2026-06-23 once iron_vein/coal_seam
  // actually got real placements (see hubMap.ts's ORE_VEINS) - before
  // that, every vein silently rendered as ore_copper regardless of
  // what it actually contained, since copper was the only one placed.
  const VEIN_CELL_KIND_BY_ROCK_NODE_ID: Record<string, CellKind> = {
    copper_vein: "ore_copper",
    iron_vein: "ore_iron",
    coal_seam: "ore_coal",
    deepstone: "ore_deep",
  };
  for (const vein of ORE_VEINS) {
    const idx = vein.position.row * HUB_WIDTH + vein.position.col;
    stamped[idx] = { kind: VEIN_CELL_KIND_BY_ROCK_NODE_ID[vein.rockNodeId] ?? "ore_copper" };
  }

  // Place wood nodes.
  for (const woodPlacement of WOOD_NODE_PLACEMENTS) {
    const idx = woodPlacement.position.row * HUB_WIDTH + woodPlacement.position.col;
    stamped[idx] = { kind: "wood_node" };
  }

  // Place the Charcoal Kiln - one fixed cell, always "kiln" (no
  // broken/repaired state to track, unlike the forge - see kiln.ts).
  const kilnIdx = KILN_POSITION.row * HUB_WIDTH + KILN_POSITION.col;
  stamped[kilnIdx] = { kind: "kiln" };

  // Place the Gemcutting station's UNBUILT marker - always visible in
  // the static grid as a "something can be built here" cue, mirroring
  // forge_broken's role for the Forge. The dynamic hubCellAt() override
  // (below) replaces this with { kind: "gemcutting" } once built.
  // Added 2026-06-23 fixing a real reported gap: without this, the
  // buildable spot was indistinguishable plain floor until the player
  // stumbled onto it by accident.
  const gemcuttingIdx = GEMCUTTING_POSITION.row * HUB_WIDTH + GEMCUTTING_POSITION.col;
  stamped[gemcuttingIdx] = { kind: "gemcutting_unbuilt" };

  return stamped;
}

function carveCorridor(
  set: (col: number, row: number, kind: GridCell["kind"]) => void,
  from: { col: number; row: number },
  to: { col: number; row: number }
): void {
  // L-shaped corridor: horizontal then vertical. Simple, readable,
  // good enough until we want hand-placed or winding paths.
  const startCol = Math.min(from.col, to.col);
  const endCol = Math.max(from.col, to.col);
  for (let c = startCol; c <= endCol; c++) {
    set(c, from.row, "rock_floor");
  }
  const startRow = Math.min(from.row, to.row);
  const endRow = Math.max(from.row, to.row);
  for (let r = startRow; r <= endRow; r++) {
    set(to.col, r, "rock_floor");
  }
}

let cachedHubGrid: GridCell[] | null = null;

/** The Hub's static content, built once and cached - this never changes during play. */
export function getHubGrid(): GridCell[] {
  if (!cachedHubGrid) {
    cachedHubGrid = buildHubContent();
  }
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

  if (staticCell.kind === "torch_broken") {
    const torch = LIGHT_SOURCES.find((t) => t.position.col === col && t.position.row === row);
    if (torch && litTorches[torch.id]) {
      return { kind: "torch_lit" };
    }
  }

  if (staticCell.kind === "forge_broken" && forgeTier >= 1) {
    return { kind: "forge" };
  }

  // The Smelter - covers a 2x2 footprint once built. Only the top-left
  // (anchor) cell gets the "smelter" kind for rendering (TilesetRenderer
  // draws the full sprite from there). The other 3 cells get "smelter"
  // too so they're solid and un-walkable, matching the visual.
  if (
    smelterBuilt &&
    col >= SMELTER_POSITION.col &&
    col < SMELTER_POSITION.col + 2 &&
    row >= SMELTER_POSITION.row &&
    row < SMELTER_POSITION.row + 2
  ) {
    return { kind: "smelter" };
  }

  // The Gemcutting station - same pattern as the Forge:
  // gemcutting_unbuilt is always stamped statically; once built,
  // that same cell is overridden to the real gemcutting kind.
  if (staticCell.kind === "gemcutting_unbuilt" && gemcuttingBuilt) {
    return { kind: "gemcutting" };
  }

  const vein = ORE_VEINS.find((v) => v.position.col === col && v.position.row === row);
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
