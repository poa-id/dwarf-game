import { getState, setState, narrate } from "./gameState";
import { attemptMove, type Direction } from "../engine/movement";
import { markVisibleCellsExplored } from "../engine/exploration";
import { zoneContaining, describeUnlockCondition } from "../engine/visibility";
import { hubCellAt } from "../render/hubContent";
import { isSolidCellKind } from "../render/palette";

export const KEY_TO_DIRECTION: Record<string, Direction> = {
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

function isSolidAt(col: number, row: number): boolean {
  const world = getState().world;
  const { litTorches, veinDepletion, woodDepletion, forgeTier, smelterBuilt, gemcuttingBuilt, companion, consoleAwakened, roomStates, drills, sawmillBuilt, turbineBuilt } = world;
  const drillTiers = Object.fromEntries(Object.entries(drills).map(([id, d]) => [id, d.tier]));
  return isSolidCellKind(
    hubCellAt(col, row, litTorches, veinDepletion, woodDepletion, forgeTier, smelterBuilt, gemcuttingBuilt,
      companion.befriended, consoleAwakened,
      roomStates["stockpile_room"] ?? "ruined",
      roomStates["trade_hall"] ?? "ruined",
      roomStates["deep_foundry"] ?? "ruined",
      roomStates["the_archive"] ?? "ruined",
      drillTiers,
      world.placedTorches,
      world.mineshaftDepth,
      world.gardenSlots,
      sawmillBuilt,
      turbineBuilt
    ).kind
  );
}

export interface MoveOutcome {
  moved: boolean;
  blockedMessage: string | null;
}

/**
 * Attempt to move the dwarf one cell. Handles the full side-effect
 * chain: collision, exploration marking, first-zone-visit narration.
 * Returns whether anything actually changed (so the caller knows
 * whether a render/persist is warranted) and an optional message for
 * a blocked attempt the caller can show.
 */
export function handlePlayerMove(direction: Direction): MoveOutcome {
  const state = getState();
  const moveResult = attemptMove(state.vessel.position, direction, state.world, isSolidAt);

  if (!moveResult.moved) {
    // Zone-specific message when possible (2026-06-23 fix - a real
    // reported gap: this used to be the SAME generic flavor line
    // regardless of which zone, or how far from its real unlock
    // condition, the player actually hit). Falls back to the old
    // generic line if blockedZone is somehow null (e.g. a future
    // locked-zone case this doesn't anticipate) - never regresses to
    // showing nothing.
    let blockedMessage: string | null = null;
    if (moveResult.blockedReason === "locked_zone") {
      const zone = moveResult.blockedZone;
      const unlockText = zone ? describeUnlockCondition(zone.unlock) : "";
      blockedMessage =
        zone && unlockText
          ? `${zone.name} is sealed. ${unlockText}`
          : "Something blocks the way - not yet rebuilt, not yet open to him.";
    }
    return { moved: false, blockedMessage };
  }

  const newExplored = markVisibleCellsExplored(state.world.exploredCells, moveResult.position);
  const enteredZone = zoneContaining(moveResult.position.col, moveResult.position.row);
  const isFirstVisitToThisZone =
    enteredZone !== null && !state.world.loreFlags.includes(`visited_${enteredZone.id}`);

  setState({
    ...state,
    world: {
      ...state.world,
      exploredCells: newExplored,
      loreFlags: isFirstVisitToThisZone
        ? [...state.world.loreFlags, `visited_${enteredZone!.id}`]
        : state.world.loreFlags,
    },
    vessel: { ...state.vessel, position: moveResult.position },
  });

  if (isFirstVisitToThisZone) narrate("area_revealed");

  return { moved: true, blockedMessage: null };
}
