import { prisma } from "@/lib/prisma";
import { parseImportDate, parseImportInteger, toTrimmedString } from "@/lib/import-utils";
import fs from "fs";
import * as xlsx from "xlsx";
import type { Node0TbItem, Node0TbApiResponse } from "@/types";

let ensurePromise: Promise<void> | null = null;

export async function ensureNode0TbTable() {
  if (ensurePromise) {
    await ensurePromise;
    return;
  }

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Node0Tb" (
        "id" TEXT PRIMARY KEY,
        "nodeCode" TEXT NOT NULL,
        "dateKd" DATETIME,
        "dateKdRaw" TEXT,
        "dateKdFormatted" TEXT,
        "totalPort" INTEGER,
        "usedPort" INTEGER DEFAULT 0,
        "categoryKd" TEXT,
        "note" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_node_0tb_node_code"
      ON "Node0Tb" ("nodeCode")
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_node_0tb_category_kd"
      ON "Node0Tb" ("categoryKd")
    `);
  })();

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
}

export function formatDateToVn(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function parseFlexibleDate(value: unknown): { date: Date | null; formatted: string | null; raw: string } {
  const raw = toTrimmedString(value);
  if (!raw) return { date: null, formatted: null, raw: "" };

  const parsed = parseImportDate(value);
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return {
      date: parsed,
      formatted: formatDateToVn(parsed),
      raw,
    };
  }

  return { date: null, formatted: raw, raw };
}

export async function seedNode0TbIfEmpty(): Promise<number> {
  await ensureNode0TbTable();

  const countRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) as count FROM "Node0Tb"`
  );
  const currentCount = Number(countRows[0]?.count || 0);
  if (currentCount > 0) {
    return currentCount;
  }

  const defaultFilePath = process.env.NODE_0TB_DEFAULT_FILE_PATH || "";
  if (!defaultFilePath || !fs.existsSync(defaultFilePath)) {
    return 0;
  }

  try {
    const fileBuffer = fs.readFileSync(defaultFilePath);
    const wb = xlsx.read(fileBuffer, { type: "buffer", dense: true });
    
    // Choose sheet 'ĐH NODE 0Tb' or first sheet
    let targetSheetName = wb.SheetNames.find((s) => s.toLowerCase().includes("0tb") || s.toLowerCase().includes("node"));
    if (!targetSheetName) {
      targetSheetName = wb.SheetNames[0];
    }
    if (!targetSheetName) return 0;

    const sheet = wb.Sheets[targetSheetName];
    const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    if (!matrix || matrix.length <= 1) return 0;

    // Detect header row index
    let headerRowIndex = 0;
    for (let r = 0; r < Math.min(10, matrix.length); r++) {
      const row = matrix[r] || [];
      const rowStr = row.map((c) => String(c || "").toUpperCase()).join(" ");
      if (rowStr.includes("NODE") || rowStr.includes("PORT") || rowStr.includes("KD")) {
        headerRowIndex = r;
        break;
      }
    }

    const rows = matrix.slice(headerRowIndex + 1);
    const itemsToInsert: Array<{
      nodeCode: string;
      dateKd: Date | null;
      dateKdRaw: string;
      dateKdFormatted: string | null;
      totalPort: number | null;
      usedPort: number | null;
      categoryKd: string | null;
    }> = [];

    for (const r of rows) {
      const nodeCode = toTrimmedString(r[0]);
      if (!nodeCode || nodeCode.toLowerCase() === "node_code" || nodeCode.toLowerCase() === "mã node") {
        continue;
      }

      const dateParsed = parseFlexibleDate(r[1]);
      const totalPort = parseImportInteger(r[2]);
      
      // Col 3 might be used_port or categoryKd depending on sheet format
      let usedPort = 0;
      let categoryKd = "";

      if (r.length >= 5) {
        usedPort = parseImportInteger(r[3]) ?? 0;
        categoryKd = toTrimmedString(r[4]);
      } else {
        categoryKd = toTrimmedString(r[3]);
      }

      if (!categoryKd && typeof r[4] !== "undefined") {
        categoryKd = toTrimmedString(r[4]);
      }

      itemsToInsert.push({
        nodeCode,
        dateKd: dateParsed.date,
        dateKdRaw: dateParsed.raw,
        dateKdFormatted: dateParsed.formatted,
        totalPort,
        usedPort,
        categoryKd: categoryKd || "Chưa phân loại",
      });
    }

    if (itemsToInsert.length === 0) return 0;

    await upsertNode0TbBatch(itemsToInsert);
    return itemsToInsert.length;
  } catch (err) {
    console.error("Error seeding Node0Tb:", err);
    return 0;
  }
}

export async function upsertNode0TbBatch(
  items: Array<{
    nodeCode: string;
    dateKd: Date | null;
    dateKdRaw: string;
    dateKdFormatted: string | null;
    totalPort: number | null;
    usedPort: number | null;
    categoryKd: string | null;
    note?: string | null;
  }>
) {
  await ensureNode0TbTable();

  for (const item of items) {
    const id = crypto.randomUUID();
    const dateIso = item.dateKd ? item.dateKd.toISOString() : null;
    const nodeCode = item.nodeCode.trim();
    const categoryKd = (item.categoryKd || "").trim() || "Chưa phân loại";

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "Node0Tb" ("id", "nodeCode", "dateKd", "dateKdRaw", "dateKdFormatted", "totalPort", "usedPort", "categoryKd", "note", "createdAt", "updatedAt")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT("nodeCode") DO UPDATE SET
        "dateKd" = excluded."dateKd",
        "dateKdRaw" = excluded."dateKdRaw",
        "dateKdFormatted" = excluded."dateKdFormatted",
        "totalPort" = excluded."totalPort",
        "usedPort" = excluded."usedPort",
        "categoryKd" = excluded."categoryKd",
        "note" = excluded."note",
        "updatedAt" = CURRENT_TIMESTAMP
      `,
      id,
      nodeCode,
      dateIso,
      item.dateKdRaw,
      item.dateKdFormatted,
      item.totalPort,
      item.usedPort ?? 0,
      categoryKd,
      item.note || null
    );
  }
}

export async function clearNode0TbData() {
  await ensureNode0TbTable();
  await prisma.$executeRawUnsafe(`DELETE FROM "Node0Tb"`);
}

function normalizeNodeCode(code: string) {
  return code.trim().toUpperCase();
}

function toBaseNodeCode(code: string) {
  return code.replace(/-SP\d+$/i, "").trim();
}

export async function getNode0TbList(options?: {
  search?: string;
  category?: string;
}): Promise<Node0TbApiResponse> {
  await ensureNode0TbTable();
  await seedNode0TbIfEmpty();

  // 1. Fetch all Node0Tb rows
  const node0TbRows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      nodeCode: string;
      dateKd: string | null;
      dateKdRaw: string | null;
      dateKdFormatted: string | null;
      totalPort: number | null;
      usedPort: number | null;
      categoryKd: string | null;
      note: string | null;
      createdAt: string;
      updatedAt: string;
    }>
  >(`SELECT * FROM "Node0Tb" ORDER BY "nodeCode" ASC`);

  // 2. Fetch all Nodes with coordinates for fast in-memory coordinate lookup
  const dbNodes = await prisma.node.findMany({
    select: {
      name: true,
      latitude: true,
      longitude: true,
      description: true,
    },
  });

  const nodeMap = new Map<string, { latitude: number; longitude: number; description: string | null }>();
  for (const n of dbNodes) {
    if (n.latitude !== null && n.longitude !== null) {
      const normName = normalizeNodeCode(n.name);
      nodeMap.set(normName, {
        latitude: n.latitude,
        longitude: n.longitude,
        description: n.description,
      });
    }
  }

  // 3. Map coordinates to Node0Tb rows
  const allMappedItems: Node0TbItem[] = node0TbRows.map((row) => {
    const code = normalizeNodeCode(row.nodeCode);
    const baseCode = normalizeNodeCode(toBaseNodeCode(row.nodeCode));
    
    let match = nodeMap.get(code);
    if (!match) {
      match = nodeMap.get(baseCode);
    }
    if (!match) {
      // Try prefix match
      for (const [k, v] of nodeMap.entries()) {
        if (k.startsWith(baseCode) || baseCode.startsWith(k)) {
          match = v;
          break;
        }
      }
    }

    return {
      id: row.id,
      nodeCode: row.nodeCode,
      dateKd: row.dateKd,
      dateKdFormatted: row.dateKdFormatted || row.dateKdRaw || "-",
      totalPort: row.totalPort,
      usedPort: row.usedPort ?? 0,
      categoryKd: row.categoryKd || "Chưa phân loại",
      note: row.note,
      latitude: match?.latitude ?? null,
      longitude: match?.longitude ?? null,
      nodeDescription: match?.description ?? null,
      hasCoordinates: Boolean(match && match.latitude !== null && match.longitude !== null),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });

  // 4. Calculate Stats
  const categoryCounts = new Map<string, { total: number; withCoords: number }>();
  let totalWithCoords = 0;

  for (const item of allMappedItems) {
    const cat = item.categoryKd || "Chưa phân loại";
    const current = categoryCounts.get(cat) || { total: 0, withCoords: 0 };
    current.total++;
    if (item.hasCoordinates) {
      current.withCoords++;
      totalWithCoords++;
    }
    categoryCounts.set(cat, current);
  }

  const categoryStats = Array.from(categoryCounts.entries()).map(([cat, stat]) => ({
    category: cat,
    count: stat.total,
    withCoords: stat.withCoords,
  }));

  const allCategories = Array.from(categoryCounts.keys());

  // 5. Apply filters
  let filtered = allMappedItems;
  if (options?.category && options.category !== "ALL") {
    filtered = filtered.filter(
      (item) => (item.categoryKd || "").toLowerCase() === options.category!.toLowerCase()
    );
  }

  if (options?.search) {
    const s = options.search.trim().toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.nodeCode.toLowerCase().includes(s) ||
        (item.categoryKd && item.categoryKd.toLowerCase().includes(s)) ||
        (item.nodeDescription && item.nodeDescription.toLowerCase().includes(s))
    );
  }

  return {
    nodes: filtered,
    stats: {
      total: allMappedItems.length,
      withCoords: totalWithCoords,
      withoutCoords: allMappedItems.length - totalWithCoords,
      categories: categoryStats,
    },
    categories: allCategories,
  };
}
