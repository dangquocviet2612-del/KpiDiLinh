"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import { Copy, ExternalLink, Loader2, MapPin, Navigation, Radio, RefreshCw, Search, X, Zap } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import styles from "./node-map.module.css";
import { useMapSearch } from "@/hooks/useMapSearch";
import MapSearchResults from "@/components/MapSearchResults";
import { escapeMapHtml as escapeHtml, formatMapPercent } from "@/lib/map-ui";
import { toast } from "react-hot-toast";
import Dialog from "@/components/ui/Dialog";
import { MapLegend, MapPanel, MapToolbar, MapViewportControls } from "@/components/map";
import { getMapTileConfig, type MapStyleMode } from "@/lib/map-tiles";
import {
  formatNodeMapCount,
  getNextMapSearchIndex,
  getNodeStatusSymbol,
  hasActiveNodeMapFilters,
  type NodeMapStatus,
} from "@/lib/node-map-ui";
import NodeMapOptionsMenu from "./NodeMapOptionsMenu";

type CustomerNodeMappingRow = {
  id: string;
  account: string;
  nodeName: string;
  accountAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

type NodeAccountRow = {
  id: string;
  account: string;
  accountAddress: string | null;
};

type NodeColorFilter = "ALL" | NodeMapStatus;

const NODE_FILTERS: Array<{
  key: NodeColorFilter;
  label: string;
  description: string;
  toneClass?: string;
}> = [
  { key: "ALL", label: "Tất cả hiệu suất", description: "Không lọc node theo nhóm hiệu suất." },
  { key: "RED", label: "0% trên 1 năm", description: "Node hoạt động trên 1 năm nhưng hiệu suất bằng 0%.", toneClass: "dotRed" },
  { key: "ORANGE", label: "Dưới 13%", description: "Node có hiệu suất lớn hơn 0% và nhỏ hơn 13%.", toneClass: "dotOrange" },
  { key: "PURPLE", label: "13–25%", description: "Node có hiệu suất từ 13% đến 25%.", toneClass: "dotPurple" },
  { key: "DEFAULT", label: "Nhóm khác", description: "Các node còn lại, không nằm trong nhóm cảnh báo.", toneClass: "dotDefault" },
];

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const CurrentLocationIcon = L.divIcon({
  className: styles.currentLocationMarker,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const nodeIconCache = new Map<string, L.DivIcon>();

function getNodeIcon(fillColor: string, strokeColor: string, category: NodeMapStatus) {
  const key = `${fillColor}:${strokeColor}:${category}`;
  const cached = nodeIconCache.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    className: styles.nodePin,
    html: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="40">
        <defs>
          <filter id="node-shadow-${fillColor.replace("#", "")}" x="-20%" y="-10%" width="140%" height="130%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" flood-color="rgba(0,0,0,0.35)"/>
          </filter>
        </defs>
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
          fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" filter="url(#node-shadow-${fillColor.replace("#", "")})" />
        <circle cx="12" cy="11" r="6" fill="white" opacity="0.96"/>
        <text x="12" y="14" text-anchor="middle" font-size="8" font-weight="900" font-family="Arial, sans-serif" fill="${fillColor}">${getNodeStatusSymbol(category)}</text>
      </svg>
    `,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -38],
  });

  nodeIconCache.set(key, icon);
  return icon;
}

function formatMetricNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("vi-VN") : String(value);
}

function getNodeMarkerColors(node: any): { fill: string; stroke: string } {
  const efficiency = typeof node?.portEfficiency === "number" ? node.portEfficiency : null;
  const dateKd = node?.dateKd ? new Date(node.dateKd) : null;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const isOlderThanOneYear = !!dateKd && !Number.isNaN(dateKd.getTime()) && dateKd < oneYearAgo;

  if (isOlderThanOneYear && efficiency === 0) return { fill: "#dc2626", stroke: "#991b1b" };
  if (efficiency !== null && efficiency > 0 && efficiency < 0.13) return { fill: "#f97316", stroke: "#c2410c" };
  if (efficiency !== null && efficiency >= 0.13 && efficiency <= 0.25) return { fill: "#9333ea", stroke: "#6b21a8" };
  return { fill: "#0ea5e9", stroke: "#0369a1" };
}

function getNodeMarkerCategory(node: any): NodeMapStatus {
  const efficiency = typeof node?.portEfficiency === "number" ? node.portEfficiency : null;
  const dateKd = node?.dateKd ? new Date(node.dateKd) : null;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const isOlderThanOneYear = !!dateKd && !Number.isNaN(dateKd.getTime()) && dateKd < oneYearAgo;

  if (isOlderThanOneYear && efficiency === 0) return "RED";
  if (efficiency !== null && efficiency > 0 && efficiency < 0.13) return "ORANGE";
  if (efficiency !== null && efficiency >= 0.13 && efficiency <= 0.25) return "PURPLE";
  return "DEFAULT";
}

function getPopupToneClass(category: NodeMapStatus) {
  switch (category) {
    case "RED":
      return styles.popupToneRed;
    case "ORANGE":
      return styles.popupToneOrange;
    case "PURPLE":
      return styles.popupTonePurple;
    default:
      return styles.popupToneDefault;
  }
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
}

function getNodeStatusText(node: any) {
  switch (getNodeMarkerCategory(node)) {
    case "RED":
      return "Cảnh báo đỏ";
    case "ORANGE":
      return "Hiệu suất thấp";
    case "PURPLE":
      return "Theo dõi";
    default:
      return "Ổn định";
  }
}

function normalizeNodeLookup(value: string) {
  return value.trim().toUpperCase();
}

function toBaseNodeName(value: string) {
  return value.replace(/-SP\d+$/i, "").trim();
}

function findNodeByFocusName(nodes: any[], nodeName: string) {
  const normalizedTarget = normalizeNodeLookup(nodeName);
  const baseTarget = normalizeNodeLookup(toBaseNodeName(nodeName));

  return (
    nodes.find((node) => normalizeNodeLookup(String(node.name || "")) === normalizedTarget) ||
    nodes.find((node) => normalizeNodeLookup(String(node.name || "")) === baseTarget) ||
    nodes.find((node) => normalizedTarget.startsWith(`${normalizeNodeLookup(String(node.name || ""))}-`)) ||
    nodes.find((node) => normalizeNodeLookup(String(node.name || "")).startsWith(`${baseTarget}-`))
  );
}

function buildNodePopupCardHtml(node: any, userLocation: [number, number] | null) {
  const category = getNodeMarkerCategory(node);
  const description = String(node.description || "").trim();
  const totalPortText = escapeHtml(formatMetricNumber(node.totalIntPort));
  const usedPortText = escapeHtml(formatMetricNumber(node.usedPort));
  const efficiencyText = escapeHtml(formatMapPercent(node.portEfficiency));
  const dateKdText = escapeHtml(node.dateKd ? format(new Date(node.dateKd), "dd/MM/yyyy") : "-");
  const statusText = escapeHtml(node.efficiencyStatus || getNodeStatusText(node));
  const coordinateText = `${Number(node.latitude).toFixed(6)}, ${Number(node.longitude).toFixed(6)}`;
  const portUsageText = `${usedPortText} / ${totalPortText}`;
  const distanceText = userLocation
    ? `${getDistanceFromLatLonInKm(userLocation[0], userLocation[1], node.latitude, node.longitude).toFixed(2)} km`
    : null;
  const mapLink = userLocation
    ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation[0]},${userLocation[1]}&destination=${node.latitude},${node.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${node.latitude},${node.longitude}`;

  return `
    <div class="${styles.popupContent}">
      <div class="${styles.popupHeader}">
        <div class="${styles.popupTitleBlock}">
          <h3 class="${styles.popupName}">${escapeHtml(node.name)}</h3>
          <span class="${styles.popupStatusBadge} ${getPopupToneClass(category)}">${statusText}</span>
        </div>
        ${description ? `<p class="${styles.popupDescription}">${escapeHtml(description)}</p>` : ""}
      </div>
      <div class="${styles.popupBody}">
        <div class="${styles.popupInfoList}">
          <div class="${styles.popupInfoItem}">
            <span class="${styles.popupInfoLabel}">Hiệu suất</span>
            <span class="${styles.popupInfoValue} ${styles.popupInfoValueStrong}">${efficiencyText}</span>
          </div>
          <div class="${styles.popupInfoItem}">
            <span class="${styles.popupInfoLabel}">Port dùng</span>
            <span class="${styles.popupInfoValue} ${styles.popupInfoValueStrong}">${escapeHtml(portUsageText)}</span>
          </div>
          <div class="${styles.popupInfoItem}">
            <span class="${styles.popupInfoLabel}">Ngày hoạt động</span>
            <span class="${styles.popupInfoValue}">${dateKdText}</span>
          </div>
        </div>
        <div class="${styles.popupFooterMeta}">
          <span>${escapeHtml(coordinateText)}</span>
          ${distanceText ? `<span>• ${escapeHtml(distanceText)}</span>` : ""}
        </div>
      </div>
      <div class="${styles.popupActions}">
        <a href="${escapeHtml(mapLink)}" target="_blank" rel="noopener noreferrer" class="ui-action-btn ui-action-btn--compact ui-action-btn--primary ${styles.popupPrimaryAction}">
          Chỉ đường
        </a>
        <button
          type="button"
          onclick="window.dispatchEvent(new CustomEvent('showNodeAccounts',{detail: decodeURIComponent('${encodeURIComponent(String(node.name))}')}))"
          class="ui-action-btn ui-action-btn--compact ui-action-btn--pill ${styles.popupSecondaryAction}"
        >
          Xem account
        </button>
      </div>
    </div>
  `;
}

function FlyToPosition({ position, zoom }: { position: [number, number] | null; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom || 15, { duration: 1.2 });
    }
  }, [position, zoom, map]);

  return null;
}

function MapRefBridge({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  return null;
}

function MapSizeBridge() {
  const map = useMap();

  useEffect(() => {
    const syncSize = () => {
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    };

    syncSize();
    const timeoutId = window.setTimeout(syncSize, 240);
    window.addEventListener("resize", syncSize);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", syncSize);
    };
  }, [map]);

  return null;
}

function ZoomTracker({ onChange }: { onChange: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handleZoom = () => {
      onChange(map.getZoom());
    };
    map.on("zoomend", handleZoom);
    handleZoom();
    return () => {
      map.off("zoomend", handleZoom);
    };
  }, [map, onChange]);

  return null;
}

function VanillaMarkerCluster({
  nodes,
  userLocationRef,
  markersRefObj,
  onMarkersReady,
}: {
  nodes: any[];
  userLocationRef: React.MutableRefObject<[number, number] | null>;
  markersRefObj: React.MutableRefObject<any>;
  onMarkersReady?: () => void;
}) {
  const map = useMap();
  const clusterRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import("leaflet.markercluster").then(() => {
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    const cg = (L as any).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 80,
      disableClusteringAtZoom: 18,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: any) => {
        const childMarkers = cluster.getAllChildMarkers();
        const childCount = cluster.getChildCount();
        const prefixCounts: Record<string, number> = {};
        let maxCount = 0;
        let mainPrefix = "";
        let hasRed = false;
        let hasOrange = false;
        let hasPurple = false;

        childMarkers.forEach((marker: any) => {
          const category = (marker as any).nodeCategory;
          if (category === "RED") hasRed = true;
          else if (category === "ORANGE") hasOrange = true;
          else if (category === "PURPLE") hasPurple = true;

          const name = marker.options.title || "";
          const parts = name.split("-");
          let prefix = parts[0];

          if (childCount < 10 && parts.length > 1) {
            prefix = `${parts[0]}-${parts[1]}`;
          }

          prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
          if (prefixCounts[prefix] > maxCount) {
            maxCount = prefixCounts[prefix];
            mainPrefix = prefix;
          }
        });

        let clusterCategory: NodeMapStatus = "DEFAULT";
        let clusterColorClass = "";
        if (hasRed) {
          clusterCategory = "RED";
          clusterColorClass = styles.clusterRed;
        } else if (hasOrange) {
          clusterCategory = "ORANGE";
          clusterColorClass = styles.clusterOrange;
        } else if (hasPurple) {
          clusterCategory = "PURPLE";
          clusterColorClass = styles.clusterPurple;
        }

        return L.divIcon({
          html: `<div class="${styles.customClusterLabel} ${clusterColorClass}"><span class="${styles.clusterStatusSymbol}">${getNodeStatusSymbol(clusterCategory)}</span>${escapeHtml(mainPrefix)} <span class="${styles.clusterCount}">(${childCount})</span></div>`,
          className: styles.customClusterIcon,
          iconSize: undefined,
        });
      },
    });

    clusterRef.current = cg;

    const leafletMarkers = nodes.map((node: any) => {
      const nodeColors = getNodeMarkerColors(node);
      const nodeCategory = getNodeMarkerCategory(node);
      const marker = L.marker([node.latitude, node.longitude], {
        icon: getNodeIcon(nodeColors.fill, nodeColors.stroke, nodeCategory),
        title: node.name,
      });
      (marker as any).nodeCategory = nodeCategory;

      marker.bindTooltip(node.name, {
        permanent: true,
        direction: "right",
        className: styles.nodeLabel,
        offset: [10, 0],
      });

      marker.bindPopup(() => buildNodePopupCardHtml(node, userLocationRef.current), {
        autoPanPaddingTopLeft: [10, 160],
        className: styles.leafletPopup,
        maxWidth: 340,
      });

      markersRefObj.current[node.id] = { marker, cg };
      return marker;
    });

    cg.addLayers(leafletMarkers);
    map.addLayer(cg);
    onMarkersReady?.();

    return () => {
      map.removeLayer(cg);
    };
  }, [nodes, ready, map, onMarkersReady, userLocationRef, markersRefObj]);

  return null;
}

export default function NodeMapComponent() {
  const searchParams = useSearchParams();
  const [currentZoom, setCurrentZoom] = useState(12);
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [nodes, setNodes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [flyZoom, setFlyZoom] = useState(15);
  const [locationError, setLocationError] = useState("");
  const [nearestNode, setNearestNode] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingEfficiency, setIsUploadingEfficiency] = useState(false);
  const [isUploadingCustomerNodeMap, setIsUploadingCustomerNodeMap] = useState(false);
  const [showCustomerNodePanel, setShowCustomerNodePanel] = useState(false);
  const [customerNodeSearch, setCustomerNodeSearch] = useState("");
  const [customerNodeRows, setCustomerNodeRows] = useState<CustomerNodeMappingRow[]>([]);
  const [customerNodePage, setCustomerNodePage] = useState(1);
  const [customerNodeTotalPages, setCustomerNodeTotalPages] = useState(1);
  const [customerNodeTotal, setCustomerNodeTotal] = useState(0);
  const [isLoadingCustomerNodePanel, setIsLoadingCustomerNodePanel] = useState(false);
  const [showNodeAccountsPanel, setShowNodeAccountsPanel] = useState(false);
  const [selectedNodeName, setSelectedNodeName] = useState("");
  const [nodeAccountRows, setNodeAccountRows] = useState<NodeAccountRow[]>([]);
  const [nodeAccountPage, setNodeAccountPage] = useState(1);
  const [nodeAccountTotalPages, setNodeAccountTotalPages] = useState(1);
  const [nodeAccountTotal, setNodeAccountTotal] = useState(0);
  const [isLoadingNodeAccounts, setIsLoadingNodeAccounts] = useState(false);
  const [copiedNodeAccount, setCopiedNodeAccount] = useState<string | null>(null);
  const [markerLayerReadyTick, setMarkerLayerReadyTick] = useState(0);
  const [colorFilter, setColorFilter] = useState<NodeColorFilter>("ALL");
  const [radiusFilter, setRadiusFilter] = useState<number | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyleMode>("light");
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [importReport, setImportReport] = useState<{ title: string; message: string } | null>(null);

  const userLocationRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  const optionsMenuRef = useRef<HTMLDivElement | null>(null);
  const customerNodePanelRef = useRef<HTMLDivElement | null>(null);
  const nodeAccountsPanelRef = useRef<HTMLDivElement | null>(null);
  const focusRetryTimeoutRef = useRef<number | null>(null);
  const markersRef = useRef<{ [key: string]: { marker: L.Marker; cg: any } }>({});
  const mapRef = useRef<L.Map | null>(null);
  const searchedCoordinateMarkerRef = useRef<L.Marker | null>(null);
  const lastFocusedNodeRef = useRef<string>("");
  const [searchedCoordinate, setSearchedCoordinate] = useState<{lat: number, lng: number, nearestNodeInfo: string} | null>(null);

  const { items: apiSearchItems, loading: searching } = useMapSearch<any>({
    endpoint: "/api/node-search-map",
    query: searchQuery,
    limit: 20,
  });

  const searchItems = useMemo(() => {
    let results = [...apiSearchItems];
    const coordinateMatch = searchQuery.trim().match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    
    if (coordinateMatch) {
      const lat = parseFloat(coordinateMatch[1]);
      const lng = parseFloat(coordinateMatch[2]);
      
      let minDistance = Infinity;
      let nearestNodeName = "Đang tính toán...";
      
      if (nodes.length > 0) {
        let nearestNodeObj: any = null;
        nodes.forEach(node => {
          const dist = getDistanceFromLatLonInKm(lat, lng, node.latitude, node.longitude);
          if (dist < minDistance) {
            minDistance = dist;
            nearestNodeObj = node;
          }
        });
        if (nearestNodeObj) {
           nearestNodeName = nearestNodeObj.name;
        }
      }

      results = [{
        id: "virtual-coordinate",
        name: `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        latitude: lat,
        longitude: lng,
        isCoordinateObject: true,
        nearestNodeInfo: nearestNodeName !== "Đang tính toán..." 
          ? `Node gần nhất: ${nearestNodeName} (cách ${(minDistance * 1000).toFixed(0)}m)`
          : nearestNodeName
      }, ...results];
    }
    return results;
  }, [apiSearchItems, searchQuery, nodes]);

  useEffect(() => {
    const visibleCount = Math.min(searchItems.length, 10);
    setSearchActiveIndex((current) => (current >= visibleCount ? visibleCount - 1 : current));
  }, [searchItems.length]);

  const handleMarkersReady = useCallback(() => {
    setMarkerLayerReadyTick((current) => current + 1);
  }, []);

  const filterCounts = useMemo(() => {
    return nodes.reduce<Record<NodeColorFilter, number>>(
      (acc, node) => {
        acc.ALL += 1;
        acc[getNodeMarkerCategory(node)] += 1;
        return acc;
      },
      { ALL: 0, RED: 0, ORANGE: 0, PURPLE: 0, DEFAULT: 0 },
    );
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (colorFilter !== "ALL") {
      result = result.filter((node) => getNodeMarkerCategory(node) === colorFilter);
    }
    if (radiusFilter !== null && userLocation) {
      result = result.filter((node) => {
        const dist = getDistanceFromLatLonInKm(userLocation[0], userLocation[1], node.latitude, node.longitude);
        return dist <= radiusFilter;
      });
    }
    return result;
  }, [colorFilter, nodes, radiusFilter, userLocation]);

  const hasActiveFilters = hasActiveNodeMapFilters(colorFilter, radiusFilter);
  const mapCountLabel = formatNodeMapCount(filteredNodes.length, nodes.length, hasActiveFilters);

  const handleExportFilteredNodes = () => {
    if (filteredNodes.length === 0) {
      toast.error("Không có trạm node nào trong bộ lọc hiện tại để xuất Excel.");
      return;
    }

    import("xlsx").then((xlsx) => {
      const rows = filteredNodes.map((node) => ({
        "Mã Node": node.name,
        "Vĩ độ (Lat)": node.latitude,
        "Kinh độ (Lng)": node.longitude,
        "Tổng Port": node.totalIntPort ?? "",
        "Port đã dùng": node.usedPort ?? "",
        "Hiệu suất (%)": typeof node.portEfficiency === "number" ? `${(node.portEfficiency * 100).toFixed(2)}%` : "",
        "Ngày hoạt động": node.dateKd ? format(new Date(node.dateKd), "dd/MM/yyyy") : "",
        "Trạng thái": node.efficiencyStatus || getNodeStatusText(node),
        "Mô tả": node.description || "",
      }));

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 28 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
        { wch: 30 },
      ];
      xlsx.utils.book_append_sheet(wb, ws, "DanhSachNode");
      const filterName = colorFilter !== "ALL" ? `_${colorFilter.toLowerCase()}` : "";
      const radiusName = radiusFilter !== null ? `_${radiusFilter}km` : "";
      xlsx.writeFile(wb, `Danh_sach_node${filterName}${radiusName}_${format(new Date(), "yyyyMMdd")}.xlsx`);
    });
  };

  const fetchNodes = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/nodes");
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.data)) {
        throw new Error(data.error || "Không thể tải dữ liệu node.");
      }
      setNodes(data.data);
    } catch (error) {
      console.error("NODE_MAP_LOAD_ERROR", error);
      setLoadError("Không thể tải dữ liệu bản đồ node.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomerNodeMappings = useCallback(async (page = customerNodePage, search = customerNodeSearch) => {
    setIsLoadingCustomerNodePanel(true);
    try {
      const params = new URLSearchParams({
        view: "account-node-mappings",
        page: String(page),
        limit: "20",
      });

      if (search.trim()) {
        params.set("q", search.trim());
      }

      const response = await fetch(`/api/nodes?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể tải danh sách Account -> Node.");
      }

      setCustomerNodeRows(Array.isArray(data.items) ? data.items : []);
      setCustomerNodePage(Number(data.page || 1));
      setCustomerNodeTotalPages(Number(data.totalPages || 1));
      setCustomerNodeTotal(Number(data.total || 0));
    } catch (error) {
      console.error("CUSTOMER_NODE_PANEL_ERROR", error);
      setCustomerNodeRows([]);
      setCustomerNodeTotal(0);
      setCustomerNodeTotalPages(1);
    } finally {
      setIsLoadingCustomerNodePanel(false);
    }
  }, [customerNodePage, customerNodeSearch]);

  const fetchNodeAccounts = useCallback(async (nodeName = selectedNodeName, page = nodeAccountPage) => {
    if (!nodeName.trim()) return;

    setIsLoadingNodeAccounts(true);
    try {
      const params = new URLSearchParams({
        view: "node-accounts",
        nodeName,
        page: String(page),
        limit: "30",
      });

      const response = await fetch(`/api/nodes?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể tải danh sách account trên node.");
      }

      setNodeAccountRows(Array.isArray(data.items) ? data.items : []);
      setNodeAccountPage(Number(data.page || 1));
      setNodeAccountTotalPages(Number(data.totalPages || 1));
      setNodeAccountTotal(Number(data.total || 0));
    } catch (error) {
      console.error("NODE_ACCOUNTS_PANEL_ERROR", error);
      setNodeAccountRows([]);
      setNodeAccountPage(1);
      setNodeAccountTotalPages(1);
      setNodeAccountTotal(0);
    } finally {
      setIsLoadingNodeAccounts(false);
    }
  }, [nodeAccountPage, selectedNodeName]);

  useEffect(() => {
    void fetchNodes();
  }, []);

  useEffect(() => {
    if (!showCustomerNodePanel || session?.user?.role !== "ADMIN") return;
    const timeoutId = window.setTimeout(() => {
      void fetchCustomerNodeMappings(customerNodePage, customerNodeSearch);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [customerNodePage, customerNodeSearch, fetchCustomerNodeMappings, session?.user?.role, showCustomerNodePanel]);

  useEffect(() => {
    if (!showNodeAccountsPanel || !selectedNodeName.trim()) return;
    const timeoutId = window.setTimeout(() => {
      void fetchNodeAccounts(selectedNodeName, nodeAccountPage);
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [fetchNodeAccounts, nodeAccountPage, selectedNodeName, showNodeAccountsPanel]);

  useEffect(() => {
    const handleShowNodeAccounts = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const nodeName = String(customEvent.detail || "").trim();
      if (!nodeName) return;

    setSelectedNodeName(nodeName);
    setNodeAccountPage(1);
    setShowNodeAccountsPanel(true);
    setShowCustomerNodePanel(false);
    setShowOptionsMenu(false);
    };

    window.addEventListener("showNodeAccounts", handleShowNodeAccounts as EventListener);
    return () => window.removeEventListener("showNodeAccounts", handleShowNodeAccounts as EventListener);
  }, []);

  const requestUserLocation = (pendingRadius?: number) => {
    if (!navigator.geolocation) {
      setLocationError("Trình duyệt không hỗ trợ định vị");
      toast.error("Trình duyệt không hỗ trợ định vị.");
      return;
    }

    setIsLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
        setUserLocation(nextLocation);
        setFlyTarget(nextLocation);
        setFlyZoom(16);
        if (pendingRadius !== undefined) setRadiusFilter(pendingRadius);
        setIsLocating(false);
      },
      () => {
        setLocationError("Không thể lấy vị trí hiện tại");
        setIsLocating(false);
        toast.error("Không thể lấy vị trí hiện tại. Hãy kiểm tra quyền GPS của trình duyệt.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    if (!userLocation || nodes.length === 0) return;

    let minDistance = Infinity;
    let nearest = null;

    nodes.forEach((node) => {
      const distance = getDistanceFromLatLonInKm(
        userLocation[0],
        userLocation[1],
        node.latitude,
        node.longitude,
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = node;
      }
    });

    setNearestNode(nearest);
  }, [userLocation, nodes]);

  useEffect(() => {
    if (!showOptionsMenu && !showCustomerNodePanel && !showNodeAccountsPanel) return;

    const handleOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;

      if (optionsMenuRef.current && !optionsMenuRef.current.contains(target)) {
        setShowOptionsMenu(false);
      }

      if (customerNodePanelRef.current && !customerNodePanelRef.current.contains(target)) {
        setShowCustomerNodePanel(false);
      }

      if (nodeAccountsPanelRef.current && !nodeAccountsPanelRef.current.contains(target)) {
        setShowNodeAccountsPanel(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowOptionsMenu(false);
      setShowCustomerNodePanel(false);
      setShowNodeAccountsPanel(false);
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showCustomerNodePanel, showNodeAccountsPanel, showOptionsMenu]);

  const handleGoToMyLocation = () => {
    if (!userLocation) {
      requestUserLocation();
      return;
    }

    setFlyTarget(null);
    setTimeout(() => {
      setFlyTarget(userLocation);
      setFlyZoom(16);

      if (nearestNode) {
        setTimeout(() => {
          const refObj = markersRef.current[nearestNode.id];
          if (refObj) {
            refObj.cg.zoomToShowLayer(refObj.marker, () => {
              refObj.marker.openPopup();
            });
          }
        }, 1200);
      }
    }, 10);
  };

  const handleNodeClick = useCallback((node: any) => {
    setSearchQuery("");
    setSearchActiveIndex(-1);
    if (hasActiveNodeMapFilters(colorFilter, radiusFilter)) {
      toast("Đã xóa bộ lọc để hiển thị node đã chọn.");
    }
    setColorFilter("ALL");
    setRadiusFilter(null);
    const target: [number, number] = [node.latitude, node.longitude];
    setFlyTarget(target);
    setFlyZoom(17);
    setShowOptionsMenu(false);

    if (mapRef.current) {
      mapRef.current.flyTo(target, 17, { duration: 0.9 });
    }

    if (node.isCoordinateObject) {
      setSearchedCoordinate({
         lat: node.latitude,
         lng: node.longitude,
         nearestNodeInfo: node.nearestNodeInfo
      });
      // Try to open it shortly after setting state
      setTimeout(() => {
        if (searchedCoordinateMarkerRef.current) {
          searchedCoordinateMarkerRef.current.openPopup();
        }
      }, 300);
      return;
    }

    setSearchedCoordinate(null);
    const openMarker = (attempt = 0) => {
      const refObj = markersRef.current[node.id];
      if (refObj) {
        refObj.cg.zoomToShowLayer(refObj.marker, () => {
          refObj.marker.openPopup();
        });
        return;
      }
      if (attempt < 8) window.setTimeout(() => openMarker(attempt + 1), 60);
    };

    openMarker();
  }, [colorFilter, radiusFilter]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleFitNodes = () => {
    const visibleNodes = filteredNodes.length > 0 ? filteredNodes : nodes;
    if (visibleNodes.length === 0 || !mapRef.current) {
      toast.error("Không có node để hiển thị.");
      return;
    }

    const bounds = L.latLngBounds(
      visibleNodes.map((node) => [Number(node.latitude), Number(node.longitude)] as [number, number]),
    );
    mapRef.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
  };

  const handleFocusNodeByName = useCallback(
    (nodeName: string) => {
      const targetNode = findNodeByFocusName(nodes, nodeName);
      if (!targetNode) return;

      setShowCustomerNodePanel(false);
      setShowNodeAccountsPanel(false);
      handleNodeClick(targetNode);
    },
    [handleNodeClick, nodes],
  );

  useEffect(() => {
    const focusNode = (searchParams.get("focusNode") || "").trim();
    if (!focusNode || nodes.length === 0 || markerLayerReadyTick === 0) return;

    const targetNode = findNodeByFocusName(nodes, focusNode);
    if (!targetNode) return;

    const focusKey = `${focusNode}:${targetNode.id}`;
    const focusAttemptKey = `${focusKey}:${markerLayerReadyTick}`;
    if (lastFocusedNodeRef.current === focusAttemptKey) return;

    setSearchQuery("");
    setSearchActiveIndex(-1);
    setShowOptionsMenu(false);

    if (focusRetryTimeoutRef.current) {
      window.clearTimeout(focusRetryTimeoutRef.current);
    }

    focusRetryTimeoutRef.current = window.setTimeout(() => {
      const refObj = markersRef.current[targetNode.id];
      if (!refObj) return;
      refObj.cg.zoomToShowLayer(refObj.marker, () => {
        refObj.marker.openPopup();
        const popup = refObj.marker.getPopup();
        popup?.update();
      });
      lastFocusedNodeRef.current = focusAttemptKey;
    }, 220);
  }, [markerLayerReadyTick, nodes, searchParams]);

  useEffect(() => {
    return () => {
      if (focusRetryTimeoutRef.current) {
        window.clearTimeout(focusRetryTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyNodeAccount = useCallback(async (account: string) => {
    try {
      await navigator.clipboard.writeText(account);
      setCopiedNodeAccount(account);
      window.setTimeout(() => {
        setCopiedNodeAccount((current) => (current === account ? null : current));
      }, 1600);
    } catch (error) {
      console.error("COPY_NODE_ACCOUNT_ERROR", error);
    }
  }, []);

  const handleUploadKMZ = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setShowOptionsMenu(false);
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/nodes/upload", { method: "POST", body: formData });
      let data: any;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text.slice(0, 150) || `HTTP ${response.status}`);
      }

      if (response.ok) {
        toast.success(data.message || "Đã cập nhật vị trí node.");
        await fetchNodes();
      } else {
        toast.error(data.error || "Không thể cập nhật vị trí node.");
      }
    } catch (err: any) {
      toast.error(`Lỗi upload file KML/KMZ: ${err?.message || err}`);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleUploadEfficiency = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setShowOptionsMenu(false);
    setIsUploadingEfficiency(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/nodes/upload", { method: "POST", body: formData });
      let data: any;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text.slice(0, 150) || `HTTP ${response.status}`);
      }

      if (response.ok) {
        const errorCount = Array.isArray(data.errors) ? data.errors.length : 0;
        const notMatchedText =
          Array.isArray(data.notMatchedSamples) && data.notMatchedSamples.length > 0
            ? `\n- Mẫu NODE_CODE không khớp: ${data.notMatchedSamples.join(", ")}`
            : "";

        let alertMessage = `${data.message || "Import thành công"}\n- Tổng dòng: ${data.totalRows ?? 0}\n- Cập nhật: ${data.updated ?? 0}\n- Không khớp NODE_CODE: ${data.notMatched ?? 0}\n- Lỗi parse: ${errorCount}${notMatchedText}`;

        if (errorCount > 0) {
          alertMessage += `\n\nChi tiết lỗi ở một số dòng:\n${data.errors.slice(0, 10).join("\n")}`;
          if (errorCount > 10) {
            alertMessage += `\n... và ${errorCount - 10} lỗi khác.`;
          }
        }

        setImportReport({ title: "Kết quả import hiệu suất node", message: alertMessage });
        await fetchNodes();
      } else {
        toast.error(data.error || "Không thể import hiệu suất node.");
      }
    } catch (err: any) {
      toast.error(`Lỗi import file hiệu suất node: ${err?.message || err}`);
    } finally {
      setIsUploadingEfficiency(false);
      event.target.value = "";
    }
  };

  const handleUploadCustomerNodeMap = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setShowOptionsMenu(false);
    setIsUploadingCustomerNodeMap(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/nodes/upload", { method: "POST", body: formData });
      let data: any;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text.slice(0, 150) || `HTTP ${response.status}`);
      }

      if (response.ok) {
        const errorCount = Array.isArray(data.errors) ? data.errors.length : 0;
        let alertMessage = `${data.message || "Import thành công"}\n- Tổng dòng: ${data.totalRows ?? 0}\n- Hợp lệ: ${data.imported ?? 0}\n- Thêm mới mapping: ${data.inserted ?? 0}\n- Cập nhật mapping: ${data.updated ?? 0}\n- Đồng bộ khách hàng: ${data.syncedCustomers ?? 0}\n- Lỗi parse: ${errorCount}`;

        if (errorCount > 0) {
          alertMessage += `\n\nChi tiết lỗi ở một số dòng:\n${data.errors.slice(0, 10).join("\n")}`;
          if (errorCount > 10) {
            alertMessage += `\n... và ${errorCount - 10} lỗi khác.`;
          }
        }

        setImportReport({ title: "Kết quả import node thuê bao", message: alertMessage });
        if (showCustomerNodePanel) {
          setCustomerNodePage(1);
          void fetchCustomerNodeMappings(1, customerNodeSearch);
        }
      } else {
        toast.error(data.error || "Không thể import node thuê bao.");
      }
    } catch (err: any) {
      toast.error(`Lỗi import file node thuê bao: ${err?.message || err}`);
    } finally {
      setIsUploadingCustomerNodeMap(false);
      event.target.value = "";
    }
  };

  const handleDownloadCustomerNodeTemplate = () => {
    setShowOptionsMenu(false);
    window.open("/api/nodes?downloadTemplate=account-node-map", "_blank");
  };

  const handleDownloadNodeEfficiencyTemplate = () => {
    setShowOptionsMenu(false);
    window.open("/api/nodes?downloadTemplate=node-efficiency", "_blank");
  };

  const defaultCenter: [number, number] = [11.537969, 107.955546];
  const mapCenter =
    userLocation || (nodes.length > 0 ? ([nodes[0].latitude, nodes[0].longitude] as [number, number]) : defaultCenter);
  const nearestDistance =
    userLocation && nearestNode
      ? getDistanceFromLatLonInKm(
          userLocation[0],
          userLocation[1],
          nearestNode.latitude,
          nearestNode.longitude,
        ).toFixed(2)
      : null;
  const tileConfig = getMapTileConfig(mapStyle);

  return (
    <div className={styles.mapOuter}>
      <MapToolbar className={styles.searchOverlay} label="Công cụ bản đồ hạ tầng node">
        <div className={`${styles.toolbarPanel} ${styles.searchToolbar}`}>
          <div className={styles.toolbarMainRow}>
            <div className={styles.searchFieldShell}>
              <div className={styles.searchBar}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Tìm node theo tên hoặc tọa độ..."
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchActiveIndex(-1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const navigationKey = e.key;
                      setSearchActiveIndex((current) =>
                        getNextMapSearchIndex(current, navigationKey, Math.min(searchItems.length, 10)),
                      );
                      return;
                    }
                    if (e.key === "Enter" && searchItems.length > 0) {
                      e.preventDefault();
                      handleNodeClick(searchItems[searchActiveIndex >= 0 ? searchActiveIndex : 0]);
                      return;
                    }
                    if (e.key === "Escape") {
                      setSearchQuery("");
                      setSearchActiveIndex(-1);
                    }
                  }}
                  className={styles.searchInput}
                  role="combobox"
                  aria-label="Tìm node trên bản đồ"
                  aria-expanded={Boolean(searchQuery.trim())}
                  aria-autocomplete="list"
                  aria-controls="node-map-search-results"
                  aria-activedescendant={
                    searchActiveIndex >= 0 ? `node-map-search-results-option-${searchActiveIndex}` : undefined
                  }
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.clearBtn}
                    onClick={() => {
                      setSearchQuery("");
                      setSearchActiveIndex(-1);
                    }}
                    aria-label="Xóa tìm kiếm"
                    title="Xóa"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {searchQuery.trim() && (
                <MapSearchResults
                  id="node-map-search-results"
                  className={styles.searchResults}
                  items={searchItems}
                  loading={searching}
                  visibleCount={10}
                  resultNoun="node"
                  emptyText="Không tìm thấy node phù hợp."
                  onSelect={handleNodeClick}
                  activeIndex={searchActiveIndex}
                  onActiveIndexChange={setSearchActiveIndex}
                  getPrimaryText={(node) => node.name}
                  getSecondaryText={(node) =>
                    node.isCoordinateObject
                      ? node.nearestNodeInfo
                      : `${Number(node.latitude).toFixed(5)}, ${Number(node.longitude).toFixed(5)}${
                          node.distanceKm !== undefined ? ` • ${Number(node.distanceKm).toFixed(2)} km` : ""
                        }`
                  }
                  renderActions={(node) => (
                    <button
                      type="button"
                      className={`ui-icon-btn ${styles.actionBtnIcon}`}
                      title="Xem trên bản đồ"
                      aria-label="Xem trên bản đồ"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNodeClick(node);
                      }}
                    >
                      <MapPin size={16} />
                    </button>
                  )}
                />
              )}
            </div>

            <div className={styles.toolbarActionStack}>
              <div className={styles.primaryActionsRow}>
                <NodeMapOptionsMenu
                  ref={optionsMenuRef}
                  open={showOptionsMenu}
                  canAdmin={session?.user?.role === "ADMIN"}
                  mapStyle={mapStyle}
                  busy={isUploading || isUploadingEfficiency || isUploadingCustomerNodeMap}
                  onToggle={() => setShowOptionsMenu((current) => !current)}
                  onClose={() => setShowOptionsMenu(false)}
                  onExport={handleExportFilteredNodes}
                  onMapStyleChange={setMapStyle}
                  onUploadNodes={handleUploadKMZ}
                  onUploadEfficiency={handleUploadEfficiency}
                  onUploadCustomerNodeMap={handleUploadCustomerNodeMap}
                  onShowCustomerNodeMappings={() => {
                    setShowCustomerNodePanel(true);
                    setShowNodeAccountsPanel(false);
                    setCustomerNodePage(1);
                  }}
                  onDownloadCustomerNodeTemplate={handleDownloadCustomerNodeTemplate}
                  onDownloadNodeEfficiencyTemplate={handleDownloadNodeEfficiencyTemplate}
                />

                <button
                  type="button"
                  className={`ui-action-btn ui-action-btn--pill ${styles.mapActionBtn} ${styles.secondaryActionBtn}`}
                  onClick={handleGoToMyLocation}
                  disabled={isLocating}
                  title={userLocation ? "Vị trí của tôi" : locationError || "Dùng vị trí của tôi"}
                >
                  {isLocating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                  <span className={styles.actionLabel}>Vị trí</span>
                </button>

                <Link
                  href="/node-0tb"
                  className={`ui-action-btn ui-action-btn--pill ${styles.mapActionBtn} ${styles.secondaryActionBtn}`}
                  title="Chuyển sang Bản đồ Node 0TB"
                >
                  <Zap size={14} style={{ color: "#f59e0b" }} />
                  <span className={styles.actionLabel}>Node 0TB</span>
                </Link>
              </div>
            </div>
          </div>

        </div>

        <div className={`${styles.toolbarPanel} ${styles.filterPanel}`}>
          <MapLegend className={styles.filterControls} label="Chú giải hiệu suất node">
            {NODE_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`ui-filter-chip ${styles.filterBtn} ${colorFilter === filter.key ? styles.active : ""}`}
                onClick={() => setColorFilter(filter.key)}
                title={filter.description}
                aria-label={`${filter.label}: ${filter.description}`}
                aria-pressed={colorFilter === filter.key}
              >
                <span className={styles.filterLabelGroup}>
                  {filter.toneClass && <span className={`${styles.filterDot} ${styles[filter.toneClass]}`}></span>}
                  <span>{filter.label}</span>
                </span>
                <span className={styles.filterCount}>{filterCounts[filter.key].toLocaleString("vi-VN")}</span>
              </button>
            ))}

            <span className={styles.filterDivider} aria-hidden="true" />

            {[1, 3, 5].map((km) => (
              <button
                key={km}
                type="button"
                className={`ui-filter-chip ${styles.filterBtn} ${radiusFilter === km ? styles.active : ""}`}
                onClick={() => {
                  if (!userLocation) {
                    requestUserLocation(km);
                    return;
                  }
                  setRadiusFilter((curr) => (curr === km ? null : km));
                }}
                title={`Lọc các trạm node trong bán kính ${km}km`}
                aria-pressed={radiusFilter === km}
              >
                <span className={styles.filterLabelGroup}>
                  <Radio size={12} />
                  <span>≤ {km}km</span>
                </span>
              </button>
            ))}

            {hasActiveFilters && (
              <button
                type="button"
                className={`ui-filter-chip ${styles.filterBtn} ${styles.filterResetBtn}`}
                onClick={() => {
                  setColorFilter("ALL");
                  setRadiusFilter(null);
                }}
                aria-label="Xóa toàn bộ bộ lọc bản đồ"
              >
                <X size={12} />
                <span>Xóa lọc</span>
              </button>
            )}
          </MapLegend>
          <span className={styles.filterScrollHint}>Vuốt ngang để xem thêm</span>
        </div>

        {session?.user?.role === "ADMIN" && showCustomerNodePanel && (
          <MapPanel
            className={`${styles.toolbarPanel} ${styles.customerNodePanel}`}
            ref={customerNodePanelRef}
            labelledBy="customer-node-panel-title"
          >
            <div className={styles.customerNodePanelHeader}>
              <div>
                <div id="customer-node-panel-title" className={styles.customerNodePanelTitle}>Node thuê bao</div>
                <div className={styles.customerNodePanelMeta}>
                  {customerNodeTotal.toLocaleString("vi-VN")} mapping Account - Node
                </div>
              </div>
              <div className={styles.customerNodePanelActions}>
                <button
                  type="button"
                  className={`ui-icon-btn ${styles.customerNodePanelIconBtn}`}
                  onClick={() => void fetchCustomerNodeMappings(customerNodePage, customerNodeSearch)}
                  title="Làm mới danh sách"
                  aria-label="Làm mới danh sách mapping"
                >
                  <RefreshCw size={15} className={isLoadingCustomerNodePanel ? "animate-spin" : ""} />
                </button>
                <button
                  type="button"
                  className={`ui-icon-btn ${styles.customerNodePanelIconBtn}`}
                  onClick={() => setShowCustomerNodePanel(false)}
                  title="Đóng danh sách"
                  aria-label="Đóng danh sách mapping"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className={styles.customerNodeSearchBar}>
              <Search size={15} className={styles.customerNodeSearchIcon} />
              <input
                type="text"
                value={customerNodeSearch}
                onChange={(event) => {
                  setCustomerNodeSearch(event.target.value);
                  setCustomerNodePage(1);
                }}
                 className={styles.customerNodeSearchInput}
                 placeholder="Tìm theo Account hoặc Node..."
                 aria-label="Tìm mapping theo Account hoặc Node"
               />
            </div>

            <div className={styles.customerNodeList}>
              {isLoadingCustomerNodePanel ? (
                <div className={styles.customerNodeEmpty}>Đang tải danh sách...</div>
              ) : customerNodeRows.length === 0 ? (
                <div className={styles.customerNodeEmpty}>Chưa có dữ liệu phù hợp.</div>
              ) : (
                customerNodeRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`${styles.customerNodeRow} ${styles.customerNodeRowInteractive}`}
                    onClick={() => handleFocusNodeByName(row.nodeName)}
                    title={`Xem node ${row.nodeName}`}
                  >
                    <div className={styles.customerNodeContent}>
                      <div className={styles.customerNodeAccount}>{row.account}</div>
                      <div className={styles.customerNodeName}>{row.nodeName}</div>
                      {row.accountAddress && <div className={styles.customerNodeAddress}>{row.accountAddress}</div>}
                      <div className={styles.customerNodeUpdated}>
                        Cập nhật {format(new Date(row.updatedAt), "dd/MM/yyyy")}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className={styles.customerNodeFooter}>
              <button
                type="button"
                className={`ui-action-btn ui-action-btn--compact ui-action-btn--pill ${styles.customerNodePagerBtn}`}
                disabled={customerNodePage <= 1 || isLoadingCustomerNodePanel}
                onClick={() => setCustomerNodePage((current) => Math.max(1, current - 1))}
              >
                Trước
              </button>
              <span className={styles.customerNodeFooterMeta}>
                Trang {customerNodePage}/{customerNodeTotalPages}
              </span>
              <button
                type="button"
                className={`ui-action-btn ui-action-btn--compact ui-action-btn--pill ${styles.customerNodePagerBtn}`}
                disabled={customerNodePage >= customerNodeTotalPages || isLoadingCustomerNodePanel}
                onClick={() => setCustomerNodePage((current) => Math.min(customerNodeTotalPages, current + 1))}
              >
                Sau
              </button>
            </div>
          </MapPanel>
        )}

        {showNodeAccountsPanel && (
          <MapPanel
            className={`${styles.toolbarPanel} ${styles.customerNodePanel} ${styles.nodeAccountsPanel}`}
            ref={nodeAccountsPanelRef}
            labelledBy="node-accounts-panel-title"
          >
            <div className={styles.customerNodePanelHeader}>
              <div>
                <div id="node-accounts-panel-title" className={styles.customerNodePanelTitle}>Account trên node</div>
                <div className={styles.customerNodePanelMeta}>
                  {selectedNodeName || "Chưa chọn node"} • {nodeAccountTotal.toLocaleString("vi-VN")} account
                </div>
                <div className={styles.customerNodePanelHint}>Bao gồm cả các node con SP.</div>
              </div>
              <div className={styles.customerNodePanelActions}>
                <button
                  type="button"
                  className={`ui-icon-btn ${styles.customerNodePanelIconBtn}`}
                  onClick={() => void fetchNodeAccounts(selectedNodeName, nodeAccountPage)}
                  title="Làm mới danh sách account"
                  aria-label="Làm mới danh sách account"
                >
                  <RefreshCw size={15} className={isLoadingNodeAccounts ? "animate-spin" : ""} />
                </button>
                <button
                  type="button"
                  className={`ui-icon-btn ${styles.customerNodePanelIconBtn}`}
                  onClick={() => setShowNodeAccountsPanel(false)}
                  title="Đóng danh sách"
                  aria-label="Đóng danh sách account"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className={styles.customerNodeList}>
              {isLoadingNodeAccounts ? (
                <div className={styles.customerNodeEmpty}>Đang tải danh sách account...</div>
              ) : nodeAccountRows.length === 0 ? (
                <div className={styles.customerNodeEmpty}>Node này chưa có account phù hợp.</div>
              ) : (
                nodeAccountRows.map((row) => (
                  <div key={row.id} className={styles.customerNodeRow}>
                    <div className={styles.customerNodeContent}>
                      <div className={styles.customerNodeAccount}>{row.account}</div>
                      {row.accountAddress && <div className={styles.customerNodeAddress}>{row.accountAddress}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <a
                        href={`/customers?q=${encodeURIComponent(row.account)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`ui-icon-btn ${styles.customerNodeCopyBtn}`}
                        title="Xem chi tiết khách hàng trên CRM"
                        aria-label="Xem chi tiết khách hàng trên CRM"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button
                        type="button"
                        className={`ui-icon-btn ${styles.customerNodeCopyBtn}`}
                        onClick={() => void handleCopyNodeAccount(row.account)}
                        title={copiedNodeAccount === row.account ? "Đã copy account" : "Copy account"}
                        aria-label={copiedNodeAccount === row.account ? "Đã copy account" : "Copy account"}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={styles.customerNodeFooter}>
              <button
                type="button"
                className={`ui-action-btn ui-action-btn--compact ui-action-btn--pill ${styles.customerNodePagerBtn}`}
                disabled={nodeAccountPage <= 1 || isLoadingNodeAccounts}
                onClick={() => setNodeAccountPage((current) => Math.max(1, current - 1))}
              >
                Trước
              </button>
              <span className={styles.customerNodeFooterMeta}>
                Trang {nodeAccountPage}/{nodeAccountTotalPages}
              </span>
              <button
                type="button"
                className={`ui-action-btn ui-action-btn--compact ui-action-btn--pill ${styles.customerNodePagerBtn}`}
                disabled={nodeAccountPage >= nodeAccountTotalPages || isLoadingNodeAccounts}
                onClick={() => setNodeAccountPage((current) => Math.min(nodeAccountTotalPages, current + 1))}
              >
                Sau
              </button>
            </div>
          </MapPanel>
        )}

      </MapToolbar>

      <div className={styles.mapCountPill} aria-live="polite">
        <MapPin size={15} className={styles.mapCountIcon} />
        <span>{mapCountLabel}</span>
      </div>

      <MapViewportControls
        className={styles.viewportControls}
        buttonClassName={styles.viewportControlBtn}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFitNodes}
        fitLabel="Hiện toàn bộ node"
      />

      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner}></div>
          <div className={styles.loadingText}>Đang tải bản đồ hạ tầng</div>
        </div>
      )}

      {!isLoading && loadError && (
        <div className={styles.errorOverlay} role="alert">
          <div className={styles.errorCard}>
            <strong>Không tải được bản đồ node</strong>
            <span>{loadError}</span>
            <button type="button" className="ui-action-btn ui-action-btn--primary" onClick={() => void fetchNodes()}>
              Thử lại
            </button>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(importReport)}
        title={importReport?.title ?? "Kết quả import"}
        description="Kiểm tra tổng số dòng, dữ liệu cập nhật và các lỗi cần xử lý."
        onClose={() => setImportReport(null)}
      >
        <pre className={styles.importReport}>{importReport?.message}</pre>
        <div className={styles.importReportActions}>
          <button type="button" className="ui-action-btn ui-action-btn--primary" onClick={() => setImportReport(null)}>
            Đã hiểu
          </button>
        </div>
      </Dialog>

      <MapContainer
        center={mapCenter}
        zoom={12}
        zoomControl={false}
        className={`${styles.mapCanvas} ${currentZoom < 15 ? styles.hideLabels : ""}`}
        style={{
          height: "100%",
          width: "100%",
          zIndex: 1,
          backgroundColor: tileConfig.backgroundColor,
        }}
      >
        <ZoomTracker onChange={setCurrentZoom} />
        <MapRefBridge
          onReady={(mapInstance) => {
            mapRef.current = mapInstance;
          }}
        />
        <MapSizeBridge />
        <TileLayer
          key={mapStyle}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          className={tileConfig.needsDarkFilter ? styles.darkMapTile : ""}
        />
        {flyTarget && <FlyToPosition position={flyTarget} zoom={flyZoom} />}
        {userLocation && (
          <Marker position={userLocation} icon={CurrentLocationIcon}>
            <Popup className={styles.leafletPopup}>
              <div className={styles.popupContent}>
                <div className={styles.popupHeader}>
                  <div>
                    <div className={styles.popupEyebrow}>Vị trí hiện tại</div>
                    <h3 className={styles.popupName}>Bạn đang ở đây</h3>
                  </div>
                  <span className={`${styles.popupStatusBadge} ${styles.popupToneDefault}`}>GPS</span>
                </div>
                <div className={styles.popupBody}>
                  <div className={styles.popupMetaStack}>
                    <div className={styles.popupRow}>
                      <span className={styles.popupRowLabel}>Tọa độ</span>
                      <span className={styles.popupRowValue}>
                        {userLocation[0].toFixed(6)}, {userLocation[1].toFixed(6)}
                      </span>
                    </div>
                    <div className={styles.popupRow}>
                      <span className={styles.popupRowLabel}>Node gần nhất</span>
                      <span className={styles.popupRowValue}>{nearestNode?.name || "Đang xác định..."}</span>
                    </div>
                    <div className={styles.popupRow}>
                      <span className={styles.popupRowLabel}>Khoảng cách</span>
                      <span className={styles.popupRowValue}>
                        {nearestDistance ? `${nearestDistance} km` : "Đang tính..."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        {searchedCoordinate && (
          <Marker 
            position={[searchedCoordinate.lat, searchedCoordinate.lng]} 
            icon={CurrentLocationIcon}
            ref={searchedCoordinateMarkerRef}
          >
            <Popup className={styles.leafletPopup} autoPanPaddingTopLeft={[10, 160]}>
              <div className={styles.popupContent}>
                <div className={styles.popupHeader}>
                  <div className={styles.popupTitleBlock}>
                    <h3 className={styles.popupName}>Tọa độ tìm kiếm</h3>
                    <span className={`${styles.popupStatusBadge} ${styles.popupTonePurple}`}>Mới</span>
                  </div>
                </div>
                <div className={styles.popupBody}>
                  <div className={styles.popupInfoList}>
                    <div className={styles.popupInfoItem}>
                      <span className={styles.popupInfoLabel}>Vĩ độ (Lat)</span>
                      <span className={`${styles.popupInfoValue} ${styles.popupInfoValueStrong}`}>
                        {searchedCoordinate.lat.toFixed(6)}
                      </span>
                    </div>
                    <div className={styles.popupInfoItem}>
                      <span className={styles.popupInfoLabel}>Kinh độ (Lng)</span>
                      <span className={`${styles.popupInfoValue} ${styles.popupInfoValueStrong}`}>
                        {searchedCoordinate.lng.toFixed(6)}
                      </span>
                    </div>
                    <div className={styles.popupInfoItem}>
                      <span className={styles.popupInfoLabel}>Thông tin</span>
                      <span className={styles.popupInfoValue}>
                        {searchedCoordinate.nearestNodeInfo}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.popupActions}>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${searchedCoordinate.lat},${searchedCoordinate.lng}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`ui-action-btn ui-action-btn--compact ui-action-btn--primary ${styles.popupPrimaryAction}`}
                  >
                    Chỉ đường
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        <VanillaMarkerCluster
          nodes={filteredNodes}
          userLocationRef={userLocationRef}
          markersRefObj={markersRef}
          onMarkersReady={handleMarkersReady}
        />
      </MapContainer>
    </div>
  );
}
