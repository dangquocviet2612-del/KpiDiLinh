import { describe, expect, it } from "vitest";
import { detectCustomerDuplicates, haversineDistanceMeters } from "@/lib/customer-duplicates";
const row = { id: "one", name: "Nguyễn Văn A", account: null, ctvCode: "ctv", phone: null, latitude: 0, longitude: 0 };
describe("customer duplicates", () => {
 it("normalizes Unicode, case and spaces; includes missing accounts", () => {
  expect(detectCustomerDuplicates({ name: "  NGUYỄN   VĂN A ".normalize("NFD"), latitude: 0, longitude: 0 }, [row])).toMatchObject([{ id: "one", account: null, distanceMeters: 0, matchReasons: ["name"] }]);
 });
 it("includes the 300m boundary and excludes farther same-name customers", () => {
  const latitude = 300 / 6371000 * 180 / Math.PI;
  expect(haversineDistanceMeters(0, 0, latitude, 0)).toBeCloseTo(300, 8);
  expect(detectCustomerDuplicates({ name: row.name, latitude, longitude: 0 }, [row])).toHaveLength(1);
  expect(detectCustomerDuplicates({ name: row.name, latitude: latitude * 1.0001, longitude: 0 }, [row])).toHaveLength(0);
 });
 it("warns when either coordinate pair is missing and never coerces missing to zero", () => {
  expect(detectCustomerDuplicates({ name: row.name }, [row])[0].distanceMeters).toBeNull();
  expect(detectCustomerDuplicates({ name: row.name, latitude: 0, longitude: 0 }, [{ ...row, latitude: null }])[0].distanceMeters).toBeNull();
 });
 it("matches normalized phone across different names and remote locations", () => {
  expect(detectCustomerDuplicates({ name: "Other", phone: "0901 234-567", latitude: 80, longitude: 80 }, [{ ...row, phone: "+84 901.234.567" }])[0].matchReasons).toEqual(["phone"]);
 });
 it("does not match empty names or empty phones", () => {
  expect(detectCustomerDuplicates({ name: "", phone: "" }, [{ ...row, name: "" }])).toEqual([]);
 });
 it("prioritizes missing account then distance and strips coordinates", () => {
  const results = detectCustomerDuplicates({ name: row.name, latitude: 0, longitude: 0 }, [{ ...row, id: "known", account: "acc" }, { ...row, id: "missing", latitude: 0.001 }]);
  expect(results.map(r => r.id)).toEqual(["missing", "known"]);
  expect(results[0]).not.toHaveProperty("latitude");
 });
});
