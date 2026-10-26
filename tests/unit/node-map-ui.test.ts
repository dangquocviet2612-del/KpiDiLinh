import { describe, expect, it } from "vitest";
import {
  formatNodeMapCount,
  getNextMapSearchIndex,
  getNodeStatusSymbol,
  hasActiveNodeMapFilters,
} from "@/lib/node-map-ui";

describe("node map UI helpers", () => {
  it("shows visible and total counts when filters are active", () => {
    expect(formatNodeMapCount(12, 138, true)).toBe("12/138 node trên bản đồ");
    expect(formatNodeMapCount(138, 138, false)).toBe("138 node trên bản đồ");
  });

  it("detects either an efficiency or radius filter", () => {
    expect(hasActiveNodeMapFilters("ALL", null)).toBe(false);
    expect(hasActiveNodeMapFilters("RED", null)).toBe(true);
    expect(hasActiveNodeMapFilters("ALL", 3)).toBe(true);
  });

  it("uses a distinct non-color symbol for every status", () => {
    const symbols = ["RED", "ORANGE", "PURPLE", "DEFAULT"].map((status) =>
      getNodeStatusSymbol(status),
    );

    expect(new Set(symbols).size).toBe(symbols.length);
    expect(symbols.every(Boolean)).toBe(true);
  });

  it("wraps keyboard navigation through visible search results", () => {
    expect(getNextMapSearchIndex(-1, "ArrowDown", 3)).toBe(0);
    expect(getNextMapSearchIndex(2, "ArrowDown", 3)).toBe(0);
    expect(getNextMapSearchIndex(0, "ArrowUp", 3)).toBe(2);
    expect(getNextMapSearchIndex(0, "ArrowDown", 0)).toBe(-1);
  });
});
