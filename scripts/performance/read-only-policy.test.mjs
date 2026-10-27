import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const policy = await import("./read-only-policy.mjs").catch(() => ({}));
const summary = await import("./summarize-baseline.mjs").catch(() => ({}));
const browser = await import("./browser-baseline.mjs").catch(() => ({}));
const baseUrl = "http://127.0.0.1:3005";

function exported(module, name) {
  assert.equal(typeof module[name], "function", `${name} is not implemented`);
  return module[name];
}

function temporaryRepository(run) {
  const root = mkdtempSync(path.join(tmpdir(), "performance-policy-"));
  try {
    execFileSync("git", ["init", "--quiet", root], { stdio: "pipe" });
    writeFileSync(path.join(root, ".gitignore"), "/.local/\n");
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function redirectFixture({ hops = 501, playwrightRequests = true, redirectPath } = {}) {
  const context = new EventEmitter();
  const session = new EventEmitter();
  const page = new EventEmitter();
  const commands = [];
  let routeHandler;
  let closed = false;
  let closedAtSnapshot = false;
  context.routeWebSocket = async () => {};
  context.route = async (_pattern, handler) => { routeHandler = handler; };
  context.newPage = async () => page;
  context.newCDPSession = async () => session;
  context.close = async () => { closed = true; };
  session.send = async (command, parameters) => { commands.push({ command, parameters }); };
  page.setDefaultTimeout = () => {};
  page.addInitScript = async () => {};
  page.goto = async () => {
    for (let hop = 0; hop < hops; hop += 1) {
      const url = `${baseUrl}${hop && redirectPath ? redirectPath : `/prepaid?hop=${hop}`}`;
      const request = { url: () => url, method: () => "GET", failure: () => ({ errorText: "net::ERR_BLOCKED_BY_CLIENT" }) };
      if (playwrightRequests) context.emit("request", request);
      if (!hop) await routeHandler({ request: () => request, continue: async () => {}, abort: async () => {} });
      session.emit("Fetch.requestPaused", { requestId: `hop-${hop}`, networkId: "redirect-chain", request: { url, method: "GET" } });
      await new Promise((resolve) => setImmediate(resolve));
      if (playwrightRequests && commands.at(-1)?.command === "Fetch.failRequest") context.emit("requestfailed", request);
      if (closed || commands.at(-1)?.command === "Fetch.failRequest") break;
    }
    return { ok: () => true, status: () => 200, headerValue: async () => null };
  };
  page.evaluate = async () => {
    closedAtSnapshot = closed;
    return { address: `${baseUrl}/prepaid`, metrics: { ttfbMs: 1 }, apis: [] };
  };
  return { browser: { newContext: async () => context }, commands, closedAtSnapshot: () => closedAtSnapshot };
}

test("base URL defaults to loopback and accepts HTTP(S) local origins", () => {
  const validate = exported(policy, "validateBaseUrl");
  assert.equal(validate().origin, baseUrl);
  for (const address of [baseUrl, "http://localhost:3005/", "https://[::1]:3443"]) {
    assert.equal(validate(address).origin, new URL(address).origin);
  }
});

test("base URL rejects remote unless the exact explicit opt-in is true", () => {
  const validate = exported(policy, "validateBaseUrl");
  for (const address of ["https://example.invalid", "http://localhost.example.invalid", "http://192.168.1.2", "http://0.0.0.0"]) {
    for (const allowRemote of [undefined, false, "false", "TRUE", "1", true]) {
      assert.throws(() => validate(address, { allowRemote }));
    }
    assert.equal(validate(address, { allowRemote: "true" }).origin, new URL(address).origin);
  }
});

test("base URL rejects credentials, non-HTTP, malformed URLs and non-origin components", () => {
  const validate = exported(policy, "validateBaseUrl");
  for (const address of ["file:///tmp/report", "ftp://localhost", "javascript:alert(1)", "not a URL", "http://user:secret@localhost", "http://user@localhost", `${baseUrl}/customers`, `${baseUrl}/?token=secret`, `${baseUrl}/#secret`]) {
    assert.throws(() => validate(address, { allowRemote: "true" }));
  }
});

test("all browser methods except GET and HEAD are denied even on non-API paths", () => {
  const allowed = exported(policy, "isReadOnlyRequest");
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "TRACE", "CONNECT", "UNKNOWN"]) {
    for (const pathname of ["/", "/api/kpi/report", "/api/auth/callback/credentials"]) {
      assert.equal(allowed({ url: `${baseUrl}${pathname}`, method }, baseUrl), false);
    }
  }
  for (const method of ["GET", "HEAD"]) {
    assert.equal(allowed({ url: `${baseUrl}/api/kpi/report`, method }, baseUrl), true);
  }
});

test("unsafe GET endpoints, descendants and encoded aliases are denied", () => {
  const allowed = exported(policy, "isReadOnlyRequest");
  for (const pathname of ["/api/archive", "/api/archive/status", "/api/archive/cron", "/archive/status", "/api/setup", "/api/setup/more", "/api/seed", "/setup", "/seed", "/api/admin/backup", "/api/admin/backup/download", "/admin/backup", "/api/auth/signout", "/api/%61rchive/status", "/api/%2561rchive/status", "/API/ARCHIVE/status", "/api//archive/status", "/api%2farchive%2fstatus", "/api/archive;ignored/status", "/api/%zz/status"]) {
    for (const method of ["GET", "HEAD"]) {
      assert.equal(allowed({ url: `${baseUrl}${pathname}`, method }, baseUrl), false, pathname);
    }
  }
});

test("guard rejects foreign origins, embedded credentials and non-network URLs", () => {
  const allowed = exported(policy, "isReadOnlyRequest");
  for (const url of ["https://example.invalid/api/kpi/report", "http://localhost:3005/api/kpi/report", "http://127.0.0.1:3006/", "http://user:secret@127.0.0.1:3005/", "data:text/plain,secret", "file:///tmp/secret", "invalid"]) {
    assert.equal(allowed({ url, method: "GET" }, baseUrl), false);
  }
});

test("authentication exception permits only explicit CSRF GET and credentials POST", () => {
  const allowed = exported(policy, "isAuthenticationRequest");
  const form = { csrfToken: "fake-csrf", username: "fake-user", password: "fake-password", callbackUrl: `${baseUrl}/` };
  assert.equal(allowed({ url: `${baseUrl}/api/auth/csrf`, method: "GET" }, baseUrl), true);
  assert.equal(allowed({ url: `${baseUrl}/api/auth/callback/credentials`, method: "POST", form }, baseUrl), true);
  for (const request of [
    { url: `${baseUrl}/api/auth/callback/credentials`, method: "POST" },
    { url: `${baseUrl}/api/auth/callback/credentials?secret=1`, method: "POST", form },
    { url: `${baseUrl}/api/auth/callback/credentials`, method: "POST", form: { ...form, csrfToken: "" } },
    { url: `${baseUrl}/api/auth/callback/credentials`, method: "POST", form: { ...form, callbackUrl: "https://example.invalid/" } },
    { url: `${baseUrl}/api/setup`, method: "POST", form },
    { url: "https://example.invalid/api/auth/callback/credentials", method: "POST", form },
    { url: `${baseUrl}/api/auth/session`, method: "POST", form },
  ]) assert.equal(allowed(request, baseUrl), false);
});

test("report paths drop origins, fragments, arbitrary queries and customer identifiers", () => {
  const redact = exported(policy, "reportPath");
  assert.equal(redact(`${baseUrl}/api/kpi/report?username=alice&password=secret#cookie`), "/api/kpi/report");
  assert.equal(redact(`${baseUrl}/api/customers/customer-alice-123/notes?account=private`), "/api/[redacted]");
  assert.equal(redact(`${baseUrl}/api/customer-alice-123`), "/api/[redacted]");
  assert.equal(redact(`${baseUrl}/customer-alice-123`), "/[redacted]");
  assert.equal(redact("not a URL with private data"), "/[redacted]");
  assert.equal(redact(`${baseUrl}/prepaid?view=summary&customer=alice`), "/prepaid?view=summary");
  assert.equal(redact(`${baseUrl}/api/nodes?view=node-accounts&account=alice`), "/api/nodes?view=node-accounts");
  assert.equal(redact(`${baseUrl}/prepaid?view=customer-alice-123`), "/prepaid");
  assert.equal(redact(`${baseUrl}/prepaid?view=summary&view=alice`), "/prepaid");
});

test("Server-Timing retains only known numeric phases, never arbitrary descriptions", () => {
  const sanitize = exported(policy, "sanitizeServerTiming");
  assert.deepEqual(sanitize('query;dur=12.5;desc="customer-alice-123", total;dur=18, private-alice;dur=2, cache;dur=0;desc="session-secret"'), [
    { name: "query", durationMs: 12.5 }, { name: "total", durationMs: 18 }, { name: "cache", durationMs: 0 },
  ]);
  assert.deepEqual(sanitize('query;dur=-1, total;dur=NaN, auth;dur=Infinity, scope;desc="secret, total;dur=999"'), []);
  assert.deepEqual(sanitize(null), []);
});

test("output is confined to ignored JSON below .local/performance before it exists", () => {
  const validate = exported(policy, "assertIgnoredOutput");
  temporaryRepository((root) => {
    assert.equal(validate(root, ".local/performance/browser-baseline.json"), path.join(root, ".local/performance/browser-baseline.json"));
    for (const destination of ["report.json", ".local/other/report.json", "../outside.json", ".local/performance/../../report.json", ".local/performance/report.html", path.join(tmpdir(), "outside-report.json")]) {
      assert.throws(() => validate(root, destination));
    }
  });
});

test("output rejects an unignored or tracked file", () => {
  const validate = exported(policy, "assertIgnoredOutput");
  temporaryRepository((root) => {
    writeFileSync(path.join(root, ".gitignore"), "");
    assert.throws(() => validate(root, ".local/performance/report.json"));
    mkdirSync(path.join(root, ".local/performance"), { recursive: true });
    writeFileSync(path.join(root, ".local/performance/report.json"), "{}");
    execFileSync("git", ["-C", root, "add", "--", ".local/performance/report.json"], { stdio: "pipe" });
    writeFileSync(path.join(root, ".gitignore"), "/.local/\n");
    assert.throws(() => validate(root, ".local/performance/report.json"));
  });
});

test("output rejects symlink/junction escape through an ancestor", () => {
  const validate = exported(policy, "assertIgnoredOutput");
  temporaryRepository((root) => {
    const outside = mkdtempSync(path.join(tmpdir(), "performance-outside-"));
    try {
      mkdirSync(path.join(root, ".local"));
      symlinkSync(outside, path.join(root, ".local/performance"), process.platform === "win32" ? "junction" : "dir");
      assert.throws(() => validate(root, ".local/performance/report.json"));
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

test("summary statistics report median, minimum, maximum and count without percentiles", () => {
  const stats = exported(summary, "summaryStats");
  assert.deepEqual(stats([30, 10, 20]), { count: 3, median: 20, min: 10, max: 30 });
  assert.deepEqual(stats([8, 2, 4, 6]), { count: 4, median: 5, min: 2, max: 8 });
  assert.deepEqual(stats([12]), { count: 1, median: 12, min: 12, max: 12 });
  assert.deepEqual(stats([null, undefined, NaN, Infinity, -1, "42"]), { count: 0, median: null, min: null, max: null });
});

test("summary groups repeated routes and whitelists numeric report data", () => {
  const summarize = exported(summary, "summarizeBaseline");
  const results = [10, 30, 20].map((duration, sample) => ({
    route: "/prepaid?view=summary&username=alice", sample: sample + 1, status: "measured",
    requestCount: sample + 2, responseCount: sample + 1, apiRequestCount: 1, apiResponseCount: 1,
    metrics: { ttfbMs: duration, decodedBodyBytes: duration * 10, body: "private-body" },
    apis: [{ path: "/api/kpi/report?account=alice", requestCount: 1, responseCount: 1, decodedBodyBytes: duration, serverTiming: [{ name: "query", durationMs: duration, description: "private-cookie" }] }],
    error: "private-password", cookies: ["private-session"],
  }));
  const result = summarize({ scenario: "reports", results, username: "alice", origin: "https://user:private-password@example.invalid" });
  assert.equal(result.routes.length, 1);
  assert.equal(result.routes[0].route, "/prepaid?view=summary");
  assert.deepEqual(result.routes[0].metrics.ttfbMs, { count: 3, median: 20, min: 10, max: 30 });
  assert.deepEqual(result.routes[0].requestCount, { count: 3, median: 3, min: 2, max: 4 });
  assert.equal(result.routes[0].apis[0].path, "/api/kpi/report");
  assert.deepEqual(result.routes[0].apis[0].serverTiming.query, { count: 3, median: 20, min: 10, max: 30 });
  const serialized = JSON.stringify(result);
  for (const secret of ["alice", "private-", "example.invalid", "body", "cookies", "p95", "INP"]) assert.equal(serialized.includes(secret), false, secret);
});

test("failed samples do not masquerade as successful measurements", () => {
  const summarize = exported(summary, "summarizeBaseline");
  const result = summarize({ scenario: "maps", results: [
    { route: "/map", status: "failed", metrics: { ttfbMs: 999 } },
    { route: "/map", status: "measured", metrics: { ttfbMs: 10 } },
  ] });
  assert.equal(result.routes[0].attemptedSamples, 2);
  assert.equal(result.routes[0].measuredSamples, 1);
  assert.equal(result.routes[0].failedSamples, 1);
  assert.deepEqual(result.routes[0].metrics.ttfbMs, { count: 1, median: 10, min: 10, max: 10 });
});

test("CLI accepts only bounded samples, explicit scenarios and known arguments", () => {
  const parse = exported(browser, "parseArguments");
  assert.equal(parse(["--scenario", "reports"]).samples, 1);
  assert.equal(parse(["--scenario", "maps", "--samples", "3"]).samples, 3);
  assert.equal(parse(["--help"]).help, true);
  for (const args of [[], ["--scenario", "archive"], ["--scenario", "maps", "--samples", "0"], ["--scenario", "maps", "--samples", "11"], ["--scenario", "maps", "--samples", "1.5"], ["--scenario", "maps", "--samples", "1e1"], ["--username", "private"], ["--scenario", "maps", "--samples"], ["--scenario", "maps", "--scenario", "reports"]]) {
    assert.throws(() => parse(args));
  }
});

test("Chromium interception independently checks every redirect hop before continuing", async () => {
  const guard = exported(browser, "guardPausedRequest");
  const commands = [];
  const session = { send: async (command, parameters) => { commands.push({ command, parameters }); } };
  const blocked = [];
  await guard(session, { requestId: "initial", request: { url: `${baseUrl}/api/kpi/report`, method: "GET" } }, baseUrl, () => blocked.push(true));
  for (const [requestId, url, method] of [
    ["redirect", `${baseUrl}/api/archive/status`, "GET"],
    ["foreign", "https://example.invalid/", "GET"],
    ["mutation", `${baseUrl}/non-api`, "POST"],
    ["auth", `${baseUrl}/api/auth/callback/credentials`, "POST"],
  ]) await guard(session, { requestId, request: { url, method } }, baseUrl, () => blocked.push(true));
  assert.deepEqual(commands[0], { command: "Fetch.continueRequest", parameters: { requestId: "initial" } });
  assert.equal(blocked.length, 4);
  assert.equal(commands.slice(1).every((entry) => entry.command === "Fetch.failRequest" && entry.parameters.errorReason === "BlockedByClient"), true);
});

test("consecutive CDP redirect hops cannot exceed the 500-request limit", async () => {
  const measure = exported(browser, "measureRoute");
  const fixture = redirectFixture({ playwrightRequests: false });
  await measure(fixture.browser, {}, baseUrl, "/prepaid", 1);
  assert.equal(fixture.commands.filter((entry) => entry.command === "Fetch.continueRequest").length, 500);
  assert.equal(fixture.commands.filter((entry) => entry.command === "Fetch.failRequest").length, 1);
  assert.equal(fixture.closedAtSnapshot(), true);
});

test("request-limit routes cannot be measured even if navigation and snapshot succeed", async () => {
  const measure = exported(browser, "measureRoute");
  const fixture = redirectFixture();
  const result = await measure(fixture.browser, {}, baseUrl, "/prepaid", 1);
  assert.equal(result.status, "failed");
  assert.equal(result.failure, "request-limit");
  assert.equal(fixture.closedAtSnapshot(), true);
});

test("Playwright and CDP observing the same 500 hops do not double-count requests", async () => {
  const measure = exported(browser, "measureRoute");
  const fixture = redirectFixture({ hops: 500 });
  const result = await measure(fixture.browser, {}, baseUrl, "/prepaid", 1);
  assert.equal(result.status, "measured");
  assert.equal(result.requestCount, 500);
  assert.equal(fixture.commands.filter((entry) => entry.command === "Fetch.continueRequest").length, 500);
  assert.equal(fixture.closedAtSnapshot(), false);
});

test("main-page unsafe redirect hops remain guarded below the request limit", async () => {
  const measure = exported(browser, "measureRoute");
  const fixture = redirectFixture({ hops: 2, redirectPath: "/api/archive/status" });
  await measure(fixture.browser, {}, baseUrl, "/prepaid", 1);
  assert.equal(fixture.commands.filter((entry) => entry.command === "Fetch.continueRequest").length, 1);
  assert.equal(fixture.commands.filter((entry) => entry.command === "Fetch.failRequest").length, 1);
});

test("policy refuses to write report output before the ignore check passes", () => {
  const write = exported(policy, "writeJsonReport");
  temporaryRepository((root) => {
    writeFileSync(path.join(root, ".gitignore"), "");
    assert.throws(() => write(root, ".local/performance/report.json", { count: 1 }));
    assert.equal(existsSync(path.join(root, ".local")), false);
  });
});
