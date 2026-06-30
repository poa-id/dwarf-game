import { TILE_MANIFEST, type TileDefinition } from "./tilesetManifest";
import type { CellKind } from "./palette";

/**
 * Loads and caches tile images, and produces tinted variants on demand.
 * Tinting is done once per (asset, tint) pair via offscreen canvas
 * compositing (multiply blend preserves the texture's shading while
 * applying the target hue) and cached - never re-tinted per frame.
 */
export class TileCache {
  private baseImages = new Map<string, HTMLImageElement>();
  private tintedCanvases = new Map<string, HTMLCanvasElement>();
  private loadPromises = new Map<string, Promise<HTMLImageElement>>();

  private loadImage(assetUrl: string): Promise<HTMLImageElement> {
    const existing = this.loadPromises.get(assetUrl);
    if (existing) return existing;

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.baseImages.set(assetUrl, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load tile asset: ${assetUrl}`));
      img.src = assetUrl;
    });

    this.loadPromises.set(assetUrl, promise);
    return promise;
  }

  /**
   * Preload every distinct asset referenced in the manifest. Call this
   * once at startup before the first render() - rendering before this
   * resolves will simply skip undrawn tiles rather than throwing, so
   * callers should await this for a correct first frame.
   */
  async preloadAll(): Promise<void> {
    const uniqueAssetUrls = new Set<string>();
    for (const def of Object.values(TILE_MANIFEST)) {
      if (def.assetUrl) uniqueAssetUrls.add(def.assetUrl);
    }
    await Promise.all([...uniqueAssetUrls].map((url) => this.loadImage(url)));

    // Pre-tint every (asset, tint) pair up front too, so render() never
    // does synchronous tinting work mid-frame.
    for (const def of Object.values(TILE_MANIFEST)) {
      if (def.tint) {
        this.getTintedCanvas(def);
      }
    }
  }

  private tintCacheKey(def: TileDefinition): string {
    return `${def.assetUrl}::${def.tint ?? ""}`;
  }

  /**
   * Returns a ready-to-draw canvas for this tile definition: the plain
   * loaded image if no tint, or a cached tinted version if one is set.
   * Returns null if the base image hasn't finished loading yet -
   * callers should treat that as "skip this frame's draw for this cell."
   */
  getDrawable(def: TileDefinition): HTMLCanvasElement | HTMLImageElement | null {
    const base = this.baseImages.get(def.assetUrl);
    if (!base) return null;
    if (!def.tint) return base;
    return this.getTintedCanvas(def) ?? null;
  }

  private getTintedCanvas(def: TileDefinition): HTMLCanvasElement | null {
    const key = this.tintCacheKey(def);
    const cached = this.tintedCanvases.get(key);
    if (cached) return cached;

    const base = this.baseImages.get(def.assetUrl);
    if (!base || !def.tint) return null;

    const canvas = document.createElement("canvas");
    // Use the actual loaded image dimensions, not always NATIVE_TILE_SIZE -
    // multi-tile sprites (forge_4x4.png = 128x128, smelter_addon.png = 64x64)
    // need to be tinted at their real size so drawImage can read the full
    // artwork, not just the top-left 32x32 corner.
    canvas.width = base.naturalWidth || base.width;
    canvas.height = base.naturalHeight || base.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = def.tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    this.tintedCanvases.set(key, canvas);
    return canvas;
  }

  getDrawableForKind(kind: CellKind): HTMLCanvasElement | HTMLImageElement | null {
    return this.getDrawable(TILE_MANIFEST[kind]);
  }
}
