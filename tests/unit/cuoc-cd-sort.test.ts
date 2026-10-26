import { describe, it, expect } from "vitest";
import { sortCuocCdRows, type CuocCdRow } from "@/lib/cuoc-cd";

describe("sortCuocCdRows", () => {
  const sampleRows: CuocCdRow[] = [
    {
      ctvUser: "ctv_b",
      employeeCodeRaw: "NV02",
      managerCodeRaw: "QL01",
      dauKy: 150,
      luyKe: 140,
      thuaThieu: 10,
      tonChuaThu: 10,
    },
    {
      ctvUser: "ctv_a",
      employeeCodeRaw: "NV01",
      managerCodeRaw: "QL01",
      dauKy: 200,
      luyKe: 195,
      thuaThieu: 4,
      tonChuaThu: 5,
    },
    {
      ctvUser: "ctv_c",
      employeeCodeRaw: "NV10",
      managerCodeRaw: "QL02",
      dauKy: 100,
      luyKe: 100,
      thuaThieu: -1,
      tonChuaThu: 0,
    },
    {
      ctvUser: "ctv_d",
      employeeCodeRaw: "NV03",
      managerCodeRaw: "QL02",
      dauKy: 200,
      luyKe: 195,
      thuaThieu: 4,
      tonChuaThu: 5,
    },
  ];

  it("returns unchanged shallow copy if field is null", () => {
    const sorted = sortCuocCdRows(sampleRows, null);
    expect(sorted).toEqual(sampleRows);
    expect(sorted).not.toBe(sampleRows);
  });

  it("sorts by employeeCodeRaw asc and desc with natural numeric order", () => {
    const asc = sortCuocCdRows(sampleRows, "employeeCodeRaw", "asc");
    expect(asc.map((r) => r.employeeCodeRaw)).toEqual(["NV01", "NV02", "NV03", "NV10"]);

    const desc = sortCuocCdRows(sampleRows, "employeeCodeRaw", "desc");
    expect(desc.map((r) => r.employeeCodeRaw)).toEqual(["NV10", "NV03", "NV02", "NV01"]);
  });

  it("sorts by dauKy asc and desc with tie-breaker by employeeCodeRaw", () => {
    const desc = sortCuocCdRows(sampleRows, "dauKy", "desc");
    // NV01 and NV03 both have dauKy=200, broken by employeeCodeRaw asc: NV01 then NV03
    expect(desc.map((r) => r.employeeCodeRaw)).toEqual(["NV01", "NV03", "NV02", "NV10"]);

    const asc = sortCuocCdRows(sampleRows, "dauKy", "asc");
    expect(asc.map((r) => r.employeeCodeRaw)).toEqual(["NV10", "NV02", "NV01", "NV03"]);
  });

  it("sorts by thuaThieu (shortage) desc (worst shortage first) and asc (best achieved first)", () => {
    const desc = sortCuocCdRows(sampleRows, "thuaThieu", "desc");
    // NV02 (10), NV01 (4), NV03 (4), NV10 (-1)
    expect(desc.map((r) => r.employeeCodeRaw)).toEqual(["NV02", "NV01", "NV03", "NV10"]);

    const asc = sortCuocCdRows(sampleRows, "thuaThieu", "asc");
    expect(asc.map((r) => r.employeeCodeRaw)).toEqual(["NV10", "NV01", "NV03", "NV02"]);
  });

  it("sorts by tonChuaThu desc and asc", () => {
    const desc = sortCuocCdRows(sampleRows, "tonChuaThu", "desc");
    // NV02 (10), NV01 (5), NV03 (5), NV10 (0)
    expect(desc.map((r) => r.employeeCodeRaw)).toEqual(["NV02", "NV01", "NV03", "NV10"]);

    const asc = sortCuocCdRows(sampleRows, "tonChuaThu", "asc");
    expect(asc.map((r) => r.employeeCodeRaw)).toEqual(["NV10", "NV01", "NV03", "NV02"]);
  });

  it("does not mutate original array", () => {
    const originalClone = [...sampleRows];
    sortCuocCdRows(sampleRows, "dauKy", "desc");
    expect(sampleRows).toEqual(originalClone);
  });
});
