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
  MAX_ENGINE_OUTPUT_RANK,
  engineOutputMultiplier,
  engineOutputUpgradeCost,
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
  onUpgrade: (engineId: string) => void,
  onOutputUpgrade?: (engineId: string) => void,
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
      const outputRank = engineState.outputRank ?? 0;
      const spm = (tierDef.ingotsPerCycle / tierDef.cycleMs) * 60_000 * (state.world.turbineBuilt ? 3 : 1) * engineOutputMultiplier(outputRank);
      const fuelId = def.fuelMaterialId ?? "coal";
      const fuelBuffer = fuelId === "hearthsap" ? engineState.hearthsapBuffer : engineState.coalBuffer;

      container.insertAdjacentHTML("beforeend", `
        <div class="reserve-status"><strong>${def.name}</strong> T${tier} · ${tierDef.name}</div>
        <div class="reserve-status">${ingotName}: ${spm.toFixed(1)}/min · output ${engineState.ingotBuffer}/${engineState.ingotBufferMax}</div>
        <div class="reserve-status">Input: ${engineState.oreBuffer}/${engineState.oreBufferMax ?? 20} ore · ${fuelBuffer}/${engineState.coalBufferMax} ${MATERIALS[fuelId]?.name ?? fuelId}</div>
        ${outputRank < MAX_ENGINE_OUTPUT_RANK ? (() => {
          const cost = engineOutputUpgradeCost(def, outputRank);
          const affordable = canAffordCost(inv, cost);
          return `<div class="recipe-row ${affordable ? "" : "recipe-row-disabled"}" data-engine-output-upgrade="${def.id}">
            <div class="recipe-name">Tune Furnace — Rank ${outputRank + 1}</div>
            <div class="recipe-status">${affordable ? costText(cost) : `Need: ${costText(cost)}`} — +20% cycles/min</div>
          </div>`;
        })() : ""}
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
  container.querySelectorAll<HTMLElement>("[data-engine-upgrade]").forEach(el => {
    el.addEventListener("click", () => {
      if (!el.classList.contains("recipe-row-disabled")) onUpgrade(el.dataset.engineUpgrade!);
    });
  });
  container.querySelectorAll<HTMLElement>("[data-engine-output-upgrade]").forEach(el => {
    el.addEventListener("click", () => {
      if (!el.classList.contains("recipe-row-disabled")) onOutputUpgrade?.(el.dataset.engineOutputUpgrade!);
    });
  });
}

export function performUpgradeEngineOutput(state: GameState, engineId: string): GameState {
  const engine = state.world.smeltingEngines[engineId];
  const def = SMELTING_ENGINE_DEFINITIONS.find((entry) => entry.id === engineId);
  if (!engine || !def) return state;
  const rank = engine.outputRank ?? 0;
  if (rank >= MAX_ENGINE_OUTPUT_RANK) return state;
  const cost = engineOutputUpgradeCost(def, rank);
  if (!canAffordCost(state.vessel.inventory as Record<string, number>, cost)) return state;
  return {
    ...state,
    world: { ...state.world, smeltingEngines: { ...state.world.smeltingEngines, [engineId]: { ...engine, outputRank: rank + 1 } } },
    vessel: { ...state.vessel, inventory: deductMaterials(state.vessel.inventory, cost) },
  };
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
