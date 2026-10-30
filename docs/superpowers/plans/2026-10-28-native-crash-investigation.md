# Native KPI test crash investigation — 28/10/2026

**Scope:** Resolve or precisely bound the primary acceptance gate from batch8. No new product changes, commit/push/deploy, real database or credential access. Preserve 21 local changes and original failure evidence.

- [x] Snapshot 391 files/317 matching source files, preserve 21 prior changes; installed native SHA identical, runtime and cleanup paths inspected.
- [x] Bounded direct probe60/480 pass; correct-cwd native file60/60 pass; finalizer matrix18 children reproduces4/6 native-unclosed crashes, node:sqlite/explicit-close6/6 pass each. Additional matched unclosed node:sqlite control6/6 passes (24 total children, no retry). Harness cwd error retained separately. Initial matrix launcher0 means report collection completed, not child pass; final launcher propagates nonzero.
- [x] No evidence-backed in-repo crash fix established. Do not mistake exceptional-cleanup gaps or passing samples for the cause/fix. No source/dependency/pool changes or global installs.
- [x] One instrumented full diagnostic59/696 passes with env discovery disabled and fake data; prior failed full run remains intact. No automatic retries, skipped tests or suppressed failures.
- [ ] Close Windows native reliability acceptance only after a verified binding fix and regression validation; a native stack alone only diagnoses it. Approved Linux validation is a separate runtime gate and does not prove Windows fixed. Current investigation bounds the failing native class, not an exact original frame or a shipped fix.
- [x] Four documentation files integrated after backup/hash/secret and whitespace checks. All317 app/test/config source hashes remain unchanged, prior21 local changes preserved, diagnostic evidence archived. No commit/push/deploy.

## Stable-release eligibility follow-up — 28/10/2026

- [x] Preserve latest primary failure: cache-invalidation.test.ts worker3221225477,801/815completed. No suite/stress retry or skip/pool workaround.
- [x] Snapshot407files/323matching sources/67prior changes. Read public npm metadata and immutable-version source: stable0.5.29/gitHead55bee86 declares core0.9.30; source core disconnect lacks raw-null assignment and binding lacks PR235 pin function.
- [x] Reject speculative upgrade: no verified fixed stable candidate established, no package/binary installed or inspected, no dependency/app/test changes or database access. Source/metadata comparison does not establish exact new crash frame or binary provenance.
- [x] Owner chose Task9 independent map payload optimization with native Windows warning retained. No WSL/Docker/cloud CI or Git push started; see progress section32 and 2026-10-28-node0tb-projection-local.md. Selection does not close native acceptance.
- [ ] Windows native acceptance remains OPEN until a patched binding is actually verified with regression. Historical passing full runs and Linux acceptance cannot close this gate.

See docs/native-crash-investigation.md follow-up and progress section31. Private evidence .local/performance/native-stable-audit-20261028/; no logs/env/SQLite/credentials committed. Original section26 results above remain historical, not overwritten.
