export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { ensureNodeEfficiencyColumns } from "@/lib/node-efficiency-db";
import { ensureKpiTables } from "@/lib/kpi-db";
import { invalidateNearestNodeCache } from "@/lib/nodeUtils";
import { ensureOfficialDocTables } from "@/lib/official-docs-db";
import { ensureCustomerNodeMappingTable } from "@/lib/customer-node-mapping-db";
import { ensureNode0TbTable } from "@/lib/node-0tb-db";
import { getOfficialDocumentAssetRowsForBackup } from "@/lib/official-doc-assets";
import { Session } from "next-auth";

type BackupPayload = {
    meta?: {
        schemaVersion?: number;
        exportedAt?: string;
        appVersion?: string;
    };
    data?: {
        users?: Array<Record<string, unknown>>;
        customers?: Array<Record<string, unknown>>;
        nodes?: Array<Record<string, unknown>>;
        editHistory?: Array<Record<string, unknown>>;
        customerNotes?: Array<Record<string, unknown>>;
        kpiMetricConfigs?: Array<Record<string, unknown>>;
        kpiDailyResults?: Array<Record<string, unknown>>;
        managerKpiDailyResults?: Array<Record<string, unknown>>;
        cuocDailyResults?: Array<Record<string, unknown>>;
        cuocCdDailyResults?: Array<Record<string, unknown>>;
        cuocCdConfigs?: Array<Record<string, unknown>>;
        cdtTransactions?: Array<Record<string, unknown>>;
        cdtOutstandingRecords?: Array<Record<string, unknown>>;
        disconnectRecords?: Array<Record<string, unknown>>;
        churnRiskRecords?: Array<Record<string, unknown>>;
        archiveLogs?: Array<Record<string, unknown>>;
        archiveExportLogs?: Array<Record<string, unknown>>;
        cuocConfigs?: Array<Record<string, unknown>>;
        officialDocuments?: Array<Record<string, unknown>>;
        officialDocumentAssets?: Array<Record<string, unknown>>;
        officialDocumentRevisions?: Array<Record<string, unknown>>;
        customerNodeMappings?: Array<Record<string, unknown>>;
        node0TbRecords?: Array<Record<string, unknown>>;
    };
};

type PreparedUser = {
    id: string;
    username: string;
    password: string;
    role: string;
    managerCode: string | null;
    secondaryCode: string | null;
    canUseGps: boolean;
    createdAt: Date;
    updatedAt: Date;
};

type PreparedNodeBase = {
    id: string;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    createdAt: Date;
    updatedAt: Date;
};

type PreparedNodeExtra = {
    id: string;
    totalIntPort: number | null;
    usedPort: number | null;
    portEfficiency: number | null;
    dateKdIso: string | null;
    efficiencyStatus: string | null;
};

type PreparedCustomer = {
    id: string;
    name: string;
    account: string | null;
    subscriberType: string;
    phone: string | null;
    package: string | null;
    price: number | null;
    address: string | null;
    nodeName: string | null;
    latitude: number | null;
    longitude: number | null;
    ctvCode: string | null;
    billingType: string | null;
    prepaidPeriod: number | null;
    renewalMonth: Date | null;
    expirationDate: Date | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
};

type PreparedEditHistory = {
    id: string;
    customerId: string;
    userId: string;
    details: string;
    createdAt: Date;
};

type PreparedCustomerNote = {
    id: string;
    customerId: string;
    userId: string;
    content: string;
    createdAt: Date;
};

type PreparedRawRow = Record<string, string | number | null>;

type PreparedOfficialDocumentAsset = PreparedRawRow;

type RawColumnSpec = {
    key: string;
    required?: boolean;
    parse: (value: unknown) => string | number | null;
};

function requireAdmin(session: Session | null) {
    return !!session && session.user?.role === "ADMIN";
}

function toDate(value: unknown): Date | null {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

function toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function toNullableInteger(value: unknown): number | null {
    const num = toNullableNumber(value);
    return num === null ? null : Math.trunc(num);
}

function toNullableString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text ? text : null;
}

function normalizeRole(value: unknown): string {
    const role = String(value || "CTV").trim().toUpperCase();
    return role === "ADMIN" || role === "MANAGER" || role === "CTV" ? role : "CTV";
}

function toBooleanInt(value: unknown): number {
    if (typeof value === "number") return value ? 1 : 0;
    const text = String(value ?? "").trim().toLowerCase();
    return text === "1" || text === "true" || text === "yes" ? 1 : 0;
}

function findDuplicates(values: string[]) {
    const counts = new Map<string, number>();
    for (const value of values) {
        counts.set(value, (counts.get(value) || 0) + 1);
    }
    return Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([value]) => value);
}

function hasBackupKey(payload: BackupPayload["data"], key: keyof NonNullable<BackupPayload["data"]>) {
    return !!payload && Object.prototype.hasOwnProperty.call(payload, key);
}

async function getRawTableRows(tableName: string, orderBySql = "") {
    return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM "${tableName}" ${orderBySql}`
    );
}

function prepareRawTableRows(
    rows: Array<Record<string, unknown>>,
    label: string,
    specs: RawColumnSpec[]
) {
    const invalidRows: string[] = [];
    const preparedRows: PreparedRawRow[] = [];

    rows.forEach((row, index) => {
        const rowNo = index + 1;
        const prepared: PreparedRawRow = {};
        let isInvalid = false;

        for (const spec of specs) {
            const value = spec.parse(row[spec.key]);
            if (spec.required && (value === null || value === "")) {
                isInvalid = true;
                break;
            }
            prepared[spec.key] = value;
        }

        if (isInvalid) {
            invalidRows.push(`dòng ${rowNo}`);
            return;
        }

        preparedRows.push(prepared);
    });

    if (invalidRows.length > 0) {
        return {
            error: `Backup có ${label} thiếu dữ liệu bắt buộc tại ${invalidRows.slice(0, 10).join(", ")}`,
        } as const;
    }

    return { preparedRows } as const;
}

function prepareCustomerNodeMappingsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "mapping node thuê bao", [
        { key: "id", required: true, parse: (value) => toNullableString(value) },
        { key: "account", required: true, parse: (value) => toNullableString(value) },
        { key: "accountKey", required: true, parse: (value) => toNullableString(value) },
        { key: "nodeName", required: true, parse: (value) => toNullableString(value) },
        { key: "accountAddress", parse: (value) => toNullableString(value) },
        { key: "createdAt", parse: (value) => toIsoDateString(value) },
        { key: "updatedAt", parse: (value) => toIsoDateString(value) },
    ]);
}

async function insertRawRows(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    tableName: string,
    columns: string[],
    rows: PreparedRawRow[]
) {
    if (rows.length === 0) return;
    const batchSize = Math.max(1, Math.floor(900 / columns.length));
    const columnSql = columns.map((column) => `"${column}"`).join(", ");
    const rowPlaceholder = `(${columns.map(() => "?").join(", ")})`;

    for (let index = 0; index < rows.length; index += batchSize) {
        const chunk = rows.slice(index, index + batchSize);
        const valuesSql = chunk.map(() => rowPlaceholder).join(", ");
        const params = chunk.flatMap((row) => columns.map((column) => row[column] ?? null));
        await tx.$executeRawUnsafe(
            `INSERT INTO "${tableName}" (${columnSql}) VALUES ${valuesSql}`,
            ...params
        );
    }
}

function toIsoDateString(value: unknown) {
    return toDate(value)?.toISOString() ?? null;
}

async function getOfficialDocumentAssetsForBackup() {
    return getOfficialDocumentAssetRowsForBackup('ORDER BY "id" ASC');
}

async function getNodesForBackup() {
    await ensureNodeEfficiencyColumns();
    return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        SELECT
            id,
            name,
            description,
            latitude,
            longitude,
            totalIntPort,
            usedPort,
            portEfficiency,
            dateKd,
            efficiencyStatus,
            createdAt,
            updatedAt
        FROM "Node"
        ORDER BY name ASC
    `);
}

async function prepareUsersForRestore(users: Array<Record<string, unknown>>) {
    if (users.length === 0) {
        return { error: "File backup không có dữ liệu người dùng." } as const;
    }

    const duplicateIds = findDuplicates(
        users
            .map((user) => toNullableString(user.id))
            .filter((value): value is string => Boolean(value))
    );
    if (duplicateIds.length > 0) {
        return {
            error: `Backup có ID người dùng bị trùng: ${duplicateIds.slice(0, 10).join(", ")}`,
        } as const;
    }

    const duplicateUsernames = findDuplicates(
        users
            .map((user) => {
                const username = toNullableString(user.username);
                return username ? username.toLowerCase() : null;
            })
            .filter((value): value is string => Boolean(value))
    );
    if (duplicateUsernames.length > 0) {
        return {
            error: `Backup có username bị trùng: ${duplicateUsernames.slice(0, 10).join(", ")}`,
        } as const;
    }

    const existingUsers = await prisma.user.findMany({
        select: { id: true, username: true, password: true },
    });

    const passwordById = new Map(existingUsers.map((user) => [user.id, user.password]));
    const passwordByUsername = new Map(
        existingUsers.map((user) => [user.username.trim().toLowerCase(), user.password])
    );

    const missingRequired: string[] = [];
    const missingPasswords: string[] = [];
    const preparedUsers: PreparedUser[] = [];

    users.forEach((user, index) => {
        const rowNo = index + 1;
        const id = toNullableString(user.id);
        const username = toNullableString(user.username);

        if (!id || !username) {
            missingRequired.push(`dòng ${rowNo}`);
            return;
        }

        const password =
            toNullableString(user.password) ??
            passwordById.get(id) ??
            passwordByUsername.get(username.toLowerCase()) ??
            null;

        if (!password) {
            missingPasswords.push(username);
            return;
        }

        preparedUsers.push({
            id,
            username,
            password,
            role: normalizeRole(user.role),
            managerCode: toNullableString(user.managerCode),
            secondaryCode: toNullableString(user.secondaryCode),
            canUseGps: Boolean(user.canUseGps),
            createdAt: toDate(user.createdAt) ?? new Date(),
            updatedAt: toDate(user.updatedAt) ?? new Date(),
        });
    });

    if (missingRequired.length > 0) {
        return {
            error: `Backup có người dùng thiếu id hoặc username tại ${missingRequired.join(", ")}`,
        } as const;
    }

    if (missingPasswords.length > 0) {
        return {
            error:
                `Backup thiếu password hash cho các user: ${missingPasswords.slice(0, 10).join(", ")}.` +
                " Hãy tạo file backup mới hoặc restore trên hệ thống còn dữ liệu user gốc để đối chiếu.",
        } as const;
    }

    if (!preparedUsers.some((user) => user.role === "ADMIN")) {
        return { error: "Backup không có tài khoản ADMIN. Restore đã bị chặn để tránh khóa hệ thống." } as const;
    }

    return { preparedUsers } as const;
}

function prepareNodesForRestore(nodes: Array<Record<string, unknown>>) {
    const invalidRows: string[] = [];
    const baseNodes: PreparedNodeBase[] = [];
    const extraNodes: PreparedNodeExtra[] = [];

    nodes.forEach((node, index) => {
        const rowNo = index + 1;
        const id = toNullableString(node.id);
        const name = toNullableString(node.name);
        const latitude = toNullableNumber(node.latitude);
        const longitude = toNullableNumber(node.longitude);

        if (!id || !name || latitude === null || longitude === null) {
            invalidRows.push(`dòng ${rowNo}`);
            return;
        }

        baseNodes.push({
            id,
            name,
            description: toNullableString(node.description),
            latitude,
            longitude,
            createdAt: toDate(node.createdAt) ?? new Date(),
            updatedAt: toDate(node.updatedAt) ?? new Date(),
        });

        extraNodes.push({
            id,
            totalIntPort: toNullableNumber(node.totalIntPort),
            usedPort: toNullableNumber(node.usedPort),
            portEfficiency: toNullableNumber(node.portEfficiency),
            dateKdIso: toDate(node.dateKd)?.toISOString() ?? null,
            efficiencyStatus: toNullableString(node.efficiencyStatus),
        });
    });

    if (invalidRows.length > 0) {
        return {
            error: `Backup có node thiếu dữ liệu bắt buộc tại ${invalidRows.slice(0, 10).join(", ")}`,
        } as const;
    }

    return { baseNodes, extraNodes } as const;
}

function prepareCustomersForRestore(customers: Array<Record<string, unknown>>) {
    const invalidRows: string[] = [];
    const preparedCustomers: PreparedCustomer[] = [];

    customers.forEach((customer, index) => {
        const rowNo = index + 1;
        const id = toNullableString(customer.id);
        const name = toNullableString(customer.name);
        const subscriberType = toNullableString(customer.subscriberType);

        if (!id || !name || !subscriberType) {
            invalidRows.push(`dòng ${rowNo}`);
            return;
        }

        preparedCustomers.push({
            id,
            name,
            account: toNullableString(customer.account),
            subscriberType,
            phone: toNullableString(customer.phone),
            package: toNullableString(customer.package),
            price: toNullableNumber(customer.price),
            address: toNullableString(customer.address),
            nodeName: toNullableString(customer.nodeName),
            latitude: toNullableNumber(customer.latitude),
            longitude: toNullableNumber(customer.longitude),
            ctvCode: toNullableString(customer.ctvCode),
            billingType: toNullableString(customer.billingType),
            prepaidPeriod: toNullableInteger(customer.prepaidPeriod),
            renewalMonth: toDate(customer.renewalMonth),
            expirationDate: toDate(customer.expirationDate),
            status: toNullableString(customer.status) ?? "Hoạt động",
            createdAt: toDate(customer.createdAt) ?? new Date(),
            updatedAt: toDate(customer.updatedAt) ?? new Date(),
        });
    });

    if (invalidRows.length > 0) {
        return {
            error: `Backup có khách hàng thiếu dữ liệu bắt buộc tại ${invalidRows.slice(0, 10).join(", ")}`,
        } as const;
    }

    return { preparedCustomers } as const;
}

function prepareEditHistoryForRestore(editHistory: Array<Record<string, unknown>>) {
    const invalidRows: string[] = [];
    const preparedEditHistory: PreparedEditHistory[] = [];

    editHistory.forEach((history, index) => {
        const rowNo = index + 1;
        const id = toNullableString(history.id);
        const customerId = toNullableString(history.customerId);
        const userId = toNullableString(history.userId);
        const details = toNullableString(history.details);

        if (!id || !customerId || !userId || !details) {
            invalidRows.push(`dòng ${rowNo}`);
            return;
        }

        preparedEditHistory.push({
            id,
            customerId,
            userId,
            details,
            createdAt: toDate(history.createdAt) ?? new Date(),
        });
    });

    if (invalidRows.length > 0) {
        return {
            error: `Backup có lịch sử chỉnh sửa thiếu dữ liệu bắt buộc tại ${invalidRows.slice(0, 10).join(", ")}`,
        } as const;
    }

    return { preparedEditHistory } as const;
}

function prepareCustomerNotesForRestore(customerNotes: Array<Record<string, unknown>>) {
    const invalidRows: string[] = [];
    const preparedCustomerNotes: PreparedCustomerNote[] = [];

    customerNotes.forEach((note, index) => {
        const rowNo = index + 1;
        const id = toNullableString(note.id);
        const customerId = toNullableString(note.customerId);
        const userId = toNullableString(note.userId);
        const content = toNullableString(note.content);

        if (!id || !customerId || !userId || !content) {
            invalidRows.push(`dòng ${rowNo}`);
            return;
        }

        preparedCustomerNotes.push({
            id,
            customerId,
            userId,
            content,
            createdAt: toDate(note.createdAt) ?? new Date(),
        });
    });

    if (invalidRows.length > 0) {
        return {
            error: `Backup có ghi chú khách hàng thiếu dữ liệu bắt buộc tại ${invalidRows.slice(0, 10).join(", ")}`,
        } as const;
    }

    return { preparedCustomerNotes } as const;
}

function prepareKpiMetricConfigsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "cấu hình KPI", [
        { key: "id", parse: toNullableInteger },
        { key: "kpiCode", required: true, parse: toNullableString },
        { key: "kpiName", parse: toNullableString },
        { key: "displayName", parse: toNullableString },
        { key: "mergeGroup", parse: toNullableString },
        { key: "baseScore", parse: toNullableNumber },
        { key: "maxPercent", parse: toNullableNumber },
        { key: "sortOrder", parse: toNullableInteger },
        { key: "isEnabled", parse: toBooleanInt },
        { key: "isNegative", parse: toBooleanInt },
        { key: "createdAt", parse: toIsoDateString },
        { key: "updatedAt", parse: toIsoDateString },
    ]);
}

function prepareKpiDailyResultsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "kết quả KPI", [
        { key: "id", parse: toNullableInteger },
        { key: "reportDate", required: true, parse: toNullableString },
        { key: "ctvUser", required: true, parse: toNullableString },
        { key: "kpiCode", required: true, parse: toNullableString },
        { key: "kpiName", parse: toNullableString },
        { key: "khThang", parse: toNullableNumber },
        { key: "thNgay", parse: toNullableNumber },
        { key: "thLuyKe", parse: toNullableNumber },
        { key: "completionPercent", parse: toNullableNumber },
        { key: "growthPercent", parse: toNullableNumber },
        { key: "rawPayload", parse: toNullableString },
        { key: "createdAt", parse: toIsoDateString },
    ]);
}

function prepareManagerKpiDailyResultsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "KPI quan ly", [
        { key: "id", parse: toNullableInteger },
        { key: "reportDate", required: true, parse: toNullableString },
        { key: "managerUser", required: true, parse: toNullableString },
        { key: "managerName", parse: toNullableString },
        { key: "jobTitle", parse: toNullableString },
        { key: "metricCode", required: true, parse: toNullableString },
        { key: "metricName", parse: toNullableString },
        { key: "metricLabel", parse: toNullableString },
        { key: "khToDate", parse: toNullableNumber },
        { key: "khMonth", parse: toNullableNumber },
        { key: "thDay", parse: toNullableNumber },
        { key: "thLuyKe", parse: toNullableNumber },
        { key: "percentToDate", parse: toNullableNumber },
        { key: "percentMonth", parse: toNullableNumber },
        { key: "samePeriodValue", parse: toNullableNumber },
        { key: "growthPercent", parse: toNullableNumber },
        { key: "rawPayload", parse: toNullableString },
        { key: "createdAt", parse: toIsoDateString },
    ]);
}

function prepareCuocDailyResultsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "kết quả cước", [
        { key: "id", parse: toNullableInteger },
        { key: "reportDate", required: true, parse: toNullableString },
        { key: "ctvUser", required: true, parse: toNullableString },
        { key: "employeeCodeRaw", parse: toNullableString },
        { key: "managerCodeRaw", parse: toNullableString },
        { key: "targetAmount", parse: toNullableNumber },
        { key: "collectedAmount", parse: toNullableNumber },
        { key: "completionPercent", parse: toNullableNumber },
        { key: "missingAmount", parse: toNullableNumber },
        { key: "createdAt", parse: toIsoDateString },
    ]);
}

function prepareCdtTransactionsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "giao dịch CDT", [
        { key: "id", parse: toNullableInteger },
        { key: "transactionDate", required: true, parse: toNullableString },
        { key: "transactionTime", parse: toNullableString },
        { key: "ctvUser", required: true, parse: toNullableString },
        { key: "subscriberType", parse: toNullableString },
        { key: "account", required: true, parse: toNullableString },
        { key: "amount", parse: toNullableNumber },
        { key: "months", parse: toNullableInteger },
        { key: "sourceFile", parse: toNullableString },
        { key: "createdAt", parse: toIsoDateString },
    ]);
}

function prepareCdtOutstandingRecordsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "ton CDT", [
        { key: "id", parse: toNullableInteger },
        { key: "reportMonth", required: true, parse: toNullableString },
        { key: "account", required: true, parse: toNullableString },
        { key: "customerName", parse: toNullableString },
        { key: "phone", parse: toNullableString },
        { key: "address", parse: toNullableString },
        { key: "ctvCode", required: true, parse: toNullableString },
        { key: "serviceName", parse: toNullableString },
        { key: "expiryDateText", parse: toNullableString },
        { key: "expiryMonth", required: true, parse: toNullableString },
        { key: "statusCheck", required: true, parse: toNullableString },
        { key: "subscriberType", required: true, parse: toNullableString },
        { key: "sourceFile", parse: toNullableString },
        { key: "createdAt", parse: toIsoDateString },
        { key: "updatedAt", parse: toIsoDateString },
    ]);
}

function prepareDisconnectRecordsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "r?i m?ng", [
        { key: "id", parse: toNullableInteger },
        { key: "reportMonth", required: true, parse: toNullableString },
        { key: "sourceType", required: true, parse: toNullableString },
        { key: "account", required: true, parse: toNullableString },
        { key: "serviceName", parse: toNullableString },
        { key: "ctvCode", required: true, parse: toNullableString },
        { key: "suspendedDateIso", parse: toNullableString },
        { key: "suspendedDateText", parse: toNullableString },
        { key: "cancelDateIso", parse: toNullableString },
        { key: "cancelDateText", parse: toNullableString },
        { key: "cancelMonth", required: true, parse: toNullableString },
        { key: "sourceFile", parse: toNullableString },
        { key: "createdAt", parse: toIsoDateString },
        { key: "updatedAt", parse: toIsoDateString },
    ]);
}

function prepareArchiveLogsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "lưu trữ KPI/Cước", [
        { key: "id", parse: toNullableInteger },
        { key: "archiveMonth", required: true, parse: toNullableString },
        { key: "archivedBy", required: true, parse: toNullableString },
        { key: "archivedAt", parse: toIsoDateString },
        { key: "purgeAfter", parse: toIsoDateString },
        { key: "purgedAt", parse: toIsoDateString },
        { key: "kpiRecordCount", parse: toNullableInteger },
        { key: "cuocRecordCount", parse: toNullableInteger },
        { key: "fileName", parse: toNullableString },
    ]);
}

function prepareArchiveExportLogsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "log xuất lưu trữ KPI/Cước", [
        { key: "id", parse: toNullableInteger },
        { key: "archiveMonth", required: true, parse: toNullableString },
        { key: "exportedBy", required: true, parse: toNullableString },
        { key: "exportedAt", parse: toIsoDateString },
        { key: "fileName", required: true, parse: toNullableString },
    ]);
}

function prepareCuocConfigsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "cấu hình cước", [
        { key: "id", required: true, parse: toNullableInteger },
        { key: "targetRatePercent", parse: toNullableNumber },
        { key: "updatedAt", parse: toIsoDateString },
    ]);
}

function prepareOfficialDocumentsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "công văn", [
        { key: "id", required: true, parse: toNullableString },
        { key: "title", required: true, parse: toNullableString },
        { key: "category", required: true, parse: toNullableString },
        { key: "summary", parse: toNullableString },
        { key: "content", parse: toNullableString },
        { key: "status", required: true, parse: toNullableString },
        { key: "publishedAt", parse: toIsoDateString },
        { key: "expiresAt", parse: toIsoDateString },
        { key: "isPinned", parse: toBooleanInt },
        { key: "createdBy", parse: toNullableString },
        { key: "createdAt", parse: toIsoDateString },
        { key: "updatedAt", parse: toIsoDateString },
    ]);
}

function prepareOfficialDocumentAssetsForRestore(rows: Array<Record<string, unknown>>) {
    const normalizedRows = rows.map((row) => {
        const fileData = toNullableString(row.fileData) ?? toNullableString(row.fileBase64);
        const rawStorageKind = toNullableString(row.storageKind);
        const storageKind = (rawStorageKind ?? (fileData ? "INLINE" : "EXTERNAL"))?.toUpperCase();
        const fileUrl = toNullableString(row.fileUrl) ?? (storageKind === "INLINE" ? "" : null);
        return {
            ...row,
            fileData,
            fileUrl,
            storageKind,
        };
    });

    const base = prepareRawTableRows(normalizedRows, "tài sản công văn", [
        { key: "id", parse: toNullableInteger },
        { key: "documentId", required: true, parse: toNullableString },
        { key: "type", required: true, parse: toNullableString },
        { key: "fileUrl", parse: toNullableString },
        { key: "fileName", required: true, parse: toNullableString },
        { key: "mimeType", parse: toNullableString },
        { key: "size", parse: toNullableInteger },
        { key: "storageKind", parse: toNullableString },
        { key: "fileData", parse: toNullableString },
        { key: "createdAt", parse: toIsoDateString },
    ]);

    if ("error" in base) return base;

    const invalidRows: string[] = [];
    const preparedRows = (base.preparedRows as PreparedOfficialDocumentAsset[]).map((row, index) => {
        const storageKind = String(row.storageKind || "EXTERNAL").toUpperCase();
        const isInline = storageKind === "INLINE";
        const fileUrl = row.fileUrl === null ? "" : String(row.fileUrl || "");
        const fileData = row.fileData === null ? null : String(row.fileData || "");

        if ((!isInline && !fileUrl) || (isInline && !fileData)) {
            invalidRows.push(`dòng ${index + 1}`);
        }

        return {
            ...row,
            fileUrl,
            storageKind,
            fileData: fileData || null,
        };
    });

    if (invalidRows.length > 0) {
        return {
            error: `Backup có tài sản công văn thiếu dữ liệu bắt buộc tại ${invalidRows.slice(0, 10).join(", ")}`,
        } as const;
    }

    return { preparedRows } as const;
}

function prepareOfficialDocumentRevisionsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "lịch sử công văn", [
        { key: "id", parse: toNullableInteger },
        { key: "documentId", required: true, parse: toNullableString },
        { key: "changeType", required: true, parse: toNullableString },
        { key: "changedBy", parse: toNullableString },
        { key: "changedAt", parse: toIsoDateString },
        { key: "title", required: true, parse: toNullableString },
        { key: "summary", parse: toNullableString },
        { key: "content", parse: toNullableString },
        { key: "status", required: true, parse: toNullableString },
        { key: "category", required: true, parse: toNullableString },
        { key: "isPinned", parse: toBooleanInt },
    ]);
}

function prepareCuocCdDailyResultsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "kết quả cước cố định", [
        { key: "id", parse: toNullableInteger },
        { key: "reportDate", required: true, parse: toNullableString },
        { key: "ctvUser", required: true, parse: toNullableString },
        { key: "employeeCodeRaw", required: true, parse: toNullableString },
        { key: "managerCodeRaw", parse: toNullableString },
        { key: "dauKy", parse: toNullableNumber },
        { key: "luyKe", parse: toNullableNumber },
        { key: "thuaThieu", parse: toNullableNumber },
        { key: "tonChuaThu", parse: toNullableNumber },
        { key: "createdAt", parse: toIsoDateString },
    ]);
}

function prepareCuocCdConfigsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "cấu hình cước cố định", [
        { key: "id", required: true, parse: toNullableInteger },
        { key: "targetRatePercent", required: true, parse: toNullableNumber },
        { key: "updatedAt", parse: toIsoDateString },
    ]);
}

function prepareChurnRiskRecordsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "nguy cơ rời mạng", [
        { key: "id", parse: toNullableInteger },
        { key: "reportMonth", required: true, parse: toNullableString },
        { key: "ctvCode", required: true, parse: toNullableString },
        { key: "customerName", parse: toNullableString },
        { key: "phone", parse: toNullableString },
        { key: "packageName", parse: toNullableString },
        { key: "address", parse: toNullableString },
        { key: "sourceFile", parse: toNullableString },
        { key: "createdAt", parse: toIsoDateString },
        { key: "updatedAt", parse: toIsoDateString },
    ]);
}

function prepareNode0TbRecordsForRestore(rows: Array<Record<string, unknown>>) {
    return prepareRawTableRows(rows, "node 0TB", [
        { key: "id", parse: toNullableString },
        { key: "nodeCode", required: true, parse: toNullableString },
        { key: "dateKd", parse: toIsoDateString },
        { key: "dateKdRaw", parse: toNullableString },
        { key: "dateKdFormatted", parse: toNullableString },
        { key: "totalPort", parse: toNullableInteger },
        { key: "usedPort", parse: toNullableInteger },
        { key: "categoryKd", parse: toNullableString },
        { key: "note", parse: toNullableString },
        { key: "createdAt", parse: toIsoDateString },
        { key: "updatedAt", parse: toIsoDateString },
    ]);
}

function clearRestoreCaches() {
    invalidateNearestNodeCache();
    clearCacheByPrefix("map:data");
    clearCacheByPrefix("map:detail");
    clearCacheByPrefix("nodes:");
    clearCacheByPrefix("kpi:");
    clearCacheByPrefix("cuoc:");
    clearCacheByPrefix("cuoc-cd:");
    clearCacheByPrefix("cdt:");
    clearCacheByPrefix("disconnect:");
    clearCacheByPrefix("churn-risk:");
    clearCacheByPrefix("node-0tb:");
}

export async function GET() {
    try {
        const session = await auth();
        if (!requireAdmin(session)) {
            return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
        }

        await Promise.all([
            ensureNodeEfficiencyColumns(),
            ensureKpiTables(),
            ensureOfficialDocTables(),
            ensureCustomerNodeMappingTable(),
            ensureNode0TbTable(),
        ]);

        const [
            users,
            customers,
            nodes,
            editHistory,
            customerNotes,
            kpiMetricConfigs,
            kpiDailyResults,
            managerKpiDailyResults,
            cuocDailyResults,
            cuocCdDailyResults,
            cuocCdConfigs,
            cdtTransactions,
            cdtOutstandingRecords,
            disconnectRecords,
            churnRiskRecords,
            archiveLogs,
            archiveExportLogs,
            cuocConfigs,
            officialDocuments,
            officialDocumentAssets,
            officialDocumentRevisions,
            customerNodeMappings,
            node0TbRecords,
        ] = await Promise.all([
            prisma.user.findMany({
                select: {
                    id: true,
                    username: true,
                    password: true,
                    role: true,
                    managerCode: true,
                    secondaryCode: true,
                    canUseGps: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.customer.findMany(),
            getNodesForBackup(),
            prisma.editHistory.findMany(),
            prisma.customerNote.findMany(),
            getRawTableRows("KpiMetricConfig", 'ORDER BY "sortOrder" ASC, "kpiCode" ASC'),
            getRawTableRows("KpiDailyResult", 'ORDER BY "reportDate" ASC, "ctvUser" ASC, "kpiCode" ASC'),
            getRawTableRows("ManagerKpiDailyResult", 'ORDER BY "reportDate" ASC, "managerUser" ASC, "metricCode" ASC'),
            getRawTableRows("CuocDailyResult", 'ORDER BY "reportDate" ASC, "ctvUser" ASC'),
            getRawTableRows("CuocCdDailyResult", 'ORDER BY "reportDate" ASC, "employeeCodeRaw" ASC'),
            getRawTableRows("CuocCdConfig", 'ORDER BY "id" ASC'),
            getRawTableRows("CdtTransaction", 'ORDER BY "transactionDate" ASC, "ctvUser" ASC, "account" ASC'),
            getRawTableRows("CdtOutstandingRecord", 'ORDER BY "reportMonth" DESC, "expiryMonth" ASC, "ctvCode" ASC, "account" ASC'),
            getRawTableRows("DisconnectRecord", 'ORDER BY "reportMonth" DESC, "cancelMonth" ASC, "ctvCode" ASC, "account" ASC'),
            getRawTableRows("ChurnRiskRecord", 'ORDER BY "reportMonth" DESC, "ctvCode" ASC, "id" ASC'),
            getRawTableRows("ArchiveLog", 'ORDER BY "archiveMonth" ASC'),
            getRawTableRows("ArchiveExportLog", 'ORDER BY "archiveMonth" ASC'),
            getRawTableRows("CuocConfig", 'ORDER BY "id" ASC'),
            getRawTableRows("OfficialDocument", 'ORDER BY COALESCE("publishedAt", "createdAt") DESC'),
            getOfficialDocumentAssetsForBackup(),
            getRawTableRows("OfficialDocumentRevision", 'ORDER BY "changedAt" DESC, "id" DESC'),
            getRawTableRows("CustomerNodeMapping", 'ORDER BY "accountKey" ASC'),
            getRawTableRows("Node0Tb", 'ORDER BY "nodeCode" ASC'),
        ]);

        const payload = {
            meta: {
                schemaVersion: 10,
                exportedAt: new Date().toISOString(),
                appVersion: "0.1.0",
            },
            data: {
                users,
                customers,
                nodes,
                editHistory,
                customerNotes,
                kpiMetricConfigs,
                kpiDailyResults,
                managerKpiDailyResults,
                cuocDailyResults,
                cuocCdDailyResults,
                cuocCdConfigs,
                cdtTransactions,
                cdtOutstandingRecords,
                disconnectRecords,
                churnRiskRecords,
                archiveLogs,
                archiveExportLogs,
                cuocConfigs,
                officialDocuments,
                officialDocumentAssets,
                officialDocumentRevisions,
                customerNodeMappings,
                node0TbRecords,
            },
        };

        const fileName = `customer-manager-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        return new NextResponse(JSON.stringify(payload, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="${fileName}"`,
            },
        });
    } catch (error) {
        console.error("BACKUP_GET_ERROR", error);
        return NextResponse.json({ error: "Lỗi máy chủ nội bộ" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!requireAdmin(session)) {
            return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
        }

        const payload = (await request.json()) as BackupPayload;
        if (!payload?.data) {
            return NextResponse.json({ error: "File backup không hợp lệ" }, { status: 400 });
        }

        const users = Array.isArray(payload.data.users) ? payload.data.users : [];
        const customers = Array.isArray(payload.data.customers) ? payload.data.customers : [];
        const nodes = Array.isArray(payload.data.nodes) ? payload.data.nodes : [];
        const editHistory = Array.isArray(payload.data.editHistory) ? payload.data.editHistory : [];
        const customerNotes = Array.isArray(payload.data.customerNotes) ? payload.data.customerNotes : [];
        const hasKpiMetricConfigs = hasBackupKey(payload.data, "kpiMetricConfigs");
        const hasKpiDailyResults = hasBackupKey(payload.data, "kpiDailyResults");
        const hasManagerKpiDailyResults = hasBackupKey(payload.data, "managerKpiDailyResults");
        const hasCuocDailyResults = hasBackupKey(payload.data, "cuocDailyResults");
        const hasCuocCdDailyResults = hasBackupKey(payload.data, "cuocCdDailyResults");
        const hasCuocCdConfigs = hasBackupKey(payload.data, "cuocCdConfigs");
        const hasCdtTransactions = hasBackupKey(payload.data, "cdtTransactions");
        const hasCdtOutstandingRecords = hasBackupKey(payload.data, "cdtOutstandingRecords");
        const hasDisconnectRecords = hasBackupKey(payload.data, "disconnectRecords");
        const hasChurnRiskRecords = hasBackupKey(payload.data, "churnRiskRecords");
        const hasArchiveLogs = hasBackupKey(payload.data, "archiveLogs");
        const hasArchiveExportLogs = hasBackupKey(payload.data, "archiveExportLogs");
        const hasCuocConfigs = hasBackupKey(payload.data, "cuocConfigs");
        const hasOfficialDocuments = hasBackupKey(payload.data, "officialDocuments");
        const hasOfficialDocumentAssets = hasBackupKey(payload.data, "officialDocumentAssets");
        const hasOfficialDocumentRevisions = hasBackupKey(payload.data, "officialDocumentRevisions");
        const hasCustomerNodeMappings = hasBackupKey(payload.data, "customerNodeMappings");
        const hasNode0TbRecords = hasBackupKey(payload.data, "node0TbRecords");
        const kpiMetricConfigs = hasKpiMetricConfigs && Array.isArray(payload.data.kpiMetricConfigs) ? payload.data.kpiMetricConfigs : [];
        const kpiDailyResults = hasKpiDailyResults && Array.isArray(payload.data.kpiDailyResults) ? payload.data.kpiDailyResults : [];
        const managerKpiDailyResults =
            hasManagerKpiDailyResults && Array.isArray(payload.data.managerKpiDailyResults) ? payload.data.managerKpiDailyResults : [];
        const cuocDailyResults = hasCuocDailyResults && Array.isArray(payload.data.cuocDailyResults) ? payload.data.cuocDailyResults : [];
        const cuocCdDailyResults = hasCuocCdDailyResults && Array.isArray(payload.data.cuocCdDailyResults) ? payload.data.cuocCdDailyResults : [];
        const cuocCdConfigs = hasCuocCdConfigs && Array.isArray(payload.data.cuocCdConfigs) ? payload.data.cuocCdConfigs : [];
        const cdtTransactions = hasCdtTransactions && Array.isArray(payload.data.cdtTransactions) ? payload.data.cdtTransactions : [];
        const cdtOutstandingRecords =
            hasCdtOutstandingRecords && Array.isArray(payload.data.cdtOutstandingRecords) ? payload.data.cdtOutstandingRecords : [];
        const disconnectRecords =
            hasDisconnectRecords && Array.isArray(payload.data.disconnectRecords) ? payload.data.disconnectRecords : [];
        const churnRiskRecords = hasChurnRiskRecords && Array.isArray(payload.data.churnRiskRecords) ? payload.data.churnRiskRecords : [];
        const archiveLogs = hasArchiveLogs && Array.isArray(payload.data.archiveLogs) ? payload.data.archiveLogs : [];
        const archiveExportLogs =
            hasArchiveExportLogs && Array.isArray(payload.data.archiveExportLogs) ? payload.data.archiveExportLogs : [];
        const cuocConfigs = hasCuocConfigs && Array.isArray(payload.data.cuocConfigs) ? payload.data.cuocConfigs : [];
        const officialDocuments = hasOfficialDocuments && Array.isArray(payload.data.officialDocuments) ? payload.data.officialDocuments : [];
        const officialDocumentAssets =
            hasOfficialDocumentAssets && Array.isArray(payload.data.officialDocumentAssets)
                ? payload.data.officialDocumentAssets
                : [];
        const officialDocumentRevisions =
            hasOfficialDocumentRevisions && Array.isArray(payload.data.officialDocumentRevisions)
                ? payload.data.officialDocumentRevisions
                : [];
        const customerNodeMappings =
            hasCustomerNodeMappings && Array.isArray(payload.data.customerNodeMappings)
                ? payload.data.customerNodeMappings
                : [];
        const node0TbRecords = hasNode0TbRecords && Array.isArray(payload.data.node0TbRecords) ? payload.data.node0TbRecords : [];

        const userPreparation = await prepareUsersForRestore(users);
        if ("error" in userPreparation) {
            return NextResponse.json({ error: userPreparation.error }, { status: 400 });
        }

        const nodePreparation = prepareNodesForRestore(nodes);
        if ("error" in nodePreparation) {
            return NextResponse.json({ error: nodePreparation.error }, { status: 400 });
        }

        const customerPreparation = prepareCustomersForRestore(customers);
        if ("error" in customerPreparation) {
            return NextResponse.json({ error: customerPreparation.error }, { status: 400 });
        }

        const editHistoryPreparation = prepareEditHistoryForRestore(editHistory);
        if ("error" in editHistoryPreparation) {
            return NextResponse.json({ error: editHistoryPreparation.error }, { status: 400 });
        }

        const customerNotePreparation = prepareCustomerNotesForRestore(customerNotes);
        if ("error" in customerNotePreparation) {
            return NextResponse.json({ error: customerNotePreparation.error }, { status: 400 });
        }

        const kpiMetricConfigPreparation = prepareKpiMetricConfigsForRestore(kpiMetricConfigs);
        if ("error" in kpiMetricConfigPreparation) {
            return NextResponse.json({ error: kpiMetricConfigPreparation.error }, { status: 400 });
        }

        const kpiDailyResultPreparation = prepareKpiDailyResultsForRestore(kpiDailyResults);
        if ("error" in kpiDailyResultPreparation) {
            return NextResponse.json({ error: kpiDailyResultPreparation.error }, { status: 400 });
        }

        const managerKpiDailyResultPreparation = prepareManagerKpiDailyResultsForRestore(managerKpiDailyResults);
        if ("error" in managerKpiDailyResultPreparation) {
            return NextResponse.json({ error: managerKpiDailyResultPreparation.error }, { status: 400 });
        }

        const cuocDailyResultPreparation = prepareCuocDailyResultsForRestore(cuocDailyResults);
        if ("error" in cuocDailyResultPreparation) {
            return NextResponse.json({ error: cuocDailyResultPreparation.error }, { status: 400 });
        }

        const cuocCdDailyResultPreparation = prepareCuocCdDailyResultsForRestore(cuocCdDailyResults);
        if ("error" in cuocCdDailyResultPreparation) {
            return NextResponse.json({ error: cuocCdDailyResultPreparation.error }, { status: 400 });
        }

        const cuocCdConfigPreparation = prepareCuocCdConfigsForRestore(cuocCdConfigs);
        if ("error" in cuocCdConfigPreparation) {
            return NextResponse.json({ error: cuocCdConfigPreparation.error }, { status: 400 });
        }

        const cdtTransactionPreparation = prepareCdtTransactionsForRestore(cdtTransactions);
        if ("error" in cdtTransactionPreparation) {
            return NextResponse.json({ error: cdtTransactionPreparation.error }, { status: 400 });
        }

        const cdtOutstandingPreparation = prepareCdtOutstandingRecordsForRestore(cdtOutstandingRecords);
        if ("error" in cdtOutstandingPreparation) {
            return NextResponse.json({ error: cdtOutstandingPreparation.error }, { status: 400 });
        }

        const disconnectPreparation = prepareDisconnectRecordsForRestore(disconnectRecords);
        if ("error" in disconnectPreparation) {
            return NextResponse.json({ error: disconnectPreparation.error }, { status: 400 });
        }

        const churnRiskPreparation = prepareChurnRiskRecordsForRestore(churnRiskRecords);
        if ("error" in churnRiskPreparation) {
            return NextResponse.json({ error: churnRiskPreparation.error }, { status: 400 });
        }

        const archiveLogPreparation = prepareArchiveLogsForRestore(archiveLogs);
        if ("error" in archiveLogPreparation) {
            return NextResponse.json({ error: archiveLogPreparation.error }, { status: 400 });
        }

        const archiveExportLogPreparation = prepareArchiveExportLogsForRestore(archiveExportLogs);
        if ("error" in archiveExportLogPreparation) {
            return NextResponse.json({ error: archiveExportLogPreparation.error }, { status: 400 });
        }

        const cuocConfigPreparation = prepareCuocConfigsForRestore(cuocConfigs);
        if ("error" in cuocConfigPreparation) {
            return NextResponse.json({ error: cuocConfigPreparation.error }, { status: 400 });
        }

        const officialDocumentPreparation = prepareOfficialDocumentsForRestore(officialDocuments);
        if ("error" in officialDocumentPreparation) {
            return NextResponse.json({ error: officialDocumentPreparation.error }, { status: 400 });
        }

        const officialDocumentAssetPreparation = prepareOfficialDocumentAssetsForRestore(officialDocumentAssets);
        if ("error" in officialDocumentAssetPreparation) {
            return NextResponse.json({ error: officialDocumentAssetPreparation.error }, { status: 400 });
        }

        const officialDocumentRevisionPreparation = prepareOfficialDocumentRevisionsForRestore(officialDocumentRevisions);
        if ("error" in officialDocumentRevisionPreparation) {
            return NextResponse.json({ error: officialDocumentRevisionPreparation.error }, { status: 400 });
        }

        const customerNodeMappingPreparation = prepareCustomerNodeMappingsForRestore(customerNodeMappings);
        if ("error" in customerNodeMappingPreparation) {
            return NextResponse.json({ error: customerNodeMappingPreparation.error }, { status: 400 });
        }

        const node0TbPreparation = prepareNode0TbRecordsForRestore(node0TbRecords);
        if ("error" in node0TbPreparation) {
            return NextResponse.json({ error: node0TbPreparation.error }, { status: 400 });
        }

        await Promise.all([
            ensureNodeEfficiencyColumns(),
            ensureKpiTables(),
            ensureOfficialDocTables(),
            ensureCustomerNodeMappingTable(),
            ensureNode0TbTable(),
        ]);

        await prisma.$transaction(async (tx) => {
            if (hasOfficialDocumentRevisions) await tx.$executeRawUnsafe(`DELETE FROM "OfficialDocumentRevision"`);
            if (hasOfficialDocumentAssets) await tx.$executeRawUnsafe(`DELETE FROM "OfficialDocumentAsset"`);
            if (hasOfficialDocuments) await tx.$executeRawUnsafe(`DELETE FROM "OfficialDocument"`);
            if (hasCustomerNodeMappings) await tx.$executeRawUnsafe(`DELETE FROM "CustomerNodeMapping"`);
            if (hasArchiveExportLogs) await tx.$executeRawUnsafe(`DELETE FROM "ArchiveExportLog"`);
            if (hasArchiveLogs) await tx.$executeRawUnsafe(`DELETE FROM "ArchiveLog"`);
            if (hasDisconnectRecords) await tx.$executeRawUnsafe(`DELETE FROM "DisconnectRecord"`);
            if (hasChurnRiskRecords) await tx.$executeRawUnsafe(`DELETE FROM "ChurnRiskRecord"`);
            if (hasCdtOutstandingRecords) await tx.$executeRawUnsafe(`DELETE FROM "CdtOutstandingRecord"`);
            if (hasCdtTransactions) await tx.$executeRawUnsafe(`DELETE FROM "CdtTransaction"`);
            if (hasCuocDailyResults) await tx.$executeRawUnsafe(`DELETE FROM "CuocDailyResult"`);
            if (hasCuocCdDailyResults) await tx.$executeRawUnsafe(`DELETE FROM "CuocCdDailyResult"`);
            if (hasCuocCdConfigs) await tx.$executeRawUnsafe(`DELETE FROM "CuocCdConfig"`);
            if (hasManagerKpiDailyResults) await tx.$executeRawUnsafe(`DELETE FROM "ManagerKpiDailyResult"`);
            if (hasKpiDailyResults) await tx.$executeRawUnsafe(`DELETE FROM "KpiDailyResult"`);
            if (hasKpiMetricConfigs) await tx.$executeRawUnsafe(`DELETE FROM "KpiMetricConfig"`);
            if (hasCuocConfigs) await tx.$executeRawUnsafe(`DELETE FROM "CuocConfig"`);
            if (hasNode0TbRecords) await tx.$executeRawUnsafe(`DELETE FROM "Node0Tb"`);

            await tx.customerNote.deleteMany({});
            await tx.editHistory.deleteMany({});
            await tx.customer.deleteMany({});
            await tx.node.deleteMany({});
            await tx.user.deleteMany({});

            await tx.user.createMany({
                data: userPreparation.preparedUsers,
            });

            if (customerPreparation.preparedCustomers.length > 0) {
                await tx.customer.createMany({
                    data: customerPreparation.preparedCustomers,
                });
            }

            if (nodePreparation.baseNodes.length > 0) {
                await tx.node.createMany({
                    data: nodePreparation.baseNodes,
                });

                const batchSize = 120;
                for (let index = 0; index < nodePreparation.extraNodes.length; index += batchSize) {
                    const chunk = nodePreparation.extraNodes.slice(index, index + batchSize);
                    const valuesSql = chunk.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
                    const params = chunk.flatMap((node) => [
                        node.id,
                        node.totalIntPort,
                        node.usedPort,
                        node.portEfficiency,
                        node.dateKdIso,
                        node.efficiencyStatus,
                    ]);

                    await tx.$executeRawUnsafe(
                        `
                            WITH data("id","totalIntPort","usedPort","portEfficiency","dateKd","efficiencyStatus") AS (
                                VALUES ${valuesSql}
                            )
                            UPDATE "Node"
                            SET
                                "totalIntPort" = (SELECT "totalIntPort" FROM data WHERE data."id" = "Node"."id"),
                                "usedPort" = (SELECT "usedPort" FROM data WHERE data."id" = "Node"."id"),
                                "portEfficiency" = (SELECT "portEfficiency" FROM data WHERE data."id" = "Node"."id"),
                                "dateKd" = (SELECT "dateKd" FROM data WHERE data."id" = "Node"."id"),
                                "efficiencyStatus" = (SELECT "efficiencyStatus" FROM data WHERE data."id" = "Node"."id"),
                                "updatedAt" = "updatedAt"
                            WHERE "id" IN (SELECT "id" FROM data)
                        `,
                        ...params
                    );
                }
            }

            if (editHistoryPreparation.preparedEditHistory.length > 0) {
                await tx.editHistory.createMany({
                    data: editHistoryPreparation.preparedEditHistory,
                });
            }

            if (customerNotePreparation.preparedCustomerNotes.length > 0) {
                await tx.customerNote.createMany({
                    data: customerNotePreparation.preparedCustomerNotes,
                });
            }

            if (hasKpiMetricConfigs) {
                await insertRawRows(
                    tx,
                    "KpiMetricConfig",
                    [
                        "id",
                        "kpiCode",
                        "kpiName",
                        "displayName",
                        "mergeGroup",
                        "baseScore",
                        "maxPercent",
                        "sortOrder",
                        "isEnabled",
                        "isNegative",
                        "createdAt",
                        "updatedAt",
                    ],
                    kpiMetricConfigPreparation.preparedRows
                );
            }

            if (hasKpiDailyResults) {
                await insertRawRows(
                    tx,
                    "KpiDailyResult",
                    [
                        "id",
                        "reportDate",
                        "ctvUser",
                        "kpiCode",
                        "kpiName",
                        "khThang",
                        "thNgay",
                        "thLuyKe",
                        "completionPercent",
                        "growthPercent",
                        "rawPayload",
                        "createdAt",
                    ],
                    kpiDailyResultPreparation.preparedRows
                );
            }

            if (hasManagerKpiDailyResults) {
                await insertRawRows(
                    tx,
                    "ManagerKpiDailyResult",
                    [
                        "id",
                        "reportDate",
                        "managerUser",
                        "managerName",
                        "jobTitle",
                        "metricCode",
                        "metricName",
                        "metricLabel",
                        "khToDate",
                        "khMonth",
                        "thDay",
                        "thLuyKe",
                        "percentToDate",
                        "percentMonth",
                        "samePeriodValue",
                        "growthPercent",
                        "rawPayload",
                        "createdAt",
                    ],
                    managerKpiDailyResultPreparation.preparedRows
                );
            }

            if (hasCuocDailyResults) {
                await insertRawRows(
                    tx,
                    "CuocDailyResult",
                    [
                        "id",
                        "reportDate",
                        "ctvUser",
                        "employeeCodeRaw",
                        "managerCodeRaw",
                        "targetAmount",
                        "collectedAmount",
                        "completionPercent",
                        "missingAmount",
                        "createdAt",
                    ],
                    cuocDailyResultPreparation.preparedRows
                );
            }

            if (hasCdtTransactions) {
                await insertRawRows(
                    tx,
                    "CdtTransaction",
                    [
                        "id",
                        "transactionDate",
                        "transactionTime",
                        "ctvUser",
                        "subscriberType",
                        "account",
                        "amount",
                        "months",
                        "sourceFile",
                        "createdAt",
                    ],
                    cdtTransactionPreparation.preparedRows
                );
            }

            if (hasCdtOutstandingRecords) {
                await insertRawRows(
                    tx,
                    "CdtOutstandingRecord",
                    [
                        "id",
                        "reportMonth",
                        "account",
                        "customerName",
                        "phone",
                        "address",
                        "ctvCode",
                        "serviceName",
                        "expiryDateText",
                        "expiryMonth",
                        "statusCheck",
                        "subscriberType",
                        "sourceFile",
                        "createdAt",
                        "updatedAt",
                    ],
                    cdtOutstandingPreparation.preparedRows
                );
            }

            if (hasDisconnectRecords) {
                await insertRawRows(
                    tx,
                    "DisconnectRecord",
                    [
                        "id",
                        "reportMonth",
                        "sourceType",
                        "account",
                        "serviceName",
                        "ctvCode",
                        "suspendedDateIso",
                        "suspendedDateText",
                        "cancelDateIso",
                        "cancelDateText",
                        "cancelMonth",
                        "sourceFile",
                        "createdAt",
                        "updatedAt",
                    ],
                    disconnectPreparation.preparedRows
                );
            }

            if (hasArchiveLogs) {
                await insertRawRows(
                    tx,
                    "ArchiveLog",
                    [
                        "id",
                        "archiveMonth",
                        "archivedBy",
                        "archivedAt",
                        "purgeAfter",
                        "purgedAt",
                        "kpiRecordCount",
                        "cuocRecordCount",
                        "fileName",
                    ],
                    archiveLogPreparation.preparedRows
                );
            }

            if (hasArchiveExportLogs) {
                await insertRawRows(
                    tx,
                    "ArchiveExportLog",
                    ["id", "archiveMonth", "exportedBy", "exportedAt", "fileName"],
                    archiveExportLogPreparation.preparedRows
                );
            }

            if (hasCuocConfigs) {
                await insertRawRows(
                    tx,
                    "CuocConfig",
                    ["id", "targetRatePercent", "updatedAt"],
                    cuocConfigPreparation.preparedRows
                );
            }

            if (hasOfficialDocuments) {
                await insertRawRows(
                    tx,
                    "OfficialDocument",
                    [
                        "id",
                        "title",
                        "category",
                        "summary",
                        "content",
                        "status",
                        "publishedAt",
                        "expiresAt",
                        "isPinned",
                        "createdBy",
                        "createdAt",
                        "updatedAt",
                    ],
                    officialDocumentPreparation.preparedRows
                );
            }

            if (hasOfficialDocumentAssets) {
                await insertRawRows(
                    tx,
                    "OfficialDocumentAsset",
                    ["id", "documentId", "type", "fileUrl", "fileName", "mimeType", "size", "storageKind", "fileData", "createdAt"],
                    officialDocumentAssetPreparation.preparedRows
                );
            }

            if (hasOfficialDocumentRevisions) {
                await insertRawRows(
                    tx,
                    "OfficialDocumentRevision",
                    ["id", "documentId", "changeType", "changedBy", "changedAt", "title", "summary", "content", "status", "category", "isPinned"],
                    officialDocumentRevisionPreparation.preparedRows
                );
            }

            if (hasCustomerNodeMappings) {
                await insertRawRows(
                    tx,
                    "CustomerNodeMapping",
                    ["id", "account", "accountKey", "nodeName", "accountAddress", "createdAt", "updatedAt"],
                    customerNodeMappingPreparation.preparedRows
                );
            }

            if (hasCuocCdDailyResults) {
                await insertRawRows(
                    tx,
                    "CuocCdDailyResult",
                    ["id", "reportDate", "ctvUser", "employeeCodeRaw", "managerCodeRaw", "dauKy", "luyKe", "thuaThieu", "tonChuaThu", "createdAt"],
                    cuocCdDailyResultPreparation.preparedRows
                );
            }

            if (hasCuocCdConfigs) {
                await insertRawRows(
                    tx,
                    "CuocCdConfig",
                    ["id", "targetRatePercent", "updatedAt"],
                    cuocCdConfigPreparation.preparedRows
                );
            }

            if (hasChurnRiskRecords) {
                await insertRawRows(
                    tx,
                    "ChurnRiskRecord",
                    ["id", "reportMonth", "ctvCode", "customerName", "phone", "packageName", "address", "sourceFile", "createdAt", "updatedAt"],
                    churnRiskPreparation.preparedRows
                );
            }

            if (hasNode0TbRecords) {
                await insertRawRows(
                    tx,
                    "Node0Tb",
                    ["id", "nodeCode", "dateKd", "dateKdRaw", "dateKdFormatted", "totalPort", "usedPort", "categoryKd", "note", "createdAt", "updatedAt"],
                    node0TbPreparation.preparedRows
                );
            }
        });

        clearRestoreCaches();

        return NextResponse.json({
            success: true,
            message: "Khôi phục dữ liệu thành công",
            restored: {
                users: userPreparation.preparedUsers.length,
                customers: customerPreparation.preparedCustomers.length,
                nodes: nodePreparation.baseNodes.length,
                editHistory: editHistoryPreparation.preparedEditHistory.length,
                customerNotes: customerNotePreparation.preparedCustomerNotes.length,
                kpiMetricConfigs: kpiMetricConfigPreparation.preparedRows.length,
                kpiDailyResults: kpiDailyResultPreparation.preparedRows.length,
                managerKpiDailyResults: managerKpiDailyResultPreparation.preparedRows.length,
                cuocDailyResults: cuocDailyResultPreparation.preparedRows.length,
                cuocCdDailyResults: cuocCdDailyResultPreparation.preparedRows.length,
                cuocCdConfigs: cuocCdConfigPreparation.preparedRows.length,
                cdtTransactions: cdtTransactionPreparation.preparedRows.length,
                cdtOutstandingRecords: cdtOutstandingPreparation.preparedRows.length,
                disconnectRecords: disconnectPreparation.preparedRows.length,
                churnRiskRecords: churnRiskPreparation.preparedRows.length,
                archiveLogs: archiveLogPreparation.preparedRows.length,
                archiveExportLogs: archiveExportLogPreparation.preparedRows.length,
                cuocConfigs: cuocConfigPreparation.preparedRows.length,
                officialDocuments: officialDocumentPreparation.preparedRows.length,
                officialDocumentAssets: officialDocumentAssetPreparation.preparedRows.length,
                officialDocumentRevisions: officialDocumentRevisionPreparation.preparedRows.length,
                customerNodeMappings: customerNodeMappingPreparation.preparedRows.length,
                node0TbRecords: node0TbPreparation.preparedRows.length,
            },
        });
    } catch (error) {
        console.error("BACKUP_POST_ERROR", error);
        return NextResponse.json({ error: "Lỗi máy chủ nội bộ" }, { status: 500 });
    }
}
