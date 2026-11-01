# Ba bản đồ — điều khiển tối giản

## Yêu cầu và thiết kế

Sau checkpoint81, người dùng gửi ảnh thực tế cho thấy toolbar chiếm quá nhiều bản đồ, nhất là mobile. Đợt sửa này ưu tiên trả diện tích cho canvas, không bỏ chức năng hoặc thu nhỏ vùng bấm dưới 44px.

- Mặc định: tiêu đề nhỏ một dòng, ô tìm kiếm, nút Bộ lọc và nút `…` (Công cụ bản đồ).
- GPS, danh sách, nền bản đồ, thêm khách hàng, quản trị/import/export và chuyển giữa hai bản đồ Node vẫn có trong Công cụ; quyền ADMIN/MANAGER/CTV không đổi. Node vẫn dùng menu Thao tác sẵn có cho xuất/nhập và nền bản đồ.
- Số liệu mặc định chỉ một dòng: số điểm trong khung và số điểm qua bộ lọc. Bấm Số liệu để xem đủ bốn chỉ số và ghi chú thiếu tọa độ/giới hạn 10.000 khách hàng theo phân quyền. `0` và `—` vẫn khác nhau; không đổi nghĩa của chỉ số.
- Menu mở trên canvas, có scroll riêng, không đẩy toolbar thành nhiều hàng. Desktop giới hạn panel 34rem thay vì 66rem; không đổi nguồn tiles, marker/clustering, GPS, thuật toán tìm kiếm hay API.
- Native disclosure mặc định đóng, không unmount file inputs hoặc reset các trạng thái nghiệp vụ. Click ngoài đóng Công cụ; Escape chỉ xử lý focus thuộc disclosure hoặc fallback body sau menu con, không giành focus của modal riêng. Đóng danh sách trả focus về nút Công cụ nếu nút danh sách đã bị thu vào disclosure.

## Kiểm tra

- TDD cho thống kê/disclosure, Escape sau menu con, modal riêng và trả focus từ danh sách; giữ các regression role/upload/escaping/search/projection có sẵn, chỉ bổ sung bước mở Công cụ khi cần.
- Candidate: 99 file / 1.704 unit/UI đạt; focused126, types/lint và isolated Next build đạt. Không đổi timeout, pool, retry hoặc skip.
- Chrome/Leaflet/markercluster thật với API/GPS/tiles giả; so sánh cùng fixture trước/sau ở 360/390/768/1440px, light/dark, thêm chữ 200% và role MANAGER/CTV. Budget toolbar đóng không quá 140px ở cỡ chữ thường; ghi số đo thực tế và kết quả primary tại checkpoint82 trong `tiendokpi.md`.
- Không coi fixture là nghiệm thu iPhone/Safari thật, đăng nhập ba role, mạng/tiles thật hoặc tốc độ Production. Không đóng các gate native Windows/libSQL, auth68, Node0TB timing/strict-visual cũ.

## Lỗi cũ được phân biệt, không che bỏ

Kiểm tra mở form khách hàng → chỉnh tên → Escape phát hiện hộp xác nhận bỏ thay đổi nằm dưới form, khiến pointer bấm Hủy bị chặn. Probe cùng fixture trên **cả source trước và sau** đều thấy hit target là form khách hàng; đây không phải lỗi sinh ra bởi disclosure. Chưa sửa stacking/modal trong đợt thu gọn này. Cancel bằng Enter vẫn trả focus vào form ở cả hai bản; browser matrix chỉ nghiệm thu luồng bàn phím đó, không báo pointer flow đã đạt. Giữ nguyên báo cáo timeout ban đầu và hai ảnh/probe đối chứng, không force-click hoặc tăng timeout để che lỗi.

## Trạng thái phát hành

Đợt local ở checkpoint82 được người dùng xem thử rồi yêu cầu push/deploy ngày 01/11/2026. Bản thu gọn đã được phát hành và xác minh:

- Application commit [`36189a9ff588c079683c01f0a57dba4f7013eb08`](https://github.com/dangquocviet2612-del/KpiDiLinh/commit/36189a9ff588c079683c01f0a57dba4f7013eb08), 15 file, giữ nguyên source đã review/QA. Bản demo localhost và dữ liệu/API/GPS mẫu không nằm trong gói deploy.
- Chạy lại 99 file/1.704 unit/UI, types/lint và isolated Next build đều đạt; [CI Pipeline 41293008047](https://github.com/dangquocviet2612-del/KpiDiLinh/actions/runs/41293008047) completed/success đúng commit.
- Production candidate `dpl_DtA9Wzorqf8fimWDY11XBiqPUNb6` build READY với `--skip-domain`; 10 smoke GET đạt trước promote. Vercel API xác nhận [kpidi-linh.vercel.app](https://kpidi-linh.vercel.app) đã trỏ đúng deployment/commit, 10 smoke GET trên domain chính đạt sau promote.
- Smoke không đăng nhập app: login200, sáu trang bảo vệ chuyển về login và ba API bản đồ401. Không coi đây là nghiệm thu dữ liệu thật theo ba role; không đổi database/env, chạy migration hoặc tạo protection token mới. Giữ deployment cũ `dpl_hp1U8JvXerrHi57ET4GMNwFbCvCu` để rollback.
- Lỗi pointer hộp xác nhận cũ và các gate native/auth68/Node0TB/hiệu năng thực tế ở trên vẫn chưa được xử lý. Commit tài liệu sau phát hành không đổi application đã deploy; project hiện chưa nối Git tự deploy.

Evidence private trong `.local/performance/map-compact-20261101/` và `.local/deployment/map-compact-publish-20261101/`; không commit fixture, ảnh QA, env, database hoặc token.
