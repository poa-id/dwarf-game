/**
 * Generic room restoration panel — used by Deep Foundry (NW) and
 * The Archive (N). Both follow the same 4-stage arc with costs and
 * unlock text, just different positions and materials.
 */

import type { GameState } from "../engine/types";
import { MATERIALS, deductMaterials } from "../engine/types";
import { ROOM_DEFINITIONS, canAdvanceRoom, stageDef, nextStage, type RoomStage } from "../engine/rooms";

export function renderRoomPanel(
  roomId: string,
  state: GameState,
  container: HTMLElement,
  onAdvance: () => void
): void {
  container.innerHTML = "";
  const roomDef = ROOM_DEFINITIONS.find((r) => r.id === roomId);
  if (!roomDef) return;

  const currentStage = (state.world.roomStates[roomId] ?? "ruined") as RoomStage;
  const current = stageDef(roomDef, currentStage);
  const next = nextStage(currentStage);
  const nextDef = next ? stageDef(roomDef, next) : null;
  const canAdvance = next ? canAdvanceRoom(
    roomDef,
    currentStage,
    state.vessel.inventory as Record<string, number>,
    state.world.insightBanked
  ) : false;

  let html = `<h2>${currentStage === "ruined" ? "Sealed Passage" : current.label}</h2>`;

  if (currentStage === "ruined") {
    // Don't spoil what's behind the rubble — mystery is part of the game
    html += `<p class="reserve-status" style="font-size:0.9em;opacity:0.7;">Rubble fills the passage. Something is beyond it.</p>`;
  } else {
    html += `<p class="reserve-status" style="font-size:0.9em;opacity:0.85;">${current.description}</p>`;
    if (current.unlocks) {
      html += `<p class="reserve-status" style="color:#c8a830;font-size:0.82em;">✦ ${current.unlocks}</p>`;
    }
  }

  if (nextDef) {
    const costParts = [
      ...Object.entries(nextDef.cost).map(([m, a]) => `${a} ${MATERIALS[m]?.name ?? m}`),
      nextDef.insightCost > 0 ? `${nextDef.insightCost} Insight` : null,
    ].filter(Boolean);
    const costText = costParts.join(", ");
    const btnLabel = currentStage === "ruined" ? "Clear the rubble" : nextDef.label;
    const unlockText = currentStage === "ruined" ? "Discover what lies beyond" : nextDef.unlocks;

    html += `
      <div class="recipe-row ${canAdvance ? "" : "recipe-row-disabled"}" data-action="advance">
        <div class="recipe-name">${btnLabel}</div>
        <div class="recipe-status">${canAdvance ? costText : `Need: ${costText}`}</div>
        <div class="recipe-success-rate">${unlockText}</div>
      </div>`;
  } else if (currentStage === "masterwork") {
    html += `<p class="reserve-status" style="color:#e09a20;">Fully restored.</p>`;
  }

  container.innerHTML = html;
  container.querySelector<HTMLDivElement>("[data-action='advance']")
    ?.addEventListener("click", () => { if (canAdvance) onAdvance(); });
}

export function performAdvanceRoom(state: GameState, roomId: string): GameState {
  const roomDef = ROOM_DEFINITIONS.find((r) => r.id === roomId);
  if (!roomDef) return state;

  const currentStage = (state.world.roomStates[roomId] ?? "ruined") as RoomStage;
  const next = nextStage(currentStage);
  if (!next) return state;

  const nextDef = stageDef(roomDef, next);
  if (!canAdvanceRoom(roomDef, currentStage, state.vessel.inventory as Record<string, number>, state.world.insightBanked)) {
    return state;
  }

  const newInventory = deductMaterials(state.vessel.inventory, nextDef.cost);
  return {
    ...state,
    world: {
      ...state.world,
      insightBanked: state.world.insightBanked - nextDef.insightCost,
      roomStates: { ...state.world.roomStates, [roomId]: next },
    },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}

export function isNearDeepFoundry(position: { col: number; row: number }): boolean {
  // NW room: cols 6-18, rows 9-19. NW corridor: cols 29-31 rows 9-22 + cols 6-31 rows 9-11
  return (
    (position.col >= 6 && position.col <= 18 && position.row >= 9 && position.row <= 19) ||
    (position.col >= 29 && position.col <= 31 && position.row >= 9 && position.row <= 14) ||
    (position.col >= 6 && position.col <= 31 && position.row >= 9 && position.row <= 11)
  );
}

export function isNearArchive(position: { col: number; row: number }): boolean {
  // North room: cols 35-45, rows 5-12. N corridor: cols 39-41 rows 5-17
  return (
    (position.col >= 35 && position.col <= 45 && position.row >= 5 && position.row <= 12) ||
    (position.col >= 39 && position.col <= 41 && position.row >= 5 && position.row <= 17)
  );
}
