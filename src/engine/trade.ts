/**
 * Trade Hall — merchant post in the South room (sealed_south).
 *
 * Merchants arrive on a timer once the Trade Hall is cleared:
 *   Cleared:     every 10 minutes
 *   Restored:    every 5 minutes
 *   Masterwork:  always present
 *
 * They buy cut gems and sell rare materials the mountain can't
 * produce itself (cave fern spores, foreign wood, exotic fuels).
 *
 * The lore hook: "boots on the bridge, heavier than any single dwarf."
 * A merchant arrives — the narrator notices. The mountain is no longer
 * alone. Trade routes are re-forming around the restored hold.
 *
 * This makes cut gems valuable beyond the Tinkering perk tree. A gem
 * economy emerges: mine deeper → cut gems → trade → rare seeds →
 * garden grows → hearthsap → deepstone smelted → tier 3 tools →
 * deeper mining. The loop tightens with every upgrade.
 */

import type { MaterialId } from "../engine/types";
import { getMaterialAmount, addMaterial, deductMaterials } from "../engine/types";
import type { ResourceBag } from "../engine/types";

// ---------------------------------------------------------------------------
// Merchant inventory — what they buy and sell
// ---------------------------------------------------------------------------

export interface TradeOffer {
  id: string;
  /** What the player gives */
  giveId: MaterialId;
  giveAmount: number;
  /** What the player receives */
  receiveId: MaterialId;
  receiveAmount: number;
  /** Only available at this trade hall stage or higher */
  minStage: "cleared" | "restored" | "masterwork";
}

export const TRADE_OFFERS: TradeOffer[] = [
  // Buying cut gems — the core trade
  {
    id: "quartz_for_spore",
    giveId: "cut_quartz",
    giveAmount: 3,
    receiveId: "stoneshroom_spore",
    receiveAmount: 2,
    minStage: "cleared",
  },
  {
    id: "quartz_for_coal",
    giveId: "cut_quartz",
    giveAmount: 5,
    receiveId: "coal",
    receiveAmount: 8,
    minStage: "cleared",
  },
  {
    id: "garnet_for_fern_spore",
    giveId: "cut_garnet",
    giveAmount: 2,
    receiveId: "cave_fern_spore",
    receiveAmount: 1,
    minStage: "restored",
  },
  {
    id: "garnet_for_ancient_seed",
    giveId: "cut_garnet",
    giveAmount: 5,
    receiveId: "ancient_seed",
    receiveAmount: 1,
    minStage: "restored",
  },
  {
    id: "amethyst_for_ironwood",
    giveId: "cut_amethyst",
    giveAmount: 1,
    receiveId: "ironwood",
    receiveAmount: 3,
    minStage: "restored",
  },
  {
    id: "amethyst_for_rare_seed",
    giveId: "cut_amethyst",
    giveAmount: 3,
    receiveId: "ancient_seed_rare",
    receiveAmount: 1,
    minStage: "masterwork",
  },
];

export function availableOffers(stage: string): TradeOffer[] {
  const stageOrder = ["ruined", "cleared", "restored", "masterwork"];
  const stageIdx = stageOrder.indexOf(stage);
  return TRADE_OFFERS.filter((o) => stageOrder.indexOf(o.minStage) <= stageIdx);
}

// ---------------------------------------------------------------------------
// Merchant arrival timer
// ---------------------------------------------------------------------------

const MERCHANT_INTERVAL_MS: Record<string, number> = {
  cleared: 10 * 60 * 1000,   // 10 min
  restored: 5 * 60 * 1000,   // 5 min
  masterwork: 0,               // always present
};

export function merchantIsPresent(
  tradeHallStage: string,
  lastMerchantAt: number,
  now: number
): boolean {
  if (tradeHallStage === "ruined") return false;
  if (tradeHallStage === "masterwork") return true;
  const interval = MERCHANT_INTERVAL_MS[tradeHallStage] ?? Infinity;
  return (now - lastMerchantAt) >= interval;
}

export function nextMerchantInMs(
  tradeHallStage: string,
  lastMerchantAt: number,
  now: number
): number {
  const interval = MERCHANT_INTERVAL_MS[tradeHallStage] ?? Infinity;
  return Math.max(0, interval - (now - lastMerchantAt));
}

// ---------------------------------------------------------------------------
// Trade execution
// ---------------------------------------------------------------------------

export interface TradeResult {
  inventory: ResourceBag;
  success: boolean;
}

export function executeTrade(
  offer: TradeOffer,
  inventory: ResourceBag
): TradeResult {
  const held = getMaterialAmount(inventory, offer.giveId);
  if (held < offer.giveAmount) {
    return { inventory, success: false };
  }
  const updated = deductMaterials(inventory, { [offer.giveId]: offer.giveAmount });
  return {
    inventory: addMaterial(updated, offer.receiveId, offer.receiveAmount),
    success: true,
  };
}
