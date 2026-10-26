export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import {
    getMappedNodeNamesByAccounts,
    normalizeCustomerAccountKey,
} from "@/lib/customer-node-mapping";
import {
    buildImportErrorCsv,
    createRowLookup,
    normalizeImportText,
    parseImportDate,
    parseImportNumber,
    toTrimmedString,
} from "@/lib/import-utils";

type CustomerPayload = {
    name: string;
    account: string;
    nodeName: string;
    subscriberType: "FIXED" | "MOBILE";
    phone: string;
    package: string;
    price: number;
    status: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    ctvCode: string;
    billingType: "PREPAID" | "MONTHLY";
    prepaidPeriod: number;
    renewalMonth: Date | null;
    expirationDate: Date | null;
};

type ExistingCustomerRow = {
    id: string;
    account: string | null;
    name: string;
    nodeName: string | null;
    subscriberType: string;
    phone: string | null;
    package: string | null;
    price: number | null;
    status: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    ctvCode: string | null;
    billingType: string | null;
    prepaidPeriod: number | null;
    renewalMonth: Date | null;
    expirationDate: Date | null;
};

const DEFAULT_STATUS = "Hoạt động";

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const earthRadiusKm = 6371;
    const deltaLat = (lat2 - lat1) * (Math.PI / 180);
    const deltaLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(deltaLon / 2) *
            Math.sin(deltaLon / 2);

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inferSubscriberType(rawValue: unknown): "FIXED" | "MOBILE" {
    const normalized = normalizeImportText(rawValue);
    return normalized === "co dinh" || normalized === "fixed" ? "FIXED" : "MOBILE";
}

function inferBillingType(rawValue: unknown): "PREPAID" | "MONTHLY" {
    const normalized = normalizeImportText(rawValue);
    return normalized === "dong truoc" || normalized === "prepaid" ? "PREPAID" : "MONTHLY";
}

function normalizeDateValue(value: Date | string | null | undefined) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function isSameNullableNumber(left: number | null, right: number | null) {
    if (left === null && right === null) return true;
    if (left === null || right === null) return false;
    return Number(left) === Number(right);
}

function isSameCustomerPayload(existing: ExistingCustomerRow, incoming: CustomerPayload) {
    return (
        toTrimmedString(existing.name) === incoming.name &&
        toTrimmedString(existing.account) === incoming.account &&
        toTrimmedString(existing.nodeName) === incoming.nodeName &&
        existing.subscriberType === incoming.subscriberType &&
        toTrimmedString(existing.phone) === incoming.phone &&
        toTrimmedString(existing.package) === incoming.package &&
        Number(existing.price || 0) === Number(incoming.price || 0) &&
        toTrimmedString(existing.status) === incoming.status &&
        toTrimmedString(existing.address) === incoming.address &&
        isSameNullableNumber(existing.latitude, incoming.latitude) &&
        isSameNullableNumber(existing.longitude, incoming.longitude) &&
        toTrimmedString(existing.ctvCode) === incoming.ctvCode &&
        existing.billingType === incoming.billingType &&
        Number(existing.prepaidPeriod || 0) === Number(incoming.prepaidPeriod || 0) &&
        normalizeDateValue(existing.renewalMonth) === normalizeDateValue(incoming.renewalMonth) &&
        normalizeDateValue(existing.expirationDate) === normalizeDateValue(incoming.expirationDate)
    );
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Vui lòng chọn file để tải lên" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = xlsx.read(buffer, { type: "buffer", dense: true });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
        const jsonData = sheet ? (xlsx.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[]) : [];

        if (!jsonData.length) {
            return NextResponse.json({ error: "File rỗng hoặc không hợp lệ" }, { status: 400 });
        }

        const errors: string[] = [];
        const seenAccounts = new Set<string>();
        const validCustomersToCreate: CustomerPayload[] = [];
        const validCustomersToUpdate: Array<CustomerPayload & { id: string }> = [];

        const [validCtvs, accessibleCtvCodes] = await Promise.all([
            prisma.user.findMany({
                where: { role: "CTV" },
                select: { username: true },
            }),
            getAccessibleCtvCodes(session),
        ]);

        const validCtvSet = new Set(validCtvs.map((user) => user.username));

        const allAccountsInFile = jsonData
            .map((row) => createRowLookup(row)("Account"))
            .map((value) => toTrimmedString(value))
            .filter(Boolean);

        const existingCustomers: ExistingCustomerRow[] = allAccountsInFile.length
            ? await prisma.customer.findMany({
                  where: { account: { in: allAccountsInFile } },
                  select: {
                      id: true,
                      account: true,
                      name: true,
                      nodeName: true,
                      subscriberType: true,
                      phone: true,
                      package: true,
                      price: true,
                      status: true,
                      address: true,
                      latitude: true,
                      longitude: true,
                      ctvCode: true,
                      billingType: true,
                      prepaidPeriod: true,
                      renewalMonth: true,
                      expirationDate: true,
                  },
              })
            : [];

        const existingAccountMap = new Map(
            existingCustomers
                .filter((customer): customer is ExistingCustomerRow & { account: string } => Boolean(customer.account))
                .map((customer) => [customer.account, customer])
        );

        const mappedNodeNames = await getMappedNodeNamesByAccounts(allAccountsInFile);
        const nearestNodeCache = new Map<string, string>();
        let allNodesPromise: Promise<Array<{ name: string; latitude: number; longitude: number }>> | null = null;
        const loadAllNodes = async () => {
            if (!allNodesPromise) {
                allNodesPromise = prisma.node.findMany({
                    select: {
                        name: true,
                        latitude: true,
                        longitude: true,
                    },
                });
            }
            return allNodesPromise;
        };
        const resolveNearestNodeName = async (latitude: number, longitude: number) => {
            const allNodes = await loadAllNodes();
            if (!allNodes.length) return "";

            let nearestNodeName = "";
            let minDistance = Number.POSITIVE_INFINITY;

            for (const node of allNodes) {
                const distance = getDistance(latitude, longitude, node.latitude, node.longitude);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestNodeName = node.name;
                }
            }

            return nearestNodeName;
        };

        for (const [index, row] of jsonData.entries()) {
            const getValue = createRowLookup(row);

            try {
                const account = toTrimmedString(getValue("Account"));
                if (!account) {
                    throw new Error("Thiếu Account, đây là trường bắt buộc.");
                }

                const name =
                    toTrimmedString(getValue("Tên khách hàng", "Name")) || "Khách hàng không tên";
                let nodeName = toTrimmedString(getValue("Node"));
                const subscriberType = inferSubscriberType(getValue("Loại Thuê Bao", "Loai Thue Bao"));
                const phone = toTrimmedString(getValue("Số điện thoại", "So dien thoai", "Phone"));
                const pkg = toTrimmedString(getValue("Gói cước", "Goi cuoc", "Package"));
                const price = parseImportNumber(getValue("Giá tiền", "Gia tien", "Price")) ?? 0;
                const status =
                    toTrimmedString(getValue("Trạng thái", "Trang thai", "Status")) || DEFAULT_STATUS;
                const address = toTrimmedString(getValue("Địa chỉ", "Dia chi", "Address"));
                const latitude = parseImportNumber(getValue("Latitude"));
                const longitude = parseImportNumber(getValue("Longitude"));
                let ctvCode = toTrimmedString(getValue("Mã CTV", "Ma CTV", "CTV"));
                const billingType = inferBillingType(getValue("Loại cước", "Loai cuoc", "Billing Type"));

                let prepaidPeriod = Number.parseInt(
                    toTrimmedString(getValue("Kỳ đóng trước", "Ky dong truoc", "Prepaid Period")),
                    10
                );
                if (Number.isNaN(prepaidPeriod)) {
                    const periodText = toTrimmedString(
                        getValue("Kỳ đóng trước", "Ky dong truoc", "Prepaid Period")
                    );
                    const match = periodText.match(/(\d+)/);
                    prepaidPeriod = match ? Number.parseInt(match[1], 10) : 0;
                }
                if (Number.isNaN(prepaidPeriod)) prepaidPeriod = 0;

                const renewalMonth = parseImportDate(
                    getValue("Tháng gia hạn cước", "Thang gia han cuoc", "Renewal Month")
                );
                let expirationDate = parseImportDate(
                    getValue("Ngày hết hạn", "Ngay het han", "Expiration Date")
                );

                if (!nodeName) {
                    nodeName = mappedNodeNames.get(normalizeCustomerAccountKey(account)) || "";
                }

                if (!nodeName && latitude !== null && longitude !== null) {
                    const cacheKey = `${latitude}:${longitude}`;
                    if (!nearestNodeCache.has(cacheKey)) {
                        nearestNodeCache.set(cacheKey, await resolveNearestNodeName(latitude, longitude));
                    }
                    nodeName = nearestNodeCache.get(cacheKey) || "";
                }

                if (session.user.role === "CTV") {
                    ctvCode = session.user.name || "";
                } else if (session.user.role === "MANAGER") {
                    if (!ctvCode || !accessibleCtvCodes?.includes(ctvCode)) {
                        throw new Error(
                            `CTV "${ctvCode || "(trống)"}" không thuộc phạm vi quản lý của bạn.`
                        );
                    }
                } else if (ctvCode && !validCtvSet.has(ctvCode)) {
                    throw new Error(
                        `Mã CTV "${ctvCode}" không hợp lệ hoặc không tồn tại. Vui lòng kiểm tra lại.`
                    );
                }

                if (!expirationDate && renewalMonth && prepaidPeriod) {
                    expirationDate = new Date(renewalMonth);
                    let addMonths = prepaidPeriod;

                    if (subscriberType === "FIXED" && addMonths === 12) {
                        addMonths += 1;
                    }

                    expirationDate.setMonth(expirationDate.getMonth() + addMonths);
                }

                if (seenAccounts.has(account)) {
                    throw new Error(`Account "${account}" bị trùng lặp nhiều lần trong file đang tải lên.`);
                }
                seenAccounts.add(account);

                const customerData: CustomerPayload = {
                    name,
                    account,
                    nodeName,
                    subscriberType,
                    phone,
                    package: pkg,
                    price,
                    status,
                    address,
                    latitude,
                    longitude,
                    ctvCode,
                    billingType,
                    prepaidPeriod,
                    renewalMonth,
                    expirationDate,
                };

                const existingCustomer = existingAccountMap.get(account);
                if (existingCustomer) {
                    if (isSameCustomerPayload(existingCustomer, customerData)) {
                        continue;
                    }
                    validCustomersToUpdate.push({
                        id: existingCustomer.id,
                        ...customerData,
                    });
                } else {
                    validCustomersToCreate.push(customerData);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "Lỗi không xác định";
                errors.push(`Dòng ${index + 2}: ${message}`);
            }
        }

        let addedCount = 0;
        let updatedCount = 0;

        if (validCustomersToCreate.length || validCustomersToUpdate.length) {
            await prisma.$transaction(
                async (tx) => {
                    if (validCustomersToCreate.length) {
                        await tx.customer.createMany({ data: validCustomersToCreate });
                        addedCount = validCustomersToCreate.length;
                    }

                    if (validCustomersToUpdate.length) {
                        const chunkSize = 50;
                        for (let index = 0; index < validCustomersToUpdate.length; index += chunkSize) {
                            const chunk = validCustomersToUpdate.slice(index, index + chunkSize);
                            await Promise.all(
                                chunk.map((updateData) => {
                                    const { id, ...data } = updateData;
                                    return tx.customer.update({
                                        where: { id },
                                        data,
                                    });
                                })
                            );
                        }
                        updatedCount = validCustomersToUpdate.length;
                    }
                },
                { timeout: 30000 }
            );
        }

        clearCacheByPrefix("customers:list");
        clearCacheByPrefix("customers:search-map");
        clearCacheByPrefix("map:data");
        clearCacheByPrefix("map:detail");

        return NextResponse.json({
            message: "Import hoàn tất.",
            added: addedCount,
            updated: updatedCount,
            errors: errors.length ? errors : undefined,
            errorCsv: buildImportErrorCsv(errors),
        });
    } catch (error) {
        console.error("IMPORT ERROR", error);
        return NextResponse.json({ error: "Lỗi máy chủ nội bộ" }, { status: 500 });
    }
}
