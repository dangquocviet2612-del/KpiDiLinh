import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(process.cwd(), "src/app/(dashboard)/node-0tb/Node0TbMap.tsx");
const tileConfigPath = path.join(process.cwd(), "src/lib/map-tiles.ts");

describe("Node 0TB map configuration", () => {
  it("uses the shared, keyless tile provider catalog", () => {
    const source = fs.readFileSync(sourcePath, "utf8");
    const tileConfig = fs.readFileSync(tileConfigPath, "utf8");

    expect(source).toContain("getMapTileConfig(mapStyle)");
    expect(source).not.toContain("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(tileConfig).toContain("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
  });
});
