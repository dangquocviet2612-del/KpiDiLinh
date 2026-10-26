# BÁO CÁO TIẾN ĐỘ & TỔNG QUAN DỰ ÁN: CUSTOMER MANAGER

> **Dự án**: Customer Manager (Hệ thống CRM Viễn Thông & Quản Lý Thuê Bao)  
> **Thời điểm cập nhật**: Tháng 10/2026  
> **Phiên bản hiện tại**: `0.1.0` (Trạng thái đã hoàn thiện kiến trúc, tính năng nghiệp vụ và chuẩn hóa UI/UX)  
> **Mã nguồn**: Next.js 16 (App Router), React 19, TypeScript, Prisma 7, Turso/SQLite

---

## 1. TỔNG QUAN DỰ ÁN

### 1.1 Mục đích và bài toán nghiệp vụ
**Customer Manager** là hệ thống CRM & quản lý nghiệp vụ nội bộ chuyên biệt cho ngành viễn thông (đặc biệt phù hợp với mô hình kinh doanh dịch vụ FTTH cáp quang, Truyền hình, Di động, SIM số). Hệ thống giải quyết trọn vẹn chuỗi tác nghiệp hàng ngày của các đơn vị viễn thông:
1. **Quản lý khách hàng**: Lưu trữ thông tin thuê bao, số điện thoại, địa chỉ, gói cước, chu kỳ cước, thời hạn đóng trước (CDT), toạ độ GPS lắp đặt và lịch sử chăm sóc.
2. **Bản đồ hóa hạ tầng & khách hàng (GIS)**: Trực quan hóa khách hàng và trạm/node hạ tầng viễn thông trên bản đồ tương tác, tự động tìm và gán thuê bao vào node gần nhất.
3. **Giám sát chỉ tiêu KPI**: Theo dõi số liệu KPI kinh doanh hàng ngày, phân tích tỷ lệ hoàn thành chỉ tiêu theo cá nhân (CTV), theo tổ/quản lý (Manager) và toàn bộ đơn vị; tích hợp công cụ giả lập/tính toán điểm KPI.
4. **Quản lý Cước & Công nợ**: Theo dõi tỷ lệ thu cước định kỳ (chỉ tiêu 97.3%), cước cố định (Cước CĐ - chỉ tiêu 99.5%), đối soát giao dịch đóng trước (CDT), theo dõi nợ tồn và khách hàng sắp hết hạn đóng trước.
5. **Kiểm soát rời mạng (Churn Management)**: Cảnh báo sớm thuê bao có nguy cơ rời mạng và quản lý danh sách thuê bao đã thanh lý/hủy dịch vụ.
6. **Truyền thông nội bộ**: Quản lý, soạn thảo và ban hành văn bản, công văn, chính sách nội bộ kèm tài liệu đính kèm.
7. **Bộ công cụ tác nghiệp hiện trường**: Tạo ảnh mockup SIM số đẹp (Ghi SIM), tạo mã VietQR thanh toán cước, đóng dấu ảnh hiện trường phục vụ nghiệm thu/kỹ thuật, xuất phiếu thu và xử lý tệp dữ liệu.

---

### 1.2 Phân quyền người dùng (Role-Based Access Control - RBAC)
Hệ thống thiết kế 3 cấp bậc người dùng rõ ràng kèm phạm vi dữ liệu (Scope) bảo mật cao:

| Vai trò | Ký hiệu | Phạm vi dữ liệu & Quyền hạn |
|---|:---:|---|
| **Quản trị viên** | `ADMIN` | **Toàn quyền hệ thống**: Quản lý người dùng/CTV, phân công quản lý, cấu hình chỉ tiêu KPI, đóng băng & lưu trữ dữ liệu tháng (Archive), sao lưu & khôi phục toàn vẹn dữ liệu (Backup/Restore), xem nhật ký kiểm toán (Audit Logs), import/export toàn bộ phân hệ. |
| **Quản lý** | `MANAGER` | **Phạm vi theo đội ngũ**: Quản lý và xem toàn bộ báo cáo, KPI, cước, rời mạng của các CTV trực thuộc mã quản lý (`managerCode = username`). Được sử dụng đầy đủ các công cụ tính toán, tiện ích nghiệp vụ và KPI Quản lý. |
| **Cộng tác viên** | `CTV` | **Phạm vi cá nhân**: Chỉ xem và thao tác trên tệp khách hàng, KPI, cước, giao dịch CDT thuộc mã CTV của chính mình (`ctvCode = username`). Sử dụng bản đồ, tra cứu công văn, tạo QR, ghi SIM, mô phỏng tính điểm KPI. |

---

## 2. KIẾN TRÚC KỸ THUẬT (TECH STACK)

### 2.1 Frontend & Giao diện người dùng
- **Framework**: `Next.js 16.1.6` (App Router) với `React 19.2.3`.
- **Ngôn ngữ**: TypeScript 5 chuẩn hóa kiểu dữ liệu nghiêm ngặt.
- **Phong cách thiết kế (Styling)**: Vanilla CSS Modules kết hợp Design Tokens toàn cục (`src/app/globals.css`).
  - Hỗ trợ đầy đủ **Giao diện Tối / Sáng** (Dark/Light Mode) tự động hoặc lưu tùy chọn.
  - Thiết kế thích ứng (Responsive) tối ưu hóa cho màn hình Desktop, Tablet và Mobile.
  - Đáp ứng chuẩn Accessibility (A11y): Vùng cảm ứng tối thiểu 44px trên mobile, quản lý tiêu điểm phím (Focus Trap, Escape close, ARIA attributes).
- **Thư viện Icon**: `lucide-react`.
- **Bản đồ trực quan**: `leaflet` (v1.9.4), `react-leaflet` (v5.0.0), `leaflet.markercluster` hỗ trợ gom cụm hàng ngàn điểm marker mà không gây giật lag.

### 2.2 Backend, API & Bảo mật
- **API Architecture**: Next.js Route Handlers (`src/app/api/**`).
- **Xác thực (Authentication)**: `next-auth` v5 (Beta 25) mô hình Credentials JWT, mã hóa mật khẩu bằng `bcryptjs`.
- **Xác thực quyền & Scope dữ liệu**:
  - Middleware / Proxy: `src/proxy.ts` hỗ trợ Rate Limiting (chống brute-force đăng nhập, đổi mật khẩu và giới hạn tần suất import).
  - Auth Guard: Module `src/lib/api-auth.ts` (`requireAuth`) chặn truy cập trái phép ở từng endpoint.
  - Phân tách phạm vi: Module `src/lib/scope.ts` lọc dữ liệu tự động theo vai trò CTV / Manager / Admin.
- **Validation**: Thư viện `zod` xác thực dữ liệu đầu vào chặt chẽ khi tạo/sửa khách hàng và người dùng.
- **Audit Logging**: Bảng `AuditLog` lưu lại lịch sử các hành vi nhạy cảm (xóa khách hàng, xóa user, địa chỉ IP) và bảng `EditHistory` ghi nhận chi tiết thay đổi dữ liệu thuê bao.

### 2.3 Cơ sở dữ liệu & Quản lý Schema
- **ORM**: `Prisma 7.4.1` kết hợp bộ chuyển đổi `@prisma/adapter-libsql`.
- **Database Engine**:
  - Môi trường Production / Đám mây: **Turso Cloud Database** (`libsql://...`) bảo mật, tốc độ cao và phân tán toàn cầu.
  - Môi trường Development / Cục bộ: **SQLite** (`file:dev.db`).
- **Quy mô Schema**: Đã hợp nhất **24 models dữ liệu** chuẩn hóa trong `prisma/schema.prisma` và 4 migrations SQL có cấu trúc.
- **Migration Runner**: Script tự động `scripts/migrate.mjs` với cơ chế fail-fast ngắt ngay khi gặp lỗi DDL.

### 2.4 Kiểm thử tự động (Automated Testing)
- **Test Runner**: `vitest` kết hợp `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `axe-core`.
- **Độ bao phủ**: **37 bộ kiểm thử (Test Suites)** gồm:
  - 23 test suites kiểm thử logic nghiệp vụ (Unit tests: Zod validation, Auth & Scope, Phân loại cước, Mô phỏng KPI, Sắp xếp dữ liệu, Backup toàn vẹn).
  - 14 test suites kiểm thử giao diện & tương tác người dùng (UI tests: Modal accessibility, Phím tắt tìm kiếm bản đồ, Tool ghi SIM, Shell điều hướng).
- **CI/CD Pipeline**: GitHub Actions (`.github/workflows/ci.yml`) tự động kích hoạt kiểm tra 5 bước trên mỗi lần commit/PR:
  1. `prisma validate`
  2. `tsc --noEmit`
  3. `eslint`
  4. `vitest run`
  5. `next build`

---

## 3. CHI TIẾT CÁC PHÂN HỆ & TIẾN ĐỘ HOÀN THÀNH

```
+-------------------------------------------------------------------------------------------------+
|                                    CUSTOMER MANAGER (CRM HUB)                                   |
+---------------------+---------------------+---------------------+-------------------------------+
|  1. CRM KHÁCH HÀNG  |  2. BẢN ĐỒ & GIS    |  3. KPI & HIỆU SUẤT |  4. CƯỚC & CÔNG NỢ            |
|  - Quản lý DS KH    |  - Bản đồ KH        |  - KPI Cá nhân      |  - Thu cước định kỳ (97.3%)   |
|  - Import/Export XLS|  - Bản đồ Node      |  - KPI Quản lý      |  - Cước cố định (99.5%)       |
|  - Ghi chú/Lịch sử  |  - Node 0TB         |  - Tính/Mô phỏng KPI|  - Đối soát CDT & Tồn CDT     |
|  - Kỳ đóng trước    |  - Gán Node tự động |  - Cấu hình chỉ tiêu|  - Cảnh báo hết hạn đóng trước|
+---------------------+---------------------+---------------------+-------------------------------+
|  5. RỜI MẠNG (CHURN)|  6. CÔNG VĂN NỘI BỘ |  7. TIỆN ÍCH NGHIỆP VỤ|  8. QUẢN TRỊ & HỆ THỐNG      |
|  - Báo cáo hủy/ngắt |  - Soạn thảo/Duyệt  |  - Ghi SIM thẻ (30+)|  - Quản lý tài khoản & CTV    |
|  - Nguy cơ rời mạng |  - Đính kèm tệp     |  - Tạo VietQR cước  |  - Nhật ký kiểm toán AuditLog |
|  - Cảnh báo giữ chân|  - Lịch sử Revisions|  - Sửa ảnh hiện trường|  - Lưu trữ dữ liệu Archive   |
|  - Phân bổ CTV xử lý|  - Ghim thông báo   |  - In phiếu thu/Excel|  - Backup / Restore 24 bảng  |
+---------------------+---------------------+---------------------+-------------------------------+
```

### Phân hệ 1: Quản lý Khách hàng (Customer CRM)
- **Đường dẫn**: `/customers`
- **Tiến độ**: **100% Hoàn thành**
- **Chức năng chi tiết**:
  - Hiển thị danh sách khách hàng phân trang, lọc nâng cao theo: Loại thuê bao (Cố định FTTH / Di động), Kỳ hạn đóng trước, Trạng thái (Hoạt động / Rời mạng), Tháng hết hạn đóng trước, CTV phụ trách.
  - Thêm mới / Cập nhật khách hàng với biểu mẫu kiểm tra định dạng dữ liệu (Zod).
  - Tự động tính toán ngày hết hạn đóng trước dựa trên số tháng trả trước và ngày bắt đầu.
  - Thêm ghi chú khách hàng (`CustomerNote`) và tra cứu toàn bộ lịch sử chỉnh sửa (`EditHistory`).
  - Nút gọi điện và liên kết nhắn tin Zalo nhanh theo số thuê bao.
  - Xóa đơn lẻ và xóa hàng loạt (Bulk Delete - bảo vệ bằng mật khẩu / phân quyền Admin).
  - Import danh sách khách hàng từ file Excel có đối soát lỗi chi tiết theo từng dòng; xuất dữ liệu lọc ra file Excel.

---

### Phân hệ 2: Bản đồ Trực quan & Hạ tầng Kỹ thuật (GIS & Mapping)
- **Đường dẫn**: `/map`, `/node-map`, `/node-0tb`
- **Tiến độ**: **100% Hoàn thành**
- **Chức năng chi tiết**:
  - **Bản đồ Khách hàng (`/map`)**: Gom cụm MarkerCluster hiển thị vị trí khách hàng; tra cứu nhanh thông tin thuê bao trực tiếp trên Popup bản đồ; hỗ trợ định vị GPS hiện tại của nhân viên hiện trường để tạo mới khách hàng ngay tại vị trí đứng.
  - **Bản đồ Node Hạ tầng (`/node-map`)**: Quản lý các hộp cáp/trạm node quang; theo dõi số cổng Internet tổng, cổng đã dùng và tỷ lệ hiệu suất (Port Efficiency); tìm kiếm node theo tên hoặc theo cặp tọa độ `lat, lng`; tìm kiếm node gần nhất kèm khoảng cách mét; tùy chọn layer bản đồ (OpenStreetMap, Vệ tinh Esri, CartoDB).
  - **Bản đồ Node 0TB (`/node-0tb`)**: Phân hệ chuyên sâu phục vụ phòng Kỹ thuật & Kinh doanh theo dõi các node chưa có thuê bao phát sinh để tập trung phát triển thị trường; hỗ trợ tìm kiếm, chỉ đường Google Maps và phân loại node.
  - **Cơ chế gán tự động**: Khi tạo/sửa hoặc import khách hàng có tọa độ, hệ thống tự động tính toán gán thuê bao vào Node gần nhất dựa trên thuật toán địa lý Haversine.

---

### Phân hệ 3: Báo cáo & Đánh giá Hiệu suất (KPI Hub)
- **Đường dẫn**: `/prepaid` (kèm các view: `summary`, `summary-manager`, `kpi-calculator`)
- **Tiến độ**: **100% Hoàn thành**
- **Chức năng chi tiết**:
  - **KPI Cá nhân**: Xem bảng chấm điểm chỉ tiêu hàng ngày của cá nhân CTV, hiển thị kế hoạch tháng, thực hiện ngày, thực hiện lũy kế, % hoàn thành và % tăng trưởng.
  - **Tổng hợp KPI**: Dành cho Quản lý và Admin tổng hợp hiệu suất toàn thể CTV theo từng chỉ số kinh doanh.
  - **KPI Quản lý (`summary-manager`)**: Báo cáo tổng hợp KPI cấp trưởng bộ phận/quản lý, đánh giá mức độ hoàn thành chỉ tiêu của toàn đơn vị với tab tổng hợp `__all__`.
  - **Bộ tính & Mô phỏng KPI (`kpi-calculator`)**: Cho phép CTV và Quản lý tự do điều chỉnh các con số giả định trực tiếp trên giao diện để xem điểm số KPI ước tính mà không làm ảnh hưởng đến cơ sở dữ liệu thật.
  - **Quản lý Cấu hình KPI**: Admin có thể cấu hình điểm cơ sở, trần tối đa %, thứ tự hiển thị, bật/tắt chỉ số, nhóm gộp chỉ số và định nghĩa chỉ số nghịch biến (chỉ số âm - phạt trừ điểm).

---

### Phân hệ 4: Quản lý Cước & Công nợ (Billing)
- **Đường dẫn**: `/prepaid?view=cuoc`, `/prepaid?view=cuoc-cd`, `/prepaid?view=cdt`, `/prepaid?view=cdt-outstanding`
- **Tiến độ**: **100% Hoàn thành**
- **Chức năng chi tiết**:
  - **Báo cáo Thu Cước**: Theo dõi tỷ lệ hoàn thành thu tiền cước phát sinh hàng kỳ so với chỉ tiêu giao (mặc định 97.3%); hiển thị số tiền mục tiêu, số đã thu, số còn thiếu.
  - **Báo cáo Cước Cố Định (Cước CĐ)**: Quản lý số dư đầu kỳ, phát sinh lũy kế, thừa thiếu và tồn chưa thu với chỉ tiêu mặc định 99.5%; hỗ trợ bộ lọc và tính năng sắp xếp đa cột (Multi-column sorting) mượt mà trên cả desktop và mobile.
  - **Báo cáo Giao dịch CDT**: Theo dõi chi tiết các giao dịch khách hàng đóng tiền trước theo ngày, theo CTV và gói cước.
  - **Báo cáo Tồn CDT (Outstanding CDT)**: Tra cứu danh sách các thuê bao sắp đến hạn phải gia hạn đóng cước trước, hỗ trợ CTV chủ động liên hệ chăm sóc khách hàng trước khi bị cắt dịch vụ.

---

### Phân hệ 5: Kiểm soát Rời mạng & Churn (Retention)
- **Đường dẫn**: `/prepaid?view=disconnect`, `/churn-risk`
- **Tiến độ**: **100% Hoàn thành**
- **Chức năng chi tiết**:
  - **Báo cáo Rời mạng (`disconnect`)**: Thống kê danh sách thuê bao hủy mạng hoặc tạm ngưng dịch vụ theo tháng, phân loại cụ thể dịch vụ Internet FTTH hoặc Truyền hình, lý do và thời gian quá hạn.
  - **Cảnh báo Nguy cơ Rời mạng (`/churn-risk`)**: Danh sách thuê bao có dấu hiệu sắp rời mạng được nhập từ hệ thống phân tích; hỗ trợ tìm kiếm, lọc theo CTV và tháng báo cáo để phân bổ nhân viên kịp thời giữ chân khách hàng.

---

### Phân hệ 6: Quản lý Công văn & Văn bản Nội bộ
- **Đường dẫn**: `/prepaid?view=official-docs`
- **Tiến độ**: **100% Hoàn thành**
- **Chức năng chi tiết**:
  - Soạn thảo công văn, thông báo chỉ đạo nội bộ với danh mục phân loại, tóm tắt và nội dung chi tiết.
  - Chế độ Bản nháp (`DRAFT`) và Xuất bản (`PUBLISHED`); hẹn ngày hết hiệu lực; ghim văn bản quan trọng lên đầu danh sách.
  - Đính kèm tệp tài liệu, hình ảnh, video (lưu trữ base64 hoặc đường dẫn ngoài).
  - Tự động ghi vết toàn bộ lịch sử chỉnh sửa văn bản qua bảng `OfficialDocumentRevision`.

---

### Phân hệ 7: Bộ Tiện ích Tác nghiệp Nghiệp vụ (Field Tools)
- **Đường dẫn**: `/tools/**`
- **Tiến độ**: **100% Hoàn thành**
- **Chức năng chi tiết**:
  - **Ghi SIM Thẻ (`/tools/sim`)**: Công cụ thiết kế banner/mockup SIM card phục vụ bán hàng với **hơn 30 mẫu template thiết kế AI đẹp mắt**, hỗ trợ đầy đủ nhận diện thương hiệu Viettel, VinaPhone, MobiFone; tùy chọn định dạng số (4.3.3 hoặc dấu chấm), hỗ trợ tải ảnh trực tiếp hoặc sao chép thẳng vào bộ nhớ tạm (Clipboard) để đăng lên mạng xã hội/Zalo.
  - **Tạo mã thanh toán VietQR (`/tools/qr`)**: Sinh mã QR chuẩn liên ngân hàng Napas 247 / VietQR (kết nối ngân hàng BIDV) tự động điền sẵn số tiền cước và nội dung thanh toán theo mã hợp đồng khách hàng.
  - **Đóng dấu ảnh Hiện trường (`/tools/photo`)**: Đóng dấu bản quyền ảnh chụp nghiệm vụ kỹ thuật: Tự động chèn Logo đơn vị, ngày giờ chụp, địa chỉ và tọa độ GPS lấy từ thiết bị di động.
  - **Tiện ích mở rộng**: Hỗ trợ xuất phiếu thu (`/tools/receipt`) và công cụ lọc/chia tệp Excel lớn (`/tools/excel`).

---

### Phân hệ 8: Quản trị Hệ thống, Lưu trữ & An toàn Dữ liệu
- **Đường dẫn**: `/ctv`, `/logs`, `/archive`, `/change-password`
- **Tiến độ**: **100% Hoàn thành**
- **Chức năng chi tiết**:
  - **Quản lý Tài khoản & Phân quyền (`/ctv`)**: Tạo, sửa thông tin, đặt lại mật khẩu, phân cấp `ADMIN` / `MANAGER` / `CTV`, gán mã quản lý `managerCode` và cấp quyền sử dụng định vị GPS `canUseGps`.
  - **Nhật ký Hệ thống (`/logs`)**: Tra cứu toàn bộ lịch sử thay đổi khách hàng và nhật ký kiểm toán hành vi nhạy cảm (`AuditLog`).
  - **Lưu trữ & Đóng băng Dữ liệu Tháng (`/archive`)**: Chốt số liệu KPI và Cước của các tháng trong quá khứ thành tệp Excel an toàn, khóa quyền chỉnh sửa và cung cấp tiến trình Purge giải phóng dung lượng cơ sở dữ liệu định kỳ (hỗ trợ gọi tự động qua Cron).
  - **Sao lưu & Phục hồi Toàn vẹn (Backup / Restore)**: Admin có thể tải về file backup JSON đầy đủ toàn bộ 24 bảng dữ liệu và khôi phục khi cần thiết.

---

## 4. BẢNG TỔNG KẾT TRẠNG THÁI TÍNH NĂNG & ENTRY POINTS

| Phân hệ / Tính năng | Đường dẫn (Route) | Phân quyền truy cập | Trạng thái hiện tại |
|---|---|:---:|:---:|
| **Đăng nhập & Xác thực** | `/login` | Công khai | ✅ Hoàn thành |
| **Đổi mật khẩu cá nhân** | `/change-password` | Tất cả người dùng | ✅ Hoàn thành |
| **Quản lý Khách hàng (CRM)** | `/customers` | Tất cả (theo scope) | ✅ Hoàn thành |
| **Bản đồ Khách hàng** | `/map` | Tất cả (theo scope) | ✅ Hoàn thành |
| **Bản đồ Node Hạ tầng** | `/node-map` | Tất cả (theo scope) | ✅ Hoàn thành |
| **Bản đồ Node 0TB** | `/node-0tb` | Tất cả người dùng | ✅ Hoàn thành |
| **Nguy cơ Rời mạng** | `/churn-risk` | Tất cả (theo scope) | ✅ Hoàn thành |
| **KPI Cá nhân** | `/prepaid` | Tất cả (theo scope) | ✅ Hoàn thành |
| **Mô phỏng Tính điểm KPI** | `/prepaid?view=kpi-calculator` | Tất cả người dùng | ✅ Hoàn thành |
| **Tổng hợp KPI Đơn vị** | `/prepaid?view=summary` | Admin, Manager | ✅ Hoàn thành |
| **KPI Quản lý** | `/prepaid?view=summary-manager`| Admin, Manager | ✅ Hoàn thành |
| **Báo cáo Thu Cước** | `/prepaid?view=cuoc` | Tất cả (theo scope) | ✅ Hoàn thành |
| **Báo cáo Cước Cố Định (CD)**| `/prepaid?view=cuoc-cd` | Tất cả (theo scope) | ✅ Hoàn thành |
| **Báo cáo Giao dịch CDT** | `/prepaid?view=cdt` | Tất cả (theo scope) | ✅ Hoàn thành |
| **Báo cáo Tồn CDT** | `/prepaid?view=cdt-outstanding`| Tất cả (theo scope) | ✅ Hoàn thành |
| **Báo cáo Thuê bao Rời mạng** | `/prepaid?view=disconnect` | Tất cả (theo scope) | ✅ Hoàn thành |
| **Công văn & Văn bản Nội bộ** | `/prepaid?view=official-docs` | Đọc: Tất cả; Soạn: Admin | ✅ Hoàn thành |
| **Tạo Banner Mockup Ghi SIM** | `/tools/sim` | Tất cả người dùng | ✅ Hoàn thành |
| **Tạo mã thanh toán VietQR** | `/tools/qr` | Tất cả người dùng | ✅ Hoàn thành |
| **Đóng dấu ảnh hiện trường** | `/tools/photo` | Admin, Manager | ✅ Hoàn thành |
| **In phiếu thu cước** | `/tools/receipt` | Admin, Manager (Direct) | ✅ Hoàn thành |
| **Lọc và chia file Excel** | `/tools/excel` | Admin, Manager (Direct) | ✅ Hoàn thành |
| **Quản lý CTV & Người dùng** | `/ctv` | Admin | ✅ Hoàn thành |
| **Nhật ký & Audit Logs** | `/logs` | Admin | ✅ Hoàn thành |
| **Lưu trữ & Purge dữ liệu** | `/archive` | Admin | ✅ Hoàn thành |
| **Backup & Restore 24 bảng** | `/api/admin/backup` | Admin | ✅ Hoàn thành |

---

## 5. NHỮNG ĐIỂM CẢI TIẾN & CHUẨN HÓA NỔI BẬT GẦN ĐÂY

1. **Chuẩn hóa Design System & Accessibility (A11y)**:
   - Thay thế toàn bộ các thông báo trình duyệt thô ráp (`alert()`, `confirm()`) bằng các Dialog/Modal dùng chung có kiểm soát tiêu điểm bàn phím, thông báo kết quả qua Toast mượt mà.
   - Thêm cờ hỗ trợ người dùng nhạy cảm chuyển động (`prefers-reduced-motion`).
   - Đảm bảo kích thước vùng bấm tối thiểu 44px trên giao diện thiết bị di động.
2. **Nâng cấp Phân hệ Bản đồ (GIS Hardening)**:
   - Bản đồ Node (`/node-map`) bổ sung thanh menu Tùy chọn, làm nổi bật kết quả tìm kiếm, hiển thị số lượng node đang lọc / tổng số, hỗ trợ phím mũi tên điều hướng.
   - Bản đồ Node 0TB (`/node-0tb`) được tối ưu hóa responsive, sửa lỗi chồng lấn nút chức năng trên mobile.
3. **Bổ sung Tiện ích Ghi SIM hiện đại (`/tools/sim`)**:
   - Tích hợp 30+ mẫu template AI, hỗ trợ thương hiệu 3 nhà mạng lớn (Viettel, Vina, Mobi) với tính năng vẽ trực tiếp trên HTML5 Canvas và xuất ảnh/copy tức thì.
4. **Nâng cấp Báo cáo Cước Cố Định (`/prepaid?view=cuoc-cd`)**:
   - Hỗ trợ sắp xếp đa cột (Multi-column sort) và bộ chọn tiêu chí sắp xếp chuyên dụng cho màn hình điện thoại di động.
5. **Cơ chế An toàn Dữ liệu & Kiểm thử hồi quy**:
   - Mở rộng phạm vi Backup/Restore lên trọn vẹn 24 bảng dữ liệu, tránh tình trạng thất thoát bảng `Node0Tb`, `CuocCdConfig`, `ChurnRiskRecord`.
   - Bổ sung 37 test suites Vitest bảo vệ kiến trúc dự án không bị lỗi hồi quy khi chỉnh sửa mã nguồn.
6. **Khắc phục & Nâng cấp Phân hệ Khách hàng và Bản đồ (Customer & GIS Fix)**:
   - Sửa lỗi thiếu cột `nodeName` trong DDL migration của bảng `Customer` gây sập API tạo khách hàng trên SQLite/Turso.
   - Tháo bỏ điều kiện chặn `canUseGps` khi bấm "Thêm khách hàng" tại trang `/customers` và thanh công cụ `/map`, đảm bảo CTV/Quản lý trên máy tính để bàn (không có GPS phần cứng) vẫn thao tác thêm bình thường.
   - Bổ sung tính năng cắm mốc trực quan trên Bản đồ khách hàng (`/map`): Click vào bất kỳ vị trí nào trên bản đồ để mở popup xác nhận *"Thêm khách hàng tại vị trí này?"* kèm tọa độ `lat, lng` tự động điền sẵn vào Form.
   - Nới lỏng regex kiểm tra số điện thoại hỗ trợ cả số cố định 11 số (`02...`) lẫn di động 10 số (`09...`).
   - Kiểm thử thực tế thành công: Tạo khách hàng mới có tọa độ thực tế và tự động tính toán gán vào Node trạm gần nhất.

---

## 6. HƯỚNG DẪN CÀI ĐẶT & VẬN HÀNH

### 6.1 Yêu cầu môi trường
- **Node.js**: Phiên bản 20+ (hoặc Node.js 18 LTS trở lên).
- **Cơ sở dữ liệu**:
  - Tùy chọn 1 (Khuyến nghị production): Tài khoản Turso Database (`libsql://...`).
  - Tùy chọn 2 (Phát triển nội bộ): File SQLite local (`dev.db`).

### 6.2 Các bước khởi chạy dự án
```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Thiết lập biến môi trường
cp .env.example .env
# Chỉnh sửa file .env với thông số kết nối Database và mã bí mật AUTH_SECRET

# 3. Đồng bộ cấu trúc Database (chạy migrations vào Turso/SQLite)
npm run db:migrate

# 4. Khởi chạy máy chủ phát triển (Development Server)
npm run dev
# Truy cập hệ thống tại: http://localhost:3000

# 5. Chạy kiểm thử tự động
npm test

# 6. Đóng gói cho Production
npm run build
npm start
```

---

## 7. ĐÁNH GIÁ TỔNG KẾT & ĐỊNH HƯỚNG TIẾP THEO

- **Đánh giá chung**: Dự án có nền tảng mã nguồn rất hoàn chỉnh, kiến trúc phân lớp sạch sẽ, đã bao phủ hầu hết các nhu cầu nghiệp vụ thực tế của đơn vị viễn thông từ cấp cộng tác viên cơ sở đến cấp quản lý và lãnh đạo.
- **Khuyến nghị tiếp theo**:
  1. Chạy `npm install` để kích hoạt đầy đủ môi trường thực thi cục bộ.
  2. Thiết lập kết nối Turso Database trên môi trường đám mây và cấu hình `CRON_SECRET` để hệ thống tự động lưu trữ/dọn dẹp dữ liệu tháng cũ.
  3. Kiểm thử trải nghiệm cài đặt ứng dụng dạng Web App (PWA) trên các thiết bị Android và iOS của nhân viên thực tế.
