/**
 * Garden Panel — individual planter slots with growth stages.
 * Seeds are consumable: planted once, consumed on harvest, must replant.
 * Herblore skill gates higher-tier crops. Brewing skill unlocked separately.
 */

import type { GameState } from "../engine/types";
import { MATERIALS, getMaterialAmount, deductMaterials, addMaterial } from "../engine/types";
import {
  PLANT_DEFINITIONS,
  PLANTER_UNLOCK_COSTS,
  plantDefById,
  createFreshPlanterSlot,
  type PlanterSlot,
} from "../engine/garden";
import { levelForXp, applyDwarfCountXpMultiplier } from "../engine/xpCurve";

export function performPlantSeed(state: GameState, slotIndex: number, plantId: string): GameState {
  const slots = state.world.gardenSlots;
  const slot = slots[slotIndex];
  if (!slot?.unlocked || slot.plantId) return state;
  const def = plantDefById(plantId);
  if (!def) return state;
  const herbloreLevel = levelForXp(state.vessel.skills.herblore?.xp ?? 0);
  if (herbloreLevel < def.herbloreRequired) return state;
  if (getMaterialAmount(state.vessel.inventory, def.seedMaterialId) < 1) return state;

  const newSlots = [...slots];
  newSlots[slotIndex] = { ...slot, plantId, stage: 0, stageStartedAt: Date.now() };
  const rawXp = applyDwarfCountXpMultiplier(def.herbloreXp, 1);
  const herbloreXp = (state.vessel.skills.herblore?.xp ?? 0) + rawXp;

  return {
    ...state,
    world: { ...state.world, gardenSlots: newSlots },
    vessel: {
      ...state.vessel,
      inventory: deductMaterials(state.vessel.inventory, { [def.seedMaterialId]: 1 }),
      skills: { ...state.vessel.skills, herblore: { id: "herblore" as const, xp: herbloreXp, level: levelForXp(herbloreXp) } },
    },
  };
}

export function performHarvestSlot(state: GameState, slotIndex: number): GameState {
  const slots = state.world.gardenSlots;
  const slot = slots[slotIndex];
  if (!slot?.unlocked || !slot.plantId || slot.stage < 3) return state;
  const def = plantDefById(slot.plantId);
  if (!def) return state;

  let inv = addMaterial(state.vessel.inventory, def.harvestMaterialId, def.harvestAmount);
  if (def.secondaryMaterialId && def.secondaryAmount) {
    inv = addMaterial(inv, def.secondaryMaterialId, def.secondaryAmount);
  }

  const rawXp = Math.round(def.herbloreXp * 1.5);
  const herbloreXp = (state.vessel.skills.herblore?.xp ?? 0) + rawXp;
  const newSlots = [...slots];
  newSlots[slotIndex] = { ...slot, plantId: null, stage: 0, stageStartedAt: 0 };

  return {
    ...state,
    world: { ...state.world, gardenSlots: newSlots },
    vessel: {
      ...state.vessel,
      inventory: inv,
      skills: { ...state.vessel.skills, herblore: { id: "herblore" as const, xp: herbloreXp, level: levelForXp(herbloreXp) } },
    },
  };
}

export function canUnlockPlanter(state: GameState, slotIndex: number): boolean {
  const cost = PLANTER_UNLOCK_COSTS[slotIndex];
  if (!cost) return false;
  if (levelForXp(state.vessel.skills.herblore?.xp ?? 0) < cost.herbloreRequired) return false;
  if (state.world.insightBanked < cost.insightCost) return false;
  return Object.entries(cost.materialCost).every(([m, a]) => getMaterialAmount(state.vessel.inventory, m) >= a);
}

export function performUnlockPlanter(state: GameState, slotIndex: number): GameState {
  if (!canUnlockPlanter(state, slotIndex)) return state;
  const cost = PLANTER_UNLOCK_COSTS[slotIndex];
  const newSlots = [...state.world.gardenSlots];
  while (newSlots.length <= slotIndex) newSlots.push(createFreshPlanterSlot(false));
  newSlots[slotIndex] = { ...newSlots[slotIndex], unlocked: true };
  let inv = state.vessel.inventory;
  for (const [m, a] of Object.entries(cost.materialCost)) inv = deductMaterials(inv, { [m]: a });
  return {
    ...state,
    world: { ...state.world, gardenSlots: newSlots, insightBanked: state.world.insightBanked - cost.insightCost },
    vessel: { ...state.vessel, inventory: inv },
  };
}

function stageLabel(slot: PlanterSlot, now: number): string {
  if (!slot.plantId) return "Empty — plant a seed";
  const def = plantDefById(slot.plantId);
  if (!def) return "Unknown plant";
  if (slot.stage >= 3) return `✦ ${def.name} ready to harvest`;
  const stageDur = def.stageDurationsMs[slot.stage as 0 | 1 | 2];
  const remaining = Math.max(0, stageDur - (now - slot.stageStartedAt));
  const mins = Math.ceil(remaining / 60_000);
  const label = ["germinating", "sprouting", "growing"][slot.stage];
  return `${def.name} — ${label} (~${mins}m)`;
}

export function renderGardenPanel(
  state: GameState,
  container: HTMLElement,
  onPlant: (slotIdx: number, plantId: string) => void,
  onHarvest: (slotIdx: number) => void,
  onUnlock: (slotIdx: number) => void
): void {
  container.innerHTML = "";
  const now = Date.now();
  const slots = state.world.gardenSlots;
  const herbloreLevel = levelForXp(state.vessel.skills.herblore?.xp ?? 0);

  let html = `<h2>The Garden</h2>`;

  for (let i = 0; i < PLANTER_UNLOCK_COSTS.length; i++) {
    const slot = slots[i];
    if (!slot?.unlocked) {
      const cost = PLANTER_UNLOCK_COSTS[i];
      const canUnlock = canUnlockPlanter(state, i);
      const costParts = [
        ...(cost.insightCost > 0 ? [`${cost.insightCost} Insight`] : []),
        ...Object.entries(cost.materialCost).map(([m, a]) => `${a} ${MATERIALS[m]?.name ?? m}`),
        ...(cost.herbloreRequired > 0 ? [`Herblore ${cost.herbloreRequired}`] : []),
      ].join(", ");
      html += `<div class="recipe-row ${canUnlock ? "" : "recipe-row-disabled"}" data-unlock-slot="${i}">
        <div class="recipe-name">Unlock Planter ${i + 1}</div>
        <div class="recipe-status">${canUnlock ? costParts : `Need: ${costParts}`}</div>
      </div>`;
      continue;
    }

    html += `<p class="reserve-status"><strong>Slot ${i + 1}:</strong> ${stageLabel(slot, now)}</p>`;

    if (slot.plantId && slot.stage >= 3) {
      html += `<div class="recipe-row" data-harvest-slot="${i}">
        <div class="recipe-name">Harvest</div>
        <div class="recipe-status">Collect yield, clear slot</div>
      </div>`;
    } else if (!slot.plantId) {
      for (const def of PLANT_DEFINITIONS) {
        if (def.herbloreRequired > herbloreLevel) continue;
        const hasSeed = getMaterialAmount(state.vessel.inventory, def.seedMaterialId) >= 1;
        const seedName = MATERIALS[def.seedMaterialId]?.name ?? def.seedMaterialId;
        const totalMin = Math.round(def.stageDurationsMs.reduce((a, b) => a + b, 0) / 60_000);
        html += `<div class="recipe-row ${hasSeed ? "" : "recipe-row-disabled"}" data-plant-slot="${i}" data-plant-id="${def.id}">
          <div class="recipe-name">Plant ${def.name}</div>
          <div class="recipe-status">${hasSeed ? `1 ${seedName} · ${totalMin}m` : `Need: 1 ${seedName}`}</div>
        </div>`;
      }
    }
  }

  container.innerHTML = html;
  container.querySelectorAll<HTMLElement>("[data-unlock-slot]").forEach(el =>
    el.addEventListener("click", () => { if (!el.classList.contains("recipe-row-disabled")) onUnlock(parseInt(el.dataset.unlockSlot!)); })
  );
  container.querySelectorAll<HTMLElement>("[data-harvest-slot]").forEach(el =>
    el.addEventListener("click", () => onHarvest(parseInt(el.dataset.harvestSlot!)))
  );
  container.querySelectorAll<HTMLElement>("[data-plant-slot]").forEach(el =>
    el.addEventListener("click", () => { if (!el.classList.contains("recipe-row-disabled")) onPlant(parseInt(el.dataset.plantSlot!), el.dataset.plantId!); })
  );
}
