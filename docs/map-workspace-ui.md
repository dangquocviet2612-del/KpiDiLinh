# Giao diện ba bản đồ — 01/11/2026

## Phạm vi

Đồng bộ bản đồ Khách hàng (`/map`), Node (`/node-map`) và Node0TB (`/node-0tb`) theo bố cục preview Node0TB đã được người dùng duyệt. Giữ Leaflet/markercluster, nguồn tiles, endpoint, phân quyền, GPS, upload, tìm kiếm/định vị, danh sách và popup hiện có. Không mang dữ liệu giả hoặc nền SVG của preview vào ứng dụng.

## Những thay đổi

- Header có tên bản đồ, bề mặt phẳng theo light/dark theme, search rõ ràng và nút có nhãn chữ. Giảm glow của cụm Node, tách tên cụm và số lượng: tên dài được rút gọn nhưng số lượng không bị che; popup/title vẫn giữ tên đầy đủ và escaping.
- Bộ lọc có nút mở/đóng, giữ lựa chọn khi thu gọn và hiển thị ngữ cảnh đang lọc. Chú giải vẫn cuộn ngang, không đổi phân loại/màu ưu tiên hay thuật toán clustering.
- Bốn số liệu riêng: tập đã tải, có tọa độ hợp lệ, có tọa độ qua bộ lọc và nằm trong bounds hiện tại. `Trong khung` là số điểm dữ liệu thuộc bounds, **không phải số biểu tượng cụm/marker DOM**. Cụm có thể đại diện nhiều điểm; số này không trừ phần bản đồ bị panel che.
- Observer chỉ đọc bounds sau ready/moveend/zoomend/resize, loại snapshot trùng và gỡ listener khi unmount; không pan/zoom/fit hoặc tải API. Bounds chưa sẵn sàng dùng `—`, số không hiển thị `0`, `(0,0)` vẫn hợp lệ. Không đếm điểm ở bản sao thế giới khác với marker Leaflet.
- Khách hàng dùng `Đã tải`, ghi rõ tối đa 10.000 bản ghi có tọa độ theo phân quyền. Đây không phải tổng khách hàng toàn hệ thống. Node0TB dùng `Tổng node` cho tập response hiện tại, hiển thị số bản ghi chưa có tọa độ hợp lệ.
- Tìm kiếm vẫn là gợi ý/định vị, không âm thầm trở thành bộ lọc marker. Danh sách khách hàng chuyển lên toolbar; đóng danh sách/Escape trả focus về nút mở.
- Toolbar/filter/menu có vùng bấm tối thiểu 44px; bộ đếm dùng màu theme, không để chữ trắng trên nền sáng. Mobile/chữ lớn cho panel cuộn theo chiều dọc với giới hạn 60dvh, để nút zoom/fit còn thao tác được; menu mobile hiển thị trong luồng thay vì tràn ra ngoài panel cuộn.

## Chứng cứ và giới hạn

- Unit/UI: `tests/unit/map-viewport.test.ts`, `tests/ui/map-workspace.test.tsx`, `tests/ui/node-map-workspace.test.tsx`, hai test projection hiện có; giữ kiểm tra role, escaping, upload, fit/zoom, tìm kiếm, popup và cập nhật vị trí. Không đổi pool, timeout, skip hoặc CI để làm test đạt.
- Candidate cuối: 98 file / 1.698 unit/UI đạt; focused 132 case, types/lint và isolated Next build đạt. Không chạy migration trong build.
- QA trình duyệt dùng Chrome, ba component thật và Leaflet/markercluster thật; dữ liệu API/GPS/tiles đều giả và không truy cập database/phiên đăng nhập thật. Ma trận mobile/tablet/desktop, light/dark, chữ 200%, filter giữ lựa chọn, số bounds so với Leaflet, menu/chuyển nền và quyền ADMIN/MANAGER/CTV được kiểm tra trong fixture. Không coi đây là nghiệm thu đăng nhập/ghi dữ liệu thật theo ba role.
- Không có benchmark Production hoặc chứng minh tốc độ mạng/tiles mới. Không đóng các gate cũ native Windows/libSQL, auth timeout68, Node0TB timing/strict-visual hoặc nghiệm thu ba role/dữ liệu thực. Giao diện mới là thay đổi có chủ đích đã duyệt, không sửa snapshot cũ để coi gate cũ đã qua.
- Evidence private giữ tại `.local/performance/map-workspace-20261101/`: snapshot/hash/preimage, các lượt RED/failure, diagnostics, build, ảnh Chrome, review và kiểm tra phạm vi. Không đưa env, database, token, fixture hay evidence riêng lên Git/Vercel.

## Kiểm tra thủ công sau phát hành

Trên điện thoại và máy tính, mở lần lượt ba bản đồ; đổi bộ lọc rồi thu gọn/mở lại, tìm một khách hàng/node, mở danh sách, bật GPS và thử zoom/fit. Kiểm tra số trong khung thay đổi khi kéo bản đồ. ADMIN kiểm tra menu upload/template nhưng không import dữ liệu thật chỉ để thử giao diện.
