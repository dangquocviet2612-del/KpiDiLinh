// ===== Database Models =====

export interface Customer {
    id: string;
    name: string;
    account: string | null;
    subscriberType: string; // "FIXED" | "MOBILE"
    phone: string | null;
    package: string | null;
    price: number | null;
    address: string | null;
    nodeName: string | null;
    latitude: number | null;
    longitude: number | null;
    ctvCode: string | null;
    billingType: string | null; // "PREPAID" | "MONTHLY"
    prepaidPeriod: number | null;
    renewalMonth: string | null;
    expirationDate: string | null;
    status: string; // "Hoạt động" | "Rời mạng"
    createdAt: string;
    updatedAt: string;
    edits?: EditHistoryItem[];
    notes?: CustomerNote[];
}

export interface User {
    id: string;
    username: string;
    role: string; // "ADMIN" | "MANAGER" | "CTV"
    managerCode?: string | null;
    secondaryCode?: string | null;
    canUseGps: boolean;
    createdAt: string;
    updatedAt: string;
}

/** Lightweight user object returned from /api/users for CTV dropdowns */
export interface CtvUser {
    id: string;
    username: string;
    managerCode?: string | null;
    secondaryCode?: string | null;
}

export interface CustomerNote {
    id: string;
    customerId: string;
    userId: string;
    content: string;
    createdAt: string;
    user?: { username: string };
}

export interface EditHistoryItem {
    id: string;
    customerId: string;
    userId: string;
    details: string; // JSON string
    createdAt: string;
    user?: { username: string };
}

// ===== Form Data =====

export interface CustomerFormData {
    name: string;
    account: string;
    subscriberType: string;
    phone: string;
    package: string;
    price: string;
    address: string;
    nodeName: string;
    latitude: string;
    longitude: string;
    billingType: string;
    status: string;
    prepaidPeriod: string;
    renewalMonth: string;
    ctvCode: string;
}

// ===== API Responses =====

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
}

// ===== Component Props =====

export interface CustomerTableColumn {
    key: string;
    label: string;
    visible?: boolean;
}

// ===== Node 0TB Models =====

export interface Node0TbItem {
    id: string;
    nodeCode: string;
    dateKd: string | null;
    dateKdFormatted: string | null;
    totalPort: number | null;
    usedPort: number | null;
    categoryKd: string | null;
    note: string | null;
    latitude: number | null;
    longitude: number | null;
    nodeDescription?: string | null;
    hasCoordinates: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface Node0TbCategoryStat {
    category: string;
    count: number;
    withCoords: number;
}

export interface Node0TbStats {
    total: number;
    withCoords: number;
    withoutCoords: number;
    categories: Node0TbCategoryStat[];
}

export interface Node0TbApiResponse {
    nodes: Node0TbItem[];
    stats: Node0TbStats;
    categories: string[];
}

export type Node0TbMapItem = Pick<
    Node0TbItem,
    "id" | "nodeCode" | "dateKdFormatted" | "totalPort" | "categoryKd" | "latitude" | "longitude" | "hasCoordinates"
>;

export interface Node0TbMapResponse {
    nodes: Node0TbMapItem[];
    stats: Node0TbStats;
    categories: string[];
}

export interface NodeCoordinateItem {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

export interface NodeCoordinatesResponse {
    data: NodeCoordinateItem[];
}
