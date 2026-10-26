import { describe, expect, it } from "vitest";
import { MAP_STYLE_OPTIONS, getMapTileConfig } from "@/lib/map-tiles";

describe("map tile policy", () => {
  it("defines the same three map styles for every map screen", () => {
    expect(MAP_STYLE_OPTIONS.map((option) => option.key)).toEqual(["light", "dark", "satellite"]);
  });

  it("returns provider-specific attribution and visual metadata", () => {
    expect(getMapTileConfig("light")).toMatchObject({
      provider: "OpenStreetMap",
      backgroundColor: "#f8fafc",
      needsDarkFilter: false,
    });
    expect(getMapTileConfig("dark")).toMatchObject({
      provider: "CARTO",
      backgroundColor: "#0f172a",
      needsDarkFilter: false,
    });
    expect(getMapTileConfig("satellite")).toMatchObject({
      provider: "Esri",
      backgroundColor: "#0f172a",
      needsDarkFilter: false,
    });
  });
});
