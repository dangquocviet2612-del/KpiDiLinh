# Same-process cache generation fence — 28/10/2026

**Scope:** Approved Task7 continuation, only stale in-flight refill protection. No auth/JWT/session-policy change, DB/schema/dependency change, real env/data, commit/push/deploy. Reuse existing detached checkout and preserve all23 prior primary changes. Windows native issue remains open.

**Design:** One opaque process-local generation token, replaced on every explicit prefix invalidation even if no entry exists. Capture it at the start of EVERY production function that writes kpi-cache, before any await/auth/scope/metadata query. Pass it to setCache; stale token must return before ANY cache mutation, including expired/invalid-TTL cleanup or replacement eviction. Existing stored unrelated-prefix values remain unchanged; all ongoing writes are conservatively fenced after any invalidation. O(1) generation metadata, no growing key/prefix tombstones. Preserve existing TTL/LRU/caps/keys and legacy 3-arg setter only for compatibility/tests; production wiring policy requires explicit4th token. Never claim in-flight response cancellation, immediate permission/JWT revocation, single-flight or multi-instance synchronization.

**Production files:** src/lib/kpi-cache.ts (parent core); all18 existing writer callers: scope.ts, prepaid-query.ts and16 GET route files found by inventory. Caller changes are mechanical import + entry capture +4th setter argument ONLY. Guard order, SQL, payload, errors, Server-Timing and flags remain unchanged.

**Tests:** New tests/unit/cache-read-generation.test.ts (parent) exercises actual me/scope/prepaid deferred races and core stale-setter rules; a temporary test-only fallback may represent the old generation-less API for behavioral RED, removed from final tests. New tests/unit/cache-generation-wiring.test.ts enforces early capture/4th-token coverage across every production writer using TypeScript AST. Seven existing cache-mock test files may add the new export and exact4th argument assertions, no assertion weakening.

- [x] Snapshot primary/worktree/hash and prior23 changes; no resets or new branch. 393 files /317 matching source files recorded.
- [x] Genuine RED for me pending invalidation/fresh replacement/auth wait, scope/prepaid nested scope, stale TTL eviction and generation epoch behavior. 14 semantic failures /4 controls pass.
- [x] Minimal core implementation and all production-writer entry wiring, keep guards/SQL/status/body unchanged. 34 writes /23 functions /18 callers plus core and seven mock-test files; 37 new tests pass.
- [x] Independent spec then quality review of frozen delta; both APPROVE with all28 frozen hashes unchanged, no actionable P1/P2.
- [x] Specific then full worktree validation, policy/types/lint and fake-env build. 61 files /733 tests +22 policy pass, types/build pass, lint 2 old warnings. Windows reliability remains open, no auto retry or skip.
- [x] Hash/backup/secret-scan exact delta; integrate34 files and validate primary61 files/733 tests +22 policy/types/lint, preserve23 prior changes;319 source files match built checkout; update progress and limitations honestly, no publish.

**Remaining:** Single-flight, byte budget, stable subject/permission version, fresh auth/revocation SLA and cross-process invalidation remain Task7 gaps. Original requests may still receive their pre-invalidation result; this slice only forbids publishing that result into subsequent cache hits.

**Runner qualification:** Worktree full run used outer envDir:false; preexisting timezone wrappers spawn CLI and their env-file discovery was not explicitly disabled. Explicit fake database/Turso env stayed set. Original verification manifest retained and corrected without changing results. Build had root env-file guard; primary QA must inherit guard covering both roots, including nested children. Do not claim initial child discovery was blocked.

**Final checkpoint:** Spec/quality approved28 frozen source hashes. Primary full QA passed with inherited two-root env-file guard, source/fake fixture unchanged. Initial helper preload failed before Vitest because Windows backslashes were interpreted in NODE_OPTIONS; original log/manifest retained, helper path normalized and guard probed before first actual primary suite. No application change or native-failure retry; native Windows reliability remains open. No commit/push/deploy.
