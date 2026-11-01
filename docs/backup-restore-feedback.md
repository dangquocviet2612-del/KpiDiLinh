# Khôi phục backup: acknowledgement và chống gửi trùng ở UI

Checkpoint 65, ngày 30/10/2026. **Chỉ local, chưa commit/push/deploy. Không chạy khôi phục dữ liệu thật.** Tiếp phần phản hồi vận hành trong Task 11/12 sau giới hạn kích thước ở mục 64; không thay API, transaction, schema hoặc thiết kế lại giao diện.

## Người dùng nhận được gì

- Chỉ báo thành công khi HTTP thành công và body có `success: true`, `restored` là object chứa `users`/`customers` là số nguyên an toàn không âm. Không báo 0/0 rồi xóa lựa chọn khi body rỗng, sai hoặc JSON không đọc được.
- Mạng lỗi, HTTP 5xx hoặc xác nhận không hợp lệ báo **chưa xác định được kết quả**, nhắc dữ liệu có thể đã thay đổi và cần kiểm tra trước khi thử lại. Không tuyên bố đã rollback hoặc chưa ghi database; không tự POST lại.
- HTTP 413 được xử lý trước khi đọc JSON, dùng hướng dẫn mục 64: giữ nguyên file backup, không chia nhỏ hoặc sửa để lách giới hạn. Các lỗi 4xx khác giữ thông báo lỗi dạng chuỗi có nội dung, hoặc thông báo chung cũ.
- Chỉ cho phép một luồng từ trước `await confirm` đến hết xác nhận, đọc file và POST. Bấm nhanh nhiều lần không mở thêm xác nhận hoặc gửi thêm POST. Khóa được giải phóng trong `finally` sau hủy, lỗi hoặc thành công; không tự thử lại.
- Giữ tham chiếu file đã xác nhận. Nếu người dùng chọn file mới khi yêu cầu cũ đang chờ, phản hồi cũ không xóa lựa chọn mới. Khi lỗi hoặc chưa rõ kết quả, không xóa file hay trạng thái nhật ký; chỉ phản hồi hợp lệ mới cập nhật thành công như cũ.
- Phân biệt lỗi mở xác nhận, đọc/parse file trước POST và cập nhật giao diện sau xác nhận thành công. Lỗi tải lại nhật ký không phủ nhận xác nhận đã nhận hoặc gửi khôi phục lại.

## Luồng và evidence nguồn

`LogsPage` → cap64 → ref single-flight → confirm `KHOI PHUC` cũ → File.text/parse/stringify → `POST /api/admin/backup` cũ → status/ack validation → UI update hoặc cảnh báo. API vẫn trả `success: true` và counts sau workflow restore/cache hiện có; client chỉ kiểm hợp đồng phản hồi, không chứng minh nội dung database đúng từ số đếm.

- `src/app/(dashboard)/logs/page.tsx`: record/ack guard, messages, ref và restore handler. Giữ các filter/CRUD nhật ký, GETbackup/download, picker, CSS, role redirect, query URLs và64size policy.
- `src/app/api/admin/backup/route.ts`: chỉ đọc để xác minh response contract; không sửa hoặc gọi vào DB thật.
- `tests/ui/backup-restore-feedback.test.tsx`: actualpage với fake session/router/confirm/File.text/HTTP; không real browser/server/DB/restore. Backend response mocks không phải nghiệm thu giao dịch hoặc dữ liệu thật.

## Kiểm chứng

35 regression cases mới: **RED26fail/9pass (có1unhandled confirmation rejection từ handler cũ) → GREEN35/35, không unhandled error.** Bao gồm invalid ack/counts,413 trước JSON,4xx/5xx/network, phase errors, các giai đoạn single-flight và release, manual retry, giữ file mới, filter/log/page và knownack khi UI/log-refresh lỗi. Broad selection kế thừa64 không đổi, UI folder tự thêm file mới; không đổi oldtests/config/deadline/pool hoặc chạy lại unchanged candidate tới xanh.

**Worktree và repo chính: mỗi nơi 62 file / 1.137 test trong phạm vi đã chọn đạt, thêm 22 policy checks đạt; TypeScript nonincremental và ESLint đạt, không warning.** 35 test mới đã nằm trong 1.137, không cộng lặp các lượt chạy. Spec rồi quality review độc lập đều APPROVE đúng hash của page và test. Không chạy full native suite, Next build, trình duyệt hoặc database thật; không dùng kết quả này để đóng các mục nghiệm thu còn mở.

Chỉ1page+1newtest+4docs. Snapshot517publicpaths/374source-config-test,36primarydirty/270WTdirty và2.021oldartifacts; inventory/preimage/backups/exact-scope/defaultredactedsecret/whitespace guards giữ nguyên mọi local60–64 và evidence cũ. Progress nối65, không sửa lịch sử failures/publication59. Config/server files và64body reader không đổi; không chạy config probe/build mới trong batch65.

Evidence private `.local/performance/backup-restore-feedback-20261030/`. Không commit env/DB/token/log/businessdata. Production vẫn965e8e9mục59,60–65 chưa publish.

## Phần chưa làm

Khóa bằng ref chỉ áp dụng cho một component đang mount. Đây không phải server idempotency, khóa giữa các tab/người dùng, cơ chế hủy/rollback hoặc bảo đảm chỉ thực thi một lần khi request đã gửi. Sau kết quả chưa rõ, admin phải kiểm tra dữ liệu trước khi thử lại; task không tự đọc hoặc khôi phục database để xác minh.

Xác nhận hợp lệ chỉ là bằng chứng về phản hồi HTTP đã nhận, không chứng minh checksum, foreign key, snapshot consistency hoặc nghiệm thu restore roundtrip. Chưa khôi phục vào database thử, kiểm chứng activation/rollback, thiết lập storage/job hoặc xử lý backup/download lớn. Giữ công thức, roles, SQL và runtime setup cũ.

Toàn bộ Task 11/12 vẫn chưa được nghiệm thu. Các mục auth/native Windows/libSQL/KPI-timeout trước đây, Node0TB visual/timing, full Next build, trình duyệt/ba role, CI/RUM và rollout vẫn mở. Test unit/RTL trong phạm vi đạt không chứng minh app nhanh hơn hoặc Production đã cập nhật.
