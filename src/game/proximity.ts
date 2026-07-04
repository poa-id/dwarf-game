import { getState } from "./gameState";
import {
  LIGHT_SOURCES,
  ORE_VEINS,
  WOOD_NODE_PLACEMENTS,
  KILN_POSITION,
  FORGE_BUILDING_FOOTPRINT,
  HEARTH_FOOTPRINT,
  SMELTER_POSITION,
  SAWMILL_POSITION,
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
    // Wood node shrunk 3x3 -> 2x2 (2026-07-04, see hubMap.ts's
    // WOOD_NODE_PLACEMENTS comment) - buffer narrowed from +3 to +2 to
    // match (a 2x2 footprint occupies anchor..anchor+1, so a symmetric
    // 1-cell buffer needs +2, not +3 - the old value was just quietly
    // over-generous rather than broken, but still worth fixing for
    // consistency with the same fix just applied to isNearKiln).
    const nearCol = position.col >= w.position.col - 1 && position.col <= w.position.col + 2;
    const nearRow = position.row >= w.position.row - 1 && position.row <= w.position.row + 2;
    return nearCol && nearRow;
  });
}

export const nearestAnyWoodNode = nearestWoodNode;
export const nearestGatheredWoodNode = nearestWoodNode;

export function isNearConsole(): boolean {
  const { position } = getState().vessel;
  // Console grown to 3×3 at (34,22)-(36,24), 2026-07-04
  return (
    position.col >= CONSOLE_POSITION.col - 1 && position.col <= CONSOLE_POSITION.col + 3 &&
    position.row >= CONSOLE_POSITION.row - 1 && position.row <= CONSOLE_POSITION.row + 3
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
  // Narag-Bund sits at COMPANION_POSITION (40, 29) — south of the hearth
  return Math.abs(position.col - 40) <= 2 && Math.abs(position.row - 29) <= 2;
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
  // Kiln grown 2x2 -> 3x3 (2026-07-04, see hubMap.ts's KILN_POSITION
  // comment) - buffer widened from +2 to +3 to match. A 3x3 footprint
  // occupies anchor..anchor+2, so a symmetric 1-cell buffer on the far
  // side needs +3, not +2 (which was leftover from when this was 2x2
  // and correctly meant "anchor+1 occupied, +1 buffer = anchor+2").
  return (
    position.col >= KILN_POSITION.col - 1 &&
    position.col <= KILN_POSITION.col + 3 &&
    position.row >= KILN_POSITION.row - 1 &&
    position.row <= KILN_POSITION.row + 3
  );
}

export function isNearSmelter(): boolean {
  const { position } = getState().vessel;
  const nearCol = position.col >= SMELTER_POSITION.col - 1 && position.col <= SMELTER_POSITION.col + 2;
  const nearRow = position.row >= SMELTER_POSITION.row - 1 && position.row <= SMELTER_POSITION.row + 2;
  return nearCol && nearRow;
}

export function isNearSawmill(): boolean {
  const { position } = getState().vessel;
  // Sawmill 2×2 footprint, same proximity shape as the Kiln
  return (
    position.col >= SAWMILL_POSITION.col - 1 &&
    position.col <= SAWMILL_POSITION.col + 2 &&
    position.row >= SAWMILL_POSITION.row - 1 &&
    position.row <= SAWMILL_POSITION.row + 2
  );
}

export function isNearGemcutting(): boolean {
  const { position } = getState().vessel;
  // 4×4 footprint
  const nearCol = position.col >= GEMCUTTING_POSITION.col - 1 && position.col <= GEMCUTTING_POSITION.col + 4;
  const nearRow = position.row >= GEMCUTTING_POSITION.row - 1 && position.row <= GEMCUTTING_POSITION.row + 4;
  return nearCol && nearRow;
}
