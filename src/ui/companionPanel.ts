import {
  companionHaulTierDef,
  nextCompanionHaulTier,
  canAffordCompanionUpgrade,
  applyCompanionUpgrade,
} from "../engine/companion";
import { nextHaulMaterial, secondsUntilNextHaul } from "../engine/hearth";
import { MATERIALS } from "../engine/types";
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
export function renderCompanionPanel(state: GameState, container: HTMLElement, onUpgrade: () => void): void {
  const world = state.world;
  const currentTier = companionHaulTierDef(world.companion.tier);
  const nextTier = nextCompanionHaulTier(world.companion.tier);

  const haulTarget = nextHaulMaterial(state.vessel.inventory);
  const haulLabel = haulTarget ? (MATERIALS[haulTarget]?.name ?? haulTarget) : null;
  const secsLeft = Math.ceil(secondsUntilNextHaul(world.companion.lastHaulAt, Date.now()));
  const haulStatus = haulLabel
    ? `Hauling ${haulLabel} to the reserve in ~${secsLeft}s`
    : "Nothing to haul — carry some fuel";
  const drillStatus = world.hearthTier >= 2
    ? `Hauling coal to drills (Hearth tier ${world.hearthTier})`
    : "Will haul coal to drills at Hearth tier 2";

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

  container.innerHTML = `
    <h2>Narag-Bund</h2>
    <p class="reserve-status">Coal-beetle. Black-head. He stays.</p>
    <p class="reserve-status" style="color:#c87820;">${haulStatus}</p>
    <p class="reserve-status">${drillStatus}</p>
    <p class="reserve-status" style="font-size:0.68em;opacity:0.55;">${currentTier.name} (tier ${currentTier.tier}) · haul every ${(currentTier.haulIntervalMs / 1000).toFixed(1)}s · ${currentTier.haulAmountPerTrip}/trip · Next: ~${secsLeft}s</p>
    ${upgradeRowHtml}
  `;

  container.querySelectorAll<HTMLDivElement>(".recipe-row[data-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      if (row.dataset.action === "upgrade-companion") onUpgrade();
    });
  });
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
