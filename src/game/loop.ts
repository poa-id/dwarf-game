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
import { applyDwarfCountXpMultiplier, levelForXp, insightFromXp } from "../engine/xpCurve";
import { tickDrill, drillDefinitionByVeinId } from "../engine/drill";
import { getRestorationScore } from "../engine/production";

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
      const newInsightBanked = state.world.insightBanked + insightFromXp(multipliedXp);

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
      now
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
      state.world.hearthTier
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

  // Tick all built drills
  const drillEntries = Object.entries(state.world.drills);
  if (drillEntries.length > 0) {
    let newDrills = { ...state.world.drills };
    let newStockpile = { ...state.world.stockpileOre };
    const stockpileActive =
      (state.world.roomStates["stockpile_room"] === "cleared" ||
       state.world.roomStates["stockpile_room"] === "restored" ||
       state.world.roomStates["stockpile_room"] === "masterwork");
    let drillChanged = false;

    for (const [veinId, drillState] of drillEntries) {
      const def = drillDefinitionByVeinId(veinId);
      if (!def) continue;
      const result = tickDrill(drillState, def, now);
      if (result.ranCycle || result.drill.lastCycleAt !== drillState.lastCycleAt) {
        let finalDrill = result.drill;
        // If stockpile is active and ore was produced, drain ore buffer
        // into stockpile instead of holding it in the drill buffer
        if (stockpileActive && result.oreProduced > 0) {
          const oreMat = def.oreMaterialId;
          newStockpile = {
            ...newStockpile,
            [oreMat]: (newStockpile[oreMat] ?? 0) + result.oreProduced,
          };
          // Clear the ore buffer so the drill keeps running
          finalDrill = { ...finalDrill, oreBuffer: 0 };
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
