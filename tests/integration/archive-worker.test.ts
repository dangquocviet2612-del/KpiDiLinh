import { createClient, type Client, type InValue } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), execute: vi.fn(), transaction: vi.fn(), ensure: vi.fn(), invalidate: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRawUnsafe: mocks.query, $executeRawUnsafe: mocks.execute, $transaction: mocks.transaction },
}));
vi.mock("@/lib/kpi-db", () => ({ ensureKpiTables: mocks.ensure }));
vi.mock("@/lib/kpi-cache", () => ({ clearCacheByPrefix: mocks.invalidate }));

import {
  cancelArchiveConfirmation, checkAndPurgeExpired, purgeMonthData, upsertArchiveConfirmation,
} from "@/lib/archive";

type TransactionClient = { $executeRawUnsafe: (sql: string, ...args: InValue[]) => Promise<number> };
type Purge = (month: string, options?: { requireExpired: boolean }) => Promise<boolean>;

const month = "2020-01";
let database: Client;
let statements: string[];
let beforeTransaction: (() => Promise<void>) | undefined;
let failDelete: boolean;
let transactionTail: Promise<unknown>;

async function seedArchive(archiveMonth = month, purgeAfter = "2000-01-01 00:00:00") {
  await database.execute({
    sql: 'INSERT INTO "ArchiveLog" ("archiveMonth", "archivedBy", "purgeAfter") VALUES (?, ?, ?)',
    args: [archiveMonth, "fixture-admin", purgeAfter],
  });
}

async function remainingRows() {
  const result = await database.execute('SELECT (SELECT COUNT(*) FROM "KpiDailyResult") + (SELECT COUNT(*) FROM "CuocDailyResult") AS total');
  return Number(result.rows[0].total);
}

async function purgedAt() {
  const result = await database.execute({ sql: 'SELECT "purgedAt" FROM "ArchiveLog" WHERE "archiveMonth" = ?', args: [month] });
  return result.rows[0]?.purgedAt;
}

beforeEach(async () => {
  vi.resetAllMocks();
  database = createClient({ url: "file::memory:" });
  await database.executeMultiple(`
    CREATE TABLE "ArchiveLog" (
      "id" INTEGER PRIMARY KEY, "archiveMonth" TEXT NOT NULL UNIQUE,
      "archivedBy" TEXT NOT NULL, "archivedAt" TEXT DEFAULT CURRENT_TIMESTAMP,
      "purgeAfter" TEXT NOT NULL, "purgedAt" TEXT,
      "kpiRecordCount" INTEGER DEFAULT 0, "cuocRecordCount" INTEGER DEFAULT 0, "fileName" TEXT
    );
    CREATE TABLE "KpiDailyResult" ("reportDate" TEXT);
    CREATE TABLE "CuocDailyResult" ("reportDate" TEXT);
    INSERT INTO "KpiDailyResult" VALUES ('2020-01-15'), ('2020-02-15');
    INSERT INTO "CuocDailyResult" VALUES ('2020-01-15'), ('2020-02-15');
  `);
  statements = [];
  beforeTransaction = undefined;
  failDelete = false;
  transactionTail = Promise.resolve();
  mocks.query.mockImplementation(async (sql: string, ...args: InValue[]) => (await database.execute({ sql, args })).rows);
  mocks.execute.mockImplementation(async (sql: string, ...args: InValue[]) => (await database.execute({ sql, args })).rowsAffected);
  mocks.transaction.mockImplementation((callback: (transaction: TransactionClient) => Promise<unknown>) => {
    const operation = transactionTail.then(async () => {
      const hook = beforeTransaction;
      beforeTransaction = undefined;
      await hook?.();
      await database.execute("BEGIN IMMEDIATE");
      try {
        const result = await callback({
          $executeRawUnsafe: async (sql, ...args) => {
            statements.push(sql.trim());
            if (failDelete && sql.includes('DELETE FROM "CuocDailyResult"')) throw new Error("fixture deletion failure");
            return (await database.execute({ sql, args })).rowsAffected;
          },
        });
        await database.execute("COMMIT");
        return result;
      } catch (error) {
        await database.execute("ROLLBACK");
        throw error;
      }
    });
    transactionTail = operation.catch(() => undefined);
    return operation;
  });
});

afterEach(() => database.close());

describe("atomic SQLite archive purge", () => {
  it("first claims the unpurged archive before deleting inside one transaction", async () => {
    await seedArchive();
    await purgeMonthData(month);
    expect(statements[0]).toMatch(/^UPDATE "ArchiveLog"/);
    expect(await purgedAt()).toBeTruthy();
    expect(await remainingRows()).toBe(2);
  });

  it("two workers delete a month only once and report only the winning purge", async () => {
    await seedArchive();
    expect(await Promise.all([checkAndPurgeExpired(), checkAndPurgeExpired()])).toEqual([1, 0]);
    expect(statements.filter((sql) => sql.startsWith('DELETE FROM "KpiDailyResult"'))).toHaveLength(1);
    expect(await remainingRows()).toBe(2);
  });

  it("a restarted worker skips a committed purge", async () => {
    await seedArchive();
    expect(await checkAndPurgeExpired()).toBe(1);
    expect(await checkAndPurgeExpired()).toBe(0);
    expect(statements.filter((sql) => sql.startsWith("DELETE"))).toHaveLength(2);
  });

  it("a cancellation after due selection but before claim prevents scheduled deletion", async () => {
    await seedArchive();
    beforeTransaction = async () => { await cancelArchiveConfirmation(month); };
    expect(await checkAndPurgeExpired()).toBe(0);
    expect(await remainingRows()).toBe(4);
    expect(statements.filter((sql) => sql.startsWith("DELETE"))).toHaveLength(0);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("reconfirmation after due selection but before claim resets expiry and prevents deletion", async () => {
    await seedArchive();
    beforeTransaction = async () => { await upsertArchiveConfirmation(month, "fixture-admin", "fixture.xlsx"); };
    expect(await checkAndPurgeExpired()).toBe(0);
    expect(await remainingRows()).toBe(4);
    expect(await purgedAt()).toBeNull();
  });

  it("unexpired archives cannot be purged by the default scheduled or bulk path", async () => {
    await seedArchive(month, "2999-01-01 00:00:00");
    expect(await purgeMonthData(month)).toBe(false);
    expect(await remainingRows()).toBe(4);
    expect(await purgedAt()).toBeNull();
  });

  it("explicit manual purge can bypass expiry but cannot purge twice", async () => {
    await seedArchive(month, "2999-01-01 00:00:00");
    expect(await (purgeMonthData as Purge)(month, { requireExpired: false })).toBe(true);
    expect(await (purgeMonthData as Purge)(month, { requireExpired: false })).toBe(false);
    expect(await remainingRows()).toBe(2);
  });

  it("manual purge requires an existing archive", async () => {
    expect(await (purgeMonthData as Purge)(month, { requireExpired: false })).toBe(false);
    expect(await remainingRows()).toBe(4);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("invalid calendar months cannot delete data from a different month", async () => {
    await seedArchive("2019-13");
    await expect((purgeMonthData as Purge)("2019-13", { requireExpired: false })).rejects.toThrow("Invalid month");
    expect(await remainingRows()).toBe(4);
  });

  it("failed deletion rolls back the claim and the first delete, allowing a safe retry", async () => {
    await seedArchive();
    failDelete = true;
    await expect(checkAndPurgeExpired()).rejects.toThrow("fixture deletion failure");
    expect(await purgedAt()).toBeNull();
    expect(await remainingRows()).toBe(4);
    expect(mocks.invalidate).not.toHaveBeenCalled();
    failDelete = false;
    expect(await checkAndPurgeExpired()).toBe(1);
    expect(await remainingRows()).toBe(2);
  });

  it("a failure on a later month preserves the committed month and is restart-safe", async () => {
    await seedArchive();
    await seedArchive("2020-02");
    const execute = mocks.transaction.getMockImplementation()!;
    let attempted = 0;
    mocks.transaction.mockImplementation((...args: unknown[]) => {
      attempted += 1;
      if (attempted === 2) failDelete = true;
      return execute(...args);
    });
    await expect(checkAndPurgeExpired()).rejects.toThrow("fixture deletion failure");
    expect(await purgedAt()).toBeTruthy();
    expect(await remainingRows()).toBe(2);
    failDelete = false;
    expect(await checkAndPurgeExpired()).toBe(1);
    expect(await remainingRows()).toBe(0);
  });

  it("a stale reconfirmation cannot clear a purge already committed by a worker", async () => {
    await seedArchive();
    const execute = mocks.execute.getMockImplementation()!;
    mocks.execute.mockImplementation(async (sql: string, ...args: InValue[]) => {
      if (sql.includes('INSERT INTO "ArchiveLog"')) await purgeMonthData(month);
      return execute(sql, ...args);
    });
    await expect(upsertArchiveConfirmation(month, "fixture-admin", "fixture.xlsx")).rejects.toThrow(/purged/i);
    expect(await purgedAt()).toBeTruthy();
  });

  it("cancellation reports failure when the worker claims the archive first", async () => {
    await seedArchive();
    const execute = mocks.execute.getMockImplementation()!;
    mocks.execute.mockImplementation(async (sql: string, ...args: InValue[]) => {
      if (sql.includes('DELETE FROM "ArchiveLog"')) await purgeMonthData(month);
      return execute(sql, ...args);
    });
    expect(await cancelArchiveConfirmation(month)).toBe(false);
    expect(await purgedAt()).toBeTruthy();
  });
});
