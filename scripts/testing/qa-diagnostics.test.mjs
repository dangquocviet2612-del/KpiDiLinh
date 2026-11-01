import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const recorder = await import("./qa-diagnostics.mjs").catch(() => ({}));
const fixtureRoot = path.resolve("synthetic-recorder-project");
const secret = "PRIVATE_SENTINEL_NOT_FOR_REPORT";
const targetName = "schema guards run only after authentication > GET users returns 401 without schema or database access";
function exported(name) { assert.equal(typeof recorder[name], "function", `${name} is not implemented`); return recorder[name]; }
function fakeContext({ outcome = "passed", moduleState = "passed", failed = 0, unhandled = [], errors = [], name = secret, duration = 12, caseCount = 1 } = {}) {
  const testModule = { moduleId: path.join(fixtureRoot, "tests/unit/schema-auth-order.test.ts"), state: () => moduleState, children: [] };
  testModule.children = Array.from({ length: caseCount }, () => ({ type: "test", module: testModule, fullName: name, result: () => ({ state: outcome, errors }), diagnostic: () => ({ duration, startTime: 100, retryCount: 0, repeatCount: 0 }) }));
  return {
    projects: [{ name: secret, config: { setupFiles: [secret], testTimeout: 1234, pool: "forks", isolate: true, retry: 0 } }],
    state: {
      getTestModules: () => [testModule], getCountOfFailedTests: () => failed, getUnhandledErrors: () => unhandled,
      metadata: { [secret]: { duration: { "/src/app/api/users/route.ts": [1, 4, Number.NaN, -2], ["https://private.invalid/?token=" + secret]: [5000] } } },
    },
    close: async () => undefined,
  };
}
async function temporary(run) {
  const directory = mkdtempSync(path.join(tmpdir(), "qa-recorder-test-"));
  const resolved = realpathSync(directory);
  try { return await run(resolved); }
  finally {
    assert.equal(path.dirname(resolved), realpathSync(tmpdir()));
    assert.ok(path.basename(resolved).startsWith("qa-recorder-test-"));
    rmSync(resolved, { recursive: true, force: true });
  }
}

test("arguments require an explicit bounded unit/UI selection and output label", () => {
  const parse = exported("parseArgs");
  assert.deepEqual(parse(["--output", "run-01", "tests/unit/schema-auth-order.test.ts", "tests/ui"]), { output: "run-01", filters: ["tests/unit/schema-auth-order.test.ts", "tests/ui"] });
  assert.deepEqual(parse(["--help"]), { help: true });
});
for (const args of [[], ["tests/ui"], ["--output", "run"], ["--output", "../escape", "tests/ui"], ["--output", "run", "tests"], ["--output", "run", "tests/integration/db.test.ts"], ["--output", "run", "tests/unit/../integration/db.test.ts"], ["--output", "run", "--testTimeout=99999"], ["--output", "run", "tests/ui", "--pool=threads"], ["--output", "run", "tests/unit/file;echo"], ["--output", "run", "/absolute/test.ts"], ["--output", "run", "tests/ui", "--output", "again"]]) {
  test(`rejects unsafe or ambiguous arguments ${JSON.stringify(args)}`, () => assert.throws(() => exported("parseArgs")(args)));
}

test("collector keeps numeric outcomes/timings but never arbitrary titles/errors/env/URLs/absolute roots", () => {
  const context = fakeContext({ outcome: "failed", moduleState: "failed", failed: 1, errors: [{ message: secret + " Test timed out in 5000ms", stack: secret, actual: secret }] });
  const report = exported("collectDiagnostics")(context, { root: fixtureRoot, runtimeExitCode: 1, vitestVersion: "5.0.1" });
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(secret), false); assert.equal(serialized.includes(fixtureRoot), false); assert.equal(serialized.includes("private.invalid"), false);
  assert.equal(report.captureComplete, true); assert.equal(report.summary.failedTests, 1); assert.equal(report.summary.moduleFailures, 1);
  assert.equal(report.cases[0].module, "tests/unit/schema-auth-order.test.ts"); assert.equal(report.cases[0].timeout, true); assert.equal(report.cases[0].durationMs, 12);
  assert.equal(report.project.testTimeout, 1234); assert.equal(report.project.setupCount, 1);
  assert.deepEqual(report.moduleFetch, [{ label: "users-route", count: 2, minMs: 1, maxMs: 4 }]);
});
test("only the exact known auth case receives a fixed non-PII label", () => {
  const report = exported("collectDiagnostics")(fakeContext({ name: targetName }), { root: fixtureRoot });
  assert.equal(report.cases[0].target, "users-get-unauthenticated");
  assert.equal(exported("collectDiagnostics")(fakeContext({ name: targetName + secret }), { root: fixtureRoot }).cases[0].target, undefined);
});
test("invalid timing values become null rather than invented zeroes", () => {
  const report = exported("collectDiagnostics")(fakeContext({ duration: Number.NaN }), { root: fixtureRoot });
  assert.equal(report.cases[0].durationMs, null);
});
for (const scenario of [{ outcome: "skipped", failed: 0, moduleState: "passed", exit: 0 }, { outcome: "failed", failed: 2, moduleState: "failed", exit: 1 }]) {
  test(`a ${scenario.outcome} case without SDK diagnostics keeps outcomes and null timings`, () => {
    const context = fakeContext(scenario); context.state.getTestModules()[0].children[0].diagnostic = () => undefined;
    const report = exported("collectDiagnostics")(context, { root: fixtureRoot });
    assert.equal(report.captureComplete, true); assert.equal(report.cases[0].outcome, scenario.outcome);
    for (const field of ["durationMs", "startTimeMs", "retryCount"]) assert.equal(report.cases[0][field], null);
    assert.equal(exported("deriveExitCode")(report, 0), scenario.exit);
  });
}
test("unhandled errors are counted without persisting their content", () => {
  const report = exported("collectDiagnostics")(fakeContext({ unhandled: [{ message: secret }] }), { root: fixtureRoot });
  assert.equal(report.summary.unhandledErrors, 1); assert.equal(JSON.stringify(report).includes(secret), false);
  assert.equal(exported("deriveExitCode")(report, 0), 1);
});
test("module/collection failure cannot become a passing zero-failed-case report", () => {
  const report = exported("collectDiagnostics")(fakeContext({ moduleState: "failed", caseCount: 0 }), { root: fixtureRoot });
  assert.equal(report.summary.moduleFailures, 1); assert.equal(report.captureComplete, false);
  assert.equal(exported("deriveExitCode")(report, 0), 1);
});
test("unknown module paths are redacted", () => {
  const context = fakeContext(); context.state.getTestModules()[0].moduleId = "https://private.invalid/" + secret;
  const report = exported("collectDiagnostics")(context, { root: fixtureRoot });
  assert.equal(report.cases[0].module, "[redacted]"); assert.equal(JSON.stringify(report).includes(secret), false);
});
test("large case sets are bounded and incomplete capture fails closed", () => {
  const report = exported("collectDiagnostics")(fakeContext({ caseCount: 5001 }), { root: fixtureRoot });
  assert.equal(report.summary.observedCases, 5001); assert.equal(report.cases.length, 5000);
  assert.equal(report.captureComplete, false); assert.equal(exported("deriveExitCode")(report, 0), 1);
});
test("a cyclic or malformed suite graph cannot hang or pass", () => {
  const context = fakeContext(); const testModule = context.state.getTestModules()[0];
  const suite = { type: "suite", children: [] }; suite.children.push(suite); testModule.children.push(suite);
  const report = exported("collectDiagnostics")(context, { root: fixtureRoot });
  assert.equal(report.captureComplete, false); assert.equal(exported("deriveExitCode")(report, 0), 1);
});
for (const code of [1, 2, 7, 127, 255]) {
  test(`preserves failure exit ${code} even if recorded cases passed`, () => {
    const report = exported("collectDiagnostics")(fakeContext(), { root: fixtureRoot });
    assert.equal(exported("deriveExitCode")(report, code), code);
  });
}
test("native/invalid exit values remain failures rather than zero", () => {
  const report = exported("collectDiagnostics")(fakeContext(), { root: fixtureRoot });
  assert.equal(exported("deriveExitCode")(report, 3221225477), 1); assert.equal(exported("deriveExitCode")(report, "invalid"), 1);
});
test("a complete passing run remains exit0", () => {
  const report = exported("collectDiagnostics")(fakeContext(), { root: fixtureRoot });
  assert.equal(exported("deriveExitCode")(report, 0), 0);
});
test("an observed failed case cannot pass even if aggregate counters disagree", () => {
  const report = exported("collectDiagnostics")(fakeContext({ outcome: "failed", failed: 0, moduleState: "passed" }), { root: fixtureRoot });
  assert.equal(exported("deriveExitCode")(report, 0), 1);
});
test("SDK failed task count includes failed modules and is not mislabeled as failed cases", () => {
  const report = exported("collectDiagnostics")(fakeContext({ outcome: "failed", moduleState: "failed", failed: 2 }), { root: fixtureRoot });
  assert.equal(report.summary.failedTests, 1); assert.equal(report.summary.sdkFailedTasks, 2);
  assert.equal(exported("deriveExitCode")(report, 0), 1);
});
test("a nonzero SDK task count still fails closed when observed cases passed", () => {
  const report = exported("collectDiagnostics")(fakeContext({ failed: 1 }), { root: fixtureRoot });
  assert.equal(report.summary.failedTests, 0); assert.equal(report.summary.sdkFailedTasks, 1);
  assert.equal(exported("deriveExitCode")(report, 0), 1);
});

test("exclusive writer validates twice and refuses overwriting earlier evidence", () => temporary(async (root) => {
  const file = path.join(root, "nested", "run.json"); let checks = 0;
  const validate = () => { checks++; return file; };
  exported("writeExclusiveReport")(root, file, { safe: true }, { validate });
  assert.equal(checks, 2); assert.deepEqual(JSON.parse(readFileSync(file)), { safe: true });
  assert.throws(() => exported("writeExclusiveReport")(root, file, { replaced: true }, { validate }));
  assert.deepEqual(JSON.parse(readFileSync(file)), { safe: true });
}));
test("writer refuses an unignored/unsafe path before creating anything", () => temporary(async (root) => {
  const file = path.join(root, "unsafe.json");
  assert.throws(() => exported("writeExclusiveReport")(root, file, {}, { validate: () => { throw new Error("unsafe"); } }));
  assert.equal(existsSync(file), false);
}));

test("executor invokes Vitest once without timeout/pool/retry/setup overrides and records a failure", async () => {
  const calls = []; const written = []; let closed = 0;
  const context = fakeContext({ outcome: "failed", moduleState: "failed", failed: 1 }); context.close = async () => { closed++; };
  const result = await exported("executeTests")({ root: fixtureRoot, filters: ["tests/unit/example.test.ts"], destination: "fake.json" }, {
    validate: () => "fake.json", exists: () => false, startVitest: async (...args) => { calls.push(args); return context; },
    writeReport: (_root, _destination, report) => written.push(report), getExitCode: () => 1, vitestVersion: "5.0.1",
  });
  assert.deepEqual(calls, [[["tests/unit/example.test.ts"], { root: fixtureRoot, run: true }, { envDir: false }]]);
  assert.equal(result.exitCode, 1); assert.equal(written.length, 1); assert.equal(written[0].summary.failedTests, 1); assert.equal(closed, 1);
});
for (const failure of ["start", "capture", "close"]) {
  test(`executor fails closed when ${failure} fails without storing a raw error`, async () => {
    const written = []; const context = fakeContext();
    if (failure === "capture") context.state.getTestModules = () => { throw new Error(secret); };
    if (failure === "close") context.close = async () => { throw new Error(secret); };
    const result = await exported("executeTests")({ root: fixtureRoot, filters: ["tests/ui"], destination: "fake.json" }, {
      validate: () => "fake.json", exists: () => false, startVitest: async () => { if (failure === "start") throw new Error(secret); return context; },
      writeReport: (_root, _destination, report) => written.push(report), getExitCode: () => 0, vitestVersion: "5.0.1",
    });
    assert.equal(result.exitCode, 1); assert.equal(written[0].captureComplete, false); assert.equal(JSON.stringify(written).includes(secret), false);
  });
  test(`executor preserves an existing nonzero runtime exit when ${failure} fails`, async () => {
    const context = fakeContext();
    if (failure === "capture") context.state.getTestModules = () => { throw new Error(secret); };
    if (failure === "close") context.close = async () => { throw new Error(secret); };
    const result = await exported("executeTests")({ root: fixtureRoot, filters: ["tests/ui"], destination: "fake.json" }, {
      validate: () => "fake.json", exists: () => false, startVitest: async () => { if (failure === "start") throw new Error(secret); return context; },
      writeReport: () => undefined, getExitCode: () => 7, vitestVersion: "5.0.1",
    });
    assert.equal(result.exitCode, 7); assert.equal(result.report.captureComplete, false);
  });
}
test("executor rejects an existing output before starting tests", async () => {
  let started = false;
  await assert.rejects(() => exported("executeTests")({ root: fixtureRoot, filters: ["tests/ui"], destination: "fake.json" }, {
    validate: () => "fake.json", exists: () => true, startVitest: async () => { started = true; },
  }));
  assert.equal(started, false);
});
test("child environment clears real DB/auth/preload values without mutating the parent", () => {
  const original = { PATH: "synthetic-path", TURSO_AUTH_TOKEN: secret, TURSO_DATABASE_URL: "libsql://private", DATABASE_URL: "file:real.db", AUTH_SECRET: secret, NODE_OPTIONS: "--require=private", AUTH_URL: "https://private.invalid" };
  const env = exported("buildChildEnvironment")(original, fixtureRoot, path.join(fixtureRoot, "guard.cjs"));
  assert.equal(env.DATABASE_URL, "file::memory:"); assert.equal(env.TURSO_DATABASE_URL, ""); assert.equal(env.TURSO_AUTH_TOKEN, "");
  assert.notEqual(env.AUTH_SECRET, secret); assert.equal(env.AUTH_URL, "http://localhost"); assert.equal(env.NEXTAUTH_URL, "http://localhost");
  assert.equal(env.NEXT_TELEMETRY_DISABLED, "1"); assert.equal(env.PATH, original.PATH); assert.equal(env.NODE_OPTIONS.includes("private"), false);
  assert.equal(original.TURSO_AUTH_TOKEN, secret); assert.equal(original.DATABASE_URL, "file:real.db");
});
for (const scenario of [{ code: 2, signal: null, expected: 2 }, { code: null, signal: "SIGTERM", expected: 1 }, { code: 0, signal: null, expected: 1 }]) {
  test(`parent preserves process status ${JSON.stringify(scenario)} and writes only separate process metadata`, async () => {
    const written = []; let options; let childArgs; let checks = 0;
    const result = await exported("runCommand")(["--output", "run-01", "tests/ui"], {
      root: fixtureRoot, env: {}, validate: (_root, destination) => { checks++; return path.join(fixtureRoot, destination); }, exists: () => false,
      spawnChild: (_binary, args, configuration) => { childArgs = args; options = configuration; const child = new EventEmitter(); queueMicrotask(() => child.emit("close", scenario.code, scenario.signal)); return child; },
      writeReport: (_root, destination, report) => written.push({ destination, report }),
    });
    assert.equal(result, scenario.expected); assert.equal(written.length, 1); assert.match(written[0].destination, /run-01-process\.json$/);
    assert.equal(written[0].report.childExitCode, scenario.code); assert.equal(written[0].report.reportPresent, false);
    assert.equal(options.shell, undefined); assert.equal(options.windowsHide, true); assert.equal(options.cwd, fixtureRoot);
    assert.equal(options.env.DATABASE_URL, "file::memory:"); assert.ok(childArgs.includes("--internal-child")); assert.ok(checks >= 2);
  });
}
test("env guard blocks standard env file discovery via string/URL/Buffer and promises but permits ordinary files", () => temporary(async (root) => {
  const guard = fileURLToPath(new URL("./qa-env-guard.cjs", import.meta.url));
  assert.equal(existsSync(guard), true, "env guard is not implemented");
  writeFileSync(path.join(root, ".env.test"), secret); writeFileSync(path.join(root, "ordinary.txt"), "safe");
  const script = 'const fs=require("node:fs"),path=require("node:path"),{pathToFileURL}=require("node:url");const target=path.join(process.cwd(),".env.test");const blocked=value=>{try{fs.readFileSync(value);return false}catch(error){return error.code==="ENOENT"}};(async()=>{let promised=false;try{await fs.promises.readFile(target)}catch(error){promised=error.code==="ENOENT"}console.log(JSON.stringify({string:blocked(target),url:blocked(pathToFileURL(target)),buffer:blocked(Buffer.from(target)),promised,normal:fs.readFileSync("ordinary.txt","utf8"),active:process.env.QA_ENV_GUARD_ACTIVE}))})()';
  const output = execFileSync(process.execPath, ["--require", guard, "-e", script], { cwd: root, env: { ...process.env, QA_DIAGNOSTICS_ROOT: root }, encoding: "utf8" });
  assert.deepEqual(JSON.parse(output), { string: true, url: true, buffer: true, promised: true, normal: "safe", active: "1" });
  assert.equal(output.includes(secret), false);
}));
