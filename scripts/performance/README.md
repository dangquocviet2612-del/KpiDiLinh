# Read-only browser baseline (Task 1)

Use only the synthetic local preview for this task. Do not target Production or an application connected to real data. This harness is a bounded desktop lab observation, not a load test or an enforcement mechanism for database read-only access.

## Offline verification

```sh
node --test scripts/performance/read-only-policy.test.mjs
node scripts/performance/browser-baseline.mjs --help
node scripts/performance/summarize-baseline.mjs --help
```

These commands do not launch Chrome, load credentials, or contact the app. Policy tests create and remove synthetic temporary Git repositories; they need Node and Git, not Playwright or an application database.

## Local preview usage

The parent task supplies `playwright-core@1.56.1` and package scripts. The harness never downloads a browser or installs dependencies. Set `PERF_USERNAME` and `PERF_PASSWORD` in the calling process environment without printing them. No credential file, `.env`, application configuration, or private project path is read by these scripts.

`PERF_BASE_URL` defaults to `http://127.0.0.1:3005`. It must be an HTTP(S) origin without embedded credentials, a path, query, or fragment. Only `localhost`, `127.0.0.1`, and `[::1]` are local. Other origins are rejected unless `PERF_ALLOW_REMOTE` is exactly `true`; that opt-in is not permission to run against Production or real data for this task. All browser requests remain restricted to the exact validated origin, even with this opt-in.

`PERF_CHROME_PATH` optionally supplies an absolute installed executable path. Otherwise the script searches standard Windows Google Chrome locations and Linux Chrome/Chromium locations. It uses a fresh headless browser, no persistent profile, and a fixed 1440 x 960 desktop viewport.

Only after the isolated fake-data preview is ready:

```sh
node scripts/performance/browser-baseline.mjs --scenario reports --samples 3
node scripts/performance/summarize-baseline.mjs
node scripts/performance/browser-baseline.mjs --scenario maps --samples 3 --output .local/performance/maps.json
node scripts/performance/summarize-baseline.mjs --input .local/performance/maps.json --output .local/performance/maps-summary.json
```

`--scenario` is required; there is no default scenario. `--samples` defaults to 1 and accepts integers 1 through 10. Unknown, duplicate, or missing arguments fail closed. Routes are fixed, with no arbitrary URL, interaction, upload, download, or mutation scenario:

- `reports`: `/prepaid`, then `/prepaid?view=` for `summary`, `summary-manager`, `kpi-calculator`, `cuoc`, `cuoc-cd`, `cdt`, `cdt-report`, `cdt-outstanding`, `disconnect`, `official-docs` (11 routes per sample).
- `maps`: `/map`, `/node-map`, `/node-0tb` (3 routes per sample).

Every route/sample gets a fresh context with authentication held only in memory. Authentication performs one explicit CSRF GET and one credentials POST, with automatic redirects disabled, on the same validated origin, then verifies the session with a guarded GET. There is no blanket browser POST exception. Credentials authentication may create a session; no business mutation is intentionally sent.

## Bounds and safety

- Browser traffic is guarded on all paths, not just `/api/`: only GET and HEAD may pass; OPTIONS and all mutation methods are denied. All `/archive/*`, `/api/archive/*`, setup/seed and admin-backup trees are denied, including encoded/case/slash aliases. Browser auth routes other than CSRF/session reads are denied.
- Playwright context routing guards resources, and a Chromium Fetch interception layer independently revalidates main-page requests including every redirect hop. Guard failures close the context. WebSockets, service workers, third-party requests, popups, and browser downloads are disabled or blocked.
- Maximum 10 samples, 500 attempted requests per route, 15 seconds for navigation, 25 seconds per route and 10 minutes for the sampling run after browser launch. Browser launch and each authentication request have a 10-second timeout. Timers close the context/browser when limits are reached; browser shutdown can add overhead.
- After DOMContentLoaded, observe for at least 1 second and stop after 650 ms of API quiet or 8 seconds, whichever occurs first after that minimum. Quiet is not proof of completed hydration or background work. Pending API and observation-limit counts remain visible.
- GET does not universally mean side-effect-free. Known dangerous reads are blocked even if a particular app revision makes them safe. Use a synthetic database; do not rely on client routing as a database security boundary.

## Output and interpretation

The baseline defaults to `.local/performance/browser-baseline.json`; the summary defaults to `.local/performance/summary-baseline.json`. `--output` and summary `--input` are confined to JSON files below this checkout's `.local/performance/`. Before creating directories or writing, the scripts check Git ignores and reject tracked output, path escapes, links/junctions, hard-linked targets, or nonregular files. A second check runs immediately before writing. Existing JSON output is overwritten; choose distinct filenames to retain batches.

Reports contain fixed route labels, counts, numeric timings, and redacted API paths only. There are no credentials, origins, cookies, sessions, response contents, screenshots, traces, console messages, raw errors, or customer identifiers. Only known static API paths survive; dynamic/unknown API paths collapse to `/api/[redacted]`. Queries and fragments are dropped except one recognized `view` value. `Server-Timing` is read from the response header, retaining only known phase names and finite nonnegative durations; all descriptions and unknown names are discarded.

Per route: attempted request/response/API/failure/blocked counts, HTTP errors, pending APIs, browser error count, navigation status and timing, FCP when available, decoded navigation/resource/API/JS/CSS byte totals. Per API path: request/response/failure/error counts, completed resource count, decoded bytes, unknown-or-empty size count and sanitized Server-Timing observations. Authentication setup traffic is excluded from route measurements. Raw response contents are never requested by the measurement code; byte sizes come from Navigation/Resource Timing. Zero sizes can mean an empty response, cache/security restrictions, or unavailable data, not necessarily a zero-size payload. In-flight responses are omitted from decoded totals.

The summary groups routes and observed API paths and reports count, median, min and max of finite nonnegative numeric observations. Failed route attempts are counted but excluded from measurement statistics. Endpoint count statistics include only samples where that endpoint was observed, not inferred zeroes. Server-Timing statistics describe individual header metric occurrences, not an inferred route-level server duration. Unknown paths may collapse together. Summary input is capped at 8 MiB and 110 route results.

One sample is a single observation, **not p95, p75, INP or a field Core Web Vitals result**. Even repeated samples report only median/min/max, with no percentile or interaction claims. No scrolling, interaction, CPU/network throttling, device emulation, business-readiness checks or cold-server-cache resets are performed. Context routing disables browser HTTP cache; server/browser-process caches can warm across samples. Blocked third-party map tiles and mutation-backed features change the workload. Partial/failed reports exit nonzero and retain explicit failure states rather than pretending a complete baseline.
