import {
  SMITH_RECIPES,
  attemptSmith,
  applySmithResult,
  chooseFuelForRecipe,
  type SmithRecipe,
} from "../engine/smithing";
import { canAffordMaterials, MATERIALS } from "../engine/types";
import type { GameState } from "../engine/types";

/**
 * Renders the Smithing recipe list into a container. Pure rendering -
 * takes the current state and a callback for "the player picked this
 * recipe," doesn't own any state itself. This is the pattern every
 * contextual panel should follow: render(state, container, onAction).
 */
export function renderSmithingPanel(
  state: GameState,
  container: HTMLElement,
  onSmith: (recipe: SmithRecipe) => void
): void {
  const { smithing } = state.vessel.skills;

  const rows = SMITH_RECIPES.map((recipe) => {
    const meetsLevel = smithing.level >= recipe.requiredLevel;
    const fuelChoice = chooseFuelForRecipe(recipe, state.vessel.inventory);
    const affordable = canAffordMaterials(state.vessel.inventory, {
      [recipe.oreMaterialId]: recipe.oreCost,
      [fuelChoice]: recipe.fuelCost,
    });
    const canSmith = meetsLevel && affordable;

    const oreLabel = MATERIALS[recipe.oreMaterialId]?.name ?? recipe.oreMaterialId;
    const fuelOptionsLabel = recipe.acceptedFuels
      .map((id) => MATERIALS[id]?.name ?? id)
      .join(" or ");
    const costText = `${recipe.oreCost} ${oreLabel}, ${recipe.fuelCost} ${fuelOptionsLabel}`;

    let statusText = costText;
    if (!meetsLevel) statusText = `Requires Smithing level ${recipe.requiredLevel}`;
    else if (!affordable) statusText = `Need: ${costText}`;

    return `
      <div class="recipe-row ${canSmith ? "" : "recipe-row-disabled"}" data-recipe-id="${recipe.id}">
        <div class="recipe-name">${recipe.name}</div>
        <div class="recipe-status">${statusText}</div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <h2>the forge</h2>
    ${rows}
  `;

  container.querySelectorAll<HTMLDivElement>(".recipe-row").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      const recipe = SMITH_RECIPES.find((r) => r.id === row.dataset.recipeId);
      if (recipe) onSmith(recipe);
    });
  });
}

export interface SmithOutcome {
  newState: GameState;
  success: boolean;
  leveledUp: boolean;
}

/** Applies a smith attempt to state - the actual game-state-mutating logic, separate from rendering above. */
export function performSmith(state: GameState, recipe: SmithRecipe): SmithOutcome {
  const chosenFuel = chooseFuelForRecipe(recipe, state.vessel.inventory);
  const result = attemptSmith(
    recipe,
    state.vessel.skills.smithing,
    state.vessel.inventory,
    Math.random(),
    chosenFuel
  );
  const newInventory = applySmithResult(state.vessel.inventory, result);

  const oldLevel = state.vessel.skills.smithing.level;
  const newSmithing = {
    ...state.vessel.skills.smithing,
    level: result.newLevel,
    xp: state.vessel.skills.smithing.xp + result.xpGained,
  };

  const newState: GameState = {
    ...state,
    vessel: {
      ...state.vessel,
      inventory: newInventory,
      skills: { ...state.vessel.skills, smithing: newSmithing },
    },
  };

  return { newState, success: result.success, leveledUp: result.newLevel > oldLevel };
}
