/**
 * Trade Hall panel — shown when the player is near the south corridor
 * or the merchant post once the Trade Hall is cleared.
 */

import type { GameState } from "../engine/types";
import { MATERIALS, deductMaterials, getMaterialAmount } from "../engine/types";
import { ROOM_DEFINITIONS, canAdvanceRoom, stageDef, nextStage } from "../engine/rooms";
import {
  availableOffers,
  merchantIsPresent,
  nextMerchantInMs,
  executeTrade,
} from "../engine/trade";

const TRADE_HALL_DEF = ROOM_DEFINITIONS.find((r) => r.id === "trade_hall")!;

export function renderTradeHallPanel(
  state: GameState,
  container: HTMLElement,
  onAdvanceRoom: () => void,
  onTrade: (offerId: string) => void
): void {
  container.innerHTML = "";
  const currentStage = state.world.roomStates["trade_hall"] ?? "ruined";
  const current = stageDef(TRADE_HALL_DEF, currentStage);
  const next = nextStage(currentStage);
  const nextDef = next ? stageDef(TRADE_HALL_DEF, next) : null;
  const canAdvance = next ? canAdvanceRoom(
    TRADE_HALL_DEF,
    currentStage,
    state.vessel.inventory as Record<string, number>,
    state.world.insightBanked
  ) : false;

  const now = Date.now();
  const present = merchantIsPresent(currentStage, state.world.lastMerchantAt, now);
  const nextInMs = present ? 0 : nextMerchantInMs(currentStage, state.world.lastMerchantAt, now);
  const nextInMin = Math.ceil(nextInMs / 60_000);

  let html = `<h2>${current.label}</h2>`;

  if (currentStage === "ruined") {
    html += `<p class="reserve-status">${current.description}</p>`;
  } else if (!present) {
    html += `
      <p class="reserve-status" style="color:#c8a830;">Merchant not yet arrived.</p>
      <p class="reserve-status">Next visit in ~${nextInMin} minute${nextInMin !== 1 ? "s" : ""}.</p>
      <p class="reserve-status" style="font-size:0.8em;opacity:0.7;">Cut gems are trade goods. The merchant carries what the mountain cannot make.</p>
    `;
  } else {
    html += `<p class="reserve-status" style="color:#c8a830;">✦ Merchant is here.</p>`;
    const offers = availableOffers(currentStage);
    for (const offer of offers) {
      const giveName = MATERIALS[offer.giveId]?.name ?? offer.giveId;
      const recvName = MATERIALS[offer.receiveId]?.name ?? offer.receiveId;
      const canAfford = getMaterialAmount(state.vessel.inventory, offer.giveId) >= offer.giveAmount;
      html += `
        <div class="recipe-row ${canAfford ? "" : "recipe-row-disabled"}" data-offer="${offer.id}">
          <div class="recipe-name">${offer.giveAmount} ${giveName} → ${offer.receiveAmount} ${recvName}</div>
          <div class="recipe-status">${offer.description}</div>
        </div>`;
    }
  }

  // Advance stage button
  if (nextDef) {
    const costText = [
      ...Object.entries(nextDef.cost).map(([m, a]) => `${a} ${MATERIALS[m]?.name ?? m}`),
      nextDef.insightCost > 0 ? `${nextDef.insightCost} Insight` : null,
    ].filter(Boolean).join(", ");

    html += `
      <div class="recipe-row ${canAdvance ? "" : "recipe-row-disabled"}" data-advance="true">
        <div class="recipe-name">${nextDef.label}</div>
        <div class="recipe-status">${canAdvance ? costText : `Need: ${costText}`}</div>
      </div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll<HTMLDivElement>("[data-offer]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      onTrade(row.dataset.offer ?? "");
    });
  });

  container.querySelector<HTMLDivElement>("[data-advance='true']")
    ?.addEventListener("click", () => { if (canAdvance) onAdvanceRoom(); });
}

// ---------------------------------------------------------------------------
// Perform functions
// ---------------------------------------------------------------------------

export function performAdvanceTradeHall(state: GameState): GameState {
  const currentStage = state.world.roomStates["trade_hall"] ?? "ruined";
  const next = nextStage(currentStage);
  if (!next) return state;

  const nextDef = stageDef(TRADE_HALL_DEF, next);
  if (!canAdvanceRoom(TRADE_HALL_DEF, currentStage, state.vessel.inventory as Record<string, number>, state.world.insightBanked)) {
    return state;
  }

  const newInventory = deductMaterials(state.vessel.inventory, nextDef.cost);
  return {
    ...state,
    world: {
      ...state.world,
      insightBanked: state.world.insightBanked - nextDef.insightCost,
      roomStates: { ...state.world.roomStates, trade_hall: next },
    },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}

import { TRADE_OFFERS } from "../engine/trade";

export function performTrade(state: GameState, offerId: string): GameState {
  const offer = TRADE_OFFERS.find((o) => o.id === offerId);
  if (!offer) return state;

  const result = executeTrade(offer, state.vessel.inventory);
  if (!result.success) return state;

  // Reset merchant timer after a successful trade (they leave after business)
  return {
    ...state,
    world: { ...state.world, lastMerchantAt: Date.now() },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
}

export function isNearTradeHall(position: { col: number; row: number }): boolean {
  // South corridor: cols 39-41, rows 33-45 + sealed_south room: cols 35-45, rows 38-45
  return (
    (position.col >= 35 && position.col <= 45 && position.row >= 35 && position.row <= 45) ||
    (position.col >= 39 && position.col <= 41 && position.row >= 33 && position.row <= 37)
  );
}
