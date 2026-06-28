import { getState } from "./gameState";
import {
  LIGHT_SOURCES,
  ORE_VEINS,
  WOOD_NODE_PLACEMENTS,
  HEARTH_SPAWN_POSITION,
  KILN_POSITION,
  FORGE_BUILDING_FOOTPRINT,
  SMELTER_POSITION,
  GEMCUTTING_POSITION,
} from "../engine/hubMap";
import { isNearTorch } from "../engine/torches";
import { ROCK_NODES, createFreshDepletionState, isExhausted as isOreExhausted } from "../engine/mining";
import { WOOD_NODES, isExhausted as isWoodExhausted } from "../engine/woodcraft";

export function nearestUnrepairedTorch() {
  const { position } = getState().vessel;
  const { litTorches } = getState().world;
  return LIGHT_SOURCES.find((t) => !litTorches[t.id] && isNearTorch(position.col, position.row, t));
}

export function nearestOreVein() {
  const { position } = getState().vessel;
  const { veinDepletion } = getState().world;
  return ORE_VEINS.find((v) => {
    const inRange =
      Math.abs(v.position.col - position.col) <= 1 && Math.abs(v.position.row - position.row) <= 1;
    if (!inRange) return false;
    const rockNode = ROCK_NODES.find((n) => n.id === v.rockNodeId);
    if (!rockNode) return false;
    const depletion = veinDepletion[v.id] ?? createFreshDepletionState();
    return !isOreExhausted(rockNode, depletion);
  });
}

export function nearestAnyVein() {
  const { position } = getState().vessel;
  return ORE_VEINS.find(
    (v) => Math.abs(v.position.col - position.col) <= 1 && Math.abs(v.position.row - position.row) <= 1
  );
}

export function nearestWoodNode() {
  const { position } = getState().vessel;
  const { woodDepletion } = getState().world;
  return WOOD_NODE_PLACEMENTS.find((w) => {
    const inRange =
      Math.abs(w.position.col - position.col) <= 1 && Math.abs(w.position.row - position.row) <= 1;
    if (!inRange) return false;
    const woodNode = WOOD_NODES.find((n) => n.id === w.woodNodeId);
    if (!woodNode) return false;
    const depletion = woodDepletion[w.id] ?? createFreshDepletionState();
    return !isWoodExhausted(woodNode, depletion);
  });
}

export function nearestAnyWoodNode() {
  const { position } = getState().vessel;
  return WOOD_NODE_PLACEMENTS.find(
    (w) => Math.abs(w.position.col - position.col) <= 1 && Math.abs(w.position.row - position.row) <= 1
  );
}

/**
 * Is the player standing on open floor immediately adjacent to the
 * Forge building (any of its four sides or corners), but not on one
 * of the building's own solid cells? Replaces an earlier FORGE_CENTER-
 * plus-1-tile-radius check that pointed at one of the building's own
 * SOLID interior cells - since that point itself was walled in on
 * every side except one lucky diagonal corner, "near the forge" was
 * only ever reachable from that single corner. Fixed 2026-06-23 by
 * checking against the building's REAL footprint (shared with
 * hubContent.ts via hubMap.ts's FORGE_BUILDING_FOOTPRINT) instead of a
 * separately-guessed center point. Per explicit project direction, all
 * four sides are walkable/interactable - "the illusion of a huge
 * masterforge" you can walk all the way around.
 */
export function isNearForge(): boolean {
  const { position } = getState().vessel;
  const { originCol, originRow, width, height } = FORGE_BUILDING_FOOTPRINT;

  // Inside the building's own bounding box (walls or forge cells
  // themselves) doesn't count - the player can never stand there, but
  // checking explicitly keeps this correct even if that ever changes.
  const insideBuilding =
    position.col >= originCol &&
    position.col < originCol + width &&
    position.row >= originRow &&
    position.row < originRow + height;
  if (insideBuilding) return false;

  // Within 1 tile of the building's bounding box on any side.
  const nearCol = position.col >= originCol - 1 && position.col <= originCol + width;
  const nearRow = position.row >= originRow - 1 && position.row <= originRow + height;
  return nearCol && nearRow;
}

export function isForgeRepaired(): boolean {
  return getState().world.forgeTier >= 1;
}

export function isNearHearth(): boolean {
  const { position } = getState().vessel;
  return (
    Math.abs(position.col - HEARTH_SPAWN_POSITION.col) <= 1 &&
    Math.abs(position.row - HEARTH_SPAWN_POSITION.row) <= 1
  );
}

export function isNearKiln(): boolean {
  const { position } = getState().vessel;
  return (
    Math.abs(position.col - KILN_POSITION.col) <= 1 && Math.abs(position.row - KILN_POSITION.row) <= 1
  );
}

export function isNearSmelter(): boolean {
  const { position } = getState().vessel;
  return (
    Math.abs(position.col - SMELTER_POSITION.col) <= 1 &&
    Math.abs(position.row - SMELTER_POSITION.row) <= 1
  );
}

export function isNearGemcutting(): boolean {
  const { position } = getState().vessel;
  return (
    Math.abs(position.col - GEMCUTTING_POSITION.col) <= 1 &&
    Math.abs(position.row - GEMCUTTING_POSITION.row) <= 1
  );
}
