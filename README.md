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
- **Node.js**: Node 24 cho bộ công cụ/CI local hiện tại (Vitest 5 không hỗ trợ Node 18/20).
- **Cơ sở dữ liệu**: Turso Cloud Database (`libsql://...`) hoặc SQLite local (ví dụ database bỏ đi `file:.local/migration-demo.sqlite`)

### Cài Đặt
```bash
# 1. Clone repository và cài đặt dependencies
npm install

# 2. Cấu hình biến môi trường
cp .env.example .env
# Chỉnh sửa file .env với thông tin kết nối database và AUTH_SECRET của bạn

# 3. Chỉ khởi động sau khi database đã qua preflight bên dưới
npm run dev
```

**Preflight trước khi dùng source LOCAL mới với database hiện có.** `npm run db:check-schema` kiểm tra chỉ đọc column/PK/unique và sự hiện diện của các dòng default bắt buộc; phải truyền `DATABASE_URL` tường minh trong process, không tự đọc env file. Thiếu contract báo `SCHEMA_NOT_READY`, không tự tạo bảng/index, seed hay sửa database. Ví dụ chỉ dành cho SQLite bỏ đi và quy trình cutover nằm trong [migration safety](docs/migration-safety.md).

**Không tự migrate database đã phục hồi hoặc Production.** Database chưa có ledger vẫn có thể phục vụ GET nếu đủ runtime contract, nhưng release apply vẫn bị chặn cho tới khi adoption được xác minh. Runner migration mặc định chỉ check; `--apply` cần ledger/checksum hợp lệ hoặc database mới, trống. Thiếu schema trên database hiện có cần kế hoạch upgrade đã kiểm chứng, không replay SQL lịch sử hoặc baseline/no-op mù quáng.

---

## 3. Các Lệnh Scripts (CLI)

| Lệnh | Ý nghĩa |
|---|---|
| `npm run dev` | Khởi chạy server development (Turbopack) tại `http://localhost:3000` |
| `npm run build` | Chỉ chạy `next build`; không gọi migration |
| `npm run start` | Khởi chạy server production |
| `npm run lint` | Kiểm tra cú pháp và code style bằng ESLint (`src/`) |
| `npm run db:check` | Đọc trạng thái migration; không DDL/seed/ghi ledger |
| `npm run db:check-schema` | Preflight runtime chỉ đọc qua `scripts/check-runtime-schema.mjs`; mặc định cả 7 domain, có thể chọn `-- --domain kpi` |
| `npm run db:migrate` | Mặc định check; `-- --apply` chỉ cho database thử riêng mới hoặc đã có ledger được xác minh |

Batch3 đã thay toàn bộ runtime `ensure` có DDL bằng guard chỉ đọc; migration thứ 5 `20261026000000_runtime_schema_readiness` bổ sung 6 index không trùng và 3 dòng default bằng `ON CONFLICT DO NOTHING`, giữ nguyên 4 SQL lịch sử. Chủ dự án cho phép công bố source các batch 1–4 lên `main` ngày 27/10/2026; xem checkpoint ở mục 20 của `tiendokpi.md`. Push nguồn có thể kích hoạt Vercel nếu đã liên kết Git, nhưng không xác nhận database đã đủ runtime contract, verified adoption hoặc rollout đã được kiểm chứng. Không tự chèn migration trước build/test/lint. Preview vẫn phải dùng database riêng vì thao tác nghiệp vụ và cron còn ghi dữ liệu, không phải vì guard mới ghi DDL; xem [hướng dẫn triển khai](docs/deploy-online.md) và [migration safety](docs/migration-safety.md).

GET không còn tự import Excel từ `NODE_0TB_DEFAULT_FILE_PATH` / `CUOC_CD_DEFAULT_FILE_PATH`; các tên env cũ này bị bỏ qua. Import thủ công qua Admin UI/API vẫn giữ nguyên. Chỉ POST restore được cấp quyền mới bổ sung lại 3 default còn thiếu sau các dòng phục hồi trong cùng transaction; không seed trên GET hay ghi đè cấu hình tùy chỉnh. Backup JSON v10 vẫn không chứa migration ledger; restore không đồng nghĩa đã adoption.

---

## 4. Kiến Trúc & Công Nghệ Sử Dụng

- **Frontend**: Next.js 16 (React 19), Vanilla CSS Modules, Lucide Icons, Leaflet & MarkerCluster.
- **Backend / API**: Next.js App Router Route Handlers, NextAuth v5 (Credentials JWT).
- **Database**: Prisma ORM kết hợp adapter `@prisma/adapter-libsql` và `@libsql/client`.
- **Dữ Liệu & Excel**: `xlsx`, `date-fns`, `adm-zip`, `@xmldom/xmldom`.
