# Restore feedback and single-flight — Implementation Plan, checkpoint65

> **For agentic workers:** Continue approved Tasks11/12 with TDD and separate spec/quality review. Keep local; no commit/push/deploy, real restore or database/env changes.

**Goal:** Không báo restore thành công khi thiếu acknowledgement hợp lệ, không gửi trùng khi confirm/read/POST đang chờ, và phân biệt lỗi local với kết quả server chưa xác định.

**Architecture:** Chỉ sửa LogsPage và thêm UI regressions. Ack phải có HTTPok, success===true và restored object (không array) chứa users/customers là safeinteger>=0. 413 kiểm trước JSON dùng message64, 5xx/network/malformed200/invalidack báo kết quả chưa rõ, giữ file/log context và không tự retry. Structured4xx giữ error string có nội dung hoặc generic cũ. Ref đồng bộ giữ một luồng từ trước awaitconfirm đến finally, busy vẫn chỉ bật sau xác nhận. Chụp file đang restore, không xóa file mới chọn khi ack cũ về; validack mới success/reset/refetch. Lỗi confirm, file-read/parse, request và UI sau validack có thông báo riêng; không phủ nhận knownack vì lỗi giao diện/log-refresh.

**Files:** Modify `src/app/(dashboard)/logs/page.tsx`; create `tests/ui/backup-restore-feedback.test.tsx`, `docs/backup-restore-feedback.md`, this plan; update roadmap and append65 in `tiendokpi.md`. No API/models/SQL/cache/config/dependencies/CSS/picker/download/auth/oldtests changes. Keep64sizeguard, KHOI PHUC options and JSON request contract.

## Checklist
- [x] Snapshot public/source/dirty/HEAD/index/oldBUILD_ID and previous artifacts, read scoped instructions and reuse worktree.
- [x] Add regression cases for invalid acknowledgement,413-before-json,4xx/5xx/network, phase errors, confirmation/single-flight/release, validack and preserved/new selections; RED before source, fake HTTP/auth/session only.
- [x] Minimal page-only handler/typeguard/ref changes, GREEN; preserve GETbackup/log filtering/CRUD/cap64/backend/oldtests.
- [x] Spec→quality review exact two source/test hashes, fresh scoped+22policy/types/lint in worktree and primary; preserve failures rather than retry unchanged candidate to green.
- [x] Default redacted secret scan, whitespace/preimage/backups/inventory guards, four docs/append65; local only and all acceptance limits explicit.

## Verification and non-goals

Focused `npm.cmd test -- tests/ui/backup-restore-feedback.test.tsx` via existing synthetic runner; env discovery guarded. RED26failed/9passed plus1unhandled confirmation rejection in old handler; GREEN35/35 without unhandled errors. Broad inherits64 selection unchanged; UI directory discovers new file. Worktree and primary each fresh62files/1137tests,22policy,nonincremental TypeScript and ESLint src/nextconfig/newtest max-warnings0 PASS. Sequential spec→quality APPROVE exact2hash. No new config probe/build: all config/server files remain byte-identical to64.

Client single-flight is not server idempotency, transactional restore, cancellation, rollback, global locking or protection across tabs/users. Unknown result never means data unchanged; user must verify before retry, UI does not auto retry. Auth/API may still perform existing server workflow; tests use no real DB/restore. Native/auth historical/Node0TB/Next/browser/3role/roundtrip/snapshot/CI-RUM and whole Tasks11/12 remain open.
