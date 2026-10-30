import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const writerFiles = [
  "src/app/api/cdt/outstanding/report/route.ts",
  "src/app/api/cdt/report/route.ts",
  "src/app/api/cdt/summary/route.ts",
  "src/app/api/cuoc-cd/report/route.ts",
  "src/app/api/cuoc/report/route.ts",
  "src/app/api/customers/map-data/route.ts",
  "src/app/api/customers/route.ts",
  "src/app/api/customers/search-map/route.ts",
  "src/app/api/disconnect/report/route.ts",
  "src/app/api/kpi/manager-summary/route.ts",
  "src/app/api/kpi/report/route.ts",
  "src/app/api/kpi/summary/route.ts",
  "src/app/api/me/route.ts",
  "src/app/api/node-search-map/route.ts",
  "src/app/api/nodes/route.ts",
  "src/app/api/users/route.ts",
  "src/lib/prepaid-query.ts",
  "src/lib/scope.ts",
];

function parse(relativePath: string) {
  return ts.createSourceFile(relativePath, fs.readFileSync(path.resolve(relativePath), "utf8"), ts.ScriptTarget.Latest, true);
}

function findWrites(source: ts.SourceFile) {
  const writes: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "setCache") writes.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return writes;
}

function findSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.posix.join(directory, entry.name);
    return entry.isDirectory() ? findSourceFiles(entryPath) : /\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });
}

describe("production cache generation wiring", () => {
  it("accounts for every production setCache writer", () => {
    const actual = findSourceFiles("src").filter((relativePath) => findWrites(parse(relativePath)).length > 0);
    expect(actual.sort()).toEqual(writerFiles);
  });

  it.each(writerFiles)("captures before any async work and fences every fill: %s", (relativePath) => {
    const source = parse(relativePath);
    const imports = source.statements.filter(ts.isImportDeclaration).filter((declaration) =>
      ts.isStringLiteral(declaration.moduleSpecifier) && declaration.moduleSpecifier.text === "@/lib/kpi-cache",
    );
    const importedNames = imports.flatMap((declaration) => {
      const bindings = declaration.importClause?.namedBindings;
      return bindings && ts.isNamedImports(bindings) ? bindings.elements.map((element) => element.name.text) : [];
    });
    expect(importedNames).toContain("getCacheGeneration");
    const writes = findWrites(source);
    expect(writes.length).toBeGreaterThan(0);
    for (const write of writes) {
      expect(write.arguments).toHaveLength(4);
      expect(write.arguments[3].getText(source)).toBe("cacheGeneration");
      let owner: ts.FunctionDeclaration | undefined;
      let ancestor: ts.Node | undefined = write.parent;
      while (ancestor) {
        if (ts.isFunctionDeclaration(ancestor)) owner = ancestor;
        ancestor = ancestor.parent;
      }
      expect(owner?.body).toBeDefined();
      const firstStatement = owner!.body!.statements[0];
      expect(ts.isVariableStatement(firstStatement)).toBe(true);
      if (!ts.isVariableStatement(firstStatement)) throw new Error("Generation must be captured at function entry");
      expect(firstStatement.declarationList.flags & ts.NodeFlags.Const).toBeTruthy();
      expect(firstStatement.declarationList.declarations).toHaveLength(1);
      const capture = firstStatement.declarationList.declarations[0];
      expect(capture.name.getText(source)).toBe("cacheGeneration");
      expect(capture.initializer?.getText(source)).toBe("getCacheGeneration()");
    }
  });
});
