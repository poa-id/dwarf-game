import { getState, setState, narrate } from "./gameState";
import { render } from "./render";
import {
  tickHearth,
  totalHearthFuelValue,
  isAutoTendingUnlocked,
  deductFuelValueFromReserve,
  HEARTHKEEPING_XP_PER_FUEL_VALUE,
  hearthfireBonus,
} from "../engine/hearth";
import { legacyHearthEfficiency, legacyXpBonus } from "../engine/legacies";
import { xpPerkBonus } from "../engine/smelter";
import { applyDwarfCountXpMultiplier, levelForXp, insightFromXp, archiveInsightBonus } from "../engine/xpCurve";
import { tickDrill, drillDefinitionByVeinId, drillSpeedMultiplier } from "../engine/drill";
import { getRestorationScore } from "../engine/production";
import { tickGarden, growthSpeedMultiplier } from "../engine/garden";
import { tickSmeltingEngine, SMELTING_ENGINE_DEFINITIONS } from "../engine/smeltingEngine";
import { TURBINE_SMELT_SPEED_MULTIPLIER } from "../engine/turbine";
import { stockpileCapacityPerMaterial, type RoomStage } from "../engine/rooms";
import { companionHaulTierDef, applyCompanionTraining, advanceUnifiedLogistics } from "../engine/companion";
import { totalGemDropChanceBonus } from "../engine/gemcutting";
import { harvesterDefinitionByNodeId, tickHarvester } from "../engine/harvester";
import { ORE_VEINS } from "../engine/hubMap";
import { ROCK_NODES } from "../engine/mining";
import { advanceGardenTending } from "../engine/harvestCompanion";

export const TICK_INTERVAL_MS = 1000;

function gameTick(): void {
  let changed = false;
  const now = Date.now();
  let state = getState();

  if (isAutoTendingUnlocked(state.world.hearthTier)) {
    const reserveFuelValue = totalHearthFuelValue(state.world.fuelReserve);
    const fuelAvailable = reserveFuelValue;
    const hasRekindledOnce = state.world.dwarfCount > 0;
    const restorationScore = getRestorationScore(state.world).total;
    const result = tickHearth(state.world.hearth, now, fuelAvailable, hasRekindledOnce, restorationScore, state.world.hearthTier, legacyHearthEfficiency(state.world));
    if (result.fuelAbsorbed > 0) {
      const newReserve = deductFuelValueFromReserve(state.world.fuelReserve, result.fuelAbsorbed);

      const rawXp = result.fuelAbsorbed * HEARTHKEEPING_XP_PER_FUEL_VALUE;
      const multipliedXp = applyDwarfCountXpMultiplier(rawXp, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk) + legacyXpBonus(state.world));
      const newHearthkeepingXp = state.vessel.skills.hearthkeeping.xp + multipliedXp;
      const newHearthkeeping = {
        ...state.vessel.skills.hearthkeeping,
        level: levelForXp(newHearthkeepingXp),
        xp: newHearthkeepingXp,
      };
      const leveledUp = newHearthkeeping.level > state.vessel.skills.hearthkeeping.level;
      // Insight - this passive Hearthkeeping tick is literally the
      // "slow trickle over time" LORE.md always described Insight as
      // earning from, alongside rekindling - see xpCurve.ts's
      // insightFromXp for the full rationale behind this being wired
      // in everywhere, not just here.
      const newInsightBanked = state.world.insightBanked + insightFromXp(multipliedXp) * archiveInsightBonus(state.world.roomStates);

      setState({
        ...state,
        world: { ...state.world, hearth: result.hearth, fuelReserve: newReserve, insightBanked: newInsightBanked },
        vessel: { ...state.vessel, skills: { ...state.vessel.skills, hearthkeeping: newHearthkeeping } },
      });
      state = getState();
      changed = true;
      if (result.colorStageIncreased) {
        narrate(state.narrator.firedOnceTriggers.includes("color_stage_1") ? "color_stage_later" : "color_stage_1");
        state = getState();
      }
      if (leveledUp) {
        narrate("level_up");
        state = getState();
      }
    } else if (result.hearth.lastUpdated !== state.world.hearth.lastUpdated) {
      setState({ ...state, world: { ...state.world, hearth: result.hearth } });
      state = getState();
    }
  }

  // Tick garden slots (passive plant growth)
  if (state.world.gardenSlots.length > 0) {
    const herbloreLevel = state.vessel.skills.herblore?.level ?? 1;
    const speedMult = growthSpeedMultiplier(herbloreLevel, state.world.harvestCompanion.tendingRank ?? 0) * (1 + hearthfireBonus(state.world.hearth));
    const gardenResult = tickGarden(state.world.gardenSlots, now, speedMult);
    if (gardenResult.changed) {
      setState({ ...state, world: { ...state.world, gardenSlots: gardenResult.slots } });
      state = getState();
      changed = true;
    }
  }

  // Tick smelting engines. Inputs and outputs remain in physical local
  // buffers; Narag-Bund moves both sides through the shared logistics queue.
  const engineEntries = Object.entries(state.world.smeltingEngines);
  if (engineEntries.length > 0) {
    let newEngines = { ...state.world.smeltingEngines };
    let engineChanged = false;
    let passiveSmithingRawXp = 0;

    for (const [engineId, engineState] of engineEntries) {
      const def = SMELTING_ENGINE_DEFINITIONS.find((d) => d.id === engineId);
      if (!def || engineState.tier === 0) continue;

      const engineSpeedMultiplier = (state.world.turbineBuilt ? TURBINE_SMELT_SPEED_MULTIPLIER : 1) * (1 + hearthfireBonus(state.world.hearth));
      const result = tickSmeltingEngine(engineState, def, now, engineSpeedMultiplier);
      if (result.engine.lastCycleAt !== engineState.lastCycleAt) {
        newEngines = { ...newEngines, [engineId]: result.engine };
        engineChanged = true;
      }
      if (result.ranCycle) {
        newEngines = { ...newEngines, [engineId]: result.engine };
        const xpPerIngot = def.ingotMaterialId === "deepstone_ingot" ? 60
          : def.ingotMaterialId === "iron_ingot" ? 22
            : 10;
        passiveSmithingRawXp += result.ingotsProduced * xpPerIngot;
        engineChanged = true;
      }
    }

    if (engineChanged) {
      const multipliedXp = applyDwarfCountXpMultiplier(passiveSmithingRawXp, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk) + legacyXpBonus(state.world));
      const smithingXp = state.vessel.skills.smithing.xp + multipliedXp;
      setState({
        ...state,
        world: { ...state.world, smeltingEngines: newEngines, insightBanked: state.world.insightBanked + insightFromXp(multipliedXp) * archiveInsightBonus(state.world.roomStates) },
        vessel: { ...state.vessel, skills: { ...state.vessel.skills, smithing: { ...state.vessel.skills.smithing, xp: smithingXp, level: levelForXp(smithingXp) } } },
      });
      state = getState();
      changed = true;
    }
  }

  // Tick all built drills
  const drillEntries = Object.entries(state.world.drills);
  if (drillEntries.length > 0) {
    let newDrills = { ...state.world.drills };
    let drillChanged = false;
    const speedMultiplier = drillSpeedMultiplier(state.world.mineshaftDepth) * (1 + hearthfireBonus(state.world.hearth));
    const gemDropChanceBonus = totalGemDropChanceBonus(state.world.gemcuttingTier, state.world.cutGemsSpentOnPerk);
    let passiveMiningRawXp = 0;

    for (const [veinId, drillState] of drillEntries) {
      const def = drillDefinitionByVeinId(veinId);
      if (!def) continue;
      const result = tickDrill(drillState, def, now, speedMultiplier, gemDropChanceBonus);
      if (result.oreProduced > 0) {
        const vein = ORE_VEINS.find((entry) => entry.id === def.veinId);
        const node = vein ? ROCK_NODES.find((entry) => entry.id === vein.rockNodeId) : undefined;
        passiveMiningRawXp += result.oreProduced * (node?.baseXp ?? 5);
      }
      if (result.ranCycle || result.drill.lastCycleAt !== drillState.lastCycleAt) {
        newDrills = { ...newDrills, [veinId]: result.drill };
        drillChanged = true;
      }
    }
    if (drillChanged || passiveMiningRawXp > 0) {
      const multipliedXp = applyDwarfCountXpMultiplier(passiveMiningRawXp, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk) + legacyXpBonus(state.world));
      const miningXp = state.vessel.skills.mining.xp + multipliedXp;
      const previousMiningLevel = state.vessel.skills.mining.level;
      const miningLevel = levelForXp(miningXp);
      setState({
        ...state,
        world: { ...state.world, drills: newDrills, insightBanked: state.world.insightBanked + insightFromXp(multipliedXp) * archiveInsightBonus(state.world.roomStates) },
        vessel: { ...state.vessel, skills: { ...state.vessel.skills, mining: { ...state.vessel.skills.mining, xp: miningXp, level: miningLevel } } },
      });
      state = getState();
      changed = true;
      if (miningLevel > previousMiningLevel) {
        narrate("level_up");
        state = getState();
      }
    }
  }

  // Tick all built Wood Harvesters - identical shape to the drill tick
  // above, per direct instruction ("this follows the same logic of the
  // ore drills but for wood").
  const harvesterEntries = Object.entries(state.world.harvesters);
  if (harvesterEntries.length > 0) {
    let newHarvesters = { ...state.world.harvesters };
    let harvesterChanged = false;
    let passiveWoodcraftRawXp = 0;

    for (const [nodeId, harvesterState] of harvesterEntries) {
      const def = harvesterDefinitionByNodeId(nodeId);
      if (!def) continue;
      const result = tickHarvester(harvesterState, def, now, 1 + hearthfireBonus(state.world.hearth));
      passiveWoodcraftRawXp += result.woodProduced * 7;
      if (result.ranCycle || result.harvester.lastCycleAt !== harvesterState.lastCycleAt) {
        newHarvesters = { ...newHarvesters, [nodeId]: result.harvester };
        harvesterChanged = true;
      }
    }

    if (harvesterChanged || passiveWoodcraftRawXp > 0) {
      const multipliedXp = applyDwarfCountXpMultiplier(passiveWoodcraftRawXp, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk) + legacyXpBonus(state.world));
      const woodcraftXp = state.vessel.skills.woodcraft.xp + multipliedXp;
      const previousWoodcraftLevel = state.vessel.skills.woodcraft.level;
      const woodcraftLevel = levelForXp(woodcraftXp);
      setState({
        ...state,
        world: { ...state.world, harvesters: newHarvesters, insightBanked: state.world.insightBanked + insightFromXp(multipliedXp) * archiveInsightBonus(state.world.roomStates) },
        vessel: { ...state.vessel, skills: { ...state.vessel.skills, woodcraft: { ...state.vessel.skills.woodcraft, xp: woodcraftXp, level: woodcraftLevel } } },
      });
      state = getState();
      changed = true;
      if (woodcraftLevel > previousWoodcraftLevel) {
        narrate("level_up");
        state = getState();
      }
    }
  }

  // Narag-Bund is one shared logistics layer. Extraction, refueling,
  // engine inputs, and finished outputs all compete for this budget.
  const machineStockpileStage = (state.world.roomStates["stockpile_room"] ?? "ruined") as RoomStage;
  if (state.world.companion.befriended && machineStockpileStage !== "ruined") {
    const trainedTier = applyCompanionTraining(
      companionHaulTierDef(state.world.companion.tier),
      state.world.companion.trainingRank ?? 0,
    );
    const haul = advanceUnifiedLogistics(
      state.world.stockpileOre,
      state.world.fuelReserve,
      state.world.drills,
      state.world.harvesters,
      state.world.smeltingEngines,
      state.world.companion.lastMachineHaulAt ?? now,
      now,
      trainedTier,
      stockpileCapacityPerMaterial(machineStockpileStage, state.world.stockpileExpansionRank ?? 0),
      state.world.companion.logisticsMode ?? "balanced",
      state.world.companion.logisticsPolicy,
    );
    if (haul.lastHaulAt !== (state.world.companion.lastMachineHaulAt ?? now)) {
      setState({
        ...state,
        world: {
          ...state.world,
          stockpileOre: haul.stockpile,
          fuelReserve: haul.fuelReserve,
          drills: haul.drills,
          harvesters: haul.harvesters,
          smeltingEngines: haul.engines,
          companion: { ...state.world.companion, lastMachineHaulAt: haul.lastHaulAt },
        },
      });
      state = getState();
      if (haul.moved > 0) changed = true;
    }
  }

  // Siginhakhd owns the Garden rhythm: mature crops are harvested into
  // the Stockpile and replanted only when stored seed is available.
  if (state.world.harvestCompanion.befriended && machineStockpileStage !== "ruined") {
    const tended = advanceGardenTending(
      state.world.gardenSlots,
      state.world.stockpileOre,
      state.world.harvestCompanion.lastHaulAt,
      now,
      state.world.harvestCompanion.tendingRank ?? 0,
      stockpileCapacityPerMaterial(machineStockpileStage, state.world.stockpileExpansionRank ?? 0),
    );
    if (tended.lastTendAt !== state.world.harvestCompanion.lastHaulAt) {
      const multipliedXp = applyDwarfCountXpMultiplier(tended.xp, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk) + legacyXpBonus(state.world));
      const herbloreXp = state.vessel.skills.herblore.xp + multipliedXp;
      setState({
        ...state,
        world: {
          ...state.world,
          gardenSlots: tended.slots,
          stockpileOre: tended.stockpile,
          harvestCompanion: { ...state.world.harvestCompanion, lastHaulAt: tended.lastTendAt },
          insightBanked: state.world.insightBanked + insightFromXp(multipliedXp) * archiveInsightBonus(state.world.roomStates),
        },
        vessel: { ...state.vessel, skills: { ...state.vessel.skills, herblore: { ...state.vessel.skills.herblore, xp: herbloreXp, level: levelForXp(herbloreXp) } } },
      });
      state = getState();
      if (tended.harvested > 0) changed = true;
    }
  }

  if (changed) render();
}

export function startGameLoop(): void {
  setInterval(gameTick, TICK_INTERVAL_MS);
}
