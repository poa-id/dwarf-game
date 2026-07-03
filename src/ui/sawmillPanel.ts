import {
  SAWMILL_BUILD_COST,
  SAWMILL_BUILD_INSIGHT_COST,
  canAffordSawmillBuild,
  applySawmillBuild,
  attemptSawPlanks,
  applySawPlanksResult,
  canAffordPlankSaw,
  PLANK_RECIPE,
} from "../engine/sawmill";
import { MATERIALS } from "../engine/types";
import type { GameState } from "../engine/types";
import { xpPerkBonus } from "../engine/smelter";
import { yieldPerkBonus } from "../engine/hearth";
import { applyDwarfCountXpMultiplier, levelForXp, insightFromXp, archiveInsightBonus } from "../engine/xpCurve";

/**
 * Renders the Sawmill's panel - two states depending on
 * WorldState.sawmillBuilt, same shape as smelterPanel.ts's build gate:
 *
 * 1. NOT BUILT: a single "Build the Sawmill" row (Insight + materials).
 * 2. BUILT: the repeatable Saw Planks action (Woodcraft-governed,
 *    real success-chance risk - mirrors the Kiln's charcoal burn, not
 *    the Smelter's always-succeeds purify).
 */
export function renderSawmillPanel(
  state: GameState,
  container: HTMLElement,
  onBuild: () => void,
  onSaw: (times?: number) => void
): void {
  const { sawmillBuilt, insightBanked } = state.world;

  if (!sawmillBuilt) {
    const affordable = canAffordSawmillBuild(state.vessel.inventory, insightBanked);
    const costParts = Object.entries(SAWMILL_BUILD_COST).map(
      ([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`
    );
    const costText = `${SAWMILL_BUILD_INSIGHT_COST} Insight, ${costParts.join(", ")}`;
    const statusText = affordable ? costText : `Need: ${costText}`;

    container.innerHTML = `
      <h2>the sawmill</h2>
      <div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-action="build-sawmill">
        <div class="recipe-name">Build the Sawmill</div>
        <div class="recipe-status">${statusText}</div>
      </div>
    `;
  } else {
    const { woodcraft } = state.vessel.skills;
    const meetsLevel = woodcraft.level >= PLANK_RECIPE.requiredLevel;
    const affordable = canAffordPlankSaw(state.vessel.inventory);
    const canSaw = meetsLevel && affordable;
    const costText = `${PLANK_RECIPE.woodCost} ${MATERIALS.wood?.name ?? "wood"}`;
    let status = costText;
    if (!meetsLevel) status = `Requires Woodcraft level ${PLANK_RECIPE.requiredLevel}`;
    else if (!affordable) status = `Need: ${costText}`;

    container.innerHTML = `
      <h2>the sawmill</h2>
      <div class="recipe-row ${canSaw ? "" : "recipe-row-disabled"}" data-action="saw">
        <div class="recipe-name">${PLANK_RECIPE.name}</div>
        <div class="recipe-status">${status}</div>
        <div class="recipe-success-rate">${Math.round(PLANK_RECIPE.baseSuccessChance * 100)}%</div>
      </div>
      ${canSaw ? '<div class="batch-bar"><button class="batch-btn" data-action="saw" data-times="5">×5</button><button class="batch-btn" data-action="saw" data-times="10">×10</button><button class="batch-btn" data-action="saw" data-times="50">×50</button></div>' : ""}
    `;
  }

  container.querySelectorAll<HTMLDivElement>("[data-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      if (row.dataset.action === "build-sawmill") onBuild();
      else if (row.dataset.action === "saw") onSaw();
    });
  });
  container.querySelectorAll<HTMLButtonElement>(".batch-btn[data-action]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const times = parseInt(btn.dataset.times ?? "1");
      if (btn.dataset.action === "saw") onSaw(times);
    });
  });
}

export function performSawmillBuild(state: GameState): GameState {
  if (state.world.sawmillBuilt) return state;
  if (!canAffordSawmillBuild(state.vessel.inventory, state.world.insightBanked)) return state;
  const result = applySawmillBuild(state.vessel.inventory, state.world.insightBanked);
  return {
    ...state,
    world: { ...state.world, sawmillBuilt: true, insightBanked: result.insightBanked },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
}

export interface SawmillOutcome {
  newState: GameState;
  success: boolean;
  leveledUp: boolean;
}

/** Applies one plank-sawing attempt - mirrors performCharcoalBurn's shape exactly. */
export function performSawPlanks(state: GameState): SawmillOutcome {
  const result = attemptSawPlanks(
    state.vessel.skills.woodcraft,
    state.vessel.inventory,
    Math.random(),
    yieldPerkBonus(state.world.trueMetalSpentOnYieldPerk) + state.world.rekindleMultiplier
  );
  const newInventory = applySawPlanksResult(state.vessel.inventory, result);

  const oldLevel = state.vessel.skills.woodcraft.level;
  const multipliedXp = applyDwarfCountXpMultiplier(result.xpGained, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk));
  const newXp = state.vessel.skills.woodcraft.xp + multipliedXp;
  const newWoodcraft = { ...state.vessel.skills.woodcraft, level: levelForXp(newXp), xp: newXp };

  const newState: GameState = {
    ...state,
    world: { ...state.world, insightBanked: state.world.insightBanked + insightFromXp(multipliedXp) * archiveInsightBonus(state.world.roomStates) },
    vessel: {
      ...state.vessel,
      inventory: newInventory,
      skills: { ...state.vessel.skills, woodcraft: newWoodcraft },
    },
  };

  return { newState, success: result.success, leveledUp: newWoodcraft.level > oldLevel };
}
