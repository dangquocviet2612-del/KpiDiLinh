import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: Request) {
    try {
        const session = await auth();
        // Only Admin can view logs
        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");
        const skip = (page - 1) * limit;

        const whereClause: any = {};

        if (startDateParam || endDateParam) {
            whereClause.createdAt = {};
            if (startDateParam) {
                // Adjust for GMT+7 Start of Day
                const startDate = new Date(`${startDateParam}T00:00:00.000+07:00`);
                whereClause.createdAt.gte = startDate;
            }
            if (endDateParam) {
                // Adjust for GMT+7 End of Day
                const endDate = new Date(`${endDateParam}T23:59:59.999+07:00`);
                whereClause.createdAt.lte = endDate;
            }
        }

        const [logs, total] = await Promise.all([
            prisma.editHistory.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    user: { select: { username: true } },
                    customer: { select: { name: true, account: true } }
                }
            }),
            prisma.editHistory.count({ where: whereClause })
        ]);

        return NextResponse.json({
            data: logs,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await auth();
        // Only Admin can delete logs
        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { startDate: startDateParam, endDate: endDateParam, ids } = body;

        const whereClause: any = {};

        if (ids && Array.isArray(ids) && ids.length > 0) {
            whereClause.id = { in: ids };
        } else if (startDateParam || endDateParam) {
            whereClause.createdAt = {};
            if (startDateParam) {
                const startDate = new Date(`${startDateParam}T00:00:00.000+07:00`);
                whereClause.createdAt.gte = startDate;
            }
            if (endDateParam) {
                const endDate = new Date(`${endDateParam}T23:59:59.999+07:00`);
                whereClause.createdAt.lte = endDate;
            }
        }

        // Safety: ensure we are actually filtering something before bulk deleting
        if (Object.keys(whereClause).length === 0) {
            return NextResponse.json({ error: "Vui lòng chọn mốc thời gian hoặc danh sách log cần xóa" }, { status: 400 });
        }

        const deleted = await prisma.editHistory.deleteMany({
            where: whereClause
        });

        return NextResponse.json({ success: true, count: deleted.count });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
