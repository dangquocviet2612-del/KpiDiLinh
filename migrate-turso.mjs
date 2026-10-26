import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
    console.error("Missing DATABASE_URL or TURSO_AUTH_TOKEN");
    process.exit(1);
}

const client = createClient({ url, authToken });

async function migrate() {
    try {
        console.log("Adding status column to Customer table...");
        await client.execute(`ALTER TABLE Customer ADD COLUMN status TEXT DEFAULT 'Hoạt động';`);
        console.log("Migration successful.");
    } catch (e) {
        if (e.message.includes("duplicate column name")) {
            console.log("Column already exists.");
        } else {
            console.error("Migration failed:", e);
        }
    }
}

migrate();
