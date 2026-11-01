# Tải backup: tránh yêu cầu trùng và dọn tài nguyên tạm

Mục 66, ngày 30/10/2026. **Chỉ local; chưa commit/push/deploy. Không tải backup hoặc khôi phục database thật.** Tiếp phần phản hồi vận hành trong Task 12, không đổi giao diện hoặc API.

## Vấn đề và phạm vi

Handler cũ chỉ disable nút bằng state sau render, chưa có khóa đồng bộ trước `await fetch`. URL tạm và anchor chỉ được dọn trên đường thành công; exception khi tạo/gắn/bấm anchor có thể bỏ qua việc dọn. Thông báo “Tải backup thành công” được phát sau `anchor.click`, không phải bằng chứng trình duyệt đã lưu file. Các lỗi HTTP có `error` không phải chuỗi cũng chưa được kiểm tra trước đưa vào toast. Đây là các đường lỗi từ code/test, không phải tuyên bố đã quan sát lỗi tương ứng trên Production.

## Cách xử lý

- Khóa bằng ref trước lần await đầu tiên, giữ qua fetch, đọc blob, tạo/bấm anchor và dọn tài nguyên. Bấm nhanh không gửi thêm GET trong cùng page; kết thúc hoặc lỗi sẽ mở lại thao tác thủ công, không tự thử lại.
- Theo dõi object URL và anchor đã được tạo. Trong `finally`, độc lập thử gỡ anchor và thu hồi URL; nếu một bước dọn lỗi thì bước kia và mở khóa vẫn được thực hiện. Lỗi dọn chỉ được ghi log, không phủ nhận yêu cầu tải đã được gửi.
- Chỉ thông báo sau `anchor.click` trả về: “Đã gửi yêu cầu tải backup. Vui lòng kiểm tra file đã lưu.” Không khẳng định file đã lưu thành công hoặc nội dung backup hợp lệ.
- Giữ nguyên GET `/api/admin/backup`, `res.blob`, cách đọc tên file từ `Content-Disposition` và fallback `backup.json`. Lỗi HTTP chỉ hiển thị `error` là chuỗi có nội dung, nếu không dùng “Không thể tải file backup.” Lỗi khác giữ thông báo chung cũ.
- Không thay restore mục 65, giới hạn file mục 64, quyền ADMIN, picker, CSS, nhật ký, bộ lọc, phân trang, SQL, schema hoặc workflow server.

## Kiểm chứng

**Worktree V2 và repo chính: mỗi nơi 63 file / 1.167 test trong phạm vi đã chọn đạt, thêm 22 policy checks đạt; TypeScript nonincremental và ESLint đạt, không warning.** 30 test mới đã nằm trong 1.167, không cộng lặp số lượt chạy. Spec V2 rồi quality V2 đều APPROVE đúng hash của page và test. Không chạy full native suite, Next build, trình duyệt hoặc database thật; không dùng kết quả này để đóng toàn bộ Task 12.

30 regression cases mới: **RED 30/30 failed → GREEN 30/30 passed**. RED tái hiện hai GET khi bấm nhanh trước render, thiếu dọn URL/anchor trên đường lỗi và thông báo cũ không đúng hợp đồng mới; không phải lỗi import/setup. Nhiều case giữ hành vi cũ rồi kiểm tra thêm retry thủ công/thông báo mới, nên không diễn giải 30 case failed thành 30 bug độc lập. Bao phủ deferred fetch/blob/error-body, tên file/fallback, các lỗi DOM/URL/toast, lỗi dọn độc lập, structured error và bảo toàn trạng thái nhật ký/restore. Test dùng opaque blob giả, không chứng nhận JSON backup.

QA V1 đạt 63 file / 1.167 scoped tests, 22 policy và lint, nhưng **TypeScript failed**: TS2502/TS7023/TS7031 do vòng tham chiếu `ReturnType<typeof makeAnchor>` với biến `anchors` mà chính hàm ghi vào. Giữ nguyên candidate V1 và raw logs. V2 chỉ thêm `AnchorFixture`/`MockInstance` cùng return annotation để phá vòng kiểu; type-only proof xác minh không đổi một assertion, fixture hoặc case runtime nào, page không đổi sau V1. Focused V2 tiếp tục đạt 30/30; spec V1 không được dùng thay approval đúng hash V2. Không dùng các lượt pass mới xóa lịch sử failed gate V1.

Chỉ sửa một page, thêm một file test và bốn tài liệu. Snapshot: 520 public paths, 375 source/config/test paths, 39 thay đổi local repo chính, 273 thay đổi worktree và 2.057 evidence artifacts cũ. Bảo toàn toàn bộ local60–65 và lịch sử lỗi/publish trước đây bằng preimage, hash/inventory, backups, exact-scope, secret scan mặc định có che bí mật và whitespace checks. Progress chỉ nối mục 66.

Evidence private: `.local/performance/backup-download-feedback-20261030/`. Test actual LogsPage với fake session/HTTP/DOM download; không đọc `.env`, database, token hoặc dữ liệu kinh doanh thật. Lần publish gần nhất có evidence trong repo là mục 59; task này không publish các thay đổi local60–66 hoặc kiểm tra lại trạng thái live.

## Hạn chế còn mở

- Khóa chỉ có hiệu lực trong một component đang mount, không giữa các tab hoặc người dùng và không chặn restore/sửa dữ liệu đồng thời. Không hủy request hoặc thay server bằng job/storage.
- `anchor.click` không chứng minh đã lưu file. Quyền tải xuống, người dùng hủy, dung lượng đĩa, file đã lưu và tính hợp lệ/toàn vẹn của JSON chưa được kiểm tra.
- GET hiện vẫn tạo và tải blob toàn bộ như cũ; chưa xử lý backup lớn, snapshot consistency, checksum/foreign key, restore vào DB thử, activation/rollback hoặc storage/job.
- Chưa nghiệm thu toàn Task 12, full native Windows/libSQL, auth/KPI-timeout trước đây, Next build, trình duyệt/ba role, Node0TB visual/timing hoặc CI/RUM/release. Scoped test đạt không chứng minh tốc độ app hoặc an toàn khôi phục dữ liệu thật.
