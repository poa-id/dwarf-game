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
  | "rock_wall_south"
  | "rock_floor"
  | "rock_floor_mines"
  | "rock_floor_dev"
  | "ore_copper"
  | "ore_iron"
  | "ore_deep"
  | "ore_coal"
  | "ore_exhausted"
  | "wood_node"
  | "wood_exhausted"
  | "dwarf"
  | "hearth"
  | "forge"
  | "forge_broken"
  | "kiln"
  | "smelter"
  | "sawmill"
  | "gemcutting"
  | "gemcutting_unbuilt"
  | "rubble"
  | "companion"
  | "mountain_console"
  | "stockpile_chest"
  | "drill_copper"
  | "drill_iron"
  | "drill_deep"
  | "drill_coal"
  | "mineshaft_broken"
  | "mineshaft_lit"
  | "wood_node"
  | "planter_broken"
  | "planter_empty"
  | "planter_sprout"
  | "planter_growing"
  | "planter_mature"
  | "planter_gemwood"
  | "planter_fern"
  | "planter_shroom"
  | "trade_post"
  | "tunnel_edge"
  | "torch_broken"
  | "torch_lit";

/**
 * Which CellKinds physically block movement. Walls obviously; but also
 * the hearth, the forge, and ore veins themselves - you interact WITH
 * them by standing adjacent, not by standing on top of them. "dwarf" is
 * deliberately excluded (it's the player himself, checking solidity at
 * his own position would be nonsensical) and torches are excluded too -
 * a torch sits in a corner of a cell, narrow enough that we treat it as
 * passable rather than a wall-equivalent obstruction.
 */
export const SOLID_CELL_KINDS: ReadonlySet<CellKind> = new Set([
  "rock_wall",
  "rock_wall_south",
  "void", // deep rock beyond the visible wall border (2026-07-04) - impassable, same as rock_wall
  "rubble",
  "mountain_console",
  "stockpile_chest",
  "drill_copper",
  "drill_iron",
  "drill_deep",
  "drill_coal",
  "hearth",
  "forge",
  "forge_broken",
  "kiln",
  "smelter",
  "sawmill",
  "gemcutting",
  "gemcutting_unbuilt",
  "ore_copper",
  "ore_iron",
  "ore_deep",
  "ore_coal",
  "wood_node",
  "tunnel_edge",
  "torch_broken",
  "torch_lit",
  "mineshaft_broken",
  "mineshaft_lit",
  "wood_node",
  "planter_broken",
  "planter_empty",
  "planter_sprout",
  "planter_growing",
  "planter_mature",
  "planter_gemwood",
  "planter_shroom",
  "trade_post",
]);

export function isSolidCellKind(kind: CellKind): boolean {
  return SOLID_CELL_KINDS.has(kind);
}

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
    rock_wall_south: "#9a9a9a",
    rock_floor: "#9a9a9a",
    rock_floor_mines: "#9a9a9a",
    rock_floor_dev: "#9a9a9a",
    ore_copper: "#9a9a9a",
    ore_iron: "#9a9a9a",
    ore_deep: "#9a9a9a",
    ore_coal: "#9a9a9a",
    ore_exhausted: "#9a9a9a",
    wood_node: "#9a9a9a",
    wood_exhausted: "#9a9a9a",
    dwarf: "#9a9a9a",
    hearth: "#9a9a9a", // unlit - indistinguishable from stone. this is the whole point.
    forge: "#9a9a9a",
    forge_broken: "#9a9a9a",
    kiln: "#9a9a9a",
    smelter: "#9a9a9a",
    sawmill: "#9a9a9a",
    gemcutting: "#9a9a9a",
    gemcutting_unbuilt: "#9a9a9a",
    rubble: "#7a7060",
    companion: "#c87820",
    mountain_console: "#7ab8d4",
    stockpile_chest: "#b89a4a",
    drill_copper: "#c87830",
    drill_coal: "#404040",
    drill_iron: "#8898a8",
    drill_deep: "#6858a0",
    mineshaft_broken: "#3a3028",
    mineshaft_lit: "#4a3820",
    planter_broken: "#2a2820",
    planter_empty: "#3a3430",
    planter_sprout: "#2a3a1a",
    planter_growing: "#2a4a1a",
    planter_mature: "#2a5a1a",
    planter_gemwood: "#241a40",
    planter_fern: "#1a4a2a",
    planter_shroom: "#3a2a4a",
    trade_post: "#2a3040",
    tunnel_edge: "#9a9a9a",
    torch_broken: "#9a9a9a", // inert, indistinguishable from any other stone shape until repaired
    // Torches now follow the SAME flat-gray Stage 0 rule as everything
    // else, rather than glowing independent of world color stage. This
    // reverses an earlier deliberate design choice (see Stage 1 below)
    // - playtesting found "earned light glows regardless of stage" read
    // as visually wrong/inconsistent once actually seen in the dark
    // world, even though it was internally consistent on paper. Torch
    // color is now part of the same Stage 1 "first color enters the
    // world" moment as the hearth and forge, not an exception to it.
    torch_lit: "#9a9a9a",
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
    torch_lit: "#ff5a1a", // joins the hearth/forge as part of the first color entering the world - no longer an exception to Stage 0's flatness
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
    rock_wall_south: "#7a6248",
    rock_floor: "#3a2e22",
    rock_floor_mines: "#332a20",
    rock_floor_dev: "#403428",
    ore_copper: "#d4894a",
    ore_iron: "#9aa3ad",
    ore_deep: "#7060c0",
    ore_coal: "#3a3530", // near-black, coal reads as "almost no light reflects off this" even once materials gain color
    ore_exhausted: "#3a2e22", // same as rock_floor - it's just spent rock now, nothing left to mine
    wood_node: "#8a6a3a",
    wood_exhausted: "#3a2e22",
    dwarf: "#f0c896",
    hearth: "#ff8c3a",
    forge: "#d4661f",
    forge_broken: "#5a4a3a", // dull, cold - the forge that hasn't caught yet, distinct from the live forge's orange
    kiln: "#8a5a3a", // warm clay/brick tone - distinct from both the bright live forge and plain stone, reads as "fired earth"
    smelter: "#c4441a", // richer, more saturated red-orange than the kiln - this is intensified, purifying heat, not just a warm structure
    sawmill: "#a47a3a", // warm worked-wood brown - richer/more saturated than raw wood_node, reads as "shaped lumber" not "still growing"
    gemcutting: "#8a6fa8", // pale violet/lavender - distinct from the warm Smelter/Kiln tones, fitting a station about light and clarity rather than heat
    gemcutting_unbuilt: "#4a4050",
    rubble: "#5a5040",
    companion: "#d4890a",
    mountain_console: "#5a9ab8",
    stockpile_chest: "#c8a830",
    drill_copper: "#d4894a",
    drill_coal: "#505050",
    drill_iron: "#9aa3ad",
    drill_deep: "#7868b8",
    mineshaft_broken: "#4a3a30",
    mineshaft_lit: "#5a4828",
    planter_broken: "#3a3830",
    planter_empty: "#4a4440",
    planter_sprout: "#3a4a2a",
    planter_growing: "#3a5a2a",
    planter_mature: "#3a6a2a",
    planter_gemwood: "#6a4a9a",
    planter_fern: "#2a5a3a",
    planter_shroom: "#4a3a5a",
    trade_post: "#3a4050",
    tunnel_edge: "#4a3a2a",
    torch_broken: "#6b5640", // same as plain stone at this stage - inert
    torch_lit: "#ff7a2a",
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
    rock_wall_south: "#68707e",
    rock_floor: "#343a42",
    rock_floor_mines: "#2e3038",
    rock_floor_dev: "#3a3c48",
    ore_copper: "#e0884a",
    ore_iron: "#c8d2dc",
    ore_deep: "#9d6fef",
    ore_coal: "#28241f",
    ore_exhausted: "#343a42",
    wood_node: "#9a7a4a",
    wood_exhausted: "#343a42",
    dwarf: "#f5dcb0",
    hearth: "#ffaa44",
    forge: "#e0701f",
    forge_broken: "#6a5a48",
    kiln: "#9a6a45",
    smelter: "#d8501e",
    sawmill: "#b8935a",
    gemcutting: "#a586c8",
    gemcutting_unbuilt: "#5a5060",
    rubble: "#6a6050",
    companion: "#e09a20",
    mountain_console: "#8accd8",
    stockpile_chest: "#d4b840",
    drill_copper: "#e09a5a",
    drill_coal: "#606060",
    drill_iron: "#aab3bd",
    drill_deep: "#8878c8",
    mineshaft_broken: "#5a4a40",
    mineshaft_lit: "#6a5838",
    planter_broken: "#4a4840",
    planter_empty: "#5a5450",
    planter_sprout: "#4a5a3a",
    planter_growing: "#4a6a3a",
    planter_mature: "#4a7a3a",
    planter_gemwood: "#8a6ac0",
    planter_fern: "#3a6a4a",
    planter_shroom: "#5a4a6a",
    trade_post: "#4a5060",
    tunnel_edge: "#454d56",
    torch_broken: "#5a6472",
    torch_lit: "#ff9a3a",
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
  rock_wall_south: "#",
  rock_floor: "·",
  rock_floor_mines: "·",
  rock_floor_dev: "·",
  ore_copper: "o",
  ore_iron: "O",
  ore_deep: "◆",
  ore_coal: "c",
  ore_exhausted: "▫", // hollow square - the shape memory of ore that's no longer there
  wood_node: "♣", // root tangle - the closest plain glyph to "something organic growing"
  wood_exhausted: "▫", // same hollow-square language as exhausted ore - consistent "spent resource" signal
  dwarf: "@",
  hearth: "♥",
  forge: "n",
  forge_broken: "ñ", // a near-miss of the working forge's glyph - recognizably related, visibly wrong/incomplete
  kiln: "k",
  smelter: "S",
  sawmill: "w",
  gemcutting: "g",
  gemcutting_unbuilt: ".",
  rubble: "x",
  companion: "N",
  mountain_console: "Ω",
  stockpile_chest: "S",
  drill_copper: "d",
  drill_iron: "d",
  drill_deep: "d",
  drill_coal: "d",
  mineshaft_broken: "m",
  mineshaft_lit: "M",
  planter_broken: "p",
  planter_empty: "P",
  planter_sprout: "1",
  planter_growing: "2",
  planter_mature: "3",
  planter_gemwood: "♦",
  planter_fern: "f",
  planter_shroom: "s",
  trade_post: "T",
  tunnel_edge: "%",
  torch_broken: "¡", // inverted exclamation - a snapped, hollow shape
  torch_lit: "!", // upright, bright - deliberately the "completed" version of the same glyph idea
};
