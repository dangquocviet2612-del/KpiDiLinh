# Customer missing contact fields — implementation plan

> **For agentic workers:** Continue approved Task11 locally with TDD, frozen-file independent review and guarded integration. No branch/commit/push/deploy, real DB/env/account, dependency/config changes or native full-suite rerun.

**Goal:** Rút gọn card khách hàng mobile thiếu SĐT/account nhưng vẫn báo rõ dữ liệu nào chưa có.

**Architecture:** Chỉ CustomerMobileCard: chỉ render phone/account strips khi giá trị truthy như điều kiện link/copy cũ; nếu thiếu một/hai trường, một flex-wrap row gồm các hint `Chưa có SĐT` / `Chưa có account` thay khối trống. CSS module riêng, không giảm chữ của dữ liệu hiện có hoặc hit-area44px. Desktop/helpers/parent/data/API/permissions giữ nguyên.

**Tech Stack:** React/CSS modules hiện có, RTL/user-event, installed Chrome actual-component SSR/CSS với props giả; không Next server/build/auth/API/DB/hydration.

## Thiết kế trong phạm vi plan đã duyệt

- Không giữ full bordered strips cho dữ liệu rỗng vì vẫn tốn chiều cao; không ẩn hoàn toàn vì sẽ mất thông tin cần bổ sung. Chọn một dòng hint rõ nghĩa, có wrap, không thêm toggle hay màn chỉnh sửa mới.
- Giữ truthiness cũ cho null/empty-string; không trim/mutate account/phone, không đổi quy tắc whitespace-only hoặc dùng placeholder `---` làm missing-value sentinel. Giá trị `---` thật vẫn dữ liệu/copy bình thường.
- Dữ liệu populated giữ nguyên subtrees/strings/title/copy feedback/URLs/callbacks; ADMIN-only selection/delete, node disabled/flags giữ nguyên. Không sửa missing CTV/package/date/billing hoặc validation backend trong batch này.
- Hints là nội dung tĩnh đọc được, không alert/live region tương tác. Không thêm wrapper padding/border/background như strips, font dùng cỡ secondary text hiện có, đầy đủ nội dung.
- Cùng card markup có trong DOM ở mọi width nhưng mobile container chỉ hiện≤768px theo CSS cũ. Desktop table/layout phải giữ nguyên so preimage.

## Files

- Modify `src/components/CustomerTableRefined.tsx`, `src/app/(dashboard)/customers/customers.module.css`.
- Create `tests/fixtures/customer-empty-fields.ts`, `tests/ui/customer-empty-fields.test.tsx`.
- Create `docs/customer-empty-fields.md`, plan này; update roadmap `2026-10-26-web-ux-performance.md`, append50 `tiendokpi.md`.

## Checklist

- [x] Rà source/tests/plan/AGENTS, reuse worktree, snapshot/preimage không đè thay đổi cũ.
- [x] Viết test missing/populated/verbatim/rerender/roles/desktop trước app; chạy RED đúng missing hints/strips.
- [x] Patch tối thiểu mobile JSX/CSS; GREEN, giữ callbacks/subtrees populated và desktop nguyên vẹn.
- [x] Chrome before/after actual SSR loaded props giả: missing both/phone/account/complete ×360/390/768/769/1024/1440 ×2theme =48case; root-font200%mobile390/desktop1440 ×2theme ×4case thêm16 =64case. Kiểm savings≥20px mỗi missingfield, full text fits, full-data geometry exact, desktop table geometry/canonical DOM exact; không gọi SSR là E2E/auth/device hay speed acceptance.
- [x] Freeze/review exact4files; thực hiện QA scoped/policy/types/lint độc lập WT rồi primary, không dùng reviewer/focused PASS thay primary.
- [ ] Primary scoped acceptance:762pass/1timeout, case GET users auth trong schema-auth-order; giữ gate pending, cần trace nguyên nhân trước sửa, không tăng deadline/retry bộ rộng để ép xanh.
- [x] Docs/scan/whitespace/backup/hash/inventory guards, giữ mọi failed/pass artifacts và gate native/Node0TB cũ; no publication.

## Verification commands

Private stage runner `run.cjs worktree red`, rồi `green`, dùng installed Vitest envDir:false và guard chặn env-file discovery, synthetic auth/database configuration. `qa.cjs worktree` / `primary` chạy same45file/749test selection mục49 cộng test mới;22policy, nonincremental TypeScript, ESLintsrc+newfixture/test. `browser-run.cjs worktree before` / `after`, `primary after` dùng saved baseline, không mutation/Next build/DB. Saved preimage baseline và font/theme trước initiallayout, không nới tolerance/sleep để ép xanh.

Toàn Task11/missing CTV-package/URLfilters/skeleton/CLS/mobiledevice và native/libsql/KPI-timeout/old Node0TB visual/timing/Task10/release gates vẫn mở. Kiểm riêng giữa before/after cùngfixture, không đổi palette/toolbar toàn app.

**Kết quả chốt30/10/2026:** RED9fail/5pass→GREEN14/14; WT QA46file/763scoped test+22policy, types đạt/lint0error3warning cũ. **Primary762pass/1fail timeout5000ms** ở GETusers auth; policy22/types/lint đạt, gate scoped vẫn pending. Auth+UI diagnostic75/75 không thay kết quả bộ rộng, nguyên nhân chưa chứng minh; không sửa auth/test/config/pool/deadline hoặc rerun unchanged bộ rộng để lấy xanh. Mỗi root ChromeV2after64/64; desktop table canonicalDOM/geometry64case và fullcard16case unchanged (bao gồm hiddenzero bounds),24missingmobilecase cải thiện. Mobile390 thiếu cảhai giảm90.78px. V1rawDOMcomparison fail chỉ generated CSSmodule tokens trong khigeometry equal; giữ harness/report V1, V2 map exact exported tokens giữ mọi thứ còn lại, source/test hashes theo phase không đổi. Review APPROVE4hash và guarded source/docs integration giữ code local; docs-only integration/scope final-check không phải acceptance, primaryScopedAcceptancePassed/releaseReady đều false. Không nới threshold/appchange saufreeze, không publish/đóng toànTask11.
