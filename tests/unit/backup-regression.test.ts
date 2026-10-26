import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Backup & Database Schema Regression Tests", () => {
  const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
  const backupRoutePath = path.resolve(process.cwd(), "src/app/api/admin/backup/route.ts");

  it("verifies Node0Tb schema defines id as String, preventing SQLite datatype mismatch", () => {
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    const node0TbMatch = schemaContent.match(/model\s+Node0Tb\s*\{([\s\S]*?)\}/);
    expect(node0TbMatch).not.toBeNull();

    const node0TbBody = node0TbMatch![1];
    expect(node0TbBody).toMatch(/id\s+String\s+@id/);
    expect(node0TbBody).not.toMatch(/id\s+Int\s+@id/);
  });

  it("verifies ChurnRiskRecord schema has no 'account' column", () => {
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    const churnMatch = schemaContent.match(/model\s+ChurnRiskRecord\s*\{([\s\S]*?)\}/);
    expect(churnMatch).not.toBeNull();

    const churnBody = churnMatch![1];
    const fieldLines = churnBody
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("//") && !line.startsWith("@@"));

    const fieldNames = fieldLines.map((line) => line.split(/\s+/)[0]);

    expect(fieldNames).not.toContain("account");
    expect(fieldNames).toContain("id");
    expect(fieldNames).toContain("reportMonth");
    expect(fieldNames).toContain("ctvCode");
  });

  it("verifies backup route implementation orders ChurnRiskRecord by id, avoiding missing account column", () => {
    const backupContent = fs.readFileSync(backupRoutePath, "utf-8");

    // Ensure ChurnRiskRecord query orders by valid column (id), not account
    expect(backupContent).toContain('getRawTableRows("ChurnRiskRecord", \'ORDER BY "reportMonth" DESC, "ctvCode" ASC, "id" ASC\')');
    expect(backupContent).not.toContain('getRawTableRows("ChurnRiskRecord", \'ORDER BY "reportMonth" DESC, "ctvCode" ASC, "account" ASC\')');
  });

  it("verifies backup route restore parser reads Node0Tb id as string (preserving UUID)", () => {
    const backupContent = fs.readFileSync(backupRoutePath, "utf-8");

    const restoreNode0TbMatch = backupContent.match(/function prepareNode0TbRecordsForRestore[\s\S]*?\n\}/);
    expect(restoreNode0TbMatch).not.toBeNull();

    const block = restoreNode0TbMatch![0];
    expect(block).toContain('{ key: "id", parse: toNullableString }');
    expect(block).not.toContain('{ key: "id", parse: toNullableInteger }');
  });
});
