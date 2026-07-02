import { getState, setState, narrate } from "./gameState";
import { nearestOreVein, nearestWoodNode, isNearForge, isForgeRepaired, nearestUnrepairedTorch } from "./proximity";
import { MATERIALS, getMaterialAmount, deductMaterials } from "../engine/types";
import { ROCK_NODES, createFreshDepletionState, isExhausted as isOreExhausted, attemptMineStrike, applyMineResult } from "../engine/mining";
import { WOOD_NODES, isExhausted as isWoodExhausted, attemptWoodGather, applyWoodGatherResult } from "../engine/woodcraft";
import { canAffordForgeRepair, applyForgeRepair, FORGE_REPAIR_COST } from "../engine/smithing";
import { repairTorch } from "../engine/torches";
import { xpPerkBonus } from "../engine/smelter";
import { yieldPerkBonus } from "../engine/hearth";
import { totalGemDropChanceBonus } from "../engine/gemcutting";
import { applyDwarfCountXpMultiplier, levelForXp, insightFromXp, archiveInsightBonus } from "../engine/xpCurve";
import { showNarratorToast } from "../narration/toast";
import { rollSeedDrop } from "../engine/garden";
import { addMaterial } from "../engine/types";

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
  if (miningSkill.level < rockNode.requiredLevel) {
    actionHint.textContent = `Mining level ${rockNode.requiredLevel} needed. You are level ${miningSkill.level}.`;
    return;
  }

  const depletion = state.world.veinDepletion[vein.id] ?? createFreshDepletionState();
  if (isOreExhausted(rockNode, depletion)) {
    actionHint.textContent = `The ${rockNode.name.toLowerCase()} is exhausted.`;
    return;
  }

  const isFirstStrikeEver = !state.narrator.firedOnceTriggers.includes("mine_first_strike");
  // Real gem-drop rolling, wired up 2026-06-23 alongside the
  // Gemcutting station - a second, INDEPENDENT roll from the strike's
  // own success roll (see gathering.ts's attemptGatherStrike for why
  // reusing one roll for both would be wrong), weighted by the
  // combined Gemcutting-station-tier + Tinkering-perk bonus.
  const gemDropChanceBonus = totalGemDropChanceBonus(state.world.gemcuttingTier, state.world.cutGemsSpentOnPerk);
  // Hearth's global yield perk (added 2026-06-23) - applies "everywhere
  // uniformly" per explicit direction, not just to gathering, but
  // Mining/Woodcraft are where it's most visible since their yields
  // can already exceed 1 at higher tool tiers.
  const hearthYieldBonus = yieldPerkBonus(state.world.trueMetalSpentOnYieldPerk) + state.world.rekindleMultiplier;
  const result = attemptMineStrike(
    rockNode,
    miningSkill,
    state.world.toolsForged.pickaxe,
    depletion,
    Math.random(),
    Math.random(),
    gemDropChanceBonus,
    hearthYieldBonus
  );

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
  // result.newLevel was computed inside attemptMineStrike from the
  // RAW xpGained - recompute using the multiplied amount instead, see
  // xpCurve.ts's applyDwarfCountXpMultiplier for why this multiplier
  // exists and why it's applied here (call sites) rather than inside
  // the pure engine functions themselves.
  const multipliedXp = applyDwarfCountXpMultiplier(result.xpGained, afterMiss.world.dwarfCount, xpPerkBonus(afterMiss.world.trueMetalSpentOnXpPerk));
  const newTotalXp = miningSkill.xp + multipliedXp;
  const newMiningSkill = {
    ...miningSkill,
    level: levelForXp(newTotalXp),
    xp: newTotalXp,
  };
  // Insight - per explicit direction, EVERY XP-granting action also
  // grants Insight (5% of the already-multiplied XP) - see
  // xpCurve.ts's insightFromXp for the full rationale. Accumulates
  // fractionally; only the UI display rounds.
  const newInsightBanked = afterMiss.world.insightBanked + insightFromXp(multipliedXp) * archiveInsightBonus(afterMiss.world.roomStates);

  setState({
    ...afterMiss,
    world: { ...afterMiss.world, insightBanked: newInsightBanked },
    vessel: {
      ...afterMiss.vessel,
      inventory: newInventory,
      skills: { ...afterMiss.vessel.skills, mining: newMiningSkill },
    },
  });

  narrate(isFirstStrikeEver ? "mine_first_strike" : "mine_strike");
  if (result.gemGained) narrate("gem_found");
  if (newMiningSkill.level > miningSkill.level) narrate("level_up");
}

export function handleWoodGather(): void {
  const woodPlacement = nearestWoodNode();
  if (!woodPlacement) return;

  const woodNode = WOOD_NODES.find((n) => n.id === woodPlacement.woodNodeId);
  if (!woodNode) return;

  const state = getState();
  const woodcraftSkill = state.vessel.skills.woodcraft;
  if (woodcraftSkill.level < woodNode.requiredLevel) return; // defensive — starter wood node is level 1

  const depletion = state.world.woodDepletion[woodPlacement.id] ?? createFreshDepletionState();
  if (isWoodExhausted(woodNode, depletion)) {
    return;
  }

  const isFirstStrikeEver = !state.narrator.firedOnceTriggers.includes("wood_first_strike");
  const result = attemptWoodGather(
    woodNode,
    woodcraftSkill,
    state.world.toolsForged.axe,
    depletion,
    Math.random(),
    yieldPerkBonus(state.world.trueMetalSpentOnYieldPerk) + state.world.rekindleMultiplier
  );

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
  // See the mining handler above for why this recomputes level rather
  // than trusting result.newLevel directly - the multiplier is applied
  // at this call-site layer, not inside attemptWoodGather itself.
  const multipliedXp = applyDwarfCountXpMultiplier(result.xpGained, afterMiss.world.dwarfCount, xpPerkBonus(afterMiss.world.trueMetalSpentOnXpPerk));
  const newTotalXp = woodcraftSkill.xp + multipliedXp;
  const newWoodcraftSkill = {
    ...woodcraftSkill,
    level: levelForXp(newTotalXp),
    xp: newTotalXp,
  };
  const newInsightBanked = afterMiss.world.insightBanked + insightFromXp(multipliedXp) * archiveInsightBonus(afterMiss.world.roomStates);

  // Seed drop — 2% chance of a stoneshroom spore per wood gather
  const seedDrop = rollSeedDrop(Math.random());
  const inventoryWithSeed = seedDrop
    ? addMaterial(newInventory, seedDrop, 1)
    : newInventory;

  setState({
    ...afterMiss,
    world: { ...afterMiss.world, insightBanked: newInsightBanked },
    vessel: {
      ...afterMiss.vessel,
      inventory: inventoryWithSeed,
      skills: { ...afterMiss.vessel.skills, woodcraft: newWoodcraftSkill },
    },
  });

  // Woodcraft now has its own real line pool (added 2026-06-23 -
  // previously silent entirely, see wood_strike/wood_first_strike in
  // lines.ts), mirroring Mining's isFirstStrikeEver/throttled-routine
  // pattern exactly rather than reusing Mining's lines.
  narrate(isFirstStrikeEver ? "wood_first_strike" : "wood_strike");
  if (newWoodcraftSkill.level > woodcraftSkill.level) narrate("level_up");
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

// ---------------------------------------------------------------------------
// Torch placement
// ---------------------------------------------------------------------------

export const TORCH_PLACE_COST = { wood: 1, coal: 1 };
export const MAX_PLACED_TORCHES = 50;

/**
 * Places an unlit torch on an adjacent wall cell.
 * T key. Cost: 1 Wood + 1 Coal.
 * isWallCell: callback from main.ts that checks the full dynamic cell.
 */
export function handlePlaceTorch(
  actionHint: HTMLElement,
  isWallCell: (col: number, row: number) => boolean
): void {
  const state = getState();
  const { position, inventory } = state.vessel;
  const world = state.world;

  if (Object.keys(world.placedTorches).length >= MAX_PLACED_TORCHES) {
    actionHint.textContent = "Cannot place more torches — limit reached.";
    return;
  }

  if (getMaterialAmount(inventory, "wood") < 1 || getMaterialAmount(inventory, "coal") < 1) {
    actionHint.textContent = "Need 1 Wood + 1 Coal to place a torch.";
    return;
  }

  const candidates = [
    { col: position.col, row: position.row - 1 },
    { col: position.col, row: position.row + 1 },
    { col: position.col - 1, row: position.row },
    { col: position.col + 1, row: position.row },
  ];

  let mountCell: { col: number; row: number } | null = null;
  for (const c of candidates) {
    const key = `${c.col},${c.row}`;
    if (world.placedTorches[key] !== undefined) continue;
    if (isWallCell(c.col, c.row)) { mountCell = c; break; }
  }

  if (!mountCell) {
    actionHint.textContent = "No wall nearby to mount a torch on.";
    return;
  }

  const key = `${mountCell.col},${mountCell.row}`;
  setState({
    ...state,
    world: { ...state.world, placedTorches: { ...world.placedTorches, [key]: false } },
    vessel: { ...state.vessel, inventory: deductMaterials(inventory, TORCH_PLACE_COST) },
  });
  actionHint.textContent = "Torch mounted — press E nearby to light it.";
}

export function handleLightPlacedTorch(col: number, row: number, actionHint: HTMLElement): void {
  const state = getState();
  const key = `${col},${row}`;
  if (state.world.placedTorches[key] === undefined) return;

  if (state.world.placedTorches[key]) {
    // Already lit — remove the torch and refund 1 wood
    const newTorches = { ...state.world.placedTorches };
    delete newTorches[key];
    setState({
      ...state,
      world: { ...state.world, placedTorches: newTorches },
      vessel: { ...state.vessel, inventory: addMaterial(state.vessel.inventory, "wood", 1) },
    });
    actionHint.textContent = "Torch removed (+1 Wood).";
    return;
  }

  // Unlit — light it (1 Copper Ingot)
  if (getMaterialAmount(state.vessel.inventory, "copper_ingot") < 1) {
    actionHint.textContent = "Need 1 Copper Ingot to light the torch.";
    return;
  }

  setState({
    ...state,
    world: { ...state.world, placedTorches: { ...state.world.placedTorches, [key]: true } },
    vessel: { ...state.vessel, inventory: deductMaterials(state.vessel.inventory, { copper_ingot: 1 }) },
  });
  actionHint.textContent = "Torch lit.";
}
