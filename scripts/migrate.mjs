import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL || "file:dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log(`Connecting to database: ${url}`);

const client = createClient({
  url,
  authToken: authToken || undefined,
});

function splitSqlStatements(sql) {
  const lines = sql
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("--")) return "";
      return line;
    })
    .join("\n");

  return lines
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

async function runMigration() {
  try {
    const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

    if (!fs.existsSync(migrationsDir)) {
      console.error(`Migrations folder not found at: ${migrationsDir}`);
      process.exit(1);
    }

    const migrationFolders = fs
      .readdirSync(migrationsDir)
      .filter((item) => {
        const fullPath = path.join(migrationsDir, item);
        return (
          fs.statSync(fullPath).isDirectory() &&
          fs.existsSync(path.join(fullPath, "migration.sql"))
        );
      })
      .sort();

    console.log(`Found ${migrationFolders.length} migration(s) to execute:`);
    for (const folder of migrationFolders) {
      console.log(` - ${folder}`);
    }

    let totalApplied = 0;
    let totalSkipped = 0;
    const failures = [];

    for (const folder of migrationFolders) {
      const migrationFile = path.join(migrationsDir, folder, "migration.sql");
      const sqlContent = fs.readFileSync(migrationFile, "utf-8");
      const statements = splitSqlStatements(sqlContent);

      console.log(`\nRunning migration [${folder}] with ${statements.length} statements...`);

      for (const stmt of statements) {
        try {
          await client.execute(stmt);
          totalApplied++;
        } catch (err) {
          const msg = String(err?.message || err?.cause?.message || "");
          if (
            msg.includes("duplicate column name") ||
            msg.includes("already exists")
          ) {
            totalSkipped++;
          } else {
            console.error(`\n❌ [FATAL MIGRATION ERROR] Failed on statement in ${folder}:`);
            console.error(`Statement: "${stmt}"`);
            console.error(`Reason: ${msg}`);
            console.error("\nAborting migration immediately to prevent partial database corruption. Exiting with code 1.");
            process.exit(1);
          }
        }
      }
    }

    console.log(`\nMigration finished successfully! Total applied: ${totalApplied}, Total skipped existing: ${totalSkipped}.`);
    console.log("Database schema is now completely up to date with schema.prisma.");
  } catch (error) {
    console.error("Migration fatal error:", error);
    process.exit(1);
  } finally {
    client.close();
  }
}

runMigration();
