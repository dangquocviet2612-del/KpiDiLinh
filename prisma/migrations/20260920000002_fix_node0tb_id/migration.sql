-- Rebuild Node0Tb table to enforce TEXT primary key in SQLite/libSQL
CREATE TABLE IF NOT EXISTS "Node0Tb_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeCode" TEXT NOT NULL,
    "dateKd" DATETIME,
    "dateKdRaw" TEXT,
    "dateKdFormatted" TEXT,
    "totalPort" INTEGER,
    "usedPort" INTEGER NOT NULL DEFAULT 0,
    "categoryKd" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO "Node0Tb_new" ("id", "nodeCode", "dateKd", "dateKdRaw", "dateKdFormatted", "totalPort", "usedPort", "categoryKd", "note", "createdAt", "updatedAt")
SELECT CAST("id" AS TEXT), "nodeCode", "dateKd", "dateKdRaw", "dateKdFormatted", "totalPort", "usedPort", "categoryKd", "note", "createdAt", "updatedAt"
FROM "Node0Tb";

DROP TABLE IF EXISTS "Node0Tb";

ALTER TABLE "Node0Tb_new" RENAME TO "Node0Tb";

CREATE UNIQUE INDEX IF NOT EXISTS "Node0Tb_nodeCode_key" ON "Node0Tb"("nodeCode");
CREATE INDEX IF NOT EXISTS "idx_node_0tb_category_kd" ON "Node0Tb"("categoryKd");
