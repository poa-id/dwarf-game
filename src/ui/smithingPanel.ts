import {
  SMITH_RECIPES,
  attemptSmith,
  applySmithResult,
  chooseFuelForRecipe,
  TOOL_RECIPES,
  nextToolRecipe,
  attemptForgeTool,
  applyForgeToolResult,
  type SmithRecipe,
  type ToolRecipe,
} from "../engine/smithing";
import { canAffordMaterials, MATERIALS } from "../engine/types";
import type { GameState, ToolSlot } from "../engine/types";
import { xpPerkBonus } from "../engine/smelter";
import { yieldPerkBonus } from "../engine/hearth";
import { applyDwarfCountXpMultiplier, levelForXp } from "../engine/xpCurve";

/**
 * Renders the Smithing recipe list into a container. Pure rendering -
 * takes the current state and a callback for "the player picked this
 * recipe," doesn't own any state itself. This is the pattern every
 * contextual panel should follow: render(state, container, onAction).
 */
export function renderSmithingPanel(
  state: GameState,
  container: HTMLElement,
  onSmith: (recipe: SmithRecipe) => void,
  onForgeTool: (recipe: ToolRecipe) => void
): void {
  const { smithing } = state.vessel.skills;

  // Only render a row for recipes the player's Smithing level actually
  // qualifies for - per explicit direction (2026-06-23, playtesting
  // feedback): seeing a permanently-grayed-out "Iron Ingot - Requires
  // Smithing level 6" row before the player has any plausible way to
  // use it reads as "iron is already available" when it isn't. This
  // mirrors the same fix already applied to the Hearth's fuel rows
  // earlier this session (hide what's not yet relevant, rather than
  // show everything disabled). Unlike the Hearth's fix though, this is
  // deliberately level-gated, NOT holdings-gated - project owner's
  // explicit reasoning: seeing the recipe appear the moment Smithing
  // level is high enough (even with zero iron_ore held yet) is what
  // should prompt the player to go look for iron, rather than them
  // needing to stumble onto iron first before learning smelting it is
  // even possible.
  const rows = SMITH_RECIPES.filter((recipe) => smithing.level >= recipe.requiredLevel).map((recipe) => {
    // meetsLevel is no longer checked here - the .filter() above
    // already guarantees every recipe reaching this point qualifies.
    // Only affordability (materials held) can still disable a row.
    const fuelChoice = chooseFuelForRecipe(recipe, state.vessel.inventory);
    const affordable = canAffordMaterials(state.vessel.inventory, {
      [recipe.oreMaterialId]: recipe.oreCost,
      [fuelChoice]: recipe.fuelCost,
    });
    const canSmith = affordable;

    const oreLabel = MATERIALS[recipe.oreMaterialId]?.name ?? recipe.oreMaterialId;
    const fuelOptionsLabel = recipe.acceptedFuels
      .map((id) => MATERIALS[id]?.name ?? id)
      .join(" or ");
    const costText = `${recipe.oreCost} ${oreLabel}, ${recipe.fuelCost} ${fuelOptionsLabel}`;
    // Success rate, shown to the player per explicit direction
    // (2026-06-23: "stations with success rate should show it in the
    // UI") - the data already existed on every recipe, this was purely
    // a display gap. A separate line from cost, since "what this costs"
    // and "how likely it is to work" are different questions.
    const successRateText = `${Math.round(recipe.baseSuccessChance * 100)}% chance`;

    const statusText = affordable ? costText : `Need: ${costText}`;

    return `
      <div class="recipe-row ${canSmith ? "" : "recipe-row-disabled"}" data-recipe-id="${recipe.id}">
        <div class="recipe-name">${recipe.name}</div>
        <div class="recipe-status">${statusText}</div>
        <div class="recipe-success-rate">${successRateText}</div>
      </div>
    `;
  }).join("");

  // Tools - "metal + wood = tool" (see smithing.ts's TOOL_RECIPES). Only
  // ever shows the NEXT forgeable tier per slot (nextToolRecipe), never
  // a list of every tier - there's nothing to choose between, tiers are
  // strictly sequential and the better one always supersedes the old
  // one automatically once forged (see ToolsForgedState's doc comment).
  // A slot with no further recipe defined (nextToolRecipe returns null,
  // e.g. already at the highest built tier) simply doesn't render a row.
  const toolSlots: ToolSlot[] = ["pickaxe", "axe"];
  const toolRows = toolSlots
    .map((slot) => {
      const recipe = nextToolRecipe(slot, state.world.toolsForged);
      if (!recipe) return "";
      // Same level-gating fix as the ingot rows above (2026-06-23) -
      // don't render a tool recipe at all until Smithing level
      // actually qualifies, rather than showing it disabled.
      if (smithing.level < recipe.requiredLevel) return "";

      const fuelChoice = chooseFuelForRecipe(recipe, state.vessel.inventory);
      const affordable = canAffordMaterials(state.vessel.inventory, {
        [recipe.ingotMaterialId]: recipe.ingotCost,
        wood: recipe.woodCost,
        [fuelChoice]: recipe.fuelCost,
      });
      const canForge = affordable;

      const ingotLabel = MATERIALS[recipe.ingotMaterialId]?.name ?? recipe.ingotMaterialId;
      const fuelOptionsLabel = recipe.acceptedFuels.map((id) => MATERIALS[id]?.name ?? id).join(" or ");
      const costText = `${recipe.ingotCost} ${ingotLabel}, ${recipe.woodCost} Cave-Root Wood, ${recipe.fuelCost} ${fuelOptionsLabel}`;
      const successRateText = `${Math.round(recipe.baseSuccessChance * 100)}% chance`;

      const statusText = affordable ? costText : `Need: ${costText}`;

      return `
        <div class="recipe-row ${canForge ? "" : "recipe-row-disabled"}" data-tool-recipe-id="${recipe.id}">
          <div class="recipe-name">${recipe.name}</div>
          <div class="recipe-status">${statusText}</div>
          <div class="recipe-success-rate">${successRateText}</div>
        </div>
      `;
    })
    .join("");

  const toolsSection = toolRows ? `<h2>tools</h2>${toolRows}` : "";

  container.innerHTML = `
    <h2>the forge</h2>
    ${rows}
    ${toolsSection}
  `;

  container.querySelectorAll<HTMLDivElement>("[data-recipe-id]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      const recipe = SMITH_RECIPES.find((r) => r.id === row.dataset.recipeId);
      if (recipe) onSmith(recipe);
    });
  });

  container.querySelectorAll<HTMLDivElement>("[data-tool-recipe-id]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      const recipe = TOOL_RECIPES.find((r) => r.id === row.dataset.toolRecipeId);
      if (recipe) onForgeTool(recipe);
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
    chosenFuel,
    yieldPerkBonus(state.world.trueMetalSpentOnYieldPerk)
  );
  const newInventory = applySmithResult(state.vessel.inventory, result);

  const oldLevel = state.vessel.skills.smithing.level;
  // See actions.ts's mining/woodcraft handlers for why this recomputes
  // level rather than trusting result.newLevel - the dwarfCount XP
  // multiplier is applied at this call-site layer.
  const multipliedXp = applyDwarfCountXpMultiplier(result.xpGained, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk));
  const newSmithingXp = state.vessel.skills.smithing.xp + multipliedXp;
  const newSmithing = {
    ...state.vessel.skills.smithing,
    level: levelForXp(newSmithingXp),
    xp: newSmithingXp,
  };

  const newState: GameState = {
    ...state,
    vessel: {
      ...state.vessel,
      inventory: newInventory,
      skills: { ...state.vessel.skills, smithing: newSmithing },
    },
  };

  return { newState, success: result.success, leveledUp: newSmithing.level > oldLevel };
}

export interface ForgeToolOutcome {
  newState: GameState;
  success: boolean;
  leveledUp: boolean;
}

/** Applies a tool-forge attempt to state - mirrors performSmith's shape, but also updates world.toolsForged (World-persistent, survives rekindling) rather than just vessel inventory. */
export function performForgeTool(state: GameState, recipe: ToolRecipe): ForgeToolOutcome {
  const chosenFuel = chooseFuelForRecipe(recipe, state.vessel.inventory);
  const result = attemptForgeTool(
    recipe,
    state.vessel.skills.smithing,
    state.vessel.inventory,
    state.world.toolsForged,
    Math.random(),
    chosenFuel
  );
  const { inventory: newInventory, toolsForged: newToolsForged } = applyForgeToolResult(
    state.vessel.inventory,
    state.world.toolsForged,
    result
  );

  const oldLevel = state.vessel.skills.smithing.level;
  const multipliedXp = applyDwarfCountXpMultiplier(result.xpGained, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk));
  const newSmithingXp = state.vessel.skills.smithing.xp + multipliedXp;
  const newSmithing = {
    ...state.vessel.skills.smithing,
    level: levelForXp(newSmithingXp),
    xp: newSmithingXp,
  };

  const newState: GameState = {
    ...state,
    world: { ...state.world, toolsForged: newToolsForged },
    vessel: {
      ...state.vessel,
      inventory: newInventory,
      skills: { ...state.vessel.skills, smithing: newSmithing },
    },
  };

  return { newState, success: result.success, leveledUp: newSmithing.level > oldLevel };
}
