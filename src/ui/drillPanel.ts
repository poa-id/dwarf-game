import {
  drillDefinitionByVeinId,
  drillTierDefinition,
  nextDrillTier,
  canAffordBuildDrill,
  canAffordUpgradeDrill,
  createFreshDrillState,
  refuelDrill,
  collectDrillOre,
  nextBufferUpgrade,
  DRILL_COAL_BUFFER_MAX,
  DRILL_ORE_BUFFER_MAX,
  type DrillState,
} from "../engine/drill";
import { getMaterialAmount, MATERIALS, deductMaterials } from "../engine/types";
import type { GameState } from "../engine/types";

/**
 * Renders the drill section appended to the ore vein's contextual
 * panel. Shown when the player is near a vein that has a drill
 * definition (currently only mine_copper). Three states:
 *
 * 1. No drill built — show build button if affordable
 * 2. Drill built, running — show status, refuel/collect if needed
 * 3. Drill built, stopped — show stopped reason + action
 */
export function renderDrillSection(
  state: GameState,
  veinId: string,
  container: HTMLElement,
  onBuild: () => void,
  onRefuel: () => void,
  onCollect: () => void,
  onUpgrade: () => void,
  onBufferUpgrade?: () => void
): void {
  const def = drillDefinitionByVeinId(veinId);
  if (!def) return; // no drill for this vein type yet

  const drillState: DrillState | undefined = state.world.drills[veinId];

  let html = "";

  if (!drillState) {
    // Not built
    const canBuild = canAffordBuildDrill(def, state.vessel.inventory);
    const costParts = Object.entries(def.buildCost)
      .map(([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`)
      .join(", ");

    html = `
      <h2>${def.name}</h2>
      <div class="recipe-row ${canBuild ? "" : "recipe-row-disabled"}" data-drill-action="build">
        <div class="recipe-name">Build ${def.name}</div>
        <div class="recipe-status">${canBuild ? costParts : `Need: ${costParts}`}</div>
      </div>
    `;
  } else {
    const tierDef = drillTierDefinition(def, drillState.tier);
    const orePct = Math.round((drillState.oreBuffer / DRILL_ORE_BUFFER_MAX) * 100);
    const cyclesSec = tierDef.cycleMs / 1000;

    const isRunning = drillState.coalBuffer >= def.coalPerCycle &&
                      drillState.oreBuffer < DRILL_ORE_BUFFER_MAX;
    const statusLine = isRunning
      ? `Running — ${tierDef.orePerCycle} ore every ${cyclesSec}s`
      : drillState.coalBuffer < def.coalPerCycle
        ? "Stopped — out of coal"
        : "Stopped — ore buffer full";

    // Refuel row
    const coalHeld = getMaterialAmount(state.vessel.inventory, "coal");
    const coalSpace = DRILL_COAL_BUFFER_MAX - drillState.coalBuffer;
    const canRefuel = coalHeld > 0 && coalSpace > 0;
    const refuelRow = canRefuel
      ? `<div class="recipe-row" data-drill-action="refuel">
           <div class="recipe-name">Refuel</div>
           <div class="recipe-status">Add coal (${drillState.coalBuffer}/${DRILL_COAL_BUFFER_MAX})</div>
         </div>`
      : `<div class="recipe-row recipe-row-disabled">
           <div class="recipe-name">Refuel</div>
           <div class="recipe-status">${drillState.coalBuffer}/${DRILL_COAL_BUFFER_MAX} coal${coalHeld === 0 ? " — carry coal to refuel" : " — buffer full"}</div>
         </div>`;

    // Collect row
    const canCollect = drillState.oreBuffer > 0;
    const oreName = MATERIALS[def.oreMaterialId]?.name ?? def.oreMaterialId;
    const collectRow = canCollect
      ? `<div class="recipe-row" data-drill-action="collect">
           <div class="recipe-name">Collect ${oreName}</div>
           <div class="recipe-status">${drillState.oreBuffer} ore ready (${orePct}% full)</div>
         </div>`
      : "";

    // Speed upgrade row
    const nextTier = nextDrillTier(def, drillState.tier);
    const canUpgrade = nextTier !== null && canAffordUpgradeDrill(def, drillState.tier, state.vessel.inventory);
    const upgradeRow = nextTier && canUpgrade
      ? `<div class="recipe-row" data-drill-action="upgrade">
           <div class="recipe-name">Upgrade: ${nextTier.name}</div>
           <div class="recipe-status">${Object.entries(nextTier.upgradeCost).map(([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`).join(", ")} — ${nextTier.cycleMs / 1000}s cycle, ${nextTier.orePerCycle}/cycle</div>
         </div>`
      : "";

    // Buffer upgrade row — copper/iron ingot sink for more autonomy
    const nextBuffer = nextBufferUpgrade(def.id, drillState.bufferTier ?? 0);
    const canBufferUpgrade = nextBuffer !== null &&
      Object.entries(nextBuffer.cost).every(([mat, amt]) => (getMaterialAmount(state.vessel.inventory, mat) as number) >= amt);
    const bufferRow = nextBuffer && canBufferUpgrade
      ? `<div class="recipe-row" data-drill-action="buffer-upgrade">
           <div class="recipe-name">Expand Hoppers: ${nextBuffer.label}</div>
           <div class="recipe-status">${Object.entries(nextBuffer.cost).map(([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`).join(", ")} — coal ${nextBuffer.coalBufferMax} · ore ${nextBuffer.oreBufferMax}</div>
         </div>`
      : nextBuffer
        ? `<div class="recipe-row recipe-row-disabled">
             <div class="recipe-name">Expand Hoppers: ${nextBuffer.label}</div>
             <div class="recipe-status">Need: ${Object.entries(nextBuffer.cost).map(([id, amt]) => `${amt} ${MATERIALS[id]?.name ?? id}`).join(", ")}</div>
           </div>`
        : "";

    html = `
      <h2>${def.name} — Tier ${drillState.tier}: ${tierDef.name}</h2>
      <p class="reserve-status">${statusLine}</p>
      <p class="reserve-status">Coal: ${drillState.coalBuffer}/${drillState.coalBufferMax ?? DRILL_COAL_BUFFER_MAX} &nbsp;|&nbsp; Ore: ${drillState.oreBuffer}/${drillState.oreBufferMax ?? DRILL_ORE_BUFFER_MAX}</p>
      ${refuelRow}
      ${collectRow}
      ${upgradeRow}
      ${bufferRow}
    `;
  }

  // Append to existing panel content
  const section = document.createElement("div");
  section.innerHTML = html;
  container.appendChild(section);

  section.querySelectorAll<HTMLDivElement>("[data-drill-action]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      const action = row.dataset.drillAction;
      if (action === "build") onBuild();
      else if (action === "refuel") onRefuel();
      else if (action === "collect") onCollect();
      else if (action === "upgrade") onUpgrade();
      else if (action === "buffer-upgrade") onBufferUpgrade?.();
    });
  });
}

// ---------------------------------------------------------------------------
// Perform functions
// ---------------------------------------------------------------------------

export function performBuildDrill(state: GameState, veinId: string): GameState {
  const def = drillDefinitionByVeinId(veinId);
  if (!def) return state;
  if (state.world.drills[veinId]) return state; // already built
  if (!canAffordBuildDrill(def, state.vessel.inventory)) return state;

  const newInventory = deductMaterials(state.vessel.inventory, def.buildCost);
  const drillState = createFreshDrillState();

  return {
    ...state,
    world: {
      ...state.world,
      drills: { ...state.world.drills, [veinId]: drillState },
    },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}

export function performRefuelDrill(state: GameState, veinId: string): GameState {
  const drillState = state.world.drills[veinId];
  if (!drillState) return state;

  const result = refuelDrill(state.vessel.inventory, drillState);
  if (result.coalAdded === 0) return state;

  // If this is the first fueling, start the clock now
  const updatedDrill = result.drill.lastCycleAt === 0
    ? { ...result.drill, lastCycleAt: Date.now() }
    : result.drill;

  return {
    ...state,
    world: { ...state.world, drills: { ...state.world.drills, [veinId]: updatedDrill } },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
}

export function performCollectDrillOre(state: GameState, veinId: string): GameState {
  const drillState = state.world.drills[veinId];
  const def = drillDefinitionByVeinId(veinId);
  if (!drillState || !def) return state;

  const result = collectDrillOre(state.vessel.inventory, drillState, def);
  if (result.oreCollected === 0) return state;

  return {
    ...state,
    world: { ...state.world, drills: { ...state.world.drills, [veinId]: result.drill } },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
}

export function performUpgradeDrill(state: GameState, veinId: string): GameState {
  const drillState = state.world.drills[veinId];
  const def = drillDefinitionByVeinId(veinId);
  if (!drillState || !def) return state;
  if (!canAffordUpgradeDrill(def, drillState.tier, state.vessel.inventory)) return state;

  const nextTier = nextDrillTier(def, drillState.tier);
  if (!nextTier) return state;

  const newInventory = deductMaterials(state.vessel.inventory, nextTier.upgradeCost);

  return {
    ...state,
    world: {
      ...state.world,
      drills: { ...state.world.drills, [veinId]: { ...drillState, tier: nextTier.tier } },
    },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}

export function performUpgradeDrillBuffer(state: GameState, veinId: string): GameState {
  const drillState = state.world.drills[veinId];
  const def = drillDefinitionByVeinId(veinId);
  if (!drillState || !def) return state;

  const currentBufferTier = drillState.bufferTier ?? 0;
  const next = nextBufferUpgrade(def.id, currentBufferTier);
  if (!next) return state;

  // Check affordability
  for (const [mat, amt] of Object.entries(next.cost)) {
    if ((getMaterialAmount(state.vessel.inventory, mat) as number) < amt) return state;
  }

  const newInventory = deductMaterials(state.vessel.inventory, next.cost);

  return {
    ...state,
    world: {
      ...state.world,
      drills: {
        ...state.world.drills,
        [veinId]: {
          ...drillState,
          coalBufferMax: next.coalBufferMax,
          oreBufferMax: next.oreBufferMax,
          bufferTier: next.tier,
        },
      },
    },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}
