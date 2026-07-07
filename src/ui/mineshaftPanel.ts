/**
 * Mineshaft panel — the depth upgrade system.
 *
 * The mine shaft is an independent structure: repair it, then spend
 * materials to dig deeper. Each depth tier makes new ore veins accessible
 * without new rooms — the veins are already in the mine room but locked
 * behind depth gates.
 *
 * Depth 0: Broken shaft — repair it to begin
 * Depth 1: Surface — copper, coal, iron, deepstone (Mining level gates)
 * Depth 2: First Deep — starstone unlocked
 * Depth 3: Second Deep — future tier placeholder
 *
 * This is the expandable axis: new tiers added by defining new depth
 * levels here, no map changes needed.
 */

import type { GameState } from "../engine/types";
import { MATERIALS, getMaterialAmount, deductMaterials } from "../engine/types";

export interface ShaftDepthDef {
  depth: number;
  label: string;
  description: string;
  repairCost: Record<string, number>;
  insightCost: number;
  unlocks: string;
}

export const SHAFT_DEPTHS: ShaftDepthDef[] = [
  {
    depth: 0,
    label: "Broken Shaft",
    description: "The timbers have collapsed. Tracks buckled. The shaft is sealed by its own ruin.",
    repairCost: {},
    insightCost: 0,
    unlocks: "Nothing yet.",
  },
  {
    depth: 1,
    label: "Shaft Restored",
    description: "Timbers replaced, tracks relaid, lanterns lit. The shaft breathes again.",
    repairCost: { wood: 30, copper_ingot: 10, iron_ingot: 5 },
    insightCost: 400,
    unlocks: "Coal drill buildable. All existing veins (copper, iron, coal, deepstone) accessible by Mining skill. Drill cycle speed +10%.",
  },
  {
    depth: 2,
    label: "First Deep",
    description: "Deeper than any dwarf has gone in generations. The stone here is different — dense, cold, humming faintly.",
    repairCost: { iron_ingot: 20, deepstone_ingot: 8, ironwood: 5 },
    insightCost: 2000,
    unlocks: "Starstone ore unlocked — accessible by Mining skill, same as the existing veins (no new vein physically appears in the mine room).",
  },
  {
    depth: 3,
    label: "Second Deep",
    description: "No maps for this depth. The mountain's oldest memory.",
    repairCost: { deepstone_ingot: 20, true_iron: 5, true_deepstone: 2 },
    insightCost: 5000,
    unlocks: "Future tier — the abyss. Something from before the dwarves.",
  },
];

export function shaftDefForDepth(depth: number): ShaftDepthDef {
  return SHAFT_DEPTHS.find(d => d.depth === depth) ?? SHAFT_DEPTHS[0];
}

export function nextShaftDef(currentDepth: number): ShaftDepthDef | null {
  return SHAFT_DEPTHS.find(d => d.depth === currentDepth + 1) ?? null;
}

function canAffordShaftUpgrade(
  next: ShaftDepthDef,
  inventory: Record<string, number>,
  insightBanked: number
): boolean {
  if (insightBanked < next.insightCost) return false;
  return Object.entries(next.repairCost).every(
    ([mat, amt]) => (getMaterialAmount(inventory, mat) as number) >= amt
  );
}

export function renderMineshaftPanel(
  state: GameState,
  container: HTMLElement,
  onUpgrade: () => void
): void {
  container.innerHTML = "";
  const depth = state.world.mineshaftDepth;
  const current = shaftDefForDepth(depth);
  const next = nextShaftDef(depth);

  const canUpgrade = next
    ? canAffordShaftUpgrade(next, state.vessel.inventory as Record<string, number>, state.world.insightBanked)
    : false;

  let html = `<h2>${current.label}</h2>`;
  html += `<p class="reserve-status" style="font-size:0.85em;opacity:0.85;">${current.description}</p>`;

  if (depth >= 1) {
    html += `<p class="reserve-status" style="color:#c8a830;font-size:0.8em;">✦ ${current.unlocks}</p>`;
  }

  if (next) {
    const costParts = [
      ...Object.entries(next.repairCost).map(([m, a]) => `${a} ${MATERIALS[m]?.name ?? m}`),
      next.insightCost > 0 ? `${next.insightCost} Insight` : null,
    ].filter(Boolean);
    const costText = costParts.join(", ");
    const btnLabel = depth === 0 ? "Repair the Shaft" : `Dig Deeper: ${next.label}`;

    html += `
      <div class="recipe-row ${canUpgrade ? "" : "recipe-row-disabled"}" data-action="shaft-upgrade">
        <div class="recipe-name">${btnLabel}</div>
        <div class="recipe-status">${canUpgrade ? costText : `Need: ${costText}`}</div>
      </div>
      <p class="reserve-status" style="font-size:0.75em;opacity:0.6;margin-top:4px;">Unlocks: ${next.unlocks}</p>
    `;
  } else {
    html += `<p class="reserve-status" style="opacity:0.5;">Maximum known depth reached.</p>`;
  }

  container.innerHTML = html;

  container.querySelector<HTMLDivElement>("[data-action='shaft-upgrade']")
    ?.addEventListener("click", () => { if (canUpgrade) onUpgrade(); });
}

export function performMineshaftUpgrade(state: GameState): GameState {
  const next = nextShaftDef(state.world.mineshaftDepth);
  if (!next) return state;

  const inv = state.vessel.inventory as Record<string, number>;
  if (!canAffordShaftUpgrade(next, inv, state.world.insightBanked)) return state;

  return {
    ...state,
    world: {
      ...state.world,
      mineshaftDepth: next.depth,
      insightBanked: state.world.insightBanked - next.insightCost,
    },
    vessel: {
      ...state.vessel,
      inventory: deductMaterials(state.vessel.inventory, next.repairCost),
    },
  };
}

export function isNearMineshaft(position: { col: number; row: number }): boolean {
  // Shaft: cols 10-12, rows 17-19 (in north wall), mouth at row 20.
  // Strict proximity: only trigger when standing directly south of the mouth
  // at row 20-21, cols 10-12. Avoids conflicting with the iron vein at cols 6-8.
  return position.col >= 10 && position.col <= 12 &&
         position.row >= 20 && position.row <= 21;
}
