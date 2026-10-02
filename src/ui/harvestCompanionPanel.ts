import {
  canAffordBefriendHarvestCompanion,
  applyBefriendHarvestCompanion,
  HARVEST_COMPANION_BEFRIEND_INSIGHT_COST,
  HARVEST_COMPANION_BEFRIEND_COST,
  MAX_GARDEN_TENDING_RANK,
  gardenTendingUpgradeCost,
  canAffordGardenTendingUpgrade,
} from "../engine/harvestCompanion";
import { MATERIALS, deductMaterials } from "../engine/types";
import type { GameState } from "../engine/types";

/**
 * The harvest companion's panel - befriend gate (before) or haul
 * status (after). Confirmed 2026-07-06: a mole rat, name Siginhakhd,
 * sprite now in place. Pre-befriend text stays deliberately
 * name-free ("something waits near the roots") - the player hasn't
 * met him yet, so revealing his name only after befriending is the
 * natural story beat, not an oversight.
 */
export function renderHarvestCompanionPanel(state: GameState, container: HTMLElement, onBefriend: () => void, onUpgrade?: () => void): void {
  const world = state.world;

  if (!world.harvestCompanion.befriended) {
    const hasHarvester = Object.values(world.harvesters).some((h) => h.tier > 0);
    const affordable = hasHarvester && canAffordBefriendHarvestCompanion(world, state.vessel.inventory);
    const costParts = Object.entries(HARVEST_COMPANION_BEFRIEND_COST).map(
      ([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`
    );
    const costText = `${HARVEST_COMPANION_BEFRIEND_INSIGHT_COST} Insight, ${costParts.join(", ")}`;
    const statusText = !hasHarvester
      ? "Requires a Wood Harvester built first"
      : affordable
        ? costText
        : `Need: ${costText}`;

    container.innerHTML = `
      <h2>A watchful shape among the roots</h2>
      <p class="reserve-status">The Wood Harvester's rhythm drew this creature from the dark. It watches the planters, as if it already understands their seasons.</p>
      <div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-action="befriend-harvest-companion">
        <div class="recipe-name">Offer friendship</div>
        <div class="recipe-status">${statusText}</div>
      </div>
    `;
  } else {
    const rank = world.harvestCompanion.tendingRank ?? 0;
    const cost = gardenTendingUpgradeCost(rank);
    const affordable = canAffordGardenTendingUpgrade(rank, state.vessel.inventory);
    const costText = Object.entries(cost).map(([id, amount]) => `${amount} ${MATERIALS[id]?.name ?? id}`).join(", ");
    container.innerHTML = `
      <h2>Siginhakhd</h2>
      <p class="reserve-status">Tends the Garden: harvests mature planters into the Stockpile and replants from stored seed.</p>
      <p class="reserve-status" style="font-size:0.68em;opacity:0.55;">Tending rank ${rank} · a patient rhythm that accelerates with experience.</p>
      ${rank < MAX_GARDEN_TENDING_RANK ? `<div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-action="upgrade-garden-tending">
        <div class="recipe-name">Deepen the Garden Rhythm — Rank ${rank + 1}</div>
        <div class="recipe-status">${affordable ? costText : `Need: ${costText}`} — faster tending</div>
      </div>` : ""}
    `;
  }

  container.querySelectorAll<HTMLDivElement>(".recipe-row[data-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      if (row.dataset.action === "befriend-harvest-companion") onBefriend();
      else if (row.dataset.action === "upgrade-garden-tending") onUpgrade?.();
    });
  });
}

export function performUpgradeGardenTending(state: GameState): GameState {
  const rank = state.world.harvestCompanion.tendingRank ?? 0;
  if (!canAffordGardenTendingUpgrade(rank, state.vessel.inventory)) return state;
  return {
    ...state,
    world: { ...state.world, harvestCompanion: { ...state.world.harvestCompanion, tendingRank: rank + 1 } },
    vessel: { ...state.vessel, inventory: deductMaterials(state.vessel.inventory, gardenTendingUpgradeCost(rank)) },
  };
}

export function performBefriendHarvestCompanion(state: GameState): GameState {
  if (state.world.harvestCompanion.befriended) return state;
  if (!canAffordBefriendHarvestCompanion(state.world, state.vessel.inventory)) return state;

  const result = applyBefriendHarvestCompanion(state.vessel.inventory, state.world.insightBanked);
  return {
    ...state,
    world: {
      ...state.world,
      harvestCompanion: { ...state.world.harvestCompanion, befriended: true, lastHaulAt: Date.now() },
      insightBanked: result.insightBanked,
    },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
}
