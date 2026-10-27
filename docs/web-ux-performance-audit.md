# Audit giao diện và hiệu năng KpiDiLinh

Ngày: **26/10/2026**, Asia/Saigon. Source tham chiếu: `1ecfa38`; ứng dụng Production chứa bản sửa `3f89383`, deployment `dpl_6vS42qZLk96eek3F4HCi8jikpQg7`.

## 1. Kết luận điều hành

**Nên cải thiện, nhưng không cần viết lại app hoặc đổi database ngay.** Phần cần ưu tiên là vòng đời request, việc chuẩn bị schema trong API, cache/phân quyền và lượng dữ liệu tải cho bản đồ. Sau đó sửa những điểm giao diện đã xác minh. Giữ bố cục, công thức KPI, quyền ADMIN–MANAGER–CTV và dữ liệu hiện tại.

Phát hiện nổi bật:

1. API KPI cá nhân và tổng hợp có mẫu mất **9,3–9,9 giây**, dù HTML của các trang này về khoảng **0,2–0,3 giây**. Không thể giải quyết chỉ bằng thay màu hoặc thêm skeleton.
2. Tính KPI gọi `/api/kpi/report` **10 lần trên desktop, 11 lần trên mobile** trong lượt mở đo được; tổng số API lần lượt 15/16. Có hai luồng tải báo cáo đồng thời trong source, cộng khởi tạo ngày/CTV và callback chưa ổn định.
3. Khởi tạo KPI có **49 call-site SQL**, nhiều lệnh DDL chạy tuần tự, memoize chỉ trong một process. Đây là ứng viên nguyên nhân latency; **chưa có Function/SQL trace để quy toàn bộ 9–10 giây cho nó**.
4. Các view KPI/cước/CDT/công văn cùng tải khoảng **753 KiB JavaScript `_next` giải nén** trong cửa sổ chính. Các panel được import tĩnh dù chỉ hiện một view.
5. Bản đồ khách hàng tải khoảng **605 KiB JSON API giải nén**, bản đồ Node khoảng **552 KiB**. Phần lớn payload bản đồ khách hàng là danh sách node dùng chung; nên cắt projection trước khi đầu tư server-side clustering.
6. Hai rủi ro vận hành cần xử lý trước tối ưu lớn: **migration chạy trong mỗi build**, và **GET archive có thể gọi purge trước xác thực**.
7. Giao diện nhìn chung đã có nền tảng tốt. Lỗi UI xác minh được gồm mã nhân viên tràn cột KPI, nhiều hit-target mobile dưới 44 px, card có nhiều khối thông tin rỗng và layout shift ở một số báo cáo.

Plan thực hiện: `docs/superpowers/plans/2026-10-26-web-ux-performance.md`. **Chưa triển khai các đề xuất trong audit này.**

## 2. Phương pháp, phạm vi và giới hạn

- Chrome headless trên máy Windows của chủ dự án, role ADMIN; desktop **1440×960**, mobile emulation **390×844**.
- **29 route/view desktop + 17 mobile = 46 lượt điều hướng**; mỗi route/device một mẫu. Context mới mỗi lượt, session đăng nhập tái sử dụng trong bộ nhớ; chặn service worker và HTTP mutation của phiên duyệt.
- Không giả lập CPU yếu hoặc mạng 4G. Cold browser/context **không đồng nghĩa cold Function hoặc cold database cache**. Desktop được đo trước mobile nên không dùng hai cột để kết luận điện thoại nhanh/chậm hơn máy tính.
- Đo navigation timing, LCP lab nếu observer nhận được, CLS lab, tài nguyên `_next` ở cửa sổ chính, số API, dung lượng JSON giải nén và mốc API cuối kết thúc. Số byte không phải dung lượng truyền qua mạng sau nén; tài nguyên trong iframe không nằm đầy đủ trong thống kê JS cửa sổ chính.
- Đối chiếu source, schema/migration, dependency, test, tài liệu/plan cũ; xem ảnh desktop/mobile và thực hiện thêm probe hình học DOM cho KPI/cỡ nút.
- **Không có thao tác thêm/sửa/xóa/import dữ liệu nghiệp vụ trong đợt audit.** Đăng nhập chỉ phục vụ phiên đọc. GET archive status bị chặn riêng vì có side effect purge trong implementation. Các GET khác có thể chạy runtime schema initialization; vì vậy không khẳng định hệ thống thực hiện 0 SQL write chỉ vì đây là lượt xem trang.
- `/archive` chỉ kiểm tra render/source với request status bị chặn; không dùng số timing của nó để đánh giá backend archive.
- Chưa kiểm tra live bằng tài khoản MANAGER/CTV, điện thoại vật lý, tablet, dark theme toàn bộ màn, GPS thực tế, import/export/restore hay file lớn. Không chạy build/migration để làm audit.
- Không có RUM, INP thực tế, mẫu p75/p95, tracing từng SQL hoặc EXPLAIN trên database thử. Không suy ra các giá trị đó từ 46 mẫu hiện có.

**Bằng chứng riêng tư:** `.local/web-performance-audit-20261026/browser-audit.json`, `layout-probes.json`, `infrastructure-observation.json` và ảnh cùng thư mục. Không đưa ảnh/dump/log có dữ liệu khách hàng vào Git hoặc tài liệu công khai.

## 3. Baseline đo được

Đơn vị thời gian: giây. **API cuối** là thời điểm request API cuối kết thúc tính từ navigation, không phải phép đo chính thức “người dùng thao tác được” hoặc INP. Bảng là mẫu lab, không phải SLA/p95.

| Route/view | API desktop | API cuối desktop | API cuối mobile | JSON API desktop, KiB |
|---|---:|---:|---:|---:|
| Khách hàng `/customers` | 4 | 2,52 | 2,44 | 7,9 |
| CTV `/ctv` | 3 | 2,41 | 2,33 | 8,5 |
| KPI cá nhân `/prepaid` | 8 | 12,49 | 4,29 | 24,6 |
| Tổng hợp KPI `view=summary` | 9 | 12,30 | 5,33 | 20,0 |
| KPI quản lý `view=summary-manager` | 9 | 4,50 | 5,57 | 15,3 |
| Tính KPI `view=kpi-calculator` | 15 | 11,82 | 4,95 | 59,4 |
| Cước `view=cuoc` | 7 | 3,30 | 3,04 | 19,1 |
| Cước CĐ `view=cuoc-cd` | 7 | 3,13 | Chưa đo mobile | 18,3 |
| CDT `view=cdt` | 6 | 3,02 | Chưa đo mobile | 19,8 |
| Tổng hợp CDT `view=cdt-report` | 6 | 2,98 | Chưa đo mobile | 12,9 |
| Tồn CDT `view=cdt-outstanding` | 7 | 3,72 | 4,40 | 37,8 |
| Rời mạng `view=disconnect` | 7 | 3,56 | 3,14 | 32,3 |
| Công văn `view=official-docs` | 5 | 4,16 | 4,14 | 18,1 |
| Bản đồ khách hàng `/map` | 4 | 4,72 | 3,15 | 605,2 |
| Bản đồ Node `/node-map` | 3 | 2,55 | 2,09 | 551,7 |
| Node 0TB `/node-0tb` | 3 | 3,62 | 3,37 | 50,8 |
| Nguy cơ rời mạng `/churn-risk` | 5 | 4,56 | 4,34 | 0,6 |
| Nhật ký `/logs` | 3 | 7,30 | Chưa đo mobile | 12,9 |
| Đổi mật khẩu `/change-password` | 2 | 1,57 | Chưa đo mobile | 0,2 |
| Tiện ích `/tools`, chuyển trang theo role | 2 | 1,48 | 1,20 | 0,2 |
| QR `/tools/qr` | 2 | 1,77 | 1,73 | 0,2 |
| Excel `/tools/excel` | 5 | 4,98 | Chưa đo mobile | 10,9 |
| Ảnh `/tools/photo` | 2 | 1,84 | Chưa đo mobile | 0,2 |
| Phiếu thu `/tools/receipt` | 5 | 3,92 | Chưa đo mobile | 10,9 |
| Ghi SIM `/tools/sim` | 2 | 1,80 | Chưa đo mobile | 0,2 |
| Công cụ gốc `/tools/chia-file-son` | 2 | 2,36 | Chưa đo mobile | 0,2 |
| Đăng nhập `/login`, context có session | 2 | 1,50 | 1,48 | 0,2 |
| Trang `/`, chuyển sang khách hàng | 4 | 2,03 | Chưa đo mobile | 7,9 |
| Archive `/archive` | Status bị chặn | Không đánh giá API | Chưa đo mobile | Không so sánh |

Quan sát bổ sung:

- Không thấy lỗi JavaScript hoặc tràn ngang **cấp document** trong 46 lượt. Điều này không bảo đảm mọi tương tác, bảng, iframe hoặc nội dung động đều đúng.
- Một mẫu `/logs` có TTFB **4,76 s**, LCP **5,71 s**; cần đo lặp để phân biệt cold/outlier với lỗi ổn định, chưa kết luận là trang luôn chậm.
- LCP mobile KPI cá nhân khoảng **3,01 s**, Tồn CDT khoảng **3,77 s** trong mẫu hiện có. CLS lab desktop Tồn CDT khoảng **0,2**, Rời mạng khoảng **0,8**; cần đo lại với skeleton/layout đã cố định.
- JavaScript `_next` giải nén: khách hàng **608 KiB**, prepaid **753 KiB**, bản đồ khách hàng **787 KiB**, Node **774 KiB**, Node 0TB **737 KiB**. Không phải tất cả dung lượng này đều loại bỏ được: có phần framework/shared bundle.
- API KPI riêng lẻ chậm nhất khoảng **9,9 s**; các API cước/CDT trong mẫu thường khoảng **0,3–1,2 s**. Không nên kết luận toàn bộ backend đều chậm.
- Probe desktop Tổng hợp KPI xác nhận **3 dòng** có nội dung cột đầu vượt sang cột kế tiếp khoảng **14–18 px**. Không chép mã nhân viên vào báo cáo.
- Probe mobile khách hàng ghi nhận **38/42 nút trong layout** có ít nhất một chiều dưới 44 px; chưa tính wrapper hit-area bổ sung. Đây là chỉ tiêu usability đề xuất, không tự động là kết luận vi phạm WCAG.
- Probe mobile bổ sung **không xác nhận** menu đè tiêu đề tại vị trí đầu trang. Không đưa nhận xét này thành bug đã chứng minh chỉ từ ảnh chụp.

## 4. Những phần đã tốt, không nên làm lại

| Nền tảng hiện có | Bằng chứng |
|---|---|
| Layout theo role, skip-link, focus-visible, reduced motion, breakpoint tablet | `src/app/(dashboard)/layout.tsx:22`; `src/app/globals.css:717`; `src/app/(dashboard)/layout.module.css:44` |
| Dialog/confirm, focus trap/return focus, cảnh báo thay đổi chưa lưu | `src/components/ui/ConfirmDialogProvider.tsx:35`; `src/hooks/useDialogAccessibility.ts:25`; `src/components/CustomerModalRefined.tsx:201` |
| Danh sách khách hàng có SWR, debounce, paging, keep previous data | `src/hooks/useCustomers.ts:55`; `src/hooks/useCustomers.ts:86` |
| Bản đồ được lazy-load theo route, đã có clustering/shared controls và icon cache | `src/app/(dashboard)/map/page.tsx:6`; `src/app/(dashboard)/node-map/page.tsx:7`; `src/app/(dashboard)/node-0tb/Node0TbMap.tsx:42` |
| Export XLSX client ở bản đồ Node đã dùng dynamic import | `src/app/(dashboard)/node-map/NodeMapComponent.tsx:595` |
| KPI dùng JOIN/aggregate SQL; CDT có SQL paging; nhiều import đã batch transaction | `src/app/api/kpi/report/route.ts:68`; `src/app/api/kpi/summary/route.ts:258`; `src/app/api/cdt/report/route.ts:136`; `src/app/api/kpi/import/route.ts:122` |
| KPI chưa đạt nằm trên, tổng hợp có lọc chưa đạt, mock calculator là nghiệp vụ hiện có | `src/lib/kpi-row-sorting.ts`; `src/app/(dashboard)/prepaid/SummaryKpiPanelClean.tsx` |
| Form Node đã sửa DOM clobbering; baseline trước audit 37 file/127 test đạt | `src/components/CustomerModalRefined.tsx:219`; `tests/ui/customer-workflow.test.tsx:81`; `tiendokpi.md`, mục 14 |

Các checkbox chưa đánh dấu trong roadmap cũ không phải bằng chứng một việc chưa được làm. Plan mới phải đối chiếu implementation thay vì chạy lại nguyên roadmap tháng 3/tháng 9.

## 5. Danh sách phát hiện và ưu tiên

### P0 — An toàn trước khi tối ưu/deploy tiếp

**S01. Migration nằm trong build và có replay rebuild bảng.** `package.json:7`; `scripts/migrate.mjs:63`; `prisma/migrations/20260920000002_fix_node0tb_id/migration.sql:16`. Tách release migration có ledger/checksum/lock, preserve data và backfill bắt buộc. Preview không dùng chung database Production. Không chạy `migrate reset` để xử lý.

**S02. GET archive gọi purge trước auth.** `src/app/api/archive/status/route.ts:15`; `src/app/api/archive/export/route.ts:9`; `src/lib/archive.ts:244`. Chỉ đọc trang hoặc request bị từ chối không được kích hoạt DELETE. Dời purge sang cron/admin action xác thực trước, có claim/transaction để tránh xử lý trùng. Export hiện còn ghi `ArchiveExportLog` để xác nhận bản xuất mới trước khi archive; nếu đổi export thành POST phải đổi UI caller và giữ safeguard này, không chỉ xóa log. GET cron đã xác thực là tác vụ scheduler tường minh, không thuộc nhóm GET đọc trang. Không có bằng chứng từ audit này để quy nguyên nhân sự cố mất dữ liệu trong quá khứ.

### P1 — Tác động trực tiếp tốc độ và độ đúng

**P01. DDL/seed trong request và trước cache.** `src/lib/kpi-db.ts:11`; `src/app/api/kpi/report/route.ts:23`; `src/app/api/users/route.ts:13`. Chuyển schema/index/seed vào migration đã kiểm chứng; giữ seed nghiệp vụ `CUOC_N1_N3_RATE`. Trace chứng minh thời gian từng phase trước khi kết luận mức đóng góp.

**P02. Tải báo cáo lặp và khởi tạo filter nhiều nhịp.** `src/app/(dashboard)/prepaid/PrepaidPageImpl.tsx:475`, `:504`; `src/app/(dashboard)/prepaid/useKpiCalculator.ts:49`. Effect personal không loại calculator; calculator lại có fetch riêng. Callback resolve date truyền inline; `hasData` mới dedupe sau khi đã có kết quả, không chặn request cùng key đang chạy. `/api/me` và `/api/auth/session` cũng lặp. Chốt filter một lần, tách owner của report, reuse query theo key, abort request lỗi thời và ổn định callback. Không chỉ “debounce thêm 1 giây”.

**P03. Client bundle của report chưa tách theo view.** `src/app/(dashboard)/prepaid/PrepaidPageImpl.tsx:22`; `:429`; `src/app/(dashboard)/prepaid/page.tsx:3`. Dynamic-load panel/hook trong boundary của view, tách CSS theo domain dần. Giữ auth/permissions ở server và không coi mọi `xlsx` server import là client bundle.

**P04. Critical path query và metadata còn tuần tự.** `src/app/api/kpi/report/route.ts:54`; `:96`; `src/app/api/kpi/summary/route.ts:106`, `:215`. Hợp nhất metadata; chạy song song nhánh độc lập sau auth/scope; single-flight theo request key. Không gọi đây là N+1 theo metric khi report hiện đã JOIN.

**P05. Cache invalidation và revocation quyền chưa hoàn chỉnh.** `src/lib/kpi-cache.ts:6`; `src/app/api/cuoc/import/route.ts:109`; `src/app/api/users/[id]/route.ts:108`; `src/app/api/customers/route.ts:46`; `src/app/api/node-search-map/route.ts:41`. Cache Map chỉ cục bộ Function; một số dependency/tag không được clear, đổi quyền có thể giữ scope cũ. Lập dependency matrix, permission version, bounded cache và xác minh scope trước khi trả cached payload. Không cache riêng tư thành public hoặc xóa role/scope khỏi key để đổi lấy tốc độ.

**P06. Payload bản đồ và lookup Node 0TB.** `src/app/(dashboard)/map/MapComponent.tsx:473`; `src/lib/customer-node-mapping.ts:49`; `src/lib/node-0tb-db.ts:237`, `:290`. Trước tiên marker DTO chỉ lấy trường cần thiết, detail khi chọn; reuse node dataset. Sau đó bbox/zoom nếu benchmark với dữ liệu lớn đòi hỏi. Node 0TB ưu tiên bỏ ensure/seed trong GET và lookup chuẩn hóa; chỉ 138 item nên không mặc định cần virtualization.

**P07. CDT tồn/cước CĐ còn đọc và lọc chưa tối ưu.** `src/app/api/cdt/outstanding/report/route.ts:143`, `:207`, `:240`; `src/app/api/cuoc-cd/report/route.ts:127`, `:185`. Metadata phải có cache/lookup hợp lý; tránh lặp CTE totals/count/page; đẩy scope vào SQL, dùng date range và identity mapping có index. Tổng/tháng/trạng thái trả về phải giữ đúng.

**U01. Cột tên/mã KPI lấn dữ liệu kế bên.** `src/app/(dashboard)/prepaid/kpi.module.css:1365`; `src/app/(dashboard)/prepaid/SummaryKpiPanelClean.tsx:210`; ảnh và `layout-probes.json`. Dùng column sizing phù hợp, wrap hoặc ellipsis kèm tên đầy đủ dễ truy cập; không để chữ nằm trên KH. Số tiền/số lượng dùng alignment nhất quán.

**U02. Hit-target mobile và layout shift.** `src/app/globals.css:634`, `:677`; `src/components/Sidebar.module.css:389`; `src/app/(dashboard)/prepaid/PrepaidPanelSkeleton.tsx`; các panel CDT/Rời mạng. Chuẩn hóa vùng bấm, đặc biệt icon/nút compact; reserve đúng chỗ cho stats/filter/table trước khi data về. Không phóng mọi icon thành 44 px; tăng hit-area/wrapper và khoảng cách.

### P2 — UX, vận hành dài hạn và maintainability

**U03. Giảm dữ liệu rỗng và thao tác cuộn.** Card khách hàng có các khối `---`/account trống chiếm nhiều diện tích; CTV mobile xếp nhiều thẻ thống kê trước danh sách. `src/components/CustomerTableRefined.tsx:359`; `src/app/(dashboard)/ctv/page.tsx`. Rút gọn empty fields, summary compact/collapsible, đưa tìm kiếm và tác vụ chính gần nội dung; giữ đủ thông tin khi mở chi tiết.

**U04. Giữ trạng thái lọc và hiển thị đang cập nhật.** `src/hooks/useCustomers.ts:45`, `:86`; các hook report. SWR đã giữ dữ liệu cũ nhưng cần cờ refreshing dễ hiểu; chuẩn hóa URL filter/page/view và back navigation, tránh người dùng tưởng dữ liệu cũ là kết quả filter mới. Không thay cấu trúc URL hàng loạt nếu làm hỏng link cũ.

**U05. Tính nhất quán và phản hồi lỗi.** `src/app/login/page.tsx:14`, `:46`; `src/app/(dashboard)/change-password/page.tsx`; `src/app/(dashboard)/tools/ToolPageFrameClean.tsx:34`. Thêm try/catch/finally cho lỗi mạng đăng nhập, live region, autocomplete/password affordances; iframe có loading/timeout/reload và tiếng Việt có dấu. Không sandbox mù quáng làm hỏng download/canvas/GPS; server access guard phải giữ nguyên.

**U06. Map nhỏ gọn trên mobile, không thay lại toàn bộ.** Các toolbar/legend đã có component chung. Cần kiểm tra rõ số tổng/có tọa độ/trong khung, chế độ nhãn ưu tiên khi zoom xa, hint thanh legend cuộn ngang, bottom sheet chi tiết; không vẽ tọa độ giả để tăng số marker. Đây là thay đổi UX cần preview/duyệt riêng.

**O01. Import/export/file lớn và backup.** `src/lib/node-0tb-db.ts:187`; `src/app/api/import/route.ts:364`; `src/app/api/admin/backup/route.ts:902`; `src/lib/official-doc-assets.ts:63`. Một số import còn row-wise; backup gom nhiều bảng vào RAM; công văn base64 trong DB. Bước đầu hiển thị giới hạn file thật của hosting và progress rõ ràng; file lớn dùng direct storage + job nếu được duyệt chi phí. Không chỉ tăng timeout/body size.

**O02. Auth/index/region phải đo và giữ khả năng thu hồi quyền.** `src/auth.ts:30`, `:49`; `src/lib/prepaid-query.ts:199`; `prisma/schema.prisma:52`. Login khác case còn read-all; cần canonical lookup sau kiểm tra collision. Index mới phải có EXPLAIN, không thêm trùng. Metadata deployment xác nhận API KPI/CDT/khách hàng chạy **`iad1`**; middleware có nhiều region khác, không được nhầm chúng với region API. Hostname DB gợi ý `aws-ap-northeast-1`; phải xác minh placement/RTT trước khi chọn region gần DB, không tự chuyển Production trong audit.

**T01. Thiếu guardrail hiệu năng và browser E2E trong repo.** `.github/workflows/ci.yml:14`; `tests/ui/accessibility.test.tsx:27`; `package.json`. Có 127 test nhưng phần lớn là unit/jsdom; axe hiện chỉ cover primitive và tắt contrast. Cần smoke browser thật bằng dữ liệu staging giả, performance budget, role matrix và RUM không chứa PII. Đồng bộ Node CI với runtime deploy sau khi xác minh compatibility.

## 6. Capability/domain coverage

| Domain | Đã xem | Hướng cải thiện |
|---|---|---|
| Login, đổi mật khẩu, shell/nav/theme | Source, desktop; login và shell mobile | Network error recovery, feedback/a11y, touch targets; dark theme cần QA bổ sung |
| Khách hàng | Source/API/test; desktop/mobile, baseline; form Node đã sửa trước đó | Compact cards, query state/refresh indication, modal lazy-load nếu bundle analyzer chứng minh có lợi |
| CTV, cấu hình KPI | Source; danh sách desktop/mobile; cấu hình kiểm tra source | Giảm stats chiếm màn hình, giữ validate/dirty state hiện có, quy trình cấu hình có preview/đối soát |
| KPI cá nhân/tổng hợp/quản lý/calculator | Source/API; đủ 4 view trên desktop/mobile | Loại fetch lặp, DDL khỏi GET, rút critical path, cột/CLS/hit-target |
| Cước/Cước CĐ | Source/API; desktop cả hai, mobile Cước | Scope SQL, metadata/cache, thống nhất report shell |
| CDT/tổng hợp/tồn | Source/API; desktop cả ba, mobile tồn | Derived query, paging/totals, skeleton và card density |
| Rời mạng/nguy cơ rời mạng | Source/API; desktop/mobile | Stable layout, filter state, import bounded/job khi cần |
| Bản đồ khách hàng/Node/0TB | Source/API; desktop/mobile | Marker projection, detail on demand; preserve clustering/GPS/search/matching |
| Công văn | Source/API; desktop/mobile list | Lazy panel/editor, asset transport/file limits; chưa thử upload |
| Nhật ký/backup/restore/archive | Source; logs desktop; archive render bị chặn API purge | P0 không mutate trên GET; backup/restore/job an toàn; chưa thực hiện thao tác vận hành |
| QR/SIM/Excel/ảnh/phiếu thu/công cụ gốc | Source; desktop các route, mobile hub/QR | Frame loading/retry, bundling và preview responsive; iframe internals/mobile cần QA thêm |

## 7. Tiêu chí đích đề xuất, chưa phải kết quả đã đạt

- CWV theo p75 field: **LCP ≤2,5 s; INP ≤200 ms; CLS ≤0,1**. Audit hiện không có p75/INP nên phải bổ sung đo thật; không hứa đạt từ một ảnh/single run.
- Trên workload staging thống nhất: API KPI warm p50 mục tiêu ≤1 s, p95 ≤2,5 s; query count và phase timing phải ghi kèm. Mục tiêu dữ liệu hữu ích của report ≤3 s warm/≤5 s cold-browser cần được định nghĩa bằng UI mark cụ thể, không dùng mốc API cuối làm thay thế.
- Tính KPI không chạy personal fetch ẩn; cùng key chỉ một request đang chạy. Một lần chọn filter không gây chuỗi 10–11 request report. Trường hợp auto-resolve ngày cho phép tối đa một follow-up có chủ đích nếu không tránh được.
- Giảm JS/report entry theo budget xác lập ở baseline; kỳ vọng thử nghiệm giảm 15–25% phần `_next` giải nén, **không cam kết trước bundle analysis**. Không tải panel khác khi chưa mở; preload khi intent nếu cần.
- Marker payload giảm ít nhất một nửa là mục tiêu thử nghiệm sau khi có DTO; giữ đủ dữ liệu để pin/cluster/search/detail đúng. Nếu không đạt, giải thích trường bắt buộc và đo lại thay vì drop dữ liệu im lặng.
- Không có chữ lấn cột, vùng bấm chính mobile đạt mục tiêu 44×44 px hoặc hit-area tương đương; không có focus bị che, không tràn ngang cấp trang ở 360/390/768/1024/1440 px.
- Mọi tối ưu phải giữ nguyên output KPI/rounding/totals, scope ADMIN–MANAGER–CTV, date fallback, exact/base/prefix node matching và khả năng restore.

## 8. Tham chiếu chính thức

- [Google Web Vitals](https://web.dev/articles/vitals): chỉ số và ngưỡng field, phân biệt đo lab/field.
- [Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading): hoãn client components/libraries đến khi cần. Docs online đang mới hơn Next 16.1.6 của repo; phải kiểm tra API tương thích khi thực hiện.
- [Vercel Function regions](https://vercel.com/docs/functions/configuring-functions/region): lựa chọn vùng chạy gần nguồn dữ liệu sau khi xác minh latency/placement.
- [Vercel Function limitations](https://vercel.com/docs/functions/limitations#request-body-size): giới hạn payload phải xét riêng với limit trong source.

## 9. Việc chưa xác minh

1. Function/SQL trace, cache-hit ratio và p50/p95 từ nhiều mẫu; chưa tách chính xác phần 9–10 giây của KPI.
2. Placement hiện tại của database, RTT từ Function và kết quả A/B region gần DB.
3. Query plans/index thực tế và chi phí import khi thêm index; không benchmark tải nặng trên Production.
4. Role MANAGER/CTV live, revocation session, cache consistency giữa nhiều Function.
5. Điện thoại vật lý/4G/CPU yếu, dark theme, tablet, keyboard và contrast trên mọi màn.
6. Transport file lớn, external image/iframe availability, backup snapshot consistency và restore ở database riêng.
7. Không coi JS parent-window của trang iframe là toàn bộ chi phí công cụ.
