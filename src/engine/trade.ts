/**
 * Trade Hall — merchant post in the South room (sealed_south).
 *
 * Philosophy: gems are the ONLY trade currency. The merchant sells
 * things the mountain CANNOT produce itself — foreign seeds, rare
 * materials from distant mines, exotic fuels. Nothing here duplicates
 * what the player can make; everything opens a new path.
 *
 * Merchant arrival:
 *   Cleared:     every 10 minutes
 *   Restored:    every 5 minutes
 *   Masterwork:  always present
 */

import type { MaterialId } from "../engine/types";
import { getMaterialAmount, addMaterial, deductMaterials } from "../engine/types";
import type { ResourceBag } from "../engine/types";

export interface TradeOffer {
  id: string;
  giveId: MaterialId;
  giveAmount: number;
  receiveId: MaterialId;
  receiveAmount: number;
  minStage: "cleared" | "restored" | "masterwork";
  description: string; // where did this come from?
}

export const TRADE_OFFERS: TradeOffer[] = [
  // ── Cleared: basic gem trades ─────────────────────────────────────────
  // Cave fern spore — foreign caves, not native to this mountain
  {
    id: "quartz_for_fern_spore",
    giveId: "cut_quartz",
    giveAmount: 2,
    receiveId: "cave_fern_spore",
    receiveAmount: 1,
    minStage: "cleared",
    description: "From caves further east. Grows fast in still air.",
  },
  // Ancient seed — the merchant calls it 'Ironwood from the old groves'
  {
    id: "quartz_for_ancient_seed",
    giveId: "cut_quartz",
    giveAmount: 5,
    receiveId: "ancient_seed",
    receiveAmount: 1,
    minStage: "cleared",
    description: "A slow-growing tree. Worth the wait.",
  },
  // Hearthsap in quantity — rendered elsewhere but the merchant carries
  // pre-rendered stock from working kilns in other holds
  {
    id: "garnet_for_hearthsap",
    giveId: "cut_garnet",
    giveAmount: 2,
    receiveId: "hearthsap",
    receiveAmount: 2,
    minStage: "cleared",
    description: "Already rendered. Foreign kiln-work.",
  },

  // ── Restored: rarer, deeper, irreplaceable ────────────────────────────
  // Ancient heartwood seed — only the merchant has these
  {
    id: "garnet_for_heartwood_seed",
    giveId: "cut_garnet",
    giveAmount: 4,
    receiveId: "ancient_seed_rare",
    receiveAmount: 1,
    minStage: "restored",
    description: "Two-hour tree. The merchant won't say where he found it.",
  },
  // Ironwood in bulk — saves 30 minutes of growing time
  {
    id: "amethyst_for_ironwood",
    giveId: "cut_amethyst",
    giveAmount: 1,
    receiveId: "ironwood",
    receiveAmount: 5,
    minStage: "restored",
    description: "Cut from felled trees in the valley. Dense as iron.",
  },
  // Deepstone ingot — pre-smelted, bypasses the hearthsap requirement
  {
    id: "amethyst_for_deepstone_ingot",
    giveId: "cut_amethyst",
    giveAmount: 3,
    receiveId: "deepstone_ingot",
    receiveAmount: 1,
    minStage: "restored",
    description: "Smelted in a working deep-forge. The merchant asks no questions.",
  },

  // ── Masterwork: truly rare ─────────────────────────────────────────────
  // True metals — incredibly expensive, near-impossible to get by trading
  {
    id: "amethyst_for_true_copper",
    giveId: "cut_amethyst",
    giveAmount: 8,
    receiveId: "true_copper",
    receiveAmount: 1,
    minStage: "masterwork",
    description: "Purified far away. He does not reveal the process.",
  },
  {
    id: "amethyst_for_true_iron",
    giveId: "cut_amethyst",
    giveAmount: 12,
    receiveId: "true_iron",
    receiveAmount: 1,
    minStage: "masterwork",
    description: "Rarer still. A dwarf who trades for this hasn't earned it — but might use it.",
  },
];

export function availableOffers(stage: string): TradeOffer[] {
  const stageOrder = ["ruined", "cleared", "restored", "masterwork"];
  const stageIdx = stageOrder.indexOf(stage);
  return TRADE_OFFERS.filter((o) => stageOrder.indexOf(o.minStage) <= stageIdx);
}

const MERCHANT_INTERVAL_MS: Record<string, number> = {
  cleared:    10 * 60 * 1000,
  restored:    5 * 60 * 1000,
  masterwork:  0,
};

export function merchantIsPresent(stage: string, lastMerchantAt: number, now: number): boolean {
  if (stage === "ruined") return false;
  if (stage === "masterwork") return true;
  return (now - lastMerchantAt) >= (MERCHANT_INTERVAL_MS[stage] ?? Infinity);
}

export function nextMerchantInMs(stage: string, lastMerchantAt: number, now: number): number {
  const interval = MERCHANT_INTERVAL_MS[stage] ?? Infinity;
  return Math.max(0, interval - (now - lastMerchantAt));
}

export function executeTrade(offer: TradeOffer, inventory: ResourceBag): { inventory: ResourceBag; success: boolean } {
  if (getMaterialAmount(inventory, offer.giveId) < offer.giveAmount) return { inventory, success: false };
  const updated = deductMaterials(inventory, { [offer.giveId]: offer.giveAmount });
  return { inventory: addMaterial(updated, offer.receiveId, offer.receiveAmount), success: true };
}
