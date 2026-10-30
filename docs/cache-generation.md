# Generation fence cho cache — local 28/10/2026

## Phạm vi

Slice tiếp theo của Task 7, sau invalidation matrix/cap/LRU của batch5. Không đổi auth/JWT policy, SQL, TTL, key, status/body, schema, dependency hoặc công thức. Chỉ kiểm thử local bằng mock/fixture và database env giả; không yêu cầu/in env thật, không tự push/deploy. Chi tiết env-file discovery của runner được ghi riêng trong checkpoint tiến độ, không suy ra mọi child process ban đầu đều đã chặn đọc file ngầm.

Lỗi trước sửa: read bắt đầu → mutation commit và clear cache → read cũ hoàn tất và ghi cache lại. Nó có thể đưa profile/scope/report cũ vào những request tiếp theo, hoặc ghi đè giá trị mới vừa được nạp.

## Contract

1. `src/lib/kpi-cache.ts` giữ một `Symbol` generation của module/store trong process. `getCacheGeneration()` trả token hiện tại, không tạo entry phụ theo key/prefix.
2. Mỗi `clearCacheByPrefix(prefix)` đổi token, kể cả store rỗng hoặc không có entry khớp. Việc xóa settled entries vẫn chỉ áp dụng prefix cũ; unrelated settled entries không bị clear.
3. Mọi function production ghi store lấy token ở **câu lệnh đầu tiên**, trước await auth/scope/date/schema/query. `setCache(key, value, ttl, token)` từ chối token cũ **trước bất kỳ mutation nào**, kể cả invalid-TTL delete, prune và LRU eviction.
4. Token được dùng cho mọi nhánh ghi của function, không lấy lại ngay trước setter. Một invalidation bất kỳ sẽ fence tất cả ongoing fills, kể cả prefix khác: chọn bảo thủ để tránh quản lý tombstone tăng không giới hạn. Đánh đổi có thể là cache miss tiếp theo, chưa benchmark hit-rate Production.
5. Dạng `setCache` ba tham số giữ tương thích cho seed/test; không được dùng làm production writer. AST regression kiểm inventory và wiring.

Giữ cap 1.000 entry/process, LRU, TTL và error semantics. Không thêm cache cho response lỗi hoặc query mới. `Server-Timing` và guard thứ tự cũ giữ nguyên ngoài thao tác lấy token đồng bộ.

## Các đường được fence

| Domain | Entry point / helper |
|---|---|
| Tài khoản và phân quyền scope | `/api/me`, GET `/api/users`, `getAccessibleCtvCodes` |
| Khách hàng/bản đồ | GET `/api/customers`, `/api/customers/map-data`, `/api/customers/search-map` |
| Node | GET `/api/nodes`, `/api/node-search-map` |
| KPI | GET `/api/kpi/report`, `/api/kpi/summary`, `/api/kpi/manager-summary` |
| Cước/CDT/rời mạng | GET `/api/cuoc/report`, `/api/cuoc-cd/report`, `/api/cdt/report`, `/api/cdt/summary`, `/api/cdt/outstanding/report`, `/api/disconnect/report` |
| Scope/metadata prepaid | Mọi function gọi `setCache` trong `src/lib/prepaid-query.ts`, gồm scope, latest-date, target-rate và completion |

Tổng cộng 18 caller files (16 GET routes và hai helper modules), ngoài core store. Đây chỉ là store `kpi-cache`; không phải cache của Next/PWA/React/SDK khác.

## Regression và kiểm chứng

- `tests/unit/cache-read-generation.test.ts`: actual GET me với deferred auth/DB, fresh replacement, missing/error profile, manager scope, nested prepaid scope, latest-date và core generation/TTL/LRU behavior. Test mock auth/DB, không mock core cache.
- `tests/unit/cache-generation-wiring.test.ts`: TypeScript AST đối chiếu inventory toàn `src`, mọi setter có token thứ tư, owning function capture const tại entry. Đây là structural guard bổ sung, không thay runtime race tests.
- RED trên nguồn cũ: **14 assertion failures / 4 pass**; fallback mô tả API cũ chỉ tồn tại ở test source RED lưu riêng, không giữ trong test cuối.
- Các test cache/invalidation/timing/schema-auth/readonly cũ vẫn phải giữ assertions/key/TTL/payload/guard. Mock thêm token export không được nới ba tham số cũ.
- Kết quả QA candidate và primary, review/hash/secret scan theo mục 27 `tiendokpi.md`. Evidence private `.local/performance/cache-generation-20261028/`; không đưa log/SQLite/env/token/credentials vào Git.

## Không được suy ra

- **Không thu hồi quyền/session/JWT.** Profile/role claim cũ hoặc scope key thiếu permission version vẫn là gap riêng. Không hứa revoke sau đổi role/manager/password/delete.
- **Không hủy response đang chạy.** Original request có thể trả snapshot cũ; chỉ ngăn snapshot đó publish thành cache hit về sau sau invalidation cùng process. Không phải transaction isolation mới.
- **Không invalidation nhiều process/isolate.** Token chỉ bảo vệ đúng module/store nhận clear. Nếu mutation đi process A còn reader/cache ở B thì không có signal dùng chung.
- **Không single-flight.** Hai miss cùng generation vẫn có thể query song song/ghi theo thứ tự hoàn tất. Không sửa ordering giữa các read cùng generation, không cache byte budget và không thêm distributed service.
- Chỉ có tác dụng khi đường mutation thực sự gọi invalidation. Không tự sửa mutation mới thiếu dependency, PWA/offline cache, service-worker state hay data từ hệ thống ngoài.
- Native Windows/libsql reliability gate còn mở như `docs/native-crash-investigation.md`; test pass của slice này không chứng minh native bug đã hết. Sự cố `/api/me` 500 ở rollout batch5 chưa có nguyên nhân được xác minh.
