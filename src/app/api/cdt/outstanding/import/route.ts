export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { auth } from "@/auth";
import {
  CDT_OUTSTANDING_TEMPLATE_HEADERS,
  OUTSTANDING_STATUS_PENDING,
  detectOutstandingSubscriberType,
  normalizeOutstandingExpiryMonth,
  normalizeOutstandingReportMonth,
  validateCdtOutstandingHeaderRow,
} from "@/lib/cdt-outstanding";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { ensureKpiTables } from "@/lib/kpi-db";
import { prisma } from "@/lib/prisma";

type OutstandingImportRow = {
  account: string;
  customerName: string | null;
  phone: string | null;
  address: string | null;
  ctvCode: string;
  serviceName: string | null;
  expiryDateText: string | null;
  expiryMonth: string;
  subscriberType: string;
};

function toTrimmedString(value: unknown) {
  return String(value ?? "").trim();
}

function hasAnyMeaningfulCell(row: unknown[]) {
  return row.some((cell) => toTrimmedString(cell) !== "");
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n th\u1ef1c hi\u1ec7n thao t\u00e1c n\u00e0y" },
        { status: 403 },
      );
    }

    await ensureKpiTables();

    const formData = await request.formData();
    const file = formData.get("file");
    const reportMonth = normalizeOutstandingReportMonth(formData.get("reportMonth"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Vui l\u00f2ng ch\u1ecdn file T\u1ed3n CDT" }, { status: 400 });
    }
    if (!reportMonth) {
      return NextResponse.json(
        { error: "K\u1ef3 file kh\u00f4ng h\u1ee3p l\u1ec7, c\u1ea7n d\u00f9ng \u0111\u1ecbnh d\u1ea1ng YYYY-MM" },
        { status: 400 },
      );
    }

    const workbook = xlsx.read(Buffer.from(await file.arrayBuffer()), {
      type: "buffer",
      raw: true,
      dense: true,
    });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: "Kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c sheet d\u1eef li\u1ec7u" }, { status: 400 });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: true,
    });
    if (!rows.length) {
      return NextResponse.json({ error: "File r\u1ed7ng ho\u1eb7c sai \u0111\u1ecbnh d\u1ea1ng" }, { status: 400 });
    }

    const headerValidation = validateCdtOutstandingHeaderRow(rows[0] || []);
    if (!headerValidation.matches) {
      return NextResponse.json(
        {
          error: "File T\u1ed3n CDT kh\u00f4ng \u0111\u00fang m\u1eabu",
          expectedHeaders: CDT_OUTSTANDING_TEMPLATE_HEADERS,
          actualHeaders: headerValidation.actualHeaders,
        },
        { status: 400 },
      );
    }

    const errors: string[] = [];
    const deduped = new Map<string, OutstandingImportRow>();
    let duplicateCount = 0;

    rows.slice(1).forEach((row, index) => {
      const lineNo = index + 2;
      const cells = Array.isArray(row) ? row : [];
      if (!hasAnyMeaningfulCell(cells)) return;

      const account = toTrimmedString(cells[0]);
      const customerName = toTrimmedString(cells[1]) || null;
      const phone = toTrimmedString(cells[2]) || null;
      const address = toTrimmedString(cells[3]) || null;
      const ctvCode = toTrimmedString(cells[4]);
      const serviceName = toTrimmedString(cells[5]) || null;
      const expiryDateText = toTrimmedString(cells[6]) || null;
      const expiryMonth = normalizeOutstandingExpiryMonth(cells[7]);

      if (!account) {
        errors.push(`D\u00f2ng ${lineNo}: thi\u1ebfu S\u1ed1 thu\u00ea bao`);
        return;
      }
      if (!ctvCode) {
        errors.push(`D\u00f2ng ${lineNo}: thi\u1ebfu M\u00e3 CTV`);
        return;
      }
      if (!expiryMonth) {
        errors.push(`D\u00f2ng ${lineNo}: thi\u1ebfu ho\u1eb7c sai Th\u00e1ng h\u1ebft h\u1ea1n`);
        return;
      }

      const dedupeKey = `${account.toLowerCase()}|${expiryMonth}`;
      if (deduped.has(dedupeKey)) duplicateCount += 1;
      deduped.set(dedupeKey, {
        account,
        customerName,
        phone,
        address,
        ctvCode,
        serviceName,
        expiryDateText,
        expiryMonth,
        subscriberType: detectOutstandingSubscriberType(serviceName, account),
      });
    });

    const validRows = [...deduped.values()];
    if (!validRows.length) {
      return NextResponse.json(
        {
          error: "Kh\u00f4ng c\u00f3 d\u00f2ng h\u1ee3p l\u1ec7 \u0111\u1ec3 import",
          errors,
        },
        { status: 400 },
      );
    }

    const chunkSize = 300;
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`DELETE FROM "CdtOutstandingRecord" WHERE "reportMonth" = ?`, reportMonth);

        for (let index = 0; index < validRows.length; index += chunkSize) {
          const chunk = validRows.slice(index, index + chunkSize);
          const valuesSql = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(", ");
          const params = chunk.flatMap((row) => [
            reportMonth,
            row.account,
            row.customerName,
            row.phone,
            row.address,
            row.ctvCode,
            row.serviceName,
            row.expiryDateText,
            row.expiryMonth,
            OUTSTANDING_STATUS_PENDING,
            row.subscriberType,
            file.name || "",
          ]);

          await tx.$executeRawUnsafe(
            `
            INSERT INTO "CdtOutstandingRecord"
            ("reportMonth","account","customerName","phone","address","ctvCode","serviceName","expiryDateText","expiryMonth","statusCheck","subscriberType","sourceFile")
            VALUES ${valuesSql}
            `,
            ...params,
          );
        }
      },
      { timeout: 120000, maxWait: 15000 },
    );

    clearCacheByPrefix("cdt:outstanding");
    clearCacheByPrefix("prepaid:");

    return NextResponse.json({
      message: "Import T\u1ed3n CDT th\u00e0nh c\u00f4ng",
      reportMonth,
      totalRows: Math.max(0, rows.length - 1),
      inserted: validRows.length,
      duplicateCount,
      skipped: Math.max(0, rows.length - 1 - validRows.length),
      errors,
    });
  } catch (error: any) {
    console.error("CDT_OUTSTANDING_IMPORT_ERROR", error);
    return NextResponse.json({ error: error?.message || "L\u1ed7i m\u00e1y ch\u1ee7 n\u1ed9i b\u1ed9" }, { status: 500 });
  }
}
