import { describe, it, expect } from "vitest";
import {
  isUnlockConditionMet,
  isZoneUnlocked,
  unlockedZones,
  zoneContaining,
  isCellPartOfUnlockedWorld,
  isWithinLightRadius,
  cellVisibility,
  DEFAULT_LIGHT_RADIUS,
} from "../visibility";
import { ZONES, HEARTH_SPAWN_POSITION } from "../hubMap";
import { createInitialWorld } from "../rekindle";
import type { WorldState } from "../types";
import { cellKey } from "../types";

function worldWith(overrides: Partial<WorldState>): WorldState {
  return { ...createInitialWorld(0), ...overrides };
}

describe("isUnlockConditionMet", () => {
  it("'always' is always true", () => {
    expect(isUnlockConditionMet({ type: "always" }, createInitialWorld(0))).toBe(true);
  });

  it("forge_tier_at_least respects forgeTier", () => {
    const world = worldWith({ forgeTier: 2 });
    expect(isUnlockConditionMet({ type: "forge_tier_at_least", tier: 2 }, world)).toBe(true);
    expect(isUnlockConditionMet({ type: "forge_tier_at_least", tier: 3 }, world)).toBe(false);
  });

  it("hearth_color_stage_at_least respects hearth.colorStage", () => {
    const world = worldWith({ hearth: { ...createInitialWorld(0).hearth, colorStage: 1 } });
    expect(isUnlockConditionMet({ type: "hearth_color_stage_at_least", stage: 1 }, world)).toBe(
      true
    );
    expect(isUnlockConditionMet({ type: "hearth_color_stage_at_least", stage: 2 }, world)).toBe(
      false
    );
  });

  it("lore_flag respects loreFlags", () => {
    const world = worldWith({ loreFlags: ["met_the_foreman"] });
    expect(isUnlockConditionMet({ type: "lore_flag", flag: "met_the_foreman" }, world)).toBe(
      true
    );
    expect(isUnlockConditionMet({ type: "lore_flag", flag: "found_the_axe" }, world)).toBe(false);
  });
});

describe("zoneContaining / isZoneUnlocked / unlockedZones", () => {
  it("hearth_hall is unlocked from a fresh world (type: always)", () => {
    const world = createInitialWorld(0);
    const hearthHall = ZONES.find((z) => z.id === "hearth_hall")!;
    expect(isZoneUnlocked(hearthHall, world)).toBe(true);
  });

  it("forge_room is locked on a fresh world", () => {
    const world = createInitialWorld(0);
    const forgeRoom = ZONES.find((z) => z.id === "forge_room")!;
    expect(isZoneUnlocked(forgeRoom, world)).toBe(false);
  });

  it("forge_room unlocks once forgeTier reaches its requirement", () => {
    const world = worldWith({ forgeTier: 1 });
    const forgeRoom = ZONES.find((z) => z.id === "forge_room")!;
    expect(isZoneUnlocked(forgeRoom, world)).toBe(true);
  });

  it("zoneContaining finds the correct zone for a coordinate inside it", () => {
    const hearthHall = ZONES.find((z) => z.id === "hearth_hall")!;
    const insideCol = hearthHall.bounds.col + 1;
    const insideRow = hearthHall.bounds.row + 1;
    expect(zoneContaining(insideCol, insideRow)?.id).toBe("hearth_hall");
  });

  it("zoneContaining returns null for open hallway coordinates outside any zone", () => {
    expect(zoneContaining(0, 0)).toBeNull();
  });

  it("unlockedZones returns only zones whose condition is currently met", () => {
    const world = createInitialWorld(0);
    const ids = unlockedZones(world).map((z) => z.id);
    expect(ids).toContain("hearth_hall");
    expect(ids).not.toContain("forge_room");
    expect(ids).not.toContain("tunnel_entrance");
  });
});

describe("isCellPartOfUnlockedWorld", () => {
  it("open hallway cells (outside any zone) are always part of the unlocked world", () => {
    const world = createInitialWorld(0);
    expect(isCellPartOfUnlockedWorld(0, 0, world)).toBe(true);
  });

  it("cells inside a locked zone are NOT part of the unlocked world", () => {
    const world = createInitialWorld(0);
    const forgeRoom = ZONES.find((z) => z.id === "forge_room")!;
    expect(
      isCellPartOfUnlockedWorld(forgeRoom.bounds.col, forgeRoom.bounds.row, world)
    ).toBe(false);
  });

  it("cells inside an unlocked zone ARE part of the unlocked world", () => {
    const hearthHall = ZONES.find((z) => z.id === "hearth_hall")!;
    const world = createInitialWorld(0);
    expect(
      isCellPartOfUnlockedWorld(hearthHall.bounds.col, hearthHall.bounds.row, world)
    ).toBe(true);
  });
});

describe("isWithinLightRadius", () => {
  it("the center itself is always within radius", () => {
    expect(isWithinLightRadius(5, 5, { col: 5, row: 5 })).toBe(true);
  });

  it("a cell exactly at radius distance (axis-aligned) is included", () => {
    expect(isWithinLightRadius(5 + DEFAULT_LIGHT_RADIUS, 5, { col: 5, row: 5 })).toBe(true);
  });

  it("a cell just beyond radius distance is excluded", () => {
    expect(isWithinLightRadius(5 + DEFAULT_LIGHT_RADIUS + 1, 5, { col: 5, row: 5 })).toBe(false);
  });

  it("respects a custom radius override", () => {
    expect(isWithinLightRadius(10, 5, { col: 5, row: 5 }, 10)).toBe(true);
    expect(isWithinLightRadius(10, 5, { col: 5, row: 5 }, 2)).toBe(false);
  });
});

describe("cellVisibility", () => {
  it("returns 'lit' for a cell within light radius of the dwarf", () => {
    const world = createInitialWorld(0);
    const pos = HEARTH_SPAWN_POSITION;
    const result = cellVisibility(pos.col, pos.row, pos, world, cellKey(pos.col, pos.row));
    expect(result).toBe("lit");
  });

  it("returns 'remembered' for an explored cell outside current light radius", () => {
    const world = worldWith({ exploredCells: { "0,0": true } });
    const dwarfFarAway: { col: number; row: number } = { col: 50, row: 50 };
    const result = cellVisibility(0, 0, dwarfFarAway, world, "0,0");
    expect(result).toBe("remembered");
  });

  it("returns 'hidden' for an unexplored cell outside light radius", () => {
    const world = createInitialWorld(0);
    const dwarfFarAway = { col: 50, row: 50 };
    const result = cellVisibility(0, 0, dwarfFarAway, world, "0,0");
    expect(result).toBe("hidden");
  });

  it("returns 'hidden' for a cell in a locked zone, even if somehow marked explored", () => {
    const forgeRoom = ZONES.find((z) => z.id === "forge_room")!;
    const col = forgeRoom.bounds.col;
    const row = forgeRoom.bounds.row;
    const world = worldWith({ exploredCells: { [cellKey(col, row)]: true } });
    // dwarf standing right on top of it, normally would be "lit", but the zone is locked
    const result = cellVisibility(col, row, { col, row }, world, cellKey(col, row));
    expect(result).toBe("hidden");
  });
});
