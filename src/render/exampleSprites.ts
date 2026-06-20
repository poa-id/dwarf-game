import { spriteFromRows, type Sprite } from "./sprites";

/**
 * A small cave foe, 2 cols x 4 rows. Built from existing CellKinds for
 * now (reusing rock_wall's tone as a placeholder "creature" look) -
 * once we have a real "foe" CellKind/palette entry this should use
 * that instead. Demonstrates a tall, narrow multi-cell sprite.
 */
export const CAVE_LURKER: Sprite = spriteFromRows("cave_lurker", "Cave Lurker", [
  [null, "rock_wall"],
  ["rock_wall", "rock_wall"],
  ["rock_wall", "rock_wall"],
  [null, "rock_wall"],
]);

/**
 * A simple forge building, 4x4, with an irregular silhouette (corners
 * are transparent/null) to show sprites don't have to be solid
 * rectangles. The forge glyph sits in the middle, walls form a frame.
 */
export const FORGE_BUILDING: Sprite = spriteFromRows("forge_building", "Forge Building", [
  [null, "rock_wall", "rock_wall", null],
  ["rock_wall", "forge", "forge", "rock_wall"],
  ["rock_wall", "forge", "forge", "rock_wall"],
  [null, "rock_wall", "rock_wall", null],
]);

export const ALL_SPRITES: Sprite[] = [CAVE_LURKER, FORGE_BUILDING];
