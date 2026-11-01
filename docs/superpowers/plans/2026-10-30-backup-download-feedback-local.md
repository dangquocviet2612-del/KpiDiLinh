# Backup download feedback — Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development; test first and request separate spec→quality review. Continue the approved Task12 operational feedback scope. Local only; no commit/push/deploy or real backup/restore/database access.

**Goal:** Make the existing backup download button single-flight, clean up temporary browser resources on failure, and avoid claiming the file was saved when only a download was requested.

**Architecture:** Keep the existing GET URL, blob transport, filename parsing/fallback and UI layout. A synchronous ref gates the entire fetch/blob/anchor lifecycle before the first await. Track the created object URL and anchor; independently attempt removal/revocation in finally so one cleanup error cannot prevent the other or leave the button locked. Cleanup failures are logged, not mistaken for failure of an already-submitted download. Only a completed anchor.click invokes the success notification, whose text explicitly asks the admin to check the saved file. Validate nonempty string errors for HTTP failures; other download errors keep the existing generic message. Do not parse or certify the downloaded JSON or add a new download cap/storage/job system.

**Tech stack:** Existing React/Next page, Vitest/RTL with mocked session/HTTP/DOM download; unchanged packages, config and server.

**Files:** Modify only `src/app/(dashboard)/logs/page.tsx` download handler and one new ref. Create `tests/ui/backup-download-feedback.test.tsx`, `docs/backup-download-feedback.md`, this plan. Update roadmap and append66 to `tiendokpi.md` without rewriting65 or previous history.

## Checklist
- [x] Snapshot/inventory/HEAD/index/oldBUILD_ID and prior evidence; check scoped instructions, reuse existing worktree.
- [x] Add actual-page regression tests for duplicate clicks, deferred fetch/blob, failure cleanup, independent cleanup failures/release, accurate feedback, structured errors and preserved log/restore state; observe semantic RED before app edits.
- [x] Minimal handler/ref fix and focused GREEN; no CSS/picker/filter/download filename/API/auth/restore65 changes.
- [x] Independent spec→quality exact2hash review and fresh scoped+22policy/types/lint in worktree and primary, preserving any failure artifacts.
- [x] Default redacted secret/whitespace/exact-scope/backups/inventory guards, four docs and append66; report all remaining acceptance limits.

## Verification

Use the existing synthetic runner and environment-discovery guard. Focused newtest RED→GREEN first; broad selection65 unchanged, UI folder discovers the new file. Worktree V2 and primary each fresh63files/1167tests,22policy,nonincremental TypeScript and lint src/nextconfig/newtest max-warnings0 PASS. No dependency installation, package audit/network, Next build, native integration suite or actual browser download. No retrying unchanged failed candidates until green.

Focused evidence: RED30failed/30, with duplicate GET and missed cleanup assertions (no import/setup failure); GREEN30/30. V1 broad1167/policy/lint passed but TypeScript TS2502/7023/7031 failed from self-referential test types; preserved candidate and raw logs. V2 explicit AnchorFixture/MockInstance/return annotation breaks type cycle; type-only proof confirms runtime assertions/cases unchanged, fresh GREEN30/30 and all gates above PASS. Sequential SPEC V2→QUALITY V2 APPROVE exact2hash; V1 spec not reused for V2. Scope guards confirm the entire page outside the download handler and new ref, server/config/oldtests and restore65 remain unchanged.

## Non-goals and limitations

This is per-mounted-page client locking, not cross-tab/user locking, server snapshot consistency or idempotency. A successful click only requests a browser download; permission, cancellation, disk space, completed save and JSON/data integrity remain unverified. Existing GET still buffers the backup; large backup/storage/jobs, database roundtrip/rollback, native Windows/auth historical/Node0TB visual-timing/Next/browser/three roles/CI-RUM and whole Task12 acceptance remain open. Preserve local60–65 and published59 evidence; never read .env or a real DB/token.
