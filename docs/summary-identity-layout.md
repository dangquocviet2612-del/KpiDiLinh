# Chống tràn mã/tên trong tổng hợp KPI

## Phạm vi và nguyên nhân

Mục tiến độ47, ngày29/10/2026, tiếp Task11. Áp dụng cho Tổng hợp KPI nhân viên và KPI Quản lý, không thiết kế lại app hoặc sửa CustomerTable/CTV.

`kpi.module.css` dùng table-layout fixed, mọi td kế thừa white-space:nowrap; nameCell trước đây chỉ đổi weight/color. Mã dài không có khoảng trắng vì thế vẽ đè lên KH/TH/%, dù table không rộng ra. MobileTitle và metadata tên/chức danh chưa có overflow-wrap:anywhere: text có thể nằm dưới badge hoặc bị card clip. Chrome isolated với SSR/CSS thực tái hiện được cả hai, không suy đoán từ jsdom.

## Thay đổi

- Thêm root class `summaryIdentityPanel` trên đúng2panel; không thay JSX con/data/handlers.
- CSS dưới scope đó: nameCell, mobileTitle và summaryManagerMeta wrap token dài, giữ toàn bộ text trong DOM và trong ô/card, không substring/ellipsis/truncate data.
- Cột số trong hai bảng chi tiết chỉ tiêu dùng `styles.table` căn phải, tabular-nums; headers tương ứng cùng alignment. Giữ giá trị/formatter/percent/progress/rounding, sticky first column, widths/min-width/scroll và breakpoint cũ.
- Không sửa shared nameCell/table selectors hoặc globalCSS, màu/font family, query/API/auth/role, filter/pagination, CTV hoặc3menu đã bỏ. Bảng `__all__` quản lý dùng class riêng nên không nhận rule căn số này; metadata dùng `summaryManagerMeta` dưới root vẫn nhận wrap. Không đổi logic sắp xếp/lọc metrics hoặc nghiệm thu toàn view đó.
- Tên cực dài làm row/card cao hơn để không mất chữ; đây là trade-off có chủ ý, không phải fixed-height/virtualization hoặc cải thiện tốc độ được đo.

## Bằng chứng TDD và Chrome

Fixture typed `tests/fixtures/summary-identity-layout.ts` chỉ có dữ liệu tổng hợp: mã80ký tự lặp, mã Unicode, tên/chức danh dài và số giả. Tests không dùng business data, real auth hoặc DB.

### DOM contract

`tests/ui/report-layout.test.tsx`: **RED2fail/4pass→GREEN6/6**. Hai fail là thiếu root scope trên2panel, không import/setup failures. Các case còn lại giữ full identity/Unicode/name/title,6cột/row order/totals/formatting và negative gap label. Không dùng jsdom để khẳng định kích thước/rendering thực.

### Isolated browser geometry

Harness private nạp **actual components** qua Vite SSR, cùng CSS module đã compile/đối chiếu class map và globalCSS hiện tại. Chrome headless render markup với fixture giả; không Next server/build, hydrate, auth/API/DB, external resources hoặc dùng `.next` cũ. Mọi page request bị chặn; các run đo thực không phát request/page error.

- Matrix20case:2panel ×5width360/390/768/1024/1440 × light/dark. Thêm4case root-font200% tại1440; đây **không phải browser zoom/OS font/device thật**.
- Initial harness vàV2/V3 có setup error `module is not defined`,0case; không tính là application RED. Diagnostic/installed Vite fetchModule cho thấy file:// được inline, bare module mới externalize qua Node; sửa private loader thành bare imports +root dedupe, không sửa project config/dependencies để chạy test.
- V4 tái hiện24identity failure; nhìn ảnh thấy thêm metadata mobile bị cắt nên V5 bổ sung bounds metadata và chạy lại baseline **trước app fix**. Giữ mọi artifact và không dùng lỗi setup thay layout evidence.
- V5 trước sửa: **24/24 identity fail**,24numeric-style fail. Sau sửa worktree: **24/24case đạt**, identity/metadata đều trong bounds, số right/tabular; pageOverflowPx0 trên đúng fixture này. Full text giữ nguyên, chỉ đổi cách xuống dòng/alignment.
- Numeric checks đọc computed style của desktop table kể cả khi table đang hidden dưới breakpoint mobile; không gọi đây là nghiệm thu căn chỉnh chip số mobile. Text-range đo visible identity/metadata, không chỉ đo table scrollWidth vốn có thể bằng viewport trong khi chữ vẫn chồng.
- Đã xem ảnh trước/sau của desktop nhân viên và mobile quản lý; chưa kiểm visual toàn bộ web hoặc coi ảnh2case thay full matrix.

### QA và tích hợp

- **Worktree và primary chạy riêng đều đạt43file/720scoped test +22policy**, full TypeScript nonincremental đạt, lint0error/3warning cũ. Mỗi root cũng chạy lại24case Chrome SSR V5 đạt; không cộng hai lượt thành48case/1440test khác nhau hoặc gọi scoped selection là full/native suite.
- Static review độc lập APPROVE exact5hash, đối chiếu code/preimage/cascade và saved geometry; reviewer không chạy tests/browser hay xác nhận QA rộng. Parent QA riêng, không sửa app/fixture/test sau freeze.
- `exact-scope.json` xác minh2root class và một CSS block là toàn bộ application delta, cùng fixture trước/sau, browser AFTER dùng đúng frozen sources. Source integration có backup/preimage, whitespace/default secret scan không finding;9ownedfile gồm3app/2fixture-test/4docs.
- Source/docs manifests và final-check kiểm453snapshot paths, inventories,125thay đổi local cũ và731artifact cũ. Các API/guard/asset/menu/customer/CTV và tests có sẵn khác giữ nguyên; giữ mọi harness setup failure/RED/GREEN. Không branch/commit/push/deploy.

### Candidate identity

| File | SHA256 |
| --- | --- |
| `src/app/(dashboard)/prepaid/SummaryKpiPanelClean.tsx` | `5aaf5263a17dcfe57b206c6fa760dc92ca070e9df4af503e7fd400f70d069de8` |
| `src/app/(dashboard)/prepaid/ManagerSummaryKpiPanelClean.tsx` | `26e024c4ca09d99ea7b060bae183f48e2a91f6af10242ff5bac0870523e39252` |
| `src/app/(dashboard)/prepaid/kpi.module.css` | `7890284c8f9a5a797a088c9a696284594a44c6d1113bc2106449c0bf047d1325` |
| `tests/fixtures/summary-identity-layout.ts` | `8320581621ab1fb3d1d1584117b43782f915769840e767b5de828daa5e62df7f` |
| `tests/ui/report-layout.test.tsx` | `7ee52c73590358e09359d533759a1532df0b80482c68400868cb679fde566981` |

## Giới hạn

1. SSR snapshot không kiểm client hydration, interaction, dashboard/sidebar shell, auth/phân quyền, API, toàn bộ dữ liệu/roles/view, browser back hoặc database freshness. Existing unit/RTL kiểm regression riêng, không thay E2E.
2. Geometry pass cho24case và fixture giả không bảo đảm mọi strings/formatters/browser/OS/device. Chưa đo CLS/RUM, contrast, screen reader, pagination hoặc keyboard flow của toàn trang. Font200% không tương đương browserzoom200%.
3. Scope mới chỉ2panel; không khẳng định đã sửa tất cả bảng KPI/customer/CTV/hidden reports. Checkbox Task11 rộng vẫn mở, không khôi phục menu Tồn CDT/Rời mạng/Nguy cơ rời mạng.
4. Không tuyên bố web nhanh hơn hoặc nghiệm thu Production. Full-native Windows/libsql, KPI timeout, Node0TB timing/oldvisual, fresh Next build và release gates cũ vẫn mở; không branch/commit/push/deploy.

Evidence private `.local/performance/summary-identity-layout-20261029/`: preimages/snapshot, mọi RED/GREEN/setup attempts,24case geometry/SSRhtml/PNG, hashes/review/QA/scans/backups và manifests. Không commit env/DB/log/token/business data. Plan `docs/superpowers/plans/2026-10-29-summary-identity-layout-local.md`.
