import { prisma } from "@/lib/prisma";
import { getCache, setCache } from "@/lib/kpi-cache";
import { getAccessibleCtvCodes } from "@/lib/scope";

type ScopeOptions = {
  role: string;
  sessionName: string;
  managerCode?: string;
};

type SessionLike = {
  user?: {
    role?: string;
    name?: string | null;
  };
} | null;

function normalizeScopeOptions(options: ScopeOptions) {
  return {
    role: String(options.role || "").trim().toUpperCase(),
    sessionName: String(options.sessionName || "").trim(),
    managerCode: String(options.managerCode || "").trim(),
  };
}

function getScopeCacheKey({ role, sessionName, managerCode }: ReturnType<typeof normalizeScopeOptions>) {
  if (role === "ADMIN") {
    return managerCode ? `prepaid:scope|ADMIN|manager:${managerCode}` : "prepaid:scope|ADMIN|all";
  }
  if (role === "MANAGER") {
    return `prepaid:scope|MANAGER|${sessionName}`;
  }
  if (role === "CTV") {
    return `prepaid:scope|CTV|${sessionName}`;
  }
  return `prepaid:scope|OTHER|${sessionName}|${managerCode}`;
}

export async function getScopedPrepaidCtvUsers(options: ScopeOptions): Promise<string[]> {
  const normalized = normalizeScopeOptions(options);
  const cacheKey = getScopeCacheKey(normalized);
  const cached = getCache<string[]>(cacheKey);
  if (cached) return cached;

  let users: string[] = [];
  if (normalized.role === "ADMIN") {
    const where: any = { role: "CTV" };
    if (normalized.managerCode) where.managerCode = normalized.managerCode;
    try {
      const rows = await prisma.user.findMany({
        where,
        select: { username: true },
        orderBy: { username: "asc" },
      });
      users = rows.map((row) => String(row.username || "").trim()).filter(Boolean);
    } catch {
      const rows = await prisma.$queryRawUnsafe<Array<{ username: string }>>(
        normalized.managerCode
          ? `SELECT username FROM "User" WHERE role = 'CTV' AND managerCode = ? ORDER BY username ASC`
          : `SELECT username FROM "User" WHERE role = 'CTV' ORDER BY username ASC`,
        ...(normalized.managerCode ? [normalized.managerCode] : [])
      );
      users = rows.map((row) => String(row.username || "").trim()).filter(Boolean);
    }
  } else if (normalized.role === "MANAGER") {
    users = ((await getAccessibleCtvCodes({
      user: { role: normalized.role, name: normalized.sessionName },
    } as SessionLike)) || [])
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  } else if (normalized.role === "CTV") {
    users = normalized.sessionName ? [normalized.sessionName] : [];
  }

  setCache(cacheKey, users, 30_000);
  return users;
}

async function getLatestDateForScope(params: {
  table: "KpiDailyResult" | "CuocDailyResult" | "CdtTransaction";
  dateColumn: "reportDate" | "transactionDate";
  userColumn: "ctvUser";
  scope: ScopeOptions;
}) {
  const scope = normalizeScopeOptions(params.scope);
  const cacheKey = `prepaid:latest|${params.table}|${scope.role}|${scope.sessionName}|${scope.managerCode}`;
  const cached = getCache<string>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  let latestDate = "";
  if (scope.role === "ADMIN" && !scope.managerCode) {
    const rows = await prisma.$queryRawUnsafe<Array<{ reportDate?: string; transactionDate?: string }>>(
      `SELECT "${params.dateColumn}" FROM "${params.table}" ORDER BY "${params.dateColumn}" DESC LIMIT 1`
    );
    latestDate = String(rows[0]?.[params.dateColumn] || "").trim();
  } else {
    const scopedUsers = await getScopedPrepaidCtvUsers(scope);
    if (!scopedUsers.length) {
      setCache(cacheKey, "", 30_000);
      return "";
    }
    const rows = await prisma.$queryRawUnsafe<Array<{ reportDate?: string; transactionDate?: string }>>(
      `SELECT "${params.dateColumn}" FROM "${params.table}" WHERE "${params.userColumn}" IN (${scopedUsers
        .map(() => "?")
        .join(",")}) ORDER BY "${params.dateColumn}" DESC LIMIT 1`,
      ...scopedUsers
    );
    latestDate = String(rows[0]?.[params.dateColumn] || "").trim();
  }

  setCache(cacheKey, latestDate, 30_000);
  return latestDate;
}

async function getLatestDateForSingleUser(params: {
  table: "KpiDailyResult" | "CuocDailyResult" | "CdtTransaction";
  dateColumn: "reportDate" | "transactionDate";
  userColumn: "ctvUser";
  userValue: string;
}) {
  const normalizedUserValue = String(params.userValue || "").trim();
  if (!normalizedUserValue) return "";

  const cacheKey = `prepaid:latest-user|${params.table}|${normalizedUserValue}`;
  const cached = getCache<string>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const rows = await prisma.$queryRawUnsafe<Array<{ reportDate?: string; transactionDate?: string }>>(
    `SELECT "${params.dateColumn}" FROM "${params.table}" WHERE "${params.userColumn}" = ? ORDER BY "${params.dateColumn}" DESC LIMIT 1`,
    normalizedUserValue
  );
  const latestDate = String(rows[0]?.[params.dateColumn] || "").trim();
  setCache(cacheKey, latestDate, 30_000);
  return latestDate;
}

export function getLatestKpiReportDate(scope: ScopeOptions) {
  return getLatestDateForScope({
    table: "KpiDailyResult",
    dateColumn: "reportDate",
    userColumn: "ctvUser",
    scope,
  });
}

export function getLatestKpiReportDateForCtv(ctvUser: string) {
  return getLatestDateForSingleUser({
    table: "KpiDailyResult",
    dateColumn: "reportDate",
    userColumn: "ctvUser",
    userValue: ctvUser,
  });
}

export function getLatestCuocReportDate(scope: ScopeOptions) {
  return getLatestDateForScope({
    table: "CuocDailyResult",
    dateColumn: "reportDate",
    userColumn: "ctvUser",
    scope,
  });
}

export function getLatestCuocReportDateForCtv(ctvUser: string) {
  return getLatestDateForSingleUser({
    table: "CuocDailyResult",
    dateColumn: "reportDate",
    userColumn: "ctvUser",
    userValue: ctvUser,
  });
}

export function getLatestCdtTransactionDate(scope: ScopeOptions) {
  return getLatestDateForScope({
    table: "CdtTransaction",
    dateColumn: "transactionDate",
    userColumn: "ctvUser",
    scope,
  });
}

export function getLatestCdtTransactionDateForCtv(ctvUser: string) {
  return getLatestDateForSingleUser({
    table: "CdtTransaction",
    dateColumn: "transactionDate",
    userColumn: "ctvUser",
    userValue: ctvUser,
  });
}

export async function getLatestManagerKpiReportDate(managerUser?: string) {
  const normalizedManagerUser = String(managerUser || "").trim().toUpperCase();
  const cacheKey = `prepaid:latest|ManagerKpiDailyResult|${normalizedManagerUser || "all"}`;
  const cached = getCache<string>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const rows = await prisma.$queryRawUnsafe<Array<{ reportDate: string }>>(
    normalizedManagerUser
      ? `SELECT "reportDate" FROM "ManagerKpiDailyResult" WHERE UPPER("managerUser") = ? ORDER BY "reportDate" DESC LIMIT 1`
      : `SELECT "reportDate" FROM "ManagerKpiDailyResult" ORDER BY "reportDate" DESC LIMIT 1`,
    ...(normalizedManagerUser ? [normalizedManagerUser] : [])
  );
  const latestDate = String(rows[0]?.reportDate || "").trim();
  setCache(cacheKey, latestDate, 30_000);
  return latestDate;
}

export async function getCuocTargetRatePercent() {
  const cacheKey = "prepaid:cuoc-config";
  const cached = getCache<number>(cacheKey);
  if (typeof cached === "number") return cached;

  const rows = await prisma.$queryRawUnsafe<Array<{ targetRatePercent: number }>>(
    `SELECT "targetRatePercent" FROM "CuocConfig" WHERE "id" = 1`
  );
  const targetRatePercent = Number(rows[0]?.targetRatePercent ?? 97.3);
  setCache(cacheKey, targetRatePercent, 300_000);
  return targetRatePercent;
}

export async function getLatestCuocCompletionForCtv(ctvUser: string) {
  const normalized = String(ctvUser || "").trim();
  if (!normalized) return 0;

  const cacheKey = `prepaid:cuoc-latest-ctv|${normalized}`;
  const cached = getCache<number>(cacheKey);
  if (typeof cached === "number") return cached;

  const rows = await prisma.$queryRawUnsafe<Array<{ completionPercent: number | null }>>(
    `
    SELECT "completionPercent"
    FROM "CuocDailyResult"
    WHERE "ctvUser" = ?
    ORDER BY "reportDate" DESC
    LIMIT 1
    `,
    normalized
  );
  const completionPercent = Number(rows[0]?.completionPercent ?? 0);
  setCache(cacheKey, completionPercent, 30_000);
  return completionPercent;
}
