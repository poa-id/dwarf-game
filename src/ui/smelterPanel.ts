import {
  SMELTER_BUILD_COST,
  SMELTER_BUILD_INSIGHT_COST,
  canAffordSmelterBuild,
  applySmelterBuild,
  nextSmelterTier,
  canAffordSmelterTier,
  purifyTrueMetalChance,
  purifyIronTrueMetalChance,
  PURIFY_INGOT_COST,
  PURIFY_COAL_COST,
  IRON_PURIFYING_UNLOCK_INSIGHT_COST,
  nextIronSmelterTier,
  canAffordIronSmelterTier,
  attemptPurify,
  applyPurifyResult,
  nextXpPerkTier,
  trueMetalNeededForNextPerkTier,
  xpPerkBonus,
} from "../engine/smelter";
import { getMaterialAmount, MATERIALS } from "../engine/types";
import type { GameState, MaterialId } from "../engine/types";
import { applyDwarfCountXpMultiplier, levelForXp, insightFromXp } from "../engine/xpCurve";

/**
 * Renders the Smelter's panel - one of three distinct states depending
 * on WorldState.smelterBuilt:
 *
 * 1. NOT BUILT: a single "Build the Smelter" row (Insight + materials
 *    cost), same shape as a Hearth/Forge upgrade row but funded by
 *    BOTH Insight and materials together (unlike any existing
 *    upgrade, which is Insight-only) - see smelter.ts's
 *    canAffordSmelterBuild.
 * 2. BUILT: the repeatable Purify action (always succeeds at
 *    consuming ingots + XP; the real reward is the rare True-metal
 *    chance - see smelter.ts's top-level docstring for why this has
 *    no separate success/failure roll), plus the Smelter's own
 *    tier-upgrade row (raises the True-metal chance) when affordable.
 * 3. The Mountain's XP perk tree - shown whenever the player holds
 *    enough True-metals to afford the next tier, REGARDLESS of
 *    smelterBuilt - this is a Mountain-wide perk, not Smelter-room
 *    content, so it's not gated on having built the room.
 *
 * Same render(state, container, callbacks) pattern as every other
 * contextual panel - pure rendering, no state owned here.
 */
export function renderSmelterPanel(
  state: GameState,
  container: HTMLElement,
  onBuild: () => void,
  onPurify: (ingotMaterialId: MaterialId) => void,
  onUpgradeTier: () => void,
  onUnlockIronPurifying: () => void,
  onUpgradeIronTier: () => void,
  onSpendTrueMetalOnPerk: () => void
): void {
  const { smelterBuilt, smelterTier, insightBanked, trueMetalSpentOnXpPerk } = state.world;

  let bodyHtml: string;

  if (!smelterBuilt) {
    const affordable = canAffordSmelterBuild(state.vessel.inventory, insightBanked);
    const costParts = Object.entries(SMELTER_BUILD_COST).map(
      ([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`
    );
    const costText = `${SMELTER_BUILD_INSIGHT_COST} Insight, ${costParts.join(", ")}`;
    const statusText = affordable ? costText : `Need: ${costText}`;

    bodyHtml = `
      <div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-action="build-smelter">
        <div class="recipe-name">Build the Smelter</div>
        <div class="recipe-status">${statusText}</div>
      </div>
    `;
  } else {
    const { ironPurifyingUnlocked, ironSmelterTier } = state.world;

    // Copper purify row
    const copperHeld = getMaterialAmount(state.vessel.inventory, "copper_ingot");
    const copperCoalCost = PURIFY_COAL_COST["copper_ingot"] ?? 5;
    const coalHeld = getMaterialAmount(state.vessel.inventory, "coal");
    const canPurifyCopper = copperHeld >= PURIFY_INGOT_COST && coalHeld >= copperCoalCost;
    const copperDropChance = (purifyTrueMetalChance(smelterTier) * 100).toFixed(3);
    const copperStatus = canPurifyCopper
      ? `${PURIFY_INGOT_COST} Copper Ingot + ${copperCoalCost} Coal`
      : `Need: ${PURIFY_INGOT_COST} Copper Ingot + ${copperCoalCost} Coal`;

    const copperRow = `
      <div class="recipe-row ${canPurifyCopper ? "" : "recipe-row-disabled"}" data-action="purify" data-ingot="copper_ingot">
        <div class="recipe-name">Purify Copper Ingot</div>
        <div class="recipe-status">${copperStatus}</div>
        <div class="recipe-success-rate">${copperDropChance}% True Copper</div>
      </div>
    `;

    // Copper tier upgrade
    const nextCopperTier = nextSmelterTier(smelterTier);
    const copperTierRow =
      nextCopperTier && canAffordSmelterTier(insightBanked, smelterTier)
        ? `
          <div class="recipe-row" data-action="upgrade-smelter-tier">
            <div class="recipe-name">${nextCopperTier.name}</div>
            <div class="recipe-status">${nextCopperTier.insightCost} Insight — copper True-metal to ${(nextCopperTier.trueMetalChance * 100).toFixed(3)}%</div>
          </div>
        `
        : "";

    // Iron — unlock row if not yet unlocked and player has iron ingots
    const ironHeld = getMaterialAmount(state.vessel.inventory, "iron_ingot");
    const ironUnlockRow =
      !ironPurifyingUnlocked && ironHeld > 0 && insightBanked >= IRON_PURIFYING_UNLOCK_INSIGHT_COST
        ? `
          <div class="recipe-row" data-action="unlock-iron-purifying">
            <div class="recipe-name">Unlock Iron Purifying</div>
            <div class="recipe-status">${IRON_PURIFYING_UNLOCK_INSIGHT_COST} Insight — rarer than copper, costs more coal</div>
          </div>
        `
        : "";

    // Iron purify row (once unlocked)
    const ironCoalCost = PURIFY_COAL_COST["iron_ingot"] ?? 12;
    const canPurifyIron = ironPurifyingUnlocked && ironHeld >= PURIFY_INGOT_COST && coalHeld >= ironCoalCost;
    const ironDropChance = (purifyIronTrueMetalChance(ironSmelterTier) * 100).toFixed(3);
    const ironStatus = canPurifyIron
      ? `${PURIFY_INGOT_COST} Iron Ingot + ${ironCoalCost} Coal`
      : ironPurifyingUnlocked
        ? `Need: ${PURIFY_INGOT_COST} Iron Ingot + ${ironCoalCost} Coal`
        : "";

    const ironRow = ironPurifyingUnlocked
      ? `
        <div class="recipe-row ${canPurifyIron ? "" : "recipe-row-disabled"}" data-action="purify" data-ingot="iron_ingot">
          <div class="recipe-name">Purify Iron Ingot</div>
          <div class="recipe-status">${ironStatus}</div>
          <div class="recipe-success-rate">${ironDropChance}% True Iron</div>
        </div>
      `
      : "";

    // Iron tier upgrade
    const nextIronTier = nextIronSmelterTier(ironSmelterTier);
    const ironTierRow =
      ironPurifyingUnlocked && nextIronTier && canAffordIronSmelterTier(insightBanked, ironSmelterTier)
        ? `
          <div class="recipe-row" data-action="upgrade-iron-smelter-tier">
            <div class="recipe-name">${nextIronTier.name}</div>
            <div class="recipe-status">${nextIronTier.insightCost} Insight — iron True-metal to ${(nextIronTier.trueMetalChance * 100).toFixed(3)}%</div>
          </div>
        `
        : "";

    bodyHtml = copperRow + copperTierRow + ironUnlockRow + ironRow + ironTierRow;
  }

  const nextPerkTier = nextXpPerkTier(trueMetalSpentOnXpPerk);
  const trueMetalNeeded = trueMetalNeededForNextPerkTier(trueMetalSpentOnXpPerk);
  const heldTrueMetalTotal = Object.keys(MATERIALS)
    .filter((id) => MATERIALS[id]?.category === "true_metal")
    .reduce((sum, id) => sum + getMaterialAmount(state.vessel.inventory, id), 0);

  const perkSection =
    nextPerkTier && trueMetalNeeded !== null && heldTrueMetalTotal >= trueMetalNeeded
      ? `
        <h2>the mountain remembers</h2>
        <div class="recipe-row" data-action="spend-true-metal-perk">
          <div class="recipe-name">Tier ${nextPerkTier.tier}: +${Math.round(nextPerkTier.xpBonus * 100)}% all XP, permanently</div>
          <div class="recipe-status">Spend ${trueMetalNeeded} True-metal</div>
        </div>
      `
      : "";

  container.innerHTML = `
    <h2>the smelter</h2>
    ${bodyHtml}
    ${perkSection}
  `;

  container.querySelectorAll<HTMLDivElement>("[data-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      const action = row.dataset.action;
      if (action === "build-smelter") onBuild();
      else if (action === "purify") onPurify((row.dataset.ingot as MaterialId) ?? "copper_ingot");
      else if (action === "upgrade-smelter-tier") onUpgradeTier();
      else if (action === "unlock-iron-purifying") onUnlockIronPurifying();
      else if (action === "upgrade-iron-smelter-tier") onUpgradeIronTier();
      else if (action === "spend-true-metal-perk") onSpendTrueMetalOnPerk();
    });
  });
}

export interface SmelterBuildOutcome {
  newState: GameState;
}

export function performSmelterBuild(state: GameState): SmelterBuildOutcome {
  if (!canAffordSmelterBuild(state.vessel.inventory, state.world.insightBanked)) {
    return { newState: state };
  }
  const result = applySmelterBuild(state.vessel.inventory, state.world.insightBanked);
  return {
    newState: {
      ...state,
      world: { ...state.world, smelterBuilt: true, insightBanked: result.insightBanked },
      vessel: { ...state.vessel, inventory: result.inventory },
    },
  };
}

export interface PurifyOutcome {
  newState: GameState;
  trueMetalGained: MaterialId | null;
  leveledUp: boolean;
}

export function performPurify(state: GameState, ingotMaterialId: MaterialId): PurifyOutcome {
  const result = attemptPurify(
    ingotMaterialId,
    state.vessel.skills.smithing,
    state.vessel.inventory,
    state.world.smelterTier,
    Math.random(),
    state.world.ironSmelterTier
  );
  const newInventory = applyPurifyResult(state.vessel.inventory, result);

  const oldLevel = state.vessel.skills.smithing.level;
  const multipliedXp = applyDwarfCountXpMultiplier(
    result.xpGained,
    state.world.dwarfCount,
    xpPerkBonus(state.world.trueMetalSpentOnXpPerk)
  );
  const newSmithingXp = state.vessel.skills.smithing.xp + multipliedXp;
  const newSmithing = {
    ...state.vessel.skills.smithing,
    level: levelForXp(newSmithingXp),
    xp: newSmithingXp,
  };

  const newState: GameState = {
    ...state,
    world: { ...state.world, insightBanked: state.world.insightBanked + insightFromXp(multipliedXp) },
    vessel: {
      ...state.vessel,
      inventory: newInventory,
      skills: { ...state.vessel.skills, smithing: newSmithing },
    },
  };

  return {
    newState,
    trueMetalGained: result.trueMetalGained,
    leveledUp: newSmithing.level > oldLevel,
  };
}

export function performSmelterTierUpgrade(state: GameState): GameState {
  const next = nextSmelterTier(state.world.smelterTier);
  if (!next) return state;
  if (!canAffordSmelterTier(state.world.insightBanked, state.world.smelterTier)) return state;

  return {
    ...state,
    world: {
      ...state.world,
      smelterTier: next.tier,
      insightBanked: state.world.insightBanked - next.insightCost,
    },
  };
}

export function performUnlockIronPurifying(state: GameState): GameState {
  if (state.world.ironPurifyingUnlocked) return state;
  if (state.world.insightBanked < IRON_PURIFYING_UNLOCK_INSIGHT_COST) return state;
  return {
    ...state,
    world: {
      ...state.world,
      ironPurifyingUnlocked: true,
      insightBanked: state.world.insightBanked - IRON_PURIFYING_UNLOCK_INSIGHT_COST,
    },
  };
}

export function performIronSmelterTierUpgrade(state: GameState): GameState {
  const next = nextIronSmelterTier(state.world.ironSmelterTier);
  if (!next) return state;
  if (!canAffordIronSmelterTier(state.world.insightBanked, state.world.ironSmelterTier)) return state;

  return {
    ...state,
    world: {
      ...state.world,
      ironSmelterTier: next.tier,
      insightBanked: state.world.insightBanked - next.insightCost,
    },
  };
}

export function performSpendTrueMetalOnPerk(state: GameState): GameState {
  const needed = trueMetalNeededForNextPerkTier(state.world.trueMetalSpentOnXpPerk);
  if (needed === null || needed <= 0) return state;

  const trueMetalIds = Object.keys(MATERIALS).filter((id) => MATERIALS[id]?.category === "true_metal");
  let remaining = needed;
  let newInventory = { ...state.vessel.inventory };

  for (const id of trueMetalIds) {
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
    world: { ...state.world, trueMetalSpentOnXpPerk: state.world.trueMetalSpentOnXpPerk + needed },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}
