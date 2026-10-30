export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { findNearestNodeName } from "@/lib/nodeUtils";
import { getMappedNodeNameForAccount, getMappedNodeNamesByAccounts, normalizeCustomerAccountKey } from "@/lib/customer-node-mapping";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { clearCacheByPrefix, getCache, getCacheGeneration, setCache } from "@/lib/kpi-cache";
import { calculateCustomerExpirationDate, parseCustomerDateInput } from "@/lib/customer-date-input";
import { customerInputSchema } from "@/lib/validations/customer.schema";
import { ensureCustomerSchema } from "@/lib/ensure-customer-schema";

function parsePositiveInt(value: string | null, fallback: number, max: number) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.floor(parsed), max);
}

export async function GET(request: Request) {
    const cacheGeneration = getCacheGeneration();
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const page = parsePositiveInt(searchParams.get("page"), 1, 10_000);
        const limit = parsePositiveInt(searchParams.get("limit"), 10, 100);
        const search = searchParams.get("search") || "";
        const subscriberType = searchParams.get("subscriberType");
        const billingType = searchParams.get("billingType");
        const prepaidPeriod = searchParams.get("prepaidPeriod");
        const expirationFilter = searchParams.get("expirationFilter"); // "soon" | "expired" | null
        const statusFilter = searchParams.get("status");
        const ctvCodeFilter = searchParams.get("ctvCode");
        const hasCoordinates = searchParams.get("hasCoordinates"); // "true" or null
        const includeTotal = searchParams.get("includeTotal") !== "false";

        const skip = (page - 1) * limit;
        const cacheKey = [
            "customers:list",
            session.user.role || "",
            session.user.name || "",
            searchParams.toString(),
        ].join("|");
        const cached = getCache<any>(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        const where: any = {};

        const accessibleCtvCodes = await getAccessibleCtvCodes(session);
        if (accessibleCtvCodes !== null) {
            where.ctvCode = { in: accessibleCtvCodes };
        } else if (ctvCodeFilter) {
            where.ctvCode = { contains: ctvCodeFilter };
        }

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { phone: { contains: search } },
                { account: { contains: search } },
                { ctvCode: { contains: search } },
            ];
        }
        if (subscriberType) where.subscriberType = subscriberType;
        if (billingType) where.billingType = billingType;
        if (prepaidPeriod) where.prepaidPeriod = parseInt(prepaidPeriod);
        if (statusFilter) where.status = statusFilter;

        if (hasCoordinates === "true") {
            where.latitude = { not: null };
            where.longitude = { not: null };
        }

        const today = new Date();
        const in7Days = new Date();
        in7Days.setDate(today.getDate() + 7);

        if (expirationFilter === "soon") {
            where.expirationDate = {
                gte: today,
                lte: in7Days,
            };
        } else if (expirationFilter === "expired") {
            where.expirationDate = {
                lt: today,
            };
        } else if (expirationFilter === "expiringThisMonth") {
            const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            lastDayPrevMonth.setHours(0, 0, 0, 0);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            where.expirationDate = {
                gte: lastDayPrevMonth,
                lte: endOfMonth,
            };
        }

        await ensureCustomerSchema();

        const rows = await prisma.customer.findMany({
            where,
            skip,
            take: includeTotal ? limit + 1 : limit,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                account: true,
                subscriberType: true,
                phone: true,
                package: true,
                price: true,
                address: true,
                nodeName: true,
                latitude: true,
                longitude: true,
                ctvCode: true,
                billingType: true,
                prepaidPeriod: true,
                renewalMonth: true,
                expirationDate: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        const hasExtraRow = includeTotal && rows.length > limit;
        const data = hasExtraRow ? rows.slice(0, limit) : rows;
        const total =
            includeTotal
                ? hasExtraRow
                    ? await prisma.customer.count({ where })
                    : skip + data.length
                : 0;
        const mappedNodeNames = await getMappedNodeNamesByAccounts(data.map((customer) => customer.account));
        const dataWithResolvedNode = data.map((customer) => {
            const mappedNodeName = mappedNodeNames.get(normalizeCustomerAccountKey(customer.account));
            return mappedNodeName ? { ...customer, nodeName: mappedNodeName } : customer;
        });

        const payload = {
            data: dataWithResolvedNode,
            total,
            page,
            totalPages: includeTotal ? Math.ceil(total / limit) : undefined,
            hasMore: includeTotal ? undefined : dataWithResolvedNode.length === limit,
        };
        setCache(cacheKey, payload, 15_000, cacheGeneration);
        return NextResponse.json(payload);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const rawBody = await request.json();
        const parseResult = customerInputSchema.safeParse(rawBody);
        if (!parseResult.success) {
            const errorDetails = parseResult.error.issues.map((e) => e.message).join(", ");
            return NextResponse.json({ error: errorDetails }, { status: 422 });
        }
        const body = parseResult.data;

        if (body.account && body.account.trim() !== "") {
            const existingCustomer = await prisma.customer.findFirst({
                where: { account: body.account.trim() }
            });
            if (existingCustomer) {
                return NextResponse.json({ error: `Account '${body.account}' đã tồn tại trong hệ thống.` }, { status: 400 });
            }
        }

        const accessibleCtvCodes = await getAccessibleCtvCodes(session);

        // Assign CTV Code automatically if user is CTV
        if (session.user.role === "CTV" && !body.ctvCode) {
            body.ctvCode = session.user.name;
        }
        if (session.user.role === "MANAGER") {
            if (!body.ctvCode) {
                body.ctvCode = session.user.name || null;
            } else if (accessibleCtvCodes !== null && !accessibleCtvCodes.includes(body.ctvCode)) {
                return NextResponse.json({ error: "Bạn không có quyền gán khách cho CTV này." }, { status: 403 });
            }
        }

        await ensureCustomerSchema();

        const safeNumber = (val: any, isFloat: boolean) => {
            if (val === null || val === undefined || String(val).trim() === "") return null;
            const str = String(val).trim().replace(",", ".");
            const parsed = isFloat ? parseFloat(str) : parseInt(str, 10);
            return isNaN(parsed) ? null : parsed;
        };

        const prepaidPeriod = safeNumber(body.prepaidPeriod, false);
        const renewalMonth = parseCustomerDateInput(body.renewalMonth);
        let expirationDate = parseCustomerDateInput(body.expirationDate);

        if (body.billingType === "MONTHLY") {
            body.prepaidPeriod = null;
            expirationDate = null;
        } else if (renewalMonth && prepaidPeriod) {
            expirationDate = calculateCustomerExpirationDate(
                renewalMonth,
                prepaidPeriod,
                body.subscriberType || "FIXED",
            );
        }

        const safeLat = safeNumber(body.latitude, true);
        const safeLng = safeNumber(body.longitude, true);

        let nodeNameToAssign = body.nodeName === "" ? null : body.nodeName;

        if (!nodeNameToAssign) {
            try {
                const mappedNodeName = await getMappedNodeNameForAccount(body.account);
                if (mappedNodeName) {
                    nodeNameToAssign = mappedNodeName;
                } else if (safeLat !== null && safeLng !== null) {
                    const nearestNodeName = await findNearestNodeName(safeLat, safeLng);
                    if (nearestNodeName) {
                        nodeNameToAssign = nearestNodeName;
                    }
                }
            } catch (nodeErr) {
                console.error("Auto-assign nearest node error:", nodeErr);
            }
        }

        const customer = await prisma.customer.create({
            data: {
                name: body.name,
                account: body.account,
                subscriberType: body.subscriberType || "FIXED",
                phone: body.phone,
                package: body.package,
                price: safeNumber(body.price, true),
                address: body.address,
                nodeName: nodeNameToAssign,
                latitude: safeLat,
                longitude: safeLng,
                ctvCode: body.ctvCode,
                billingType: body.billingType,
                status: body.status || "Hoạt động",
                prepaidPeriod: body.billingType === "MONTHLY" ? null : prepaidPeriod,
                renewalMonth: body.billingType === "MONTHLY" ? null : renewalMonth,
                expirationDate,
            },
        });

        if (session.user.id) {
            try {
                await prisma.editHistory.create({
                    data: {
                        customerId: customer.id,
                        userId: session.user.id,
                        details: JSON.stringify({ action: "CREATE", data: body }),
                    }
                });
            } catch (historyErr) {
                console.error("Failed to record create history:", historyErr);
            }
        }
        clearCacheByPrefix("customers:list");
        clearCacheByPrefix("customers:search-map");
        clearCacheByPrefix("map:data");
        clearCacheByPrefix("map:detail");

        return NextResponse.json({ customer }, { status: 201 });
    } catch (error: any) {
        console.error("CREATE ERROR", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}



