import { isValidMapCoordinate } from "./map-ui";

export type MapViewport = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
};

export function getMapCoordinates(item: { latitude?: unknown; longitude?: unknown }): [number, number] | null {
  return typeof item.latitude === "number" && typeof item.longitude === "number" && isValidMapCoordinate(item.latitude, item.longitude)
    ? [item.latitude, item.longitude]
    : null;
}

export function countPointsInViewport<Item>(
  items: readonly Item[],
  viewport: MapViewport | null,
  getCoordinates: (item: Item) => readonly [number, number] | null,
): number | null {
  if (!viewport || !Object.values(viewport).every(Number.isFinite) || viewport.south > viewport.north) return null;
  let count = 0;
  for (const item of items) {
    const point = getCoordinates(item);
    if (!point || !isValidMapCoordinate(point[0], point[1])) continue;
    if (point[0] < viewport.south || point[0] > viewport.north) continue;
    const inLongitude = viewport.west <= viewport.east
      ? point[1] >= viewport.west && point[1] <= viewport.east
      : point[1] >= viewport.west || point[1] <= viewport.east;
    if (inLongitude) count += 1;
  }
  return count;
}
