import {
  GEMCUTTING_BUILD_COST,
  GEMCUTTING_BUILD_INSIGHT_COST,
  canAffordGemcuttingBuild,
  applyGemcuttingBuild,
  nextGemcuttingTier,
  canAffordGemcuttingTier,
  totalCuttingSuccessBonus,
  CUT_BASE_SUCCESS_CHANCE,
  attemptCutGem,
  applyCutGemResult,
  nextTinkeringPerkTier,
  cutGemsNeededForNextPerkTier,
} from "../engine/gemcutting";
import { getMaterialAmount, MATERIALS } from "../engine/types";
import type { GameState, MaterialId } from "../engine/types";
import { levelForXp } from "../engine/xpCurve";

/**
 * Renders the Gemcutting station's panel - the same three-state
 * pattern as smelterPanel.ts (not built -> build prompt; built -> cut
 * gems + station tier upgrade; perk tree section), but two real
 * differences: (1) there are THREE rough gem types
 * (quartz/garnet/amethyst, see types.ts), each gets its own cutting
 * row when the player actually holds one - same discovery-gating
 * principle as everything else, no row for a gem you've never found;
 * (2) the governing skill is Tinkering, not Smithing.
 */
export function renderGemcuttingPanel(
  state: GameState,
  container: HTMLElement,
  onBuild: () => void,
  onCut: (roughMaterialId: MaterialId) => void,
  onUpgradeTier: () => void,
  onSpendCutGemOnPerk: () => void
): void {
  const { gemcuttingBuilt, gemcuttingTier, insightBanked, cutGemsSpentOnPerk } = state.world;

  let bodyHtml: string;

  if (!gemcuttingBuilt) {
    const affordable = canAffordGemcuttingBuild(state.vessel.inventory, insightBanked);
    const costParts = Object.entries(GEMCUTTING_BUILD_COST).map(
      ([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`
    );
    const costText = `${GEMCUTTING_BUILD_INSIGHT_COST} Insight, ${costParts.join(", ")}`;
    const statusText = affordable ? costText : `Need: ${costText}`;

    bodyHtml = `
      <div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-action="build-gemcutting">
        <div class="recipe-name">Build the Gemcutting Station</div>
        <div class="recipe-status">${statusText}</div>
      </div>
    `;
  } else {
    // One cutting row per rough gem type the player actually holds -
    // discovery-gated the same way as every other panel in this game:
    // no row for a gem type you've never found, rather than a
    // permanently-visible-but-disabled row for something you don't
    // have. Unlike the Smelter's single ingot type, there are three
    // real rough-gem materials here.
    const roughGemTypes: { id: MaterialId; label: string }[] = [
      { id: "rough_quartz", label: "Rough Quartz" },
      { id: "rough_garnet", label: "Rough Garnet" },
      { id: "rough_amethyst", label: "Rough Amethyst" },
    ];

    const totalSuccessBonus = totalCuttingSuccessBonus(gemcuttingTier, cutGemsSpentOnPerk);
    const successPercent = Math.round(Math.min(1, CUT_BASE_SUCCESS_CHANCE + totalSuccessBonus) * 100);

    const cutRows = roughGemTypes
      .filter((gem) => getMaterialAmount(state.vessel.inventory, gem.id) > 0)
      .map((gem) => {
        const held = getMaterialAmount(state.vessel.inventory, gem.id);
        return `
          <div class="recipe-row" data-action="cut" data-rough="${gem.id}">
            <div class="recipe-name">Cut ${gem.label}</div>
            <div class="recipe-status">Have: ${held}</div>
            <div class="recipe-success-rate">${successPercent}% cutting success</div>
          </div>
        `;
      })
      .join("");

    const cutSection = cutRows || `<p class="inventory-empty">No rough gems carried yet.</p>`;

    const nextTier = nextGemcuttingTier(gemcuttingTier);
    const tierRow =
      nextTier && canAffordGemcuttingTier(insightBanked, gemcuttingTier)
        ? `
          <div class="recipe-row" data-action="upgrade-gemcutting-tier">
            <div class="recipe-name">${nextTier.name}</div>
            <div class="recipe-status">${nextTier.insightCost} Insight - raises gem-drop chance and cutting success</div>
          </div>
        `
        : "";

    bodyHtml = cutSection + tierRow;
  }

  const nextPerkTier = nextTinkeringPerkTier(cutGemsSpentOnPerk);
  const cutGemsNeeded = cutGemsNeededForNextPerkTier(cutGemsSpentOnPerk);
  // Filters by the "cut_" ID prefix rather than MaterialCategory,
  // since rough AND cut gems share the same "gem" category (see
  // types.ts) - category alone can't distinguish "spendable cut gem"
  // from "rough gem waiting to be cut." Relies on the established
  // naming convention (cut_quartz/garnet/amethyst) staying consistent;
  // if that ever changes, this filter needs to change with it.
  const heldCutGemTotal = Object.keys(MATERIALS)
    .filter((id) => id.startsWith("cut_"))
    .reduce((sum, id) => sum + getMaterialAmount(state.vessel.inventory, id), 0);

  const perkSection =
    nextPerkTier && cutGemsNeeded !== null && heldCutGemTotal >= cutGemsNeeded
      ? `
        <h2>steadier hands</h2>
        <div class="recipe-row" data-action="spend-cut-gem-perk">
          <div class="recipe-name">Tier ${nextPerkTier.tier}: +${Math.round(nextPerkTier.dropChanceBonus * 100)}% gem-drop, +${Math.round(nextPerkTier.cuttingSuccessBonus * 100)}% cutting, permanently</div>
          <div class="recipe-status">Spend ${cutGemsNeeded} cut gem</div>
        </div>
      `
      : "";

  container.innerHTML = `
    <h2>the gemcutting station</h2>
    ${bodyHtml}
    ${perkSection}
  `;

  container.querySelectorAll<HTMLDivElement>("[data-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      const action = row.dataset.action;
      if (action === "build-gemcutting") onBuild();
      else if (action === "cut") onCut((row.dataset.rough as MaterialId) ?? "rough_quartz");
      else if (action === "upgrade-gemcutting-tier") onUpgradeTier();
      else if (action === "spend-cut-gem-perk") onSpendCutGemOnPerk();
    });
  });
}

export interface GemcuttingBuildOutcome {
  newState: GameState;
}

export function performGemcuttingBuild(state: GameState): GemcuttingBuildOutcome {
  if (!canAffordGemcuttingBuild(state.vessel.inventory, state.world.insightBanked)) {
    return { newState: state };
  }
  const result = applyGemcuttingBuild(state.vessel.inventory, state.world.insightBanked);
  return {
    newState: {
      ...state,
      world: { ...state.world, gemcuttingBuilt: true, insightBanked: result.insightBanked },
      vessel: { ...state.vessel, inventory: result.inventory },
    },
  };
}

export interface CutGemOutcome {
  newState: GameState;
  success: boolean;
  leveledUp: boolean;
}

export function performCutGem(state: GameState, roughMaterialId: MaterialId): CutGemOutcome {
  const result = attemptCutGem(
    roughMaterialId,
    state.vessel.skills.tinkering,
    state.vessel.inventory,
    state.world.gemcuttingTier,
    state.world.cutGemsSpentOnPerk,
    Math.random()
  );
  const newInventory = applyCutGemResult(state.vessel.inventory, result);

  const oldLevel = state.vessel.skills.tinkering.level;
  // Tinkering's XP is NOT run through the dwarfCount/yield-perk-style
  // global multiplier here - cutting's xpGained is already the
  // skill's baseline rate (see gemcutting.ts's CUTTING_BASE_XP), and
  // unlike Mining/Smithing/Hearthkeeping's established pattern, there
  // is no separate "apply the multiplier at the call site" step needed
  // for THIS skill's only action yet - revisit if/when
  // applyDwarfCountXpMultiplier's scope is deliberately extended to
  // Tinkering too (not yet decided).
  const newTinkeringXp = state.vessel.skills.tinkering.xp + result.xpGained;
  const newTinkering = {
    ...state.vessel.skills.tinkering,
    level: levelForXp(newTinkeringXp),
    xp: newTinkeringXp,
  };

  const newState: GameState = {
    ...state,
    vessel: {
      ...state.vessel,
      inventory: newInventory,
      skills: { ...state.vessel.skills, tinkering: newTinkering },
    },
  };

  return {
    newState,
    success: result.success,
    leveledUp: newTinkering.level > oldLevel,
  };
}

export function performGemcuttingTierUpgrade(state: GameState): GameState {
  const next = nextGemcuttingTier(state.world.gemcuttingTier);
  if (!next) return state;
  if (!canAffordGemcuttingTier(state.world.insightBanked, state.world.gemcuttingTier)) return state;

  return {
    ...state,
    world: {
      ...state.world,
      gemcuttingTier: next.tier,
      insightBanked: state.world.insightBanked - next.insightCost,
    },
  };
}

export function performSpendCutGemOnPerk(state: GameState): GameState {
  const needed = cutGemsNeededForNextPerkTier(state.world.cutGemsSpentOnPerk);
  if (needed === null || needed <= 0) return state;

  // Same "cut_" prefix convention as renderGemcuttingPanel's
  // heldCutGemTotal - see that comment for why category alone isn't enough.
  const cutGemIds = Object.keys(MATERIALS).filter((id) => id.startsWith("cut_"));
  let remaining = needed;
  let newInventory = { ...state.vessel.inventory };

  for (const id of cutGemIds) {
    if (remaining <= 0) break;
    const held = getMaterialAmount(newInventory, id);
    const spend = Math.min(held, remaining);
    if (spend > 0) {
      newInventory = { ...newInventory, [id]: held - spend };
      remaining -= spend;
    }
  }

  if (remaining > 0) return state;

  return {
    ...state,
    world: { ...state.world, cutGemsSpentOnPerk: state.world.cutGemsSpentOnPerk + needed },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}
