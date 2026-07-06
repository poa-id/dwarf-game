import {
  TURBINE_BUILD_COST,
  TURBINE_BUILD_INSIGHT_COST,
  TURBINE_REQUIRED_SHAFT_DEPTH,
  TURBINE_SMELT_SPEED_MULTIPLIER,
  canAffordTurbineBuild,
  applyTurbineBuild,
} from "../engine/turbine";
import { MATERIALS } from "../engine/types";
import type { GameState } from "../engine/types";

/**
 * Renders the Turbine's panel - two states depending on
 * WorldState.turbineBuilt:
 *
 * 1. NOT BUILT: a single "Build the Turbine" row, disabled and
 *    explaining the Mine Shaft depth requirement if that's not met yet
 *    (same "gate the row, don't hide it" pattern as other depth/tier
 *    gated content elsewhere).
 * 2. BUILT: no repeatable action at all - unlike the Sawmill/Kiln,
 *    the Turbine is a passive always-on multiplier (Smelting Engine
 *    speed + Narag-Bund haul speed), so this is just a status readout.
 */
export function renderTurbinePanel(state: GameState, container: HTMLElement, onBuild: () => void): void {
  const { turbineBuilt, insightBanked, mineshaftDepth } = state.world;

  if (!turbineBuilt) {
    const meetsDepth = mineshaftDepth >= TURBINE_REQUIRED_SHAFT_DEPTH;
    const affordable = meetsDepth && canAffordTurbineBuild(state.vessel.inventory, insightBanked, mineshaftDepth);
    const costParts = Object.entries(TURBINE_BUILD_COST).map(
      ([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`
    );
    const costText = `${TURBINE_BUILD_INSIGHT_COST} Insight, ${costParts.join(", ")}`;
    const statusText = !meetsDepth
      ? `Requires Mine Shaft depth ${TURBINE_REQUIRED_SHAFT_DEPTH}`
      : affordable
        ? costText
        : `Need: ${costText}`;

    container.innerHTML = `
      <h2>the turbine</h2>
      <p class="reserve-status">Bellows for the Forge. Superheats the whole smelting operation.</p>
      <div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-action="build-turbine">
        <div class="recipe-name">Build the Turbine</div>
        <div class="recipe-status">${statusText}</div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <h2>the turbine</h2>
      <p class="reserve-status">Online — Smelting Engines run ${TURBINE_SMELT_SPEED_MULTIPLIER}x faster.</p>
      <p class="reserve-status">Speeds up the Forge, not Narag-Bund - he has his own hauling upgrades now.</p>
    `;
  }

  container.querySelectorAll<HTMLDivElement>(".recipe-row[data-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      if (row.dataset.action === "build-turbine") onBuild();
    });
  });
}

export function performTurbineBuild(state: GameState): GameState {
  if (state.world.turbineBuilt) return state;
  if (!canAffordTurbineBuild(state.vessel.inventory, state.world.insightBanked, state.world.mineshaftDepth)) return state;
  const result = applyTurbineBuild(state.vessel.inventory, state.world.insightBanked);
  return {
    ...state,
    world: { ...state.world, turbineBuilt: true, insightBanked: result.insightBanked },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
}
