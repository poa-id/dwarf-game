import emptySlotUrl from "./tool-icons/processed/tool_empty_slot.webp";
import copperPickaxeUrl from "./tool-icons/processed/tool_copper_pickaxe.webp";
import copperAxeUrl from "./tool-icons/processed/tool_copper_axe.webp";
import ironPickaxeUrl from "./tool-icons/processed/tool_iron_pickaxe.webp";
import ironAxeUrl from "./tool-icons/processed/tool_iron_axe.webp";
import deepstonePickaxeUrl from "./tool-icons/processed/tool_deepstone_pickaxe.webp";
import deepstoneAxeUrl from "./tool-icons/processed/tool_deepstone_axe.webp";

/**
 * Tool tier icons for the Bag tab's tools display (added 2026-07-03,
 * same treatment as skillIconManifest.ts - gated behind the same
 * Perception Is Progression colorStage threshold, see
 * toolsIconPanel.ts's doc comment). Indexed by ToolTier (0-3): tier 0
 * (Bare Hands) uses the empty-slot art rather than no icon at all, so
 * an un-forged slot still reads as "a slot", not a layout gap.
 */
export const PICKAXE_ICONS: [string, string, string, string] = [
  emptySlotUrl,
  copperPickaxeUrl,
  ironPickaxeUrl,
  deepstonePickaxeUrl,
];

export const AXE_ICONS: [string, string, string, string] = [
  emptySlotUrl,
  copperAxeUrl,
  ironAxeUrl,
  deepstoneAxeUrl,
];
