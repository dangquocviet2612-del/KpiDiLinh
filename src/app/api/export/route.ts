export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import * as xlsx from "xlsx";
import { getAccessibleCtvCodes } from "@/lib/scope";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const subscriberType = searchParams.get("subscriberType");
        const billingType = searchParams.get("billingType");
        const prepaidPeriod = searchParams.get("prepaidPeriod");
        const expirationFilter = searchParams.get("expirationFilter"); // "soon" | "expired" | null
        const ctvCodeFilter = searchParams.get("ctvCode");
        const hasCoordinates = searchParams.get("hasCoordinates") === "true";

        if (hasCoordinates && session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const where: any = {};
        const accessibleCtvCodes = await getAccessibleCtvCodes(session);
        if (accessibleCtvCodes !== null) {
            where.ctvCode = { in: accessibleCtvCodes };
            if (ctvCodeFilter) {
                where.ctvCode = { in: accessibleCtvCodes.filter((x) => x.includes(ctvCodeFilter)) };
            }
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
        if (hasCoordinates) {
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

        const customers = await prisma.customer.findMany({
            where,
            orderBy: { createdAt: "desc" }
        });

        const exportData = customers.map((c: any) => ({
            "Tên khách hàng": c.name,
            "Account": c.account || "",
            "Node": c.nodeName || "",
            "Loại Thuê Bao": c.subscriberType === "FIXED" ? "Cố Định" : "Di Động",
            "Số điện thoại": c.phone || "",
            "Trạng thái": c.status || "Hoạt động",
            "Gói cước": c.package || "",
            "Giá tiền": c.price || 0,
            "Địa chỉ": c.address || "",
            "Latitude": c.latitude || "",
            "Longitude": c.longitude || "",
            "Mã CTV": c.ctvCode || "",
            "Loại cước": c.billingType === "PREPAID" ? "dong_truoc" : "Hang_thang",
            "Kỳ đóng trước": c.prepaidPeriod ? `${c.prepaidPeriod}_thang` : "",
            "Tháng gia hạn cước": c.renewalMonth ? `${c.renewalMonth.getDate().toString().padStart(2, '0')}/${(c.renewalMonth.getMonth() + 1).toString().padStart(2, '0')}/${c.renewalMonth.getFullYear()}` : "",
            "Ngày hết hạn": c.expirationDate ? `${c.expirationDate.getDate().toString().padStart(2, '0')}/${(c.expirationDate.getMonth() + 1).toString().padStart(2, '0')}/${c.expirationDate.getFullYear()}` : "",
        }));

        const worksheet = xlsx.utils.json_to_sheet(exportData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Customers");

        const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

        return new Response(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${hasCoordinates ? "customers_with_coordinates" : "customers_export"}_${new Date().toISOString().split("T")[0]}.xlsx"`,
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}




