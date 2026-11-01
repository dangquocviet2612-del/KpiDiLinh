CREATE TABLE "CuocFtthDailyResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reportDate" TEXT NOT NULL,
    "ctvUser" TEXT NOT NULL,
    "employeeCodeRaw" TEXT NOT NULL,
    "managerCodeRaw" TEXT,
    "dauKy" REAL NOT NULL DEFAULT 0,
    "luyKe" REAL NOT NULL DEFAULT 0,
    "thuaThieu" REAL NOT NULL DEFAULT 0,
    "tonChuaThu" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CuocFtthDailyResult_reportDate_employeeCodeRaw_key" ON "CuocFtthDailyResult" ("reportDate", "employeeCodeRaw");
CREATE INDEX "CuocFtthDailyResult_reportDate_ctvUser_idx" ON "CuocFtthDailyResult" ("reportDate", "ctvUser");
CREATE INDEX "CuocFtthDailyResult_reportDate_employeeCodeRaw_idx" ON "CuocFtthDailyResult" ("reportDate", "employeeCodeRaw");
CREATE INDEX "CuocFtthDailyResult_reportDate_managerCodeRaw_idx" ON "CuocFtthDailyResult" ("reportDate", "managerCodeRaw");

CREATE TABLE "CuocFtthConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "targetRatePercent" REAL NOT NULL DEFAULT 99.5,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "CuocFtthConfig" ("id", "targetRatePercent") VALUES (1, 99.5) ON CONFLICT("id") DO NOTHING;
