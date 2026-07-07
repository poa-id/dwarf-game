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
  TURBINE_POSITION,
  GEMCUTTING_POSITION,
  CONSOLE_POSITION,
  COMPANION_POSITION,
  HARVEST_COMPANION_POSITION,
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
    // Wood node grown back 2x2 -> 3x3 (2026-07-06, to match the new
    // Wood Harvester) - buffer widened from +2 to +3 to match.
    const nearCol = position.col >= w.position.col - 1 && position.col <= w.position.col + 3;
    const nearRow = position.row >= w.position.row - 1 && position.row <= w.position.row + 3;
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
  // Narag-Bund grown 1x1 -> 4x4, moved north-and-east of the Hearth
  // (2026-07-05) - see hubMap.ts's COMPANION_POSITION comment.
  return (
    position.col >= COMPANION_POSITION.col - 1 && position.col <= COMPANION_POSITION.col + 4 &&
    position.row >= COMPANION_POSITION.row - 1 && position.row <= COMPANION_POSITION.row + 4
  );
}

export function isNearHarvestCompanion(): boolean {
  const { position } = getState().vessel;
  // Note: does NOT gate on befriended, unlike isNearCompanion - the
  // build/befriend panel needs to be reachable BEFORE he's befriended
  // (mirrors isNearSawmill/isNearTurbine's "always reachable, panel
  // itself shows the gate" pattern, not Narag-Bund's "only appears
  // once already unlocked" pattern - he doesn't need his own visible
  // sprite to interact with the befriend offer).
  return (
    position.col >= HARVEST_COMPANION_POSITION.col - 1 && position.col <= HARVEST_COMPANION_POSITION.col + 3 &&
    position.row >= HARVEST_COMPANION_POSITION.row - 1 && position.row <= HARVEST_COMPANION_POSITION.row + 3
  );
}

export function isNearHarvester(): boolean {
  // The Wood Harvester sits exactly on the wood node's position
  // (mirrors the drill-on-vein pattern) - reuse nearestWoodNode's
  // existing proximity math rather than duplicating it.
  return nearestWoodNode() !== undefined;
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
  // Check proximity to the full 6×6 footprint perimeter (width/height
  // read dynamically from HEARTH_FOOTPRINT, so this stays correct
  // regardless of size - unlike the stale hardcoded-number bugs found
  // in isNearKiln/isNearSawmill/isNearGemcutting, this one was only
  // ever wrong in its comment, not its math)
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
  // Smelter grown 2x2 -> 3x3 (2026-07-06) - buffer widened from +2 to
  // +3 to match, same fix as isNearKiln/isNearSawmill's earlier grow-outs.
  const nearCol = position.col >= SMELTER_POSITION.col - 1 && position.col <= SMELTER_POSITION.col + 3;
  const nearRow = position.row >= SMELTER_POSITION.row - 1 && position.row <= SMELTER_POSITION.row + 3;
  return nearCol && nearRow;
}

export function isNearSawmill(): boolean {
  const { position } = getState().vessel;
  // Sawmill grown 2x2 -> 3x3 (2026-07-05) - buffer widened from +2 to
  // +3 to match, same fix as isNearKiln's earlier grow-out.
  return (
    position.col >= SAWMILL_POSITION.col - 1 &&
    position.col <= SAWMILL_POSITION.col + 3 &&
    position.row >= SAWMILL_POSITION.row - 1 &&
    position.row <= SAWMILL_POSITION.row + 3
  );
}

export function isNearTurbine(): boolean {
  const { position } = getState().vessel;
  // Turbine is 3x3 - same buffer shape as every other 3x3 structure.
  return (
    position.col >= TURBINE_POSITION.col - 1 &&
    position.col <= TURBINE_POSITION.col + 3 &&
    position.row >= TURBINE_POSITION.row - 1 &&
    position.row <= TURBINE_POSITION.row + 3
  );
}

export function isNearGemcutting(): boolean {
  const { position } = getState().vessel;
  // 6×6 footprint - was stale here (said "4×4"/+4, actually 6x6 - see
  // hubContent.ts's fill loop), meaning the far edge had zero
  // interaction buffer and part of the near edge was short too. Same
  // class of bug as isNearKiln/isNearSawmill's earlier fixes.
  const nearCol = position.col >= GEMCUTTING_POSITION.col - 1 && position.col <= GEMCUTTING_POSITION.col + 6;
  const nearRow = position.row >= GEMCUTTING_POSITION.row - 1 && position.row <= GEMCUTTING_POSITION.row + 6;
  return nearCol && nearRow;
}
