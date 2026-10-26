"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import { Download, Eye, FileSpreadsheet, Layers, Loader2, MapPin, Navigation, Network, Search, Upload, X } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import styles from "../node-map/node-map.module.css";
import MapSearchResults from "@/components/MapSearchResults";
import { encodeMapEventValue, escapeMapHtml as escapeHtml, isValidMapCoordinate } from "@/lib/map-ui";
import type { Node0TbApiResponse, Node0TbItem } from "@/types";
import { MapLegend, MapPanel, MapStyleMenu, MapToolbar, MapViewportControls } from "@/components/map";
import { MAP_STYLE_OPTIONS, getMapTileConfig, type MapStyleMode } from "@/lib/map-tiles";

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

function getNodeIcon(fillColor: string, strokeColor: string) {
  const key = `${fillColor}:${strokeColor}`;
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
        <circle cx="12" cy="11" r="6" fill="white" opacity="0.95"/>
        <path d="M8 14h8v-2.3a4 4 0 10-8 0V14zm2.2-2.6a1.8 1.8 0 113.6 0v.6h-3.6v-.6z" fill="${fillColor}"/>
      </svg>
    `,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -38],
  });

  nodeIconCache.set(key, icon);
  return icon;
}

function getCategoryConfig(category: string): { fill: string; stroke: string; dotClass: string; toneClass: string } {
  const norm = (category || "").toLowerCase();
  if (norm.includes(">24") || norm.includes("24t")) {
    return { fill: "#dc2626", stroke: "#991b1b", dotClass: styles.dotRed, toneClass: styles.popupToneRed };
  }
  if (norm.includes("12-24") || norm.includes("12t")) {
    return { fill: "#f97316", stroke: "#c2410c", dotClass: styles.dotOrange, toneClass: styles.popupToneOrange };
  }
  if (norm.includes("6-12") || norm.includes("6t")) {
    return { fill: "#9333ea", stroke: "#6b21a8", dotClass: styles.dotPurple, toneClass: styles.popupTonePurple };
  }
  return { fill: "#0ea5e9", stroke: "#0369a1", dotClass: styles.dotDefault, toneClass: styles.popupToneDefault };
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

function buildNode0TbPopupHtml(item: Node0TbItem, userLocation: [number, number] | null) {
  const cfg = getCategoryConfig(item.categoryKd || "");
  const totalPortText = escapeHtml(item.totalPort !== null ? String(item.totalPort) : "-");
  const dateKdText = escapeHtml(item.dateKdFormatted || "-");
  const categoryKdText = escapeHtml(item.categoryKd || "Chưa phân loại");
  const coordinateText =
    item.latitude !== null && item.longitude !== null
      ? `${Number(item.latitude).toFixed(6)}, ${Number(item.longitude).toFixed(6)}`
      : "Chưa có tọa độ";
  const distanceText =
    userLocation && item.latitude !== null && item.longitude !== null
      ? `${getDistanceFromLatLonInKm(userLocation[0], userLocation[1], item.latitude, item.longitude).toFixed(2)} km`
      : null;
  const mapLink = userLocation
    ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation[0]},${userLocation[1]}&destination=${item.latitude},${item.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;
  const encodedNodeCode = encodeMapEventValue(item.nodeCode);

  return `
    <div class="${styles.popupContent}">
      <div class="${styles.popupHeader}">
        <div class="${styles.popupTitleBlock}">
          <h3 class="${styles.popupName}">${escapeHtml(item.nodeCode)}</h3>
          <span class="${styles.popupStatusBadge} ${cfg.toneClass}">${categoryKdText}</span>
        </div>
      </div>
      <div class="${styles.popupBody}">
        <div class="${styles.popupInfoList}">
          <div class="${styles.popupInfoItem}">
            <span class="${styles.popupInfoLabel}">Ngày kinh doanh</span>
            <span class="${styles.popupInfoValue} ${styles.popupInfoValueStrong}">${dateKdText}</span>
          </div>
          <div class="${styles.popupInfoItem}">
            <span class="${styles.popupInfoLabel}">Tổng Port</span>
            <span class="${styles.popupInfoValue} ${styles.popupInfoValueStrong}">${totalPortText}</span>
          </div>
          <div class="${styles.popupInfoItem}">
            <span class="${styles.popupInfoLabel}">Phân loại KD</span>
            <span class="${styles.popupInfoValue} ${styles.popupInfoValueStrong}">${categoryKdText}</span>
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
          onclick="window.dispatchEvent(new CustomEvent('copyNode0TbCode',{detail:decodeURIComponent('${encodedNodeCode}')}))"
          class="ui-action-btn ui-action-btn--compact ui-action-btn--pill ${styles.popupSecondaryAction}"
        >
          Sao chép mã
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

function MapRefBridge({ mapInstanceRef }: { mapInstanceRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();

  useEffect(() => {
    mapInstanceRef.current = map;
    return () => {
      if (mapInstanceRef.current === map) mapInstanceRef.current = null;
    };
  }, [map, mapInstanceRef]);

  return null;
}

function VanillaMarkerCluster({
  nodes,
  userLocationRef,
  markersRefObj,
}: {
  nodes: Node0TbItem[];
  userLocationRef: React.MutableRefObject<[number, number] | null>;
  markersRefObj: React.MutableRefObject<Record<string, { marker: L.Marker; cg: any }>>;
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
          const category = (marker as any).nodeCategory || "";
          const norm = category.toLowerCase();
          if (norm.includes(">24") || norm.includes("24t")) hasRed = true;
          else if (norm.includes("12-24") || norm.includes("12t")) hasOrange = true;
          else if (norm.includes("6-12") || norm.includes("6t")) hasPurple = true;

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

        let clusterColorClass = "";
        if (hasRed) clusterColorClass = styles.clusterRed;
        else if (hasOrange) clusterColorClass = styles.clusterOrange;
        else if (hasPurple) clusterColorClass = styles.clusterPurple;

        return L.divIcon({
          html: `<div class="${styles.customClusterLabel} ${clusterColorClass}">${escapeHtml(mainPrefix || "Node 0TB")} <span style="opacity:0.7;font-size:0.75rem">(${childCount})</span></div>`,
          className: styles.customClusterIcon,
          iconSize: undefined,
        });
      },
    });

    clusterRef.current = cg;
    markersRefObj.current = {};

    const validNodes = nodes.filter((n) => n.latitude !== null && n.longitude !== null);

    const leafletMarkers = validNodes.map((item) => {
      const cfg = getCategoryConfig(item.categoryKd || "");
      const marker = L.marker([item.latitude!, item.longitude!], {
        icon: getNodeIcon(cfg.fill, cfg.stroke),
        title: item.nodeCode,
      });

      (marker as any).nodeCategory = item.categoryKd;

      marker.bindTooltip(item.nodeCode, {
        permanent: true,
        direction: "right",
        className: styles.nodeLabel,
        offset: [10, 0],
      });

      marker.bindPopup(() => buildNode0TbPopupHtml(item, userLocationRef.current), {
        autoPanPaddingTopLeft: [10, 160],
        className: styles.leafletPopup,
        maxWidth: 340,
      });

      markersRefObj.current[item.nodeCode] = { marker, cg };
      return marker;
    });

    cg.addLayers(leafletMarkers);
    map.addLayer(cg);

    return () => {
      map.removeLayer(cg);
    };
  }, [nodes, ready, map, userLocationRef, markersRefObj]);

  return null;
}

export default function Node0TbMap() {
  const { data: session } = useSession();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [data, setData] = useState<Node0TbApiResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [mapStyle, setMapStyle] = useState<MapStyleMode>("light");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [flyZoom, setFlyZoom] = useState(15);

  const userLocationRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  // Menus and panels
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showListPanel, setShowListPanel] = useState(false);
  const [listPanelSearch, setListPanelSearch] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const styleMenuRef = useRef<HTMLDivElement>(null);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const listPanelRef = useRef<HTMLDivElement>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const markersRefObj = useRef<Record<string, { marker: L.Marker; cg: any }>>({});
  const mapRef = useRef<L.Map | null>(null);

  const fetchNodes = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/node-0tb");
      if (!response.ok) throw new Error("Máy chủ không trả về dữ liệu Node 0TB hợp lệ.");

      const json: Node0TbApiResponse = await response.json();
      if (!Array.isArray(json.nodes) || !json.stats) {
        throw new Error("Dữ liệu Node 0TB không đúng định dạng.");
      }
      setData(json);
    } catch (error) {
      console.error("Fetch Node0Tb error:", error);
      setLoadError(error instanceof Error ? error.message : "Không thể tải dữ liệu Node 0TB.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchNodes();
  }, []);

  // Filtered nodes
  const allNodes = useMemo(() => data?.nodes || [], [data]);

  const filteredNodes = useMemo(() => {
    let list = allNodes;
    if (selectedCategory !== "ALL") {
      list = list.filter((n) => (n.categoryKd || "").toLowerCase() === selectedCategory.toLowerCase());
    }
    return list;
  }, [allNodes, selectedCategory]);

  const requestUserLocation = () => {
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
    const handleCopyNodeCode = async (event: Event) => {
      const nodeCode = (event as CustomEvent<string>).detail;
      try {
        await navigator.clipboard.writeText(nodeCode);
        toast.success(`Đã sao chép: ${nodeCode}`);
      } catch {
        toast.error("Không thể sao chép mã node.");
      }
    };

    window.addEventListener("copyNode0TbCode", handleCopyNodeCode as EventListener);
    return () => window.removeEventListener("copyNode0TbCode", handleCopyNodeCode as EventListener);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    if (!showStyleMenu && !showAdminMenu && !showListPanel) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (styleMenuRef.current && !styleMenuRef.current.contains(target)) {
        setShowStyleMenu(false);
      }
      if (adminMenuRef.current && !adminMenuRef.current.contains(target)) {
        setShowAdminMenu(false);
      }
      if (listPanelRef.current && !listPanelRef.current.contains(target)) {
        setShowListPanel(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowStyleMenu(false);
      setShowAdminMenu(false);
      setShowListPanel(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showAdminMenu, showListPanel, showStyleMenu]);

  // Click on Node from search / list
  const handleNodeClick = useCallback(
    (item: Node0TbItem) => {
      if (item.latitude === null || item.longitude === null) {
        toast.error(`Node ${item.nodeCode} chưa có tọa độ trên hệ thống.`);
        return;
      }

      const needsFilterReset =
        selectedCategory !== "ALL" &&
        (item.categoryKd || "").toLowerCase() !== selectedCategory.toLowerCase();
      if (needsFilterReset) setSelectedCategory("ALL");

      const target: [number, number] = [item.latitude, item.longitude];
      setSearchQuery("");
      setShowListPanel(false);
      setFlyTarget(null);
      setTimeout(() => {
        setFlyTarget(target);
        setFlyZoom(17);
        mapRef.current?.flyTo(target, 17, { duration: 0.9 });
      }, 50);

      let attempts = 0;
      const openMarker = () => {
        const refObj = markersRefObj.current[item.nodeCode];
        if (refObj) {
          refObj.cg.zoomToShowLayer(refObj.marker, () => {
            refObj.marker.openPopup();
          });
          return;
        }

        attempts += 1;
        if (attempts < 8) window.setTimeout(openMarker, 150);
      };
      window.setTimeout(openMarker, needsFilterReset ? 180 : 80);
    },
    [selectedCategory],
  );

  // Search items logic matching node-map
  const searchItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    const coordinateMatch = searchQuery.trim().match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);

    const results: any[] = [];
    if (coordinateMatch) {
      const lat = parseFloat(coordinateMatch[1]);
      const lng = parseFloat(coordinateMatch[2]);
      if (isValidMapCoordinate(lat, lng)) {
        results.push({
          id: "virtual-coordinate",
          name: `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          nodeCode: `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          latitude: lat,
          longitude: lng,
          isCoordinateObject: true,
        });
      }
    }

    const matchedNodes = allNodes
      .filter((n) => n.nodeCode.toLowerCase().includes(q) || (n.categoryKd && n.categoryKd.toLowerCase().includes(q)))
      .map((n) => ({
        ...n,
        name: n.nodeCode,
        distanceKm:
          userLocation && n.latitude !== null && n.longitude !== null
            ? getDistanceFromLatLonInKm(userLocation[0], userLocation[1], n.latitude, n.longitude)
            : undefined,
      }));

    return [...results, ...matchedNodes];
  }, [allNodes, searchQuery, userLocation]);

  const searching = false;

  const handleSearchItemSelect = (item: any) => {
    if (item.isCoordinateObject) {
      const target: [number, number] = [Number(item.latitude), Number(item.longitude)];
      setSearchQuery("");
      setSelectedCategory("ALL");
      setFlyTarget(null);
      window.setTimeout(() => {
        setFlyTarget(target);
        setFlyZoom(17);
        mapRef.current?.flyTo(target, 17, { duration: 0.9 });
      }, 10);
      return;
    }

    const match = allNodes.find((node) => node.nodeCode === item.name);
    if (match) handleNodeClick(match);
  };

  const handleGoToMyLocation = () => {
    if (!userLocation) {
      requestUserLocation();
      return;
    }
    setFlyTarget(null);
    setTimeout(() => {
      setFlyTarget(userLocation);
      setFlyZoom(16);
      mapRef.current?.flyTo(userLocation, 16, { duration: 0.9 });
    }, 50);
  };

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const handleFitNodes = () => {
    if (!mapRef.current) return;

    const coordinates = filteredNodes
      .filter((node) => node.latitude !== null && node.longitude !== null)
      .map((node) => [node.latitude as number, node.longitude as number] as [number, number]);
    if (coordinates.length === 0) {
      toast.error("Không có node có tọa độ trong bộ lọc hiện tại.");
      return;
    }

    mapRef.current.fitBounds(L.latLngBounds(coordinates), { padding: [48, 48], maxZoom: 16 });
  };

  // Upload Excel file
  const handleUploadExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setShowAdminMenu(false);
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/node-0tb/upload", { method: "POST", body: formData });
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Tải lên file thành công!");
        await fetchNodes();
      } else {
        toast.error(`Lỗi: ${data.error || "Không xác định"}`);
      }
    } catch (error) {
      toast.error(`Lỗi upload file: ${error instanceof Error ? error.message : "Không xác định"}`);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  // List panel search items
  const panelListItems = useMemo(() => {
    if (!listPanelSearch.trim()) return filteredNodes;
    const q = listPanelSearch.trim().toLowerCase();
    return filteredNodes.filter(
      (n) => n.nodeCode.toLowerCase().includes(q) || (n.categoryKd && n.categoryKd.toLowerCase().includes(q))
    );
  }, [filteredNodes, listPanelSearch]);

  const defaultCenter: [number, number] = [11.537969, 107.955546];
  const mapCenter =
    userLocation ||
    (allNodes.length > 0 && allNodes[0].latitude !== null && allNodes[0].longitude !== null
      ? ([allNodes[0].latitude, allNodes[0].longitude] as [number, number])
      : defaultCenter);
  const tileConfig = getMapTileConfig(mapStyle);

  return (
    <div className={styles.mapOuter}>
      <MapToolbar className={styles.searchOverlay} label="Công cụ bản đồ Node 0TB">
        <div className={`${styles.toolbarPanel} ${styles.searchToolbar}`}>
          <div className={styles.toolbarMainRow}>
            <div className={styles.searchFieldShell}>
              <div className={styles.searchBar}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Tìm node theo tên hoặc tọa độ..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchItems.length > 0) {
                      handleSearchItemSelect(searchItems[0]);
                    }
                  }}
                  className={styles.searchInput}
                  role="combobox"
                  aria-label="Tìm Node 0TB trên bản đồ"
                  aria-expanded={Boolean(searchQuery.trim())}
                  aria-autocomplete="list"
                  aria-controls="node-0tb-search-results"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.clearBtn}
                    onClick={() => setSearchQuery("")}
                    aria-label="Xóa tìm kiếm"
                    title="Xóa"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {searchQuery.trim() && (
                <MapSearchResults
                  id="node-0tb-search-results"
                  className={styles.searchResults}
                  items={searchItems}
                  loading={searching}
                  visibleCount={10}
                  resultNoun="node"
                  emptyText="Không tìm thấy node phù hợp."
                  onSelect={handleSearchItemSelect}
                  getPrimaryText={(node) => node.name}
                  getSecondaryText={(node) =>
                    `${node.latitude !== null && node.latitude !== undefined ? Number(node.latitude).toFixed(5) : "-"}, ${
                      node.longitude !== null && node.longitude !== undefined ? Number(node.longitude).toFixed(5) : "-"
                    }${node.distanceKm !== undefined ? ` • ${Number(node.distanceKm).toFixed(2)} km` : ""}`
                  }
                  renderActions={(node) => (
                    <button
                      type="button"
                      className={`ui-icon-btn ${styles.actionBtnIcon}`}
                      title="Xem trên bản đồ"
                      aria-label="Xem trên bản đồ"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSearchItemSelect(node);
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
                <button
                  type="button"
                  className={`ui-action-btn ui-action-btn--icon ${styles.mapActionBtn} ${styles.primaryActionBtn}`}
                  onClick={handleGoToMyLocation}
                  disabled={isLocating}
                  title={userLocation ? "Vị trí của tôi" : locationError || "Dùng vị trí của tôi"}
                  aria-label="Vị trí của tôi"
                >
                  {isLocating ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
                </button>

                {session?.user?.role === "ADMIN" && (
                  <div className={styles.styleMenuAnchor} ref={adminMenuRef}>
                    <button
                      type="button"
                      className={`ui-action-btn ui-action-btn--icon ${styles.mapActionBtn} ${styles.primaryActionBtn}`}
                      onClick={() => {
                        setShowAdminMenu((current) => !current);
                        setShowStyleMenu(false);
                      }}
                      title="Quản trị dữ liệu & Tải mẫu"
                      aria-label="Quản trị dữ liệu Node 0TB"
                      aria-expanded={showAdminMenu}
                      aria-controls="node-0tb-admin-menu"
                      aria-haspopup="menu"
                    >
                      <Upload size={18} className={isUploading ? "animate-spin" : ""} />
                    </button>

                    {showAdminMenu && (
                      <div id="node-0tb-admin-menu" role="menu" className={`ui-action-menu ${styles.mapStyleDropdown}`}>
                        <label role="menuitem" className={`ui-action-menu-item ${styles.adminMenuOption}`} title="Tải file Excel để cập nhật Node 0TB">
                          <FileSpreadsheet size={15} className={styles.adminMenuIcon} />
                          <span>Upload Excel (.xlsx, .xlsm)</span>
                          <input
                            ref={uploadFileInputRef}
                            type="file"
                            accept=".xlsx,.xlsm,.xls"
                            hidden
                            onChange={handleUploadExcel}
                            disabled={isUploading}
                          />
                        </label>

                        <a
                          href="/api/node-0tb/template"
                          download="Mau_Node_0TB.xlsx"
                          className={`ui-action-menu-item ${styles.adminMenuOption}`}
                          title="Tải file Excel mẫu chuẩn 4 cột"
                          onClick={() => setShowAdminMenu(false)}
                          role="menuitem"
                        >
                          <Download size={15} className={styles.adminMenuIcon} />
                          <span>Tải file mẫu Excel</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className={`ui-action-btn ui-action-btn--icon ${styles.mapActionBtn} ${styles.primaryActionBtn}`}
                  onClick={() => {
                    setShowListPanel((v) => !v);
                    setShowAdminMenu(false);
                    setShowStyleMenu(false);
                  }}
                  title="Xem danh sách Node 0TB"
                  aria-label="Xem danh sách Node 0TB"
                  aria-expanded={showListPanel}
                  aria-controls="node-0tb-list-panel"
                  aria-haspopup="dialog"
                >
                  <Eye size={18} />
                </button>
              </div>

              <div className={styles.secondaryActionsRow}>
                <div className={styles.styleMenuAnchor} ref={styleMenuRef}>
                  <button
                    type="button"
                    className={`ui-action-btn ui-action-btn--pill ${styles.mapActionBtn} ${styles.secondaryActionBtn}`}
                    onClick={() => setShowStyleMenu((current) => !current)}
                    title="Đổi kiểu bản đồ"
                    aria-label="Đổi kiểu bản đồ"
                    aria-expanded={showStyleMenu}
                    aria-controls="node-0tb-style-menu"
                    aria-haspopup="menu"
                  >
                    <Layers size={14} />
                    <span className={styles.actionLabel}>
                      {MAP_STYLE_OPTIONS.find((item) => item.key === mapStyle)?.label || "Bản đồ"}
                    </span>
                  </button>

                  <MapStyleMenu
                    open={showStyleMenu}
                    id="node-0tb-style-menu"
                    label="Chọn kiểu bản đồ"
                    value={mapStyle}
                    onSelect={(style) => {
                      setMapStyle(style);
                      setShowStyleMenu(false);
                    }}
                    className={styles.mapStyleDropdown}
                    optionClassName={styles.mapStyleOption}
                    activeOptionClassName={styles.active}
                  />
                </div>

                <Link
                  href="/node-map"
                  className={`ui-action-btn ui-action-btn--pill ${styles.mapActionBtn} ${styles.secondaryActionBtn}`}
                  title="Chuyển sang Bản đồ Hạ tầng Node"
                >
                  <Network size={14} />
                  <span className={styles.actionLabel}>Bản đồ Node</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        <div className={`${styles.toolbarPanel} ${styles.filterPanel}`}>
          <MapLegend className={styles.filterControls} label="Chú giải phân loại Node 0TB">
            <button
              type="button"
              className={`ui-action-btn ui-action-btn--pill ${styles.filterBtn} ${selectedCategory === "ALL" ? styles.active : ""}`}
              onClick={() => setSelectedCategory("ALL")}
              aria-pressed={selectedCategory === "ALL"}
            >
              <span className={styles.filterLabelGroup}>Tất cả</span>
              <span className={styles.filterCount}>{data?.stats?.total || 0}</span>
            </button>

            {data?.stats?.categories?.map((cat) => {
              const cfg = getCategoryConfig(cat.category);
              const isActive = selectedCategory === cat.category;
              return (
                <button
                  key={cat.category}
                  type="button"
                  className={`ui-action-btn ui-action-btn--pill ${styles.filterBtn} ${isActive ? styles.active : ""}`}
                  onClick={() => setSelectedCategory(cat.category)}
                  aria-pressed={isActive}
                >
                  <span className={styles.filterLabelGroup}>
                    <span className={`${styles.filterDot} ${cfg.dotClass}`} aria-hidden="true" />
                    {cat.category}
                  </span>
                  <span className={styles.filterCount}>{cat.count}</span>
                </button>
              );
            })}
          </MapLegend>
        </div>

        {/* Side Panel: Danh sách Node 0TB */}
        {showListPanel && (
          <MapPanel
            id="node-0tb-list-panel"
            className={`${styles.toolbarPanel} ${styles.customerNodePanel}`}
            ref={listPanelRef}
            labelledBy="node-0tb-list-title"
          >
            <div className={styles.customerNodePanelHeader}>
              <div>
                <div id="node-0tb-list-title" className={styles.customerNodePanelTitle}>Danh sách Node 0TB</div>
                <div className={styles.customerNodePanelMeta}>
                  Tổng {panelListItems.length} node {selectedCategory !== "ALL" ? `(${selectedCategory})` : ""}
                </div>
              </div>

              <div className={styles.customerNodePanelActions}>
                <button
                  type="button"
                  className={`ui-icon-btn ${styles.customerNodePanelIconBtn}`}
                  onClick={() => setShowListPanel(false)}
                  title="Đóng"
                  aria-label="Đóng danh sách Node 0TB"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={styles.customerNodeSearchBar}>
              <Search size={15} className={styles.customerNodeSearchIcon} />
              <input
                type="text"
                placeholder="Lọc mã node..."
                value={listPanelSearch}
                onChange={(e) => setListPanelSearch(e.target.value)}
                className={styles.customerNodeSearchInput}
                aria-label="Lọc danh sách theo mã node hoặc phân loại"
                autoFocus
              />
            </div>

            <div className={styles.customerNodeList}>
              {panelListItems.length === 0 ? (
                <div className={styles.customerNodeEmpty}>Không có node 0TB nào phù hợp.</div>
              ) : (
                panelListItems.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className={`${styles.customerNodeRow} ${styles.customerNodeRowInteractive}`}
                    onClick={() => handleNodeClick(node)}
                  >
                    <div className={styles.customerNodeContent}>
                      <div className={styles.customerNodeAccount}>{node.nodeCode}</div>
                      <div className={styles.customerNodeName}>
                        Ngày KD: {node.dateKdFormatted || "-"} • {node.totalPort !== null ? `${node.totalPort} port` : "-"}
                      </div>
                      <div className={styles.customerNodeAddress}>
                        Phân loại: {node.categoryKd || "-"}
                      </div>
                      <div className={styles.customerNodeUpdated}>
                        {node.hasCoordinates ? "✓ Đã có tọa độ" : "⚠ Chưa có tọa độ"}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </MapPanel>
        )}
      </MapToolbar>

      {/* Map Canvas */}
      <MapContainer
        center={mapCenter}
        zoom={12}
        className={styles.mapCanvas}
        zoomControl={false}
      >
        <MapRefBridge mapInstanceRef={mapRef} />
        <MapSizeBridge />
        <FlyToPosition position={flyTarget} zoom={flyZoom} />

        <TileLayer
          key={mapStyle}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          className={tileConfig.needsDarkFilter ? styles.darkMapTile : ""}
        />

        {userLocation && (
          <Marker position={userLocation} icon={CurrentLocationIcon}>
            <Popup>
              <strong>Vị trí của bạn</strong>
            </Popup>
          </Marker>
        )}

        <VanillaMarkerCluster
          nodes={filteredNodes}
          userLocationRef={userLocationRef}
          markersRefObj={markersRefObj}
        />
      </MapContainer>

      {/* Map bottom count pill */}
      <div className={styles.mapCountPill} aria-live="polite">
        <MapPin size={14} className={styles.mapCountIcon} />
        <span>Hiển thị {filteredNodes.filter((n) => n.hasCoordinates).length} node trên bản đồ</span>
      </div>

      <MapViewportControls
        className={styles.viewportControls}
        buttonClassName={styles.viewportControlBtn}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFitNodes}
        fitLabel="Hiện toàn bộ Node 0TB"
      />

      {isLoading && (
        <div className={styles.loadingOverlay} role="status">
          <div className={styles.spinner} aria-hidden="true"></div>
          <div className={styles.loadingText}>Đang tải bản đồ Node 0TB</div>
        </div>
      )}

      {!isLoading && loadError && (
        <div className={styles.errorOverlay} role="alert">
          <div className={styles.errorCard}>
            <strong>Không tải được bản đồ Node 0TB</strong>
            <span>{loadError}</span>
            <button type="button" className="ui-action-btn ui-action-btn--primary" onClick={() => void fetchNodes()}>
              Thử lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
