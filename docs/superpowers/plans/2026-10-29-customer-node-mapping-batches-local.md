# Customer node mapping read batches — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development/TDD, spec then quality review. Approved Task9 continuation, LOCAL ONLY. Reuse existing WT; preserve81 prior dirty paths. No commit/push/deploy, real env/DB, migration, native workaround or dependency changes.

**Goal:** Reduce round-trips for bulk account-to-node lookup used by customer map/list/import without altering returned mapping values, auth, cache or frontend.

**Architecture:** Existing `getMappedNodeNamesByAccounts` deduplicates normalized keys and SELECTs them sequentially in chunks of300. Change ONLY this read helper's `chunkSize` to900; same parameterized SQL/normalization/readiness/result handling. Other300/350/180-sized read/write batches stay byte-identical.900 anonymous parameters stays below SQLite's historical default999; no new JSON extension, parallelism, cache or join. Custom lower runtime/remote limits remain unverified; this is local validation, not rollout approval. Primary source for defaults: https://www.sqlite.org/limits.html#max_variable_number.

**Tech Stack:** Existing Next/Prisma/libSQL/TypeScript/Vitest, Chrome; SQLite synthetic fixtures only.

## Alternatives and limits

- Node0TB prefix-index is deferred: preserving insertion-order exact/base/prefix semantics introduces a new structure; investigate CPU/workload before adding complexity. No prefix code changed in this slice.
- A single JSON/join query would remove more round-trips but changes SQL/runtime compatibility and potentially iteration order; not chosen here.
- Bounded parallel queries need pool/concurrency/remote budget evidence; not chosen.900-sized sequential batches is the smallest compatibility-preserving change under the existing SQL parameter floor.
- Returned Map key/value equality is required. SQL has no ORDER BY today, so Map iteration order is not promised; verify all consumers use keyed lookups and no output ordering depends on it. Customer list ordering, mapping override/fallback, response metadata and full payloads MUST remain identical.
- No claim of fewer total API SQL statements, cloud latency, DB snapshot consistency, full-native reliability or UI/pixel acceptance from mocked round-trip counts.

## Files and scope

1. Modify `src/lib/customer-node-mapping.ts`: replace ONLY the first `const chunkSize = 300` inside getMappedNodeNamesByAccounts with900. A mechanical reversal must restore all baseline bytes. No helper extraction/constant/export/comment/refactor needed.
2. Create `tests/unit/customer-node-mapping-batches.test.ts`: real helper/import normalization/route/cache, boundary mocks for auth/Prisma/schema/scope/nearest. Do not modify old tests, map code/DTOs/types or other consumers.
3. Parent docs: new `docs/customer-node-mapping-batches.md`, this plan at `docs/superpowers/plans/2026-10-29-customer-node-mapping-batches-local.md`, append roadmap Task9 checkpoint and progress section34. Exactly6 integration paths.

## Steps

- [x] Snapshot417files/329sources matched built YrrG4l8NYyCyALqzNR_0d;81changes preserved. Plan review Kant APPROVE local-only, no extra AGENTS. New synthetic fixture1812customers/10coordinates/1544mappings, standalone SQLite900binding probe passed; Prisma900 gate waits for candidate build.
- [x] Semantic RED12fail/36pass on original helper query counts, not missing imports. Initial sandbox EPERM runner error retained separately, not counted as RED.
- [x] One-byte literal change only;48/48new tests GREEN (20helper+28route/cache), worker33file/518scoped/owned lint/fulltypes pass.69oldtests/22oldUI untouched; freeze2hashes and byte reversal passed. Parent QA and independent reviews separate; actual lint debt counted by full-source parent run, not worker's mistaken six-warning handoff.
- [x] Freeze2source/test hashes/mechanical reversal; independent spec Archimedes then quality Hume APPROVE source/API local-functional only, no source changes. No native/visual/release waiver.
- [x] Parent WT33file/518scoped+22policy/full types/lint/build pass; login static, frozen2hashes/fakeDBunchanged, buildLv9R4uBtzz459gsJFzkZT.0lint errors/2oldwarnings, not worker's mistaken six. No full-native rerun/skip/retry/pool/package changes; native801/815/Node0TB3PNG+2geometry remain OPEN.
- [x] Actual fakeDB21scopedAPI cases across3roles first+warm body/status/bytes/count hashes identical, including details on/off/coordinate filter/take900/901/1800/20000 and customer list. Large1812/1812/906customer scopes exercise900binding realPrisma reads; anon401 preserved. Browser12cases/48summaries/nearest/polyline/GPS/error-retry equal,0business writes/JS/unexpectednetworkerrors/fakeDBunchanged. Not fullDOM/pixel proof.
- [x] Benchmark actual frozen helper:13boundarysizes,1k4→2/10k34→12/50k167→56, mapping values equal/max900params/input unchanged/no repeated keys. DB boundary mocked, not latency/totalAPI SQL. Candidate realPrismaAPI900binding validation local passed, not online/custom-runtime or native-reliability acceptance.
- [x] Backup/preimage/hash/whitespace/default secret scan không finding, integrated6paths local/preserve81priorchanges. Primary33file/518scoped+22policy/full types/lint0error/2oldwarnings,330source byte-match built WT/frozen hashes/fakeDBunchanged. Progress34 factual summary/results, no application edits afterQA/commit/push/deploy. Task9/native/strictvisual/release stillOPEN.

## Test requirements

- Empty/null/blank-only input: emptyMap, no readiness/SELECT. Mixed values/case/whitespace/0/unicode/quoted SQL-like text: preserve actual normalization/dedupe/input order and placeholders; no mutation/SQL interpolation.
- Boundaries1/299/300/301/899/900/901/1800/1801/1000/10000; disjoint params, no dropped/repeated accounts, each SQL placeholder count equals params, sequential calls, one readiness per helper call and no writes/transactions/nearest lookup.
- Mapped/missing/empty node values and errors: preserve map contents, readiness rejection before SQL, later batch rejection propagates/no partial result or subsequent batch.
- Actual map-data route/cache: includeDetails true applies mapping precedence/fallback; false skips helper; scoped keys only, three roles/unauthorized, warm cache skips backend, generation fence unchanged; output DTO/order/meta identical. Existing auth/schema/read-only/cache-generation tests unchanged.
- Actual consumers `customers`, `import`, map-data use keyed .get lookups and remain unchanged; search-map is NOT a consumer and remains an unchanged regression surface. No native integration imports in new tests. Null/undefined cases mean array elements, not new top-level null support.

## Safety/checkpoints

Primary `D:/code/webkpimoi` HEAD9d0365e, reused WT `.worktrees/ux-performance-batch1` old detached1ecfa38; do not use HEAD diff for task scope. Baseline is current dirty bytes. Stage/evidence date29th, local fixture copied from prior known synthetic batch6/customer-map fixture after hash validation. Explicit process env/guard blocks real env discovery; empty Turso/dummy auth. Worker writes only2 files via staging apply_patch then approved copy to WT. Parent owns fixture/build/browser/benchmark/docs/integration.
