import { getState, setState, narrate } from "./gameState";
import { render } from "./render";
import {
  tickHearth,
  totalHearthFuelValue,
  isAutoTendingUnlocked,
  deductFuelValueFromReserve,
  advanceCompanionHauling,
  advanceDrillHauling,
  HEARTHKEEPING_XP_PER_FUEL_VALUE,
} from "../engine/hearth";
import { xpPerkBonus } from "../engine/smelter";
import { applyDwarfCountXpMultiplier, levelForXp, insightFromXp, archiveInsightBonus } from "../engine/xpCurve";
import { tickDrill, drillDefinitionByVeinId, drillSpeedMultiplier } from "../engine/drill";
import { getRestorationScore } from "../engine/production";
import { tickGarden, growthSpeedMultiplier } from "../engine/garden";
import { tickSmeltingEngine, SMELTING_ENGINE_DEFINITIONS } from "../engine/smeltingEngine";
import { TURBINE_SMELT_SPEED_MULTIPLIER } from "../engine/turbine";
import { stockpileCapacityPerMaterial, type RoomStage } from "../engine/rooms";

export const TICK_INTERVAL_MS = 1000;

function gameTick(): void {
  let changed = false;
  const now = Date.now();
  let state = getState();

  if (isAutoTendingUnlocked(state.world.hearthTier)) {
    const fuelAvailable = totalHearthFuelValue(state.world.fuelReserve);
    const hasRekindledOnce = state.world.dwarfCount > 0;
    const restorationScore = getRestorationScore(state.world).total;
    const result = tickHearth(state.world.hearth, now, fuelAvailable, hasRekindledOnce, restorationScore);
    if (result.fuelAbsorbed > 0) {
      const newReserve = deductFuelValueFromReserve(state.world.fuelReserve, result.fuelAbsorbed);

      const rawXp = result.fuelAbsorbed * HEARTHKEEPING_XP_PER_FUEL_VALUE;
      const multipliedXp = applyDwarfCountXpMultiplier(rawXp, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk));
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

  if (state.world.companion.befriended) {
    const haul = advanceCompanionHauling(
      state.vessel.inventory,
      state.world.fuelReserve,
      state.world.companion.lastHaulAt,
      now,
      state.world.turbineBuilt
    );
    if (haul.lastHaulAt !== state.world.companion.lastHaulAt) {
      setState({
        ...state,
        world: {
          ...state.world,
          fuelReserve: haul.fuelReserve,
          companion: { ...state.world.companion, lastHaulAt: haul.lastHaulAt },
        },
        vessel: { ...state.vessel, inventory: haul.inventory },
      });
      changed = true;
    }
  }

  // Narag-Bund hauls coal from fuel reserve to drills (hearthTier >= 2)
  if (state.world.companion.befriended && state.world.hearthTier >= 2) {
    const drillHaul = advanceDrillHauling(
      state.world.fuelReserve,
      state.world.drills,
      state.world.hearthTier,
      state.world.turbineBuilt
    );
    if (drillHaul.hauled) {
      setState({
        ...state,
        world: {
          ...state.world,
          fuelReserve: drillHaul.fuelReserve,
          drills: drillHaul.drills,
        },
      });
      state = getState();
      changed = true;
    }
  }

  // Tick garden slots (passive plant growth)
  if (state.world.gardenSlots.length > 0) {
    const herbloreLevel = state.vessel.skills.herblore?.level ?? 1;
    const speedMult = growthSpeedMultiplier(herbloreLevel);
    const gardenResult = tickGarden(state.world.gardenSlots, now, speedMult);
    if (gardenResult.changed) {
      setState({ ...state, world: { ...state.world, gardenSlots: gardenResult.slots } });
      state = getState();
      changed = true;
    }
  }

  // Tick smelting engines — consume stockpile ore, produce ingots
  // straight into the player's inventory (2026-07-06 - previously
  // accumulated in a capped buffer requiring a manual "Collect" click
  // per engine, inconsistent with ore's own automatic stockpile drain
  // and flagged directly as one of three concrete bugs to fix).
  const engineEntries = Object.entries(state.world.smeltingEngines);
  if (engineEntries.length > 0) {
    let newEngines = { ...state.world.smeltingEngines };
    let newStockpile = { ...state.world.stockpileOre };
    let newFuelReserve = { ...state.world.fuelReserve };
    let newInventory = { ...state.vessel.inventory };
    let engineChanged = false;

    for (const [engineId, engineState] of engineEntries) {
      const def = SMELTING_ENGINE_DEFINITIONS.find((d) => d.id === engineId);
      if (!def || engineState.tier === 0) continue;

      const stockpileOre = (newStockpile[def.oreMaterialId] as number | undefined) ?? 0;
      const fuelAvail = def.id === "deepstone_engine"
        ? ((newFuelReserve["hearthsap"] as number | undefined) ?? 0)
        : ((newFuelReserve["coal"] as number | undefined) ?? 0);

      const engineSpeedMultiplier = state.world.turbineBuilt ? TURBINE_SMELT_SPEED_MULTIPLIER : 1;
      const result = tickSmeltingEngine(engineState, def, now, stockpileOre, fuelAvail, engineSpeedMultiplier);
      if (result.ranCycle) {
        newEngines = { ...newEngines, [engineId]: result.engine };
        newStockpile = {
          ...newStockpile,
          [def.oreMaterialId]: Math.max(0, stockpileOre - result.oreConsumed),
        };
        // Deposit produced ingots straight to inventory - no more
        // per-engine "Collect" step.
        if (result.ingotsProduced > 0) {
          newInventory = {
            ...newInventory,
            [def.ingotMaterialId]: ((newInventory[def.ingotMaterialId] as number | undefined) ?? 0) + result.ingotsProduced,
          };
        }
        // Deduct fuel - scaled by how many cycles actually ran this
        // tick (derived from oreConsumed / orePerCycle), not a flat
        // single-cycle amount. Fixed 2026-07-06: the old flat
        // deduction under-charged fuel whenever multiple cycles ran
        // in one tick (large time gaps, or the Turbine's 3x speed
        // making multi-cycle ticks routine) - directly undermining the
        // Turbine's whole point of scaling fuel consumption alongside
        // output.
        const cyclesRan = def.orePerCycle > 0 ? Math.round(result.oreConsumed / def.orePerCycle) : 0;
        const fuelConsumed = def.coalPerCycle * cyclesRan;
        if (def.id === "deepstone_engine") {
          newFuelReserve = { ...newFuelReserve, hearthsap: Math.max(0, ((newFuelReserve["hearthsap"] as number | undefined) ?? 0) - fuelConsumed) };
        } else {
          newFuelReserve = { ...newFuelReserve, coal: Math.max(0, ((newFuelReserve["coal"] as number | undefined) ?? 0) - fuelConsumed) };
        }
        engineChanged = true;
      }
    }

    if (engineChanged) {
      setState({
        ...state,
        world: { ...state.world, smeltingEngines: newEngines, stockpileOre: newStockpile, fuelReserve: newFuelReserve },
        vessel: { ...state.vessel, inventory: newInventory },
      });
      state = getState();
      changed = true;
    }
  }

  // Tick all built drills
  const drillEntries = Object.entries(state.world.drills);
  if (drillEntries.length > 0) {
    let newDrills = { ...state.world.drills };
    let newStockpile = { ...state.world.stockpileOre };
    const stockpileStage = (state.world.roomStates["stockpile_room"] ?? "ruined") as RoomStage;
    const stockpileActive =
      (stockpileStage === "cleared" ||
       stockpileStage === "restored" ||
       stockpileStage === "masterwork");
    let drillChanged = false;
    const speedMultiplier = drillSpeedMultiplier(state.world.mineshaftDepth);

    for (const [veinId, drillState] of drillEntries) {
      const def = drillDefinitionByVeinId(veinId);
      if (!def) continue;
      const result = tickDrill(drillState, def, now, speedMultiplier);
      if (result.ranCycle || result.drill.lastCycleAt !== drillState.lastCycleAt) {
        let finalDrill = result.drill;
        // If stockpile is active and ore was produced, drain ore buffer
        // into stockpile instead of holding it in the drill buffer -
        // but only up to the stockpile's own capacity (2026-07-06,
        // fixed alongside the "capacity upgrades do nothing" bug -
        // see stockpileCapacityPerMaterial in rooms.ts). Whatever
        // doesn't fit stays in the drill's own ore buffer, which is
        // itself capped - so a full stockpile creates a real, visible
        // bottleneck (the drill stops once ITS buffer fills too),
        // fixable by upgrading the room or collecting from it, rather
        // than silently discarding overflow or storing it without limit.
        if (stockpileActive && result.oreProduced > 0) {
          const oreMat = def.oreMaterialId;
          const currentStockpiled = newStockpile[oreMat] ?? 0;
          const capacity = stockpileCapacityPerMaterial(stockpileStage);
          const space = Math.max(0, capacity - currentStockpiled);
          const toStockpile = Math.min(space, result.oreProduced);
          newStockpile = {
            ...newStockpile,
            [oreMat]: currentStockpiled + toStockpile,
          };
          // Whatever didn't fit stays in the drill's own ore buffer
          // (it was already produced there before this drain step).
          finalDrill = { ...finalDrill, oreBuffer: result.oreProduced - toStockpile };
        }
        newDrills = { ...newDrills, [veinId]: finalDrill };
        drillChanged = true;
      }
    }
    if (drillChanged) {
      setState({
        ...state,
        world: { ...state.world, drills: newDrills, stockpileOre: newStockpile },
      });
      state = getState();
      changed = true;
    }
  }

  if (changed) render();
}

export function startGameLoop(): void {
  setInterval(gameTick, TICK_INTERVAL_MS);
}
