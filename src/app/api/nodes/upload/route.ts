export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import AdmZip from "adm-zip";
import { DOMParser } from "@xmldom/xmldom";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { ensureNodeEfficiencyColumns } from "@/lib/node-efficiency-db";
import {
  syncMappedNodesToCustomersByAccounts,
  upsertCustomerNodeMappings,
} from "@/lib/customer-node-mapping";
import { ensureCustomerNodeMappingTable } from "@/lib/customer-node-mapping-db";
import {
  createRowLookup,
  normalizeHeaderKey,
  parseImportDate,
  parseImportInteger,
  parseImportNumber,
  toTrimmedString,
} from "@/lib/import-utils";
import { invalidateNearestNodeCache } from "@/lib/nodeUtils";

type SheetRow = Record<string, unknown>;
type SheetMatrixRow = unknown[];
type ParsedNodeRow = {
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
};

function clearNodeRelatedCaches() {
  clearCacheByPrefix("nodes:");
  clearCacheByPrefix("map:data");
  clearCacheByPrefix("map:detail");
}

function getFileExtension(fileName: string) {
  const match = /\.([^.]+)$/.exec(fileName.toLowerCase());
  return match?.[1] || "";
}

const ACCOUNT_ALIASES = [
  "Accout",
  "Account",
  "Mã thuê bao",
  "Ma thue bao",
  "Số thuê bao",
  "So thue bao",
  "Thuê bao",
  "Thue bao",
  "Tài khoản",
  "Tai khoan",
  "Mã khách hàng",
  "Ma khach hang",
  "Username",
  "User",
  "Ma KH",
  "Ma_KH",
  "Mã accout",
  "Ma accout",
  "Mã account",
  "Ma account",
  "Tài khoản accout",
  "Tai khoan accout",
  "Tài khoản account",
  "Tai khoan account",
];

const NODE_ALIASES = [
  "Node",
  "Tên Node",
  "Ten Node",
  "Mã Node",
  "Ma Node",
  "Trạm",
  "Tram",
  "Mã trạm",
  "Ma tram",
  "Tên trạm",
  "Ten tram",
  "Node Code",
  "NodeCode",
  "Node_Code",
  "NodeName",
  "Node Name",
  "Tên thiết bị",
  "Ten thiet bi",
  "Mã thiết bị",
  "Ma thiet bi",
  "Mã node",
];


function detectExcelModeFromHeader(matrixRows: unknown[][]) {
  const maxScanRows = Math.min(5, matrixRows.length);
  const accountNormalizedAliases = ACCOUNT_ALIASES.map((alias) => normalizeHeaderKey(alias));
  const nodeNormalizedAliases = NODE_ALIASES.map((alias) => normalizeHeaderKey(alias));

  for (let r = 0; r < maxScanRows; r++) {
    const row = matrixRows[r] || [];
    const headers = row.map((value) => normalizeHeaderKey(String(value ?? "")));

    const hasNodeCode = headers.includes(normalizeHeaderKey("NODE_CODE"));
    const hasEfficiencyColumns =
      headers.includes(normalizeHeaderKey("TOTAL_INT_PORT")) &&
      headers.includes(normalizeHeaderKey("USED_PORT")) &&
      headers.includes(normalizeHeaderKey("PORT_EFFICIENCY"));

    if (hasNodeCode && hasEfficiencyColumns) {
      return { mode: "NODE_EFFICIENCY" as const, headerRowIndex: r };
    }

    const hasAccount = headers.some((h) => accountNormalizedAliases.includes(h));
    const hasNode = headers.some((h) => nodeNormalizedAliases.includes(h));

    if (hasAccount && hasNode) {
      return { mode: "ACCOUNT_NODE_MAP" as const, headerRowIndex: r };
    }
  }

  return null;
}

function readWorkbook(fileBuffer: Buffer) {
  return xlsx.read(fileBuffer, { type: "buffer", dense: true });
}

function getFirstWorksheet(workbook: xlsx.WorkBook) {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return null;
  return workbook.Sheets[firstSheetName];
}

function readSheetObjectRows(sheet: xlsx.WorkSheet) {
  return xlsx.utils.sheet_to_json(sheet, { defval: "" }) as SheetRow[];
}

function readSheetMatrixRows(sheet: xlsx.WorkSheet) {
  return xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false }) as SheetMatrixRow[];
}

function findHeaderIndex(headerRow: unknown[], ...keys: string[]) {
  const normalizedHeader = headerRow.map((value) => normalizeHeaderKey(String(value ?? "")));

  for (const key of keys) {
    const target = normalizeHeaderKey(key);
    const index = normalizedHeader.indexOf(target);
    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function getTextContent(parent: Element, tagName: string) {
  const first = parent.getElementsByTagName(tagName)?.[0];
  return toTrimmedString(first?.textContent || "");
}

function parseCoordinates(rawCoordinates: string) {
  const firstCoordinate = rawCoordinates
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .find(Boolean);

  if (!firstCoordinate) return null;
  const [longitudeText, latitudeText] = firstCoordinate.split(",");
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function parseKmlContent(xmlText: string) {
  const document = new DOMParser().parseFromString(xmlText, "text/xml");
  const placemarks = Array.from(document.getElementsByTagName("Placemark"));

  const nodes = new Map<string, ParsedNodeRow>();
  for (const placemark of placemarks) {
    const name = getTextContent(placemark, "name");
    const rawCoordinates = getTextContent(placemark, "coordinates");
    const parsedCoordinates = parseCoordinates(rawCoordinates);

    if (!name || !parsedCoordinates) continue;

    nodes.set(name, {
      name,
      description: getTextContent(placemark, "description") || null,
      latitude: parsedCoordinates.latitude,
      longitude: parsedCoordinates.longitude,
    });
  }

  return Array.from(nodes.values());
}

function extractKmlTextFromUpload(file: File, buffer: Buffer) {
  const extension = getFileExtension(file.name);
  if (extension === "kml") {
    return buffer.toString("utf8");
  }

  if (extension === "kmz") {
    const zip = new AdmZip(buffer);
    const kmlEntry = zip
      .getEntries()
      .find((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".kml"));

    if (!kmlEntry) {
      throw new Error("File KMZ không chứa dữ liệu KML hợp lệ.");
    }

    return zip.readAsText(kmlEntry, "utf8");
  }

  throw new Error("Định dạng file không được hỗ trợ.");
}

async function importNodePositions(file: File, buffer: Buffer) {
  const kmlText = extractKmlTextFromUpload(file, buffer);
  const parsedNodes = parseKmlContent(kmlText);

  if (parsedNodes.length === 0) {
    throw new Error("Không tìm thấy node hợp lệ trong file KML/KMZ.");
  }

  const existingNodes = await prisma.node.findMany({
    where: { name: { in: parsedNodes.map((node) => node.name) } },
    select: { id: true, name: true },
  });

  const existingNodeMap = new Map(existingNodes.map((node) => [node.name, node.id]));
  const toCreate = parsedNodes.filter((node) => !existingNodeMap.has(node.name));
  const toUpdate = parsedNodes.filter((node) => existingNodeMap.has(node.name));

  await prisma.$transaction(async (tx) => {
    if (toCreate.length > 0) {
      await tx.node.createMany({
        data: toCreate.map((node) => ({
          id: crypto.randomUUID(),
          name: node.name,
          description: node.description,
          latitude: node.latitude,
          longitude: node.longitude,
        })),
      });
    }

    const batchSize = 100;
    for (let index = 0; index < toUpdate.length; index += batchSize) {
      const chunk = toUpdate.slice(index, index + batchSize);
      await Promise.all(
        chunk.map((node) =>
          tx.node.update({
            where: { id: existingNodeMap.get(node.name)! },
            data: {
              description: node.description,
              latitude: node.latitude,
              longitude: node.longitude,
            },
          }),
        ),
      );
    }
  });

  invalidateNearestNodeCache();
  clearNodeRelatedCaches();

  return {
    mode: "NODE_POSITIONS" as const,
    message: "Cập nhật vị trí node thành công.",
    totalRows: parsedNodes.length,
    created: toCreate.length,
    updated: toUpdate.length,
  };
}

async function importNodeEfficiency(rows: SheetRow[]) {
  await ensureNodeEfficiencyColumns();

  const nodeNames = await prisma.node.findMany({
    select: { id: true, name: true },
  });
  const nodeIdByName = new Map(nodeNames.map((node) => [node.name.trim().toLowerCase(), node.id]));

  let updated = 0;
  let notMatched = 0;
  const notMatchedSamples: string[] = [];
  const errors: string[] = [];

  const updates: Array<{
    id: string;
    totalIntPort: number | null;
    usedPort: number | null;
    portEfficiency: number | null;
    dateKd: Date | null;
    efficiencyStatus: string | null;
  }> = [];

  for (const [index, row] of rows.entries()) {
    const getValue = createRowLookup(row);
    const nodeCode = toTrimmedString(getValue("NODE_CODE", "Node Code", "node_code"));

    if (!nodeCode) {
      errors.push(`Dòng ${index + 2}: Thiếu NODE_CODE.`);
      continue;
    }

    const nodeId = nodeIdByName.get(nodeCode.toLowerCase());
    if (!nodeId) {
      notMatched += 1;
      if (notMatchedSamples.length < 10) {
        notMatchedSamples.push(nodeCode);
      }
      continue;
    }

    const totalIntPort = parseImportInteger(getValue("TOTAL_INT_PORT", "Total Int Port"));
    const usedPort = parseImportInteger(getValue("USED_PORT", "Used Port"));
    const portEfficiency = parseImportNumber(getValue("PORT_EFFICIENCY", "Port Efficiency"));
    const dateKd = parseImportDate(getValue("DATE_KD", "Date KD", "DATE KD"));
    const efficiencyStatus = toTrimmedString(getValue("EFFICIENCY_STATUS", "Efficiency Status")) || null;

    updates.push({
      id: nodeId,
      totalIntPort,
      usedPort,
      portEfficiency,
      dateKd,
      efficiencyStatus,
    });
  }

  const batchSize = 120;
  for (let index = 0; index < updates.length; index += batchSize) {
    const chunk = updates.slice(index, index + batchSize);
    await Promise.all(
      chunk.map((row) =>
        prisma.$executeRawUnsafe(
          `
            UPDATE "Node"
            SET
              "totalIntPort" = ?,
              "usedPort" = ?,
              "portEfficiency" = ?,
              "dateKd" = ?,
              "efficiencyStatus" = ?,
              "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ?
          `,
          row.totalIntPort,
          row.usedPort,
          row.portEfficiency,
          row.dateKd ? row.dateKd.toISOString() : null,
          row.efficiencyStatus,
          row.id,
        ),
      ),
    );
    updated += chunk.length;
  }

  clearNodeRelatedCaches();

  return {
    mode: "NODE_EFFICIENCY" as const,
    message: "Import hiệu suất node thành công.",
    totalRows: rows.length,
    updated,
    notMatched,
    notMatchedSamples,
    errors,
  };
}

function matrixToObjects(matrixRows: unknown[][]): SheetRow[] {
  if (matrixRows.length <= 1) return [];
  const [headerRow, ...dataRows] = matrixRows;
  const headers = headerRow.map((h) => String(h ?? "").trim());

  return dataRows.map((row) => {
    const obj: SheetRow = {};
    headers.forEach((header, index) => {
      if (header) {
        obj[header] = row[index] !== undefined ? row[index] : "";
      }
    });
    return obj;
  });
}

async function importAccountNodeMap(rows: SheetMatrixRow[]) {
  await ensureCustomerNodeMappingTable();

  const errors: string[] = [];
  const validRows: Array<{ account: string; nodeName: string; accountAddress?: string | null }> = [];

  if (rows.length <= 1) {
    return {
      mode: "ACCOUNT_NODE_MAP" as const,
      message: "File node thuê bao không có dữ liệu hợp lệ.",
      totalRows: 0,
      imported: 0,
      inserted: 0,
      updated: 0,
      syncedCustomers: 0,
      errors: [],
    };
  }

  const [headerRow, ...dataRows] = rows;
  const accountIndex = findHeaderIndex(headerRow, ...ACCOUNT_ALIASES);
  const nodeIndex = findHeaderIndex(headerRow, ...NODE_ALIASES);
  const addressIndex = findHeaderIndex(
    headerRow,
    "Địa chỉ accout",
    "Dia chi accout",
    "Địa chỉ account",
    "Dia chi account",
    "Account Address",
    "Address",
    "Địa chỉ",
    "Dia chi"
  );

  for (const [index, row] of dataRows.entries()) {
    const account = toTrimmedString(accountIndex >= 0 ? row[accountIndex] : "");
    const nodeName = toTrimmedString(nodeIndex >= 0 ? row[nodeIndex] : "");
    const accountAddress = toTrimmedString(addressIndex >= 0 ? row[addressIndex] : "") || null;

    if (!account || !nodeName) {
      errors.push(`Dòng ${index + 2}: Thiếu ${!account ? "Account" : "Node"}.`);
      continue;
    }

    validRows.push({ account, nodeName, accountAddress });
  }

  const summary = await upsertCustomerNodeMappings(validRows);
  const syncedCustomers = await syncMappedNodesToCustomersByAccounts(summary.changedAccountKeys);

  clearNodeRelatedCaches();

  return {
    mode: "ACCOUNT_NODE_MAP" as const,
    message: "Cập nhật dữ liệu node thuê bao thành công.",
    totalRows: dataRows.length,
    imported: summary.total,
    inserted: summary.inserted,
    updated: summary.updated,
    syncedCustomers,
    errors,
  };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Vui lòng chọn file để tải lên." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = getFileExtension(file.name);

    if (extension === "kml" || extension === "kmz") {
      const result = await importNodePositions(file, buffer);
      return NextResponse.json(result);
    }

    if (extension !== "xlsx" && extension !== "xls") {
      return NextResponse.json({ error: "Chỉ hỗ trợ file KML, KMZ, XLSX hoặc XLS." }, { status: 400 });
    }

    const workbook = readWorkbook(buffer);
    const firstSheet = getFirstWorksheet(workbook);
    if (!firstSheet) {
      return NextResponse.json({ error: "File Excel rỗng hoặc không hợp lệ." }, { status: 400 });
    }

    const matrixRows = readSheetMatrixRows(firstSheet);
    if (matrixRows.length === 0) {
      return NextResponse.json({ error: "File Excel rỗng hoặc không hợp lệ." }, { status: 400 });
    }

    const excelModeInfo = detectExcelModeFromHeader(matrixRows);
    if (excelModeInfo) {
      const { mode, headerRowIndex } = excelModeInfo;
      const slicedRows = matrixRows.slice(headerRowIndex);
      
      if (mode === "NODE_EFFICIENCY") {
        const objectRows = matrixToObjects(slicedRows);
        return NextResponse.json(await importNodeEfficiency(objectRows));
      }

      if (mode === "ACCOUNT_NODE_MAP") {
        return NextResponse.json(await importAccountNodeMap(slicedRows));
      }
    }

    // Header mismatch error response with detailed headers found
    let firstNonEmptyRow: unknown[] = [];
    for (let r = 0; r < Math.min(5, matrixRows.length); r++) {
      const row = matrixRows[r] || [];
      if (row.some((val) => val !== null && val !== undefined && String(val).trim() !== "")) {
        firstNonEmptyRow = row;
        break;
      }
    }
    const foundHeaders = firstNonEmptyRow.map((h) => String(h || "").trim()).filter(Boolean);

    return NextResponse.json(
      {
        error:
          `File Excel không đúng mẫu.\n` +
          `Các cột tìm thấy ở dòng tiêu đề: [${foundHeaders.join(", ")}]\n\n` +
          `Yêu cầu tối thiểu một trong các mẫu sau:\n` +
          `- Mẫu Node Thuê Bao: Cần có cột tài khoản (ví dụ: 'Accout', 'Account', 'Mã thuê bao') và cột node (ví dụ: 'Node', 'Trạm', 'Node Code').\n` +
          `- Mẫu Hiệu Suất Node: Cần có cột 'NODE_CODE' và các cột 'TOTAL_INT_PORT', 'USED_PORT', 'PORT_EFFICIENCY'.`,
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("NODE_UPLOAD_ERROR", error);
    const message = error instanceof Error ? error.message : "Lỗi máy chủ nội bộ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
