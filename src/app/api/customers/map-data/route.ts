import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { getCache, setCache } from "@/lib/kpi-cache";
import { getMappedNodeNamesByAccounts, normalizeCustomerAccountKey } from "@/lib/customer-node-mapping";
import { ensureCustomerSchema } from "@/lib/ensure-customer-schema";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const hasCoordinates = searchParams.get("hasCoordinates") === "true";
    const includeDetails = searchParams.get("includeDetails") === "true";
    const takeParam = Number(searchParams.get("take") || 0);
    const take = Number.isFinite(takeParam) && takeParam > 0 ? Math.min(Math.floor(takeParam), 20000) : 10000;

    const whereClause: any = {};
    const accessibleCtvCodes = await getAccessibleCtvCodes(session);
    if (accessibleCtvCodes !== null) {
      whereClause.ctvCode = { in: accessibleCtvCodes };
    }
    if (hasCoordinates) {
      whereClause.latitude = { not: null };
      whereClause.longitude = { not: null };
    }

    const cacheKey = [
      "map:data",
      session.user.role || "",
      session.user.name || "",
      hasCoordinates ? "1" : "0",
      includeDetails ? "1" : "0",
      String(take),
      Array.isArray(whereClause?.ctvCode?.in) ? whereClause.ctvCode.in.join(",") : "all",
    ].join("|");
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    await ensureCustomerSchema();

    const customers = await prisma.customer.findMany({
      where: whereClause,
      take,
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        phone: true,
        ctvCode: true,
        status: true,
        subscriberType: true,
        billingType: true,
        expirationDate: true,
        ...(includeDetails
          ? {
              account: true,
              nodeName: true,
              address: true,
              package: true,
            }
          : {}),
      },
    });

    const mappedNodeNames =
      includeDetails && customers.length > 0
        ? await getMappedNodeNamesByAccounts(customers.map((customer) => customer.account))
        : new Map<string, string>();

    const data = includeDetails
      ? customers.map((customer) => {
          const mappedNodeName = mappedNodeNames.get(normalizeCustomerAccountKey(customer.account));
          return mappedNodeName ? { ...customer, nodeName: mappedNodeName } : customer;
        })
      : customers;

    const payload = {
      success: true,
      data,
      meta: { count: data.length, take, includeDetails },
    };
    setCache(cacheKey, payload, 60_000);
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("Loi khi lay du lieu map:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Da xay ra loi" },
      { status: 500 }
    );
  }
}
