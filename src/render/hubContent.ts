import { createEmptyGrid, type GridCell } from "./GridRenderer";
import { stampSprite } from "./sprites";
import { FORGE_BUILDING } from "./exampleSprites";
import { HUB_WIDTH, HUB_HEIGHT, ZONES, LIGHT_SOURCES } from "../engine/hubMap";
import type { LitTorchSet } from "../engine/types";

/**
 * Builds the Hub's static terrain content ONCE - this is hand-designed
 * level content, not generated per-playthrough. The result is cached
 * (see getHubGrid below) since it never changes; only its VISIBILITY
 * (computed separately, per-frame, from game state) changes over time.
 *
 * Carves out open floor inside each zone's bounds, leaves everything
 * else as wall, and connects zones with simple straight corridors so
 * movement between unlocked areas is always possible once both ends
 * are reachable.
 *
 * Torch positions are baked into this static grid as "torch_broken" -
 * that's their permanent terrain identity. Whether a given torch
 * currently reads as broken or lit is a SEPARATE, dynamic question
 * (depends on WorldState.litTorches) answered by hubCellAt below, not
 * by this function - same split as zones (fixed bounds vs dynamic
 * unlock state).
 */
function buildHubContent(): GridCell[] {
  const grid = createEmptyGrid(HUB_WIDTH, HUB_HEIGHT).map(
    () => ({ kind: "rock_wall" }) as GridCell
  );

  const set = (col: number, row: number, kind: GridCell["kind"]) => {
    if (col < 0 || col >= HUB_WIDTH || row < 0 || row >= HUB_HEIGHT) return;
    grid[row * HUB_WIDTH + col] = { kind };
  };

  // Carve floor inside every zone's bounding box.
  for (const zone of ZONES) {
    const { col, row, width, height } = zone.bounds;
    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        set(c, r, "rock_floor");
      }
    }
  }

  // Simple straight-line corridors connecting each zone's center back to
  // the hearth hall's center - good enough for v1, a hand-authored map
  // could replace this with deliberate winding passages later.
  const hearthHall = ZONES.find((z) => z.id === "hearth_hall")!;
  const hearthCenter = {
    col: hearthHall.bounds.col + Math.floor(hearthHall.bounds.width / 2),
    row: hearthHall.bounds.row + Math.floor(hearthHall.bounds.height / 2),
  };

  for (const zone of ZONES) {
    if (zone.id === "hearth_hall") continue;
    const center = {
      col: zone.bounds.col + Math.floor(zone.bounds.width / 2),
      row: zone.bounds.row + Math.floor(zone.bounds.height / 2),
    };
    carveCorridor(set, hearthCenter, center);
  }

  // Drop the forge building sprite into the forge room, roughly centered.
  const forgeRoom = ZONES.find((z) => z.id === "forge_room")!;
  const forgeOriginCol = forgeRoom.bounds.col + Math.floor((forgeRoom.bounds.width - 4) / 2);
  const forgeOriginRow = forgeRoom.bounds.row + Math.floor((forgeRoom.bounds.height - 4) / 2);
  const stamped = stampSprite(grid, HUB_WIDTH, HUB_HEIGHT, FORGE_BUILDING, {
    col: forgeOriginCol,
    row: forgeOriginRow,
  });

  // Place the hearth itself at the hearth hall's center.
  const hearthIndex = hearthCenter.row * HUB_WIDTH + hearthCenter.col;
  stamped[hearthIndex] = { kind: "hearth" };

  // Place every torch's terrain marker - always "broken" in the static
  // content; hubCellAt overrides to "torch_lit" dynamically per the
  // current WorldState.
  for (const torch of LIGHT_SOURCES) {
    const idx = torch.position.row * HUB_WIDTH + torch.position.col;
    stamped[idx] = { kind: "torch_broken" };
  }

  return stamped;
}

function carveCorridor(
  set: (col: number, row: number, kind: GridCell["kind"]) => void,
  from: { col: number; row: number },
  to: { col: number; row: number }
): void {
  // L-shaped corridor: horizontal then vertical. Simple, readable,
  // good enough until we want hand-placed or winding paths.
  const startCol = Math.min(from.col, to.col);
  const endCol = Math.max(from.col, to.col);
  for (let c = startCol; c <= endCol; c++) {
    set(c, from.row, "rock_floor");
  }
  const startRow = Math.min(from.row, to.row);
  const endRow = Math.max(from.row, to.row);
  for (let r = startRow; r <= endRow; r++) {
    set(to.col, r, "rock_floor");
  }
}

let cachedHubGrid: GridCell[] | null = null;

/** The Hub's static content, built once and cached - this never changes during play. */
export function getHubGrid(): GridCell[] {
  if (!cachedHubGrid) {
    cachedHubGrid = buildHubContent();
  }
  return cachedHubGrid;
}

export function hubCellAt(col: number, row: number, litTorches: LitTorchSet = {}): GridCell {
  if (col < 0 || col >= HUB_WIDTH || row < 0 || row >= HUB_HEIGHT) {
    return { kind: "void" };
  }

  const staticCell = getHubGrid()[row * HUB_WIDTH + col];

  if (staticCell.kind === "torch_broken") {
    const torch = LIGHT_SOURCES.find((t) => t.position.col === col && t.position.row === row);
    if (torch && litTorches[torch.id]) {
      return { kind: "torch_lit" };
    }
  }

  return staticCell;
}
