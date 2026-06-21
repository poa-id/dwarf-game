import { getState, setState, narrate } from "./gameState";
import { nearestOreVein, nearestWoodNode, isNearForge, isForgeRepaired, nearestUnrepairedTorch } from "./proximity";
import { MATERIALS } from "../engine/types";
import { ROCK_NODES, createFreshDepletionState, isExhausted as isOreExhausted, attemptMineStrike, applyMineResult } from "../engine/mining";
import { WOOD_NODES, isExhausted as isWoodExhausted, attemptWoodGather, applyWoodGatherResult } from "../engine/woodcraft";
import { canAffordForgeRepair, applyForgeRepair, FORGE_REPAIR_COST } from "../engine/smithing";
import { repairTorch } from "../engine/torches";
import { showNarratorToast } from "../narration/toast";

/**
 * Each handler here follows the same shape: read state, validate via
 * proximity.ts, mutate via setState, optionally narrate, and the
 * caller (main.ts's keydown handler) is responsible for calling
 * render() afterward - these functions don't render themselves, to
 * keep "what happened" (this file) separate from "redraw the screen"
 * (render.ts), even though in practice every call site immediately
 * renders after.
 */

export function handleMineStrike(actionHint: HTMLElement): void {
  const vein = nearestOreVein();
  if (!vein) return;

  const rockNode = ROCK_NODES.find((n) => n.id === vein.rockNodeId);
  if (!rockNode) return;

  const state = getState();
  const miningSkill = state.vessel.skills.mining;
  if (miningSkill.level < rockNode.requiredLevel) return; // shouldn't happen for the starter vein, defensive only

  const depletion = state.world.veinDepletion[vein.id] ?? createFreshDepletionState();
  if (isOreExhausted(rockNode, depletion)) {
    actionHint.textContent = `The ${rockNode.name.toLowerCase()} is exhausted.`;
    return;
  }

  const isFirstStrikeEver = !state.narrator.firedOnceTriggers.includes("mine_first_strike");
  const result = attemptMineStrike(rockNode, miningSkill, state.world.forgeTier, depletion, Math.random());

  setState({
    ...state,
    world: {
      ...state.world,
      veinDepletion: { ...state.world.veinDepletion, [vein.id]: result.newDepletion },
    },
  });

  if (!result.success) {
    return; // a miss - no material/xp change, no narration; the swing just didn't land. Caller still re-renders.
  }

  const afterMiss = getState();
  const newInventory = applyMineResult(afterMiss.vessel.inventory, result);
  const newMiningSkill = {
    ...miningSkill,
    level: result.newLevel,
    xp: miningSkill.xp + result.xpGained,
  };

  setState({
    ...afterMiss,
    vessel: {
      ...afterMiss.vessel,
      inventory: newInventory,
      skills: { ...afterMiss.vessel.skills, mining: newMiningSkill },
    },
  });

  narrate(isFirstStrikeEver ? "mine_first_strike" : "mine_strike");
  if (result.leveledUp) narrate("level_up");
}

export function handleWoodGather(): void {
  const woodPlacement = nearestWoodNode();
  if (!woodPlacement) return;

  const woodNode = WOOD_NODES.find((n) => n.id === woodPlacement.woodNodeId);
  if (!woodNode) return;

  const state = getState();
  const woodcraftSkill = state.vessel.skills.woodcraft;
  if (woodcraftSkill.level < woodNode.requiredLevel) return; // defensive, shouldn't happen for the starter node

  const depletion = state.world.woodDepletion[woodPlacement.id] ?? createFreshDepletionState();
  if (isWoodExhausted(woodNode, depletion)) {
    return;
  }

  const result = attemptWoodGather(woodNode, woodcraftSkill, state.world.forgeTier, depletion, Math.random());

  setState({
    ...state,
    world: {
      ...state.world,
      woodDepletion: { ...state.world.woodDepletion, [woodPlacement.id]: result.newDepletion },
    },
  });

  if (!result.success) {
    return;
  }

  const afterMiss = getState();
  const newInventory = applyWoodGatherResult(afterMiss.vessel.inventory, result);
  const newWoodcraftSkill = {
    ...woodcraftSkill,
    level: result.newLevel,
    xp: woodcraftSkill.xp + result.xpGained,
  };

  setState({
    ...afterMiss,
    vessel: {
      ...afterMiss.vessel,
      inventory: newInventory,
      skills: { ...afterMiss.vessel.skills, woodcraft: newWoodcraftSkill },
    },
  });

  // Deliberately narrates nothing for routine gathers - "the pick
  // finds rock" lines would be wrong for cutting wood. Leave silent
  // until Woodcraft earns its own line pool (see DESIGN.md open
  // questions). Level-ups are skill-agnostic enough to reuse as-is.
  if (result.leveledUp) narrate("level_up");
}

export function handleForgeRepair(narratorContainer: HTMLElement, actionHint: HTMLElement): void {
  if (!isNearForge() || isForgeRepaired()) return;

  const state = getState();
  if (!canAffordForgeRepair(state.vessel.inventory)) {
    const costText = Object.entries(FORGE_REPAIR_COST)
      .map(([res, amt]) => `${amt} ${MATERIALS[res]?.name ?? res}`)
      .join(", ");
    actionHint.textContent = `Not enough materials to repair the forge (need ${costText}).`;
    return;
  }

  const newInventory = applyForgeRepair(state.vessel.inventory);
  setState({
    ...state,
    world: { ...state.world, forgeTier: 1 },
    vessel: { ...state.vessel, inventory: newInventory },
  });

  showNarratorToast(
    narratorContainer,
    "The forge catches. Cold iron remembers, even after all this time, what it's for."
  );
}

export function handleTorchRepair(actionHint: HTMLElement): void {
  const torch = nearestUnrepairedTorch();
  if (!torch) return;
  const outcome = repairTorch(getState(), torch);
  if (outcome.ok) {
    setState(outcome.newState);
    narrate("torch_repaired");
  } else if (outcome.reason === "cannot_afford") {
    actionHint.textContent = `Not enough resources to repair ${torch.name}.`;
  }
}
