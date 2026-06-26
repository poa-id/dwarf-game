import { describe, it, expect } from "vitest";
import {
  xpForLevel,
  cumulativeXpForLevel,
  levelForXp,
  xpIntoCurrentLevel,
  xpNeededForNextLevel,
  applyDwarfCountXpMultiplier,
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

describe("applyDwarfCountXpMultiplier", () => {
  it("dwarfCount 0 (the very first dwarf ever) gets exactly 1.0x - unchanged behavior", () => {
    expect(applyDwarfCountXpMultiplier(10, 0)).toBe(10);
    expect(applyDwarfCountXpMultiplier(100, 0)).toBe(100);
  });

  it("scales up +15% per prior dwarf", () => {
    expect(applyDwarfCountXpMultiplier(100, 1)).toBe(115); // 1.15x
    expect(applyDwarfCountXpMultiplier(100, 2)).toBe(130); // 1.30x
    expect(applyDwarfCountXpMultiplier(100, 5)).toBe(175); // 1.75x
  });

  it("caps at 3x regardless of how high dwarfCount climbs", () => {
    expect(applyDwarfCountXpMultiplier(100, 14)).toBe(300); // 1 + 14*0.15 = 3.1, capped to 3.0
    expect(applyDwarfCountXpMultiplier(100, 1000)).toBe(300); // way past the cap, still 3.0
  });

  it("rounds to a whole number (XP gains should never be fractional)", () => {
    const result = applyDwarfCountXpMultiplier(7, 3); // 7 * 1.45 = 10.15
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(10);
  });

  it("never returns less than the base XP (multiplier floor is 1.0, never penalizes)", () => {
    expect(applyDwarfCountXpMultiplier(50, 0)).toBeGreaterThanOrEqual(50);
    expect(applyDwarfCountXpMultiplier(50, 1)).toBeGreaterThanOrEqual(50);
  });
});
