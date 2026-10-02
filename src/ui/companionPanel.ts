import {
  companionHaulTierDef,
  nextCompanionHaulTier,
  canAffordCompanionUpgrade,
  applyCompanionUpgrade,
  applyCompanionTraining,
  companionTrainingCost,
  canAffordCompanionTraining,
  MAX_COMPANION_TRAINING_RANK,
} from "../engine/companion";
import { nextHaulMaterial } from "../engine/hearth";
import { MATERIALS, deductMaterials } from "../engine/types";
import type { GameState } from "../engine/types";

/**
 * Narag-Bund's panel - status readout (unchanged from before) plus the
 * new "Upgrade" row for his haul-speed/capacity tier ladder (2026-07-06
 * - see companion.ts's doc comment for the design brief this replaces:
 * a single Turbine-linked boolean that doubled as "the Forge got
 * faster" AND "the hauling beast got faster," which conflated two
 * separate things). Same "gate the row, show cost, disable if
 * unaffordable" pattern as every other build-gated station.
 */
export function renderCompanionPanel(state: GameState, container: HTMLElement, onUpgrade: () => void, onTrain: () => void): void {
  const world = state.world;
  const trainingRank = world.companion.trainingRank ?? 0;
  const currentTier = applyCompanionTraining(companionHaulTierDef(world.companion.tier), trainingRank);
  const nextTier = nextCompanionHaulTier(world.companion.tier);

  const haulTarget = nextHaulMaterial(state.vessel.inventory);
  const haulLabel = haulTarget ? (MATERIALS[haulTarget]?.name ?? haulTarget) : null;
  const secsLeft = Math.max(0, Math.ceil((currentTier.haulIntervalMs - Math.max(0, Date.now() - world.companion.lastHaulAt)) / 1000));
  const haulStatus = haulLabel
    ? `Hauling ${haulLabel} to the reserve in ~${secsLeft}s`
    : "Nothing to haul — carry some fuel";
  const drillStatus = world.hearthTier >= 2
    ? `Supplying drills and hauling machine output to the stockpile`
    : "Will supply drills at Hearth tier 2; stockpile routes unlock when the room is cleared";
  const logisticsPerMin = currentTier.haulAmountPerTrip * (60_000 / currentTier.haulIntervalMs);

  let upgradeRowHtml = "";
  if (nextTier) {
    const affordable = canAffordCompanionUpgrade(world.companion.tier, state.vessel.inventory, world.insightBanked);
    const costParts = Object.entries(nextTier.upgradeCost).map(
      ([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`
    );
    const costText = `${nextTier.upgradeInsightCost} Insight, ${costParts.join(", ")}`;
    upgradeRowHtml = `
      <div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-action="upgrade-companion">
        <div class="recipe-name">Upgrade: ${nextTier.name}</div>
        <div class="recipe-status">${affordable ? costText : `Need: ${costText}`}</div>
      </div>
    `;
  } else {
    upgradeRowHtml = `<p class="reserve-status" style="opacity:0.6;">Fully upgraded - he doesn't get any faster than this.</p>`;
  }

  const trainingCost = companionTrainingCost(trainingRank);
  const canTrain = canAffordCompanionTraining(trainingRank, state.vessel.inventory);
  const trainingCostText = Object.entries(trainingCost).map(([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`).join(", ");
  const trainingRow = trainingRank < MAX_COMPANION_TRAINING_RANK
    ? `<div class="recipe-row ${canTrain ? "" : "recipe-row-disabled"}" data-action="train-companion">
         <div class="recipe-name">Strengthen Harness — Rank ${trainingRank + 1}</div>
         <div class="recipe-status">${canTrain ? trainingCostText : `Need: ${trainingCostText}`} — +25% carry capacity</div>
       </div>`
    : `<p class="reserve-status" style="opacity:0.6;">Harness training mastered.</p>`;

  container.innerHTML = `
    <h2>Narag-Bund</h2>
    <p class="reserve-status">Coal-beetle. Black-head. He stays.</p>
    <p class="reserve-status" style="color:#c87820;">${haulStatus}</p>
    <p class="reserve-status">${drillStatus}</p>
    <p class="reserve-status" style="font-size:0.68em;opacity:0.55;">${currentTier.name} (tier ${currentTier.tier}) · ${logisticsPerMin.toFixed(1)} resources/min · ${currentTier.haulAmountPerTrip}/trip · Next: ~${secsLeft}s</p>
    ${upgradeRowHtml}
    ${trainingRow}
  `;

  container.querySelectorAll<HTMLDivElement>(".recipe-row[data-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      if (row.dataset.action === "upgrade-companion") onUpgrade();
      else if (row.dataset.action === "train-companion") onTrain();
    });
  });
}

export function performCompanionTraining(state: GameState): GameState {
  const rank = state.world.companion.trainingRank ?? 0;
  if (!canAffordCompanionTraining(rank, state.vessel.inventory)) return state;
  return {
    ...state,
    world: { ...state.world, companion: { ...state.world.companion, trainingRank: rank + 1 } },
    vessel: { ...state.vessel, inventory: deductMaterials(state.vessel.inventory, companionTrainingCost(rank)) },
  };
}

export function performCompanionUpgrade(state: GameState): GameState {
  if (!canAffordCompanionUpgrade(state.world.companion.tier, state.vessel.inventory, state.world.insightBanked)) {
    return state;
  }
  const result = applyCompanionUpgrade(state.world.companion.tier, state.vessel.inventory, state.world.insightBanked);
  return {
    ...state,
    world: {
      ...state.world,
      companion: { ...state.world.companion, tier: result.tier },
      insightBanked: result.insightBanked,
    },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
}
