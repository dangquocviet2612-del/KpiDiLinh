# Summary identity layout — local implementation plan

> **For agentic workers:** Continue approved Task11 with test-driven-development/executing-plans; independent static review, no publication.

**Goal:** Mã/tên dài ở Tổng hợp KPI nhân viên/quản lý không lấn cột KH hoặc ra ngoài card; giữ toàn bộ text và số liệu.

**Architecture:** Thêm một scope class trên2panel, CSS wrap identity desktop/mobile và alignment/tabular-nums cho cột số. Không sửa global table/nameCell hoặc panel khác; không đổi công thức, query, filters, pagination, quyền hay palette.

**Tech Stack:** React/CSS modules hiện có, typed synthetic props, Vitest/RTL; Chrome headless với SSR thật của components và CSS module compile bởi Vite cài sẵn, không Next server/API/DB.

## Phạm vi đã duyệt trong Task11

- Hai màn tổng hợp: giữ mã/tên/chức danh đầy đủ trong DOM; wrap kể cả token không có khoảng trắng. Giữ sticky column, widths/min-width/scroll container và mobile cards; không cắt/mutate strings.
- Chỉ cột số trong hai bảng chi tiết dùng `styles.table` right-aligned/tabular-nums; giữ formatter, values/progress colors/percent/rounding và thứ tự rows. Bảng `__all__` dùng class riêng không nhận alignment rule; metadata dùng summaryManagerMeta dưới root vẫn wrap.
- Scope root riêng, không sửa shared `.nameCell`, `.table td` hoặc CustomerTable/CTV/3menu đã ẩn. Rà customer không đồng nghĩa chứng minh mọi customer layout đúng hoặc phải sửa trong cùng đợt.
- Browser geometry dựa trên actual SSR markup và CSS modules, fake props; không đăng nhập/GET/POST API, không real DB/env, không dựa `.next` build cũ. SSR isolated không kiểm hydration/routing/dashboard shell hoặc nghiệp vụ production.

## Checklist

- [x] Đối chiếu Task11/source/CSS và Git/worktree, tạo snapshot/preimages giữ các thay đổi/evidence cũ.
- [x] Tạo fixture/test trước app; RED DOM scope và Chrome text-range vượt identity bounds, phân biệt harness error với layout failure.
- [x] CSS scope +2root classes tối thiểu, GREEN DOM/browser; không chạm logic/data/backend.
- [x] Freeze/review và QA scoped tests/policy/types/lint riêng WT/primary, browser matrix isolated trước/sau.
- [x] Lưu guide/roadmap/tiến độ47, default secret/whitespace scan và snapshot/hash guards; không branch/commit/push/deploy.

## Files

- Modify `src/app/(dashboard)/prepaid/SummaryKpiPanelClean.tsx`, `ManagerSummaryKpiPanelClean.tsx`, `kpi.module.css`.
- Create `tests/fixtures/summary-identity-layout.ts`, `tests/ui/report-layout.test.tsx`.
- Docs `docs/summary-identity-layout.md`, plan này, roadmap `2026-10-26-web-ux-performance.md`, `tiendokpi.md`.

## Verification

Synthetic runner envDir:false/env-file guard, focused RED/GREEN; same42file/714test selection mục46 +test mới,22policy, TypeScript nonincremental và ESLintsrc+owned TS tests. Browser matrix360/390/768/1024/1440 × light/dark ×2panel; bổ sung root-font200% ở desktop. Geometry chỉ xác nhận identity/text và cột số trong fixture, ghi riêng page-overflow để không che lỗi ngoài scope.

Không tăng timeout/skip/suppress/dependency changes. Không Next build/full-native/auth/E2E, không tuyên bố web nhanh hơn, closure native/libsql/KPI-timeout/old visual/Node0TB timing hoặc toànTask11.

Kết quả: RTL RED2fail/4pass→GREEN6; loader setup failures0case giữ riêng, V5Chrome before24identityfail→after24pass ởWT/primary. Hai root đều43file/720test+22policy/typesPASS, lint0error/3warning cũ; review exact5hash APPROVE, exact-scope chứng minh chỉ2root +CSS block. Counts là cùng test/matrix chạy lại ở2root, không cộng hoặc gọi full app/native/Production acceptance. Guide ghi rõ `__all__` không nhận numeric alignment rule vì dùng table class riêng.
