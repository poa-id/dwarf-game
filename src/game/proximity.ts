import { getState } from "./gameState";
import {
  LIGHT_SOURCES,
  ORE_VEINS,
  WOOD_NODE_PLACEMENTS,
  KILN_POSITION,
  FORGE_BUILDING_FOOTPRINT,
  HEARTH_FOOTPRINT,
  SMELTER_POSITION,
  GEMCUTTING_POSITION,
  CONSOLE_POSITION,
} from "../engine/hubMap";
import { isNearTorch } from "../engine/torches";

export function nearestUnlitTorch() {
  const { position } = getState().vessel;
  const { litTorches } = getState().world;
  return LIGHT_SOURCES.find((t) => !litTorches[t.id] && isNearTorch(position.col, position.row, t));
}

export function nearestUnrepairedTorch() {
  return nearestUnlitTorch();
}

export function nearestOreVein() {
  const { position } = getState().vessel;
  return ORE_VEINS.find((v) => {
    // 3×3 vein footprint. Player must be within 1 tile on any side.
    // For west-wall veins (col 6-8): player stands at col 9 (east side) to mine.
    // The shaft panel check (cols 10-12) runs BEFORE the drill panel in render.ts,
    // so the shaft wins at col 10+ regardless of this proximity check.
    const nearCol = position.col >= v.position.col - 1 && position.col <= v.position.col + 3;
    const nearRow = position.row >= v.position.row - 1 && position.row <= v.position.row + 3;
    return nearCol && nearRow;
  });
}

export const nearestAnyVein = nearestOreVein;
export const nearestMinedOreVein = nearestOreVein;

export function nearestWoodNode() {
  const { position } = getState().vessel;
  return WOOD_NODE_PLACEMENTS.find((w) => {
    // 3×3 footprint — player within 1 tile of any of the 9 cells
    const nearCol = position.col >= w.position.col - 1 && position.col <= w.position.col + 3;
    const nearRow = position.row >= w.position.row - 1 && position.row <= w.position.row + 3;
    return nearCol && nearRow;
  });
}

export const nearestAnyWoodNode = nearestWoodNode;
export const nearestGatheredWoodNode = nearestWoodNode;

export function isNearConsole(): boolean {
  const { position } = getState().vessel;
  return (
    Math.abs(position.col - CONSOLE_POSITION.col) <= 1 &&
    Math.abs(position.row - CONSOLE_POSITION.row) <= 1
  );
}

export function isNearGarden(): boolean {
  const { position } = getState().vessel;
  return position.col >= 6 && position.col <= 18 &&
         position.row >= 35 && position.row <= 45;
}

export function isNearCompanion(): boolean {
  const { position } = getState().vessel;
  const world = getState().world;
  if (!world.companion.befriended) return false;
  // Narag-Bund sits at COMPANION_POSITION (42, 27)
  return Math.abs(position.col - 42) <= 2 && Math.abs(position.row - 27) <= 2;
}

export function isForgeRepaired(): boolean {
  return getState().world.forgeTier >= 1;
}

export function isNearForge(): boolean {
  const { position } = getState().vessel;
  const { originCol, originRow, width, height } = FORGE_BUILDING_FOOTPRINT;

  const insideBuilding =
    position.col >= originCol &&
    position.col < originCol + width &&
    position.row >= originRow &&
    position.row < originRow + height;

  if (insideBuilding) return false;

  return (
    position.col >= originCol - 1 &&
    position.col <= originCol + width &&
    position.row >= originRow - 1 &&
    position.row <= originRow + height
  );
}

export function isNearHearth(): boolean {
  const { position } = getState().vessel;
  const { originCol, originRow, width, height } = HEARTH_FOOTPRINT;
  // Check proximity to the full 4×4 footprint perimeter
  const nearCol = position.col >= originCol - 1 && position.col <= originCol + width;
  const nearRow = position.row >= originRow - 1 && position.row <= originRow + height;
  return nearCol && nearRow;
}

export function isNearKiln(): boolean {
  const { position } = getState().vessel;
  // Kiln 2×2 footprint: cols 10-11, rows 38-39
  return (
    position.col >= KILN_POSITION.col - 1 &&
    position.col <= KILN_POSITION.col + 2 &&
    position.row >= KILN_POSITION.row - 1 &&
    position.row <= KILN_POSITION.row + 2
  );
}

export function isNearSmelter(): boolean {
  const { position } = getState().vessel;
  const nearCol = position.col >= SMELTER_POSITION.col - 1 && position.col <= SMELTER_POSITION.col + 2;
  const nearRow = position.row >= SMELTER_POSITION.row - 1 && position.row <= SMELTER_POSITION.row + 2;
  return nearCol && nearRow;
}

export function isNearGemcutting(): boolean {
  const { position } = getState().vessel;
  // 4×4 footprint
  const nearCol = position.col >= GEMCUTTING_POSITION.col - 1 && position.col <= GEMCUTTING_POSITION.col + 4;
  const nearRow = position.row >= GEMCUTTING_POSITION.row - 1 && position.row <= GEMCUTTING_POSITION.row + 4;
  return nearCol && nearRow;
}
