export interface CustomerFilters {
  search: string;
  subscriberType: string;
  billingType: string;
  prepaidPeriod: string;
  ctvCode: string;
  expirationFilter: string;
  status: string;
}

export interface CustomerQueryState {
  page: number;
  limit: number;
  filters: CustomerFilters;
}

export const defaultCustomerFilters: CustomerFilters = {
  search: "", subscriberType: "", billingType: "", prepaidPeriod: "", ctvCode: "", expirationFilter: "", status: "",
};

const enumFilters = {
  subscriberType: ["FIXED", "MOBILE"], billingType: ["PREPAID", "MONTHLY"], prepaidPeriod: ["3", "6", "12"],
  expirationFilter: ["soon", "expiringThisMonth", "expired"], status: ["Hoat dong", "Roi mang"],
};
const ownedParams = ["q", "search", "page", "limit", ...Object.keys(enumFilters), "ctvCode"];
const singleValue = (params: URLSearchParams, key: string) => params.getAll(key).length === 1 ? params.get(key)! : "";

export function parseCustomerQuery(search: string, fixedFilters: Partial<CustomerFilters> = {}): CustomerQueryState {
  const params = new URLSearchParams(search);
  const filters = { ...defaultCustomerFilters, search: singleValue(params, params.has("q") ? "q" : "search"), ctvCode: singleValue(params, "ctvCode") };
  for (const [key, values] of Object.entries(enumFilters)) {
    const value = singleValue(params, key);
    if (values.includes(value)) filters[key as keyof typeof enumFilters] = value;
  }
  const rawPage = singleValue(params, "page"); const rawLimit = singleValue(params, "limit");
  const page = /^[1-9]\d*$/.test(rawPage) ? Math.min(Number(rawPage), 10_000) : 1;
  const limit = ["10", "20", "50", "100"].includes(rawLimit) ? Number(rawLimit) : 10;
  return { page, limit, filters: { ...filters, ...fixedFilters } };
}

export function serializeCustomerQuery(current: URL, query: CustomerQueryState): string {
  const params = new URLSearchParams(current.search);
  for (const key of ownedParams) params.delete(key);
  if (query.page !== 1) params.set("page", String(query.page));
  if (query.limit !== 10) params.set("limit", String(query.limit));
  if (query.filters.search) params.set("q", query.filters.search);
  if (query.filters.ctvCode) params.set("ctvCode", query.filters.ctvCode);
  for (const [key, values] of Object.entries(enumFilters)) {
    const value = query.filters[key as keyof typeof enumFilters]; if (values.includes(value)) params.set(key, value);
  }
  const search = params.toString();
  return current.pathname + (search ? "?" + search : "") + current.hash;
}
