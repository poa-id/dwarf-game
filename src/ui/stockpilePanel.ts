/**
 * Stockpile room panel — shown when the dwarf stands near the stockpile
 * chest or at the east corridor entrance.
 *
 * States:
 * - Ruined: show "Clear the rubble" action (costs materials + Insight)
 * - Cleared: show ore contents, option to restore further
 * - Restored/Masterwork: full ore inventory display + upgrade
 */

import type { GameState } from "../engine/types";
import { ROOM_DEFINITIONS, canAdvanceRoom, stageDef, nextStage } from "../engine/rooms";
import { deductMaterials, MATERIALS } from "../engine/types";

const ROOM = ROOM_DEFINITIONS.find((r) => r.id === "stockpile_room")!;

export function renderStockpilePanel(
  state: GameState,
  container: HTMLElement,
  onAdvance: () => void
): void {
  container.innerHTML = "";
  const currentStage = state.world.roomStates["stockpile_room"] ?? "ruined";
  const current = stageDef(ROOM, currentStage);
  const next = nextStage(currentStage);
  const nextDef = next ? stageDef(ROOM, next) : null;

  const canAdvance = next ? canAdvanceRoom(
    ROOM,
    currentStage,
    state.vessel.inventory as Record<string, number>,
    state.world.insightBanked
  ) : false;

  // Ore contents (shown when cleared+)
  const isOpen = currentStage !== "ruined";
  const stockpile = state.world.stockpileOre;
  const oreEntries = Object.entries(stockpile).filter(([, amt]) => amt > 0);
  const oreList = oreEntries.length > 0
    ? oreEntries.map(([mat, amt]) => `${amt} ${MATERIALS[mat]?.name ?? mat}`).join(", ")
    : "Empty";

  let html = `<h2>${current.label}</h2>`;

  if (isOpen) {
    html += `
      <p class="reserve-status" style="color:#c8a830;">Stockpile: ${oreList}</p>
    `;

    // Collect from stockpile button
    if (oreEntries.length > 0) {
      html += `
        <div class="recipe-row" data-action="collect-stockpile">
          <div class="recipe-name">Collect All</div>
          <div class="recipe-status">Move stockpile ore to inventory</div>
        </div>
      `;
    }
  } else {
    html += `<p class="reserve-status">${current.description}</p>`;
  }

  // Advance stage button
  if (nextDef && canAdvance) {
    const costText = [
      ...Object.entries(nextDef.cost).map(([m, a]) => `${a} ${MATERIALS[m]?.name ?? m}`),
      nextDef.insightCost > 0 ? `${nextDef.insightCost} Insight` : null,
    ].filter(Boolean).join(", ");

    html += `
      <div class="recipe-row" data-action="advance-room">
        <div class="recipe-name">${nextDef.label}</div>
        <div class="recipe-status">${costText} — ${nextDef.unlocks}</div>
      </div>
    `;
  } else if (nextDef) {
    const costText = [
      ...Object.entries(nextDef.cost).map(([m, a]) => `${a} ${MATERIALS[m]?.name ?? m}`),
      nextDef.insightCost > 0 ? `${nextDef.insightCost} Insight` : null,
    ].filter(Boolean).join(", ");

    html += `
      <div class="recipe-row recipe-row-disabled">
        <div class="recipe-name">${nextDef.label}</div>
        <div class="recipe-status">Need: ${costText}</div>
      </div>
    `;
  }

  container.innerHTML = html;

  container.querySelector<HTMLDivElement>("[data-action='advance-room']")
    ?.addEventListener("click", () => { if (canAdvance) onAdvance(); });

  container.querySelector<HTMLDivElement>("[data-action='collect-stockpile']")
    ?.addEventListener("click", () => onAdvance()); // reuse callback, handled in render.ts
}

// ---------------------------------------------------------------------------
// Perform functions
// ---------------------------------------------------------------------------

export function performAdvanceStockpileRoom(state: GameState): GameState {
  const currentStage = state.world.roomStates["stockpile_room"] ?? "ruined";
  const next = nextStage(currentStage);
  if (!next) return state;

  const nextDef = stageDef(ROOM, next);
  if (!canAdvanceRoom(ROOM, currentStage, state.vessel.inventory as Record<string, number>, state.world.insightBanked)) {
    return state;
  }

  const newInventory = deductMaterials(state.vessel.inventory, nextDef.cost);

  return {
    ...state,
    world: {
      ...state.world,
      insightBanked: state.world.insightBanked - nextDef.insightCost,
      roomStates: { ...state.world.roomStates, stockpile_room: next },
    },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}

export function performCollectStockpile(state: GameState): GameState {
  const stockpile = state.world.stockpileOre;
  if (Object.keys(stockpile).length === 0) return state;

  // Add all stockpile ore to personal inventory
  let newInventory = { ...state.vessel.inventory };
  for (const [mat, amt] of Object.entries(stockpile)) {
    newInventory = { ...newInventory, [mat]: ((newInventory[mat] as number | undefined) ?? 0) + amt };
  }

  return {
    ...state,
    world: { ...state.world, stockpileOre: {} },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}

export function isNearStockpile(position: { col: number; row: number }, stockpileStage: string): boolean {
  if (stockpileStage === "ruined") {
    // Near the east corridor entrance (rubble face)
    return (
      Math.abs(position.col - 52) <= 2 &&
      position.row >= 23 && position.row <= 27
    );
  }
  // Near the chest
  return (
    Math.abs(position.col - 57) <= 2 &&
    Math.abs(position.row - 25) <= 2
  );
}
