/**
 * Palette per ColorStage. This is where "2-bit" becomes a real, designed
 * constraint rather than "we haven't added color yet." Stage 0 genuinely
 * only has 2-3 tones, on purpose - like an old handheld screen, not a
 * placeholder.
 *
 * Glyphs stay constant across stages (same '#' for rock, same '@' for the
 * dwarf) - only the color mapping changes. This keeps the upgrade cheap:
 * adding a stage is "add a palette object," not "redraw the game."
 */

export type CellKind =
  | "void"
  | "rock_wall"
  | "rock_floor"
  | "ore_copper"
  | "ore_iron"
  | "ore_deep"
  | "dwarf"
  | "hearth"
  | "forge"
  | "tunnel_edge";

export interface StagePalette {
  stage: number;
  background: string;
  colors: Record<CellKind, string>;
}

/**
 * Stage 0 - The Dark. A REAL 2-bit constraint: background black, and
 * exactly ONE foreground tone for every single thing in the world.
 * Walls, floor, ore, the dwarf, the unlit hearth - all the same pale
 * gray. There is no depth, no material distinction, nothing to tell
 * copper from iron from stone. That flatness IS the point: everything
 * looks the same in true dark. Only shape (the glyph) carries meaning.
 */
const STAGE_0: StagePalette = {
  stage: 0,
  background: "#000000",
  colors: {
    void: "#000000",
    rock_wall: "#9a9a9a",
    rock_floor: "#9a9a9a",
    ore_copper: "#9a9a9a",
    ore_iron: "#9a9a9a",
    ore_deep: "#9a9a9a",
    dwarf: "#9a9a9a",
    hearth: "#9a9a9a", // unlit - indistinguishable from stone. this is the whole point.
    forge: "#9a9a9a",
    tunnel_edge: "#9a9a9a",
  },
};

/**
 * Stage 1 - First Ember. The rekindling. ONE color enters the world,
 * and only the hearth and forge carry it - everything else stays the
 * flat single gray of Stage 0. This is the moment of maximum contrast:
 * one warm point of color in an otherwise undifferentiated dark world.
 */
const STAGE_1: StagePalette = {
  ...STAGE_0,
  stage: 1,
  colors: {
    ...STAGE_0.colors,
    hearth: "#ff5a1a",
    forge: "#c44a14",
  },
};

/**
 * Stage 2 - Hearthlight. The light has spread far enough that materials
 * start to differentiate from one another - stone vs. floor vs. ore are
 * now visually distinct, though still in a muted, embery palette rather
 * than full natural color. The dwarf himself gains a warm tone too,
 * since the firelight now reaches him.
 */
const STAGE_2: StagePalette = {
  stage: 2,
  background: "#160a05",
  colors: {
    void: "#160a05",
    rock_wall: "#6b5640",
    rock_floor: "#3a2e22",
    ore_copper: "#d4894a",
    ore_iron: "#9aa3ad",
    ore_deep: "#7060c0",
    dwarf: "#f0c896",
    hearth: "#ff8c3a",
    forge: "#d4661f",
    tunnel_edge: "#4a3a2a",
  },
};

/**
 * Stage 3 - True Color. The full, natural palette - stone is genuinely
 * gray-blue, copper genuinely warm orange-brown, iron genuinely cool
 * steel, deepstone genuinely a rich violet rarity color. This should
 * read as a clearly different WORLD from stage 2, not a filter on it.
 */
const STAGE_3: StagePalette = {
  stage: 3,
  background: "#1c2128",
  colors: {
    void: "#1c2128",
    rock_wall: "#5a6472",
    rock_floor: "#343a42",
    ore_copper: "#e0884a",
    ore_iron: "#c8d2dc",
    ore_deep: "#9d6fef",
    dwarf: "#f5dcb0",
    hearth: "#ffaa44",
    forge: "#e0701f",
    tunnel_edge: "#454d56",
  },
};

export const STAGE_PALETTES: StagePalette[] = [STAGE_0, STAGE_1, STAGE_2, STAGE_3];

export function paletteForStage(stage: number): StagePalette {
  return STAGE_PALETTES[Math.min(stage, STAGE_PALETTES.length - 1)];
}

/** Glyphs - constant across all stages, on purpose. */
export const GLYPHS: Record<CellKind, string> = {
  void: " ",
  rock_wall: "#",
  rock_floor: "·",
  ore_copper: "o",
  ore_iron: "O",
  ore_deep: "◆",
  dwarf: "@",
  hearth: "♥",
  forge: "n",
  tunnel_edge: "%",
};
