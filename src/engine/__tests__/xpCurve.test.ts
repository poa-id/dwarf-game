import { describe, it, expect } from "vitest";
import {
  xpForLevel,
  cumulativeXpForLevel,
  levelForXp,
  xpIntoCurrentLevel,
  xpNeededForNextLevel,
} from "../xpCurve";

describe("xpForLevel", () => {
  it("throws for level < 1", () => {
    expect(() => xpForLevel(0)).toThrow();
  });

  it("increases monotonically", () => {
    let prev = 0;
    for (let l = 1; l <= 50; l++) {
      const cost = xpForLevel(l);
      expect(cost).toBeGreaterThan(prev);
      prev = cost;
    }
  });
});

describe("levelForXp / cumulativeXpForLevel round-trip", () => {
  it("levelForXp(cumulativeXpForLevel(n)) === n", () => {
    for (let l = 1; l <= 99; l += 7) {
      const xp = cumulativeXpForLevel(l);
      expect(levelForXp(xp)).toBe(l);
    }
  });

  it("0 xp is level 1", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("never exceeds MAX_LEVEL even with huge xp", () => {
    expect(levelForXp(1_000_000_000)).toBe(99);
  });
});

describe("xpIntoCurrentLevel / xpNeededForNextLevel", () => {
  it("xpIntoCurrentLevel is 0 exactly at a level boundary", () => {
    const xp = cumulativeXpForLevel(10);
    expect(xpIntoCurrentLevel(xp)).toBe(0);
  });

  it("xpIntoCurrentLevel + remaining == xpNeededForNextLevel just below a boundary", () => {
    const xp = cumulativeXpForLevel(10) - 1;
    const into = xpIntoCurrentLevel(xp);
    const needed = xpNeededForNextLevel(xp);
    // at level 9, needed should equal xpForLevel(9)
    expect(needed).toBe(xpForLevel(9));
    expect(into).toBeLessThan(needed);
  });

  it("returns 0 needed at MAX_LEVEL", () => {
    const xp = cumulativeXpForLevel(99) + 999999;
    expect(xpNeededForNextLevel(xp)).toBe(0);
  });
});

describe("curve shape sanity check (printed for eyeballing, not asserted)", () => {
  it("prints cost at key levels", () => {
    const checkpoints = [1, 5, 10, 25, 50, 75, 92, 99];
    const rows = checkpoints.map((l) => ({
      level: l,
      xpToNext: l < 99 ? xpForLevel(l) : 0,
      cumulativeTotal: cumulativeXpForLevel(l),
    }));
    console.table(rows);
    expect(rows.length).toBe(checkpoints.length);
  });
});
