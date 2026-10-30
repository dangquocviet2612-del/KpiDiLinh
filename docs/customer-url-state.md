# Khách hàng: URL bộ lọc, deep link và Back/Forward

Checkpoint56,30/10/2026; tiếp Task11, local only. Implementation không đồng nghĩa acceptance/release đã xanh. Không commit/push/deploy.

## Người dùng nhận được

- URL lưu từ khóa,6bộ lọc, trang và số dòng; reload hoặc mở lại link khôi phục đúng query trước khi fetch đầu tiên.
- Nhận link `/customers?q=...` vốn đã được node map tạo; trước đây hook không đọc q. Canonical key là q; nhận search legacy khi không có q.
- User edit search vẫn debounce500ms, các filter khác300ms; URL chỉ ghi khi các filter đã ổn định, không ghi từng ký tự. Page/limit là intent riêng; đổi filter/limit vẫn resetpage1 như cũ.
- Back/Forward khôi phục đồng thời rawfilters/page/limit và request seed; không fetch query trộn cũ/mới hoặc echo thành historyentry mới. History restore không phải user edit nên không chờ debounce trước query đúng.
- Feedback/previous rows/error-retry của55 và mọi layout/CSS/card/pagination trước đó giữ nguyên.

## URL contract

| Key | Quy tắc |
|---|---|
| q/search | q ưu tiên kể cả rỗng; search chỉ fallback khi q vắng. Giữ nguyên Unicode, khoảng trắng, literal plus; URL-encode, không trim |
| page | Chuỗi số nguyên dương; cap10000 theo API hiện có. Sai/duplicate về1 |
| limit | Chỉ10/20/50/100; sai/duplicate về10 |
| subscriberType | FIXED/MOBILE hoặc rỗng |
| billingType | PREPAID/MONTHLY hoặc rỗng |
| prepaidPeriod | 3/6/12 hoặc rỗng |
| expirationFilter | soon/expiringThisMonth/expired hoặc rỗng |
| status | Hoat dong/Roi mang hoặc rỗng, đúng optionvalue hiện tại |
| ctvCode | Text giữ nguyên; fixedFilters của caller luôn thắng URL/user edit |

Duplicate key được coi là ambiguous và về default của key đó, không chọn ngẫu nhiên first/last. Unknown params/hash đang có được giữ khi ghi URL nhưng **không đưa vào filter/API controls**; includeTotal vẫntrue, URLrole/owner không cấp quyền. Defaults page1/limit10/emptyfields được bỏ khi user ghi URL; không tự canonicalize/push khi chỉ mount hoặc pop.

URL search có thể chứa tên/SĐT/account do người dùng nhập. Không log/queryanalytics hoặc tự share link; người dùng cần kiểm tra URL trước khi gửi cho người khác. URL không phải nơi lưu token/mật khẩu.

## Kiến trúc và source scope

- `src/lib/customer-query-state.ts`: pure types/defaults/parser/serializer whitelist.
- `src/hooks/useCustomerQueryState.ts`: opt-in state/history cho `/customers`, restore sau hydration, ready flag, source/revision/requestseed và guards no-op/path/history-error.
- `src/hooks/useCustomers.ts`: dùng controller, gate SWRkey tới ready, per-field memoized debounce payload mang revision. Khi payload cũ chưa bắt kịp restore, request dùng frozen restored-value, **không dùng raw useredit mới để bypass debounce**.
- Customer page chỉ đổi một dòng thành `useCustomers({syncUrl:true})`. Consumer plainhook mặc định opt-out; re-export CustomerFilters giữ import compatibility.
- Native pushState(null) đi qua patch công khai của installedNext app-router; không tự sửa private flags/tree hoặc dùng router.push gây navigation/RSC mỗi filter. Không gắn global history patch riêng.
- API URL construction/fetcher/SWRoptions/selection clearing/refresh semantics/CRUD/auth/backend và mọiCSS/shared useDebounce giữ nguyên. Chỉ5source-test files +4docs (9owned paths).

Nếu browser từ chối history write, state/filter vẫn dùng được và không throw crash; URL có thể chưa lưu, hiện chưa có thông báo riêng. Không viết lại URL sau khi đã rời `/customers` hoặc sau unmount. Không scope sang URLview của KPI trong batch này.

## TDD và giới hạn kết luận

`tests/ui/customer-url-state.test.tsx`: realhook/page/SWR, deferred synthetic fetch, cache riêng, chỉ mock session/router/currentUser/transport. Fake timers điều khiển debounce; no oldtests/config/deadline/pool changes.

- RED đầu49test có15fail/34pass gồm một test mới resolve nhầm request vì giả định URL đã seed; timeout5000 và actpollution được giữ log, **không phải authfailure50**. Thêm precondition để test dừng đúng ở thiếu hydrate; correctedRED50:13fail/37pass.
- GREEN đầu gặp giả định test sai: set cùng filter ởpage2 vẫn phải resetpage1 theo code cũ, nên phát sinh request hợp lệ. Strong request-count probe xác minh nguyên nhân, không sửa app để né reset; chỉ sửa case no-op vềpage1 và thêm preservationcase page2→1.
- Thêm reorder-history regression:52test RED1fail/51pass vì noop page tạo entry chỉ để sắp thứ tự params; controller giữ state khi thực sự no-op, nhưng vẫn resetpage khi cần. **FinalGREEN52/52**.
- Kiểm initialquery đúng một fetch/no delayedfollowup, q/legacy/empty precedence/Unicode, enum/duplicate/numeric/unknownflags, fixedfilter, optout, page/limit/selection, refresh, popstate, edit/restore races, leave/unmount/historyrefusal và SSR không đọc window/fetch.
- RTL popstate là synthetic traversal; không tự gọi đó là native browser Back. SSRrenderToString kiểm initialcontract, không thay fullNext hydration acceptance.

## Browser riêng

Isolated Vite client mount dùng page/hook/SWR thật, synthetic session/API; native Chrome Back/Forward/reload. Không NextAppRouter/SSR hydration thật hoặc connected DB/API. Không lấy roleprops làm chứng minh quyền server.

V1 chưa mount được app vì private optimizer thiếu react-dom root export createPortal;12scenario timeout và12moduleerrors giữ riêng. Đây là harness/prebundle failure, không có bằng chứng app chạyNext bị lỗi tương tự. V2 chỉ thêm react-dom vào dependency prebundle và failfast khi bootstrap lỗi, không sửa app/assertion/deadline hoặc bỏ case.

Worktree và primaryV2 chạy riêng đều đạt **12/12scenario mỗi root**,3roleprops×390/1440×light/dark; mỗi scenario11steps (132steps/lượt) deep link/reload/search/page/limit/Back2/Forward2/reload/back-during-edit. Không unfiltered initial request, unknownparams không forward, hash/from giữ; không obsolete edit xuất hiện trong recordedAPI,0pageerror/requestngoài. RTLadvance500ms kiểm late-debounce fence riêng, không suy mọi thời điểm tương lai từ browser snapshot. Parent xem PNG390/1440 sau finite animation có sẵn kết thúc. Không dùng fixtureclient thay fullapp/Next router smoke/SSRhydration, broadgate hoặc tốc độ production.

## Gate chưa hoàn tất

**Worktree và primary broad QA đều đỏ: mỗi root893pass/1fail trên894test**, cùng lỗi `GET users returns401 without schema or database access` timeout5000ms trong `schema-auth-order.test.ts`. Policy22, TypeScript nonincremental đạt, ESLint0error/3warning cũ ở mỗi root. Focused52/52/staticreview không thay gate này. Rootcause chưa chứng minh; không retry broad cùng source đến khi xanh, skip/quarantine hoặc tăng timeout. Primary chạy fresh sau sourcechange, không phải rerun worktree để ép xanh; cả hai failedlogs giữ riêng.

Đã lưu source local có preimage/backup/defaultscan/whitespace và inventory guards, nhưng **chỉ lưu implementation với pending acceptance, không waive failure**. Cả hai broadgate hiện false; `currentBatchScopedAcceptancePassed:false`, `releaseReady:false` cho tới khi gate thực sự giải quyết. Guard chỉ chấp nhận disposition pending khi đúng một lỗi auth nêu trên và các kiểm tra khác đạt; không đổi exit1/failure thành success.

Original authfailure50/trace51, native Windows/libSQL/KPI-timeout/Node0TB visual-timing và fullTask11/production gates vẫn riêng. Không gọi relativeURL/whitelist là authfix. Cần ưu tiên điều tra timeout đang tái hiện thay vì tiếp tục thêm UI để lờ gate.

## Evidence

Snapshot486union paths/357source-config-test paths,167dirty và1528oldartifacts; source/docs scans/whitespace/backups/hash/inventory/HEAD/index guards kiểm9ownedpaths, progress append-only. Không dùng BUILD_ID cũ làm build mới. Private evidence `.local/performance/customer-url-state-20261030/` lưu preimages/RED/GREEN/requestprobe/frozen5hash/QA/nativebrowser/scans/backups/review/scope/pending/final manifests; final preservation check không phải acceptance xanh, pending manifest giữSHA hai authfailure mới. Public docs không chứa token/env/DB/log hoặc business data. Plan cùng ngày, roadmap Task11 và mục56 `tiendokpi.md` cập nhật trạng thái thật, không tick toàn Task11.
