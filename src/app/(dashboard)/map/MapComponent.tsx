"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import { Search, Navigation, X, MapPin, Plus, Loader2 } from "lucide-react";
import styles from "./map.module.css";
import CustomerModal from "@/components/CustomerModalRefined";
import MapSearchResults from "@/components/MapSearchResults";
import { format } from "date-fns";
import { useMapSearch } from "@/hooks/useMapSearch";
import { toast } from "react-hot-toast";
import { escapeMapHtml } from "@/lib/map-ui";
import type { NodeCoordinateItem } from "@/types";
import { getMapTileConfig } from "@/lib/map-tiles";
import { MapLegend, MapPanel, MapStyleMenu, MapToolbar, MapViewportControls } from "@/components/map";

// Fix for default marker icon in react-leaflet
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

// Blue pulsing icon for current location
const CurrentLocationIcon = L.divIcon({
    className: styles.currentLocationMarker,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
});

// Component to fly map to a position
function FlyToPosition({ position, zoom, onComplete }: { position: [number, number] | null; zoom?: number; onComplete?: (position: [number, number]) => void }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            const handleMoveEnd = () => onComplete?.(position);
            map.stop();
            map.once("moveend", handleMoveEnd);
            map.flyTo(position, zoom || 15, { duration: 1.2 });
            return () => { map.off("moveend", handleMoveEnd); };
        }
    }, [position, zoom, map, onComplete]);
    return null;
}

function MapRefBridge({ mapInstanceRef }: { mapInstanceRef: React.MutableRefObject<L.Map | null> }) {
    const map = useMap();

    useEffect(() => {
        mapInstanceRef.current = map;
        return () => {
            mapInstanceRef.current = null;
        };
    }, [map, mapInstanceRef]);

    return null;
}

// Map Click Handler for picking location
function MapClickHandler({ isActive, onLocationSelected }: { isActive: boolean, onLocationSelected: (latlng: L.LatLng) => void }) {
    useMapEvents({
        click(e) {
            if (isActive) {
                onLocationSelected(e.latlng);
            }
        }
    });
    return null;
}

// Color markers - SVG location pin icons with inner labels
const createPinIcon = (fillColor: string, strokeColor: string, type: string) => {
    let innerSvg = `<circle cx="12" cy="11" r="6" fill="white" opacity="0.9"/>`;
    if (type === "FIXED") {
        innerSvg += `<path d="M12 6l-5 4v5h3v-3h4v3h3v-5z" fill="${fillColor}"/>`;
    } else if (type === "MOBILE") {
        innerSvg += `<path d="M10 6h4a1 1 0 011 1v8a1 1 0 01-1 1h-4a1 1 0 01-1-1v-8a1 1 0 011-1zm2 8.5a.5.5 0 100-1 .5.5 0 000 1z" fill="${fillColor}"/>`;
    } else {
        innerSvg += `<circle cx="12" cy="11" r="4.5" fill="white" opacity="0.9"/>`;
    }

    return L.divIcon({
        className: styles.markerPin,
        html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="40">
            <defs>
                <filter id="shadow-${fillColor.replace('#', '')}" x="-20%" y="-10%" width="140%" height="130%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.4)"/>
                </filter>
            </defs>
            <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" 
                  fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"
                  filter="url(#shadow-${fillColor.replace('#', '')})"/>
            ${innerSvg}
        </svg>`,
        iconSize: [28, 40],
        iconAnchor: [14, 40],
        popupAnchor: [0, -40]
    });
};

const getMarkerColor = (c: any) => {
    if (c.status === "Rời mạng") return "PURPLE";

    // Mobile -> Green
    if (c.subscriberType === "MOBILE") return "GREEN";

    // Fixed + Monthly -> Yellow
    if (c.subscriberType === "FIXED" && c.billingType === "MONTHLY") return "YELLOW";

    // Fixed + Prepaid
    if (c.subscriberType === "FIXED" && c.billingType === "PREPAID") {
        if (!c.expirationDate) return "SKYBLUE";

        const expDate = new Date(c.expirationDate);
        const now = new Date();
        // Check if expiration is this month or in the past
        if (expDate.getFullYear() < now.getFullYear() ||
            (expDate.getFullYear() === now.getFullYear() && expDate.getMonth() <= now.getMonth())) {
            return "RED";
        }
        return "SKYBLUE";
    }

    return "DEFAULT";
};

const markerIconCache = new Map<string, L.DivIcon>();

const getMarkerIcon = (c: any) => {
    const colorType = getMarkerColor(c);
    const subType = c.subscriberType || "FIXED";
    const key = `${colorType}:${subType}`;
    const cached = markerIconCache.get(key);
    if (cached) return cached;

    let fillColor = '#2563eb';
    let strokeColor = '#1d4ed8';
    if (colorType === "RED") { fillColor = '#dc2626'; strokeColor = '#991b1b'; }
    else if (colorType === "GREEN") { fillColor = '#15803d'; strokeColor = '#0f5c2c'; }
    else if (colorType === "YELLOW") { fillColor = '#d4a017'; strokeColor = '#a67c00'; }
    else if (colorType === "SKYBLUE") { fillColor = '#0284c7'; strokeColor = '#075985'; }
    else if (colorType === "PURPLE") { fillColor = '#9333ea'; strokeColor = '#6b21a8'; }

    const icon = createPinIcon(fillColor, strokeColor, subType);
    markerIconCache.set(key, icon);
    return icon;
};

// Custom Cluster Component using vanilla leaflet.markercluster
function VanillaMarkerCluster({ customers, markersRefObj, onEditCustomer, onUpdateLocation, onPickLocation, onAssignNode }: {
    customers: any[],
    markersRefObj: React.MutableRefObject<{ [key: string]: { marker: L.Marker; cg: any } }>,
    onEditCustomer: (c: any) => void,
    onUpdateLocation: (id: string, e: any) => void,
    onPickLocation: (c: any) => void,
    onAssignNode: (c: any) => void
}) {
    const map = useMap();
    const clusterRef = useRef<any>(null);
    const [ready, setReady] = useState(false);
    const customerById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);

    useEffect(() => {
        import("leaflet.markercluster").then(() => {
            setReady(true);
        });
    }, []);

    // Listen for custom events from popup buttons
    useEffect(() => {
        const handleEdit = (e: Event) => {
            const id = (e as CustomEvent).detail;
            const customer = customerById.get(id);
            if (customer) onEditCustomer(customer);
        };
        const handleUpdateLoc = (e: Event) => {
            const id = (e as CustomEvent).detail;
            onUpdateLocation(id, { stopPropagation: () => { } } as any);
        };
        const handlePickLoc = (e: Event) => {
            const id = (e as CustomEvent).detail;
            const customer = customerById.get(id);
            if (customer) {
                markersRefObj.current[customer.id]?.marker?.closePopup();
                onPickLocation(customer);
            }
        };
        const handleAssignNode = (e: Event) => {
            const id = (e as CustomEvent).detail;
            const customer = customerById.get(id);
            if (customer) onAssignNode(customer);
        };
        const handleCopyAcc = (e: Event) => {
            const acc = (e as CustomEvent).detail;
            if (acc && acc !== 'undefined' && acc !== 'null') {
                navigator.clipboard.writeText(acc)
                    .then(() => toast.success("Đã copy account: " + acc))
                    .catch(() => toast.error("Lỗi copy"));
            } else {
                toast.error("Không có account để copy");
            }
        };

        window.addEventListener('editCustomer', handleEdit);
        window.addEventListener('updateCustomerLoc', handleUpdateLoc);
        window.addEventListener('pickCustomerLoc', handlePickLoc);
        window.addEventListener('assignNode', handleAssignNode);
        window.addEventListener('copyAcc', handleCopyAcc);
        return () => {
            window.removeEventListener('editCustomer', handleEdit);
            window.removeEventListener('updateCustomerLoc', handleUpdateLoc);
            window.removeEventListener('pickCustomerLoc', handlePickLoc);
            window.removeEventListener('assignNode', handleAssignNode);
            window.removeEventListener('copyAcc', handleCopyAcc);
        };
    }, [customerById, onEditCustomer, onUpdateLocation, onPickLocation, onAssignNode, markersRefObj]);

    useEffect(() => {
        if (!ready) return;

        const markerRegistry = markersRefObj.current;

        if (clusterRef.current) {
            map.removeLayer(clusterRef.current);
        }

        const cg = (L as any).markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 60,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            iconCreateFunction: (cluster: any) => {
                const childCount = cluster.getChildCount();
                const childMarkers = cluster.getAllChildMarkers();

                // Surface the highest-priority state so urgent markers are not hidden by the majority.
                const colorCounts: any = { RED: 0, YELLOW: 0, GREEN: 0, SKYBLUE: 0, PURPLE: 0, DEFAULT: 0 };
                childMarkers.forEach((m: any) => {
                    if (m.options.clusterColor) colorCounts[m.options.clusterColor]++;
                });

                const predominantColor = ["RED", "PURPLE", "YELLOW", "SKYBLUE", "GREEN"]
                    .find((color) => colorCounts[color] > 0) || "DEFAULT";

                let clusterClass = styles.customClusterLabel;
                if (predominantColor === "RED") clusterClass += ` ${styles.clusterRed}`;
                if (predominantColor === "YELLOW") clusterClass += ` ${styles.clusterYellow}`;
                if (predominantColor === "GREEN") clusterClass += ` ${styles.clusterGreen}`;
                if (predominantColor === "PURPLE") clusterClass += ` ${styles.clusterPurple}`;
                if (predominantColor === "SKYBLUE") clusterClass += ` ${styles.clusterSky}`;

                return L.divIcon({
                    html: `<div class="${clusterClass}">${childCount}</div>`,
                    className: styles.customClusterIcon,
                    iconSize: undefined
                });
            }
        });

        clusterRef.current = cg;

        const leafletMarkers = customers.map((c: any) => {
            const markerColor = getMarkerColor(c);
            const marker = L.marker([c.latitude, c.longitude], {
                icon: getMarkerIcon(c),
                title: c.name,
                customerId: c.id,
                clusterColor: markerColor // Custom property for cluster color logic
            } as any);

            const subscriberText = c.subscriberType === "FIXED" ? "Cố định" : "Di động";
            const billingText = c.billingType === "PREPAID" ? "Đóng trước" : "Hàng tháng";

            let expirationText = "N/A";
            if (c.expirationDate) {
                try {
                    expirationText = format(new Date(c.expirationDate), "dd/MM/yyyy");
                } catch { }
            }
            const expirationDisplay = expirationText === "N/A" ? "Chưa cập nhật" : expirationText;
            const popupSubline = [subscriberText, billingText, expirationText === "N/A" ? "" : expirationText]
                .filter(Boolean)
                .join(" • ");

            const encodedFocusNode = c.nodeName ? encodeURIComponent(c.nodeName) : "";
            const encodedCustomerId = encodeURIComponent(String(c.id)).replace(/'/g, "%27");
            const encodedAccount = encodeURIComponent(String(c.account || "")).replace(/'/g, "%27");
            const encodedCustomerName = encodeURIComponent(String(c.name || "Khách hàng")).replace(/'/g, "%27");
            const phoneHref = String(c.phone || "").replace(/[^0-9+]/g, "");
            const safeName = escapeMapHtml(c.name || "Khách hàng");
            const safePhone = escapeMapHtml(c.phone || "Chưa có số");
            const safeAccount = escapeMapHtml(c.account || "Chưa cập nhật");
            const safeNodeName = escapeMapHtml(c.nodeName || "Chưa cập nhật");
            const safeExpirationDisplay = escapeMapHtml(expirationDisplay);
            const safePackage = escapeMapHtml(c.package || "Chưa có gói");
            const safeCtvCode = escapeMapHtml(c.ctvCode || "");
            const safeAddress = escapeMapHtml(c.address || "Chưa cập nhật địa chỉ");
            const safePopupSubline = escapeMapHtml(popupSubline || "Khách hàng trên bản đồ");
            const popupHtml = `
                <div class="${styles.popupContent}">
                    <div class="${styles.popupHeader}">
                        <div class="${styles.popupTitleGroup}">
                            <h3 class="${styles.popupName}">${safeName}</h3>
                            <div class="${styles.popupSubline}">${safePopupSubline}</div>
                        </div>
                        <div class="${styles.popupHeaderMeta}">
                            <a href="tel:${phoneHref}" class="${styles.popupPhoneLink}">${safePhone}</a>
                            ${phoneHref ? `<a href="https://zalo.me/${encodeURIComponent(phoneHref)}" target="_blank" rel="noopener noreferrer" class="${styles.popupZaloLink}">Zalo</a>` : ""}
                        </div>
                    </div>
                    <div class="${styles.popupBody}">
                        <div class="${styles.popupKeyValue}">
                            <span class="${styles.popupKeyLabel}">Account</span>
                            <span class="${styles.popupKeyData}">
                                <span class="${styles.popupValueText}">${safeAccount}</span>
                                ${c.account ? `<button onclick="window.dispatchEvent(new CustomEvent('copyAcc',{detail:decodeURIComponent('${encodedAccount}')}))" class="${styles.popupCopyBtn}">Copy</button>` : ""}
                            </span>
                        </div>
                        <div class="${styles.popupKeyValue} ${styles.popupNodeRow}">
                            <span class="${styles.popupKeyLabel}">Node</span>
                            <span class="${styles.popupKeyData}">
                                <span class="${styles.popupValueText}">${safeNodeName}</span>
                                ${c.nodeName ? `<a href="/node-map?focusNode=${encodedFocusNode}" class="ui-icon-btn ${styles.popupNodeBtn}" title="Xem node" aria-label="Xem node">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                </a>` : ""}
                            </span>
                        </div>
                        <div class="${styles.popupKeyValue}">
                            <span class="${styles.popupKeyLabel}">Hết hạn</span>
                            <span class="${styles.popupKeyData}">${safeExpirationDisplay}</span>
                        </div>
                        <div class="${styles.popupMetaLine}">
                            <span class="${styles.popupMetaChip}">${safePackage}</span>
                            ${c.ctvCode ? `<span class="${styles.popupMetaChip}">${safeCtvCode}</span>` : ""}
                        </div>
                        <div class="${styles.popupAddress}">
                            ${safeAddress}
                        </div>
                    </div>
                    <div class="${styles.popupActions}">
                        <button onclick="window.dispatchEvent(new CustomEvent('showDirections',{detail:{name:decodeURIComponent('${encodedCustomerName}'),lat:${Number(c.latitude)},lng:${Number(c.longitude)}}}))" class="ui-action-btn ui-action-btn--compact ui-action-btn--pill ui-action-btn--primary ${styles.actionBtn} ${styles.directionBtn}">Chỉ đường</button>
                        <button onclick="window.dispatchEvent(new CustomEvent('editCustomer',{detail:decodeURIComponent('${encodedCustomerId}')}))" class="ui-action-btn ui-action-btn--compact ui-action-btn--pill ${styles.actionBtn}">Sửa</button>
                        <button onclick="window.dispatchEvent(new CustomEvent('pickCustomerLoc',{detail:decodeURIComponent('${encodedCustomerId}')}))" class="ui-action-btn ui-action-btn--compact ui-action-btn--pill ${styles.actionBtn}">Chọn map</button>
                    </div>
                </div>
            `;
            marker.bindPopup(popupHtml, { maxWidth: 300, autoPanPaddingTopLeft: [10, 140], className: '' });

            markerRegistry[c.id] = { marker: marker as any, cg };
            return marker;
        });

        cg.on('popupopen', (e: any) => {
            const popup = e.popup;
            if (!popup) return;
            const customer = customerById.get(e.sourceTarget?.options?.customerId);
            if (customer) {
                window.dispatchEvent(new CustomEvent('customerSelected', { detail: customer }));
            }
        });
        cg.on('popupclose', () => {
            window.dispatchEvent(new CustomEvent('customerSelected', { detail: null }));
        });

        cg.addLayers(leafletMarkers);
        map.addLayer(cg);

        return () => {
            for (const customer of customers) {
                if (markerRegistry[customer.id]?.cg === cg) delete markerRegistry[customer.id];
            }
            map.removeLayer(cg);
        };
    }, [customers, customerById, ready, map, markersRefObj]);

    return null;
}

export default function MapComponent() {
    const [customers, setCustomers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
    const [flyZoom, setFlyZoom] = useState<number>(15);
    const [locationError, setLocationError] = useState("");
    const markersRef = useRef<{ [key: string]: { marker: L.Marker; cg: any } }>({});
    const pendingPopupRef = useRef<{ id: string; position: [number, number] } | null>(null);

    const [colorFilter, setColorFilter] = useState<string>("ALL");
    const [editingCustomer, setEditingCustomer] = useState<any>(null);
    const [updatingLocationId, setUpdatingLocationId] = useState<string | null>(null);
    const [pickingLocationSubj, setPickingLocationSubj] = useState<any>(null);
    const [nodes, setNodes] = useState<NodeCoordinateItem[]>([]);
    const [mapStyle, setMapStyle] = useState<"dark" | "light" | "satellite">("light");
    const [showStyleMenu, setShowStyleMenu] = useState(false);
    const [showCustomerList, setShowCustomerList] = useState(false);
    const [customerListSearch, setCustomerListSearch] = useState("");
    const [addingAtLocation, setAddingAtLocation] = useState(false);
    const [customAddLocation, setCustomAddLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        onCancel: () => void;
    } | null>(null);
    const [directionsTarget, setDirectionsTarget] = useState<{ name: string; lat: number; lng: number } | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [isMobileView, setIsMobileView] = useState(false);
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => () => { pendingPopupRef.current = null; }, []);

    useEffect(() => {
        const handleShowDirections = (e: Event) => {
            setDirectionsTarget((e as CustomEvent).detail);
        };
        const handleSelected = (e: Event) => {
            setSelectedCustomer((e as CustomEvent).detail);
        };
        window.addEventListener('showDirections', handleShowDirections);
        window.addEventListener('customerSelected', handleSelected);
        return () => {
            window.removeEventListener('showDirections', handleShowDirections);
            window.removeEventListener('customerSelected', handleSelected);
        };
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 768px)");
        const syncViewport = () => setIsMobileView(mediaQuery.matches);
        syncViewport();
        mediaQuery.addEventListener("change", syncViewport);
        return () => mediaQuery.removeEventListener("change", syncViewport);
    }, []);

    useEffect(() => {
        if (!confirmDialog && !directionsTarget) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            if (confirmDialog) confirmDialog.onCancel();
            setConfirmDialog(null);
            setDirectionsTarget(null);
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [confirmDialog, directionsTarget]);

    useEffect(() => {
        if (!showStyleMenu && !showCustomerList) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setShowStyleMenu(false);
            setShowCustomerList(false);
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [showCustomerList, showStyleMenu]);

    const fetchCustomers = async () => {
        setIsLoading(true);
        setLoadError("");
        try {
            const response = await fetch("/api/customers/map-data?hasCoordinates=true&includeDetails=true&take=10000");
            const data = await response.json();
            if (!response.ok || !Array.isArray(data.data)) {
                throw new Error(data.error || "Không thể tải dữ liệu khách hàng.");
            }
            setCustomers(data.data);
        } catch (error) {
            console.error("CUSTOMER_MAP_LOAD_ERROR", error);
            setLoadError("Không thể tải dữ liệu bản đồ khách hàng.");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchNodes = () => {
        fetch("/api/nodes?projection=coordinates")
            .then(res => res.json())
            .then(data => {
                if (data.data) setNodes(data.data);
            });
    };

    useEffect(() => {
        fetchCustomers();
        fetchNodes();
    }, []);

    const requestUserLocation = () => {
        pendingPopupRef.current = null;
        if (!navigator.geolocation) {
            setLocationError("Trình duyệt không hỗ trợ định vị");
            toast.error("Trình duyệt không hỗ trợ định vị.");
            return;
        }

        setIsLocating(true);
        setLocationError("");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const nextLocation: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                setUserLocation(nextLocation);
                setFlyTarget(nextLocation);
                setFlyZoom(15);
                setIsLocating(false);
            },
            () => {
                setLocationError("Không thể lấy vị trí hiện tại");
                setIsLocating(false);
                toast.error("Không thể lấy vị trí hiện tại. Hãy kiểm tra quyền GPS của trình duyệt.");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const { items: searchItems, loading: searching } = useMapSearch<any>({
        endpoint: "/api/customers/search-map",
        query: searchQuery,
        limit: 20,
    });

    const filteredCustomers = useMemo(() => {
        let result = customers;

        if (colorFilter !== "ALL") {
            result = result.filter(c => getMarkerColor(c) === colorFilter);
        }
        return result;
    }, [customers, colorFilter]);

    const customerListItems = useMemo(() => {
        const query = customerListSearch.trim().toLocaleLowerCase("vi");
        if (!query) return filteredCustomers;

        return filteredCustomers.filter((customer) =>
            [customer.name, customer.phone, customer.ctvCode, customer.address]
                .filter(Boolean)
                .some((value) => String(value).toLocaleLowerCase("vi").includes(query)),
        );
    }, [customerListSearch, filteredCustomers]);

    const filterCounts = useMemo(() => {
        return customers.reduce<Record<string, number>>((counts, customer) => {
            counts.ALL += 1;
            counts[getMarkerColor(customer)] = (counts[getMarkerColor(customer)] || 0) + 1;
            return counts;
        }, { ALL: 0, YELLOW: 0, SKYBLUE: 0, RED: 0, GREEN: 0, PURPLE: 0 });
    }, [customers]);

    const nearestNode = useMemo(() => {
        if (!selectedCustomer || !nodes.length) return null;
        const customerLL = L.latLng(selectedCustomer.latitude, selectedCustomer.longitude);
        let nearest = null;
        let minDistance = Infinity;

        for (const node of nodes) {
            const nodeLL = L.latLng(node.latitude, node.longitude);
            const dist = customerLL.distanceTo(nodeLL);
            if (dist < minDistance) {
                minDistance = dist;
                nearest = node;
            }
        }
        return nearest ? { node: nearest, distance: minDistance } : null;
    }, [selectedCustomer, nodes]);

    const updateCustomerLocation = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!userLocation) return toast.error("Chưa có vị trí của bạn.");

        setUpdatingLocationId(id);
        const loadingToast = toast.loading("Đang cập nhật vị trí...");
        try {
            const res = await fetch(`/api/customers/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ latitude: userLocation[0], longitude: userLocation[1] })
            });
            if (res.ok) {
                const updatedCustomer = await res.json();
                setCustomers(prev => prev.map(c => c.id === id ? updatedCustomer : c));
                toast.success("Cập nhật tọa độ thành công!", { id: loadingToast });
            } else {
                toast.error("Cập nhật thất bại.", { id: loadingToast });
            }
        } catch (err) {
            console.error(err);
            toast.error("Lỗi khi cập nhật tọa độ.", { id: loadingToast });
        } finally {
            setUpdatingLocationId(null);
        }
    };

    const handleAssignNearestNode = async (customer: any) => {
        if (!nodes.length) {
            toast.error("Chưa tải dữ liệu node hoặc danh sách node trống.");
            return;
        }
        if (!customer.latitude || !customer.longitude) {
            toast.error("Khách hàng này chưa có vị trí trên bản đồ.");
            return;
        }

        const customerLL = L.latLng(customer.latitude, customer.longitude);
        let nearestNode = null;
        let minDistance = Infinity;

        for (const node of nodes) {
            const nodeLL = L.latLng(node.latitude, node.longitude);
            const dist = customerLL.distanceTo(nodeLL);
            if (dist < minDistance) {
                minDistance = dist;
                nearestNode = node;
            }
        }

        if (nearestNode) {
            const targetNode = nearestNode;
            const targetDistance = minDistance;
            setConfirmDialog({
                isOpen: true,
                title: "Gán Node gần nhất",
                message: `Node gần nhất là ${targetNode.name} (cách ${Math.round(targetDistance)}m). Bạn có muốn gán node này cho khách hàng?`,
                onConfirm: async () => {
                    const loadingToast = toast.loading("Đang gán node...");
                    try {
                        const res = await fetch(`/api/customers/${customer.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ nodeName: targetNode.name })
                        });
                        if (res.ok) {
                            setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, nodeName: targetNode.name } : c));
                            toast.success("Gán node thành công!", { id: loadingToast });
                        } else {
                            toast.error("Gán node thất bại.", { id: loadingToast });
                        }
                    } catch (err) {
                        console.error(err);
                        toast.error("Lỗi khi gán node.", { id: loadingToast });
                    }
                },
                onCancel: () => {}
            });
        }
    };

    const handleGoToMyLocation = () => {
        pendingPopupRef.current = null;
        if (userLocation) {
            setFlyTarget(null);
            setTimeout(() => {
                setFlyTarget(userLocation);
                setFlyZoom(15);
            }, 10);
            return;
        }

        requestUserLocation();
    };

    const openPendingCustomerPopup = useCallback((position: [number, number]) => {
        const request = pendingPopupRef.current;
        if (!request || request.position !== position) return;

        const openMarker = (attempt = 0) => {
            if (pendingPopupRef.current !== request) return;
            const refObj = markersRef.current[request.id];
            if (refObj) {
                refObj.cg.zoomToShowLayer(refObj.marker, () => {
                    if (pendingPopupRef.current !== request || markersRef.current[request.id] !== refObj) return;
                    pendingPopupRef.current = null;
                    refObj.marker.openPopup();
                });
                return;
            }
            if (attempt < 8) window.setTimeout(() => openMarker(attempt + 1), 60);
        };

        openMarker();
    }, []);

    const handleCustomerClick = (c: any) => {
        const needsFilterReset = colorFilter !== "ALL" && getMarkerColor(c) !== colorFilter;
        if (needsFilterReset) setColorFilter("ALL");

        const position: [number, number] = [c.latitude, c.longitude];
        const request = { id: c.id, position };
        pendingPopupRef.current = request;

        setFlyTarget(null);
        setTimeout(() => {
            if (pendingPopupRef.current !== request) return;
            setFlyTarget(position);
            setFlyZoom(17);
        }, 10);
        setSearchQuery("");
        setShowCustomerList(false);
    };

    const handleZoomIn = () => mapRef.current?.zoomIn();
    const handleZoomOut = () => mapRef.current?.zoomOut();
    const handleFitCustomers = () => {
        const visibleCustomers = filteredCustomers.length > 0 ? filteredCustomers : customers;
        if (visibleCustomers.length === 0 || !mapRef.current) {
            toast.error("Không có khách hàng để hiển thị.");
            return;
        }

        const bounds = L.latLngBounds(
            visibleCustomers.map((customer) => [Number(customer.latitude), Number(customer.longitude)] as [number, number]),
        );
        mapRef.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    };

    const defaultCenter: [number, number] = [11.537969, 107.955546];
    const mapCenter = userLocation || (customers.length > 0 ? [customers[0].latitude, customers[0].longitude] as [number, number] : defaultCenter);

    const tileConfig = getMapTileConfig(mapStyle);
    const tileClass = tileConfig.needsDarkFilter
        ? styles.darkMapTile
        : mapStyle === "satellite"
            ? styles.satelliteMapTile
            : styles.lightMapTile;

    return (
        <div className={styles.mapOuter}>
            {isLoading && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.spinner}></div>
                    <div className={styles.loadingText}>Đang tải bản đồ</div>
                    <div className={styles.loadingSubtext}>Khởi tạo {customers.length} khách hàng...</div>
                </div>
            )}

            {!isLoading && loadError && (
                <div className={styles.errorOverlay} role="alert">
                    <div className={styles.errorCard}>
                        <strong>Không tải được bản đồ khách hàng</strong>
                        <span>{loadError}</span>
                        <button type="button" className="ui-action-btn ui-action-btn--primary" onClick={() => void fetchCustomers()}>
                            Thử lại
                        </button>
                    </div>
                </div>
            )}

            {/* Search & Controls overlay */}
            <MapToolbar className={styles.searchOverlay} label="Công cụ bản đồ khách hàng">
                <div className={styles.searchBar}>
                    <Search size={16} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder={isMobileView ? "Tìm khách hàng..." : "Tìm khách hàng (tên, SĐT, CTV, địa chỉ)..."}
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (e.target.value) setShowCustomerList(false);
                        }}
                        className={styles.searchInput}
                        role="combobox"
                        aria-label="Tìm khách hàng trên bản đồ"
                        aria-expanded={Boolean(searchQuery.trim())}
                        aria-autocomplete="list"
                        aria-controls="customer-map-search-results"
                        autoComplete="off"
                    />
                    {searchQuery && (
                        <button className={styles.clearBtn} onClick={() => setSearchQuery("")} aria-label="Xóa tìm kiếm">
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className={styles.mapActionsGroup} style={{ position: "relative" }}>
                    <button
                        type="button"
                        className={`ui-action-btn ui-action-btn--icon ${styles.mapActionBtn}`}
                        onClick={() => {
                            setShowStyleMenu((current) => !current);
                            setShowCustomerList(false);
                        }}
                        title="Kiểu bản đồ"
                        aria-label="Chọn kiểu bản đồ"
                        aria-expanded={showStyleMenu}
                        aria-controls="customer-map-style-menu"
                        aria-haspopup="menu"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
                    </button>

                    <MapStyleMenu
                        open={showStyleMenu}
                        id="customer-map-style-menu"
                        label="Chọn kiểu bản đồ"
                        value={mapStyle}
                        onSelect={(style) => {
                            setMapStyle(style);
                            setShowStyleMenu(false);
                        }}
                        className={styles.mapStyleDropdown}
                        optionClassName={styles.styleCard}
                        activeOptionClassName={styles.styleCardActive}
                        header={<div className={styles.styleMenuHeader}>Chọn kiểu bản đồ</div>}
                        itemsClassName={styles.styleGrid}
                        renderOption={(option) => (
                            <>
                                <div className={`${styles.stylePreview} ${option.key === "light" ? styles.previewLight : option.key === "dark" ? styles.previewDark : styles.previewSatellite}`} />
                                <span className={styles.styleName}>{option.label}</span>
                            </>
                        )}
                    />

                    <button
                        className={`ui-action-btn ui-action-btn--icon ${styles.mapActionBtn}`}
                        onClick={handleGoToMyLocation}
                        disabled={isLocating}
                        title={userLocation ? "Về vị trí của tôi" : locationError || "Dùng vị trí của tôi"}
                        aria-label="Vị trí của tôi"
                    >
                        {isLocating ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
                    </button>

                    <button
                        className={`ui-action-btn ui-action-btn--icon ${styles.mapActionBtn} ${styles.addAtLocationBtn}`}
                        onClick={() => {
                            if (userLocation) {
                                setCustomAddLocation({ latitude: userLocation[0], longitude: userLocation[1] });
                            } else {
                                setCustomAddLocation(null);
                            }
                            setEditingCustomer(null);
                            setAddingAtLocation(true);
                        }}
                        title={userLocation ? "Thêm khách hàng tại vị trí hiện tại" : "Thêm khách hàng mới"}
                        aria-label="Thêm khách hàng"
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </MapToolbar>

            {/* Filter Controls */}
            <MapLegend className={styles.filterControls} label="Chú giải trạng thái khách hàng">
                <button className={`ui-filter-chip ${styles.filterBtn} ${colorFilter === "ALL" ? styles.active : ""}`} onClick={() => setColorFilter("ALL")} aria-pressed={colorFilter === "ALL"}>
                    <span className={styles.filterLabel}>Tất cả</span><span className={styles.filterCount}>{filterCounts.ALL}</span>
                </button>
                <button className={`ui-filter-chip ${styles.filterBtn} ${colorFilter === "YELLOW" ? styles.active : ""}`} onClick={() => setColorFilter("YELLOW")} aria-pressed={colorFilter === "YELLOW"}>
                    <span className={`${styles.filterDot} ${styles.dotYellow}`}></span>
                    <span className={styles.filterLabel}>Cố định tháng</span>
                    <span className={styles.filterCount}>{filterCounts.YELLOW}</span>
                </button>
                <button className={`ui-filter-chip ${styles.filterBtn} ${colorFilter === "SKYBLUE" ? styles.active : ""}`} onClick={() => setColorFilter("SKYBLUE")} aria-pressed={colorFilter === "SKYBLUE"}>
                    <span className={`${styles.filterDot} ${styles.dotSkyBlue}`}></span>
                    <span className={styles.filterLabelDesktop}>Cố định (chưa hạn)</span>
                    <span className={styles.filterLabelMobile}>Chưa hạn</span>
                    <span className={styles.filterCount}>{filterCounts.SKYBLUE}</span>
                </button>
                <button className={`ui-filter-chip ${styles.filterBtn} ${colorFilter === "RED" ? styles.active : ""}`} onClick={() => setColorFilter("RED")} aria-pressed={colorFilter === "RED"}>
                    <span className={`${styles.filterDot} ${styles.dotRed}`}></span>
                    <span className={styles.filterLabelDesktop}>Cố định (tới hạn)</span>
                    <span className={styles.filterLabelMobile}>Tới hạn</span>
                    <span className={styles.filterCount}>{filterCounts.RED}</span>
                </button>
                <button className={`ui-filter-chip ${styles.filterBtn} ${colorFilter === "GREEN" ? styles.active : ""}`} onClick={() => setColorFilter("GREEN")} aria-pressed={colorFilter === "GREEN"}>
                    <span className={`${styles.filterDot} ${styles.dotGreen}`}></span>
                    <span className={styles.filterLabel}>Di động</span>
                    <span className={styles.filterCount}>{filterCounts.GREEN}</span>
                </button>
                <button className={`ui-filter-chip ${styles.filterBtn} ${colorFilter === "PURPLE" ? styles.active : ""}`} onClick={() => setColorFilter("PURPLE")} aria-pressed={colorFilter === "PURPLE"}>
                    <span className={styles.filterDot} style={{ backgroundColor: '#9333ea' }}></span>
                    <span className={styles.filterLabel}>Rời mạng</span>
                    <span className={styles.filterCount}>{filterCounts.PURPLE}</span>
                </button>
            </MapLegend>

            {/* Search results */}
            {searchQuery.trim() && (
                <MapSearchResults
                    id="customer-map-search-results"
                    className={styles.searchResults}
                    items={searchItems}
                    loading={searching}
                    visibleCount={8}
                    resultNoun="khách hàng"
                    emptyText="Không tìm thấy khách hàng phù hợp."
                    onSelect={handleCustomerClick}
                    getPrimaryText={(customer) => customer.name}
                    getSecondaryText={(customer) => customer.phone || customer.ctvCode || "Không có số"}
                    renderActions={(customer) => (
                        <>
                            {userLocation && (
                                <button
                                    className={`ui-icon-btn ${styles.resultActionBtn}`}
                                    onClick={(e) => updateCustomerLocation(customer.id, e)}
                                    disabled={updatingLocationId === customer.id}
                                    title="Gán vị trí hiện tại"
                                    aria-label="Gán vị trí hiện tại"
                                >
                                    <Navigation size={12} />
                                </button>
                            )}
                            <button
                                className={`ui-icon-btn ${styles.resultActionBtn} ${styles.resultActionAccent}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPickingLocationSubj(customer);
                                }}
                                title="Chọn trên bản đồ"
                                aria-label="Chọn trên bản đồ"
                            >
                                <MapPin size={12} />
                            </button>
                        </>
                    )}
                />
            )}

            {/* Picking Location Overlay */}
            {
                pickingLocationSubj && (
                    <div className={styles.pickingOverlay}>
                        <div className={styles.pickingText}>
                            Click vào bản đồ để chọn tọa độ cho <strong>{pickingLocationSubj.name}</strong>
                        </div>
                        <button className={styles.pickingCancelBtn} onClick={() => setPickingLocationSubj(null)}>
                            Hủy
                        </button>
                    </div>
                )
            }

            {showCustomerList && (
                <MapPanel
                    id="customer-map-list-panel"
                    className={styles.customerListPanel}
                    labelledBy="customer-map-list-title"
                >
                    <div className={styles.customerListHeader}>
                        <div>
                            <h2 id="customer-map-list-title" className={styles.customerListTitle}>Danh sách khách hàng</h2>
                            <p className={styles.customerListMeta}>
                                {customerListItems.length}/{filteredCustomers.length} khách hàng trong bộ lọc
                            </p>
                        </div>
                        <button
                            type="button"
                            className={`ui-icon-btn ${styles.customerListClose}`}
                            onClick={() => setShowCustomerList(false)}
                            aria-label="Đóng danh sách khách hàng"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <label className={styles.customerListSearch}>
                        <Search size={15} aria-hidden="true" />
                        <span className="sr-only">Lọc danh sách khách hàng</span>
                        <input
                            type="search"
                            value={customerListSearch}
                            onChange={(event) => setCustomerListSearch(event.target.value)}
                            placeholder="Lọc tên, SĐT, CTV, địa chỉ..."
                            autoFocus
                        />
                    </label>

                    <ul className={styles.customerListItems}>
                        {customerListItems.length === 0 ? (
                            <li className={styles.customerListEmpty}>Không có khách hàng phù hợp.</li>
                        ) : (
                            customerListItems.slice(0, 200).map((customer) => (
                                <li key={customer.id}>
                                    <button
                                        type="button"
                                        className={styles.customerListRow}
                                        onClick={() => handleCustomerClick(customer)}
                                    >
                                        <MapPin size={16} className={styles.customerListPin} aria-hidden="true" />
                                        <span className={styles.customerListContent}>
                                            <strong>{customer.name}</strong>
                                            <span>{customer.phone || customer.ctvCode || "Chưa có số điện thoại"}</span>
                                            {customer.address && <small>{customer.address}</small>}
                                        </span>
                                    </button>
                                </li>
                            ))
                        )}
                        {customerListItems.length > 200 && (
                            <li className={styles.customerListLimit}>
                                Đang hiển thị 200 kết quả đầu tiên. Hãy nhập thêm từ khóa để thu hẹp danh sách.
                            </li>
                        )}
                    </ul>
                </MapPanel>
            )}

            {/* Stats Badge and accessible list trigger */}
            <button
                type="button"
                className={styles.statsBadge}
                onClick={() => {
                    setSearchQuery("");
                    setShowStyleMenu(false);
                    setShowCustomerList((current) => !current);
                }}
                aria-expanded={showCustomerList}
                aria-controls="customer-map-list-panel"
                aria-haspopup="dialog"
                title="Xem danh sách khách hàng trên bản đồ"
            >
                <MapPin size={16} className={styles.statsBadgeIcon} />
                <span className={styles.statsBadgeText}>
                    <span className={styles.statsBadgeCount}>{filteredCustomers.length}</span> khách hàng trên bản đồ
                </span>
            </button>

            <MapViewportControls
                className={styles.viewportControls}
                buttonClassName={styles.viewportControlBtn}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onFit={handleFitCustomers}
                fitLabel="Hiện toàn bộ khách hàng"
            />

            <MapContainer
                center={mapCenter}
                zoom={12}
                zoomControl={false}
                style={{ height: "100%", width: "100%", zIndex: 1, backgroundColor: tileConfig.backgroundColor }}
            >
                <MapRefBridge mapInstanceRef={mapRef} />
                <TileLayer
                    attribution={tileConfig.attribution}
                    url={tileConfig.url}
                    className={tileClass}
                />

                <MapClickHandler
                    isActive={true}
                    onLocationSelected={async (latlng) => {
                        if (pickingLocationSubj) {
                            setConfirmDialog({
                                isOpen: true,
                                title: "Cập nhật tọa độ",
                                message: `Bạn muốn gán tọa độ mới cho ${pickingLocationSubj.name} tại vị trí này?`,
                                onConfirm: async () => {
                                    const loadingToast = toast.loading("Đang cập nhật tọa độ...");
                                    try {
                                        const res = await fetch(`/api/customers/${pickingLocationSubj.id}`, {
                                            method: "PUT",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ latitude: latlng.lat, longitude: latlng.lng })
                                        });
                                        if (res.ok) {
                                            const updatedCustomer = await res.json();
                                            setCustomers(prev => prev.map((c: any) => c.id === pickingLocationSubj.id ? updatedCustomer : c));
                                            toast.success("Cập nhật tọa độ thành công!", { id: loadingToast });
                                        } else {
                                            toast.error("Cập nhật thất bại.", { id: loadingToast });
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        toast.error("Lỗi khi cập nhật tọa độ.", { id: loadingToast });
                                    } finally {
                                        setPickingLocationSubj(null);
                                    }
                                },
                                onCancel: () => {
                                    setPickingLocationSubj(null);
                                }
                            });
                            return;
                        }

                        // Click trên bản đồ để thêm khách hàng tại điểm đó
                        setConfirmDialog({
                            isOpen: true,
                            title: "Thêm khách hàng tại vị trí này?",
                            message: `Tọa độ: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}. Bạn có muốn mở biểu mẫu thêm khách hàng tại điểm này?`,
                            onConfirm: () => {
                                setCustomAddLocation({ latitude: latlng.lat, longitude: latlng.lng });
                                setEditingCustomer(null);
                                setAddingAtLocation(true);
                            },
                            onCancel: () => {}
                        });
                    }}
                />

                {flyTarget && <FlyToPosition position={flyTarget} zoom={flyZoom} onComplete={openPendingCustomerPopup} />}

                {/* Current location marker */}
                {userLocation && (
                    <Marker position={userLocation} icon={CurrentLocationIcon}>
                        <Popup>
                            <div className={styles.popupContent}>
                                <strong>📍 Vị trí của bạn</strong>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {nearestNode && selectedCustomer && (
                    <>
                        <Circle 
                            center={[selectedCustomer.latitude, selectedCustomer.longitude]} 
                            radius={150} 
                            pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.1, color: '#3b82f6', weight: 1.5, dashArray: '4, 6' }} 
                        />
                        <Polyline 
                            positions={[
                                [selectedCustomer.latitude, selectedCustomer.longitude],
                                [nearestNode.node.latitude, nearestNode.node.longitude]
                            ]}
                            pathOptions={{ color: '#3b82f6', weight: 2, dashArray: '5, 8' }}
                        />
                    </>
                )}

                {/* Customer markers with custom clusters */}
                <VanillaMarkerCluster
                    customers={filteredCustomers}
                    markersRefObj={markersRef}
                    onEditCustomer={setEditingCustomer}
                    onUpdateLocation={updateCustomerLocation}
                    onPickLocation={(c) => { setPickingLocationSubj(c); }}
                    onAssignNode={handleAssignNearestNode}
                />
            </MapContainer>

            {
                (editingCustomer || addingAtLocation) && (
                    <CustomerModal
                        customer={editingCustomer}
                        onClose={() => { setEditingCustomer(null); setAddingAtLocation(false); setCustomAddLocation(null); }}
                        onRefresh={() => { fetchCustomers(); }}
                        defaultLocation={
                            editingCustomer
                                ? null
                                : customAddLocation
                                    ? customAddLocation
                                    : userLocation
                                        ? { latitude: userLocation[0], longitude: userLocation[1] }
                                        : null
                        }
                    />
                )
            }

            {confirmDialog && (
                <div className={styles.confirmDialogOverlay}>
                    <div className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="customer-map-confirm-title">
                        <h4 id="customer-map-confirm-title" className={styles.confirmDialogTitle}>{confirmDialog.title}</h4>
                        <p className={styles.confirmDialogMessage}>{confirmDialog.message}</p>
                        <div className={styles.confirmDialogActions}>
                            <button
                                type="button"
                                autoFocus
                                onClick={() => {
                                    confirmDialog.onCancel();
                                    setConfirmDialog(null);
                                }} 
                                className="ui-action-btn ui-action-btn--compact ui-action-btn--pill"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    confirmDialog.onConfirm();
                                    setConfirmDialog(null);
                                }} 
                                className="ui-action-btn ui-action-btn--compact ui-action-btn--pill ui-action-btn--primary"
                            >
                                Đồng ý
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {directionsTarget && (
                <div className={styles.confirmDialogOverlay} onClick={() => setDirectionsTarget(null)}>
                    <div className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="customer-map-directions-title" onClick={e => e.stopPropagation()}>
                        <h4 id="customer-map-directions-title" className={styles.confirmDialogTitle}>Chỉ đường tới {directionsTarget.name}</h4>
                        <p className={styles.confirmDialogMessage}>Chọn ứng dụng bản đồ hoặc copy tọa độ:</p>
                        <div className={styles.directionsList}>
                            <a 
                                href={`https://www.google.com/maps/dir/?api=1&destination=${directionsTarget.lat},${directionsTarget.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.directionsItem}
                                onClick={() => setDirectionsTarget(null)}
                            >
                                <span className={styles.directionsIcon}>🗺️</span>
                                <span>Google Maps (Web / App)</span>
                            </a>
                            <a 
                                href={`maps://?daddr=${directionsTarget.lat},${directionsTarget.lng}`}
                                className={styles.directionsItem}
                                onClick={() => setDirectionsTarget(null)}
                            >
                                <span className={styles.directionsIcon}>🍎</span>
                                <span>Apple Maps (iOS)</span>
                            </a>
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(`${directionsTarget.lat},${directionsTarget.lng}`)
                                        .then(() => toast.success("Đã copy tọa độ!"));
                                    setDirectionsTarget(null);
                                }}
                                className={styles.directionsItem}
                            >
                                <span className={styles.directionsIcon}>📋</span>
                                <span>Copy tọa độ (${directionsTarget.lat}, ${directionsTarget.lng})</span>
                            </button>
                        </div>
                        <div className={styles.confirmDialogActions} style={{ marginTop: '1rem' }}>
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setDirectionsTarget(null)} 
                                className="ui-action-btn ui-action-btn--compact ui-action-btn--pill"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
