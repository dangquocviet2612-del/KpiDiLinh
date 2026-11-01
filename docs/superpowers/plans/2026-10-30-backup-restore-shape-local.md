# Backup restore collection-shape safety — Implementation Plan

> Continue the approved Task12 validation work using systematic debugging/TDD and independent spec→quality review. Local only; reuse the existing worktree, preserve all prior work and candidate68 divergence. No commit/push/deploy, production/real database restore, new infrastructure, auth/default test/CI/dependency/config edits.

**Goal:** Reject malformed backup collections before preparation, schema access or destructive transaction, rather than interpreting a provided non-array as an empty table.

**Root-cause hypothesis:** POST currently uses `Array.isArray(value) ? value : []` while optional-table deletion depends on key presence. Thus a present invalid collection can reach DELETE with zero replacement rows. Null/non-object rows can also throw instead of returning a controlled validation error. Tests must demonstrate attempted mocked writes, not claim an actual database was lost.

**Minimal design:** Add one pure type guard in the existing backup route. Require `data` to be a non-null non-array object; every present known collection must be an array whose rows are non-null non-array objects. Maintain a typed exhaustive known-key record against BackupPayload.data. Reject invalid shape using the existing generic HTTP400 message immediately after bounded body parsing and after ADMIN authorization. Keep unknown keys, absent keys, explicit empty arrays, legacy payloads, per-row business validation, GET, SQL/defaults/transaction/cache/UI and size64/feedback65–66 unchanged. Do not infer missing keys should clear or preserve a different set of tables.

**Files:** Modify `src/app/api/admin/backup/route.ts`; create `tests/unit/backup-restore-shape.test.ts`, `docs/backup-restore-shape.md`, this plan; update the roadmap and append71 to `tiendokpi.md` (six paths).

## Checklist
- [x] Snapshot both roots, scoped instructions, old artifacts/HEAD/index/BUILD_ID and source68 worktree-only deltas.
- [x] Write mock-only API regressions for root/data/collection/row shapes across all23keys, authorization before body, no business access on invalid shape, and legacy/empty/unknown/valid-row compatibility. RED147fail22pass169, recorder70 kept failure/report/exit1, no unhandled error.
- [x] Implement minimal guard; GREEN169, preserve raw RED/report/exit. Correct ambiguous array parameters in tests via boxed arguments (V1 preserved, app source unchanged), V2GREEN169. No rerun of unchanged65file/1276case app candidate.
- [x] Independent spec→quality APPROVE exact-two-hash review; fresh6file285backup API/UI cases,48tool+22policy, types/lint0warning in WT and primary after source integration. Keep native/auth/full-browser/68 gates pending.
- [x] Default redacted secret/whitespace/exact-scope/preimage/backups/hash-inventory checks; integrate six paths locally and append evidence-backed71. Original LF-only private proof failed on CRLF; fix helper only, verify byte-exact inverse on CRLF/LF, no app/test/threshold change. No publish; final manifests retain gate68false and two worktree-only deltas.

## Verification

Use the standalone recorder with reviewed mocked unit/UI selections and unique immutable output labels. All external/schema/prisma/auth/cache/defaults dependencies of the new tests are mocked before route import; no real database driver or network. Primary and worktree gates cover only relevant backup suites, not whole-app/release acceptance. On failure retain artifacts and investigate changed code; never skip assertions or increase timeout/retry/pool limits to obtain green. Empty arrays remain destructive by existing restore semantics; this guard does not prove backup completeness, checksum/FK validity, rollback, snapshot consistency or server idempotency.
