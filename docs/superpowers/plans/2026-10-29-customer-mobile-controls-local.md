# Customer mobile controls — local implementation plan

> **For agentic workers:** Continue approved Task11 using executing-plans/TDD and independent review; local only, no publication.

**Goal:** Card khách hàng mobile có vùng bấm44px, checkbox label mở rộng và nút không vô tình submit form; giữ quyền/callback/data và desktop compact.

**Architecture:** Chỉ đổi phần CustomerMobileCard trong component và CSS scoped mobileCard. Native label bao quanh checkbox16px tạo hit-area44px; icon controls min44px, focus ring. Nút typebutton/aria-label Việt theo khách hàng, không đổi handlers/selection/routing/clipboard/API.

**Tech Stack:** React/Lucide/CSS modules hiện có; typed synthetic fixture, RTL/user-event, Chrome SSR geometry/native label activation; không dependencies mới.

## Thiết kế theo Task11

- ADMIN giữ checkbox/xóa; MANAGER/CTV không thêm quyền. Không đổi node disabled/no-phone/no-account và visibleColumns.zaloButton.
- Mobile checkbox wrapped implicit native label; glyph giữ16px. Keyboard vẫn focus input; focus-within thấy vùng bấm. Desktop checkbox/table/actions không sửa.
- Phone/Zalo/copy/node/edit/delete trong card min44×44; tránh co lại, giữ text/account ellipsis và title đầy đủ. Giữ palette/layout tổng thể; card có thể cao hơn.
- Tất cả action buttons mobile typebutton, accessible names theo khách hàng, article có tên. Callback copy nhận nguyên account, links tel/Zalo/target/rel giữ nguyên; không gọi API/clipboard thực từ component.
- SSR Chrome chỉ đo presentation/native checkbox padding-click, không hydrate/click app mutation. RTL kiểm callbacks/click không submit, roles và trường hợp thiếu dữ liệu. Không coi fake-role props là auth E2E.

## Checklist

- [x] Đối chiếu plan/source/CSS/types/Git; snapshot/preimage giữ mọi thay đổi/evidence cũ.
- [x] Viết tests trước app, xác nhận RED do thiếu mobile labels/target/non-submit; browser baseline thực, không dựa jsdom pixel.
- [x] Sửa giới hạn mobileCard/CSS, GREEN callbacks/role/native label; giữ desktop và backend.
- [x] Freeze/review/QA scoped tests/policy/types/lint riêng WT/primary; Chrome SSR matrix36case và so desktop geometry.
- [x] Lưu guide/roadmap/tiến độ48, secret/whitespace/snapshot/hash guards; không branch/commit/push/deploy.

## Files

- Modify `src/components/CustomerTableRefined.tsx`, `src/app/(dashboard)/customers/customers.module.css`.
- Create `tests/fixtures/customer-mobile-controls.ts`, `tests/ui/customer-mobile-controls.test.tsx`.
- Docs `docs/customer-mobile-controls.md`, plan này, roadmap `2026-10-26-web-ux-performance.md`, `tiendokpi.md`.

## Verification

Same43file/720test selection mục47 cộng tests mới;22policy, TypeScript nonincremental, ESLintsrc+owned tests/fixture. Synthetic runner envDir:false/env-file guard, no real DB/auth/API.

Browser36case:5width360/390/768/1024/1440 ×2theme ×3role =30, thêm6root-font200% tại1440. Mobile controls bounds≥44/in-card/non-overlap, button types và ADMIN native label padding-click; desktop đo/so với baseline chứ không ép44. Root-font không browserzoom. Chặn mọi page request, không mở tel/Zalo thật, không Next build/server, hydration/full auth/device/Production acceptance. Các gate native/libsql/KPI timeout/oldvisual/Node0TB timing và toànTask11 vẫn mở.

Kết quả: query fixture whitespace được sửa trước app và giữ RED cũ; correctedRED7fail/12pass→GREEN19. WT/primary đều44file/739test+22policy/typesPASS, lint0error/3warning cũ; Chrome36/36case mỗi root,18desktopgeometry unchanged. Exact-scope/AST xác minh desktop/callback/link contract, static review exact4hash APPROVE. Không cộng counts2root hoặc đóng toànTask11/native/release; hướng dẫn chi tiết và limitations trong `docs/customer-mobile-controls.md`.
