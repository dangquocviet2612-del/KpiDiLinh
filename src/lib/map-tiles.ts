export type MapStyleMode = "light" | "dark" | "satellite";

export type MapStyleOption = {
  key: MapStyleMode;
  label: string;
};

export type MapTileConfig = {
  provider: "OpenStreetMap" | "CARTO" | "Esri";
  url: string;
  attribution: string;
  backgroundColor: string;
  needsDarkFilter: boolean;
};

export const MAP_STYLE_OPTIONS: MapStyleOption[] = [
  { key: "light", label: "Bản đồ sáng" },
  { key: "dark", label: "Bản đồ tối" },
  { key: "satellite", label: "Ảnh vệ tinh" },
];

const MAP_TILE_CONFIGS: Record<MapStyleMode, MapTileConfig> = {
  light: {
    provider: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    backgroundColor: "#f8fafc",
    needsDarkFilter: false,
  },
  dark: {
    provider: "CARTO",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
    backgroundColor: "#0f172a",
    needsDarkFilter: false,
  },
  satellite: {
    provider: "Esri",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri World Imagery",
    backgroundColor: "#0f172a",
    needsDarkFilter: false,
  },
};

export function getMapTileConfig(style: MapStyleMode): MapTileConfig {
  return MAP_TILE_CONFIGS[style];
}
