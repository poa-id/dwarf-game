import { describe, it, expect } from "vitest";
import { SOLID_CELL_KINDS, isSolidCellKind } from "../palette";

describe("SOLID_CELL_KINDS (2026-07-04 regression - gemcutting was walkthrough)", () => {
  // Every "you build/find this and stand next to it" structure kind
  // should block movement - reported directly that gemcutting was
  // walkable straight through, traced to it (and gemcutting_unbuilt)
  // being missing from SOLID_CELL_KINDS entirely. Listed explicitly
  // here (rather than deriving the list some other way) so adding a
  // new structure kind without remembering to mark it solid fails a
  // test instead of shipping silently walkthrough, the same way
  // gemcutting did.
  const structureKinds = [
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
    "mineshaft_broken",
    "mineshaft_lit",
  ] as const;

  it.each(structureKinds)("%s is solid", (kind) => {
    expect(isSolidCellKind(kind)).toBe(true);
  });

  it("rock_wall and void (deep rock beyond the wall border) are both solid", () => {
    expect(isSolidCellKind("rock_wall")).toBe(true);
    expect(isSolidCellKind("void")).toBe(true);
  });

  it("SOLID_CELL_KINDS has no accidental duplicate insertion bugs (Set dedupes, but catch obviously-wrong sizes)", () => {
    expect(SOLID_CELL_KINDS.size).toBeGreaterThan(structureKinds.length);
  });
});
