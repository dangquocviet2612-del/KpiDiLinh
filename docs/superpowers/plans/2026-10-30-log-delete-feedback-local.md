# Delete-log feedback and single-flight — Implementation Plan

> Continue approved Task11 operational feedback with systematic debugging/TDD and independent spec→quality review. Reuse existing WT, preserve all prior work, snapshot and candidate68 divergence. Local only; no real deletion/database/network, auth/API/SQL/CSS/config/dependency/defaulttest/CI edits or commit/push/deploy.

**Goal:** One delete-confirm-request flow per mounted LogsPage, and report success only for the existing server acknowledgement `{success:true,count:nonnegative safe integer}`.

**Evidence/hypothesis:** `handleDeleteLogs` currently has no synchronous guard; confirmation is awaited outside try, then any HTTPok becomes success using `count ?? 0`. Concurrent clicks can open duplicate confirmations/DELETEs; malformed200 can be announced as zero deleted. Network/5xx may happen after commit, so do not announce definite failure or auto-retry.

**Minimal design:** Add a per-page ref lock after existing missing-selection/date check and before first await. Wrap confirmation in the existing try/finally, track confirm/request/acknowledged phases. Preserve confirmation text/scope and captured body/verb/headers. Validate ack and structured4xx error strings; unknown/malformed/network/5xx warn to check records before manual retry, without success/reset/refetch. Only valid ack follows unchanged success/detail-clear/page-reset/refresh path. Confirmation failure and UI-after-known-ack have distinct truthful feedback. Always release lock/busy on cancel/error/finish. No new retry/queue/timeout or cross-tab/server idempotency claim.

**Files:** Modify `src/app/(dashboard)/logs/page.tsx`; create `tests/ui/log-delete-feedback.test.tsx`, `docs/log-delete-feedback.md`, this plan; update roadmap and append72 to `tiendokpi.md` (six paths).

## Checklist
- [x] Snapshot both roots, instructions, previous artifacts/HEAD/index/oldBUILD_ID and two68source deltas.
- [x] Add actual-component RTL regressions with fake session/fetch/dialog: duplicate/cancel/reject, missing intent, malformed/count/HTTP/network responses, retained selection/detail, valid zero/ack/body/refresh and manual retry. RED28fail11pass39 +1unhandled confirmation rejection preserved with recorder70 exit1.
- [x] Implement only ref/helper/handler; GREEN39/39,0unhandled; no CSS/API/data changes. Preserve raw RED, no retry-to-green unchanged candidate. Resumed31Oct after automatic-approval/reviewer usage-limit interruption; original scoped/static command had not executed, normal approval required again.
- [x] Independent exact-two-hash spec→quality APPROVE after resumed review; each root fresh7file324scoped cases,48tool+22policy/types/lint0warning. No65file app/native/browser/DB runs; gate68 stillfalse.
- [x] Redacted default secret scan, whitespace, exact inverse-scope, backups/inventory/source guards; integrate six paths locally and evidence-backed append72. Final manifests preserve2383oldartifacts/539oldpaths except owned changes and two68deltas. WholeTask11/release remain unaccepted; no commit/push/deploy.

## Limits

Same mounted page only, not exactly-once deletion/cross-tab locking or server idempotency. Existing list fetch race/filter/pagination refresh behavior remains separate; do not broaden this change into request-ownership redesign. A valid ack proves only the response shape, not database persistence or integrity; unknown result still needs operator check. UI tests are mocked jsdom, not real browser/mobile/three-role or native Windows/libSQL acceptance.
