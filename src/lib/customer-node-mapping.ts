import { prisma } from "@/lib/prisma";
import { ensureCustomerNodeMappingTable } from "@/lib/customer-node-mapping-db";
import { findNearestNodeName } from "@/lib/nodeUtils";
import { toTrimmedString } from "@/lib/import-utils";

type CustomerNodeMappingInput = {
  account: string;
  nodeName: string;
  accountAddress?: string | null;
};

type MappingRow = {
  accountKey: string;
  nodeName: string;
  accountAddress?: string | null;
};

export function normalizeCustomerAccountKey(value: unknown) {
  return toTrimmedString(value).toLowerCase();
}

export async function getMappedNodeNameForAccount(account: unknown) {
  const accountKey = normalizeCustomerAccountKey(account);
  if (!accountKey) return null;

  await ensureCustomerNodeMappingTable();
  const rows = await prisma.$queryRawUnsafe<Array<MappingRow>>(
    `SELECT "accountKey", "nodeName" FROM "CustomerNodeMapping" WHERE "accountKey" = ? LIMIT 1`,
    accountKey,
  );

  return rows[0]?.nodeName || null;
}

export async function getMappedNodeNamesByAccounts(accounts: unknown[]) {
  const uniqueAccountKeys = Array.from(
    new Set(
      accounts
        .map((value) => normalizeCustomerAccountKey(value))
        .filter(Boolean),
    ),
  );

  const mapping = new Map<string, string>();
  if (uniqueAccountKeys.length === 0) return mapping;

  await ensureCustomerNodeMappingTable();

  const chunkSize = 300;
  for (let index = 0; index < uniqueAccountKeys.length; index += chunkSize) {
    const chunk = uniqueAccountKeys.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await prisma.$queryRawUnsafe<Array<MappingRow>>(
      `SELECT "accountKey", "nodeName" FROM "CustomerNodeMapping" WHERE "accountKey" IN (${placeholders})`,
      ...chunk,
    );

    for (const row of rows) {
      mapping.set(row.accountKey, row.nodeName);
    }
  }

  return mapping;
}

async function getExistingCustomerNodeMappingsByAccounts(accounts: unknown[]) {
  const uniqueAccountKeys = Array.from(
    new Set(
      accounts
        .map((value) => normalizeCustomerAccountKey(value))
        .filter(Boolean),
    ),
  );

  const mapping = new Map<string, { nodeName: string; accountAddress: string | null }>();
  if (uniqueAccountKeys.length === 0) return mapping;

  await ensureCustomerNodeMappingTable();

  const chunkSize = 300;
  for (let index = 0; index < uniqueAccountKeys.length; index += chunkSize) {
    const chunk = uniqueAccountKeys.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await prisma.$queryRawUnsafe<Array<MappingRow>>(
      `SELECT "accountKey", "nodeName", "accountAddress" FROM "CustomerNodeMapping" WHERE "accountKey" IN (${placeholders})`,
      ...chunk,
    );

    for (const row of rows) {
      mapping.set(row.accountKey, {
        nodeName: row.nodeName,
        accountAddress: toTrimmedString(row.accountAddress) || null,
      });
    }
  }

  return mapping;
}

export async function upsertCustomerNodeMappings(rows: CustomerNodeMappingInput[]) {
  await ensureCustomerNodeMappingTable();

  const deduped = new Map<string, CustomerNodeMappingInput>();
  for (const row of rows) {
    const account = toTrimmedString(row.account);
    const nodeName = toTrimmedString(row.nodeName);
    const accountAddress = toTrimmedString(row.accountAddress) || null;
    const accountKey = normalizeCustomerAccountKey(account);
    if (!accountKey || !nodeName) continue;
    deduped.set(accountKey, { account, nodeName, accountAddress });
  }

  const finalRows = Array.from(deduped.entries()).map(([accountKey, value]) => ({
    accountKey,
    account: value.account,
    nodeName: value.nodeName,
    accountAddress: value.accountAddress || null,
  }));

  if (finalRows.length === 0) {
    return { inserted: 0, updated: 0, total: 0, changedAccountKeys: [] as string[] };
  }

  const existing = await getExistingCustomerNodeMappingsByAccounts(finalRows.map((row) => row.accountKey));
  let inserted = 0;
  let updated = 0;

  const rowsToWrite = finalRows.filter((row) => {
    const existingRow = existing.get(row.accountKey);
    if (!existingRow) return true;

    const incomingAddress = row.accountAddress || null;
    const existingAddress = existingRow.accountAddress || null;

    if (existingRow.nodeName !== row.nodeName) return true;
    if (incomingAddress !== null && incomingAddress !== existingAddress) return true;

    return false;
  });

  if (rowsToWrite.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      total: finalRows.length,
      changedAccountKeys: [] as string[],
    };
  }

  const batchSize = 180;
  for (let index = 0; index < rowsToWrite.length; index += batchSize) {
    const chunk = rowsToWrite.slice(index, index + batchSize);
    const valuesSql = chunk.map(() => `(?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).join(", ");
    const params = chunk.flatMap((row) => [
      crypto.randomUUID(),
      row.account,
      row.accountKey,
      row.nodeName,
      row.accountAddress,
    ]);

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "CustomerNodeMapping" ("id", "account", "accountKey", "nodeName", "accountAddress", "createdAt", "updatedAt")
        VALUES ${valuesSql}
        ON CONFLICT("accountKey") DO UPDATE SET
          "account" = excluded."account",
          "nodeName" = excluded."nodeName",
          "accountAddress" = COALESCE(excluded."accountAddress", "CustomerNodeMapping"."accountAddress"),
          "updatedAt" = CURRENT_TIMESTAMP
      `,
      ...params,
    );
  }

  for (const row of rowsToWrite) {
    if (existing.has(row.accountKey)) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  return {
    inserted,
    updated,
    total: finalRows.length,
    changedAccountKeys: rowsToWrite.map((row) => row.accountKey),
  };
}

export async function syncMappedNodesToCustomers() {
  await ensureCustomerNodeMappingTable();

  const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
    SELECT COUNT(*) as count
    FROM "Customer" c
    INNER JOIN "CustomerNodeMapping" m
      ON LOWER(TRIM(COALESCE(c."account", ''))) = m."accountKey"
    WHERE COALESCE(c."nodeName", '') <> m."nodeName"
  `);

  const affectedCustomers = Number(rows[0]?.count || 0);

  await prisma.$executeRawUnsafe(`
    UPDATE "Customer"
    SET "nodeName" = (
      SELECT m."nodeName"
      FROM "CustomerNodeMapping" m
      WHERE m."accountKey" = LOWER(TRIM(COALESCE("Customer"."account", '')))
      LIMIT 1
    ),
    "updatedAt" = CURRENT_TIMESTAMP
    WHERE "account" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "CustomerNodeMapping" m
        WHERE m."accountKey" = LOWER(TRIM(COALESCE("Customer"."account", '')))
      )
  `);

  return affectedCustomers;
}

export async function syncMappedNodesToCustomersByAccounts(accounts: unknown[]) {
  await ensureCustomerNodeMappingTable();

  const accountKeys = Array.from(
    new Set(
      accounts
        .map((value) => normalizeCustomerAccountKey(value))
        .filter(Boolean),
    ),
  );

  if (accountKeys.length === 0) {
    return 0;
  }

  let affectedCustomers = 0;
  const chunkSize = 350;

  for (let index = 0; index < accountKeys.length; index += chunkSize) {
    const chunk = accountKeys.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");

    const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `
        SELECT COUNT(*) as count
        FROM "Customer" c
        INNER JOIN "CustomerNodeMapping" m
          ON LOWER(TRIM(COALESCE(c."account", ''))) = m."accountKey"
        WHERE LOWER(TRIM(COALESCE(c."account", ''))) IN (${placeholders})
          AND COALESCE(c."nodeName", '') <> m."nodeName"
      `,
      ...chunk,
    );

    affectedCustomers += Number(rows[0]?.count || 0);

    await prisma.$executeRawUnsafe(
      `
        UPDATE "Customer"
        SET "nodeName" = (
          SELECT m."nodeName"
          FROM "CustomerNodeMapping" m
          WHERE m."accountKey" = LOWER(TRIM(COALESCE("Customer"."account", '')))
          LIMIT 1
        ),
        "updatedAt" = CURRENT_TIMESTAMP
        WHERE LOWER(TRIM(COALESCE("Customer"."account", ''))) IN (${placeholders})
          AND EXISTS (
            SELECT 1
            FROM "CustomerNodeMapping" m
            WHERE m."accountKey" = LOWER(TRIM(COALESCE("Customer"."account", '')))
          )
      `,
      ...chunk,
    );
  }

  return affectedCustomers;
}

export async function resolvePreferredCustomerNodeName({
  explicitNodeName,
  account,
  latitude,
  longitude,
}: {
  explicitNodeName?: unknown;
  account?: unknown;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const explicit = toTrimmedString(explicitNodeName);
  if (explicit) return explicit;

  const mappedNodeName = await getMappedNodeNameForAccount(account);
  if (mappedNodeName) return mappedNodeName;

  if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined) {
    return findNearestNodeName(latitude, longitude);
  }

  return null;
}
