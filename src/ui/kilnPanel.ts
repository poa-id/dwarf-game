import {
  attemptCharcoalBurn,
  applyCharcoalBurnResult,
  canAffordCharcoalBurn,
  CHARCOAL_RECIPE,
  attemptHearthsapRender,
  applyHearthsapResult,
  canAffordHearthsapRender,
  HEARTHSAP_RECIPE,
} from "../engine/kiln";
import { getMaterialAmount, MATERIALS } from "../engine/types";
import type { GameState } from "../engine/types";
import { xpPerkBonus } from "../engine/smelter";
import { yieldPerkBonus } from "../engine/hearth";
import { applyDwarfCountXpMultiplier, levelForXp, insightFromXp, archiveInsightBonus } from "../engine/xpCurve";

export function renderKilnPanel(
  state: GameState,
  container: HTMLElement,
  onBurn: () => void,
  onRenderHearthsap: () => void
): void {
  const { hearthkeeping } = state.vessel.skills;

  const meetsLevel = hearthkeeping.level >= CHARCOAL_RECIPE.requiredLevel;
  const affordable = canAffordCharcoalBurn(state.vessel.inventory);
  const canBurn = meetsLevel && affordable;
  const costText = `${CHARCOAL_RECIPE.woodCost} ${MATERIALS.wood?.name ?? "wood"}`;
  let charcoalStatus = costText;
  if (!meetsLevel) charcoalStatus = `Requires Hearthkeeping level ${CHARCOAL_RECIPE.requiredLevel}`;
  else if (!affordable) charcoalStatus = `Need: ${costText}`;

  const shroomsHeld = getMaterialAmount(state.vessel.inventory, "stoneshroom");
  const showHearthsap = shroomsHeld > 0 || hearthkeeping.level >= HEARTHSAP_RECIPE.requiredLevel;
  const meetsHearthsapLevel = hearthkeeping.level >= HEARTHSAP_RECIPE.requiredLevel;
  const affordableHearthsap = canAffordHearthsapRender(state.vessel.inventory);
  const canRenderSap = meetsHearthsapLevel && affordableHearthsap;
  let hearthsapStatus = `${HEARTHSAP_RECIPE.shroomCost} Stoneshroom → 1 Hearthsap`;
  if (!meetsHearthsapLevel) hearthsapStatus = `Requires Hearthkeeping level ${HEARTHSAP_RECIPE.requiredLevel}`;
  else if (!affordableHearthsap) hearthsapStatus = `Need ${HEARTHSAP_RECIPE.shroomCost} Stoneshroom (have ${shroomsHeld})`;

  const hearthsapRow = showHearthsap ? `
    <div class="recipe-row ${canRenderSap ? "" : "recipe-row-disabled"}" data-action="hearthsap">
      <div class="recipe-name">${HEARTHSAP_RECIPE.name}</div>
      <div class="recipe-status">${hearthsapStatus}</div>
      <div class="recipe-success-rate">${Math.round(HEARTHSAP_RECIPE.baseSuccessChance * 100)}% chance</div>
    </div>
  ` : "";

  container.innerHTML = `
    <h2>the charcoal kiln</h2>
    <div class="recipe-row ${canBurn ? "" : "recipe-row-disabled"}" data-action="burn">
      <div class="recipe-name">${CHARCOAL_RECIPE.name}</div>
      <div class="recipe-status">${charcoalStatus}</div>
      <div class="recipe-success-rate">${Math.round(CHARCOAL_RECIPE.baseSuccessChance * 100)}% chance</div>
    </div>
    ${hearthsapRow}
  `;

  container.querySelectorAll<HTMLDivElement>("[data-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      if (row.dataset.action === "burn") onBurn();
      else if (row.dataset.action === "hearthsap") onRenderHearthsap();
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
    yieldPerkBonus(state.world.trueMetalSpentOnYieldPerk) + state.world.rekindleMultiplier
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
    world: { ...state.world, insightBanked: state.world.insightBanked + insightFromXp(multipliedXp) * archiveInsightBonus(state.world.roomStates) },
    vessel: {
      ...state.vessel,
      inventory: newInventory,
      skills: { ...state.vessel.skills, hearthkeeping: newHearthkeeping },
    },
  };

  return { newState, success: result.success, leveledUp: newHearthkeeping.level > oldLevel };
}

export interface HearthsapOutcome {
  newState: GameState;
  success: boolean;
  leveledUp: boolean;
}

export function performRenderHearthsap(state: GameState): HearthsapOutcome {
  const result = attemptHearthsapRender(
    state.vessel.skills.hearthkeeping,
    state.vessel.inventory,
    Math.random(),
    yieldPerkBonus(state.world.trueMetalSpentOnYieldPerk) + state.world.rekindleMultiplier
  );
  const newInventory = applyHearthsapResult(state.vessel.inventory, result);
  const multipliedXp = applyDwarfCountXpMultiplier(result.xpGained, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk));
  const newXp = state.vessel.skills.hearthkeeping.xp + multipliedXp;
  const newSkill = { ...state.vessel.skills.hearthkeeping, level: levelForXp(newXp), xp: newXp };
  const newState: GameState = {
    ...state,
    world: { ...state.world, insightBanked: state.world.insightBanked + insightFromXp(multipliedXp) * archiveInsightBonus(state.world.roomStates) },
    vessel: { ...state.vessel, inventory: newInventory, skills: { ...state.vessel.skills, hearthkeeping: newSkill } },
  };
  return { newState, success: result.success, leveledUp: newSkill.level > state.vessel.skills.hearthkeeping.level };
}
