# Khách hàng: giữ dữ liệu khi tải lại và phân biệt lỗi với kết quả rỗng

Checkpoint55, 30/10/2026; tiếp Task11 của roadmap. Chỉ local, chưa commit/push/deploy. Giữ giao diện chính, nghiệp vụ và phân quyền.

## Kết quả cho người dùng

- Đổi trang/bộ lọc không thay kết quả đang xem bằng skeleton nếu đã có dữ liệu. Trong lúc chờ, có dòng “Đang cập nhật danh sách” và nhắc rõ dữ liệu cũ có thể chưa khớp bộ lọc/trang vừa chọn.
- Phản hồi bắt đầu ngay trong khoảng debounce, không chờ fetch mới bắt đầu. Giữ nguyên delay500ms cho search và300ms cho6bộ lọc còn lại.
- Lỗi tải lần đầu hiện “Không tải được danh sách khách hàng” và nút “Thử lại”, không giả thành “Chưa có khách hàng”.
- Lỗi cập nhật giữ rows đã có, hiện “Chưa cập nhật được danh sách” và cho thử lại với cùng filter/page/limit. Không đưa chi tiết lỗi backend ra UI.
- Một phản hồi rỗng đã tải thành công vẫn là dữ liệu: pending hoặc lỗi filter mới không được khẳng định “Không tìm thấy khách hàng”. Empty-state hiện có chỉ xuất hiện khi đã hết chờ và không lỗi.
- Vùng danh sách có named region/aria-busy. Status/error nằm ngoài vùng busy; không thêm thông báo tải thành công chỉ dựa vào pageprop.

## Nguyên nhân đã xác minh

Installed SWR2.4.1 giữ laggy data khi `keepPreviousData:true`; nhưng request key mới chưa có cache vẫn có thể `isLoading:true`. Hook cũ trả `loading: isLoading || (isValidating && !data)`, khiến page chọn skeleton dù rows cũ còn trong hook. Page cũng không lấy `error` từ hook, nên có thể hiển thị empty-state khi request thất bại hoặc không thông báo lỗi cập nhật.

Đã tái hiện bằng hook/page/SWR thật trong RTL với deferred fetch giả, không chỉ mock sẵn giá trị `loading`. Không suy đây là lỗi SQL, database hoặc tốc độ network production.

## Thay đổi và giới hạn phạm vi

| Phần | Thay đổi | Giữ nguyên |
|---|---|---|
| `useCustomers.ts` | Derive `hasData`, so sánh đủ7raw/debounced filters; `loading` chỉ khi chưa có data; `refreshing` khi có data và đang validating/chờ debounce | Fetcher/error message, API URL/params, delays, SWR options/cache/mutate, page/limit/reset/selection/fixedFilters |
| Customer page | Status strip, error/retry, named busy region, chặn false-empty khi pending/error | Table/modal/CRUD/import/export/URLs/filter chips/options/permissions/row handlers/pagination |
| Retry | Manual retry guard theo page/limit/filter identity; attempt identity không cho finally cũ xóa guard mới; consume rejection vì hookerror hiển thị kết quả | Không clear filters/data, không success toast, không tự thêm retry policy hoặc timeout |
| CSS | Chỉ `.queryStatus`, `.queryStatus > svg`, `.queryError button`; nút retry min44×44px | Mọi selector/rule cũ, globals, header53, pagination54, breakpoints/theme/fonts |

Chỉ một production caller của hook là trang khách hàng. Ba menu không dùng vẫn ẩn. Không URL hóa filter hoặc thay auth/API/database/config/dependency trong batch này.

## TDD và race đã kiểm

File mới `tests/ui/customer-query-feedback.test.tsx` dùng realSWR, realhook/page/AsyncState/table/pagination. Chỉ mock session/router/currentUser và transport fetch. Cache Map riêng mỗi test, tắt automatic error retry trong wrapper test để điều khiển thời điểm; **không đổi retry policy production**. Fake timers chỉ điều khiển debounce, không đổi deadline/pool/config dự án.

- Ban đầu22test: **RED21fail/1pass → GREEN22/22**. Có bằng chứng loading vẫn true dù previous rows còn, thiếu refreshing/error feedback và false-empty.
- Thêm case retry filterA còn pending, chuyển filterB bị lỗi rồi thử lại: guard boolean ban đầu chặn sai requestB. **RED1fail/22pass → GREEN23/23** sau guard theo context/attempt; completionA không thay rowsB hoặc bỏ busyB.
- Kiểm initial/empty success,7debounces và query value verbatim, page-key transition, cachedempty, manual refreshfail, stale reply không đè page mới, limit/reset/selection/includeTotal/fixedFilters và3roleprops.
- Page kiểm giữ cùng row DOM khi chờ, không skeleton/false-empty, status ngoài busy region, HTTP/network initialerror, giữ filter/rows và retry dedupe trước rerender. Đây là role props giả, không auth/server-permission E2E.

## Kiểm tra Chrome và hit-area

SSR từ page/components/CSS thật, query/session props giả; không SWR/network/hydration/Next build trong browser. Lifecycle đã được kiểm riêng bằng RTL realSWR, không dùng SSR thay nó.

- 6states: idle, initial-loading, initial-error, stale-error, refreshing, debounce-empty.
- 6width360/390/768/769/1024/1440×2theme×6states=72mẫu; thêm24mẫu rootfont200% ở390/1440: **96mẫu/lượt**,48mobile/48desktop-tablet.
- Browserv1 lỗi thiết lập router alias,0case; giữ report riêng, không gọi appRED.
- Browserv2 chạy đủ96case, phát hiện24retry-target failures ở font100%: nút390 cao40.796875px. Giữ candidate/review/QA/hashes v1; v2candidate chỉ thêm error class và2min44declarations. Không nới ngưỡng, bớt case hoặc đổi global button styles.
- Browserv3 đạt96/96 geometry/state, nhưng ảnh chụp lúc animation `slideUp350ms` còn đang chạy nên bị mờ. V4 chờ finite animations thực sự kết thúc (không sleep tùy ý hoặc tắt CSS), bỏ qua spinner vô hạn; thêm assert container opacity1/transformnone. V3 không dùng làm nghiệm thu ảnh cuối.
- V4 trên worktree và primary chạy riêng **96/96 mỗi lượt**: text ngang vừa box, feedback trong viewport, retry nằm trong error panel và≥44×44px, named busy/state/rows đúng, không false-empty/raw backend detail/page overflow hoặc pageerror/request ngoài trong fixture. Parent đã xem ảnh V4 initialerror390/font100 và refreshing390/font200 sau animation; không dùng ảnh V3 mờ làm kết luận màu sắc.
- Rootfont scaling không phải browser zoom/thiết bị thật. Không tuyên bố fulltext mọi field, native select popup, focus/screen-reader/axe hoặc whole-app visual acceptance từ fixture này.

## Gate hiện tại

| Kiểm tra candidate v2 | Worktree | Primary |
|---|---|---|
| Scoped tests | 50file/842test đạt | 50file/842test đạt |
| Read-only policy | 22/22 đạt | 22/22 đạt |
| TypeScript không incremental | Đạt | Đạt |
| ESLint src + test mới | 0error/3warning cũ | 0error/3warning cũ |
| ChromeV4 SSR | 96/96 đạt | 96/96 đạt |

Không cộng test giữa các lượt; đây không phải full native suite. Focused/SSR/static reviewer không thay QA primary. Ba warning cũ thuộc map ref cleanup, biến uploadNode0TB và import uploadnodes; không sửa ngoài phạm vi để xóa warning.

Review static độc lập spec trước quality APPROVE candidatev2 đúng4hashes, không finding actionable. Static approval không ghi đè Chromev2 failures; mỗi source revision có frozen hashes/QA riêng. Exact-scope chứng minh query/debounce/oldCSS/CRUD/permission code không thay ngoài phạm vi nêu trên.

## Known limitations và bước sau

- Status strip/error panel có thể làm thay đổi chiều cao trang khi xuất hiện; **chưa nghiệm thu CLS** hoặc latency. Không giả số ms cải thiện tốc độ từ test state/CSS.
- Tổng và chỉ số trang có thể thuộc dữ liệu lần trước trong lúc chờ; dòng cảnh báo nói rõ, không khẳng định query mới đã hoàn tất. Không đổi các tác vụ/selection nghiệp vụ khi pending.
- Giữ API JSON contract hiện có, không bổ sung runtime payload validation hoặc sửa out-of-range/empty-page business rules.
- URL whitelist/back-forward/filter context chưa làm; real app hydration, auth/session changes/cache isolation, real database/API/performance/RUM, mobile device, keyboard/screen-reader acceptance vẫn riêng.
- Original auth timeout50 chưa có root cause; trace51 chưa tái hiện. QA mới nếu đạt không biến original failed log/manifest thành pass. Native Windows/libSQL/KPI-timeout/Node0TB visual-timing/Task10/full Task11/release vẫn mở, `releaseReady:false`.

Bước nhỏ tiếp theo: URL hóa filter/page/view theo whitelist và kiểm browser back/forward; cần design/test riêng, không gộp vào batch55.

## Evidence và an toàn

- App3files/test1file nêu trên; guide này, plan `docs/superpowers/plans/2026-10-30-customer-query-feedback-local.md`, roadmap Task11 và append55 `tiendokpi.md`: tổng8owned paths.
- Private evidence `.local/performance/customer-query-feedback-20261030/`: snapshot/preimages, RED/GREEN/race logs, archivedv1/review/QA/frozen4hash-v1-v2, exact-scope, browserv1-v4 JSON/HTML/PNG, scans/backups/integration/final manifests khi hoàn tất.
- Snapshot483union paths/356source-config-test paths,163dirty và1396artifact cũ; source/docs integration có preimage/backup, default secret scan/whitespace và final hash/inventory guards, progress append-only. Không sửa tests cũ, app khác/env/DB/auth/deps/config hoặc dùng BUILD_ID cũ làm build mới. Giữ rawfailedauth50 và old gates.
- Không commit env/DB/token/log/business data; chưa branch/commit/push/deploy.
