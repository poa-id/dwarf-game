import miningUrl from "./skill-icons/processed/skill_mining.webp";
import smithingUrl from "./skill-icons/processed/skill_smithing.webp";
import hearthkeepingUrl from "./skill-icons/processed/skill_hearthkeeping.webp";
import woodcraftUrl from "./skill-icons/processed/skill_woodcraft.webp";
import tinkeringUrl from "./skill-icons/processed/skill_tinkering.webp";
import herbloreUrl from "./skill-icons/processed/skill_herblore.webp";
import brewingUrl from "./skill-icons/processed/skill_brewing.webp";

/**
 * Skill badge icons for the Skills tab grid (RuneScape-inspired layout,
 * added 2026-07-03). Distinct art style from the Vettlingr tileset used
 * for world sprites - these are ornate framed badges, not flat 32x32
 * DF-style tiles, so they're kept in their own manifest rather than
 * folded into tilesetManifest.ts (which maps CellKind -> world tile).
 *
 * Source images arrived at slightly different crop tightness (some had
 * extra black padding inside the 1254x1254 canvas). All seven were
 * re-cropped to their actual badge content bbox and normalized to a
 * common 320x320 square so the frames read as the same physical size
 * in the grid - see skill-icons/source/ vs skill-icons/processed/.
 */
export const SKILL_ICONS: Record<
  "mining" | "smithing" | "hearthkeeping" | "woodcraft" | "tinkering" | "herblore" | "brewing",
  string
> = {
  mining: miningUrl,
  smithing: smithingUrl,
  hearthkeeping: hearthkeepingUrl,
  woodcraft: woodcraftUrl,
  tinkering: tinkeringUrl,
  herblore: herbloreUrl,
  brewing: brewingUrl,
};
