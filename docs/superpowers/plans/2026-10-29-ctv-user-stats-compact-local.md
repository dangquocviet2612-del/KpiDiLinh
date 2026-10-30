# CTV user stats compact — local implementation plan

> **For agentic workers:** Continue approved Task11 with executing-plans/TDD and independent review. Local only; no publication.

**Goal:** Giữ đủ4chỉ số/chú thích CTV nhưng giảm chiều cao mobile, đưa ô tìm kiếm lên sớm và đặt tên accessible rõ.

**Architecture:** Chỉ thêm scope class/aria-label trên section thống kê tài khoản và aria-label cho search. CSS dưới max-width640 đổi scope này thành2×2, giảm padding/min-height chứ không giảm font/ẩn hint. Cùng breakpoint, reset flex-basis của searchField trong listToolbar từ380px sangauto khi toolbar theo column, tránh khoảng trống dọc và icon lệch giữa. Không state/toggle/duplicate DOM/effect mới, không đổi phép đếm/request/filter/admin guard hoặc layout KPI config.

**Tech Stack:** React/CSS modules hiện có; RTL/user-event và fake fetch/router; Chrome actual CtvClient SSR với private Next-link/router adapters, actual confirm provider, không Next server/auth/DB/hydration.

## Thiết kế

- Màn Danh sách CTV có region `Thống kê tài khoản CTV`, search name `Tìm tài khoản CTV`, placeholder/value/handler giữ nguyên.
- Chỉ viewport≤640 áp dụng compact2×2. Mọi label/value/hint giữ đầy đủ, font/line-height/palette không giảm; số tabular và overflow-wrap trong scope. Không cần nút thu gọn hoặc viewport JS.
- SearchField đang dùng flex-basis380px cho layout ngang nhưng mobile toolbar chuyển column; đo baseline wrapper/input/icon/list-start rồi reset basis auto, không đổi padding/width/value/handler input.
- Trên641px trở lên và màn `kpi-config`, geometry thống kê/controls giữ nguyên. Mixed Task11 còn các mục khác, không tick toàn bộ.
- Counts là users sau filterADMIN hiện có, không theo search; không thêm tiêu chí active-status hoặc đổi GPS/role semantics.

## Checklist

- [x] Đối chiếu CtvClient/ctvCSS/tests và Git/worktree, snapshot/preimages giữ thay đổi/evidence cũ.
- [x] Test trước app, RED accessible region/search/scope và Chrome mobile height/search-position baseline.
- [x] Đổi2JSX attribute sites +CSS scope tối thiểu, GREEN DOM/browser; giữ cả hint và nghiệp vụ.
- [x] Freeze/review và QA scoped/policy/types/lint riêng WT/primary,32case Chrome SSR trước/sau.
- [x] Lưu guide/roadmap/tiến độ49, secret/whitespace/hash/inventory guards; không branch/commit/push/deploy.

## Files

- Modify `src/app/(dashboard)/ctv/CtvClient.tsx`, `ctv.module.css`.
- Create `tests/fixtures/ctv-user-stats.ts`, `tests/ui/ctv-user-stats.test.tsx`.
- Docs `docs/ctv-user-stats-compact.md`, plan này, roadmap `2026-10-26-web-ux-performance.md`, `tiendokpi.md`.

## Verification

Same44file/739test selection mục48 +test mới,22policy, TypeScript nonincremental, ESLintsrc+owned test/fixture. Runner envDir:false/env-file guard, giữ mọi failed/pass artifact; không suppress/skip/deadline/dependency/config changes.

Browser32case:7width360/390/640/641/768/1024/1440 ×2theme ×2view =28 +4root-font200%desktop. Dùng actual initial SSR state0counts/loading với imported child CSS, không seed internal React state hoặc gọi API; RTL kiểm loaded/search/error/retry/config với fake fetch. Mobile user scope2columns, stats/search giảm≥120px, searchField giảm≥300px, icon vào giữa input; text/hint ranges trong card. Các case noncompact/config so geometry chính xác. Root-font không browserzoom/device thật; không nghiệm thu hydration/dashboard shell/full app/auth/Production speed. Native/libsql/KPI-timeout/oldvisual/Node0TB timing và release gates vẫn mở.

**Kết quả:** RED2fail/8pass→GREEN10/10; WT và primary QA riêng mỗi root45file/749test+22policy, types/lint0error/3warning cũ. Mỗi root ChromeV5after32/32,26noncompact geometry unchanged; mobile390 stats/search tiết kiệm243.45px, searchField380→44px, khối loading dưới toolbar lên579.45px. BaselineV5 dùng exactpreimages và theme/font trước initiallayout; diagnostic chứng minh V4rootfont comparison đo giữa transition, không app regression. Failed harness versions và scope-order correction giữ nguyên, không nới threshold/suppress hoặc sửa candidate sau freeze. Review độc lập APPROVE4hash; exact-scope và backup/scan/inventory guards trước/sau integration. Không suy primary/fullnative/build/Production từ focused hoặc review, không đóng toànTask11. Chi tiết guide và tiến độ49.
