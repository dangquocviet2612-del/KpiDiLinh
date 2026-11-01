# Node upload acknowledgement feedback — Implementation Plan

> Continue approved Task12 feedback/validation after67 using TDD and independent spec→quality review. Local only: no real import/database/auth, commit/push/deploy, dependency/config or server changes.

**Goal:** Stop reporting successful Node imports from incomplete/invalid HTTP200 bodies; distinguish preparation failures from unknown request outcomes without weakening67single-flight or changing valid reports.

**Architecture:** Local type guards in NodeMapComponent validate minimum UI contracts: nonempty message, nonnegative safeinteger totalRows; positions validates optional created/updated counts when present, efficiency requires updated/notMatched counts and string arrays errors/notMatchedSamples, mapping requires imported/inserted/updated/syncedCustomers and errors strings. Missing mode/success remain compatible with existing legacy consumers/fixtures; when present, mode must match selected import and success must be true. This is minimum acknowledgement, not full DB consistency or checksum validation. No inferred count relationships.

Handle413 before JSON with existing62size message,5xx before JSON as unknown; network or malformed/invalid200 also unknown: data may already have changed, verify before retry. Other non-ok statuses retain nonempty string error or per-handler fallback, never use raw HTML text. Parse JSON independent of MIME header. Only validated HTTPok acknowledgement may display success/report or refresh. Track prepare/request/acknowledged phase: keep old preparation error prefixes, unknown after sending, explicit UI-update warning after knownack. Keep reports/formatting/truncation, awaited/void refresh and67finally/input/ref mechanics unchanged; do not clear previous report/map context on invalidack. Never auto retry.

**Files:** Modify only `src/app/(dashboard)/node-map/NodeMapComponent.tsx` local validators/messages and three response/catch blocks. Create `tests/ui/node-upload-feedback.test.tsx`, `docs/node-upload-feedback.md`, this plan; update roadmap and append68 in `tiendokpi.md` preserving history.

## Checklist
- [x] Snapshot/inventory/HEAD/index/oldBUILD_ID and prior evidence, check scoped instructions and reuse worktree.
- [x] Write actual-component regressions for invalid/partial/mismatched acknowledgement, counts/arrays,413/5xx/network/unreadableJSON/4xx, valid zero/legacy reports and knownack UI/refresh failures; observe semantic RED before app edits.
- [x] Minimal validators/phase/response changes; focused GREEN, exact67lifecycle and valid report/refresh/source scope preserved.
- [ ] Independent spec→quality review exact2hash; fresh scoped+22policy/types/lint in worktree and primary, preserve every failed artifact.
- [x] Default redacted secret/whitespace/preimage/backups/hash-inventory guards; document pending68 without integrating candidate source or relaxing the failed gate.

## Verification and limits

### Current disposition: pending, not integrated

RED69fail14pass83→GREEN83/83. Worktree scoped65files:64pass1fail;1275pass1fail/1276. Historical GETusers401 test in schema-auth-order.test.ts:177 timed out5000ms. Policy22/types/lint passed; source/config/oldtests hashes unchanged outside candidate. Root cause and causality not proven. No rerun, no authfix/skip/deadline/pool change. Source/test stays in worktree, primary remains67; no primary QA or source-integration approval. Keep original strict integration helper and failed artifacts; a separate documentation-only pending manifest records actual state. Code review does not equal scoped/release acceptance. Step4 remains incomplete until meaningful evidence resolves the gate.

Sequential independent SPEC APPROVE→QUALITY CODE ONLY APPROVE exact2hash, not source integration approval. `record-pending.cjs` verifies the failed gate, candidate in worktree only, unchanged primary source/test, all prior artifacts, HEAD/index/build and four documentation hashes. It copies documentation only; original `integrate.cjs` allPassed requirement remains unchanged. Pending manifest keeps currentBatchScopedAcceptancePassed:false and releaseReady:false.

Use existing synthetic runner/env discovery guard. Fake HTTP/session/Leaflet only; do not call actual upload or DB. Broad selection67 unchanged, UI directory discovers new file (expected65files/1193+newcases). Run22policy, nonincremental TypeScript and ESLint src/nextconfig/newtest max-warnings0. Do not change oldtests/deadlines/pool/config or retry unchanged failures to green. No Next build/native/browser/provider/actual import.

Minimum valid acknowledgement proves only response shape, not data correctness/commit completeness/rollback; legacy missing mode cannot certify import type. Unknown result never means unchanged data. Reset/release remains67 and manual re-selection is required; no server idempotency, queue, cancel, cross-tab/user locking or new storage/job platform. Whole Task12/native/Node0TB timing-visual/Next/browser/3roles/CI-RUM/release remain open.
