import { getState, setState, narrate } from "./gameState";
import { render } from "./render";
import {
  tickHearth,
  totalHearthFuelValue,
  isAutoTendingUnlocked,
  deductFuelValueFromReserve,
  advanceCompanionHauling,
  HEARTHKEEPING_XP_PER_FUEL_VALUE,
} from "../engine/hearth";
import { applyDwarfCountXpMultiplier, levelForXp } from "../engine/xpCurve";

export const TICK_INTERVAL_MS = 1000;

function gameTick(): void {
  let changed = false;
  const now = Date.now();
  let state = getState();

  if (isAutoTendingUnlocked(state.world.hearthTier)) {
    const fuelAvailable = totalHearthFuelValue(state.world.fuelReserve);
    const result = tickHearth(state.world.hearth, now, fuelAvailable);
    if (result.fuelAbsorbed > 0) {
      const newReserve = deductFuelValueFromReserve(state.world.fuelReserve, result.fuelAbsorbed);

      const rawXp = result.fuelAbsorbed * HEARTHKEEPING_XP_PER_FUEL_VALUE;
      const multipliedXp = applyDwarfCountXpMultiplier(rawXp, state.world.dwarfCount);
      const newHearthkeepingXp = state.vessel.skills.hearthkeeping.xp + multipliedXp;
      const newHearthkeeping = {
        ...state.vessel.skills.hearthkeeping,
        level: levelForXp(newHearthkeepingXp),
        xp: newHearthkeepingXp,
      };
      const leveledUp = newHearthkeeping.level > state.vessel.skills.hearthkeeping.level;

      setState({
        ...state,
        world: { ...state.world, hearth: result.hearth, fuelReserve: newReserve },
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

  if (changed) render();
}

export function startGameLoop(): void {
  setInterval(gameTick, TICK_INTERVAL_MS);
}
