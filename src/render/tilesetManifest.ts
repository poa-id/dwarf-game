import type { CellKind } from "./palette";

// Vite requires actual import statements (not dynamic string paths) to
// recognize these as static assets it should bundle/hash/copy into the
// build output. Each import resolves to a final, fingerprinted URL.
import rockWallUrl from "./tileset-assets/sliced/rock_wall.png";
import rockFloorUrl from "./tileset-assets/sliced/rock_floor.png";
import oreBaseUrl from "./tileset-assets/sliced/ore_base.png";
import oreDeepUrl from "./tileset-assets/sliced/ore_deep.png";
import forgeUrl from "./tileset-assets/sliced/forge.png";
import dwarfUrl from "./tileset-assets/sliced/dwarf.png";
import tunnelEdgeUrl from "./tileset-assets/sliced/tunnel_edge.png";

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
}

export const TILE_MANIFEST: Record<CellKind, TileDefinition> = {
  void: { assetUrl: "" }, // never drawn - render() skips void cells same as ASCII mode
  rock_wall: { assetUrl: rockWallUrl },
  rock_floor: { assetUrl: rockFloorUrl },
  ore_copper: { assetUrl: oreBaseUrl, tint: "#d4894a" },
  ore_iron: { assetUrl: oreBaseUrl, tint: "#9aa3ad" },
  ore_deep: { assetUrl: oreDeepUrl }, // unique texture, no tint needed
  ore_exhausted: { assetUrl: rockFloorUrl }, // spent rock - same texture as plain floor
  dwarf: { assetUrl: dwarfUrl },
  hearth: { assetUrl: forgeUrl },
  forge: { assetUrl: forgeUrl },
  tunnel_edge: { assetUrl: tunnelEdgeUrl },
  // No dedicated torch sprite sliced from the tileset yet - reusing the
  // forge's glow art as a placeholder, tinted to distinguish broken
  // (desaturated) from lit (warm). Swap for a real torch/lamp tile once
  // one is sliced from the sheets.
  torch_broken: { assetUrl: forgeUrl, tint: "#6a6a6a" },
  torch_lit: { assetUrl: forgeUrl, tint: "#ff9a3a" },
};

export const NATIVE_TILE_SIZE = 32;
