/**
 * Smelting Engine panel — shown in the Forge context panel alongside
 * the existing smithing/tool panels. Shows engine status, ingot buffer,
 * build/upgrade actions.
 */

import type { GameState } from "../engine/types";
import { MATERIALS, deductMaterials, getMaterialAmount } from "../engine/types";
import {
  SMELTING_ENGINE_DEFINITIONS,
  createFreshEngineState,
  engineTierDef,
  type SmeltingEngineDef,
} from "../engine/smeltingEngine";

function canAffordCost(inventory: Record<string, number>, cost: Record<string, number>): boolean {
  return Object.entries(cost).every(([mat, amt]) => (getMaterialAmount(inventory, mat) as number) >= amt);
}

function costText(cost: Record<string, number>): string {
  return Object.entries(cost)
    .map(([m, a]) => `${a} ${MATERIALS[m]?.name ?? m}`)
    .join(", ") || "Free";
}

function isEngineUnlocked(def: SmeltingEngineDef, state: GameState): boolean {
  const w = state.world;
  if (def.id === "copper_engine") return w.forgeTier >= 1 && w.smelterBuilt;
  if (def.id === "iron_engine") return w.ironPurifyingUnlocked && w.smelterTier >= 1;
  if (def.id === "deepstone_engine") return (w.roomStates["deep_foundry"] ?? "ruined") !== "ruined";
  return false;
}

export function renderSmeltingEnginePanel(
  state: GameState,
  container: HTMLElement,
  onBuild: (engineId: string) => void,
  onCollect: (engineId: string) => void,
  onUpgrade: (engineId: string) => void
): void {
  const unlockedDefs = SMELTING_ENGINE_DEFINITIONS.filter(d => isEngineUnlocked(d, state));
  if (unlockedDefs.length === 0) return;

  // insertAdjacentHTML, NOT container.innerHTML += (2026-07-05 bugfix -
  // reported as "smelting ingots isn't working, clicking nor pressing
  // Enter does anything"). `container.innerHTML += x` is equivalent to
  // `container.innerHTML = container.innerHTML + x`: it destroys EVERY
  // existing DOM node in the container - including the Smithing
  // panel's recipe rows rendered just before this function runs in the
  // same forge context (see render.ts) - and rebuilds them fresh from
  // the re-serialized HTML string. The markup looks identical, so the
  // rows still LOOK right, but the freshly-created nodes have no
  // event listeners at all (listeners are runtime JS bindings, not
  // something that round-trips through innerHTML serialization). This
  // silently broke clicking (and Enter, which just calls .click() on
  // the highlighted node) on every row rendered before this section,
  // but only once a Smelting Engine was actually unlocked - the
  // isEngineUnlocked() check above returns nothing to render until
  // then, so the bug was invisible earlier in a playthrough.
  container.insertAdjacentHTML("beforeend", `<div style="border-top:1px solid #2a2a2a;margin:8px 0 4px;"></div>
  <div class="reserve-status" style="font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Smelting Engines</div>`);

  for (const def of unlockedDefs) {
    const engineState = state.world.smeltingEngines[def.id];
    const built = !!engineState;
    const inv = state.vessel.inventory as Record<string, number>;

    if (!built) {
      const affordable = canAffordCost(inv, def.buildCost);
      container.insertAdjacentHTML("beforeend", `
        <div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-engine-build="${def.id}">
          <div class="recipe-name">Build ${def.name}</div>
          <div class="recipe-status">${costText(def.buildCost)}</div>
        </div>`);
    } else {
      const tier = engineState.tier;
      const tierDef = engineTierDef(def, tier);
      const nextTier = def.tiers.find(t => t.tier === tier + 1);
      const ingotName = MATERIALS[def.ingotMaterialId]?.name ?? def.ingotMaterialId;
      const canCollect = engineState.ingotBuffer > 0;
      const spm = (tierDef.ingotsPerCycle / tierDef.cycleMs) * 60_000;

      container.insertAdjacentHTML("beforeend", `
        <div class="reserve-status"><strong>${def.name}</strong> T${tier} · ${tierDef.name}</div>
        <div class="reserve-status">${ingotName} buffer: ${engineState.ingotBuffer}/${engineState.ingotBufferMax} · ${spm.toFixed(1)}/min</div>
        ${canCollect ? `<div class="recipe-row" data-engine-collect="${def.id}">
          <div class="recipe-name">Collect ${engineState.ingotBuffer} ${ingotName}</div>
          <div class="recipe-status">Move to inventory</div>
        </div>` : ""}
        ${nextTier ? (() => {
          const affordable = canAffordCost(inv, nextTier.upgradeCost);
          return `<div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-engine-upgrade="${def.id}">
            <div class="recipe-name">Upgrade: ${nextTier.name}</div>
            <div class="recipe-status">${costText(nextTier.upgradeCost)} — ${(tierDef.ingotsPerCycle / tierDef.cycleMs * 60_000).toFixed(1)}→${(nextTier.ingotsPerCycle / nextTier.cycleMs * 60_000).toFixed(1)}/min</div>
          </div>`;
        })() : ""}
      `);
    }
  }

  // Wire up actions
  container.querySelectorAll<HTMLElement>("[data-engine-build]").forEach(el => {
    el.addEventListener("click", () => {
      if (!el.classList.contains("recipe-row-disabled")) onBuild(el.dataset.engineBuild!);
    });
  });
  container.querySelectorAll<HTMLElement>("[data-engine-collect]").forEach(el => {
    el.addEventListener("click", () => onCollect(el.dataset.engineCollect!));
  });
  container.querySelectorAll<HTMLElement>("[data-engine-upgrade]").forEach(el => {
    el.addEventListener("click", () => {
      if (!el.classList.contains("recipe-row-disabled")) onUpgrade(el.dataset.engineUpgrade!);
    });
  });
}

// ---------------------------------------------------------------------------
// Perform functions
// ---------------------------------------------------------------------------

export function performBuildEngine(state: GameState, engineId: string): GameState {
  const def = SMELTING_ENGINE_DEFINITIONS.find(d => d.id === engineId);
  if (!def) return state;
  if (state.world.smeltingEngines[engineId]) return state;
  if (!canAffordCost(state.vessel.inventory as Record<string, number>, def.buildCost)) return state;

  return {
    ...state,
    world: {
      ...state.world,
      smeltingEngines: { ...state.world.smeltingEngines, [engineId]: createFreshEngineState() },
    },
    vessel: { ...state.vessel, inventory: deductMaterials(state.vessel.inventory, def.buildCost) },
  };
}

export function performCollectEngine(state: GameState, engineId: string): GameState {
  const engineState = state.world.smeltingEngines[engineId];
  const def = SMELTING_ENGINE_DEFINITIONS.find(d => d.id === engineId);
  if (!engineState || !def || engineState.ingotBuffer === 0) return state;

  const newInventory = { ...state.vessel.inventory as Record<string, number> };
  newInventory[def.ingotMaterialId] = (newInventory[def.ingotMaterialId] ?? 0) + engineState.ingotBuffer;

  return {
    ...state,
    world: {
      ...state.world,
      smeltingEngines: {
        ...state.world.smeltingEngines,
        [engineId]: { ...engineState, ingotBuffer: 0 },
      },
    },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}

export function performUpgradeEngine(state: GameState, engineId: string): GameState {
  const engineState = state.world.smeltingEngines[engineId];
  const def = SMELTING_ENGINE_DEFINITIONS.find(d => d.id === engineId);
  if (!engineState || !def) return state;

  const nextTier = def.tiers.find(t => t.tier === engineState.tier + 1);
  if (!nextTier) return state;
  if (!canAffordCost(state.vessel.inventory as Record<string, number>, nextTier.upgradeCost)) return state;

  return {
    ...state,
    world: {
      ...state.world,
      smeltingEngines: {
        ...state.world.smeltingEngines,
        [engineId]: { ...engineState, tier: nextTier.tier },
      },
    },
    vessel: { ...state.vessel, inventory: deductMaterials(state.vessel.inventory, nextTier.upgradeCost) },
  };
}
