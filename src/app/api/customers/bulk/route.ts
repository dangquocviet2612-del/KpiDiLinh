import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { recordAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function DELETE(request: Request) {
    try {
        const authResult = await requireAuth({ roles: ["ADMIN"] });
        if (authResult.errorResponse) return authResult.errorResponse;
        const { user } = authResult;

        const body = await request.json();
        const { ids } = body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "Danh sách ID không hợp lệ." }, { status: 400 });
        }

        const result = await prisma.customer.deleteMany({
            where: {
                id: { in: ids }
            }
        });

        clearCacheByPrefix("customers:list");
        clearCacheByPrefix("customers:search-map");
        clearCacheByPrefix("map:data");
        clearCacheByPrefix("map:detail");

        await recordAuditLog({
            userId: user.id,
            username: user.username,
            action: "CUSTOMER_BULK_DELETE",
            resource: "Customer",
            details: { deletedCount: result.count, requestedIdsCount: ids.length },
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        });

        logger.info("Bulk deleted customers", {
            adminUser: user.username,
            deletedCount: result.count,
        });

        return NextResponse.json(
            { message: `Đã xóa thành công ${result.count} khách hàng.` },
            { status: 200 }
        );

    } catch (error: any) {
        logger.error("BULK DELETE ERROR", { error: error?.message });
        return NextResponse.json({ error: error.message || "Lỗi xóa khách hàng hàng loạt" }, { status: 500 });
    }
}
