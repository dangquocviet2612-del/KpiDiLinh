import { describe, expect, it } from "vitest";
import { countPointsInViewport, getMapCoordinates, type MapViewport } from "@/lib/map-viewport";

const viewport: MapViewport = { south: -1, west: -1, north: 1, east: 1, zoom: 12 };
const coordinate = (point: readonly [number, number] | null) => point;

describe("map viewport counts", () => {
  it("does not invent a count before the map reports bounds", () => {
    expect(countPointsInViewport([[0, 0]], null, coordinate)).toBeNull();
  });

  it("includes valid zero coordinates and points on all edges", () => {
    expect(countPointsInViewport([[0, 0], [-1, -1], [1, 1], [1.1, 0], [0, 1.1]], viewport, coordinate)).toBe(3);
  });

  it("reports zero for an empty filtered set", () => {
    expect(countPointsInViewport([], viewport, coordinate)).toBe(0);
  });

  it("ignores missing, non-finite and out-of-range coordinates", () => {
    expect(countPointsInViewport([null, [NaN, 0], [0, Infinity], [91, 0], [0, 181], [0, 0]], viewport, coordinate)).toBe(1);
  });

  it("handles bounds crossing the antimeridian", () => {
    expect(countPointsInViewport([[0, 175], [0, -175], [0, 0]], { ...viewport, west: 170, east: -170 }, coordinate)).toBe(2);
  });

  it("handles Leaflet unwrapped and multi-world bounds", () => {
    expect(countPointsInViewport([[0, -175], [0, 175], [0, 0]], { ...viewport, west: 170, east: 190 }, coordinate)).toBe(1);
    expect(countPointsInViewport([[0, -175], [0, 175], [0, 0]], { ...viewport, west: -190, east: -170 }, coordinate)).toBe(1);
    expect(countPointsInViewport([[0, -180], [0, 180], [0, 0]], { ...viewport, west: -540, east: 540 }, coordinate)).toBe(3);
  });

  it("uses numeric coordinate values, never truthiness, coercion or stale flags", () => {
    expect(getMapCoordinates({ latitude: 0, longitude: 0 })).toEqual([0, 0]);
    for (const latitude of [null, undefined, "0", NaN, Infinity, 91]) {
      expect(getMapCoordinates({ latitude, longitude: 0 })).toBeNull();
    }
    expect(getMapCoordinates({ latitude: 0, longitude: 181 })).toBeNull();
  });

  it("rejects unusable bounds rather than showing a misleading zero", () => {
    expect(countPointsInViewport([[0, 0]], { ...viewport, north: NaN }, coordinate)).toBeNull();
    expect(countPointsInViewport([[0, 0]], { ...viewport, south: 2 }, coordinate)).toBeNull();
  });

  it("counts the supplied filtered rows, not any global collection", () => {
    const rows = [{ id: "included", point: [0, 0] as const }, { id: "outside", point: [20, 20] as const }];
    expect(countPointsInViewport(rows.filter((row) => row.id === "outside"), viewport, (row) => row.point)).toBe(0);
    expect(rows).toHaveLength(2);
  });
});
