import { accessSync, constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { assertIgnoredOutput, isAuthenticationRequest, isReadOnlyRequest, LIMITS, reportPath, sanitizeServerTiming, SCENARIOS, validateBaseUrl, writeJsonReport } from "./read-only-policy.mjs";

export function parseArguments(args) {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) return { help: true };
  const options = { samples: 1, output: ".local/performance/browser-baseline.json" };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!["--scenario", "--samples", "--output"].includes(flag) || seen.has(flag) || !value || value.startsWith("--")) throw new Error("Invalid baseline arguments.");
    seen.add(flag);
    if (flag === "--samples") {
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > LIMITS.maxSamples) throw new Error("Samples must be an integer from 1 to 10.");
      options.samples = Number(value);
    } else options[flag.slice(2)] = value;
  }
  if (!Object.hasOwn(SCENARIOS, options.scenario)) throw new Error("Choose --scenario reports or maps.");
  return options;
}

export async function guardPausedRequest(session, event, baseUrl, onBlocked = () => {}, admitRequest = () => true) {
  if (admitRequest() && isReadOnlyRequest(event.request, baseUrl)) {
    await session.send("Fetch.continueRequest", { requestId: event.requestId });
  } else {
    onBlocked();
    await session.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
  }
}

function chromeExecutable(environment = process.env) {
  const candidates = environment.PERF_CHROME_PATH ? [environment.PERF_CHROME_PATH] : process.platform === "win32"
    ? [environment.PROGRAMFILES, environment["PROGRAMFILES(X86)"], environment.LOCALAPPDATA].filter(Boolean).map((directory) => path.join(directory, "Google", "Chrome", "Application", "chrome.exe"))
    : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"];
  for (const candidate of candidates) {
    try {
      if (!path.isAbsolute(candidate)) continue;
      accessSync(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
      return candidate;
    } catch {}
  }
  throw new Error("Set PERF_CHROME_PATH to an installed Chrome executable. No browser is downloaded.");
}

async function authenticate(browser, baseUrl, username, password) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const csrfRequest = { url: `${baseUrl}/api/auth/csrf`, method: "GET" };
    if (!isAuthenticationRequest(csrfRequest, baseUrl)) throw new Error("Authentication policy denied.");
    const csrfResponse = await context.request.get(csrfRequest.url, { maxRedirects: 0, timeout: LIMITS.authMs });
    if (csrfResponse.status() !== 200) throw new Error("CSRF setup failed.");
    const csrf = await csrfResponse.json();
    await csrfResponse.dispose();
    const form = { csrfToken: csrf.csrfToken, username, password, callbackUrl: `${baseUrl}/` };
    const credentialsRequest = { url: `${baseUrl}/api/auth/callback/credentials`, method: "POST", form };
    if (!isAuthenticationRequest(credentialsRequest, baseUrl)) throw new Error("Authentication policy denied.");
    const response = await context.request.post(credentialsRequest.url, { form, maxRedirects: 0, timeout: LIMITS.authMs });
    if (![200, 302, 303].includes(response.status())) throw new Error("Credentials setup failed.");
    await response.dispose();
    const sessionUrl = `${baseUrl}/api/auth/session`;
    if (!isReadOnlyRequest({ url: sessionUrl, method: "GET" }, baseUrl)) throw new Error("Authentication policy denied.");
    const sessionResponse = await context.request.get(sessionUrl, { maxRedirects: 0, timeout: LIMITS.authMs });
    if (sessionResponse.status() !== 200) throw new Error("Session verification failed.");
    const session = await sessionResponse.json();
    await sessionResponse.dispose();
    if (!session?.user || typeof session.user !== "object") throw new Error("Session verification failed.");
    return await context.storageState();
  } finally {
    await context.close();
  }
}

function endpointRecord(records, address) {
  const endpoint = reportPath(address);
  if (!records.has(endpoint)) records.set(endpoint, { path: endpoint, requestCount: 0, responseCount: 0, failedRequestCount: 0, httpErrorCount: 0, decodedBodyBytes: 0, resourceCount: 0, sizeUnavailableCount: 0, serverTiming: [] });
  return records.get(endpoint);
}

export async function measureRoute(browser, storageState, baseUrl, route, sample) {
  const result = { route, sample, status: "failed", requestCount: 0, responseCount: 0, apiRequestCount: 0, apiResponseCount: 0, failedRequestCount: 0, blockedRequestCount: 0, pendingApiCount: 0, browserErrorCount: 0, httpErrorCount: 0, apis: [] };
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, serviceWorkers: "block", acceptDownloads: false });
  const endpoints = new Map();
  const pending = new Set();
  const apiRequests = new WeakSet();
  const responseTasks = new Set();
  let lastApiActivity = Date.now();
  let requestLimitReached = false;
  let pausedRequestCount = 0;
  let timedOut = false;
  let guardFailed = false;
  let collecting = true;
  const stopForRequestLimit = () => {
    if (requestLimitReached) return;
    requestLimitReached = true;
    void context.close().catch(() => {});
  };
  const admitPausedRequest = () => {
    if (requestLimitReached || pausedRequestCount >= LIMITS.requestsPerRoute) {
      stopForRequestLimit();
      return false;
    }
    pausedRequestCount += 1;
    return true;
  };
  const routeTimer = setTimeout(() => {
    timedOut = true;
    void context.close().catch(() => {});
  }, LIMITS.routeMs);
  try {
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.route("**/*", async (intercepted) => {
      const request = intercepted.request();
      if (requestLimitReached || result.requestCount > LIMITS.requestsPerRoute || !isReadOnlyRequest({ url: request.url(), method: request.method() }, baseUrl)) {
        if (result.requestCount > LIMITS.requestsPerRoute) stopForRequestLimit();
        await intercepted.abort("blockedbyclient").catch(() => {});
        return;
      }
      await intercepted.continue().catch(() => {});
    });
    context.on("request", (request) => {
      if (!collecting) return;
      result.requestCount += 1;
      if (result.requestCount > LIMITS.requestsPerRoute) stopForRequestLimit();
      try {
        const address = new URL(request.url());
        if (address.origin === baseUrl && address.pathname.startsWith("/api/")) {
          apiRequests.add(request);
          pending.add(request);
          lastApiActivity = Date.now();
          result.apiRequestCount += 1;
          if (result.requestCount <= LIMITS.requestsPerRoute) endpointRecord(endpoints, request.url()).requestCount += 1;
        }
      } catch {}
    });
    const finishRequest = (request) => {
      if (pending.delete(request)) lastApiActivity = Date.now();
    };
    context.on("requestfinished", finishRequest);
    context.on("requestfailed", (request) => {
      finishRequest(request);
      if (!collecting) return;
      result.failedRequestCount += 1;
      if (request.failure()?.errorText?.includes("ERR_BLOCKED_BY_CLIENT")) result.blockedRequestCount += 1;
      if (apiRequests.has(request) && result.requestCount <= LIMITS.requestsPerRoute) endpointRecord(endpoints, request.url()).failedRequestCount += 1;
    });
    context.on("response", (response) => {
      if (!collecting || !isReadOnlyRequest({ url: response.url(), method: response.request().method() }, baseUrl)) return;
      result.responseCount += 1;
      if (response.status() >= 400) result.httpErrorCount += 1;
      if (!apiRequests.has(response.request())) return;
      result.apiResponseCount += 1;
      const endpoint = endpointRecord(endpoints, response.url());
      endpoint.responseCount += 1;
      if (response.status() >= 400) endpoint.httpErrorCount += 1;
      const task = response.headerValue("server-timing").then((header) => {
        if (collecting) endpoint.serverTiming.push(...sanitizeServerTiming(header));
      }).catch(() => {});
      responseTasks.add(task);
      void task.finally(() => responseTasks.delete(task));
    });
    const page = await context.newPage();
    context.on("page", (opened) => { if (opened !== page) void opened.close().catch(() => {}); });
    const session = await context.newCDPSession(page);
    session.on("Fetch.requestPaused", (event) => {
      void guardPausedRequest(session, event, baseUrl, undefined, admitPausedRequest).catch(() => {
        guardFailed = true;
        void context.close().catch(() => {});
      });
    });
    await session.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
    page.on("pageerror", () => { if (collecting) result.browserErrorCount += 1; });
    page.setDefaultTimeout(LIMITS.navigationMs);
    await page.addInitScript(() => performance.setResourceTimingBufferSize(1000));
    const navigation = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: LIMITS.navigationMs });
    result.httpStatus = navigation?.status() ?? null;
    if (navigation) result.navigationServerTiming = sanitizeServerTiming(await navigation.headerValue("server-timing"));
    const observedAt = Date.now();
    while (Date.now() - observedAt < LIMITS.observationMs) {
      if (Date.now() - observedAt >= LIMITS.minimumObservationMs && pending.size === 0 && Date.now() - lastApiActivity >= LIMITS.quietMs) break;
      await delay(100);
    }
    const snapshot = await page.evaluate(() => {
      const navigationEntry = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource");
      const numeric = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
      return {
        address: location.href,
        metrics: {
          ttfbMs: numeric(navigationEntry?.responseStart),
          serverWaitMs: navigationEntry ? numeric(navigationEntry.responseStart - navigationEntry.requestStart) : null,
          domContentLoadedMs: navigationEntry?.domContentLoadedEventEnd > 0 ? navigationEntry.domContentLoadedEventEnd : null,
          loadMs: navigationEntry?.loadEventEnd > 0 ? navigationEntry.loadEventEnd : null,
          fcpMs: numeric(performance.getEntriesByName("first-contentful-paint")[0]?.startTime),
          snapshotMs: performance.now(),
          decodedBodyBytes: numeric(navigationEntry?.decodedBodySize),
          resourceDecodedBytes: resources.reduce((total, entry) => total + (entry.decodedBodySize || 0), 0),
          jsDecodedBytes: resources.filter((entry) => /\.js(?:\?|$)/.test(entry.name)).reduce((total, entry) => total + (entry.decodedBodySize || 0), 0),
          cssDecodedBytes: resources.filter((entry) => /\.css(?:\?|$)/.test(entry.name)).reduce((total, entry) => total + (entry.decodedBodySize || 0), 0),
          resourceCount: resources.length,
        },
        apis: resources.filter((entry) => {
          const address = new URL(entry.name);
          return address.origin === location.origin && address.pathname.startsWith("/api/");
        }).map((entry) => ({ url: entry.name, decodedBytes: numeric(entry.decodedBodySize) })),
      };
    });
    result.metrics = { ...snapshot.metrics, apiDecodedBytes: 0, apiResourceCount: snapshot.apis.length, apiSizeUnavailableCount: 0 };
    for (const resource of snapshot.apis) {
      const endpoint = endpointRecord(endpoints, resource.url);
      endpoint.resourceCount += 1;
      if (resource.decodedBytes === null || resource.decodedBytes === 0) {
        endpoint.sizeUnavailableCount += 1;
        result.metrics.apiSizeUnavailableCount += 1;
      } else {
        endpoint.decodedBodyBytes += resource.decodedBytes;
        result.metrics.apiDecodedBytes += resource.decodedBytes;
      }
    }
    await Promise.all([...responseTasks]);
    result.pendingApiCount = pending.size;
    const correctPage = reportPath(snapshot.address) === route;
    result.status = navigation?.ok() && correctPage && !requestLimitReached && !timedOut && !guardFailed ? "measured" : "failed";
    if (result.status === "failed") result.failure = correctPage ? "navigation-status" : "redirected";
    result.observationLimitReached = Date.now() - observedAt >= LIMITS.observationMs;
  } catch {
    result.failure = guardFailed ? "guard-failed" : requestLimitReached ? "request-limit" : timedOut ? "route-timeout" : "navigation-or-snapshot";
    result.pendingApiCount = pending.size;
  } finally {
    collecting = false;
    clearTimeout(routeTimer);
    await context.close().catch(() => {});
    if (requestLimitReached) {
      result.status = "failed";
      result.failure = "request-limit";
    }
    result.apis = [...endpoints.values()];
  }
  return result;
}

async function main(args) {
  const options = parseArguments(args);
  if (options.help) {
    console.log("Usage: node scripts/performance/browser-baseline.mjs --scenario reports|maps [--samples 1..10] [--output .local/performance/browser-baseline.json]\nPERF_BASE_URL defaults to http://127.0.0.1:3005. PERF_USERNAME and PERF_PASSWORD are required environment variables.\nPERF_CHROME_PATH optionally selects installed Chrome. Nonlocal origins require PERF_ALLOW_REMOTE=true.\nGET/HEAD only; unsafe GETs, third-party origins, WebSockets and service workers are blocked. Only explicit authentication uses POST.\nDesktop lab samples, bounded to 10 minutes; no browser downloads, screenshots, traces, response contents, session files, field percentiles or interaction metrics.");
    return;
  }
  const baseUrl = validateBaseUrl(process.env.PERF_BASE_URL, { allowRemote: process.env.PERF_ALLOW_REMOTE }).origin;
  const username = process.env.PERF_USERNAME;
  const password = process.env.PERF_PASSWORD;
  if (!username || !password) throw new Error("PERF_USERNAME and PERF_PASSWORD are required.");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  assertIgnoredOutput(root, options.output);
  const executablePath = chromeExecutable();
  const { chromium } = await import("playwright-core");
  const report = {
    schemaVersion: 1, scenario: options.scenario, samplesPerRoute: options.samples,
    environment: { device: "desktop", viewport: { width: 1440, height: 960 }, networkThrottled: false, cpuThrottled: false, thirdPartyRequestsBlocked: true, httpCacheDisabledByRouting: true },
    limits: LIMITS, results: [], status: "incomplete",
    limitations: [
      "Lab navigation observations only; not field percentiles or interaction latency.",
      "Fresh contexts share in-memory authentication only. Browser process and server caches remain warm; no warmup is discarded.",
      "Routing disables HTTP cache. Third-party map tiles, WebSockets, service workers and unsafe operations are blocked, changing workload.",
      "Decoded bytes come from completed Resource/Navigation Timing entries, not wire sizes; zero or missing sizes are unknown or empty, not proven empty payloads.",
      "Observation is bounded, not proof of hydration, business readiness or completed background traffic. No scrolling or interaction is performed.",
      "Unknown API paths are redacted and may collapse together. Only known Server-Timing names and durations are retained; descriptions are discarded.",
      "GET safety relies on endpoint semantics. Known archive/setup/seed/admin-backup paths are denied, but this is not a database-level read-only guarantee.",
    ],
  };
  const browser = await chromium.launch({ executablePath, headless: true, timeout: LIMITS.authMs, args: ["--disable-background-networking", "--disable-component-update", "--disable-sync"] });
  let deadlineReached = false;
  const deadline = Date.now() + LIMITS.runMs;
  const runTimer = setTimeout(() => {
    deadlineReached = true;
    void browser.close().catch(() => {});
  }, LIMITS.runMs);
  try {
    const storageState = await authenticate(browser, baseUrl, username, password);
    for (let sample = 1; sample <= options.samples; sample += 1) {
      for (const route of SCENARIOS[options.scenario]) {
        if (deadlineReached || Date.now() >= deadline) break;
        const result = await measureRoute(browser, storageState, baseUrl, route, sample);
        report.results.push(result);
        console.log(JSON.stringify({ route, sample, status: result.status, requestCount: result.requestCount, responseCount: result.responseCount }));
      }
    }
    report.status = deadlineReached ? "run-limit" : report.results.some((result) => result.status !== "measured") ? "completed-with-failures" : "complete";
  } catch {
    report.status = deadlineReached ? "run-limit" : "setup-failed";
  } finally {
    clearTimeout(runTimer);
    await browser.close().catch(() => {});
    writeJsonReport(root, options.output, report);
  }
  console.log("Baseline written to ignored performance output.");
  if (report.status !== "complete") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(() => {
    console.error("Baseline failed. Check CLI arguments, PERF_* environment, installed Chrome and ignored output; details suppressed for privacy.");
    process.exitCode = 1;
  });
}
