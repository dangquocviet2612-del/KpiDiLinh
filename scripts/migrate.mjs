import { main } from "./release-migrations.mjs";

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
