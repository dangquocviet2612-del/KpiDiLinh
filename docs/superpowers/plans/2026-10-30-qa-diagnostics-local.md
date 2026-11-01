# Opt-in QA diagnostics recorder — Implementation Plan

> Continue the user-approved next step after69. Use TDD and independent spec→quality review. Local only: no auth/application/oldtest/config/dependency/npm-test/CI edits, no real database/import/login, commit/push/deploy or candidate68promotion.

**Goal:** Provide a reusable opt-in command that records sanitized metadata during the same failed QA run, preserving failure exit codes without retrying the suite or weakening its budget.

**Architecture:** Add `scripts/testing/qa-diagnostics.mjs`, `qa-env-guard.cjs`, and Node built-in tests. The CLI requires an explicit unit/UI selection and safe output label. It derives the repository from its own location, checks gitignored/untracked regular JSON destinations under .local/performance, and refuses pre-existing files. Parent runs exactly one child with synthetic memory DB/empty Turso credentials/env-discovery guard, no test/profiler setup, config override or retry. Child uses startVitest(filters,{root,run:true},{envDir:false}), captures after-return metadata and closes idempotently. Main JSON and separate process JSON are exclusive, distinct files; no output collision or overwrite. No default/CI adoption.

**Privacy and failure semantics:** Persist only repository-relative test module paths, ordinal/outcome/timing/counts, one fixed target label, sanitized project numbers/enums and four known aggregate module RPC labels. Do not persist arbitrary test names/errors/stacks/stdout/ENV/request/response/credentials or absolute paths. Bound records/JSON and fail closed on incomplete capture. Include module/collection failure, unhandled errors, runtime exit and child signal; never turn failed tests into success. Raw Vitest console stays standard and is not saved/redacted by the tool. This is not a sandbox for arbitrary tests; run only reviewed mocked unit/UI selection. Guard only blocks normal env discovery paths, not arbitrary I/O/network.

**Files:** Create three scripts above and `docs/qa-diagnostics.md`, this plan; update roadmap and append70 in `tiendokpi.md`. No package/CI changes. Keep the two existing source deltas68 in worktree only; primary app67unchanged.

## Checklist
- [x] Snapshot both roots, candidate68divergence, prior artifacts/HEAD/index/oldBUILD_ID and scoped instructions.
- [x] Add Node regressions for argument/output policy, redaction/bounds, pass/fail/module-error/timeout/runtime-exit/capture-error, child env and env guard; observe RED before implementation.
- [x] Minimal recorder/guard GREEN; controlled actual-Vitest synthetic failing fixtures prove report+exit1, no app-suite rerun. V1 exposed SDK task-count semantics; keep its failed assertion/report. Add two failing regressions, fix case-vs-task count, preregister exactly one V2 fixture on changed source. No unchanged retry or app gate closure.
- [x] Independent spec→quality exact3hash review, fresh48Node tests+22existingpolicy/syntax/help/types/lint0warning in both roots; no oldtest/config/CI changes. Prior spec P2 for undefined diagnostic reproduced RED2 then fixed via null-safe reads; no new real-Vitest run for that narrow fix.
- [x] Default redacted secret/whitespace/backups/inventory and seven-file local integration; docs/append70 keep auth/rootcause/68/full-native/browser/release pending. Final guards/scan/hash artifacts are in integrated-files.json; source68 remains worktree-only and old531publicpaths/2231artifacts stay preserved apart from the two owned docs updates.

## Verification and limits

Do not run the1276case application suite again to get green. Test collector/CLI using fake contexts and temporary synthetic fixtures. Initial plan allowed one tiny real Vitest fixture (one pass/one intentional failure) under ignored local storage. V1 found a real SDK counter interpretation bug in the new tool, not an auth bug; keep the failure and change source only after two RED regressions. Plan adjusted to preregister one V2 fixture after that fix, with separate paths and no timeout/pool/retry changes. Both child exits remain1; this verifies the recorder contract, not a passing application gate. JSON metadata is not a full worker/import/handler trace or proof of rootcause. No RUM/service/cost/remote upload. Tooling can be accepted independently while original68gate remains false and source68 stays quarantined.
