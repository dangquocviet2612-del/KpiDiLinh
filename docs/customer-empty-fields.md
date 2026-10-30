# Card khách hàng: thông tin liên hệ còn thiếu

## Hành vi và phạm vi

Mục tiến độ50, đợt29–30/10/2026, tiếp Task11, chỉ local. Mobile không còn một khối điện thoại `---` và một khối Account `---` khi trường tương ứng rỗng. Một dòng hint có wrap ghi rõ `Chưa có SĐT` / `Chưa có account`, chỉ gồm trường thực sự thiếu.

- Phone/account có dữ liệu giữ nguyên toàn bộ subtree, nội dung/title, copy feedback, callbacks và tel/Zalo URLs/target/rel. Không đổi vùng bấm44px hay ADMIN-only selection/delete, visibility options và node-disabled.
- Null/empty-string được xử lý theo truthiness hiện có. Không trim/mutate dữ liệu, đổi validation/API/database hoặc xem chuỗi `---` là sentinel. Whitespace-only vẫn được coi populated như trước, chưa phải xác nhận đây là dữ liệu hợp lệ để gọi/nhắn; cần chính sách làm sạch riêng.
- CSS chỉ thêm `.mobileMissingFields`: flex-wrap/gap, min-width0, full text/overflow-wrap, cỡ secondarytext0.74rem và theme token sẵn có; không thêm border/background/padding như strip rỗng. Không giảm chữ của các giá trị populated.
- Hints là nội dung tĩnh, không alert/live region. Không thêm toggle/state/viewport hook/request/dependency. Chỉ mobileCard đổi; CustomerRow desktop, helpers, parent/selection/expansion và mọi API/auth/menu/KPI/CTV giữ nguyên.
- Mobile container vẫn chỉ hiển thị≤768px theo breakpoint cũ. Các `---` ở CTV/gói cước hoặc missing expiry/billing không thuộc đợt này; không ẩn thông tin còn thiếu toàn card hay đóng toànTask11.

## Kiểm thử

Fixture mới import fixture giả đã có, thêm4biến thể đầy đủ/thiếu SĐT/thiếu account/thiếu cả hai, không dữ liệu kinh doanh.

- `tests/ui/customer-empty-fields.test.tsx`: **14case**, RTL actual component/user-event. **RED9fail/5pass→GREEN14/14** trước/sau application change. Kiểm strips/hints, null/empty-string, props roleADMIN/MANAGER/CTV trong nhánh missing, callbacks/edit/node-disabled/non-submit, raw account/copy feedback/tel-ZaloURLs, whitespace/literalplaceholder, rerender, flags/metadata và desktop expansion.
- Fake roles là props, không auth-E2E. JSDOM không làm bằng chứng layout. Không sửa tests cũ, skip/suppress/tăng deadline hoặc đổi project configs/dependencies.
- Worktree QA: **46file/763scoped test +22policy**, TypeScript toàn project nonincremental đạt; lintsrc+newfixture/test0error/3warning cũ.
- **Primary gate chưa đạt:**46file, **762pass/1fail**. Case `schema-auth-order.test.ts` → `GET users returns 401 without schema or database access` timeout5000ms. Primary22policy/types/lint đạt; không sửa test/auth route/config/pool/timeout hoặc chạy lại bộ rộng để lấy xanh. Hai file auth+UI chạy riêng75/75 chỉ là diagnostic, **không thay gate đỏ** và không chứng minh nguyên nhân timeout là máy chậm/flaky/cold import. Chưa có trace xác định nguyên nhân, không coi là lỗi auth trên web đã được tái hiện hoặc đã sửa.
- Mỗi root ChromeV2after64/64case đạt, không chứng minh bộ test rộng primary đã đạt. Source đã tích hợp local với backups/scan; tài liệu được tích hợp riêng để lưu đúng trạng thái pending, **không có quyền release**. Final-check chỉ kiểm scope/hash/inventory/evidence, có `primaryScopedAcceptancePassed:false`, `releaseReady:false`.

## Đo giao diện cô lập

Installed Chrome render actual CustomerTableRefined SSR, actual CSS module/globalCSS và synthetic populated/missing props. Chỉ fakeADMIN cho matrix, không Next server/build/hydration/effects/auth/API/DB/dashboard shell hoặc điện thoại thật.

64case:4variant ×6width360/390/768/769/1024/1440 ×2theme =48, thêm16case root-font200% ở390 và1440. Theme/font được đặt trước initiallayout; đây không phải browser zoom.32mobile/32desktop-visible cases;24mobilecase có missingfields.

- BeforeV2:48DOM contract failures (24mobile,24hidden-cardDOM ở desktop), không text/control failure. AfterV2:64/64case đạt,0contract/text/control failure.
- Desktop table canonical DOM và geometry giữ nguyên64case;32case table hiển thị,32case table ẩn có zero bounds. Complete-card canonical DOM/geometry giữ nguyên16case, trong đó8cardmobile hiển thị/8ẩn ở desktop. Không gọi zero bounds là kiểm layout hiển thị.
- Chỉ canonical CSS-module generated tokens được map về đúng exported class keys trước DOM comparison. Mọi attr/text/external class/token order/markup khác giữ nguyên; geometry so chính xác không tolerance nới lỏng. Raw markup vẫn lưu để đối chiếu.
- Missingmobile height giảm ít nhất20px/trường thiếu trong fixture; hints nằm đủ trong boundingbox, controls giữ44px/in-card, copy/link presence và typebutton đúng. Parent đã xem PNG thiếu cả hai trước/sau390px.

| Fixture ở390px, root-font100% | Chiều cao card trước → sau | Giảm |
| --- | --- | --- |
| Thiếu SĐT | 371.64 →347.75px | 23.89px |
| Thiếu account | 371.64 →330.28px | 41.36px |
| Thiếu cả hai | 345.64 →254.86px | 90.78px |
| Đủ cả hai | 397.64 →397.64px | 0px, DOM không đổi |

Đây là geometry của một fixture, không row thực trên web, CLS hoặc tốc độ tải/API. Page overflow chỉ là diagnostic; không kết luận toàn web đạt responsive.

## Harness correction và hàng rào

V1 đã chạy đủ64case, mọi geometry/table/fullcard và target checks khớp nhưng raw DOM comparison fail do Vite CSS-module hashes/line identifiers thay khi CSS đổi. Ví dụ `_table_i4hro_443`→`_table_srp3o_443`. V2 chỉ map tokens bằng exact exported class map để so semantic class keys; không xóa class, chuẩn hóa dữ liệu/attrs, đổi geometry thresholds/app/tests hay ép xanh bằng timing/sleep. V1 harness/logs/failedreport và V2 đầy đủ giữ riêng; exact-scope kiểm source hashes theo từng phase V1/V2 không đổi.

Exact-scope chứng minh chỉ thêm guard quanh2strips và rowhint, một CSS class mới; toàn bộ populated subtree/handlers/desktop/helpers/parent giống preimage. Freeze4hash trước review/QA, beforebrowser dùng saved preimages và cùngfixture/test. Review static độc lập APPROVE spec trước quality đúng4hash, không finding critical/important; không thay gate QA/integration. Source/docs có backup/preimage, whitespace/default secret scan không finding; tổng8ownedfile. Scope-only final-check đối chiếu465snapshot paths/348source-config-test paths,144thay đổi local/992artifact cũ; source/test/auth/config khác giữ nguyên. Không stage/commit/push/deploy hoặc dùng buildNext cũ nghiệm thu candidate; QA primary vẫn pending.

## Còn mở

- Phone/account whitespace hoặc dữ liệu sai cần validation/data-cleanup riêng; đợt này không thay quy tắc dữ liệu hoặc quyền. Placeholder CTV/package và metadata chưa tối ưu.
- Next hydration/router/clipboard/CRUD/session/roles thật, điện thoại/OS/screen-reader, text scaling ở các width còn lại, CLS/RUM/load-speed và toànTask11 chưa nghiệm thu.
- Full native Windows/libsql/KPI-timeout cũ, Node0TB visual/timing, Task10SQLscope/identity mapping và release gates giữ mở; không full-native/build/Production acceptance, dependency upgrade hay database thật.
- Timeout primary auth mới ghi nhận trong batch này là gate riêng, không gộp với KPI-timeout/native cũ hoặc khẳng định cùng nguyên nhân. Cần trace import/handler/scheduling khi có repro trước khi sửa; không đổi assertion/deadline để che lỗi.

Evidence local ignored `.local/performance/customer-empty-fields-20261029/`: snapshots/preimages/RED/GREEN/browserV1–V2/SSRHTML/PNG/hashes/exact-scope/review/QA/scans/backups/manifests/final-check. Không đưa env/DB/token/log/dữ liệu thật lên Git.
