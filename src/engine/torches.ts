import type { GameState, LightSourceDefinition, ResourceBag } from "./types";
import { canAffordMaterials, deductMaterials } from "./types";
import { markAreaExplored } from "./exploration";

/** How close the dwarf must stand to a torch to repair it - same idea as an interaction range. */
export const TORCH_INTERACT_RANGE = 1;

export function isNearTorch(
  dwarfCol: number,
  dwarfRow: number,
  torch: LightSourceDefinition
): boolean {
  const dx = dwarfCol - torch.position.col;
  const dy = dwarfRow - torch.position.row;
  return Math.abs(dx) <= TORCH_INTERACT_RANGE && Math.abs(dy) <= TORCH_INTERACT_RANGE;
}

export function canAffordRepair(inventory: ResourceBag, cost: ResourceBag): boolean {
  return canAffordMaterials(inventory, cost);
}

export type RepairTorchOutcome =
  | { ok: true; newState: GameState }
  | { ok: false; reason: "too_far" | "already_lit" | "cannot_afford" };

/**
 * Attempt to repair a torch. Pure function - validates range, lit
 * state, and affordability, and returns either the updated state or a
 * specific failure reason the UI can show ("too far away", "already
 * burning", "not enough ingots") rather than silently doing nothing.
 */
export function repairTorch(state: GameState, torch: LightSourceDefinition): RepairTorchOutcome {
  if (state.world.litTorches[torch.id]) {
    return { ok: false, reason: "already_lit" };
  }

  if (!isNearTorch(state.vessel.position.col, state.vessel.position.row, torch)) {
    return { ok: false, reason: "too_far" };
  }

  if (!canAffordMaterials(state.vessel.inventory, torch.repairCost)) {
    return { ok: false, reason: "cannot_afford" };
  }

  const newInventory = deductMaterials(state.vessel.inventory, torch.repairCost);
  const newExplored = markAreaExplored(
    state.world.exploredCells,
    torch.position,
    torch.radius
  );

  const newState: GameState = {
    ...state,
    world: {
      ...state.world,
      litTorches: { ...state.world.litTorches, [torch.id]: true },
      exploredCells: newExplored,
    },
    vessel: {
      ...state.vessel,
      inventory: newInventory,
    },
  };

  return { ok: true, newState };
}
