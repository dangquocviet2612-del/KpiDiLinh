# FTTH synthetic upgrade verification

> Execute with executing-plans/subagent-driven-development; local-only verification of the approved FTTH migration and Task 3 safety requirements, not a new application feature.

**Goal:** Verify the real migration runner against a new SQLite fixture and a tracked five-migration fixture upgraded to FTTH, preserving existing CD/KPI/customer data.

**Architecture:** A test-only adapter maps the migration runner's execute/transaction/batch interface to Node SQLite on an actual temporary file. Run the real migration catalog and read-only runtime validator. This does not exercise native libSQL, CLI/env handling, Prisma, Turso, recovered/anonymized user data, concurrency, browser rendering or production deployment.

**Scope:** One new unit test; update FTTH guide, this plan and append progress. No application source, SQL, runtime contracts, auth, dependencies, config, timeout/pool, npm test/CI, or old tests edited. Reuse existing worktree; preserve candidate68 and six preexisting documentation/ignore differences. No real DB/env/token reads, commit, push or deploy.

- [x] Preserve current source hashes/preimages and verify applicable instructions: 550 public paths, eight original cross-checkout differences (six documentation/ignore and two candidate68 source/test paths).
- [x] Add tests for fresh six-migration initialization, five-to-six upgrade preserving old data/schema, repeat no-op preserving edited FTTH target, missing/empty/tampered/out-of-order ledger rejection, atomic rollback on injected SQL failure, and FTTH readiness before/after upgrade and after missing column/unique key.
- [x] Execute with the opt-in QA recorder on synthetic fixtures only: initial 11/11 passed. These are verification tests for an already-implemented feature, not a claimed RED cycle. Keep V1 evidence. Review identified that final-state snapshots alone do not prove no DDL attempts; V2 additionally records every validator SQL and asserts SELECT-only outside its error-catching boundary (9 fresh reads, 1 post-upgrade, 3 FTTH-before-upgrade plus KPI, 1 missing-column/key).
- [x] Worktree V2: 16 related FTTH/CD/backup UI/unit files, 442 cases passed; typecheck/lint zero warnings, 48 recorder and 22 policy tests passed. Did not run the known-crashing native integration suite or change old failed gates.
- [x] Independent SPEC then QUALITY approved test hash `3aa1e11de8ef12d0d88285030b0e751c8f03e02492c9ea90925021a70511a58b`. Copied that test only with preimage guards, then primary independently passed 442 cases/types/lint/48 recorder/22 policy. Updated the guide/progress conclusions: database upgrade on the real target still requires owner approval after backup/ledger verification; native Windows, browser/build and real FTTH file layout remain open.

**Final integration protocol:** Only this test and three docs may be copied. The finishing guard must check old paths, baseline checkout differences, both QA reports and exact incoming hashes before generating `.local/performance/cuoc-ftth-upgrade-20261101/final-scope.json`. This checklist is not a substitute for that final manifest; the evidence exists only after the guard succeeds.
