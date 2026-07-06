import type { CellKind } from "./palette";

import rockWallUrl from "./tileset-assets/sliced/rock_wall.png";
import rockFloorUrl from "./tileset-assets/sliced/rock_floor.png";
import oreBaseUrl from "./tileset-assets/sliced/ore_base.png";
import oreCopperUrl from "./tileset-assets/sliced/ore_copper.png";
import oreIronUrl from "./tileset-assets/sliced/ore_iron.png";
import oreCoalUrl from "./tileset-assets/sliced/ore_coal.png";
import oreDeepUrl from "./tileset-assets/sliced/ore_deep.png";
import drillUrl from "./tileset-assets/sliced/drill.png";
import drillIronUrl from "./tileset-assets/sliced/drill_iron.png";
import drillDeepUrl from "./tileset-assets/sliced/drill_deep.png";
import mineshaftBrokenUrl from "./tileset-assets/sliced/mineshaft_broken.png";
import mineshaftLitUrl from "./tileset-assets/sliced/mineshaft_lit.png";
import kilnUrl from "./tileset-assets/sliced/kiln.png";
import sawmillUrl from "./tileset-assets/sliced/sawmill.png";
import dwarfUrl from "./tileset-assets/sliced/dwarf.png";
import tunnelEdgeUrl from "./tileset-assets/sliced/tunnel_edge.png";

// Multi-tile sprites
import forge4x4Url from "./tileset-assets/sliced/forge_4x4.png";
import hearth4x4Url from "./tileset-assets/sliced/hearth_4x4.png";
import smelterAddonUrl from "./tileset-assets/sliced/smelter_addon.png";
import gemcutting4x4Url from "./tileset-assets/sliced/gemcutting_4x4.png";
import torchLitUrl from "./tileset-assets/sliced/torch_lit.png";
import naragBundUrl from "./tileset-assets/sliced/narag_bund.png";
import stockpileChestUrl from "./tileset-assets/sliced/stockpile_chest.png";
import woodNodeUrl from "./tileset-assets/sliced/wood_node.png";
import planterBrokenUrl from "./tileset-assets/sliced/planter_broken.png";
import planterEmptyUrl from "./tileset-assets/sliced/planter_empty.png";
import planterSproutUrl from "./tileset-assets/sliced/planter_sprout.png";
import planterGrowingUrl from "./tileset-assets/sliced/planter_growing.png";
import planterMatureUrl from "./tileset-assets/sliced/planter_mature.png";
import planterGemwoodUrl from "./tileset-assets/sliced/planter_gemwood.png";
import planterFernUrl from "./tileset-assets/sliced/planter_fern.png";
import planterShroomUrl from "./tileset-assets/sliced/planter_shroom.png";
import tradePostUrl from "./tileset-assets/sliced/trade_post.png";
import drillCoalUrl from "./tileset-assets/sliced/drill_coal.png";
import mountainConsoleUrl from "./tileset-assets/sliced/mountain_console.png";

/**
 * Maps each CellKind to an actual tile image, instead of a glyph+color.
 * This is the tileset-mode equivalent of GLYPHS/STAGE_PALETTES in
 * palette.ts - same purpose (CellKind -> drawable), different medium.
 *
 * Source: Vettlingr 32x32 Dwarf Fortress tileset by vettlingr, used here
 * with the artist's explicit permission for this non-DF project.
 * Original: www.bay12forums.com/smf/index.php?topic=172078.0
 *
 * Several CellKinds share one base texture and are differentiated by a
 * COLOR TINT instead of unique art - this mirrors how DF itself
 * represents different stone/mineral types (recoloring generic stone
 * tiles) rather than hand-drawing a sprite per mineral.
 */

export interface TileDefinition {
  /** Resolved asset URL (already bundled by Vite via static import). */
  assetUrl: string;
  /**
   * Optional tint color (hex). When present, the tile is drawn once in
   * grayscale-preserving multiply mode with this color - same idea as
   * the glyph color in ASCII mode, just applied to a textured tile
   * instead of a flat character.
   */
  tint?: string;
  /**
   * For multi-tile sprites: how many grid cells this sprite spans in
   * each dimension. Defaults to { cols: 1, rows: 1 } when absent.
   * TilesetRenderer anchors the sprite at the top-left cell and draws
   * it at tileSpan.cols * cellSize wide, tileSpan.rows * cellSize tall.
   * Only the anchor cell triggers a draw; all other cells in the
   * footprint are skipped (their CellKind is still used for collision
   * etc. - the renderer just doesn't re-draw them).
   */
  tileSpan?: { cols: number; rows: number };
}

export const TILE_MANIFEST: Record<CellKind, TileDefinition> = {
  void: { assetUrl: "" }, // never drawn - render() skips void cells same as ASCII mode
  rock_wall: { assetUrl: rockWallUrl },
  rock_floor: { assetUrl: rockFloorUrl },
  ore_copper: { assetUrl: oreCopperUrl, tileSpan: { cols: 3, rows: 3 } },
  ore_iron: { assetUrl: oreIronUrl, tileSpan: { cols: 3, rows: 3 } },
  ore_deep: { assetUrl: oreDeepUrl, tileSpan: { cols: 3, rows: 3 } },
  ore_coal: { assetUrl: oreCoalUrl, tileSpan: { cols: 3, rows: 3 } },
  ore_exhausted: { assetUrl: rockFloorUrl },
  wood_exhausted: { assetUrl: rockFloorUrl },
  dwarf: { assetUrl: dwarfUrl },
  // Real 4x4 sprites (added 2026-06-30). tileSpan tells TilesetRenderer
  // to draw at 4x the normal cell size, anchored at the top-left cell.
  hearth: { assetUrl: hearth4x4Url, tileSpan: { cols: 6, rows: 6 } },
  forge: { assetUrl: forge4x4Url, tileSpan: { cols: 7, rows: 7 } },
  forge_broken: { assetUrl: forge4x4Url, tint: "#5a4a3a", tileSpan: { cols: 7, rows: 7 } },
  kiln: { assetUrl: kilnUrl, tileSpan: { cols: 3, rows: 3 } },
  sawmill: { assetUrl: sawmillUrl, tileSpan: { cols: 3, rows: 3 } },
  // Smelter add-on: 2x2 sprite sitting below the Forge.
  smelter: { assetUrl: smelterAddonUrl, tileSpan: { cols: 3, rows: 3 } },
  gemcutting: { assetUrl: gemcutting4x4Url, tileSpan: { cols: 6, rows: 6 } },
  // Unbuilt marker: same sprite but heavily tinted dark/cold so it reads as
  // 'the bench is here but cold and unused' rather than the active station.
  gemcutting_unbuilt: { assetUrl: gemcutting4x4Url, tint: "#3a3450", tileSpan: { cols: 6, rows: 6 } },
  rubble: { assetUrl: rockWallUrl, tint: "#6a5a40" },
  tunnel_edge: { assetUrl: tunnelEdgeUrl },
  torch_broken: { assetUrl: oreBaseUrl, tint: "#6a6a6a" },
  torch_lit: { assetUrl: torchLitUrl },
  companion: { assetUrl: naragBundUrl, tileSpan: { cols: 4, rows: 4 } },
  stockpile_chest: { assetUrl: stockpileChestUrl, tileSpan: { cols: 6, rows: 7 } },
  drill_copper: { assetUrl: drillUrl, tileSpan: { cols: 3, rows: 3 } },
  drill_iron: { assetUrl: drillIronUrl, tileSpan: { cols: 3, rows: 3 } },
  drill_deep: { assetUrl: drillDeepUrl, tileSpan: { cols: 3, rows: 3 } },
  mineshaft_broken: { assetUrl: mineshaftBrokenUrl, tileSpan: { cols: 3, rows: 3 } },
  mineshaft_lit: { assetUrl: mineshaftLitUrl, tileSpan: { cols: 3, rows: 3 } },
  mountain_console: { assetUrl: mountainConsoleUrl, tileSpan: { cols: 3, rows: 3 } },
  wood_node: { assetUrl: woodNodeUrl, tileSpan: { cols: 2, rows: 2 } },
  planter_broken: { assetUrl: planterBrokenUrl, tileSpan: { cols: 3, rows: 3 } },
  planter_empty: { assetUrl: planterEmptyUrl, tileSpan: { cols: 3, rows: 3 } },
  planter_sprout: { assetUrl: planterSproutUrl, tileSpan: { cols: 3, rows: 3 } },
  planter_growing: { assetUrl: planterGrowingUrl, tileSpan: { cols: 3, rows: 3 } },
  planter_mature: { assetUrl: planterMatureUrl, tileSpan: { cols: 3, rows: 3 } },
  planter_gemwood: { assetUrl: planterGemwoodUrl, tileSpan: { cols: 3, rows: 3 } },
  planter_fern: { assetUrl: planterFernUrl, tileSpan: { cols: 3, rows: 3 } },
  planter_shroom: { assetUrl: planterShroomUrl, tileSpan: { cols: 3, rows: 3 } },
  trade_post: { assetUrl: tradePostUrl, tileSpan: { cols: 5, rows: 5 } },
  drill_coal: { assetUrl: drillCoalUrl, tileSpan: { cols: 3, rows: 3 } },
};

export const NATIVE_TILE_SIZE = 32;
