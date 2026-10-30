# Phân trang khách hàng: dễ đọc trên mobile, thao tác rõ nghĩa

Checkpoint54, 30/10/2026. Phạm vi Task11; chỉ local, chưa commit/push/deploy. Không thay thuật toán phân trang hay cách tải dữ liệu.

## Vấn đề đã xác minh

- `PaginationControls.tsx` dùng một hàng điều khiển không wrap. Chrome với viewport390 và root font200% cho thấy điều khiển vượt hai bên khung phân trang: 10/80 mẫu bị lỗi containment. Mẫu số lớn có select bắt đầu ở9.89px trong khi khung bắt đầu16px.
- Shared styles trong `globals.css` đã cho nút/select mobile chiều cao tối thiểu44px; baseline không có lỗi vùng bấm hoặc Tab/focus. Không thêm quy tắc min-height/focus trùng hoặc gọi các phần này là lỗi đã sửa.
- Select đã có tên truy cập từ `title="Số lượng hiển thị"`; nút cũng có chữ Trước/Sau. Bổ sung tên theo ngữ cảnh và named navigation landmark, không khẳng định trước đây hoàn toàn không có accessible name.
- Nút chưa khai báo `type`, nên có thể submit nếu component được dùng bên trong form. **Caller hiện tại ở trang khách hàng nằm ngoài form**: đây là biện pháp bảo vệ component khi tái sử dụng, không phải bằng chứng production đang submit nhầm.

## Thay đổi tối thiểu

| Phần | Thay đổi | Giữ nguyên |
|---|---|---|
| Khung phân trang | `nav`, tên `Phân trang khách hàng` | Nội dung thông tin trang/tổng, class và thứ tự DOM con |
| Chọn số dòng | Tên `Số khách hàng mỗi trang` | Title cũ, value và lựa chọn10/20/50/100, `Number(value)` và callback |
| Trước/Sau | `type="button"`, tên `Trang trước`/`Trang sau` | Chữ hiển thị, page±1, điều kiện disabled, class/callback |
| CSS≤768px | `flex-wrap:wrap`; select `width:auto; min-width:0; flex:1 1 8rem` | Desktop≥769px, shared44px/focus, phông/màu/padding/breakpoint và CSS đầu card của checkpoint53 |

Chữ lớn có thể làm select chiếm hàng riêng, nút chuyển trang xuống dưới. Mẫu số lớn390/rootfont200% tăng chiều cao khung243.375→325.375px để giữ đủ chỗ, không che chữ/nút. Đây là đánh đổi reflow có chủ đích, không tối ưu giảm chiều cao bằng cách cắt nội dung.

## Hợp đồng không đổi

- Props vẫn controlled; component chỉ gọi callbacks, không tự fetch, reset trang hay sửa dữ liệu.
- Giữ đúng disabled khi `page===1` hoặc `page===totalPages`. Không tự bổ sung xử lý NaN/out-of-range/zero vào nghiệp vụ.
- `customers/page.tsx` chỉ hiện phân trang khi `customers.length>0`; `useCustomers.ts` chuẩn hóa totalPages về tối thiểu1. Hook hiện chịu trách nhiệm reset trang khi thay limit/filter.
- Không sửa hook/caller, keys/cache/requests/quyền/role, auth/API/database hoặc các domain khác. Ba menu không dùng vẫn ẩn.
- Hook đang dùng SWR `keepPreviousData:true`. Không thêm `aria-live` hoặc thông báo trang đã tải xong chỉ dựa trên props.page: rows cũ có thể vẫn đang hiện. Refreshing badge và URL hóa bộ lọc là scope tiếp theo.

## Kiểm chứng

### Test tương tác

`tests/ui/customer-pagination-controls.test.tsx` chạy component thật với RTL/user-event, props giả từ `tests/fixtures/customer-pagination-controls.ts`:

- Named nav/select/actions; click và Enter/Space không submit synthetic surrounding form.
- Trang đầu/giữa/cuối/một trang/số lớn; giữ disabled, callback numeric và số lần gọi.
- Đủ4lựa chọn số dòng, thứ tự/text/title/info cũ; rerender controlled values không tự phát sinh request/callback.
- Tab bỏ qua nút disabled; không có live completion announcement chưa được chứng minh.

TDD: **RED5fail/14pass → GREEN19/19**. Bốn lỗi form trong RED thuộc wrapper giả ở test; không suy lỗi của caller production.

### Chrome đo bố cục độc lập

Dùng installed Chrome với SSR từ component/CSS thật, globals nguyên và props giả. Vite config/env discovery tắt, không Next build hay gọi auth/API/database. Theme/root font được đặt trước layout; chờ fonts và animation focus kết thúc trước đo.

- 5variant×6width360/390/768/769/1024/1440×2theme =60mẫu; thêm20mẫu rootfont200% ở390/1440: **80mẫu/lượt**, trong đó40mobile và40desktop/tablet.
- Baseline: layout10, contract tên/type mới80, synthetic native form64 lỗi; targets0 và keyboard0 lỗi. Các chỉ số có thể trùng mẫu, không cộng thành tổng lỗi độc lập.
- Worktree và primary AFTER chạy riêng: **80/80 mỗi lượt**, cả5nhóm lỗi đều0; không pageerror hoặc request ngoài. Giá trị/options/disabled/text giữ nguyên80mẫu; geometry desktop≥769 giữ nguyên40mẫu (kể cả font200%1440).
- Kiểm containment hai trục, không giao nhau, thông tin trang vừa chiều ngang, vùng bấm≥44px trên mobile. Native Tab/focus và trusted click64mẫu có nút enabled;16mẫu một trang không click nút disabled.
- Native Chrome probe không hydrate React và không kiểm callback React; phần đó do RTL kiểm. Rootfont200% không phải browser zoom200%, role auth hoặc thiết bị thật.
- Parent đã xem ảnh trước/sau số lớn390/font200 và sau sửa390/font100; select100/trang hiển thị đủ trong mẫu sau. Không khẳng định kiểm tự động toàn bộ native select popup/OS paint/screen reader. Nền ảnh là isolated fixture với globals, không phải ảnh toàn trang app.

### Gate hiện tại

| Kiểm tra | Worktree | Primary |
|---|---|---|
| Scoped tests | 49file/819test đạt | 49file/819test đạt |
| Read-only policy | 22/22 đạt | 22/22 đạt |
| TypeScript không incremental | Đạt | Đạt |
| ESLint src + test/fixture mới | 0error/3warning cũ | 0error/3warning cũ |
| Chrome isolated SSR | 80/80 đạt | 80/80 đạt |

Không cộng số test giữa các lượt. Selection này không phải full native suite; focused/browser/reviewer không thay QA primary.

Ba warning cũ không thuộc batch: cleanup ref ở `map/MapComponent.tsx`, biến `skippedRows` ở API uploadNode0TB và import `readSheetObjectRows` ở API uploadnodes. Không sửa code ngoài phạm vi để xóa warning.

Review static độc lập theo spec trước quality: APPROVE đúng4whole-file hashes, không finding critical/important/minor. Review không chạy lại test hoặc thay gate primary; exact-scope parent kiểm riêng root/attributes JSX và đúng4mobileCSS declarations, mọi logic cũ giữ nguyên.

## Giới hạn và bước tiếp

- Auth timeout checkpoint50 vẫn **chưa chứng minh nguyên nhân**; trace51 chưa tái hiện. Current-batch QA mới không sửa lại kết quả fail/manifest cũ thành pass.
- Gate native Windows/libSQL, KPI timeout, Node0TB visual/timing, Task10 và full browser/production/release vẫn mở. Không chạy lại full native đang lỗi, không đổi timeout/pool/dependency/config để ép xanh.
- Chưa nghiệm thu Next build, hydration/SWR request lifecycle, back/forward URL filters, app loaded với dữ liệu thật, screen reader/axe, mobile device, CLS/INP/p95 hoặc tốc độ production. Không tuyên bố cải thiện latency từ thay đổi CSS này.
- Bước nhỏ tiếp theo: xác minh phản hồi khi tải lại dữ liệu/bộ lọc khách hàng, giữ rows cũ và phản ánh đúng pending/error; URL hóa cần whitelist và browser-back regression riêng.

## Evidence và an toàn tích hợp

- App: `src/components/PaginationControls.tsx`, `src/app/(dashboard)/customers/customers.module.css`.
- Fixture/test mới nêu trên; plan `docs/superpowers/plans/2026-10-30-customer-pagination-controls-local.md`; roadmap Task11 và mục54 của `tiendokpi.md`.
- Private evidence: `.local/performance/customer-pagination-controls-20261030/` gồm snapshot/preimage, RED/GREEN, browser JSON/HTML/PNG, frozen4hash, exact-scope, review, QA, scan, backup và integration/final manifests khi hoàn tất.
- Snapshot479union paths/354source-config-test paths,158dirty và1312artifact cũ. Chỉ8owned paths trong batch; không sửa tests cũ, hooks/caller/globals/API/auth/config. Integration có backup/preimage, whitespace/default secret scan và final hash/inventory/HEAD/index guards; progress append-only. Không dùng BUILD_ID cũ làm build mới.
- Log/DB/env/token/business data không đưa vào docs hoặc Git. Chưa có commit/branch/push/deploy; `releaseReady:false`.
