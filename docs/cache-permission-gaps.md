# Khoảng trống quyền/cache — batch5, Task 7

## Phạm vi và kết luận

- Audit chỉ đọc ngày 2026-10-27 tại `D:/code/webkpimoi/.worktrees/ux-performance-batch1`, HEAD `1ecfa38`; primary HEAD `5193010`. Bốn nguồn auth/guard/scope/prepaid có hash bằng primary. Số dòng dưới đây thuộc working tree đang được parent/worker6 cập nhật, không phải chỉ nội dung commit.
- Không tìm thấy `AGENTS.md` ở các ancestor/root/nested liên quan, kể cả thư mục docs và staging. Chỉ xuất tài liệu này; không sửa application/tests/plan/progress, không Git mutation, không đọc .env/DB/token thật, không network/Vercel.
- **Task 7 vẫn PARTIAL**: sửa invalidation cùng process không làm JWT hiện hữu đổi quyền, không thu hồi phiên, không truyền invalidation sang process/isolate khác, không loại bỏ race của request đang chạy, không tạo singleflight.
- Parent sở hữu core cache + matrix; worker6 sở hữu mutation routes/native fixtures. Contract được giao: `invalidateCacheForMutation('cuoc'|'nodes'|'users'|'restore')`; users/restore clear toàn bộ **store `kpi-cache` trong process**; nodes/cuoc clear domain. Matrix nodes hiện gồm `node:`, `nodes:`, `map:`, **`customers:`** (`src/lib/cache-tags.ts`, `CACHE_MUTATION_PREFIXES.nodes` / `invalidateCacheForMutation`). Tài liệu này **không xác nhận hoàn tất** wiring/coverage hay thay matrix của parent.
- Trong toàn bộ tài liệu, process-clear/full-clear/clear-all chỉ việc xóa entry của store `kpi-cache` trong process tương ứng, **không** xóa mọi memo khác, rate limiter hay JWT. Nearest-node memo có hàm invalidation riêng; không được suy ra từ clear-all store.
- Map/LRU giới hạn 1.000 entry + TTL chỉ giới hạn bộ nhớ/thời gian entry. Dù đặt trên global map/globalThis, phạm vi vẫn chỉ process/isolate, không phải shared cache. Bằng chứng cache đang đọc: `src/lib/kpi-cache.ts:6`, `src/lib/kpi-cache.ts:40`.

## 1. Nguồn quyền và chuyển trạng thái

`authorize` đọc user/bcrypt lúc đăng nhập (`src/auth.ts:23`, `src/auth.ts:37`); callback chỉ chép role/id/name khi có `user` (`src/auth.ts:49`). Lần tái sử dụng hoặc `trigger: "update"` không có user sẽ giữ claims cũ; callback session chép claims, không đọc DB (`src/auth.ts:57`). Strategy JWT ở `src/auth.ts:71`.

`requireAuth` yêu cầu id/role rồi tin role của session (`src/lib/api-auth.ts:39`, `src/lib/api-auth.ts:53`, `src/lib/api-auth.ts:56`). Nhánh DB chỉ bật nếu `requireGps`, chỉ lấy GPS/managerCode/secondaryCode, không lấy role/password hay xác thực lại toàn bộ subject (`src/lib/api-auth.ts:71`). Không cached GET trong inventory dưới đây gọi tùy chọn đó.

| Thay đổi DB đã thành công | JWT cũ, kể cả sau clear store `kpi-cache` | Đăng nhập mới / điều kiện cần tách |
| --- | --- | --- |
| ADMIN → CTV/MANAGER | Vẫn ADMIN qua role guard; scope ADMIN vẫn all. | Login thật mới lấy role hiện tại. Clear cache không thay claims. |
| CTV/MANAGER → ADMIN | Vẫn role cũ, có thể tiếp tục bị 403. | Login mới mới nhận quyền mới. |
| Đổi username | id cũ nhưng name cũ; CTV scope vẫn tên cũ, MANAGER vẫn truy vấn managerCode = tên cũ. | Login mới lấy tên mới; cùng role/name thì login **không** tự clear cache. |
| Chuyển CTV giữa manager, sửa secondaryCode/GPS | Claims không chứa các thuộc tính này; scope/results/profile ở process khác có thể còn cũ. | Login manager lại với role/name không đổi vẫn trúng cùng key; cần chính sách freshness riêng. |
| User tự đổi password | Hash đổi, JWT cũ không có kiểm tra password/version. | `src/app/api/change-password/route.ts:35`, `src/app/api/change-password/route.ts:54`: chỉ lookup/compare/update rồi trả thành công; không revoke phiên. |
| Admin reset password / sửa role/name | JWT cũ không được cập nhật hay revoke bởi clear store `kpi-cache`. | Các trường update ở `src/app/api/users/[id]/route.ts`, function `PUT`; không có callback refresh subject. |
| Xóa user / restore thay user | JWT cũ vẫn có id/role/name, normal guard vẫn pass. ADMIN vẫn all; CTV vẫn self-name; MANAGER có thể còn matching CTV managerCode. | Login mới không tìm thấy user bị từ chối (`src/auth.ts:35`). Một route cần DB/FK có thể 404/lỗi; **không** khẳng định mọi thao tác đều thành công. |
| /me sau thay đổi/xóa | Cache hit có thể trả profile cũ 30s; miss lấy role DB mới hoặc 404. | `src/app/api/me/route.ts:18`, `src/app/api/me/route.ts:23`, `src/app/api/me/route.ts:33`; /me không cập nhật JWT, nên UI và API guard có thể bất đồng. |

**Giả định hiệu lực:** cookie vẫn được Auth.js giải mã/xác minh và chưa hết hạn; audit không tạo hoặc đọc cookie. App không đặt maxAge riêng; dependency cục bộ mặc định 30 ngày và có đường refresh expiry (`node_modules/@auth/core/src/lib/init.ts:71`, `node_modules/@auth/core/src/lib/actions/session.ts:50`, `node_modules/@auth/core/src/lib/actions/session.ts:71`). Vì vậy không gọi TTL cache 30s hay “30 ngày cố định từ login” là giới hạn revocation.

**Legacy cookies:** chưa có contract migration/revoke hoặc claim-version trong auth/guard. Cookie thiếu id/role bị `requireAuth` trả 401; nhiều GET chỉ kiểm tra `session` rồi dùng role/name, không dùng guard này (ví dụ `src/app/api/users/route.ts`, function `GET`; `src/app/api/customers/route.ts:23`). Không suy ra cookie cũ sẽ bị reject đồng loạt. Owner phải chốt thiếu claims thì reject/re-login hay compatibility có hạn. Sign-out chỉ xóa cookie ở client tương ứng; JWT path không có DB session để revoke (`node_modules/@auth/core/src/lib/actions/signout.ts:23`, `node_modules/@auth/core/src/lib/actions/signout.ts:35`); không phải thu hồi mọi bản sao.

## 2. Toàn bộ cached read dùng Map

Quét `getCache/setCache` trong src: **16 GET** dưới đây; cộng một GET chỉ dùng helper latest-date là CDT export. Ký hiệu: R/N = role/name của JWT; A = danh sách scope hiện tại **theo helper cache**, không phải quyền DB luôn fresh. Các tham số lọc/phân trang vẫn thuộc key; bảng tập trung phần quyền. Mỗi TTL là TTL **entry**, không phải SLA thu hồi quyền. Mọi dòng đều có thể stale dữ liệu tại process B khi mutation chỉ clear A.

| GET; nguồn key / TTL | Partition và thứ tự quyền → hit | Phụ thuộc mutation |
| --- | --- | --- |
| /api/users — `src/app/api/users/route.ts`, function `GET` (`cacheKey`, `setCache`) | R/N + roleFilter; hit trước query user/membership; không digest A. 30s. | User, restore. |
| /api/me — `src/app/api/me/route.ts:17`, `src/app/api/me/route.ts:63` | id + N/R; hit trước lookup subject. 30s. | User, restore; profile/ctvList, không refresh JWT. |
| /api/customers — `src/app/api/customers/route.ts:39`, `src/app/api/customers/route.ts:150` | R/N + searchParams; **hit trước scope** ở dòng 52, không digest A. 15s. | Customer, user/scope, mapping node, restore. |
| /api/customers/search-map — `src/app/api/customers/search-map/route.ts:29`, `src/app/api/customers/search-map/route.ts:102` | R/N + q/limit; **hit trước scope** ở dòng 53. 10s. | Customer, user/scope, restore. |
| /api/customers/map-data — `src/app/api/customers/map-data/route.ts:24`, `src/app/api/customers/map-data/route.ts:33`, `src/app/api/customers/map-data/route.ts:89` | Scope trước hit; key có R/N + A/all + flags/take. 60s. | Customer, user/scope; mapping khi includeDetails; restore. |
| /api/nodes, nhánh list — `src/app/api/nodes/route.ts:237`, `src/app/api/nodes/route.ts:251` | Chỉ auth; key chung `nodes:list`, không R/N/A. Cùng payload Node cho các user đã login là hành vi hiện tại, không tự kết luận leak. 60s. | Node positions/efficiency, restore. Các nhánh view khác không dùng Map response cache. |
| /api/node-search-map — `src/app/api/node-search-map/route.ts:32`, `src/app/api/node-search-map/route.ts:41`, `src/app/api/node-search-map/route.ts:109` | Chỉ auth; key q/limit chung, không R/N/A. 30s. | Node, restore. |
| /api/kpi/report — `src/app/api/kpi/report/route.ts:35`, `src/app/api/kpi/report/route.ts:50`, `src/app/api/kpi/report/route.ts:94` | Scope/selectedCTV check **trước** hit; key R/N + selectedCTV/date, không digest A. 60s. | KPI result/config, cước data/target, user/scope, purge, restore. |
| /api/kpi/summary — `src/app/api/kpi/summary/route.ts:59`, `src/app/api/kpi/summary/route.ts:77`, `src/app/api/kpi/summary/route.ts:269` | ADMIN/MANAGER; A/date trước hit; key R/N + A/admin + manager/group/date. Miss còn dùng prepaid scope **khác lớp** ở dòng 90. 60s. | KPI result/config, cước data/target, user/scope, purge, restore. |
| /api/kpi/manager-summary — `src/app/api/kpi/manager-summary/route.ts:30`, `src/app/api/kpi/manager-summary/route.ts:61`, `src/app/api/kpi/manager-summary/route.ts:324` | ADMIN/MANAGER; R/N + effective manager/date/group; manager tự chốt từ N, không CTV-scope digest. 60s. | Manager KPI, KPI config, user identity, restore. |
| /api/cuoc/report — `src/app/api/cuoc/report/route.ts:26`, `src/app/api/cuoc/report/route.ts:33`, `src/app/api/cuoc/report/route.ts:131` | Role gate + scope trước hit; R/N + A/admin + date query. 60s. | Cước/target, User username/secondaryCode, purge, restore. |
| /api/cuoc-cd/report — `src/app/api/cuoc-cd/report/route.ts:34`, `src/app/api/cuoc-cd/report/route.ts:53`, `src/app/api/cuoc-cd/report/route.ts:154` | Role gate + scope trước hit; R/N + A/admin + resolved date. 60s. | Cước cố định/config, User/scope, restore. |
| /api/cdt/report — `src/app/api/cdt/report/route.ts:43`, `src/app/api/cdt/report/route.ts:52`, `src/app/api/cdt/report/route.ts:202` | Role gate + scope trước hit; R/N + A/admin + filters. Admin manager filter chỉ lấy prepaid list sau hit. 60s. | CDT, User/scope/filter, restore. |
| /api/cdt/summary — `src/app/api/cdt/summary/route.ts:27`, `src/app/api/cdt/summary/route.ts:48`, `src/app/api/cdt/summary/route.ts:176` | ADMIN/MANAGER + scope trước hit; R/N + A/admin + filters; admin manager filter sau hit. 60s. | CDT, User/scope/filter, restore. |
| /api/cdt/outstanding/report — `src/app/api/cdt/outstanding/report/route.ts:111`, `src/app/api/cdt/outstanding/report/route.ts:194`, `src/app/api/cdt/outstanding/report/route.ts:355` | Prepaid scope trước hit nhưng key R/N + filters, **không A**. Scope đổi mà còn nonempty có thể trúng response scope cũ. 30s. | Outstanding record **và CDT transaction**, User/scope, restore. |
| /api/disconnect/report — `src/app/api/disconnect/report/route.ts:80`, `src/app/api/disconnect/report/route.ts:165`, `src/app/api/disconnect/report/route.ts:261` | Prepaid scope trước hit nhưng key R/N + filters, **không A**; còn nonempty không bảo đảm response được thu hẹp. 30s. | Disconnect record, User/scope, restore. |

Không gọi key R/N hoặc key có A là authorization freshness. Nhiều key không chứa stable user id/version; rename/tái sử dụng username cần policy riêng. Key có A giúp tránh hit scope cũ **khi A thực sự đổi**; không bảo vệ ADMIN role cũ hoặc helper A cũ.

### Helper cache và dependency bắc cầu

| Helper/key | TTL / evidence | Lưu ý |
| --- | --- | --- |
| `scope:ctv|role|name` | 30s; `src/lib/scope.ts:15`, `src/lib/scope.ts:26`, `src/lib/scope.ts:36` | ADMIN luôn all, CTV tự [name], chỉ MANAGER query User role=CTV/managerCode; không lookup subject. |
| `prepaid:scope|...` | 30s; `src/lib/prepaid-query.ts:26`, `src/lib/prepaid-query.ts:39`, `src/lib/prepaid-query.ts:65`, `src/lib/prepaid-query.ts:75` | ADMIN có manager filter; MANAGER bọc scope cache thêm một TTL; CTV tự name. |
| `prepaid:latest|table|R|N|manager`, `latest-user|table|ctv` | 30s, kể cả ngày rỗng; `src/lib/prepaid-query.ts:79`, `src/lib/prepaid-query.ts:115` | KpiDailyResult/CuocDailyResult/CdtTransaction; latest-user không tự auth, caller phải chặn selectedCTV. |
| Latest ManagerKpiDailyResult | 30s; `src/lib/prepaid-query.ts:191` | manager/all, ảnh hưởng manager-summary. |
| `prepaid:cuoc-config` / `cuoc-latest-ctv` | **300s** / 30s; `src/lib/prepaid-query.ts:208`, `src/lib/prepaid-query.ts:221` | KPI report/summary phụ thuộc cước; không gọi tất cả prepaid cache là 30s. |
| Nearest-node cache ngoài Map | 300s; `src/lib/nodeUtils.ts:4`, `src/lib/nodeUtils.ts:20`, `src/lib/nodeUtils.ts:42` | Customer create/update dùng nó; process-clear Map không tự xóa biến module này. |

CDT export không cache response Map nhưng chọn tháng qua latest-date 30s: `src/app/api/cdt/export/route.ts:112`, `src/app/api/cdt/export/route.ts:122`. Scope helper còn bảo vệ các read không cache như customer detail/export; chúng vẫn chịu A cũ, không chỉ 16 GET trên.

## 3. Mutation → những read phải coi là phụ thuộc

Bảng này là **dependency evidence**, không phải kết quả test matrix của parent. Chỉ sau mutation thành công mới xét invalidation cùng process; không nâng kết quả đó thành bằng chứng cho B độc lập.

**Mutation review cuối vẫn đang xử lý:** theo cập nhật parent, node matrix đã thêm `customers:` (quan sát unit RED 1 / GREEN 4, không phải kết quả test cuối); các nhánh efficiency per-row `allSettled`/partial-commit cleanup, mapping service optional committed-write callback và user fallback success flag/`finally` đang được hoàn thiện. Parent sở hữu xác nhận tests final; sidecar **chưa kết luận các root partial-commit bugs đã đóng**. Auth/JWT/scope không đổi, các gap và trạng thái Task 7 partial giữ nguyên. Sáu route ghi đang đổi được dẫn bằng file + function anchor để tránh số dòng trôi.

| Mutation / evidence | Dependent reads/helpers |
| --- | --- |
| User create/update/delete: `src/app/api/users/route.ts`, function `POST`; `src/app/api/users/[id]/route.ts`, functions `PUT`/`DELETE`; contract `src/lib/cache-tags.ts`, `CACHE_MUTATION_PREFIXES.users` | users/me, scope/prepaid, customer list/search/map, KPI/manager-summary, cuoc/cuoc-cd, CDT/outstanding, disconnect. Full clear **chỉ store `kpi-cache` trong process**, không mọi memo/rate limiter/JWT. |
| Customer create/update/delete/bulk/import: `src/app/api/customers/route.ts:272`, `src/app/api/customers/[id]/route.ts:197`, `src/app/api/customers/bulk/route.ts:27`, `src/app/api/import/route.ts:385` | Customer list/search/map; thay ctvCode làm dữ liệu của các scope đổi. Notes/history không nằm trong payload list đang cache (`src/app/api/customers/route.ts:107`). |
| Node positions/efficiency/account-map: `src/app/api/nodes/upload/route.ts`, functions `importNodePositions` / `importNodeEfficiency` / `importAccountNodeMap` | Matrix nodes gồm `node:`, `nodes:`, `map:`, **`customers:`**. Mapping còn sync Customer và thay resolved node ở customer list/map (`src/app/api/customers/route.ts:137`, `src/app/api/customers/map-data/route.ts:72`). Nearest-node là memo invalidation riêng; parent/worker6 còn xác nhận partial-commit cleanup/tests cuối. |
| KPI import/config: `src/app/api/kpi/import/route.ts:106`, `src/app/api/kpi/import/route.ts:149`, `src/app/api/kpi/config/route.ts:78` | KPI report/summary/latest; config dùng cả manager-summary (`src/app/api/kpi/manager-summary/route.ts:78`). |
| Manager KPI import: `src/app/api/kpi/manager-import/route.ts:83`, `src/app/api/kpi/manager-import/route.ts:94` | Manager-summary/latest; invalidate summary hiện có không chứng minh đây là data dependency trực tiếp. |
| Cước import/target: `src/app/api/cuoc/import/route.ts`, function `POST`; `src/app/api/cuoc/config/route.ts`, function `POST` | Cuoc report **và KPI report/summary**, prepaid latest/completion/target. Nhánh summary dùng CuocDailyResult/target ở `src/app/api/kpi/summary/route.ts:129`; report ở `src/app/api/kpi/report/route.ts:76`. |
| Cước cố định import/config: `src/app/api/cuoc-cd/import/route.ts:103`, `src/app/api/cuoc-cd/config/route.ts:58` | Cuoc-cd report; User allow-list/secondaryCode và manager/raw code cũng là dependency (`src/app/api/cuoc-cd/report/route.ts:105`, `src/app/api/cuoc-cd/report/route.ts:125`). |
| CDT import/outstanding import: `src/app/api/cdt/import/route.ts:223`, `src/app/api/cdt/outstanding/import/route.ts:191` | CDT report/summary/latest/export; outstanding có CTE CdtTransaction để xác định thu tiền (`src/app/api/cdt/outstanding/report/route.ts:210`). |
| Disconnect import: `src/app/api/disconnect/import/route.ts:162` | Disconnect report/prepaid scope; không phải JWT revocation. |
| Archive purge/cron: `src/lib/archive.ts:244`, `src/lib/archive.ts:257`, `src/lib/archive.ts:271` | Xóa KPI/Cuoc theo tháng → report/summary/latest/completion. Confirm/cancel/export chỉ metadata archive không tương đương purge dữ liệu. |
| Restore sau transaction: `src/app/api/admin/backup/route.ts`, functions `POST` / `clearRestoreCaches`; `src/lib/cache-tags.ts`, `CACHE_MUTATION_PREFIXES.restore` | Clear toàn bộ store `kpi-cache` trong process; nearest-node được invalidate bằng lời gọi riêng, không phải tác dụng của clear-all store. Memo khác/rate limiter, process khác và JWT/cookie/client cache nằm ngoài bảo đảm này. |

## 4. Vì sao process B vẫn stale / TTL không phải revocation

- A mutation → commit → clear đúng local domains/full Map: request mới ở **cùng store** không hit entry trước đó (giả định không có request cũ tái populate). B có store/nearest-node riêng, không nhận sự kiện nào từ `clearCacheByPrefix`; vẫn hit tới expiry/eviction/restart. Các TTL 10/15/30/60/300s ở trên là một tầng, **không phải** bound tổng thể.
- Timeline đã mock: B warm `scope:ctv` lúc t=0; chuyển bớt CTV nhưng vẫn còn một CTV; t=29.999s prepaid miss lấy scope cũ rồi cache thêm 30s; t=30.001s scope đã fresh nhưng prepaid vẫn cũ. `src/lib/prepaid-query.ts:65`, `src/lib/prepaid-query.ts:75`.
- Suy luận từ nguồn: response có thể được populate cuối TTL helper rồi sống thêm TTL response. KPI summary còn có thể key bằng A mới nhưng tính bằng prepaid A cũ (`src/app/api/kpi/summary/route.ts:77`, `src/app/api/kpi/summary/route.ts:90`, `src/app/api/kpi/summary/route.ts:236`). Chưa đo bound end-to-end; không hứa “tối đa 30s”.
- **Existing-request race ngay cùng process:** read miss → query snapshot cũ; mutation commit+clear; read cũ resolve → setCache lại dữ liệu cũ. Pattern get/query/set ở `src/app/api/kpi/report/route.ts:57`, `src/app/api/kpi/report/route.ts:76`, `src/app/api/kpi/report/route.ts:94`; helper có await rồi set tương tự. Đây là trace nguồn, chưa chạy barrier test. LRU/full-clear không ngăn race hay hủy response đã được phép; singleflight cũng là hợp đồng khác, không suy ra từ Map.

### Ngoài Map: HTTP/browser/PWA

- Hai asset GET có `private, max-age=60`: `src/app/api/official-documents/assets/[assetId]/route.ts:25`, `src/app/api/official-documents/assets/[assetId]/route.ts:51`; temp ADMIN ở `src/app/api/official-documents/assets/temp/[tempId]/route.ts:9`, `src/app/api/official-documents/assets/temp/[tempId]/route.ts:27`. Sửa/xóa/unpublish/expiry công văn, consume temp asset, role/password/delete/restore không xóa bản browser đã có. Mutation nguồn: `src/app/api/official-documents/[id]/route.ts:121`, `src/app/api/official-documents/[id]/route.ts:162`, `src/lib/official-doc-assets.ts:276`. Không test browser hoặc cache của URL external redirect.
- **Gap cấu hình, chưa khẳng định production đang phục vụ stale:** PWA bật ngoài development, không override runtimeCaching (`next.config.ts:4`); next-pwa lấy defaults (`node_modules/next-pwa/index.js:76`). Rule cùng origin GET /api, trừ /api/auth, là NetworkFirst/cache `apis`, 16 entry, 24h, fallback timeout 10s (`node_modules/next-pwa/cache.js:129`). Rule không có partition id/role/name. Đây có thể bao phủ cả GET không dùng Map khi service worker thực sự active; cần kiểm build/registration, thứ tự rule và fallback bằng fixture. Chỉ kiểm matcher/config offline, không kiểm browser/production; không đồng nhất 16 Map routes với toàn bộ cache client. Cache SWR/UI và dữ liệu đã tải cũng không bị server process-clear thu hồi.

## 5. Proof synthetic an toàn đã chạy

Chạy Node v24.13.1 từ approved exec `workdir C:/tmp`, code qua stdin; TypeScript transpile trong RAM, VM require chỉ allowlist mocks. Không import auth/Prisma/bcrypt thật, không gọi authorize, không cần AUTH_SECRET, không ký/in token hoặc password. URL `fixture.invalid` chỉ qua `new URL`, không fetch. Không tạo test file, không dùng it.fails/skip.

| Run | Kết quả quan sát, exit 0 |
| --- | --- |
| Callback/guard/scope/actual customer GET, 17 assertions | old ADMIN/name giữ nguyên; session update không refresh; admin guard không đọc DB; mock subject đã xóa vẫn pass, requireGps reject; fresh CTV login bị admin guard reject; legacy thiếu id bị 401. Hai VM stores: clear A fresh/B cũ; scope TTL hết nhưng prepaid vẫn cũ; actual customer cache hit không gọi scope. Tất cả boolean true. |
| Proof tối thiểu dưới đây, 5 assertions | `oldAllowed/oldNameRetained/oldRoleRetained/freshDenied/noDbRead = true`. |
| Matcher PWA thuần VM, 7 assertions | /api/me eligible, /api/auth/session excluded; GET/NetworkFirst/16 entries/24h/10s đều true. Không chứng minh SW đang active hay response đã cache. |

Giới hạn: hai VM stores mô phỏng isolation, **không** là test deployment hai process/DB thật. “Password không recheck” được chứng minh bằng đường callback/guard không lookup DB, cộng trace route chỉ update hash; không gọi mutation password thật. “Fresh login” trong proof là callback nhận fixture user mới, không kiểm credential flow. Không chạy native fixtures/suite/build của parent.

Hash nguồn proof: auth `8a1a1c7303d67f5f3d60660f62b5a235072d3a1ad6f49a577b78bd424f53e17f`; api-auth `3115659cc13cb05978a23da50fc2968b237bfdd2da95dc565881594e3467f4d6`; scope `83e2ae27048a5dd0816a84cfb2cff36e326eb3e72b7e9200c7f473d9860999af`; prepaid-query `25f84b4d3701ebdd531d5b0ada4643d0d882b2b29689247335f7bc772b30b3e1`. Core cache đang đổi đồng thời nên không dùng hash proof để attest bản cuối của parent.

### Lặp lại proof callback tối thiểu

Trong PowerShell tại C:/tmp, đưa nguyên JS sau qua here-string `@' ... '@ | node -`; chỉ cần TypeScript đã cài trong worktree. Đây là harness chẩn đoán, không phải test/fix cần thêm vào repo.

```javascript
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = "D:/code/webkpimoi/.worktrees/ux-performance-batch1";
const ts = require(root + "/node_modules/typescript/lib/typescript.js");
const context = vm.createContext({});
function load(relative, mocks) {
  const source = fs.readFileSync(root + "/" + relative, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true
  }}).outputText;
  const module = { exports: {} };
  const requireMock = name => {
    if (!Object.hasOwn(mocks, name)) throw new Error("Unmocked dependency blocked");
    return mocks[name];
  };
  vm.runInContext("(function(require,module,exports){" + compiled + "\n})", context)(
    requireMock, module, module.exports);
  return module.exports;
}
let config, currentSession, reads = 0;
const prisma = { user: { findUnique: async () => { reads++; return null; } } };
load("src/auth.ts", {
  "next-auth": value => { config = value; return {}; },
  "next-auth/providers/credentials": value => value,
  "./lib/prisma": { prisma }, "bcryptjs": {}
});
const guard = load("src/lib/api-auth.ts", {
  "@/auth": { auth: async () => currentSession }, "@/lib/prisma": { prisma },
  "next/server": { NextResponse: { json: (_, init) => ({ status: init?.status ?? 200 }) } }
});
(async () => {
  const claims = config.callbacks.jwt({ token: {},
    user: { id: "fixture-id", name: "fixture-old", role: "ADMIN" } });
  currentSession = config.callbacks.session({ session: { user: {} },
    token: config.callbacks.jwt({ token: claims, trigger: "update",
      session: { user: { name: "fixture-new", role: "CTV" } } }) });
  const oldAllowed = (await guard.requireAuth({ roles: ["ADMIN"] })).errorResponse === null;
  const oldNameRetained = currentSession.user.name === "fixture-old";
  const oldRoleRetained = currentSession.user.role === "ADMIN";
  const fresh = config.callbacks.jwt({ token: {},
    user: { id: "fixture-id", name: "fixture-new", role: "CTV" } });
  currentSession = config.callbacks.session({ session: { user: {} }, token: fresh });
  const freshDenied = (await guard.requireAuth({ roles: ["ADMIN"] })).errorResponse.status === 403;
  const result = { oldAllowed, oldNameRetained, oldRoleRetained, freshDenied, noDbRead: reads === 0 };
  for (const value of Object.values(result)) assert.equal(value, true);
  console.log(JSON.stringify(result));
})().catch(() => { console.error("Synthetic assertion failed"); process.exitCode = 1; });
```

## 6. Follow-up giới hạn, chưa triển khai

| Owner / ưu tiên | Quyết định hoặc bằng chứng cần thêm để đóng gap |
| --- | --- |
| Auth/security — P0 | Chốt demotion/delete/password reset/self-change phải revoke lúc nào, subject/role lấy từ đâu và legacy-cookie thiếu claims xử lý thế nào. Acceptance riêng: old ADMIN bị chặn sau demotion/delete/reset; fresh login dùng role mới; /me và guard nhất quán. Không coi force UI re-login hoặc clear Map là server revocation. |
| Cache/runtime — P1 | Chốt freshness SLA cho process/isolate độc lập; chứng minh A mutate/B read bằng fixture hai stores/process, cả scope shrink/grow, username/secondaryCode, restore. Local matrix chỉ đánh dấu SAMEPROCESS sau success; failure/no-op theo contract parent, không suy ra shared invalidation. |
| API/auth — P1 | Chốt policy request đã được phép trước mutation: có cho hoàn tất không, và có được populate cache sau clear không. Thêm barrier proof có kiểm soát và case concurrent miss riêng; không gộp race, invalidation và singleflight thành một bảo đảm. |
| Web/PWA — P1 | Chốt dữ liệu private có được offline/timeout cache và giữ sau đổi tài khoản/logout không; kiểm hai asset TTL và matcher PWA bằng fixture/browser khi được phép. Không triển khai/deploy trong sidecar. |

**Điều kiện ghi tiến độ trung thực:** chỉ đóng phần local bounded cache/invalidation mà parent có test chứng minh; giữ Task 7 partial cho JWT freshness/revocation, legacy-cookie transition, independent-process invalidation, existing-request race và browser/PWA policy cho tới khi có quyết định + bằng chứng riêng.
