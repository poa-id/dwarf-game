import { describe, it, expect } from "vitest";
import { attemptMove } from "../movement";
import { createInitialWorld } from "../rekindle";
import { HUB_WIDTH, HUB_HEIGHT, ZONES, HEARTH_SPAWN_POSITION } from "../hubMap";

describe("attemptMove", () => {
  it("moves one cell in the correct direction for each of the four directions", () => {
    const world = createInitialWorld(0);
    const start = { col: 10, row: 10 };
    expect(attemptMove(start, "up", world).position).toEqual({ col: 10, row: 9 });
    expect(attemptMove(start, "down", world).position).toEqual({ col: 10, row: 11 });
    expect(attemptMove(start, "left", world).position).toEqual({ col: 9, row: 10 });
    expect(attemptMove(start, "right", world).position).toEqual({ col: 11, row: 10 });
  });

  it("reports moved=true on a successful move", () => {
    const world = createInitialWorld(0);
    const result = attemptMove({ col: 10, row: 10 }, "up", world);
    expect(result.moved).toBe(true);
  });

  it("blocks movement past the map edge and leaves position unchanged", () => {
    const world = createInitialWorld(0);
    const topLeft = { col: 0, row: 0 };
    const result = attemptMove(topLeft, "up", world);
    expect(result.moved).toBe(false);
    expect(result.position).toEqual(topLeft);
  });

  it("blocks movement past the bottom-right edge too", () => {
    const world = createInitialWorld(0);
    const bottomRight = { col: HUB_WIDTH - 1, row: HUB_HEIGHT - 1 };
    const result = attemptMove(bottomRight, "right", world);
    expect(result.moved).toBe(false);
    expect(result.position).toEqual(bottomRight);
  });

  it("blocks movement INTO a locked zone", () => {
    const world = createInitialWorld(0); // forge_room is locked here
    const forgeRoom = ZONES.find((z) => z.id === "forge_room")!;
    // approach from just outside its left edge
    const justOutside = { col: forgeRoom.bounds.col - 1, row: forgeRoom.bounds.row };
    const result = attemptMove(justOutside, "right", world);
    expect(result.moved).toBe(false);
    expect(result.position).toEqual(justOutside);
  });

  it("allows movement freely within the hearth hall (always unlocked) from spawn", () => {
    const world = createInitialWorld(0);
    const result = attemptMove(HEARTH_SPAWN_POSITION, "right", world);
    expect(result.moved).toBe(true);
  });
});
