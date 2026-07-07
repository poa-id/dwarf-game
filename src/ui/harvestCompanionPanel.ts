import {
  canAffordBefriendHarvestCompanion,
  applyBefriendHarvestCompanion,
  HARVEST_COMPANION_BEFRIEND_INSIGHT_COST,
  HARVEST_COMPANION_BEFRIEND_COST,
} from "../engine/harvestCompanion";
import { MATERIALS } from "../engine/types";
import type { GameState } from "../engine/types";

/**
 * The harvest companion's panel - befriend gate (before) or haul
 * status (after). Confirmed 2026-07-06: a mole rat, name Siginhakhd,
 * sprite now in place. Pre-befriend text stays deliberately
 * name-free ("something waits near the roots") - the player hasn't
 * met him yet, so revealing his name only after befriending is the
 * natural story beat, not an oversight.
 */
export function renderHarvestCompanionPanel(state: GameState, container: HTMLElement, onBefriend: () => void): void {
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
      <h2>A watchful shape in the dark</h2>
      <p class="reserve-status">Something waits near the roots, patient, heavy-footed.</p>
      <div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-action="befriend-harvest-companion">
        <div class="recipe-name">Offer friendship</div>
        <div class="recipe-status">${statusText}</div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <h2>Siginhakhd</h2>
      <p class="reserve-status">Hauls wood from Harvesters to the Sawmill.</p>
      <p class="reserve-status" style="font-size:0.68em;opacity:0.55;">Haul every 10s, 3 wood/trip.</p>
    `;
  }

  container.querySelectorAll<HTMLDivElement>(".recipe-row[data-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      if (row.dataset.action === "befriend-harvest-companion") onBefriend();
    });
  });
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
