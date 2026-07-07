import { describe, it, expect } from "vitest";
import { groupInventoryByCategory, INVENTORY_CATEGORY_ORDER } from "../types";

/**
 * Reported directly: "Separate items in bag or order them in some
 * way, its impossible to look for something or know how much you
 * have of something." Previously the bag was a flat, unsorted list in
 * whatever order Object.entries happened to return.
 */
describe("groupInventoryByCategory", () => {
  it("groups items by category", () => {
    const sections = groupInventoryByCategory({ copper_ore: 5, copper_ingot: 3, rough_quartz: 1 });
    const categories = sections.map((s) => s.category);
    expect(categories).toContain("ore");
    expect(categories).toContain("ingot");
    expect(categories).toContain("gem");
  });

  it("omits categories with nothing held", () => {
    const sections = groupInventoryByCategory({ copper_ore: 5 });
    expect(sections.length).toBe(1);
    expect(sections[0].category).toBe("ore");
  });

  it("omits items with zero or missing amount", () => {
    const sections = groupInventoryByCategory({ copper_ore: 5, iron_ore: 0 });
    const oreSection = sections.find((s) => s.category === "ore")!;
    const ids = oreSection.items.map((i) => i.materialId);
    expect(ids).toContain("copper_ore");
    expect(ids).not.toContain("iron_ore");
  });

  it("orders categories in the documented raw -> refined -> rare -> practical -> misc progression", () => {
    const sections = groupInventoryByCategory({
      wood: 1, coal: 1, copper_ore: 1, copper_ingot: 1, rough_quartz: 1, true_copper: 1,
    });
    const order = sections.map((s) => s.category);
    // Every category present should appear in the same relative order as INVENTORY_CATEGORY_ORDER
    const filteredExpected = INVENTORY_CATEGORY_ORDER.filter((c) => order.includes(c));
    expect(order).toEqual(filteredExpected);
  });

  it("sorts items within a category by tier ascending", () => {
    const sections = groupInventoryByCategory({ copper_ore: 1, iron_ore: 1 });
    const oreSection = sections.find((s) => s.category === "ore")!;
    // copper_ore is tier 1, iron_ore is tier 2 - copper should come first
    expect(oreSection.items[0].materialId).toBe("copper_ore");
    expect(oreSection.items[1].materialId).toBe("iron_ore");
  });

  it("includes the correct amount and display name for each item", () => {
    const sections = groupInventoryByCategory({ copper_ore: 42 });
    const item = sections[0].items[0];
    expect(item.amount).toBe(42);
    expect(item.name).toBe("Copper Ore");
  });

  it("returns an empty array for an empty inventory", () => {
    expect(groupInventoryByCategory({})).toEqual([]);
  });
});
