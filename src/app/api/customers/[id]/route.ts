export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { findNearestNodeName } from "@/lib/nodeUtils";
import { getMappedNodeNameForAccount } from "@/lib/customer-node-mapping";
import { canAccessCustomerByCtvCode, getAccessibleCtvCodes } from "@/lib/scope";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { calculateCustomerExpirationDate, parseCustomerDateInput } from "@/lib/customer-date-input";
import { customerUpdateSchema } from "@/lib/validations/customer.schema";
import { requireAuth } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit";
import { ensureCustomerSchema } from "@/lib/ensure-customer-schema";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const customer = await prisma.customer.findUnique({
            where: { id },
            include: {
                edits: {
                    include: { user: { select: { username: true } } },
                    orderBy: { createdAt: "desc" }
                }
            }
        });

        if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const canAccess = await canAccessCustomerByCtvCode(session, customer.ctvCode);
        if (!canAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await ensureCustomerSchema();

        const mappedNodeName = await getMappedNodeNameForAccount(customer.account);
        return NextResponse.json(mappedNodeName ? { ...customer, nodeName: mappedNodeName } : customer);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const rawBody = await request.json();
        const parseResult = customerUpdateSchema.safeParse(rawBody);
        if (!parseResult.success) {
            const errorDetails = parseResult.error.issues.map((e) => e.message).join(", ");
            return NextResponse.json({ error: errorDetails }, { status: 422 });
        }
        const body = parseResult.data;

        const existingCustomer = await prisma.customer.findUnique({ where: { id } });
        if (!existingCustomer) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const canAccess = await canAccessCustomerByCtvCode(session, existingCustomer.ctvCode);
        if (!canAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (session.user.role === "MANAGER" && body.ctvCode !== undefined) {
            const accessibleCtvCodes = await getAccessibleCtvCodes(session);
            if (!body.ctvCode || !accessibleCtvCodes?.includes(body.ctvCode)) {
                return NextResponse.json({ error: "Bạn không có quyền chuyển khách cho CTV này." }, { status: 403 });
            }
        }

        const safeNumber = (val: any, isFloat: boolean) => {
            if (val === null || val === undefined || String(val).trim() === "") return null;
            const parsed = isFloat ? parseFloat(String(val)) : parseInt(String(val), 10);
            return isNaN(parsed) ? null : parsed;
        };

        const prepaidPeriod = body.prepaidPeriod !== undefined ? safeNumber(body.prepaidPeriod, false) : undefined;
        let renewalMonth =
            body.renewalMonth !== undefined ? parseCustomerDateInput(body.renewalMonth) : undefined;
        let expirationDate =
            body.expirationDate !== undefined ? parseCustomerDateInput(body.expirationDate) : undefined;

        if (body.billingType === "MONTHLY") {
            body.prepaidPeriod = null;
            renewalMonth = null;
            expirationDate = null;
        } else if (renewalMonth && prepaidPeriod) {
            expirationDate = calculateCustomerExpirationDate(
                renewalMonth,
                prepaidPeriod,
                body.subscriberType !== undefined ? body.subscriberType : existingCustomer.subscriberType,
            );
        } else if (body.renewalMonth !== undefined && renewalMonth === null) {
            expirationDate = null;
        }

        const safeLat = body.latitude !== undefined ? safeNumber(body.latitude, true) : undefined;
        const safeLng = body.longitude !== undefined ? safeNumber(body.longitude, true) : undefined;

        if (session.user.role === "CTV" && (safeLat !== undefined || safeLng !== undefined)) {
            const userRecord = await prisma.user.findUnique({
                where: { username: session.user.name || "" },
                select: { canUseGps: true },
            });
            if (userRecord && userRecord.canUseGps === false) {
                return NextResponse.json(
                    { error: "Tài khoản của bạn không có quyền cập nhật tọa độ GPS" },
                    { status: 403 }
                );
            }
        }

        await ensureCustomerSchema();

        const nextAccount = body.account !== undefined ? body.account : existingCustomer.account;
        const finalLat = safeLat !== undefined ? safeLat : existingCustomer.latitude;
        const finalLng = safeLng !== undefined ? safeLng : existingCustomer.longitude;
        const mappedNodeName = await getMappedNodeNameForAccount(nextAccount);
        let nodeNameToAssign = body.nodeName !== undefined ? (body.nodeName === "" ? null : body.nodeName) : undefined;

        if (body.nodeName !== undefined) {
            if (!nodeNameToAssign) {
                if (mappedNodeName) {
                    nodeNameToAssign = mappedNodeName;
                } else if (finalLat !== null && finalLng !== null) {
                    const nearestNodeName = await findNearestNodeName(finalLat, finalLng);
                    if (nearestNodeName) {
                        nodeNameToAssign = nearestNodeName;
                    }
                }
            }
        } else if (mappedNodeName) {
            nodeNameToAssign = mappedNodeName;
        } else if (safeLat !== undefined || safeLng !== undefined) {
            if (finalLat !== null && finalLng !== null) {
                const nearestNodeName = await findNearestNodeName(finalLat, finalLng);
                if (nearestNodeName) {
                    nodeNameToAssign = nearestNodeName;
                }
            }
        }

        const updatedCustomer = await prisma.customer.update({
            where: { id },
            data: {
                name: body.name !== undefined ? body.name : undefined,
                account: body.account !== undefined ? body.account : undefined,
                subscriberType: body.subscriberType !== undefined ? body.subscriberType : undefined,
                phone: body.phone !== undefined ? body.phone : undefined,
                package: body.package !== undefined ? body.package : undefined,
                price: body.price !== undefined ? safeNumber(body.price, true) : undefined,
                address: body.address !== undefined ? body.address : undefined,
                nodeName: nodeNameToAssign,
                latitude: safeLat,
                longitude: safeLng,
                ctvCode: body.ctvCode !== undefined ? body.ctvCode : undefined,
                billingType: body.billingType !== undefined ? body.billingType : undefined,
                status: body.status !== undefined ? body.status : undefined,
                prepaidPeriod,
                renewalMonth,
                expirationDate,
            },
        });

        // Calculate the diff
        const diff: Record<string, { old: any, new: any }> = {};
        const keysToCheck = ["name", "account", "subscriberType", "phone", "package", "price", "address", "nodeName", "latitude", "longitude", "ctvCode", "billingType", "status", "prepaidPeriod", "renewalMonth", "expirationDate"];

        for (const key of keysToCheck) {
            let oldVal = (existingCustomer as any)[key];
            let newVal = (updatedCustomer as any)[key];

            // Normalize Dates for comparison
            if (oldVal instanceof Date) oldVal = oldVal.toISOString();
            if (newVal instanceof Date) newVal = newVal.toISOString();

            if (oldVal !== newVal) {
                diff[key] = { old: oldVal, new: newVal };
            }
        }

        if (session.user.id && Object.keys(diff).length > 0) {
            await prisma.editHistory.create({
                data: {
                    customerId: updatedCustomer.id,
                    userId: session.user.id,
                    details: JSON.stringify({ action: "UPDATE", changes: diff }),
                }
            });
        }
        clearCacheByPrefix("customers:list");
        clearCacheByPrefix("customers:search-map");
        clearCacheByPrefix("map:data");
        clearCacheByPrefix("map:detail");

        return NextResponse.json(updatedCustomer);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = await requireAuth({ roles: ["ADMIN"] });
        if (authResult.errorResponse) return authResult.errorResponse;

        const existingCustomer = await prisma.customer.findUnique({
            where: { id },
            select: { id: true, name: true, account: true, ctvCode: true, phone: true }
        });
        if (!existingCustomer) return NextResponse.json({ error: "Không tìm thấy khách hàng" }, { status: 404 });

        await prisma.customer.delete({ where: { id } });

        clearCacheByPrefix("customers:list");
        clearCacheByPrefix("customers:search-map");
        clearCacheByPrefix("map:data");
        clearCacheByPrefix("map:detail");

        await recordAuditLog({
            userId: authResult.user.id,
            username: authResult.user.username,
            action: "CUSTOMER_DELETE",
            resource: "Customer",
            details: {
                deletedCustomerId: existingCustomer.id,
                name: existingCustomer.name,
                account: existingCustomer.account,
                ctvCode: existingCustomer.ctvCode,
                phone: existingCustomer.phone,
            },
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        });

        return NextResponse.json({ success: true, message: `Đã xóa khách hàng ${existingCustomer.name}` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Lỗi xóa khách hàng" }, { status: 500 });
    }
}
