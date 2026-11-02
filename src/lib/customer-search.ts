import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Fold Unicode casing while preserving accents and canonical equivalence. */
export function normalizeCustomerSearch(value: string): string {
    return value.normalize("NFC").toLowerCase().normalize("NFC");
}

/**
 * SQLite LIKE only folds ASCII. Read minimal, scoped search fields, then return
 * matching IDs so the caller can still apply pagination/counts in the database.
 * This intentionally scans the accessible scope on searches; no candidate cap may
 * run before Unicode matching or it could silently omit customers.
 */
export async function findCustomerSearchIds(
    where: Prisma.CustomerWhereInput,
    query: string,
    includeAddress = false,
): Promise<string[]> {
    const customers = await prisma.customer.findMany({
        where,
        select: { id: true, name: true, phone: true, account: true, ctvCode: true, ...(includeAddress ? { address: true } : {}) },
    });
    const needle = normalizeCustomerSearch(query);
    return customers.filter(customer =>
        [customer.name, customer.phone, customer.account, customer.ctvCode, ...(includeAddress ? [customer.address] : [])]
            .some(value => value != null && normalizeCustomerSearch(value).includes(needle)),
    ).map(customer => customer.id);
}
