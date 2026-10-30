# Shared current-user request — local batch 8

## Phạm vi và quyết định

Slice shared `/api/me` trong Task 5, tiếp nối batch 6–7 local. Mục tiêu là bỏ request **đang chạy trùng nhau**, không thay đổi nghiệp vụ/GPS/CTV hoặc thêm cache quyền trên client. Không đổi API, auth callbacks/JWT, SQL/schema, dependency hoặc UI nhận diện.

- Broker thuộc authenticated dashboard/provider và identity id/name/role; không global singleton, localStorage hoặc TTL client. Provider không tự fetch khi chưa có consumer.
- Mỗi consumer có lifecycle/abort riêng. Một consumer đóng không hủy request người khác; hết consumer hoặc scope cũ thì hủy/evict pending entry. Late completion/cleanup không được chạm replacement hoặc subject mới.
- Chỉ parse JSON một lần cho request dùng chung. Promise xong, kể cả lỗi, bị loại: mở lại modal sau khi request hoàn tất **vẫn GET server**, không hứa giảm request cho thao tác tuần tự.
- Payload phải đúng id của session đã xác thực. Không dùng dữ liệu subject B trong khoảng client session vẫn A. Initial loading chưa có session/logout không fetch hoặc hiển thị dữ liệu cũ; revalidation cùng identity với data đã xác thực còn giữ lại không được tạo request chỉ vì object/expires/status loading đổi.
- Active consumers revalidate trên visibility-visible/online/refresh; không auto-retry loop. Server vẫn xác thực và kiểm tra quyền như trước; HTTP/network/JSON failure không trở thành dữ liệu thành công/cache.
- Chuỗi thực thi: `Providers` → `CurrentUserProvider` / `useCurrentUser` → `CurrentUserRequestBroker` → GET `/api/me` → `auth()` + cache hiện có + Prisma `User`. Các file tương ứng: `src/components/Providers.tsx`, `src/hooks/useCurrentUser.tsx`, `src/lib/current-user-request.ts`, `src/app/api/me/route.ts`.

## Contract từng consumer

| Consumer | Dữ liệu và hành vi giữ nguyên |
|---|---|
| Khách hàng | CTV filter dùng `me.ctvList`; bỏ GPS state không được UI sử dụng, không sửa query danh sách/mutation khách hàng. |
| Modal khách hàng | Sau me thành công: `role === ADMIN || canUseGps === true || !!customer`; giữ ngoại lệ sửa khách hàng hiện có. Trước thành công/lỗi refresh không bật GPS. Dropdown Admin/Manager **vẫn đọc `/api/users`**, không thay bằng me.ctvList. Form/save/history giữ nguyên. |
| KPI | Chỉ Admin/Manager cần me để khởi tạo CTV, CTV không gọi me từ KPI. Chọn CTV hợp lệ đang có hoặc phần tử đầu; scope mới không được phát report với selected/debounced CTV của scope cũ khi me còn pending. Các panel không dùng CTV này không bị chặn thêm. |

## Baseline và kiểm chứng

Snapshot 386 file, 314 source/config/test khớp checkout; giữ 12 thay đổi local batch 6–7. Chrome baseline ADMIN/MANAGER/CTV × desktop/mobile trên fixture fake: giữ pending request trang customers khi mở modal có **2 GET me**, focus có **2 GET me**, mở lại tuần tự thêm **1 GET**. KPI mỗi ca có 1 report; me KPI Admin/Manager 1, CTV 0. GPS visibility, CTV options, `/api/users`, me/report JSON hashes và schema/data fake được ghi riêng tư.

TDD trên caller gốc và fallback test-only không chia sẻ: **38 fail/6 pass (44)**; final không giữ fallback hoặc mock broker/hook. Mở rộng thêm race/StrictMode/failure tests và non-array CTV refresh (**51 pass/1 fail** trước sửa guard). Spec review bắt hai P2: refresh cá nhân trong khoảng debounce còn gửi CTV đã bị loại; window focus khi document vẫn visible chưa revalidate. Regression review **2 fail/51 pass → 53/53**, all UI **169/169 qua 18 suite**, spec đã re-approve. Không nới assertion test cũ; chỉ bổ sung id/status chính xác cho mock.

Candidate sau spec đạt **59 file / 693 test + 22 policy**, TypeScript/build đạt, login static, lint 0 error/2 warning ở hai upload route không sửa. Quality review bắt tiếp continuation import chậm còn giữ callback CTV cũ khi list đã đổi; regression **2 fail/54 pass → 56/56**, all UI **172/172 qua 18 suite**. Import dùng callback committed mới nhất và guard identity, giữ latest-date intent; không sửa hook calculator. Các QA/Chrome trước fix được lưu riêng, không dùng để chứng minh candidate cuối. Full QA/Chrome/primary cuối ghi theo thực thi tại mục 25 `tiendokpi.md`. Evidence `.local/performance/batch8/`; không đưa SQLite/env/credentials/cookies/business bodies vào Git. Harness giữ log thất bại, KPI cold dùng context sạch để tách focus event của trang trước khỏi startup.

Checkout candidate cuối đạt **59 file / 696 test + 22 policy**, TypeScript/build đạt, login static; lint 0 error/2 warning cũ. Browser report cuối gắn build ID và mười source/test hash để không dùng nhầm kết quả candidate trước.

Chrome candidate cuối: cả sáu ca customers/modal đồng thời **2→1 GET me**, mở lại tuần tự vẫn thêm **1**; focus đo riêng sau reopen hoàn tất có **1 GET**. GPS visibility/options và users/me/KPI payload hashes khớp baseline; KPI vẫn 1 report/ca, Admin/Manager me 1, CTV me 0. DOM login/logout ba role đạt, không JavaScript error/ghi nghiệp vụ; schema/data fake không đổi, preview riêng đã dừng. Hai review spec/quality đều duyệt candidate cuối; integration/QA primary ghi tại mục 25 tiến độ.

Runner final tắt Vite env-file discovery (`envDir: false`); build/preview riêng chỉ dùng env fake và harness chặn đọc đúng các tên env ở root worktree, không di chuyển/sửa env file. CLI RED/GREEN đầu của worker dùng config Vitest mặc định trước khi thêm hàng rào này: không yêu cầu/hiển thị nội dung env, nhưng **không khẳng định** những lượt đầu đã tắt implicit discovery. Test nhãn field khách hàng đồng bộ còn cảnh báo React act khi request async settle; không suppress warning hoặc làm yếu assertion.

## Giới hạn

- **Gate primary còn mở:** đã tích hợp local, nhưng full suite primary chỉ hoàn tất 58/59 file và 694/696 test trước native worker exit `3221225477` (`0xC0000005`) ở `tests/integration/kpi-report-equivalence.test.ts` không sửa. Giữ log `primary-tests.log`/status fail; không retry hoặc skip file để đổi thành xanh. Root cause chưa xác minh, không nói crash đã sửa. Full checkout/build/Chrome đạt không thay cho full primary. Follow-up UI/policy/types/lint và byte-compare có bằng chứng riêng, không phải full-suite pass.
- Không có settled-cache: modal mở sau khi response xong vẫn cần server; đây là lựa chọn correctness, không phải bug dedupe.
- Revalidate active hook trên focus có thể thêm một GET ở view trước đây chỉ đọc me lúc mount, như KPI. Không hứa mọi tương tác đều ít request hơn; mục tiêu là không trùng in-flight và vẫn kiểm tra quyền/danh sách với server.
- Harness focus sau sửa đợi reopen response hoàn tất trước khi đo riêng focus. Diagnostic ban đầu đo delta 0 vì focus đã coalesce đúng vào reopen đang pending (2 request nhưng mới 1 body xong), không phải app bỏ refresh. Giữ các log lỗi; không dùng cửa sổ focus khác nhau để tuyên bố giảm latency. Phép đo concurrency ban đầu dùng cùng gate trước/sau.
- API `/api/me` đang có cache 30s; batch này **không** làm permission/JWT revocation tức thì. Permission-version, invalidation đa instance, single-flight server và in-flight cache-refill gaps vẫn còn trong `docs/cache-permission-gaps.md`.
- Không sửa nguyên nhân `/api/me` 500 từng thấy ở rollout batch 5, không truy cập Production/DB thật hoặc đo cloud p95/Core Web Vitals.
- Batch 6–8 local chưa commit/push/deploy; không gọi toàn roadmap hoặc đợt 2 hoàn tất.
