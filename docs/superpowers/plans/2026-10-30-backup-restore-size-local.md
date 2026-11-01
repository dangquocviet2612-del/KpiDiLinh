# Backup restore body limit — Implementation Plan, checkpoint64

> **For agentic workers:** Execute approved Task12 validation slice using TDD and separate spec/quality reviews. Keep local; do not commit, push, deploy, migrate or use real database/env/backup files.

**Goal:** Sau xác thực, từ chối file/payload restore quá lớn trước đọc/parse JSON và trước DB nghiệp vụ/setup/transaction, không đổi schema/semantics khôi phục. Không suy rằng lớp xác thực/framework không có I/O riêng.

**Architecture:** Cap4.000.000byte khi `VERCEL === "1"`; limits helper riêng và numeric public key4000000/0 tại build, missing/invalid clientvalue fallback4MB. LogsPage kiểm File.size sau no-file nhưng trước confirm/busy/File.text/JSON/POST, giữ selected file để đối chiếu. API authADMIN401 như trước; server-only reader kiểm Content-Length hợp lệ lớn hơn cap trước đọc, nhưng luôn đếm byte thực tế để không tin header thấp/thiếu/sai. Reader dừng ở chunk vượt cap, không giữ chunk đó, best-effort cancel không await/unhandled rejection, release lock; chỉ parse UTF8/JSON sau khi toàn body trong ngưỡng. Local/non-Vercel dùng nguyên request.json() cũ. Chỉ size error mới thành413, malformed/read lỗi giữ500 cũ. GET backup và toàn validation/transaction/cache/defaults giữ nguyên.

**Files:** Existing `next.config.ts`, `src/app/api/admin/backup/route.ts`, `src/app/(dashboard)/logs/page.tsx`; new `src/lib/backup-restore-limits.ts`, `src/lib/backup-restore-body.ts`, `tests/unit/backup-restore-size.test.ts`, `tests/ui/backup-restore-size.test.tsx`. Four docs: this plan, `docs/backup-restore-size.md`, roadmap and append64 in `tiendokpi.md`.

## Checklist
- [x] Snapshot511publicpaths/370source-config-test,28primarydirty/263WTdirty/1933oldartifacts; scoped instructions/HEAD/index/oldBUILD_ID and reused worktree checked. Earlier usage-limit stopped before app changes; user resumed, snapshot confirmed63 intact.
- [x] 27API+19UI regressions; RED24fail22pass46 before source, expected missing cap/reader path, not setup error. Native/controlled streams, fake auth/business, UI page/confirmation/transport.
- [x] Minimal limits/reader/config/UI/POST changes; GREEN46/46. V1scoped1101/policy/lint passed but3newUIByRole type errors retained; V2 removes only unsupported exact props and passes freshQA. Parent then proved Buffer.slice shares memory: extra regression RED1fail46pass47 before fix, V3 changes one copy line to Uint8Array.from → GREEN47/47 (28API+19UI). Exactscope/source scans versioned; no oldtest/deadline/pool changes, V1/V2 evidence/approvals preserved.
- [x] V3 SPEC→QUALITY APPROVE seven exact hashes. Worktree V3 and primary each fresh61files1102scoped+22policy/types/lint0warning and actual4keyNextloader/staticEnv probes4000000/0 PASS. Preserve V1/V2/copy-regression evidence; no oldtest/pool/deadline changes or retrying an unchanged candidate to green.
- [x] Default redacted source/docs secret scans, whitespace/preimage/backups/inventory are final integration gates for four docs/append64; only confirmed when integrated manifest passes. No publication, real restore or full native/browser/roundtrip acceptance claim.

## Commands and safety boundaries

Focused: `npm.cmd test -- tests/unit/backup-restore-size.test.ts tests/ui/backup-restore-size.test.tsx` in synthetic env with .env discovery guarded. Broad expected61files and1055+newcases (1051 from63 +4existing backup cases); keep TypeScript nonincremental, ESLint src/nextconfig/newtests max-warnings0. Next loader/staticEnv must expose exactly4numeric keys4000000 hosted/0local, prior3keys/proxy unchanged; this is not full Next build/browser proof.

**Không chia nhỏ/sửa backup để lách cap.** File lớn phải qua quy trình local/offline có sao lưu/kiểm thử/rollback riêng, chưa thực hiện ở task này. Không chạy restore thật, tạo/migrate/delete database, đổi quyền/users, kiểm snapshot consistency/checksum/foreign keys thực tế hoặc activation. Dừng đọc ở app không bảo đảm network/proxy chưa buffer; cap không giới hạn CPU parse, độ sâu JSON, số bản ghi, response/download, DB payload hoặc transaction duration. Native/KPI/Node0TB/Next/browser/3role/CI-RUM và toànTask12 vẫn riêng.

References: [Vercel limits](https://vercel.com/docs/functions/limitations), [Streams standard](https://streams.spec.whatwg.org/), previous61–63 policies. Derived public values are not secrets and need matching build/runtime platform flags; no manual env edits.
