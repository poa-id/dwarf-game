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
import { ROOM_DEFINITIONS, canAdvanceRoom, stageDef, nextStage, stockpileCapacityPerMaterial } from "../engine/rooms";
import { deductMaterials, MATERIALS, canAffordMaterials, type ResourceBag } from "../engine/types";

const ROOM = ROOM_DEFINITIONS.find((r) => r.id === "stockpile_room")!;

export function renderStockpilePanel(
  state: GameState,
  container: HTMLElement,
  onAdvance: () => void,
  onCollect?: () => void,
  onDeposit?: () => void,
  onExpand?: () => void,
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
  const expansionRank = state.world.stockpileExpansionRank ?? 0;
  const capacity = stockpileCapacityPerMaterial(currentStage, expansionRank);
  const oreEntries = Object.entries(stockpile).filter(([, amt]) => amt > 0);
  const stockpileList = oreEntries.length > 0
    ? `<div class="stockpile-list">${oreEntries
        .sort(([a], [b]) => (MATERIALS[a]?.category ?? "").localeCompare(MATERIALS[b]?.category ?? "") || (MATERIALS[a]?.name ?? a).localeCompare(MATERIALS[b]?.name ?? b))
        .map(([mat, amt]) => {
          const atCap = amt >= capacity;
          const percent = Math.min(100, (amt / capacity) * 100);
          return `<div class="stockpile-item ${atCap ? "stockpile-item-full" : ""}">
            <div class="stockpile-item-line"><span>${MATERIALS[mat]?.name ?? mat}</span><strong>${amt} / ${capacity}</strong></div>
            <div class="stockpile-meter"><span style="width:${percent}%"></span></div>
          </div>`;
        }).join("")}</div>`
    : `<p class="inventory-empty">Nothing has been entrusted to the mountain yet.</p>`;

  let html = `<h2>${current.label}</h2>`;

  // Don't show upgrade label/unlocks when still ruined — mystery first
  if (isOpen) {
    html += `
      <p class="stockpile-explainer"><strong>Mountain stores.</strong> Narag-Bund and automated workshops may use anything placed here. Your Bag remains personal.</p>
      ${stockpileList}
    `;
    const expansionCost = stockpileExpansionCost(expansionRank);
    const canExpand = canAffordMaterials(state.vessel.inventory, expansionCost);
    const expansionCostText = Object.entries(expansionCost).map(([id, amount]) => `${amount} ${MATERIALS[id]?.name ?? id}`).join(", ");
    html += `<div class="recipe-row ${canExpand ? "" : "recipe-row-disabled"}" data-action="expand-stockpile">
      <div class="recipe-name">Expand Bins — Rank ${expansionRank + 1}</div>
      <div class="recipe-status">${canExpand ? expansionCostText : `Need: ${expansionCostText}`} — +25% capacity</div>
    </div>`;

    // Collect from stockpile button
    if (oreEntries.length > 0) {
      html += `
        <div class="recipe-row" data-action="collect-stockpile">
          <div class="recipe-name">Withdraw All to Bag</div>
          <div class="recipe-status">Remove everything from automation and carry it personally</div>
        </div>
      `;
    }
    if (Object.values(state.vessel.inventory).some((amount) => (amount ?? 0) > 0)) {
      html += `
        <div class="recipe-row" data-action="deposit-stockpile">
          <div class="recipe-name">Entrust Bag to the Mountain</div>
          <div class="recipe-status">Make carried materials available to logistics and workshops</div>
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
    ?.addEventListener("click", () => onCollect?.());
  container.querySelector<HTMLDivElement>("[data-action='deposit-stockpile']")
    ?.addEventListener("click", () => onDeposit?.());
  container.querySelector<HTMLDivElement>("[data-action='expand-stockpile']")
    ?.addEventListener("click", (event) => {
      if (!(event.currentTarget as HTMLElement).classList.contains("recipe-row-disabled")) onExpand?.();
    });
}

export function stockpileExpansionCost(rank: number): ResourceBag {
  const next = Math.max(1, rank + 1);
  const cost: ResourceBag = {
    wood_planks: Math.ceil(8 * Math.pow(1.36, next - 1)),
    iron_ingot: Math.ceil(3 * Math.pow(1.3, next - 1)),
  };
  if (next >= 20) cost[next >= 40 ? "echo_amethyst" : "echo_garnet"] = Math.ceil((next - 19) / 8);
  return cost;
}

export function performExpandStockpile(state: GameState): GameState {
  const rank = state.world.stockpileExpansionRank ?? 0;
  const cost = stockpileExpansionCost(rank);
  if (!canAffordMaterials(state.vessel.inventory, cost)) return state;
  return {
    ...state,
    world: { ...state.world, stockpileExpansionRank: rank + 1 },
    vessel: { ...state.vessel, inventory: deductMaterials(state.vessel.inventory, cost) },
  };
}

export function performDepositStockpile(state: GameState): GameState {
  const stage = state.world.roomStates["stockpile_room"] ?? "ruined";
  const capacity = stockpileCapacityPerMaterial(stage, state.world.stockpileExpansionRank ?? 0);
  if (capacity <= 0) return state;
  const stockpile = { ...state.world.stockpileOre };
  const inventory = { ...state.vessel.inventory };
  for (const [materialId, held] of Object.entries(inventory)) {
    const amount = held ?? 0;
    if (amount <= 0) continue;
    const space = Math.max(0, capacity - (stockpile[materialId] ?? 0));
    const moved = Math.min(amount, space);
    if (moved <= 0) continue;
    stockpile[materialId] = (stockpile[materialId] ?? 0) + moved;
    inventory[materialId] = amount - moved;
  }
  return { ...state, world: { ...state.world, stockpileOre: stockpile }, vessel: { ...state.vessel, inventory } };
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

  // Add all stored materials to personal inventory
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
    // Near the east corridor entrance
    return (
      Math.abs(position.col - 50) <= 3 &&
      position.row >= 23 && position.row <= 27
    );
  }
  // Cleared+: anywhere in the stockpile room (the whole-room bounds
  // below are intentionally room-wide, not a tight radius around the
  // chest - robust to STOCKPILE_CHEST_POSITION moving, as it did
  // 2026-07-04)
  return (
    position.col >= 52 && position.col <= 63 &&
    position.row >= 21 && position.row <= 30
  );
}
