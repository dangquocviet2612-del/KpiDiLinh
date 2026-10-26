export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import * as xlsx from "xlsx";

export async function GET() {
    try {
        const authResult = await requireAuth();
        if (authResult.errorResponse) return authResult.errorResponse;
        // Create workbook with the exact column headers matching the import format
        const headers = [
            "Tên khách hàng",
            "Account",
            "Node",
            "Loại Thuê Bao",
            "Số điện thoại",
            "Trạng thái",
            "Gói cước",
            "Giá tiền",
            "Địa chỉ",
            "Latitude",
            "Longitude",
            "Mã CTV",
            "Loại cước",
            "Kỳ đóng trước",
            "Tháng gia hạn cước",
            "Ngày hết hạn",
        ];

        // Sample row for reference
        const sampleRow = {
            "Tên khách hàng": "Nguyễn Văn A",
            "Account": "ACC001",
            "Node": "LDG-DN02",
            "Loại Thuê Bao": "Cố Định",
            "Số điện thoại": "0901234567",
            "Trạng thái": "Hoạt động",
            "Gói cước": "FiberVNN",
            "Giá tiền": 200000,
            "Địa chỉ": "123 Đường ABC, Quận 1, TP.HCM",
            "Latitude": 10.7769,
            "Longitude": 106.7009,
            "Mã CTV": "CTV01",
            "Loại cước": "dong_truoc",
            "Kỳ đóng trước": "6_thang",
            "Tháng gia hạn cước": "15/01/2026",
            "Ngày hết hạn": "15/07/2026",
        };

        const ws = xlsx.utils.json_to_sheet([sampleRow], { header: headers });

        // Set column widths for readability
        ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Mẫu Import");

        const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        return new Response(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": "attachment; filename=mau_import_khach_hang.xlsx",
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
