import { describe, it, expect } from "vitest";
import { markVisibleCellsExplored } from "../exploration";
import { cellKey } from "../types";

describe("markVisibleCellsExplored", () => {
  it("marks the dwarf's own cell as explored", () => {
    const result = markVisibleCellsExplored({}, { col: 10, row: 10 }, 3);
    expect(result[cellKey(10, 10)]).toBe(true);
  });

  it("marks cells within radius, and does NOT mark cells clearly outside radius", () => {
    const result = markVisibleCellsExplored({}, { col: 10, row: 10 }, 3);
    expect(result[cellKey(12, 10)]).toBe(true); // within radius 3
    expect(result[cellKey(20, 20)]).toBeUndefined(); // far outside
  });

  it("does not mutate the input map (pure function)", () => {
    const original = { [cellKey(0, 0)]: true as const };
    markVisibleCellsExplored(original, { col: 10, row: 10 }, 2);
    expect(Object.keys(original)).toEqual([cellKey(0, 0)]);
  });

  it("preserves previously explored cells far from the dwarf's current position", () => {
    const previouslyExplored = { [cellKey(0, 0)]: true as const };
    const result = markVisibleCellsExplored(previouslyExplored, { col: 50, row: 50 }, 2);
    expect(result[cellKey(0, 0)]).toBe(true); // still remembered, even though dwarf is far away now
  });

  it("never un-marks a cell (exploration is permanent)", () => {
    let explored = markVisibleCellsExplored({}, { col: 10, row: 10 }, 3);
    explored = markVisibleCellsExplored(explored, { col: 50, row: 50 }, 3);
    expect(explored[cellKey(10, 10)]).toBe(true);
  });
});
