import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production build safety", () => {
  it("builds without replaying database migrations", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    expect(manifest.scripts.build).toBe("next build");
    expect(manifest.scripts["db:migrate"]).toBe("node scripts/migrate.mjs");
  });

  it("uses a supported Node runtime and matching types for Vitest 5 in CI", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain("node-version: 24");
    expect(manifest.devDependencies["@types/node"]).toBe("^24");
  });
});
