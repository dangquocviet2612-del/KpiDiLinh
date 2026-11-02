/** Only the minimal accessible customer projection is needed for duplicate detection. */
export type DuplicateCustomerRow = {
    id: string;
    name: string;
    account: string | null;
    ctvCode: string | null;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
};
export type DuplicateCustomerCandidate = Pick<DuplicateCustomerRow, "id" | "name" | "account" | "ctvCode" | "phone"> & {
    distanceMeters: number | null;
    matchReasons: ("name" | "phone")[];
};
export type DuplicateCustomerInput = {
    name: string;
    phone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
};
export const duplicateCustomerSelect = {
    id: true, name: true, account: true, ctvCode: true, phone: true,
    latitude: true, longitude: true,
} as const;

export function normalizeDuplicateName(value: string): string {
    return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("vi");
}
export function normalizeDuplicatePhone(value?: string | null): string {
    const digits = (value || "").replace(/\D/g, "");
    // Treat Vietnamese international and domestic notation as the same number.
    return digits.startsWith("84") && digits.length >= 11 ? `0${digits.slice(2)}` : digits;
}
function validCoordinates(latitude?: number | null, longitude?: number | null): latitude is number {
    return latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
/** Callers must scope rows before invoking this function; never query unrestricted candidates. */
export function detectCustomerDuplicates(input: DuplicateCustomerInput, rows: DuplicateCustomerRow[]): DuplicateCustomerCandidate[] {
    const name = normalizeDuplicateName(input.name);
    const phone = normalizeDuplicatePhone(input.phone);
    const candidates: DuplicateCustomerCandidate[] = [];
    for (const row of rows) {
        const distanceMeters = validCoordinates(input.latitude, input.longitude) && validCoordinates(row.latitude, row.longitude)
            ? haversineDistanceMeters(input.latitude!, input.longitude!, row.latitude!, row.longitude!) : null;
        const matchReasons: DuplicateCustomerCandidate["matchReasons"] = [];
        // Tolerate floating point error at exactly 300m, without rounding nearby distances.
        if (name && name === normalizeDuplicateName(row.name) && (distanceMeters === null || distanceMeters <= 300 + 1e-7)) matchReasons.push("name");
        if (phone && phone === normalizeDuplicatePhone(row.phone)) matchReasons.push("phone");
        if (matchReasons.length) candidates.push({ id: row.id, name: row.name, account: row.account, ctvCode: row.ctvCode, phone: row.phone, distanceMeters, matchReasons });
    }
    return candidates.sort((a, b) => Number(Boolean(a.account?.trim())) - Number(Boolean(b.account?.trim()))
        || (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) || a.id.localeCompare(b.id));
}
