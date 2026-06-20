import { createEmptyGrid, type GridCell } from "./GridRenderer";
import { stampSprite } from "./sprites";
import { FORGE_BUILDING } from "./exampleSprites";
import { HUB_WIDTH, HUB_HEIGHT, ZONES } from "../engine/hubMap";

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

export function hubCellAt(col: number, row: number): GridCell {
  if (col < 0 || col >= HUB_WIDTH || row < 0 || row >= HUB_HEIGHT) {
    return { kind: "void" };
  }
  return getHubGrid()[row * HUB_WIDTH + col];
}
