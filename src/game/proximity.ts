import { getState } from "./gameState";
import {
  LIGHT_SOURCES,
  ORE_VEINS,
  WOOD_NODE_PLACEMENTS,
  ZONES,
  HEARTH_SPAWN_POSITION,
  KILN_POSITION,
} from "../engine/hubMap";
import { isNearTorch } from "../engine/torches";
import { ROCK_NODES, createFreshDepletionState, isExhausted as isOreExhausted } from "../engine/mining";
import { WOOD_NODES, isExhausted as isWoodExhausted } from "../engine/woodcraft";

/** The forge room's center, where the broken/working forge sits - used to check proximity for repair. */
const FORGE_ROOM = ZONES.find((z) => z.id === "forge_room")!;
const FORGE_CENTER = {
  col: FORGE_ROOM.bounds.col + Math.floor(FORGE_ROOM.bounds.width / 2),
  row: FORGE_ROOM.bounds.row + Math.floor(FORGE_ROOM.bounds.height / 2),
};

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

export function isNearForge(): boolean {
  const { position } = getState().vessel;
  return (
    Math.abs(position.col - FORGE_CENTER.col) <= 1 && Math.abs(position.row - FORGE_CENTER.row) <= 1
  );
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
