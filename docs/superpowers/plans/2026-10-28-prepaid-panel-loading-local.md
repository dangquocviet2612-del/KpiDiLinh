# On-demand report panel bundles — local 28/10/2026

> For agentic workers: use superpowers:subagent-driven-development with independent spec then quality review. Approved Task8 continuation; do not commit/push/deploy.

**Goal:** Keep personal KPI entry from loading inactive report UI code, without changing formulas, roles, filters/drafts or API lifecycles.

**Architecture:** First incremental slice only: retain personal panel, all hooks/state and current view/guard selection in PrepaidPageImpl. Convert the ten other panel imports to top-level literal next/dynamic loaders, default SSR retained. Share an accessible loading shell using existing container/skeleton styles. Add a prepaid-scoped error boundary with explicit full-page reload so a rejected lazy module can recover without relying on resetting a cached rejected promise. No dependency/CSS/API/auth/cache/DB changes.

**Trade-offs:** Full view-container/hook extraction would remove more eager hook code but can reset shared dates/CTV/drafts and is deferred. Lazy UI only keeps API startup parallel with chunk loading, avoiding a new code→data waterfall. No intent preload in this slice; do not call preloadAll or enable hidden hooks. CSS remains shared/eager. No promise of 15–25% or cloud latency before measurement.

**File scope:** Modify src/app/(dashboard)/prepaid/PrepaidPageImpl.tsx; create PrepaidPanelLoading.tsx and error.tsx in that directory; create tests/ui/prepaid-view-loading.test.tsx. Existing UI regression files may receive only genuine asynchronous mount waits if demonstrated necessary, with every business assertion retained. No hook/panel internals or previous cache/auth changes.

**Safety:** Reuse existing detached WT D:/code/webkpimoi/.worktrees/ux-performance-batch1, do not reset/branch. Preserve all55 primary local changes. Test only existing synthetic batch6 SQLite; never read/print real env/credentials or use realDB/cloud. Guard both roots' env files through NODE_OPTIONS and Vitest envDir:false, including nested timezone CLI. Keep native Windows reliability gate open; no pool change/skip/auto retry of native failures.

- [x] Snapshot primary/WT/previous source hashes and current built artifact identity.397 files/319 matching sources,55 prior changes.
- [x] Baseline cold JS bytes/chunks for personal and all ten secondary views, desktop/mobile;3-role KPI payload/request checks on fake preview.34 cases,783436 decoded JS bytes/12 scripts each; fakeDB unchanged.
- [x] Genuine RED module-evaluation/active-view/lazy loading/hidden endpoint tests; implement minimal dynamic panel slice; preserve lifecycle tests.18 expected RED evaluation failures;20 new tests and192 total UI tests pass. Existing461 assertions/18 UI files unchanged.
- [x] Frozen bounded delta: independent spec then quality both APPROVE on4 unchanged hashes, no actionable P1/P2. First quality attempt failed service capacity without reviewing, preserved as nonapproval.
- [x] Full WT62 files/753 tests +22 policy/types/lint and guarded fake build pass,lint2oldwarnings.34browsercasesmatchAPI/UI;personal783436->638158decodedbytes(-18.54%);actualpendingchunkAPIparallel/loading anderror/reload/backchecks pass with documentedbaseline draftreset.
- [x] Backup/secret scan/integrate8 exact files, preserve55 prior changes, primary62 files/753 tests+22 policy/types/lint pass with2oldwarnings;322 source files byte-match built checkout. Roadmap/tiendokpi updated honestly; no publish.

**Acceptance:** Inactive panel modules/chunks absent from personal initial entry; selected view only loads needed panel UI. Direct URLs, authorization, API request count/payload and normal navigation state remain unchanged. Skeleton is accessible and layout bounded; report code failure has explicit reload. Reject regressions or a new data waterfall. Record measured JS/body bytes (decoded), distinguish shared runtime from route-specific bytes and avoid p95/network claims.

**Still pending:** Actual view/hook ownership extraction, CSS domain split, production/slow-network budgets, broader Task7 auth/version/single-flight and native Windows gate. This slice does not complete Task8 or the roadmap.

**Observed baseline limits:** Native browser back preserves CTV/date but existing useKpiCalculator force-refresh normalizes draft from server on reentry, so settled draft is not preserved. Initial navigation harness wrongly expected it to persist and failed after recording all observations; retain that log/result. The new runtime test only asserts retention while reentry refresh is pending, explicitly named. Do not claim this slice fixes settled draft reset or alter the unchanged hook/business body. After-browser must compare existing settled behavior, not silently mark draft preservation true.

**Baseline harness correction:** Initial zero-requestfailed assumption incorrectly rejected21/26 aborted Next RSC prefetches. Diagnostic proves nonnavigation fetch + _rsc + net::ERR_ABORTED, not script/API failure; classifier now records those separately and still fails every unexpected/API/script/navigation error. Both old failed logs and diagnostic retained.34-case baseline completed after correction, no application changes for harness.

**Final scope:** Only lazy leaf UI/loading/error recovery delivered. Hooks/state/CSS remain eager, settled draft reset still exists, no native/JWT/shared-cache fix and no cloud release. Final integration manifest/source-byte proof and default secret scan retained privately; no application edits after QA.
