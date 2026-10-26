export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import * as xlsx from "xlsx";
import {
  parseImportDateToIsoDate,
  parseImportNumber,
  parseImportTime,
} from "@/lib/import-utils";

const COL = {
  TX_TIME: 4,
  STAFF_CODE: 12,
  TX_DATE: 15,
  ACCOUNT_DCT: 19,
  AMOUNT_DCT: 20,
  MONTHS_DCT: 21,
};

function detectSubscriberTypeFromAccount(account: string): string {
  const normalized = String(account || "").trim().toLowerCase();
  if (normalized.startsWith("ldg_gftth") || normalized.startsWith("l063_gftth")) return "FTTH";
  if (normalized.startsWith("c")) return "Camera";
  if (normalized.startsWith("vt") || normalized.startsWith("l063_gmts")) return "THS";
  return "Khác";
}

function normalizeCode(value: any): string {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 401 }
      );
    }

    await ensureKpiTables();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "Vui lòng chọn file để tải lên" },
        { status: 400 }
      );
    }

    const workbook = xlsx.read(Buffer.from(await file.arrayBuffer()), {
      type: "buffer",
      raw: true,
      cellDates: false,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "Không đọc được sheet dữ liệu" },
        { status: 400 }
      );
    }

    const aoa = xlsx.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
    });
    if (!aoa.length) {
      return NextResponse.json(
        { error: "File rỗng hoặc sai định dạng" },
        { status: 400 }
      );
    }

    const rows = aoa
      .map((row) => {
        const cells = Array.isArray(row) ? row : [];
        return {
          txTime: cells[COL.TX_TIME] ?? null,
          staffCode: cells[COL.STAFF_CODE] ?? null,
          txDate: cells[COL.TX_DATE] ?? null,
          accountDct: cells[COL.ACCOUNT_DCT] ?? null,
          amountDct: cells[COL.AMOUNT_DCT] ?? null,
          monthsDct: cells[COL.MONTHS_DCT] ?? null,
        };
      })
      .filter((row) => {
        const account = String(row.accountDct ?? "").trim();
        const staff = String(row.staffCode ?? "").trim();
        return account !== "" || staff !== "";
      });

    if (!rows.length) {
      return NextResponse.json(
        { error: "Không có dòng dữ liệu sau tiêu đề" },
        { status: 400 }
      );
    }

    const users = await prisma.user.findMany({
      where: { role: "CTV" },
      select: { username: true, secondaryCode: true },
    } as any);

    const mapSecondary = new Map<string, string>();
    const mapUsername = new Map<string, string>();
    for (const user of users as any[]) {
      const username = String(user.username || "").trim();
      const secondary = String(user.secondaryCode || "").trim();
      const secondaryKey = normalizeCode(secondary);
      const usernameKey = normalizeCode(username);
      if (secondaryKey) mapSecondary.set(secondaryKey, username);
      if (usernameKey) mapUsername.set(usernameKey, username);
    }

    const errors: string[] = [];
    const valid: Array<{
      transactionDate: string;
      transactionTime: string | null;
      ctvUser: string;
      subscriberType: string;
      account: string;
      amount: number;
      months: number;
    }> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const lineNo = i + 1;
      const row = rows[i];

      const transactionDate = parseImportDateToIsoDate(row.txDate);
      const transactionTime = parseImportTime(row.txTime);
      const account = String(row.accountDct || "").trim();
      const amount = parseImportNumber(row.amountDct);
      const monthsNum = parseImportNumber(row.monthsDct);
      const ctvCode = String(row.staffCode || "").trim();
      const ctvCodeKey = normalizeCode(ctvCode);
      const ctvUser = mapSecondary.get(ctvCodeKey) || mapUsername.get(ctvCodeKey) || "";

      if (!transactionDate) {
        errors.push(`Dòng ${lineNo}: thiếu hoặc sai Ngày thực hiện giao dịch`);
        continue;
      }
      if (!account) {
        errors.push(`Dòng ${lineNo}: thiếu Thuê bao ĐCT`);
        continue;
      }
      if (amount === null) {
        errors.push(`Dòng ${lineNo}: thiếu hoặc sai Số tiền ĐCT`);
        continue;
      }
      if (monthsNum === null) {
        errors.push(`Dòng ${lineNo}: thiếu hoặc sai Số tháng ĐCT`);
        continue;
      }
      if (!ctvUser) {
        errors.push(`Dòng ${lineNo}: không map được CTV từ Staff Code (${ctvCode || "trống"})`);
        continue;
      }

      valid.push({
        transactionDate,
        transactionTime,
        ctvUser,
        subscriberType: detectSubscriberTypeFromAccount(account),
        account,
        amount,
        months: Math.max(0, Math.floor(monthsNum)),
      });
    }

    if (!valid.length) {
      return NextResponse.json(
        { error: "Không có dòng hợp lệ để import", errors },
        { status: 400 }
      );
    }

    const chunkSize = 300;
    let affected = 0;
    await prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < valid.length; i += chunkSize) {
          const chunk = valid.slice(i, i + chunkSize);
          const valuesSql = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, ?)`).join(", ");
          const params = chunk.flatMap((row) => [
            row.transactionDate,
            row.transactionTime,
            row.ctvUser,
            row.subscriberType,
            row.account,
            row.amount,
            row.months,
            file.name || "",
          ]);

          await tx.$executeRawUnsafe(
            `
            INSERT INTO "CdtTransaction"
            ("transactionDate","transactionTime","ctvUser","subscriberType","account","amount","months","sourceFile")
            VALUES ${valuesSql}
            ON CONFLICT("transactionDate","ctvUser","account","amount","months")
            DO UPDATE SET
              "transactionTime" = excluded."transactionTime",
              "subscriberType" = excluded."subscriberType",
              "sourceFile" = excluded."sourceFile"
            `,
            ...params
          );
          affected += chunk.length;
        }
      },
      { timeout: 120000, maxWait: 15000 }
    );

    clearCacheByPrefix("cdt:report");
    clearCacheByPrefix("cdt:summary");
    clearCacheByPrefix("cdt:outstanding");
    clearCacheByPrefix("prepaid:");

    return NextResponse.json({
      message: "Import CDT thành công",
      totalRows: rows.length,
      validRows: valid.length,
      affected,
      skipped: rows.length - valid.length,
      errors,
    });
  } catch (error: any) {
    console.error("CDT_IMPORT_ERROR", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi máy chủ nội bộ" },
      { status: 500 }
    );
  }
}
