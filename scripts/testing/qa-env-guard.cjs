const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { syncBuiltinESMExports } = require("node:module");
const root = process.env.QA_DIAGNOSTICS_ROOT || process.cwd();
const names = [".env", ".env.local", ".env.test", ".env.test.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local"];
const protectedFiles = new Set(names.map((name) => path.resolve(root, name).toLowerCase()));
const blocked = (file) => {
  const value = Buffer.isBuffer(file) ? file.toString() : file instanceof URL ? fileURLToPath(file) : file;
  return typeof value === "string" && protectedFiles.has(path.resolve(value).toLowerCase());
};
const missing = () => Object.assign(new Error("Environment discovery disabled for synthetic QA"), { code: "ENOENT" });
for (const method of ["statSync", "lstatSync", "readFileSync", "openSync"]) {
  const original = fs[method];
  fs[method] = function (file, ...args) { if (blocked(file)) throw missing(); return original.call(this, file, ...args); };
}
for (const method of ["stat", "lstat", "readFile", "open"]) {
  const original = fs[method];
  fs[method] = function (file, ...args) {
    if (blocked(file)) { process.nextTick(() => args.at(-1)(missing())); return; }
    return original.call(this, file, ...args);
  };
  const promiseOriginal = fs.promises[method];
  fs.promises[method] = async function (file, ...args) { if (blocked(file)) throw missing(); return promiseOriginal.call(this, file, ...args); };
}
syncBuiltinESMExports();
process.env.QA_ENV_GUARD_ACTIVE = "1";
