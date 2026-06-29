import {
  attemptCharcoalBurn,
  applyCharcoalBurnResult,
  canAffordCharcoalBurn,
  CHARCOAL_RECIPE,
} from "../engine/kiln";
import { MATERIALS } from "../engine/types";
import type { GameState } from "../engine/types";
import { xpPerkBonus } from "../engine/smelter";
import { yieldPerkBonus } from "../engine/hearth";
import { applyDwarfCountXpMultiplier, levelForXp, insightFromXp } from "../engine/xpCurve";

/**
 * Renders the Charcoal Kiln's single-action panel into a container.
 * Same pattern as renderSmithingPanel: render(state, container,
 * onAction) - pure rendering, no state owned here. Only one "recipe"
 * exists right now (wood -> charcoal), so this is a single row rather
 * than a list, but kept as its own panel/module rather than folded
 * into smithingPanel.ts since it's governed by Hearthkeeping, not
 * Smithing, and triggers off a different proximity check.
 */
export function renderKilnPanel(state: GameState, container: HTMLElement, onBurn: () => void): void {
  const { hearthkeeping } = state.vessel.skills;
  const meetsLevel = hearthkeeping.level >= CHARCOAL_RECIPE.requiredLevel;
  const affordable = canAffordCharcoalBurn(state.vessel.inventory);
  const canBurn = meetsLevel && affordable;

  const woodLabel = MATERIALS.wood?.name ?? "wood";
  const costText = `${CHARCOAL_RECIPE.woodCost} ${woodLabel}`;
  const successRateText = `${Math.round(CHARCOAL_RECIPE.baseSuccessChance * 100)}% chance`;

  let statusText = costText;
  if (!meetsLevel) statusText = `Requires Hearthkeeping level ${CHARCOAL_RECIPE.requiredLevel}`;
  else if (!affordable) statusText = `Need: ${costText}`;

  container.innerHTML = `
    <h2>the charcoal kiln</h2>
    <div class="recipe-row ${canBurn ? "" : "recipe-row-disabled"}" data-action="burn">
      <div class="recipe-name">${CHARCOAL_RECIPE.name}</div>
      <div class="recipe-status">${statusText}</div>
      <div class="recipe-success-rate">${successRateText}</div>
    </div>
  `;

  container.querySelectorAll<HTMLDivElement>(".recipe-row").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      onBurn();
    });
  });
}

export interface KilnOutcome {
  newState: GameState;
  success: boolean;
  leveledUp: boolean;
}

/** Applies a charcoal-burn attempt to state - mirrors performSmith's split between rendering and state mutation. */
export function performCharcoalBurn(state: GameState): KilnOutcome {
  const result = attemptCharcoalBurn(
    state.vessel.skills.hearthkeeping,
    state.vessel.inventory,
    Math.random(),
    yieldPerkBonus(state.world.trueMetalSpentOnYieldPerk)
  );
  const newInventory = applyCharcoalBurnResult(state.vessel.inventory, result);

  const oldLevel = state.vessel.skills.hearthkeeping.level;
  // See actions.ts's mining/woodcraft handlers for why this recomputes
  // level rather than trusting result.newLevel - the dwarfCount XP
  // multiplier is applied at this call-site layer.
  const multipliedXp = applyDwarfCountXpMultiplier(result.xpGained, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk));
  const newHearthkeepingXp = state.vessel.skills.hearthkeeping.xp + multipliedXp;
  const newHearthkeeping = {
    ...state.vessel.skills.hearthkeeping,
    level: levelForXp(newHearthkeepingXp),
    xp: newHearthkeepingXp,
  };

  const newState: GameState = {
    ...state,
    world: { ...state.world, insightBanked: state.world.insightBanked + insightFromXp(multipliedXp) },
    vessel: {
      ...state.vessel,
      inventory: newInventory,
      skills: { ...state.vessel.skills, hearthkeeping: newHearthkeeping },
    },
  };

  return { newState, success: result.success, leveledUp: newHearthkeeping.level > oldLevel };
}
