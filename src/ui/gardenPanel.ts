/**
 * Garden panel — shown when the player is near the wood node or kiln
 * in the Garden Room. Shows:
 *
 * Ruined:   "Clear the garden" advance button + existing wood node info
 * Cleared+: Garden slots with plant/harvest actions + advance button
 *
 * Garden slots are the passive production layer — plant a seed, come
 * back when it's ready. The longer you play, the more valuable the
 * garden becomes (ironwood trees take 30 minutes but produce rare
 * material nothing else can supply).
 */

import type { GameState } from "../engine/types";
import {
  PLANT_DEFINITIONS,
  MAX_GARDEN_SLOTS_BY_STAGE,
  plantById,
  plantSeed,
  harvestSlot,
} from "../engine/garden";
import { ROOM_DEFINITIONS, canAdvanceRoom, stageDef, nextStage } from "../engine/rooms";
import { getMaterialAmount, MATERIALS, deductMaterials } from "../engine/types";

const GARDEN_ROOM_DEF = ROOM_DEFINITIONS.find((r) => r.id === "garden_room")!;

function formatTimeRemaining(plantedAt: number, cycleMs: number, readyCount: number): string {
  if (readyCount > 0) return `${readyCount} ready to harvest`;
  if (plantedAt === 0) return "not planted";
  const elapsed = Date.now() - plantedAt;
  const remaining = Math.max(0, cycleMs - (elapsed % cycleMs));
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);
  return `${mins}m ${secs}s`;
}

export function renderGardenPanel(
  state: GameState,
  container: HTMLElement,
  onAdvanceRoom: () => void,
  onPlant: (slotIndex: number, plantId: string) => void,
  onHarvest: (slotIndex: number) => void
): void {
  container.innerHTML = "";
  const currentStage = state.world.roomStates["garden_room"] ?? "ruined";
  const current = stageDef(GARDEN_ROOM_DEF, currentStage);
  const next = nextStage(currentStage);
  const nextDef = next ? stageDef(GARDEN_ROOM_DEF, next) : null;
  const canAdvance = next ? canAdvanceRoom(
    GARDEN_ROOM_DEF,
    currentStage,
    state.vessel.inventory as Record<string, number>,
    state.world.insightBanked
  ) : false;
  const maxSlots = MAX_GARDEN_SLOTS_BY_STAGE[currentStage] ?? 0;
  const slots = state.world.gardenSlots;

  let html = `<h2>${current.label}</h2>`;

  // Garden slots
  if (maxSlots > 0) {
    html += `<div class="reserve-status" style="margin-bottom:6px;"><strong>Garden Slots (${slots.length}/${maxSlots})</strong></div>`;

    for (let i = 0; i < maxSlots; i++) {
      const slot = slots[i] ?? { plantId: null, plantedAt: 0, readyCount: 0 };
      if (!slot.plantId) {
        // Empty — show plant options for seeds the player has
        const availablePlants = PLANT_DEFINITIONS.filter(
          (p) => getMaterialAmount(state.vessel.inventory, p.seedMaterialId) > 0
        );
        if (availablePlants.length > 0) {
          html += `<div class="reserve-status" style="font-size:0.85em;">Slot ${i + 1}: Empty</div>`;
          for (const plant of availablePlants) {
            html += `
              <div class="recipe-row" data-garden-action="plant" data-slot="${i}" data-plant="${plant.id}" style="padding:4px 8px;">
                <div class="recipe-name">Plant ${plant.name}</div>
                <div class="recipe-status">1 ${MATERIALS[plant.seedMaterialId]?.name ?? plant.seedMaterialId} · ${plant.cycleMs / 60_000}min cycle · ${plant.yield} ${MATERIALS[plant.producedMaterialId]?.name ?? plant.producedMaterialId}</div>
              </div>`;
          }
        } else {
          html += `<div class="recipe-row recipe-row-disabled"><div class="recipe-name">Slot ${i + 1}: Empty</div><div class="recipe-status">No seeds — find stoneshroom spores from wood cutting</div></div>`;
        }
      } else {
        const plant = plantById(slot.plantId);
        const timeStr = plant ? formatTimeRemaining(slot.plantedAt, plant.cycleMs, slot.readyCount) : "?";
        const canHarvest = slot.readyCount > 0;
        html += `
          <div class="recipe-row ${canHarvest ? "" : "recipe-row-disabled"}" data-garden-action="harvest" data-slot="${i}">
            <div class="recipe-name">${plant?.name ?? slot.plantId}</div>
            <div class="recipe-status">${timeStr}</div>
          </div>`;
      }
    }
  }

  // Room advance button
  if (nextDef) {
    const costText = [
      ...Object.entries(nextDef.cost).map(([m, a]) => `${a} ${MATERIALS[m]?.name ?? m}`),
      nextDef.insightCost > 0 ? `${nextDef.insightCost} Insight` : null,
    ].filter(Boolean).join(", ");

    html += `
      <div class="recipe-row ${canAdvance ? "" : "recipe-row-disabled"}" data-garden-action="advance">
        <div class="recipe-name">${nextDef.label}</div>
        <div class="recipe-status">${canAdvance ? costText : `Need: ${costText}`} — ${nextDef.unlocks}</div>
      </div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll<HTMLDivElement>("[data-garden-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      const action = row.dataset.gardenAction;
      if (action === "advance") onAdvanceRoom();
      else if (action === "plant") {
        const slot = parseInt(row.dataset.slot ?? "0");
        const plantId = row.dataset.plant ?? "";
        onPlant(slot, plantId);
      } else if (action === "harvest") {
        const slot = parseInt(row.dataset.slot ?? "0");
        onHarvest(slot);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Perform functions
// ---------------------------------------------------------------------------

export function performAdvanceGardenRoom(state: GameState): GameState {
  const currentStage = state.world.roomStates["garden_room"] ?? "ruined";
  const next = nextStage(currentStage);
  if (!next) return state;

  const nextDef = stageDef(GARDEN_ROOM_DEF, next);
  if (!canAdvanceRoom(GARDEN_ROOM_DEF, currentStage, state.vessel.inventory as Record<string, number>, state.world.insightBanked)) {
    return state;
  }

  const newInventory = deductMaterials(state.vessel.inventory, nextDef.cost);
  const newMaxSlots = MAX_GARDEN_SLOTS_BY_STAGE[next] ?? 0;

  // Expand garden slots to new max, preserving existing
  const existingSlots = state.world.gardenSlots;
  const newSlots = [
    ...existingSlots,
    ...Array.from({ length: Math.max(0, newMaxSlots - existingSlots.length) }, () => ({
      plantId: null, plantedAt: 0, readyCount: 0,
    })),
  ];

  return {
    ...state,
    world: {
      ...state.world,
      insightBanked: state.world.insightBanked - nextDef.insightCost,
      roomStates: { ...state.world.roomStates, garden_room: next },
      gardenSlots: newSlots,
    },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}

export function performPlantSeed(state: GameState, slotIndex: number, plantId: string): GameState {
  const plant = plantById(plantId);
  if (!plant) return state;
  const slots = [...state.world.gardenSlots];
  if (slotIndex >= slots.length) return state;
  if (slots[slotIndex].plantId) return state;

  const seedHeld = getMaterialAmount(state.vessel.inventory, plant.seedMaterialId);
  if (seedHeld < 1) return state;

  const now = Date.now();
  const result = plantSeed(slotIndex, slots, plantId, state.vessel.inventory, now);
  const newSlots = [...slots];
  newSlots[slotIndex] = result.slot;

  return {
    ...state,
    world: { ...state.world, gardenSlots: newSlots },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
}

export function performHarvestSlot(state: GameState, slotIndex: number): GameState {
  const slots = [...state.world.gardenSlots];
  if (slotIndex >= slots.length) return state;
  if (!slots[slotIndex].plantId || slots[slotIndex].readyCount === 0) return state;

  const result = harvestSlot(slots[slotIndex]);
  const newSlots = [...slots];
  newSlots[slotIndex] = result.slot;

  // Add harvested materials to inventory
  let newInventory = { ...state.vessel.inventory };
  for (const [mat, amt] of Object.entries(result.gained)) {
    newInventory = { ...newInventory, [mat]: ((newInventory[mat] as number | undefined) ?? 0) + (amt as number) };
  }

  return {
    ...state,
    world: { ...state.world, gardenSlots: newSlots },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}

export function isNearGarden(position: { col: number; row: number }): boolean {
  // Garden Room: cols 6-18, rows 35-45. Wood node at (8,38), kiln at (10,38).
  return position.col >= 6 && position.col <= 18 &&
         position.row >= 35 && position.row <= 45;
}
