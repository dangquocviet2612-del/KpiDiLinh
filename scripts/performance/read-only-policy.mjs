import { execFileSync } from "node:child_process";
import { constants, closeSync, lstatSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SCENARIOS = Object.freeze({
  reports: Object.freeze(["/prepaid", ...["summary", "summary-manager", "kpi-calculator", "cuoc", "cuoc-cd", "cdt", "cdt-report", "cdt-outstanding", "disconnect", "official-docs"].map((view) => `/prepaid?view=${view}`)]),
  maps: Object.freeze(["/map", "/node-map", "/node-0tb"]),
});

export const LIMITS = Object.freeze({ maxSamples: 10, runMs: 600_000, routeMs: 25_000, navigationMs: 15_000, observationMs: 8_000, quietMs: 650, minimumObservationMs: 1_000, authMs: 10_000, requestsPerRoute: 500 });
export const METRIC_NAMES = Object.freeze(["ttfbMs", "serverWaitMs", "domContentLoadedMs", "loadMs", "fcpMs", "snapshotMs", "decodedBodyBytes", "resourceDecodedBytes", "apiDecodedBytes", "jsDecodedBytes", "cssDecodedBytes", "resourceCount", "apiResourceCount", "apiSizeUnavailableCount"]);
export const TIMING_PHASES = Object.freeze(["auth", "schema", "scope", "date", "query", "compute", "serialize", "total", "cache"]);
export const COUNT_NAMES = Object.freeze(["requestCount", "responseCount", "apiRequestCount", "apiResponseCount", "failedRequestCount", "blockedRequestCount", "pendingApiCount", "browserErrorCount", "httpErrorCount"]);

const viewValues = new Set(["summary", "summary-manager", "kpi-calculator", "cuoc", "cuoc-cd", "cdt", "cdt-report", "cdt-outstanding", "disconnect", "official-docs", "account-node-mappings", "node-accounts"]);
const pagePaths = new Set(["/", "/prepaid", "/map", "/node-map", "/node-0tb", "/login"]);
const apiPaths = new Set([
  "/api/auth/csrf", "/api/auth/session", "/api/me", "/api/customers", "/api/customers/map-data", "/api/customers/search-map", "/api/nodes", "/api/node-search-map", "/api/node-0tb", "/api/churn-risk", "/api/kpi/report", "/api/kpi/summary", "/api/kpi/manager-summary", "/api/kpi/config", "/api/cdt/report", "/api/cdt/summary", "/api/cdt/outstanding/report", "/api/cuoc/report", "/api/cuoc/config", "/api/cuoc-cd/report", "/api/cuoc-cd/config", "/api/disconnect/report", "/api/official-documents", "/api/logs",
]);

function httpUrl(value) {
  if (typeof value !== "string" || value.length > 16_384 || !/^https?:\/\//i.test(value) || value.trim() !== value) throw new Error("Invalid HTTP(S) URL.");
  const address = new URL(value);
  if (!["http:", "https:"].includes(address.protocol) || address.username || address.password || value.split("/")[2].includes("@")) throw new Error("Invalid HTTP(S) URL.");
  return address;
}

export function validateBaseUrl(value = "http://127.0.0.1:3005", { allowRemote } = {}) {
  const address = httpUrl(value);
  if (address.pathname !== "/" || address.search || address.hash) throw new Error("Base URL must contain only an origin.");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(address.hostname) && allowRemote !== "true") throw new Error("Remote origins require PERF_ALLOW_REMOTE=true.");
  return address;
}

function canonicalPath(pathname) {
  let decoded = pathname;
  for (let attempt = 0; attempt < 4 && decoded.includes("%"); attempt += 1) decoded = decodeURIComponent(decoded);
  if (/[%;\s\u0000-\u001f\u007f]/.test(decoded)) throw new Error("Ambiguous request path.");
  const normalized = decoded.replaceAll("\\", "/").replace(/\/{2,}/g, "/");
  return new URL(normalized, "http://policy.invalid").pathname.toLowerCase().replace(/\/$/, "") || "/";
}

export function isReadOnlyRequest({ url, method }, baseUrl) {
  try {
    const address = httpUrl(url);
    if (address.origin !== new URL(baseUrl).origin || !["GET", "HEAD"].includes(method)) return false;
    const pathname = canonicalPath(address.pathname);
    return !/^\/(?:api\/)?(?:archive|setup|seed)(?:\/|$)/.test(pathname)
      && !/^\/(?:api\/)?admin\/backup(?:\/|$)/.test(pathname)
      && !/^\/api\/auth\/(?!csrf$|session$)/.test(pathname);
  } catch {
    return false;
  }
}

export function isAuthenticationRequest({ url, method, form }, baseUrl) {
  try {
    const address = httpUrl(url);
    const origin = new URL(baseUrl).origin;
    if (address.origin !== origin || address.search || address.hash) return false;
    if (method === "GET" && address.pathname === "/api/auth/csrf") return true;
    return method === "POST" && address.pathname === "/api/auth/callback/credentials"
      && form !== null && typeof form === "object"
      && Object.keys(form).length === 4
      && ["csrfToken", "username", "password"].every((name) => typeof form[name] === "string" && form[name].length > 0)
      && form.callbackUrl === `${origin}/`;
  } catch {
    return false;
  }
}

export function reportPath(value) {
  try {
    const address = new URL(value, "http://policy.invalid");
    const pathname = address.pathname;
    if (!pagePaths.has(pathname) && !apiPaths.has(pathname)) return pathname.startsWith("/api/") ? "/api/[redacted]" : "/[redacted]";
    const views = address.searchParams.getAll("view");
    return `${pathname}${views.length === 1 && viewValues.has(views[0]) ? `?view=${views[0]}` : ""}`;
  } catch {
    return "/[redacted]";
  }
}

function splitHeader(value, separator) {
  const parts = [];
  let quoted = false;
  let escaped = false;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) escaped = false;
    else if (character === "\\" && quoted) escaped = true;
    else if (character === '"') quoted = !quoted;
    else if (character === separator && !quoted) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  if (quoted || escaped) return [];
  return [...parts, value.slice(start)];
}

export function sanitizeServerTiming(header) {
  if (typeof header !== "string" || header.length > 8192) return [];
  return splitHeader(header, ",").flatMap((metric) => {
    const [name, ...parameters] = splitHeader(metric, ";").map((part) => part.trim());
    if (!TIMING_PHASES.includes(name)) return [];
    const durations = parameters.filter((parameter) => /^dur\s*=/.test(parameter));
    if (durations.length !== 1 || !/^dur\s*=\s*\d+(?:\.\d+)?$/.test(durations[0])) return [];
    const durationMs = Number(durations[0].split("=")[1]);
    return Number.isFinite(durationMs) ? [{ name, durationMs }] : [];
  });
}

export function assertIgnoredOutput(root, destination) {
  if (typeof destination !== "string" || destination.includes("\0")) throw new Error("Invalid performance output path.");
  const repository = path.resolve(root);
  const directory = path.join(repository, ".local", "performance");
  const target = path.resolve(repository, destination);
  const relative = path.relative(directory, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || path.extname(target) !== ".json") throw new Error("Output must be JSON below .local/performance/.");
  let ancestor = repository;
  const segments = path.relative(repository, target).split(path.sep);
  for (const [index, segment] of segments.entries()) {
    ancestor = path.join(ancestor, segment);
    const entry = lstatSync(ancestor, { throwIfNoEntry: false });
    if (entry && (entry.isSymbolicLink() || (index < segments.length - 1 ? !entry.isDirectory() : !entry.isFile() || entry.nlink !== 1))) throw new Error("Output links and non-regular paths are forbidden.");
  }
  try {
    execFileSync("git", ["-C", repository, "check-ignore", "--quiet", "--", path.relative(repository, target)], { stdio: "pipe", timeout: 5_000 });
  } catch {
    throw new Error("Performance output must be gitignored and untracked.");
  }
  return target;
}

export function writeJsonReport(root, destination, report) {
  const target = assertIgnoredOutput(root, destination);
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  assertIgnoredOutput(root, destination);
  const descriptor = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW ?? 0), 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`);
  } finally {
    closeSync(descriptor);
  }
}
