export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getCache, getCacheGeneration, setCache } from "@/lib/kpi-cache";
import { projectNodeCoordinates } from "@/lib/node-coordinates";
import { ensureNodeEfficiencyColumns } from "@/lib/node-efficiency-db";
import { ensureCustomerNodeMappingTable } from "@/lib/customer-node-mapping-db";
import { getAccessibleCtvCodes } from "@/lib/scope";

export const revalidate = 60;

function parseLimit(value: string | null, fallback = 40, max = 200) {
    const parsed = Number(value || fallback);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.trunc(parsed), max);
}

function parsePage(value: string | null) {
    const parsed = Number(value || 1);
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
    return Math.trunc(parsed);
}

export async function GET(request: Request) {
    const cacheGeneration = getCacheGeneration();
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const view = searchParams.get("view");
        const downloadTemplate = searchParams.get("downloadTemplate");

        if (downloadTemplate === "account-node-map") {
            if (session.user.role !== "ADMIN") {
                return NextResponse.json({ error: "Bạn không có quyền tải file mẫu này." }, { status: 403 });
            }

            const rows = [
                { Accout: "ldg_gftth_demo01", Node: "LDG0019-DN02-SN10-SP02", "Địa chỉ accout": "Thôn 2 - Hòa Ninh" },
                { Accout: "l063_gftth_demo02", Node: "LDG0019-DN01-SN15-SP02", "Địa chỉ accout": "Thôn 8 - Đinh Lạc" },
            ];

            const workbook = xlsx.utils.book_new();
            const sheet = xlsx.utils.json_to_sheet(rows, { header: ["Accout", "Node", "Địa chỉ accout"] });
            sheet["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 42 }];
            xlsx.utils.book_append_sheet(workbook, sheet, "NodeThueBao");
            const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": 'attachment; filename="mau_node_thue_bao.xlsx"',
                },
            });
        }

        if (downloadTemplate === "node-efficiency") {
            if (session.user.role !== "ADMIN") {
                return NextResponse.json({ error: "Bạn không có quyền tải file mẫu này." }, { status: 403 });
            }

            const rows = [
                { 
                    NODE_CODE: "LDG0019-DN02-SN10-SP02", 
                    TOTAL_INT_PORT: 16, 
                    USED_PORT: 12, 
                    PORT_EFFICIENCY: 0.75, 
                    DATE_KD: "2026-05-15", 
                    EFFICIENCY_STATUS: "Bình thường" 
                },
                { 
                    NODE_CODE: "LDG0019-DN01-SN15-SP02", 
                    TOTAL_INT_PORT: 32, 
                    USED_PORT: 2, 
                    PORT_EFFICIENCY: 0.0625, 
                    DATE_KD: "2026-05-15", 
                    EFFICIENCY_STATUS: "Hiệu suất thấp" 
                },
            ];

            const workbook = xlsx.utils.book_new();
            const sheet = xlsx.utils.json_to_sheet(rows, { 
                header: ["NODE_CODE", "TOTAL_INT_PORT", "USED_PORT", "PORT_EFFICIENCY", "DATE_KD", "EFFICIENCY_STATUS"] 
            });
            sheet["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }];
            xlsx.utils.book_append_sheet(workbook, sheet, "HieuSuatNode");
            const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": 'attachment; filename="mau_hieu_suat_node.xlsx"',
                },
            });
        }

        if (view === "account-node-mappings") {
            if (session.user.role !== "ADMIN") {
                return NextResponse.json({ error: "Bạn không có quyền xem dữ liệu này." }, { status: 403 });
            }

            await ensureCustomerNodeMappingTable();
            const q = (searchParams.get("q") || "").trim();
            const page = parsePage(searchParams.get("page"));
            const limit = parseLimit(searchParams.get("limit"));
            const offset = (page - 1) * limit;
            const whereSql = q
                ? `WHERE LOWER("account") LIKE ? OR LOWER("nodeName") LIKE ? OR LOWER(COALESCE("accountAddress", '')) LIKE ?`
                : "";
            const params = q ? [`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`] : [];

            const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
                `SELECT COUNT(*) as total FROM "CustomerNodeMapping" ${whereSql}`,
                ...params
            );

            const items = await prisma.$queryRawUnsafe<
                Array<{ id: string; account: string; nodeName: string; accountAddress: string | null; createdAt: string; updatedAt: string }>
            >(
                `
                    SELECT "id", "account", "nodeName", "accountAddress", "createdAt", "updatedAt"
                    FROM "CustomerNodeMapping"
                    ${whereSql}
                    ORDER BY "updatedAt" DESC, "accountKey" ASC
                    LIMIT ? OFFSET ?
                `,
                ...params,
                limit,
                offset
            );

            const total = Number(countRows[0]?.total || 0);
            return NextResponse.json({
                items,
                total,
                page,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            });
        }

        if (view === "node-accounts") {
            await ensureCustomerNodeMappingTable();

            const nodeName = (searchParams.get("nodeName") || "").trim();
            if (!nodeName) {
                return NextResponse.json({ error: "Thiếu tên node." }, { status: 400 });
            }

            const page = parsePage(searchParams.get("page"));
            const limit = parseLimit(searchParams.get("limit"), 30, 100);
            const offset = (page - 1) * limit;
            const accessibleCtvCodes = await getAccessibleCtvCodes(session);
            const roleScopedSql =
                accessibleCtvCodes !== null
                    ? ` AND c."ctvCode" IN (${accessibleCtvCodes.map(() => "?").join(", ")})`
                    : "";
            const scopedParams = accessibleCtvCodes !== null ? [...accessibleCtvCodes] : [];

            if (accessibleCtvCodes !== null && accessibleCtvCodes.length === 0) {
                return NextResponse.json({ items: [], total: 0, page: 1, totalPages: 1, nodeName });
            }

            const baseParams: Array<string | number> = [
                nodeName,
                `${nodeName}-%`,
                ...scopedParams,
                nodeName,
                `${nodeName}-%`,
                ...scopedParams,
            ];

            const sourceSql = `
                SELECT DISTINCT
                  COALESCE(m."id", c."id", m."account") AS "id",
                  COALESCE(m."account", c."account") AS "account",
                  m."accountAddress" AS "accountAddress"
                FROM "CustomerNodeMapping" m
                LEFT JOIN "Customer" c
                  ON LOWER(TRIM(COALESCE(c."account", ''))) = m."accountKey"
                WHERE (UPPER(m."nodeName") = UPPER(?) OR UPPER(m."nodeName") LIKE UPPER(?))
                  AND TRIM(COALESCE(m."account", c."account", '')) <> ''
                ${accessibleCtvCodes !== null ? roleScopedSql : ""}

                UNION

                SELECT DISTINCT
                  c."id" AS "id",
                  c."account" AS "account",
                  NULL AS "accountAddress"
                FROM "Customer" c
                LEFT JOIN "CustomerNodeMapping" m
                  ON m."accountKey" = LOWER(TRIM(COALESCE(c."account", '')))
                WHERE m."accountKey" IS NULL
                  AND c."account" IS NOT NULL
                  AND TRIM(c."account") <> ''
                  AND (UPPER(c."nodeName") = UPPER(?) OR UPPER(c."nodeName") LIKE UPPER(?))
                  ${roleScopedSql}
            `;

            const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
                `SELECT COUNT(*) as total FROM (${sourceSql}) t`,
                ...baseParams
            );

            const items = await prisma.$queryRawUnsafe<
                Array<{
                    id: string;
                    account: string;
                    accountAddress: string | null;
                }>
            >(
                `
                    SELECT *
                    FROM (${sourceSql}) t
                    ORDER BY "account" ASC
                    LIMIT ? OFFSET ?
                `,
                ...baseParams,
                limit,
                offset
            );

            const total = Number(countRows[0]?.total || 0);
            return NextResponse.json({
                items,
                total,
                page,
                totalPages: Math.max(1, Math.ceil(total / limit)),
                nodeName,
            });
        }

        const coordinatesOnly = searchParams.get("projection") === "coordinates";
        const cacheKey = "nodes:list";
        const cached = getCache<any>(cacheKey);
        if (cached) return NextResponse.json(coordinatesOnly ? projectNodeCoordinates(cached) : cached);

        await ensureNodeEfficiencyColumns();
        const nodes = await prisma.$queryRawUnsafe<Array<any>>(`
            SELECT
                id, name, description, latitude, longitude,
                totalIntPort, usedPort, portEfficiency, dateKd, efficiencyStatus
            FROM "Node"
            ORDER BY name ASC
        `);

        const payload = { data: nodes };
        setCache(cacheKey, payload, 60_000, cacheGeneration);
        return NextResponse.json(coordinatesOnly ? projectNodeCoordinates(payload) : payload);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
