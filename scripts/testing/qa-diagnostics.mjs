import { closeSync, constants, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { assertIgnoredOutput } from "../performance/read-only-policy.mjs";

const repositoryRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const knownTarget = "schema guards run only after authentication > GET users returns 401 without schema or database access";
const stateNames = new Set(["passed", "failed", "skipped", "pending", "queued"]);
const finite = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const safeVersion = (value) => typeof value === "string" && /^v?\d+\.\d+\.\d+(?:[-.\w]*)?$/.test(value) ? value : "unknown";

export function parseArgs(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  let output;
  const filters = [];
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--output") {
      if (output !== undefined || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(args[index + 1] || "")) throw new Error("Invalid output label");
      output = args[++index];
    } else {
      const filter = argument.replaceAll("\\", "/");
      if (!/^tests\/(?:unit|ui)(?:\/[A-Za-z0-9_./-]+)?$/.test(filter) || filter.split("/").includes("..")) throw new Error("Explicit unit/UI filters required");
      filters.push(filter);
    }
  }
  if (!output || !filters.length || filters.length > 50) throw new Error("Output label and bounded selection required");
  return { output, filters };
}

function modulePath(root, moduleId) {
  if (typeof moduleId !== "string") return "[redacted]";
  const relative = path.relative(root, moduleId).replaceAll("\\", "/");
  return relative.length <= 240 && /^tests\/(?:unit|ui)\/[A-Za-z0-9_./-]+\.test\.(?:ts|tsx|js|mjs)$/.test(relative) && !relative.split("/").includes("..") ? relative : "[redacted]";
}

export function collectDiagnostics(context, { root, runtimeExitCode = 0, vitestVersion = "unknown" } = {}) {
  const modules = context.state.getTestModules();
  const sdkFailedTasks = context.state.getCountOfFailedTests();
  const unhandled = context.state.getUnhandledErrors();
  if (!Array.isArray(modules) || !Array.isArray(unhandled) || !Number.isSafeInteger(sdkFailedTasks) || sdkFailedTasks < 0 || context.projects.length !== 1) throw new Error("Unsupported diagnostic state");
  const cases = [];
  const seen = new WeakSet();
  let observedCases = 0;
  let visitedNodes = 0;
  let moduleFailures = 0;
  let failedTests = 0;
  let incomplete = modules.length === 0;
  function visit(children, depth = 0) {
    if (depth > 64) { incomplete = true; return; }
    for (const child of children) {
      if (++visitedNodes > 20_000) { incomplete = true; return; }
      if (!child || typeof child !== "object" || seen.has(child)) { incomplete = true; continue; }
      seen.add(child);
      if (child.type === "test") {
        observedCases++;
        const result = child.result();
        const diagnostic = child.diagnostic();
        if (result.state === "failed") failedTests++;
        if (!stateNames.has(result.state) || ["pending", "queued"].includes(result.state)) incomplete = true;
        if (cases.length >= 5000) { incomplete = true; continue; }
        const testModule = modulePath(root, child.module.moduleId);
        cases.push({ ordinal: observedCases, module: testModule, outcome: stateNames.has(result.state) ? result.state : "unknown",
          durationMs: finite(diagnostic?.duration), startTimeMs: finite(diagnostic?.startTime), retryCount: finite(diagnostic?.retryCount),
          timeout: Array.isArray(result.errors) && result.errors.some((error) => typeof error?.message === "string" && /\b(?:Test|Hook) timed out in \d+ms\b/.test(error.message)),
          ...(testModule === "tests/unit/schema-auth-order.test.ts" && child.fullName === knownTarget ? { target: "users-get-unauthenticated" } : {}),
        });
      } else if (child.children) visit(child.children, depth + 1);
      else incomplete = true;
    }
  }
  for (const testModule of modules) {
    const state = testModule.state();
    if (state === "failed") moduleFailures++;
    if (!stateNames.has(state) || ["pending", "queued"].includes(state)) incomplete = true;
    visit(testModule.children);
  }
  if (observedCases === 0) incomplete = true;
  const aggregates = new Map();
  const knownModules = [["/src/app/api/users/route.ts", "users-route"], ["/src/lib/validations/user.schema.ts", "user-validation"], ["/node_modules/next/server.js", "next-server"], ["/node_modules/zod/index.js", "zod"]];
  for (const metadata of Object.values(context.state.metadata || {})) for (const [url, values] of Object.entries(metadata.duration || {})) {
    const label = knownModules.find(([suffix]) => url.replaceAll("\\", "/").split(/[?#]/)[0].endsWith(suffix))?.[1];
    if (!label || !Array.isArray(values)) continue;
    for (const value of values) if (finite(value) !== null) {
      const aggregate = aggregates.get(label) || { label, count: 0, minMs: value, maxMs: value };
      aggregate.count++; aggregate.minMs = Math.min(aggregate.minMs, value); aggregate.maxMs = Math.max(aggregate.maxMs, value); aggregates.set(label, aggregate);
    }
  }
  const config = context.projects[0].config;
  return { schemaVersion: 1, collectionPoint: "after startVitest returns; not a live worker trace", captureComplete: !incomplete,
    runtime: { node: safeVersion(process.version), vitest: safeVersion(vitestVersion), originalExitCode: finite(runtimeExitCode) },
    project: { testTimeout: finite(config.testTimeout), pool: ["forks", "threads", "vmForks", "vmThreads"].includes(config.pool) ? config.pool : "other", isolate: typeof config.isolate === "boolean" ? config.isolate : null, retry: finite(config.retry), setupCount: Array.isArray(config.setupFiles) ? config.setupFiles.length : null, maxWorkers: finite(config.maxWorkers) },
    summary: { moduleCount: modules.length, observedCases, failedTests, sdkFailedTasks, moduleFailures, unhandledErrors: unhandled.length },
    cases, moduleFetch: [...aggregates.values()], moduleFetchNotAttributedToCases: true, notRootCauseOrReleaseAcceptance: true };
}

export function deriveExitCode(report, runtimeExitCode = 0) {
  const original = Number(runtimeExitCode);
  if (!Number.isInteger(original) || original < 0 || original > 255) return 1;
  if (original !== 0) return original;
  return report.captureComplete && report.summary.failedTests === 0 && report.summary.sdkFailedTasks === 0 && report.summary.moduleFailures === 0 && report.summary.unhandledErrors === 0 && !report.cases.some((entry) => entry.outcome === "failed") ? 0 : 1;
}

export function writeExclusiveReport(root, destination, report, { validate = assertIgnoredOutput } = {}) {
  const target = validate(root, destination);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (Buffer.byteLength(serialized) > 2 * 1024 * 1024) throw new Error("Diagnostic report limit exceeded");
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  validate(root, destination);
  const descriptor = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { writeFileSync(descriptor, serialized); }
  finally { closeSync(descriptor); }
  return target;
}

export async function executeTests({ root, filters, destination }, dependencies = {}) {
  const validate = dependencies.validate || assertIgnoredOutput;
  if ((dependencies.exists || existsSync)(validate(root, destination))) throw new Error("Output already exists");
  const write = dependencies.writeReport || ((directory, file, report) => writeExclusiveReport(directory, file, report, { validate }));
  let context;
  let report;
  let exitCode = 1;
  let original = 0;
  const getExitCode = dependencies.getExitCode || (() => process.exitCode);
  try {
    const startVitest = dependencies.startVitest || (await import(pathToFileURL(path.join(root, "node_modules/vitest/dist/node.js")).href)).startVitest;
    const vitestVersion = dependencies.vitestVersion || JSON.parse(readFileSync(path.join(root, "node_modules/vitest/package.json"), "utf8")).version;
    context = await startVitest(filters, { root, run: true }, { envDir: false });
    original = getExitCode() ?? 0;
    report = collectDiagnostics(context, { root, runtimeExitCode: original, vitestVersion });
    exitCode = deriveExitCode(report, original);
  } catch {
    report = { schemaVersion: 1, captureComplete: false, runnerError: true, notRootCauseOrReleaseAcceptance: true };
    original = getExitCode() ?? original;
    exitCode = deriveExitCode(report, original);
  } finally {
    if (context) try { await context.close(); } catch { report.captureComplete = false; report.closeFailed = true; exitCode = deriveExitCode(report, original); }
  }
  write(root, destination, report);
  return { exitCode, report };
}

export function buildChildEnvironment(base, root, guard) {
  return { ...base, DATABASE_URL: "file::memory:", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", AUTH_SECRET: "synthetic-qa-diagnostics-not-production", AUTH_URL: "http://localhost", NEXTAUTH_URL: "http://localhost", NODE_ENV: "test", NEXT_TELEMETRY_DISABLED: "1", QA_DIAGNOSTICS_ROOT: root, DOTENV_CONFIG_PATH: path.join(root, ".local/performance/nonexistent-qa.env"), NODE_OPTIONS: `--require="${guard.replaceAll("\\", "/").replaceAll('"', '\\"')}"` };
}

export async function runCommand(args, dependencies = {}) {
  const internal = args[0] === "--internal-child";
  const parsed = parseArgs(internal ? args.slice(1) : args);
  if (parsed.help) { (dependencies.print || console.log)("Usage: node scripts/testing/qa-diagnostics.mjs --output LABEL tests/unit/... tests/ui/...\nExplicit mocked unit/UI selection only; no auto retries or overwrite."); return 0; }
  const root = dependencies.root || repositoryRoot;
  const destination = `.local/performance/qa-diagnostics/${parsed.output}.json`;
  const processDestination = `.local/performance/qa-diagnostics/${parsed.output}-process.json`;
  const validate = dependencies.validate || assertIgnoredOutput;
  const exists = dependencies.exists || existsSync;
  for (const file of [destination, processDestination]) if (exists(validate(root, file))) throw new Error("Output already exists");
  if (internal) {
    if (process.env.QA_ENV_GUARD_ACTIVE !== "1" || process.env.DATABASE_URL !== "file::memory:" || process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) throw new Error("Synthetic child environment required");
    return (await executeTests({ root, filters: parsed.filters, destination })).exitCode;
  }
  const guard = path.join(root, "scripts/testing/qa-env-guard.cjs");
  const env = buildChildEnvironment(dependencies.env || process.env, root, guard);
  const child = (dependencies.spawnChild || spawn)(process.execPath, [fileURLToPath(import.meta.url), "--internal-child", "--output", parsed.output, ...parsed.filters], { cwd: root, env, stdio: "inherit", windowsHide: true });
  const outcome = await new Promise((resolve) => {
    child.once("error", () => resolve({ childExitCode: null, signal: null, spawnFailed: true }));
    child.once("close", (code, signal) => resolve({ childExitCode: code, signal, spawnFailed: false }));
  });
  const reportPresent = exists(validate(root, destination));
  const processReport = { schemaVersion: 1, childExitCode: typeof outcome.childExitCode === "number" ? outcome.childExitCode : null, signal: ["SIGINT", "SIGTERM", "SIGKILL", "SIGABRT"].includes(outcome.signal) ? outcome.signal : outcome.signal ? "other" : null, spawnFailed: outcome.spawnFailed, reportPresent, noRetryPerformed: true };
  const write = dependencies.writeReport || ((directory, file, report) => writeExclusiveReport(directory, file, report, { validate }));
  write(root, processDestination, processReport);
  if (outcome.signal || outcome.spawnFailed || !reportPresent) return Number.isInteger(outcome.childExitCode) && outcome.childExitCode > 0 && outcome.childExitCode <= 255 ? outcome.childExitCode : 1;
  return Number.isInteger(outcome.childExitCode) && outcome.childExitCode >= 0 && outcome.childExitCode <= 255 ? outcome.childExitCode : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCommand(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch(() => { console.error("QA diagnostics could not complete; no successful acceptance recorded."); process.exitCode = 1; });
}
