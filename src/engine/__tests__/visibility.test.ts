import { describe, it, expect } from "vitest";
import {
  isUnlockConditionMet,
  isZoneUnlocked,
  unlockedZones,
  zoneContaining,
  isCellPartOfUnlockedWorld,
  isWithinLightRadius,
  isWithinAnyLitTorch,
  isActivelyLit,
  cellVisibility,
  DEFAULT_LIGHT_RADIUS,
  describeUnlockCondition,
} from "../visibility";
import { ZONES, HEARTH_SPAWN_POSITION, LIGHT_SOURCES } from "../hubMap";
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
  it("central_hall is unlocked from a fresh world (type: always)", () => {
    const world = createInitialWorld(0);
    const hearthHall = ZONES.find((z) => z.id === "central_hall")!;
    expect(isZoneUnlocked(hearthHall, world)).toBe(true);
  });

  it("forge_room is unlocked on a fresh world (the ROOM is always reachable - the forge inside it starts broken/rubble instead)", () => {
    const world = createInitialWorld(0);
    const forgeRoom = ZONES.find((z) => z.id === "forge_room")!;
    expect(isZoneUnlocked(forgeRoom, world)).toBe(true);
  });

  it("tinkering_room is locked on a fresh world", () => {
    const world = createInitialWorld(0);
    const tunnelEntrance = ZONES.find((z) => z.id === "tinkering_room")!;
    expect(isZoneUnlocked(tunnelEntrance, world)).toBe(false);
  });

  it("tinkering_room unlocks once forgeTier reaches its requirement (changed 2026-06-23 from hearth colorStage - see hubMap.ts)", () => {
    const world = worldWith({ forgeTier: 2 });
    const tunnelEntrance = ZONES.find((z) => z.id === "tinkering_room")!;
    expect(isZoneUnlocked(tunnelEntrance, world)).toBe(true);
  });

  it("tinkering_room stays locked at forgeTier 1, even with a high hearth colorStage - the two are deliberately decoupled now", () => {
    const world = worldWith({
      forgeTier: 1,
      hearth: { ...createInitialWorld(0).hearth, colorStage: 3 },
    });
    const tunnelEntrance = ZONES.find((z) => z.id === "tinkering_room")!;
    expect(isZoneUnlocked(tunnelEntrance, world)).toBe(false);
  });

  it("zoneContaining finds the correct zone for a coordinate inside it", () => {
    const hearthHall = ZONES.find((z) => z.id === "central_hall")!;
    const insideCol = hearthHall.bounds.col + 1;
    const insideRow = hearthHall.bounds.row + 1;
    expect(zoneContaining(insideCol, insideRow)?.id).toBe("central_hall");
  });

  it("zoneContaining returns null for open hallway coordinates outside any zone", () => {
    expect(zoneContaining(0, 0)).toBeNull();
  });

  it("unlockedZones returns only zones whose condition is currently met", () => {
    const world = createInitialWorld(0);
    const ids = unlockedZones(world).map((z) => z.id);
    expect(ids).toContain("central_hall");
    expect(ids).toContain("forge_room"); // always unlocked now - the forge itself, not the room, is what's broken
    expect(ids).not.toContain("tinkering_room");
  });
});

describe("isCellPartOfUnlockedWorld", () => {
  it("open hallway cells (outside any zone) are always part of the unlocked world", () => {
    const world = createInitialWorld(0);
    expect(isCellPartOfUnlockedWorld(0, 0, world)).toBe(true);
  });

  it("cells inside a locked zone (tinkering_room) are NOT part of the unlocked world", () => {
    const world = createInitialWorld(0);
    const tunnelEntrance = ZONES.find((z) => z.id === "tinkering_room")!;
    expect(
      isCellPartOfUnlockedWorld(tunnelEntrance.bounds.col, tunnelEntrance.bounds.row, world)
    ).toBe(false);
  });

  it("cells inside an unlocked zone ARE part of the unlocked world", () => {
    const hearthHall = ZONES.find((z) => z.id === "central_hall")!;
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
    const tunnelEntrance = ZONES.find((z) => z.id === "tinkering_room")!;
    const col = tunnelEntrance.bounds.col;
    const row = tunnelEntrance.bounds.row;
    const world = worldWith({ exploredCells: { [cellKey(col, row)]: true } });
    // dwarf standing right on top of it, normally would be "lit", but the zone is locked
    const result = cellVisibility(col, row, { col, row }, world, cellKey(col, row));
    expect(result).toBe("hidden");
  });
});

describe("isWithinAnyLitTorch", () => {
  const torch = LIGHT_SOURCES[0];

  it("false when the torch exists but is not lit", () => {
    const world = createInitialWorld(0);
    expect(isWithinAnyLitTorch(torch.position.col, torch.position.row, world)).toBe(false);
  });

  it("true within radius of a LIT torch", () => {
    const world = worldWith({ litTorches: { [torch.id]: true } });
    expect(isWithinAnyLitTorch(torch.position.col, torch.position.row, world)).toBe(true);
  });

  it("false outside every lit torch's radius", () => {
    const world = worldWith({ litTorches: { [torch.id]: true } });
    const farCol = torch.position.col + torch.radius + 10;
    expect(isWithinAnyLitTorch(farCol, torch.position.row, world)).toBe(false);
  });
});

describe("isActivelyLit", () => {
  const torch = LIGHT_SOURCES[0];

  it("true when within the dwarf's own radius, regardless of torches", () => {
    const world = createInitialWorld(0);
    const dwarfPos = HEARTH_SPAWN_POSITION;
    expect(isActivelyLit(dwarfPos.col, dwarfPos.row, dwarfPos, world)).toBe(true);
  });

  it("true when within a lit torch's radius, even far from the dwarf", () => {
    const world = worldWith({ litTorches: { [torch.id]: true } });
    const dwarfFarAway = { col: 0, row: 0 };
    expect(isActivelyLit(torch.position.col, torch.position.row, dwarfFarAway, world)).toBe(
      true
    );
  });

  it("false when outside both the dwarf's radius and any lit torch", () => {
    const world = createInitialWorld(0); // no torches lit
    const dwarfFarAway = { col: 0, row: 0 };
    expect(isActivelyLit(70, 45, dwarfFarAway, world)).toBe(false);
  });
});

describe("cellVisibility with torches", () => {
  const torch = LIGHT_SOURCES[0];

  it("a lit torch makes its surroundings 'lit' even with the dwarf far away", () => {
    const world = worldWith({ litTorches: { [torch.id]: true } });
    const dwarfFarAway = { col: 0, row: 0 };
    const result = cellVisibility(
      torch.position.col,
      torch.position.row,
      dwarfFarAway,
      world,
      cellKey(torch.position.col, torch.position.row)
    );
    expect(result).toBe("lit");
  });
});

describe("describeUnlockCondition", () => {
  it("forge_tier_at_least looks up the real Forge upgrade name, not a raw tier number", () => {
    const text = describeUnlockCondition({ type: "forge_tier_at_least", tier: 2 });
    expect(text).toContain("Bellows of the Deep");
  });

  it("hearth_color_stage_at_least names the stage", () => {
    const text = describeUnlockCondition({ type: "hearth_color_stage_at_least", stage: 1 });
    expect(text).toContain("1");
  });

  it("always returns empty (nothing to describe - it's never the reason something's locked)", () => {
    expect(describeUnlockCondition({ type: "always" })).toBe("");
  });

  it("lore_flag gives a vague but real answer rather than naming the flag (avoids spoiling discovery content)", () => {
    const text = describeUnlockCondition({ type: "lore_flag", flag: "met_the_foreman" });
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain("met_the_foreman");
  });
});
