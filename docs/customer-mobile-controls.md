# Thao tác khách hàng trên mobile

## Phạm vi

Mục tiến độ48, ngày29/10/2026, tiếp Task11. Chỉ hoàn thiện `CustomerMobileCard` và CSS điều khiển dưới card. Không đổi desktop table, phân quyền, query/data, clipboard implementation hoặc modal.

Trước sửa, checkbox chỉ16px; phone/Zalo/copy/action có vùng bấm nhỏ. Bốn nút mobile thiếu type nên **nếu component đặt trong form** sẽ submit ngoài callback. Fixture form tái hiện được; không khẳng định trang Customers thực tế đang có form bao quanh table.

## Thay đổi

- Native label44×44px bao quanh checkbox16px, không phóng lớn glyph. Click vào khoảng đệm vẫn chọn; keyboard focus input như trước, focus-within làm rõ toàn vùng bấm.
- Phone/Zalo/copy/node/edit/delete trong card min44×44px, không shrink. Focus-visible theo theme tokens; desktop controls không nhận rule này. Mobile card có thể cao hơn để đủ vùng chạm.
- Bốn action buttons có `type=button`, không submit form ngoài ý muốn. Giữ callback copy/view/edit/delete và selection; không thêm fetch/clipboard hoặc dữ liệu gửi ra ngoài.
- Article và điều khiển có tên tiếng Việt theo khách hàng, giúp phân biệt nhiều card. Copy title Việt hóa ở mobile; desktop label/title giữ nguyên. Account có khoảng trắng vẫn được callback nhận nguyên giá trị.
- ADMIN vẫn có checkbox/xóa; MANAGER/CTV không thêm controls đó. Giữ node disabled khi không có node, thiếu phone/account thì không hiện liên kết/copy, cùng visibleColumns.zaloButton/target/rel hiện tại.
- Không khôi phục3menu đã bỏ hoặc sửa KPI/công cụ/CTV/backend/auth.

## Bằng chứng TDD

Fixture `tests/fixtures/customer-mobile-controls.ts`: khách hàng tổng hợp, số điện thoại0000000000, account dài có khoảng trắng, không PII/database thật. `tests/ui/customer-mobile-controls.test.tsx`:19case với React DOM/user-event, callbacks giả, không click tel/Zalo thật.

- RED đầu8fail/11pass; một case lỗi query do getByTitle normalizer trim khoảng trắng. Giữ source/log cũ; chỉ đổi sang query normalized text rồi assert raw title **trước app**.
- Corrected **RED7fail/12pass→GREEN19/19**. Bốn fail chứng minh form wrapper nhận onSubmit ngoài callback; các fail khác là thiếu tên card/actions và label hit target. Không import/setup/unhandled failures, skip/suppress/deadline hoặc config/dependency changes.
- Bao phủ callbacks nguyên giá trị, non-submit, native label một lần chọn, Space/deselect,3role UI, URLs/rel/target, thiếu data/node-disabled, flag Zalo, copied state, nhiều card và desktop expansion/stopPropagation.

## Chrome SSR cô lập

Actual component được renderToStaticMarkup, CSS module compile/map bằng Vite cài sẵn cùng globalCSS. Chrome headless không Next server/build/hydration, không auth/API/DB hoặc dùng build cũ; chặn mọi page request. Role là fake props, không đăng nhập3tài khoản.

Matrix36case:5viewport360/390/768/1024/1440 ×2theme ×3role =30, thêm6root-font200% tại1440. Đây là viewport/root-font, không điện thoại thật hoặc browser zoom.

| Chỉ số (harness V2) | Trước sửa | Sau sửa worktree |
| --- | --- | --- |
| Tổng case / mobile case | 36 / 18 | 36 / 18 |
| Case hit target nhỏ/ngoài card/chồng nhau | 18 | 0 |
| Case có button thiếu typebutton | 18 | 0 |
| Case ADMIN label padding không kích hoạt checkbox | 6 | 0 |
| Case thiếu accessible card name | 18 | 0 |
| Sai UI role gates | 0 | 0 |

- Probe click bằng tọa độ tại khoảng đệm label, không vào glyph: native DOM checkbox chuyểnfalse→true→false với đúng1change/click. Đây **không phải** nghiệm thu React callback sau hydration; RTL kiểm callback riêng.
- 18case desktop (kể cả root-font) giữ chính xác vị trí/kích thước/tên/type controls so baseline; không ép mọi nút desktop44px hoặc claim desktop checkbox được mở rộng.
- Mobile target đo element/label bounds, không chỉ SVG; kiểm nằm trong card, không overlap. Đã xem ảnh trước/sau mobile ADMIN; không dùng hai ảnh thay whole-app visual acceptance.

### QA và tích hợp

- **Worktree và primary chạy riêng đều đạt44file/739scoped test +22policy**, full TypeScript nonincremental đạt, lint0error/3warning cũ. Mỗi root Chrome SSR V2after36/36case đạt,18desktopgeometry unchanged. Đây là cùng bộ kiểm tra chạy lại ở2root, không cộng thành1478test/72case hoặc gọi full/native/app-E2E acceptance.
- Static review độc lập APPROVE spec trước quality exact4hash, đối chiếu preimages/cascade và saved browser/test artifacts; reviewer không chạy QA/browser hay chứng nhận release. Parent QA/integration riêng, không sửa app/fixture/test sau freeze.
- `exact-scope.json` kiểm desktop/shared helpers/default parent byte-equal, AST callbacks/href/target/rel/disabled/checked giữ nguyên, chỉ CSS block mới và cùng fixture/test trước/sau. Source integration có backup/preimage, whitespace/default secret scan không finding.
- Tổng8ownedfile gồm2app/2fixture-test/4docs. Manifests/final-check kiểm457snapshot paths, inventories,132thay đổi local cũ và815artifact cũ; giữ API/auth/menu/KPI/CTV cùng tests có sẵn khác, mọi RED/query correction/GREEN/browser artifacts. Không branch/commit/push/deploy.

### Candidate identity

| File | SHA256 |
| --- | --- |
| `src/components/CustomerTableRefined.tsx` | `f3e17290d149b3a0c6898af4567ae70ca65d171694ad16912c074e2a963296f2` |
| `src/app/(dashboard)/customers/customers.module.css` | `ee62f6c340ccf60e85d8c8ddf306fc8831749e3cdc907ccabc556a04889c83ff` |
| `tests/fixtures/customer-mobile-controls.ts` | `6cd0df4083aa2ac5f83a0473223e0ac398d2823c4ea072be251caf7624545e8d` |
| `tests/ui/customer-mobile-controls.test.tsx` | `56bceea9526be4da0c3cb1704e6590de7b110e6e6aa885ed41f47723406cb419` |

## Giới hạn

1. SSR/native DOM probe không kiểm hydrated app, router, actual clipboard, API CRUD, session/permissions hoặc thật sự gửi Zalo/gọi điện. Không có tin nhắn/cuộc gọi hoặc sửa khách hàng thật.
2. Form safety test dùng wrapper giả; không tự quy kết production đang submit nhầm. Fake role visibility không phải server authorization proof.
3. Không đảm bảo mọi strings/theme/browser/device/touch/OS hoặc screen reader; root-font200% không browserzoom, và extra font cases ở desktop chứ không mobile. Chưa RUM/CLS/speed/contrast hoặc toàn bộ bảng/forms.
4. Source/geometry giới hạn customer mobile card và fixture. Task11/Task10, native Windows/libsql, KPI timeout, old visual/Node0TB timing cùng release gates vẫn mở. Không branch/commit/push/deploy, dependency upgrade hoặc full-native suite.

Evidence private `.local/performance/customer-mobile-controls-20261029/` giữ snapshot/preimages, RED/query correction/GREEN,36case geometry/SSRhtml/PNG, hashes/review/QA/scans/backups/manifests. Không commit env/DB/log/token/business data. Plan `docs/superpowers/plans/2026-10-29-customer-mobile-controls-local.md`.
