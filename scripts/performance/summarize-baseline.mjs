import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertIgnoredOutput, COUNT_NAMES, METRIC_NAMES, reportPath, TIMING_PHASES, writeJsonReport } from "./read-only-policy.mjs";

export function summaryStats(values) {
  const ordered = values.filter((value) => typeof value === "number" && Number.isFinite(value) && value >= 0).sort((first, second) => first - second);
  const count = ordered.length;
  const middle = Math.floor(count / 2);
  return { count, median: count ? count % 2 ? ordered[middle] : ordered[middle - 1] / 2 + ordered[middle] / 2 : null, min: count ? ordered[0] : null, max: count ? ordered[count - 1] : null };
}

export function summarizeBaseline(report) {
  if (!report || !["reports", "maps"].includes(report.scenario) || !Array.isArray(report.results) || report.results.length > 110) throw new Error("Invalid bounded baseline report.");
  const groups = new Map();
  for (const result of report.results) {
    const route = reportPath(typeof result?.route === "string" ? result.route : "");
    if (!groups.has(route)) groups.set(route, []);
    groups.get(route).push(result);
  }
  return {
    schemaVersion: 1,
    scenario: report.scenario,
    statistics: "median/min/max of observed lab samples only",
    routes: [...groups].map(([route, attempts]) => {
      const measured = attempts.filter((attempt) => attempt?.status === "measured");
      const endpoints = new Map();
      for (const attempt of measured) {
        if (!Array.isArray(attempt.apis) || attempt.apis.length > 500) continue;
        for (const api of attempt.apis) {
          const endpoint = reportPath(typeof api?.path === "string" ? api.path : "");
          if (!endpoint.startsWith("/api/")) continue;
          if (!endpoints.has(endpoint)) endpoints.set(endpoint, []);
          endpoints.get(endpoint).push(api);
        }
      }
      return {
        route,
        attemptedSamples: attempts.length,
        measuredSamples: measured.length,
        failedSamples: attempts.length - measured.length,
        ...Object.fromEntries(COUNT_NAMES.map((name) => [name, summaryStats(measured.map((attempt) => attempt[name]))])),
        metrics: Object.fromEntries(METRIC_NAMES.map((name) => [name, summaryStats(measured.map((attempt) => attempt.metrics?.[name]))])),
        apis: [...endpoints].map(([endpoint, observations]) => ({
          path: endpoint,
          observedSamples: observations.length,
          ...Object.fromEntries(["requestCount", "responseCount", "failedRequestCount", "httpErrorCount", "decodedBodyBytes", "resourceCount", "sizeUnavailableCount"].map((name) => [name, summaryStats(observations.map((api) => api[name]))])),
          serverTiming: Object.fromEntries(TIMING_PHASES.flatMap((name) => {
            const durations = observations.flatMap((api) => Array.isArray(api.serverTiming) ? api.serverTiming.filter((metric) => metric?.name === name).map((metric) => metric.durationMs) : []);
            const stats = summaryStats(durations);
            return stats.count ? [[name, stats]] : [];
          })),
        })),
      };
    }),
  };
}

function main(args) {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    console.log("Usage: node scripts/performance/summarize-baseline.mjs [--input .local/performance/browser-baseline.json] [--output .local/performance/summary-baseline.json]\nSummarizes bounded lab observations using median/min/max, never field percentiles.");
    return;
  }
  const options = { input: ".local/performance/browser-baseline.json", output: ".local/performance/summary-baseline.json" };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!["--input", "--output"].includes(flag) || seen.has(flag) || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("Invalid summary arguments.");
    seen.add(flag);
    options[flag.slice(2)] = args[index + 1];
  }
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const input = assertIgnoredOutput(root, options.input);
  const output = assertIgnoredOutput(root, options.output);
  if (input.toLowerCase() === output.toLowerCase() || statSync(input).size > 8 * 1024 * 1024) throw new Error("Invalid summary input.");
  const report = JSON.parse(readFileSync(input, "utf8"));
  writeJsonReport(root, options.output, summarizeBaseline(report));
  console.log("Summary written to ignored performance output.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch {
    console.error("Summary failed. Check arguments and the bounded, ignored baseline JSON; details suppressed for privacy.");
    process.exitCode = 1;
  }
}
