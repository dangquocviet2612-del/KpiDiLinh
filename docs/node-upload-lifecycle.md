# Import bản đồ Node: khóa một luồng và giải phóng trạng thái lỗi

Mục 67, ngày 30/10/2026. **Chỉ local; chưa commit/push/deploy. Không import dữ liệu, đăng nhập hoặc truy cập database thật.** Phạm vi là ba picker trên bản đồ Node thường, không phải API upload Node0TB.

## Vì sao cần sửa

`NodeMapOptionsMenu` đã dùng một trạng thái busy tổng và khóa cả ba nút import. Tuy nhiên, trước lần render tiếp theo, ba handler vẫn có thể cùng tạo FormData và POST; state không phải khóa đồng bộ. Ngoài ra, constructor/append FormData nằm ngoài try nhưng sau khi bật busy: nếu chúng throw, handler reject không được xử lý và busy/picker không được dọn.

Đây là đường lỗi được tái hiện bằng test component, không phải tuyên bố đã quan sát cùng lỗi trên Production. Không sửa native binding hoặc nới strict visual gate để coi các mục cũ đã hoàn tất.

## Người dùng nhận được gì

- Chỉ một lượt import KML/KMZ, hiệu suất Excel hoặc node thuê bao được nhận trong một page đang mount. Khóa ref được lấy trước thao tác async/FormData, phù hợp ý định khóa nút chung hiện có.
- File được chọn khi một import khác đang xử lý bị bỏ qua và picker của lượt bị bỏ qua được reset để có thể chọn lại thủ công sau đó. Không xếp hàng ngầm hoặc tự gửi lại.
- Chụp tham chiếu input và File trước await. FormData, đổi trạng thái/menu nằm trong try; finally luôn nhả khóa, tắt busy đúng handler và reset input đã chụp, kể cả lỗi tạo/append FormData.
- Giữ khóa qua response JSON và công việc vốn đã được await: refresh node với KML/KMZ/hiệu suất. Luồng mapping vẫn refresh panel như cũ, không tự thêm request hoặc biến void refresh thành await.
- Giữ nguyên giới hạn file mục 62, no-file guard, POST `/api/nodes/upload`, FormData chỉ có trường `file`, báo cáo/thông báo lỗi/thành công cũ, quyền ADMIN, menu/CSS, template/download, map marker/popup/search và nghiệp vụ server.

## Kiểm chứng

**Worktree V2 và repo chính: mỗi nơi 64 file / 1.193 test trong phạm vi đã chọn đạt, thêm 22 policy checks đạt; TypeScript nonincremental và ESLint đạt, không warning.** 26 test mới đã nằm trong 1.193, không cộng số lượt chạy. Spec V2 rồi quality V2 đều APPROVE đúng hai hash component/test. Đây không phải full native suite, Next build, browser/ba role hoặc nghiệm thu toàn Task 12.

26 regression cases actual `NodeMapComponent` với session/HTTP/Leaflet/FormData giả: **RED 17 failed / 9 passed và 6 unhandled rejection từ FormData ngoài try → GREEN 26/26, không unhandled error.** Bao gồm ba race cùng handler, sáu race chéo giữa handler, sáu lỗi constructor/append, lỗi HTTP/manual retry, no-file/4 MB preflight và hai lượt refresh đang chờ. File kiểm tra size chỉ có metadata giả; không xử lý file hay gọi API thật.

QA V1 đạt 64 file / 1.193 scoped tests, 22 policy và lint, nhưng TypeScript failed TS2769 tại spy `append` trên polymorphic `this` của subclass FormData trong test mới. Giữ nguyên candidate V1 và raw logs. V2 chỉ khai báo `this as FormData` tại spy đó; proof đối chiếu toàn file xác minh không đổi runtime assertion/fixture/case, component giữ nguyên sau V1. Focused V2 đạt 26/26; approval V1 không được dùng thay review đúng hash V2. Không dùng lượt pass mới xóa failed gate V1.

Snapshot 523 public paths / 376 source-config-test paths, 42 thay đổi repo chính / 276 worktree, 2.107 evidence artifacts cũ. Exact-scope đảo đúng một ref/ba handler rồi so toàn bộ component; riêng từng block response→catch và size preflight được đối chiếu nguyên văn để giữ báo cáo, error text và refresh cũ. Source/server/config/oldtests ngoài phạm vi giữ nguyên; lưu preimage/backups/hash-inventory, default redacted secret scan và whitespace checks. Tiến độ chỉ nối mục 67, không sửa lịch sử failed gates hoặc publish59.

Evidence private `.local/performance/node-upload-lifecycle-20261030/`. Chỉ một component, một file test mới và bốn tài liệu; không commit env/DB/token/log hoặc dữ liệu kinh doanh. Không kiểm tra lại trạng thái web live hoặc thay lịch sử publish.

## Phần chưa nghiệm thu

- Khóa chỉ trong một component, không giữa tab/người dùng hoặc trên server; không phải transaction, rollback, cancellation hay bảo đảm exactly-once nếu request đã được gửi.
- Validation acknowledgement/unknown outcome và nội dung lỗi HTTP/report cũ **chưa thay đổi**. Một HTTP 200 hoặc thông báo hiện tại không được dùng làm bằng chứng database đúng. Đây chỉ là sửa lifecycle, không phải nghiệm thu an toàn toàn bộ import.
- Chưa benchmark SQL/import thực, batch UPSERT, tiến trình job, file lớn/storage, dữ liệu sản phẩm, trình duyệt/ba role hoặc Next build.
- Native Windows/libSQL, auth/KPI-timeout lịch sử, Node0TB strict image/geometry/timing, toàn Task 11/12, CI/RUM/release vẫn mở. Báo cáo geometry cũ chỉ lưu hashes nên không đủ suy ra element/layout nào đã đổi; không nới tolerance, thay baseline hay chạy lặp để lấy PASS trong đợt này.
