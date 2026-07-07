import {
  harvesterDefinitionByNodeId,
  harvesterTierDefinition,
  nextHarvesterTier,
  canAffordBuildHarvester,
  canAffordUpgradeHarvester,
  createFreshHarvesterState,
  refuelHarvester,
  collectHarvesterWood,
  HARVESTER_COAL_BUFFER_MAX,
  HARVESTER_WOOD_BUFFER_MAX,
  type HarvesterState,
} from "../engine/harvester";
import { getMaterialAmount, MATERIALS, deductMaterials } from "../engine/types";
import type { GameState } from "../engine/types";

/**
 * Renders the Wood Harvester's contextual panel. Mirrors drillPanel.ts
 * closely on purpose - same three states (not built / running /
 * stopped), same refuel/collect/upgrade row shape. Currently just one
 * harvester (root_harvester, on the Garden Room's wood node).
 */
export function renderHarvesterPanel(
  state: GameState,
  nodeId: string,
  container: HTMLElement,
  onBuild: () => void,
  onRefuel: () => void,
  onCollect: () => void,
  onUpgrade: () => void
): void {
  const def = harvesterDefinitionByNodeId(nodeId);
  if (!def) return;

  const harvesterState: HarvesterState | undefined = state.world.harvesters[nodeId];

  let html = "";

  if (!harvesterState) {
    const canBuild = canAffordBuildHarvester(state.vessel.inventory, def);
    const costParts = Object.entries(def.buildCost)
      .map(([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`)
      .join(", ");

    html = `
      <h2>${def.name}</h2>
      <div class="recipe-row ${canBuild ? "" : "recipe-row-disabled"}" data-harvester-action="build">
        <div class="recipe-name">Build ${def.name}</div>
        <div class="recipe-status">${canBuild ? costParts : `Need: ${costParts}`}</div>
      </div>
    `;
  } else {
    const tierDef = harvesterTierDefinition(def, harvesterState.tier);
    const woodPct = Math.round((harvesterState.woodBuffer / HARVESTER_WOOD_BUFFER_MAX) * 100);
    const cyclesSec = tierDef.cycleMs / 1000;

    const isRunning = harvesterState.coalBuffer >= def.coalPerCycle &&
                      harvesterState.woodBuffer < HARVESTER_WOOD_BUFFER_MAX;
    const statusLine = isRunning
      ? `Running — ${tierDef.woodPerCycle} wood every ${cyclesSec}s`
      : harvesterState.coalBuffer < def.coalPerCycle
        ? "Stopped — out of coal"
        : "Stopped — wood buffer full";

    const coalHeld = getMaterialAmount(state.vessel.inventory, "coal");
    const coalSpace = HARVESTER_COAL_BUFFER_MAX - harvesterState.coalBuffer;
    const canRefuel = coalHeld > 0 && coalSpace > 0;
    const refuelRow = canRefuel
      ? `<div class="recipe-row" data-harvester-action="refuel">
           <div class="recipe-name">Refuel</div>
           <div class="recipe-status">Add coal (${harvesterState.coalBuffer}/${HARVESTER_COAL_BUFFER_MAX})</div>
         </div>`
      : `<div class="recipe-row recipe-row-disabled">
           <div class="recipe-name">Refuel</div>
           <div class="recipe-status">${harvesterState.coalBuffer}/${HARVESTER_COAL_BUFFER_MAX} coal${coalHeld === 0 ? " — carry coal to refuel" : " — buffer full"}</div>
         </div>`;

    // Manual collect - a fallback before the harvest companion is
    // befriended (mirrors the drill's Collect row; once he's hauling
    // automatically this becomes less necessary but still works).
    const canCollect = harvesterState.woodBuffer > 0;
    const collectRow = canCollect
      ? `<div class="recipe-row" data-harvester-action="collect">
           <div class="recipe-name">Collect wood</div>
           <div class="recipe-status">${harvesterState.woodBuffer} wood ready (${woodPct}% full)</div>
         </div>`
      : "";

    const nextTier = nextHarvesterTier(def, harvesterState.tier);
    const canUpgrade = nextTier !== null && canAffordUpgradeHarvester(state.vessel.inventory, def, harvesterState.tier);
    const upgradeRow = nextTier && canUpgrade
      ? `<div class="recipe-row" data-harvester-action="upgrade">
           <div class="recipe-name">Upgrade: ${nextTier.name}</div>
           <div class="recipe-status">${Object.entries(nextTier.upgradeCost).map(([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`).join(", ")} — ${nextTier.cycleMs / 1000}s cycle, ${nextTier.woodPerCycle}/cycle</div>
         </div>`
      : "";

    html = `
      <h2>${def.name} — Tier ${harvesterState.tier}: ${tierDef.name}</h2>
      <p class="reserve-status">${statusLine}</p>
      <p class="reserve-status">Coal: ${harvesterState.coalBuffer}/${harvesterState.coalBufferMax ?? HARVESTER_COAL_BUFFER_MAX} &nbsp;|&nbsp; Wood: ${harvesterState.woodBuffer}/${harvesterState.woodBufferMax ?? HARVESTER_WOOD_BUFFER_MAX}</p>
      ${refuelRow}
      ${collectRow}
      ${upgradeRow}
    `;
  }

  const section = document.createElement("div");
  section.innerHTML = html;
  container.appendChild(section);

  section.querySelectorAll<HTMLDivElement>("[data-harvester-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      const action = row.dataset.harvesterAction;
      if (action === "build") onBuild();
      else if (action === "refuel") onRefuel();
      else if (action === "collect") onCollect();
      else if (action === "upgrade") onUpgrade();
    });
  });
}

// ---------------------------------------------------------------------------
// Perform functions
// ---------------------------------------------------------------------------

export function performBuildHarvester(state: GameState, nodeId: string): GameState {
  const def = harvesterDefinitionByNodeId(nodeId);
  if (!def) return state;
  if (state.world.harvesters[nodeId]) return state;
  if (!canAffordBuildHarvester(state.vessel.inventory, def)) return state;

  const newInventory = deductMaterials(state.vessel.inventory, def.buildCost);
  const harvesterState = createFreshHarvesterState();

  return {
    ...state,
    world: {
      ...state.world,
      harvesters: { ...state.world.harvesters, [nodeId]: harvesterState },
    },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}

export function performRefuelHarvester(state: GameState, nodeId: string): GameState {
  const harvesterState = state.world.harvesters[nodeId];
  if (!harvesterState) return state;

  const result = refuelHarvester(state.vessel.inventory, harvesterState);
  if (result.coalAdded === 0) return state;

  const updatedHarvester = result.harvester.lastCycleAt === 0
    ? { ...result.harvester, lastCycleAt: Date.now() }
    : result.harvester;

  return {
    ...state,
    world: { ...state.world, harvesters: { ...state.world.harvesters, [nodeId]: updatedHarvester } },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
}

export function performCollectHarvesterWood(state: GameState, nodeId: string): GameState {
  const harvesterState = state.world.harvesters[nodeId];
  if (!harvesterState) return state;

  const result = collectHarvesterWood(state.vessel.inventory, harvesterState);
  if (result.woodCollected === 0) return state;

  return {
    ...state,
    world: { ...state.world, harvesters: { ...state.world.harvesters, [nodeId]: result.harvester } },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
}

export function performUpgradeHarvester(state: GameState, nodeId: string): GameState {
  const harvesterState = state.world.harvesters[nodeId];
  const def = harvesterDefinitionByNodeId(nodeId);
  if (!harvesterState || !def) return state;
  if (!canAffordUpgradeHarvester(state.vessel.inventory, def, harvesterState.tier)) return state;

  const nextTier = nextHarvesterTier(def, harvesterState.tier);
  if (!nextTier) return state;

  const newInventory = deductMaterials(state.vessel.inventory, nextTier.upgradeCost);

  return {
    ...state,
    world: {
      ...state.world,
      harvesters: { ...state.world.harvesters, [nodeId]: { ...harvesterState, tier: nextTier.tier } },
    },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}
