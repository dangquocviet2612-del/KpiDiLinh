# Node upload lifecycle — Implementation Plan

> Use superpowers:test-driven-development and independent spec→quality review. Continue the approved Task12 failure/retry/cleanup work. Local only; no commit/push/deploy or real import/database/auth.

**Goal:** Enforce the existing shared busy intent across KML/KMZ, efficiency Excel and customer-node mapping imports; prevent duplicate POSTs and stuck busy state when multipart preparation throws.

**Architecture:** Add one synchronous ref next to the three existing busy states. Each change handler captures its HTMLInputElement and File before await, retains the no-file and size62 preflight, then acquires the shared ref before state updates/FormData creation. Duplicate selection while any import is in flight is ignored and its input value cleared so an explicit later selection works. Put state/FormData creation inside try; finally unlocks the ref, clears that handler's busy state and captured input. Hold the lock through all work currently awaited, including map refresh. Preserve reports, error text, JSON/form contract, SQL/API/cache, role/menu/CSS and all existing success/refresh behavior. No queue, auto retry, new acknowledgement validation or backend idempotency.

**Files:** Modify `src/app/(dashboard)/node-map/NodeMapComponent.tsx` only at one ref and three import handler lifecycle blocks; create `tests/ui/node-upload-lifecycle.test.tsx`, `docs/node-upload-lifecycle.md`, this plan; update roadmap and append67 to `tiendokpi.md`.

## Checklist
- [x] Snapshot public/source/dirty/HEAD/index/oldBUILD_ID and prior evidence, check instructions and reuse existing worktree.
- [x] Add actual-component regressions for same/cross-handler duplicates, deferred response/refresh, FormData constructor/append failure, captured input cleanup, release/manual retry and unchanged size/no-file/transport/report behavior; observe RED before app changes.
- [x] Minimal ref/captured-input/try/finally fix, focused GREEN; preserve response branches and every unrelated line.
- [x] Independent spec→quality review exact2hash, fresh scoped+22policy/types/lint in worktree and primary; preserve every failed candidate/log.
- [x] Exact-scope/default secret/whitespace/preimage/backups/inventory guards, four docs and append67, local only with acceptance limits explicit.

## Verification

Use existing synthetic runner and env-discovery guard. New test fake HTTP/session/Leaflet/FormData only, no real file/network/DB. Broad inherits66 unchanged; UI directory discovers new file. Worktree V2 and primary each fresh64files/1193tests,22policy,nonincremental TypeScript and ESLint src/nextconfig/newtest max-warnings0 PASS. No full native suite, Next build, browser/provider, dependency/config/pool/deadline change or retrying an unchanged failed candidate until green.

RED17fail9pass26 plus6unhandled FormData exceptions from old handlers → GREEN26/26. V1 scoped/policy/lint passed but TS2769 at polymorphic-this spy failed; preserved candidate/raw logs. V2 only widens the instance type to FormData at that spy, type-only proof confirms unchanged runtime assertions/fixtures/cases; fresh GREEN26/26 and both root gates above PASS. Sequential SPEC V2→QUALITY V2 APPROVE exact2hash, not reused V1 approval. Exact-scope separately checks response→catch and cap blocks unchanged, then reverses lifecycle blocks/ref and compares whole component.

## Limits

Ref is per-mounted-page, not cross-tab/user/server locking, transaction/rollback or exactly-once execution. Ignored selections are not queued; select again after completion. Existing HTTP acknowledgement/error/report logic is deliberately unchanged, including its known unknown-result/response validation limitations. Native Windows requires separate binding evidence; historical Node0TB geometry contains hashes, not element rectangles, and cannot establish a root cause from a mismatch alone. No waiver or closure of old visual/timing/native/release gates. Whole Task12, real imports/3roles/browser/roundtrip/storage/jobs/CI-RUM remain open.
