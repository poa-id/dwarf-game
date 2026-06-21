import {
  HEARTH_FUEL_MATERIALS,
  stokeFireDirectly,
  stokeReserve,
  nextHearthUpgrade,
  canAffordHearthUpgrade,
} from "../engine/hearth";
import { getMaterialAmount, MATERIALS } from "../engine/types";
import type { GameState, MaterialId } from "../engine/types";

const STOKE_AMOUNT = 1; // fixed burst size for now - see DESIGN.md's x1/x5/x10/MAX open item for the eventual bulk-action upgrade

export type StokeTarget = "fire" | "reserve";

export function renderHearthPanel(
  state: GameState,
  container: HTMLElement,
  onStoke: (materialId: MaterialId, target: StokeTarget) => void,
  onUpgrade: () => void
): void {
  const fuelRows = HEARTH_FUEL_MATERIALS.map((materialId) => {
    const held = getMaterialAmount(state.vessel.inventory, materialId);
    const label = MATERIALS[materialId]?.name ?? materialId;
    const canStoke = held >= STOKE_AMOUNT;
    const disabledClass = canStoke ? "" : "recipe-row-disabled";
    return `
      <div class="recipe-row ${disabledClass}" data-stoke-material="${materialId}" data-stoke-target="fire">
        <div class="recipe-name">Feed the fire: ${label}</div>
        <div class="recipe-status">Have: ${held}</div>
      </div>
      <div class="recipe-row ${disabledClass}" data-stoke-material="${materialId}" data-stoke-target="reserve">
        <div class="recipe-name">Bank in reserve: ${label}</div>
        <div class="recipe-status">Have: ${held}</div>
      </div>
    `;
  }).join("");

  const reserveEntries = Object.entries(state.world.fuelReserve).filter(([, amt]) => (amt ?? 0) > 0);
  const reserveText =
    reserveEntries.length === 0
      ? "Empty."
      : reserveEntries
          .map(([id, amt]) => `${MATERIALS[id]?.name ?? id}: ${amt}`)
          .join(", ");

  const upgrade = nextHearthUpgrade(state.world.hearthTier);
  const upgradeRow = upgrade
    ? (() => {
        const affordable = canAffordHearthUpgrade(state.world.insightBanked, state.world.hearthTier);
        return `
          <div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-hearth-upgrade="true">
            <div class="recipe-name">${upgrade.name}</div>
            <div class="recipe-status">${upgrade.description} (${upgrade.insightCost} Insight)</div>
          </div>
        `;
      })()
    : `<div class="recipe-row recipe-row-disabled"><div class="recipe-status">The hearth has no further upgrades yet.</div></div>`;

  container.innerHTML = `
    <h2>the hearth</h2>
    ${fuelRows}
    <p class="reserve-status">Reserve: ${reserveText}</p>
    <h2>upgrade</h2>
    ${upgradeRow}
  `;

  container.querySelectorAll<HTMLDivElement>("[data-stoke-material]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      const materialId = row.dataset.stokeMaterial as MaterialId;
      const target = row.dataset.stokeTarget as StokeTarget;
      onStoke(materialId, target);
    });
  });

  const upgradeEl = container.querySelector<HTMLDivElement>("[data-hearth-upgrade]");
  if (upgradeEl && !upgradeEl.classList.contains("recipe-row-disabled")) {
    upgradeEl.addEventListener("click", onUpgrade);
  }
}

export interface StokeOutcome {
  newState: GameState;
  fuelAdded: number;
  colorStageIncreased: boolean;
}

export function performStoke(state: GameState, materialId: MaterialId, target: StokeTarget): StokeOutcome {
  if (target === "fire") {
    const result = stokeFireDirectly(state.world.hearth, state.vessel.inventory, materialId, STOKE_AMOUNT, Date.now());
    const newState: GameState = {
      ...state,
      world: { ...state.world, hearth: result.hearth },
      vessel: { ...state.vessel, inventory: result.inventory },
    };
    return { newState, fuelAdded: result.fuelAdded, colorStageIncreased: result.colorStageIncreased };
  }

  const result = stokeReserve(state.vessel.inventory, state.world.fuelReserve, materialId, STOKE_AMOUNT);
  const newState: GameState = {
    ...state,
    world: { ...state.world, fuelReserve: result.fuelReserve },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
  return { newState, fuelAdded: 0, colorStageIncreased: false };
}

export function performHearthUpgrade(state: GameState): GameState {
  const upgrade = nextHearthUpgrade(state.world.hearthTier);
  if (!upgrade) return state;
  if (!canAffordHearthUpgrade(state.world.insightBanked, state.world.hearthTier)) return state;

  return {
    ...state,
    world: {
      ...state.world,
      hearthTier: upgrade.tier,
      insightBanked: state.world.insightBanked - upgrade.insightCost,
      // Tier 1 specifically is the moment Narag-Bund is befriended -
      // every tier beyond that is a further Hearth upgrade, not a new
      // companion, so this only flips true once and stays true.
      companion:
        upgrade.tier === 1
          ? { ...state.world.companion, befriended: true }
          : state.world.companion,
    },
  };
}
