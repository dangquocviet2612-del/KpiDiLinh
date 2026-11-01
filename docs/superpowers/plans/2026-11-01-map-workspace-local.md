# Đồng bộ giao diện ba bản đồ — local

> **For agentic workers:** Use superpowers:subagent-driven-development with review checkpoints. Ban đầu chỉ local; người dùng sau đó cho phép commit/push/deploy khi kiểm tra đạt. Không thực hiện thao tác database hoặc migration.

**Goal:** Áp dụng bố cục preview Node0TB người dùng đã duyệt cho bản đồ Khách hàng, Node và Node0TB, không thay đổi nghiệp vụ.

**Architecture:** Giữ Leaflet/markercluster, TileLayer và API hiện có. Dùng chung summary phân biệt tập đã tải/có tọa độ/qua bộ lọc/trong khung. Observer chỉ đọc bounds sau thao tác bản đồ, không tự di chuyển hoặc tải API. Mỗi domain giữ nguyên tìm kiếm, GPS, danh sách, phân quyền, upload, sửa vị trí và popup.

**Tech Stack:** Next.js, React, CSS Modules, Leaflet, Vitest/Testing Library, Playwright + Chrome local.

## Quyết định thiết kế đã duyệt
- Panel phẳng, chữ rõ, light/dark theo theme app, bớt glow ở marker/cụm.
- Header tên bản đồ; search và nút có chữ; bộ lọc có thể thu gọn, không reset khi đóng.
- Bản đồ chiếm phần lớn khung; controls và menu dùng được trên mobile/keyboard.
- Không dùng dữ liệu giả, geometry OSM offline hay thuật toán cụm của preview trong app.
- Khách hàng: API chỉ tải tối đa 10.000 bản ghi có tọa độ theo phân quyền; ghi “Đã tải”, không gọi là tổng khách hàng toàn hệ thống. Tìm kiếm vẫn là gợi ý/định vị, không âm thầm đổi thành bộ lọc marker.
- Zero là số hợp lệ; tọa độ (0,0) hợp lệ. Chưa nhận bounds dùng “—”, không đoán số trong khung.

## Các bước
- [x] Đọc code/contract API và ghi nhận 15 thay đổi local trước đó.
- [x] Snapshot 555 đường dẫn source công khai; tạo bản QA riêng không credentials/database, giữ 15 thay đổi local có trước.
- [x] RED → GREEN cho helper đếm bounds, summary và observer; kiểm tra cleanup và không gọi API/pan/zoom. Bounds khớp marker Leaflet ở cả bản sao thế giới.
- [x] Áp dụng bố cục cho Node, Node0TB và Khách hàng; giữ đầy đủ actions theo role.
- [x] Focused132, unit/UI 98 file/1.698 case, types/lint và build riêng đạt. Các lượt lỗi được giữ riêng.
- [x] Chrome 24 ảnh/30 kiểm tra với Leaflet thật và API/GPS/tiles giả: mobile/tablet/desktop, light/dark, chữ 200%, filter, list/focus, bounds và menu mobile theo role.
- [x] Review độc lập phát hiện hai P2; tái hiện và sửa badge contrast/menu bị cắt, review lại đúng hash đạt. Không có P0/P1/P2 còn mở trong scope review này.
- [x] Tích hợp 21 file đúng hash, giữ 15 thay đổi local trước; primary focused132/types/lint đạt, không thay đổi ngoài scope. Cả checkpoint78–80 đã được push/phát hành theo xác nhận người dùng.

## Phát hành sau xác nhận người dùng

- Chỉ push đúng các thay đổi đã review/kiểm thử (gồm UI local checkpoint78–79), quét secrets và gói deploy công khai riêng; không đưa evidence/fixture/env/database/backup vào Git/Vercel.
- Project xác minh `kpidi-linh`, chưa liên kết Git tự deploy. Build script chỉ `next build`; postinstall `prisma generate`, không chạy migration.
- Tạo Production candidate `--skip-domain`, chờ READY và smoke GET không đăng nhập trước promote. Giữ deployment cũ để rollback; xác minh alias và smoke lại sau promote.
- Native Windows/libSQL, auth68, Node0TB timing/strict-visual và nghiệm thu nghiệp vụ ba role thực tế vẫn chưa hoàn tất; không đóng gate cũ vì giao diện mới hoặc fixture đã đạt.

**Kết quả:** code `e7a152c`, CI41289760697 thành công, Vercel deployment `dpl_hp1U8JvXerrHi57ET4GMNwFbCvCu` READY. Candidate và Production đều đạt 10 smoke GET; alias `kpidi-linh.vercel.app` đã được API xác nhận đúng deployment/commit. Chi tiết `docs/map-workspace-ui.md`, checkpoint81 trong `tiendokpi.md`. Commit tài liệu sau phát hành không thay đổi source ứng dụng đã deploy.

## Giới hạn nghiệm thu
QA local không đại diện tốc độ mạng/tiles và dữ liệu Production, không đóng các gate native Windows/auth timeout68 hoặc timing/strict-visual Node0TB cũ. Không tự sửa snapshot để coi thay đổi giao diện là vượt qua gate cũ.
