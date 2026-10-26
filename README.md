# Customer Manager (CRM Viễn Thông & Quản Lý Thuê Bao)

Hệ thống quản lý khách hàng viễn thông, bản đồ node/hạ tầng, KPI, cước, kiểm soát rời mạng và quản lý công văn nội bộ xây dựng trên **Next.js 16 (App Router)**, **NextAuth v5**, **Prisma**, và **Turso (libSQL) / SQLite**.

---

## 1. Tính Năng Chính

- **Quản lý Khách Hàng (CRM)**: Danh sách, tìm kiếm, lọc đa tiêu chí, CRUD khách hàng, ghi chú, lịch sử chỉnh sửa, import/export Excel nâng cao, tính toán tự động ngày hết hạn đóng trước.
- **Bản Đồ Trực Quan**: Bản đồ khách hàng và bản đồ Node hạ tầng bằng Leaflet MarkerCluster, định vị GPS, tìm kiếm theo tọa độ, tự động gán khách hàng vào node gần nhất.
- **Node Hạ Tầng & Node 0TB**: Import KML/KMZ/Excel, quản lý hiệu suất node (dung lượng cổng, port sử dụng, tỷ lệ hiệu suất), phân hệ bản đồ Node 0TB chuyên biệt.
- **KPI & Hiệu Suất**: Báo cáo KPI cá nhân, tổng hợp KPI theo đơn vị, KPI quản lý, công cụ mô phỏng tính điểm KPI theo công thức thực tế.
- **Quản Lý Cước & Thuế Bao**: Báo cáo và cấu hình mục tiêu Cước, Cước Cố Định (Cước CĐ), giao dịch CDT và quản lý tồn CDT.
- **Kiểm Soát Rời Mạng & Churn**: Báo cáo thuê bao rời mạng (FTTH/TV), danh sách thuê bao có nguy cơ rời mạng.
- **Công Văn & Văn Bản Nội Bộ**: Soạn thảo, phê duyệt xuất bản, quản lý đính kèm tài sản và lịch sử phiên bản (revisions).
- **Phân Quyền Đa Cấp (RBAC & Scope)**:
  - `ADMIN`: Toàn quyền quản trị hệ thống, quản lý tài khoản, cấu hình KPI, backup & restore, archive dữ liệu tháng.
  - `MANAGER`: Quản lý danh sách CTV và số liệu của các CTV trực thuộc đội ngũ.
  - `CTV`: Xem và thao tác trên phạm vi khách hàng, cước, KPI của chính mình.
- **Công Cụ Nghiệp Vụ**: Đóng dấu ảnh hiện trường (Photo Editor), sinh mã QR thanh toán (VietQR).

---

## 2. Yêu Cầu Môi Trường & Cài Đặt

### Yêu Cầu
- **Node.js**: Phiên bản 20+ (hoặc 18 LTS trở lên)
- **Cơ sở dữ liệu**: Turso Cloud Database (`libsql://...`) hoặc SQLite local (`file:dev.db`)

### Cài Đặt
```bash
# 1. Clone repository và cài đặt dependencies
npm install

# 2. Cấu hình biến môi trường
cp .env.example .env
# Chỉnh sửa file .env với thông tin kết nối database và AUTH_SECRET của bạn

# 3. Đồng bộ cấu trúc cơ sở dữ liệu
npm run db:migrate

# 4. Khởi động môi trường phát triển (Development)
npm run dev
```

---

## 3. Các Lệnh Scripts (CLI)

| Lệnh | Ý nghĩa |
|---|---|
| `npm run dev` | Khởi chạy server development (Turbopack) tại `http://localhost:3000` |
| `npm run build` | Build bundle production chuẩn tối ưu hóa |
| `npm run start` | Khởi chạy server production |
| `npm run lint` | Kiểm tra cú pháp và code style bằng ESLint (`src/`) |
| `npm run db:migrate` | Áp dụng toàn bộ migrations lên database (hỗ trợ Turso & SQLite) |

---

## 4. Kiến Trúc & Công Nghệ Sử Dụng

- **Frontend**: Next.js 16 (React 19), Vanilla CSS Modules, Lucide Icons, Leaflet & MarkerCluster.
- **Backend / API**: Next.js App Router Route Handlers, NextAuth v5 (Credentials JWT).
- **Database**: Prisma ORM kết hợp adapter `@prisma/adapter-libsql` và `@libsql/client`.
- **Dữ Liệu & Excel**: `xlsx`, `date-fns`, `adm-zip`, `@xmldom/xmldom`.
