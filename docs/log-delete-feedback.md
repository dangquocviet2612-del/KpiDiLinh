# Xóa nhật ký: một lượt gửi và phản hồi đúng kết quả — mục 72

## Phạm vi

Thao tác ADMIN tại trang Nhật ký CTV (`src/app/(dashboard)/logs/page.tsx`), gọi `DELETE /api/logs`. Chỉ sửa lifecycle/phản hồi client, không đổi API, SQL, phân quyền, giao diện/CSS, thao tác backup/restore, bộ lọc hoặc logic tải danh sách.

Trước sửa, chờ confirmation nằm ngoài try và không có khóa đồng bộ; nhiều click trong cùng tick có thể mở nhiều confirmation/gửi nhiều DELETE. HTTPok bất kỳ được báo thành công bằng `count ?? 0`, kể cả response không xác nhận xóa. Test actual component với fake session/fetch/dialog đã tái hiện các lỗi này; không gọi API thật hoặc xóa dữ liệu thật.

## Hành vi sau sửa

- Giữ kiểm tra cần có selection hoặc ngày; ref lock được đặt trước first await, bảo vệ từ confirmation tới khi handler kết thúc trong cùng mounted page.
- Confirmation nằm trong try/finally. Cancel hoặc dialog lỗi vẫn nhả khóa; lỗi mở xác nhận có thông báo riêng, không tạo unhandled rejection.
- Giữ nội dung confirmation, `XOA NHAT KY`, IDs/ngày đã capture, URL/method/headers/body. Nút vẫn theo busy/disabled hiện có; không thay layout.
- Chỉ HTTPok với object `success === true` và `count` là nonnegative safe integer mới theo nhánh thành công. 0 hợp lệ, string/âm/phân số/NaN/Infinity/unsafe integer hoặc thiếu trường không được bịa thành 0.
- Với ack hợp lệ, giữ thông báo số bản ghi, clear detail, page1 và refresh như trước. Response shape không chứng minh DB đã persist hoặc số lượng đúng nghiệp vụ.
- Structured4xx chỉ hiển thị error dạng string có nội dung, còn lại dùng thông báo chung; không truyền object vào toast.
- Network/5xx/malformed200/JSON không đọc được: cảnh báo kết quả chưa rõ, dữ liệu có thể đã thay đổi, cần kiểm tra trước manual retry. Không success/reset/refetch/auto-retry; 5xx được xử lý trước parse JSON.
- Lỗi UI sau known ack không bị báo thành “xóa chưa thành công”: thông báo đã nhận xác nhận nhưng cần tải lại trang để kiểm tra.
- Finally nhả lock và busy trong mọi nhánh; không queue, watchdog hoặc tự retry. User có thể chủ động thử lại sau khi đã kiểm tra kết quả.

## Kiểm chứng và tiến độ

`tests/ui/log-delete-feedback.test.tsx` dùng actual LogsPage/jsdom với fake fetch/dialog/session/router/toast; không server/DB/browser thật.

- RED ngày30/10: **28 fail/11 pass trong39case**, thêm **1 unhandled rejection** từ confirmation cũ; recorder70 giữ main/process JSON và exit1. Không xóa/sửa log đỏ hoặc suppress lỗi bằng runner config.
- Sau sửa đúng helper/ref/handler: **39/39 GREEN,0unhandled**. Bao phủ duplicate trong lúc confirm/request, cancel/reject/manual retry, missing intent, malformed/count/HTTP/network, selection/detail/page được giữ khi chưa có ack, valid0 và captured request/confirmation/date path.
- Phiên trước bị ngắt bởi usage limit trong automatic approval và reviewer; command scoped/static lúc đó **chưa được thực thi**, không phải test fail hay kết luận thao tác không an toàn. Ngày31/10 tiếp tục qua approval bình thường, kiểm tra539oldpublicpaths/2.383oldartifacts và hai source deltas68 trước khi chạy phần còn thiếu; không bypass quyền hoặc ghi đè artifact.
- Worktree và **repo chính mỗi nơi fresh7file/324 case log+backup liên quan PASS**, không skip hoặc tăng timeout/retry/pool; **48tool+22policy/types/lint0warning PASS**. Primary chạy riêng sau source integration, không suy từ worktree hay39case mới.
- Review độc lập SPEC→QUALITY **APPROVE đúng hai source/test hash** sau khi reviewer cũ được tiếp tục; không dùng lần review bị usage-limit làm approval. Approval chỉ source, không docs/private harness/fullapp/release.
- Default redacted secret scan hai source/test trước copy có backup, scan bốn docs/whitespace trước integration. Exact inverse proof giữ helper/ref/handler-only scope và confirmation/validack side effects; inventory/hash/HEAD/index/oldBUILD_ID guards giữ mọi thay đổi cũ/2delta68, append72 không sửa prefix71. Final manifests lưu sáu path local, chưa commit/push/deploy.

## Giới hạn

Khóa chỉ trong cùng mounted page; không cross-tab/user/server idempotency/exactly-once, không abort request khi unmount hoặc khóa chéo restore/download. User thay selection/date trong khi confirm không làm scope trong confirmation cũ tự đổi. Manual retry có thể lặp một mutation đã commit nên phải kiểm tra nhật ký trước khi bấm lại.

Existing fetch race, stale filter response và refresh page cũ khi setPage1 vẫn là hạng mục riêng, không được tuyên bố đã giải quyết ở đây. 4xx structured message vẫn là phản hồi server, không bằng chứng rollback. JSON chuẩn không phụ thuộc MIME; ack guard không kiểm DB integrity/count relationship. Exception trong bản thân error toast không được bảo đảm luôn hiển thị thông báo, dù finally vẫn nhả khóa.

Không chạy whole65file/1276case app suite/native Windows/libSQL/Next/browser/ba role hoặc thực hiện deletion/restore thật. Candidate68 vẫn ở worktree, failed auth gate68/rootcause và wholeTask11/native/Node0TB strict visual-timing/CI-RUM/release còn mở. Không có claim tốc độ web cải thiện từ batch feedback này; không commit/push/deploy.

Evidence private: `.local/performance/log-delete-feedback-20261030/` giữ snapshot/preimages/RED/GREEN/recorder/process/scoped/static/reviews/exact-scope/scans/backups/integration/pending manifests. Không commit env/DB/token/log/dữ liệu nghiệp vụ.
