import type { CellKind } from "./palette";

// Vite requires actual import statements (not dynamic string paths) to
// recognize these as static assets it should bundle/hash/copy into the
// build output. Each import resolves to a final, fingerprinted URL.
import rockWallUrl from "./tileset-assets/sliced/rock_wall.png";
import rockFloorUrl from "./tileset-assets/sliced/rock_floor.png";
import oreBaseUrl from "./tileset-assets/sliced/ore_base.png";
import oreDeepUrl from "./tileset-assets/sliced/ore_deep.png";
import dwarfUrl from "./tileset-assets/sliced/dwarf.png";
import tunnelEdgeUrl from "./tileset-assets/sliced/tunnel_edge.png";

// New multi-tile sprites (added 2026-06-30)
import forge4x4Url from "./tileset-assets/sliced/forge_4x4.png";
import hearth4x4Url from "./tileset-assets/sliced/hearth_4x4.png";
import smelterAddonUrl from "./tileset-assets/sliced/smelter_addon.png";
import gemcutting4x4Url from "./tileset-assets/sliced/gemcutting_4x4.png";
import torchLitUrl from "./tileset-assets/sliced/torch_lit.png";
import naragBundUrl from "./tileset-assets/sliced/narag_bund.png";

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
  ore_copper: { assetUrl: oreBaseUrl, tint: "#d4894a" },
  ore_iron: { assetUrl: oreBaseUrl, tint: "#9aa3ad" },
  ore_deep: { assetUrl: oreDeepUrl }, // unique texture, no tint needed
  ore_coal: { assetUrl: oreBaseUrl, tint: "#3a3530" },
  ore_exhausted: { assetUrl: rockFloorUrl },
  wood_node: { assetUrl: oreBaseUrl, tint: "#7a8a4a" },
  wood_exhausted: { assetUrl: rockFloorUrl },
  dwarf: { assetUrl: dwarfUrl },
  // Real 4x4 sprites (added 2026-06-30). tileSpan tells TilesetRenderer
  // to draw at 4x the normal cell size, anchored at the top-left cell.
  hearth: { assetUrl: hearth4x4Url, tileSpan: { cols: 4, rows: 4 } },
  forge: { assetUrl: forge4x4Url, tileSpan: { cols: 4, rows: 4 } },
  forge_broken: { assetUrl: forge4x4Url, tint: "#5a4a3a", tileSpan: { cols: 4, rows: 4 } },
  kiln: { assetUrl: oreBaseUrl, tint: "#8a5a3a" },
  // Smelter add-on: 2x2 sprite sitting below the Forge.
  smelter: { assetUrl: smelterAddonUrl, tileSpan: { cols: 2, rows: 2 } },
  gemcutting: { assetUrl: gemcutting4x4Url, tileSpan: { cols: 4, rows: 4 } },
  // Unbuilt marker: same sprite but heavily tinted dark/cold so it reads as
  // 'the bench is here but cold and unused' rather than the active station.
  gemcutting_unbuilt: { assetUrl: gemcutting4x4Url, tint: "#3a3450", tileSpan: { cols: 4, rows: 4 } },
  rubble: { assetUrl: rockWallUrl, tint: "#6a5a40" },
  tunnel_edge: { assetUrl: tunnelEdgeUrl },
  torch_broken: { assetUrl: oreBaseUrl, tint: "#6a6a6a" },
  torch_lit: { assetUrl: torchLitUrl },
  companion: { assetUrl: naragBundUrl },
  mountain_console: { assetUrl: rockWallUrl, tint: "#2a5a7a" },
};

export const NATIVE_TILE_SIZE = 32;
