# Product Capabilities Audit

> Snapshot audit: Hệ thống đã được nâng cấp toàn diện (Modernization & Security Hardening). Audit bao gồm source, Prisma migrations, Vitest runner, CI/CD pipelines và toàn bộ các modules nghiệp vụ.

## 1. Executive summary

Ứng dụng hiện là một CRM nội bộ cho ba nhóm vai trò `ADMIN`, `MANAGER` và `CTV`, tập trung vào quản lý khách hàng viễn thông, bản đồ khách hàng/node, KPI/Cước/CDT/rời mạng, công văn, lưu trữ dữ liệu tháng và các công cụ nghiệp vụ.

Kết luận chính:

- **A — Hiện đang làm được và đã được chuẩn hóa:** Đăng nhập và phân quyền theo phạm vi CTV/Manager/Admin với Auth Guard (`requireAuth`); CRUD/import/export khách hàng bảo vệ bởi Zod validation; bản đồ khách hàng và node; Node 0TB; KPI cá nhân/tổng hợp/quản lý và mô phỏng KPI; Cước, Cước CĐ, CDT, tồn CDT, rời mạng, nguy cơ rời mạng; công văn; archive tự động hóa với Vercel Cron & GitHub Actions; quản trị tài khoản kèm Audit Log (`AuditLog` cho user & customer deletion; `EditHistory` cho customer field diffs); backup/restore đầy đủ 24 bảng dữ liệu (schema v10); công cụ ảnh, QR, phiếu thu và lọc Excel.
- **B — Đã từng có nhưng không còn hoặc đã bị dọn dẹp:** Dashboard biểu đồ cũ đã xóa; các component mồ côi (`CustomerModal.tsx`, `CustomerNotes.tsx`, legacy panels) và SVG boilerplate đã được dọn sạch khỏi codebase; route thừa `map-detail` đã được gỡ bỏ; các dependency thừa (`recharts`, `react-leaflet-cluster`) đã được loại bỏ.
- **C — Cơ sở dữ liệu và vận hành:** Toàn bộ 24 models đã được hợp nhất vào `prisma/schema.prisma` và 4 migrations SQL tập trung; script `scripts/migrate.mjs` hỗ trợ cả Turso remote và SQLite local với cơ chế fail-fast dừng ngay khi lỗi; hệ thống test tự động Vitest bao phủ 12 test suites với 45 unit tests; pipeline CI tự động kiểm tra Prisma schema, linter, tests và build Next.js trên mỗi commit/PR.

## 2. Quy ước trạng thái và bằng chứng

| Trạng thái | Cách sử dụng trong audit |
|---|---|
| **Active** | Có entry point hiện tại và chuỗi code đủ để thực hiện capability. |
| **Partial/experimental** | Có implementation nhưng phụ thuộc môi trường, thiếu đường vận hành, hoặc chỉ bao phủ một phần use case. |
| **Hidden/feature-flagged** | Code/page còn hoạt động nhưng bị ẩn khỏi navigation hoặc bị chặn bằng cấu hình/proxy/quyền. Repo không có framework feature flag tổng quát. |
| **Deprecated** | Vẫn còn đường dùng nhưng đã bị UI/navigation hoặc implementation mới thay thế. |
| **Removed** | Feature hoặc entry point đã bị xóa khỏi HEAD và được chứng minh bằng Git history. |

`Evidence` chỉ nêu những file, test hoặc commit trực tiếp hỗ trợ kết luận. Các mục không đủ bằng chứng được đưa sang phần C thay vì suy đoán.

## 3. Capability map

| Product area | Capability hiện tại | Đối tượng chính |
|---|---|---|
| Identity & access | Đăng nhập, đăng xuất, đổi mật khẩu, role/scope, quản lý CTV, quyền GPS | Tất cả; quản trị bởi Admin |
| Customer CRM | Danh sách, tìm/lọc, CRUD, import/export, ghi chú, lịch sử, liên hệ Zalo | Admin, Manager, CTV theo scope |
| Geographic operations | Bản đồ khách hàng, bản đồ node, tìm tọa độ, node gần nhất, định tuyến | Admin, Manager, CTV |
| Node operations | Import KML/KMZ/Excel, hiệu suất node, mapping thuê bao-node, Node 0TB | Đọc: tất cả; ghi/import chủ yếu Admin |
| KPI & performance | KPI cá nhân, tổng hợp, KPI quản lý, cấu hình và mô phỏng | Tất cả theo mức quyền; cấu hình/import bởi Admin |
| Billing | Cước và Cước CĐ: import, báo cáo, cấu hình tỷ lệ | Tất cả theo scope; import/config tùy role |
| CDT & outstanding | Giao dịch CDT, tổng hợp, tồn CDT, export/template | Tất cả theo scope; import/export chủ yếu Admin |
| Disconnect & churn | Rời mạng và nguy cơ rời mạng | Tất cả theo scope; import bởi Admin |
| Official documents | Công văn, tài sản đính kèm, publish, revision | Đọc published: tất cả; quản trị: Admin |
| Archive & operations | Chốt/xuất/xóa dữ liệu tháng, cron purge, backup/restore, edit logs | Admin |
| Business tools | Sửa ảnh hiện trường, QR thanh toán, phiếu thu, lọc/chia Excel | QR: tất cả; công cụ khác: Admin/Manager |
| Platform | Theme, responsive shell, PWA manifest/cache plugin | Tất cả; PWA chỉ xác nhận ở mức cấu hình |

## 4. Roles và personas

| Role/persona | Phạm vi đã xác minh | Bằng chứng | Ghi chú |
|---|---|---|---|
| `ADMIN` | Toàn bộ customer scope; quản lý user/CTV; import/config nhiều phân hệ; archive, logs, backup/restore, công văn quản trị | `src/lib/scope.ts`, `src/components/Sidebar.tsx`, `src/app/api/users/route.ts`, `src/app/api/admin/backup/route.ts` | `getAllowedCtvCodes()` trả `null`, được dùng như toàn quyền dữ liệu. |
| `MANAGER` | Khách hàng và báo cáo thuộc các CTV có `managerCode` trùng username quản lý; xem tổng hợp KPI; dùng tool ảnh/phiếu thu/Excel | `src/lib/scope.ts`, `src/components/Sidebar.tsx`, `src/app/api/kpi/manager-summary/route.ts` | Scope được cache in-memory 30 giây. |
| `CTV` | Dữ liệu mang mã CTV bằng username của chính mình; KPI/Cước/CDT/rời mạng theo scope; QR và các bản đồ | `src/lib/scope.ts`, `src/components/Sidebar.tsx`, các report routes | Một số API có kiểm tra khác UI; xem phần limitation. |
| Người chưa đăng nhập | Chỉ màn hình login và các asset công khai cần cho app | `src/app/login/page.tsx`, `src/app/(dashboard)/layout.tsx` | Dashboard layout redirect về `/login`. Một số endpoint template/config chưa có auth đầy đủ, xem limitation. |

## 5. A — Capabilities hiện tại

### 5.1 Identity, access và application shell

| ID | Capability | Role | Làm gì / entry point | Backend, data, integrations | Trạng thái, evidence và limitation |
|---|---|---|---|---|---|
| IAM-01 | Đăng nhập bằng tài khoản nội bộ | User có `User` hợp lệ | `/login`; credentials username/password; tạo JWT session | `src/auth.ts`; Prisma `User`; `bcryptjs`; NextAuth Credentials | **Active.** Evidence: `src/auth.ts`, `src/app/login/page.tsx`, `src/app/api/auth/[...nextauth]/route.ts`. Username có fallback so khớp không phân biệt hoa thường. |
| IAM-02 | Đăng xuất và bảo vệ dashboard | Mọi user đã đăng nhập | Logout từ sidebar; toàn bộ `(dashboard)` redirect khi thiếu session | NextAuth session; server layout | **Active.** Evidence: `src/app/(dashboard)/layout.tsx`, `src/components/Sidebar.tsx`. |
| IAM-03 | Đổi mật khẩu cá nhân | Admin, Manager, CTV | `/change-password`; xác minh mật khẩu cũ, mật khẩu mới tối thiểu 6 ký tự | `POST /api/change-password`; `User.password`; bcrypt | **Active.** Evidence: `src/app/(dashboard)/change-password/page.tsx`, `src/app/api/change-password/route.ts`. Rate limit 8 request/phút/IP tại `src/proxy.ts`. |
| IAM-04 | Scope dữ liệu theo role | Admin, Manager, CTV | Dùng xuyên customer/report APIs để giới hạn mã CTV | `src/lib/scope.ts`; `User.username`, `role`, `managerCode` | **Active.** Admin = mọi scope; CTV = username; Manager = danh sách CTV trực thuộc. Cache tiến trình 30 giây, không dùng shared cache. |
| IAM-05 | Quản lý CTV/user | Admin | `/ctv`; tạo, sửa, xóa user; đặt role, manager/secondary code, quyền GPS | `/api/users`, `/api/users/[id]`; Prisma `User` | **Active.** Evidence: `src/app/(dashboard)/ctv/page.tsx`, `src/app/(dashboard)/ctv/CtvClient.tsx`, các users routes. `GET /api/users` có vấn đề quyền với CTV, xem limitation. |
| IAM-06 | Theme và responsive navigation | Mọi user | Chuyển light/dark, lưu localStorage; sidebar responsive; nhóm menu KPI/tools | Client shell/CSS | **Active.** Evidence: `src/components/Sidebar.tsx`, `src/components/ThemeProvider.tsx`. Sidebar hiện có link KPI quản lý bị lặp. |

### 5.2 Customer CRM

| ID | Capability | Role | Làm gì / entry point | Backend, data, integrations | Trạng thái, evidence và limitation |
|---|---|---|---|---|---|
| CRM-01 | Danh sách, tìm kiếm và lọc khách hàng | Admin, Manager, CTV theo scope | `/customers`; search, loại thuê bao, kỳ đóng trước, trạng thái, hết hạn, CTV; phân trang | `GET /api/customers`; `src/hooks/useCustomers.ts`; Prisma `Customer` | **Active.** Evidence: `src/app/(dashboard)/customers/page.tsx`, `src/app/api/customers/route.ts`. |
| CRM-02 | Tạo và sửa khách hàng | Admin, Manager, CTV theo scope | Modal khách hàng; tài khoản, tên, điện thoại, địa chỉ, gói, giá, ngày đóng trước, GPS, trạng thái | `POST /api/customers`, `PUT /api/customers/[id]`; `Customer`; mapping node | **Active.** Evidence: `CustomerModalRefined.tsx`, customer routes. UI dùng `canUseGps`, nhưng API create không kiểm tra cờ này. |
| CRM-03 | Xóa khách hàng | User có session/scope; bulk chỉ Admin | Xóa một bản ghi từ UI/API; Admin xóa hàng loạt | `DELETE /api/customers/[id]`, `POST /api/customers/bulk`; `Customer`, notes/mapping liên quan | **Active.** Evidence: customer detail/bulk routes. API xóa đơn cho mọi role trong scope, rộng hơn kỳ vọng quản trị. |
| CRM-04 | Import Excel khách hàng | User đã đăng nhập theo logic route | Upload Excel, map cột, tạo/cập nhật một phần, kiểm tra trùng và trả file lỗi | `POST /api/import`; `xlsx`; `Customer`; node assignment | **Active.** Evidence: `src/app/api/import/route.ts`, `src/components/ImportModal.tsx`; commits `8a2a118`, `f31b476`. Proxy rate limit 6/phút/IP. |
| CRM-05 | Export và template khách hàng | User đã đăng nhập; export tọa độ có hạn chế Admin trong UI/API | Export tập lọc, danh sách hết hạn tháng, tọa độ; tải template | `/api/export`, `/api/template`; `xlsx`; `Customer` | **Active.** Evidence: export/template routes và `src/app/(dashboard)/customers/page.tsx`. `/api/template` không thấy auth guard. |
| CRM-06 | Tính kỳ hết hạn đóng trước | User nhập/sửa/import khách hàng | Tính ngày/kỳ hết hạn từ tháng bắt đầu và số tháng đóng trước; lọc/export hết hạn | Client date input và customer query/export | **Active.** Evidence: `src/components/CustomerDateInput.tsx`, customers page/API. Màn hình riêng cũ đã bị thay thế, xem HIST-02. |
| CRM-07 | Ghi chú khách hàng | Admin, Manager, CTV theo scope | Xem/thêm ghi chú; tác giả hoặc Admin được xóa | `/api/customers/[id]/notes`; Prisma `CustomerNote`, `User` | **Active.** Evidence: notes route, `CustomerNotesRefined.tsx`, commit `c3647f2`. |
| CRM-08 | Lịch sử chỉnh sửa khách hàng | Admin xem log; thay đổi được ghi cho CTV/Manager | Ghi diff create/update; Admin xem, lọc, xóa log | `/api/logs`; Prisma `EditHistory`; customer POST/PUT | **Active nhưng không đầy đủ.** Evidence: customer routes, logs route/page. Thay đổi do Admin không được ghi trong create/update hiện tại. |
| CRM-09 | Liên hệ nhanh | User xem khách hàng | Click số điện thoại và mở Zalo theo số | Client-generated links; Zalo deep/web link | **Active.** Evidence: refined table/modal, map popup; commit `0c8a310`. Không có Zalo API hoặc đồng bộ danh bạ. |
| CRM-10 | Mobile refresh và UX responsive | User mobile | Pull-to-refresh, bảng/card responsive và modal tối ưu mobile | Client components | **Active.** Evidence: `src/hooks/usePullToRefresh.ts`, customers UI; commit `e029d2c`. |

### 5.3 Customer map và node map

| ID | Capability | Role | Làm gì / entry point | Backend, data, integrations | Trạng thái, evidence và limitation |
|---|---|---|---|---|---|
| GEO-01 | Bản đồ khách hàng | Admin, Manager, CTV theo scope | `/map`; marker/cluster, popup chi tiết, tìm khách hàng phía server | `/api/customers/map-data`, `/api/customers/search-map`, `/api/customers/[id]`; `Customer` | **Active.** Evidence: `CustomerMap.tsx`, map routes, `src/hooks/useMapSearch.ts`. |
| GEO-02 | Lớp nền và điều hướng bản đồ | User bản đồ | Chuyển OpenStreetMap/CartoDB/Esri; mở chỉ đường Google Maps | Leaflet tiles; external map links | **Active.** Evidence: customer/node map components. Phụ thuộc dịch vụ tile bên ngoài và trình duyệt. |
| GEO-03 | Vị trí hiện tại và cập nhật tọa độ | User; tạo tại GPS bị UI giới hạn bởi `canUseGps` | Browser geolocation, chọn điểm trên bản đồ, sửa tọa độ, tạo khách hàng tại vị trí hiện tại | Geolocation API; customer API; `Customer.latitude/longitude` | **Active.** Evidence: `CustomerMap.tsx`, `CustomerModalRefined.tsx`, commit `011f55a`. Không có bằng chứng API thực thi `canUseGps`. |
| GEO-04 | Bản đồ node và tìm tọa độ | Admin, Manager, CTV | `/node-map`; tìm node theo tên hoặc `lat,lng`, chọn node gần nhất, lọc trạng thái/bán kính | `/api/nodes`, `/api/node-search-map`; Prisma `Node` | **Active.** Evidence: `NodeMapComponent.tsx`, node routes; commits `e0777f9`, `21cf430`. |
| GEO-05 | Export node đang lọc | User có quyền vào node map | Xuất Excel tập node theo bộ lọc hiện tại | Client export; `xlsx`; `Node` data từ API | **Active.** Evidence: `NodeMapComponent.tsx`; commit `21cf430`. |
| GEO-06 | Gán khách hàng vào node | User trong customer scope; import mapping chủ yếu Admin | Gán node gần nhất khi tạo/sửa/import; tra danh sách thuê bao trong popup node | customer APIs, `/api/nodes/upload`; `CustomerNodeMapping`, `Customer`, `Node` | **Active.** Evidence: `src/lib/customer-node-assignment.ts`, `customer-node-mapping-db.ts`, node upload route. Mapping dùng bảng runtime ngoài Prisma schema. |

### 5.4 Node operations

| ID | Capability | Role | Làm gì / entry point | Backend, data, integrations | Trạng thái, evidence và limitation |
|---|---|---|---|---|---|
| NODE-01 | Import dữ liệu node địa lý | Admin | Upload KML/KMZ/Excel từ node map | `POST /api/nodes/upload`; `adm-zip`, `@xmldom/xmldom`, `xlsx`; `Node` | **Active.** Evidence: node upload route, `NodeMapComponent.tsx`. Route từng bị xóa tạm rồi restore trong commits `5eaa537` → `6fc08a5`. |
| NODE-02 | Import hiệu suất node | Admin | Upload tổng/cổng dùng, hiệu suất, ngày khai thác, trạng thái; tải template | `/api/nodes/upload`, `/api/nodes/template`; runtime ALTER `Node` | **Active.** Evidence: `src/lib/node-efficiency-db.ts`, node routes; commits `a580e80`, `37aa6ad`. Các cột không có trong Prisma schema/migration. |
| NODE-03 | Import mapping thuê bao-node | Admin | Đọc Excel, nhận diện alias/header, map account vào node, báo lỗi chi tiết | `/api/nodes/upload`; `CustomerNodeMapping`; `xlsx` | **Active.** Evidence: node upload route, `customer-node-mapping-db.ts`; commits `6fc08a5`, `07b3549`. |
| NODE-04 | Bản đồ Node 0TB | Mọi user đã đăng nhập xem; Admin quản trị dữ liệu | `/node-0tb`; cluster, loại node, search/list, GPS/node gần nhất, copy và chỉ đường | `/api/node0tb`; runtime `Node0Tb`; Leaflet/Google Maps | **Active với phụ thuộc môi trường.** Evidence: node-0tb page/component/API/db; commit `a0ff517`. Auto-seed mặc định trỏ file tuyệt đối máy phát triển nếu bảng rỗng. |
| NODE-05 | Import/xóa/template Node 0TB | Admin | Upload Excel, tải template, xóa dataset | `/api/node0tb/upload`, `/api/node0tb/template`, `DELETE /api/node0tb`; `Node0Tb` | **Active.** Evidence: các route Node0TB và UI controls. |

### 5.5 KPI và performance management

| ID | Capability | Role | Làm gì / entry point | Backend, data, integrations | Trạng thái, evidence và limitation |
|---|---|---|---|---|---|
| KPI-01 | KPI cá nhân | Admin, Manager, CTV theo scope | `/prepaid` mặc định; xem KPI theo ngày/tháng và metric | `/api/kpi/report`; runtime `KpiDailyResult`, `KpiMetricConfig` | **Active.** Evidence: `PersonalKpiPanelClean.tsx`, report route, `kpi-db.ts`. |
| KPI-02 | Import KPI GBOC | Admin | Upload Excel kết quả KPI | `POST /api/kpi/import`; `xlsx`; `KpiDailyResult` | **Active.** Evidence: KPI import route/panel. Rate limit 6/phút/IP. |
| KPI-03 | Cấu hình metric KPI | Admin; cấu hình được hiển thị trong quản trị CTV | Đặt điểm cơ sở, max %, thứ tự, bật/tắt, metric âm, nhóm gộp | `/api/kpi/config`; `KpiMetricConfig` | **Active.** Evidence: config route, `CtvClient.tsx`, `kpi-db.ts`. |
| KPI-04 | Tổng hợp KPI | Admin, Manager | `/prepaid?view=summary`; tổng hợp CTV/metric | `/api/kpi/summary`; KPI runtime tables | **Active.** Evidence: `SummaryKpiPanelClean.tsx`, summary route, sidebar guard. |
| KPI-05 | KPI quản lý và tổng hợp toàn đơn vị | Admin, Manager | `/prepaid?view=summary-manager`; chọn quản lý hoặc tab `__all__` | `/api/kpi/manager-summary`, `/api/kpi/manager-import`; `ManagerKpiDailyResult`, `User` | **Active.** Evidence: `ManagerSummaryKpiPanelClean.tsx`, API routes; commits `a6780ef`, `12d222b`, `151f429`. Import do Admin. |
| KPI-06 | Mô phỏng KPI | Admin, Manager, CTV | `/prepaid?view=kpi-calculator`; thay đổi số liệu client và xem điểm/tổng giả lập; reset | Dữ liệu nền từ `/api/kpi/report`; client calculation; không lưu DB | **Active.** Evidence: `KpiCalculatorPanelClean.tsx`, `src/lib/kpi-calculator.ts`, `kpi-calculator-change-summary.test.ts`; commits `fd857ec`, `1359305`. Chỉ mô phỏng, không persistence. |
| KPI-07 | Công thức điểm âm/dương và nhóm gộp | Người xem KPI | Tính điểm theo target/max, metric âm, Cước N1–N3 và merge group | `src/lib/kpi-calculation.ts`; KPI config/results | **Active.** Evidence: calculation library và KPI APIs/components. |

### 5.6 Billing: Cước và Cước cố định

| ID | Capability | Role | Làm gì / entry point | Backend, data, integrations | Trạng thái, evidence và limitation |
|---|---|---|---|---|---|
| BILL-01 | Báo cáo Cước | Admin, Manager, CTV theo scope | `/prepaid?view=cuoc`; báo cáo theo kỳ/CTV, tỷ lệ và tổng hợp | `/api/cuoc/report`; `CuocDailyResult`, `CuocConfig` | **Active.** Evidence: `CuocPanelClean.tsx`, report route. CTV được xem dữ liệu mình nhưng UI ẩn filter/control/summary. |
| BILL-02 | Import và cấu hình Cước | Import/config: Admin; config read: Admin/Manager | Upload Excel; đặt target mặc định 97,3% và tham số liên quan | `/api/cuoc/import`, `/api/cuoc/config`; `xlsx`; runtime tables | **Active.** Evidence: routes, `kpi-db.ts`, commit `b53767f`. Import bị chặn khi tháng archive đã confirm. |
| BILL-03 | Báo cáo Cước CĐ | Admin, Manager, CTV theo scope | `/prepaid?view=cuoc-cd`; báo cáo cố định, lọc CTV | `/api/cuoc-cd/report`; `CuocCdDailyResult`, `CuocCdConfig` | **Active.** Evidence: `CuocCdPanelClean.tsx`, report route; commit `31da55a`. |
| BILL-04 | Import và cấu hình Cước CĐ | Import: Admin/Manager; update config: Admin | Upload Excel; target mặc định 99,5% | `/api/cuoc-cd/import`, `/api/cuoc-cd/config`; runtime tables; `xlsx` | **Active nhưng có điểm hở.** Config GET không thấy auth guard. Import có nhánh đọc file mặc định tuyệt đối trên máy phát triển nếu file tồn tại. |

### 5.7 CDT, tồn CDT, rời mạng và churn

| ID | Capability | Role | Làm gì / entry point | Backend, data, integrations | Trạng thái, evidence và limitation |
|---|---|---|---|---|---|
| OPS-01 | Giao dịch CDT | Admin, Manager, CTV theo scope | `/prepaid?view=cdt`; tìm/lọc giao dịch theo ngày, CTV, loại thuê bao | `/api/cdt/report`; `CdtTransaction` | **Active.** Evidence: `CdtPanelClean.tsx`, report route, `kpi-db.ts`; commit `17ec5bf`. |
| OPS-02 | Import/export và tổng hợp CDT | Import/export: Admin; summary: Admin/Manager | Import Excel, export tháng, xem tổng hợp | `/api/cdt/import`, `/api/cdt/export`, `/api/cdt/summary`; `xlsx`; `CdtTransaction` | **Active.** Evidence: CDT routes và panel. |
| OPS-03 | Tồn CDT | Tất cả theo scope; import Admin | `/prepaid?view=cdt-outstanding`; tình trạng, hết hạn, match account và chi tiết; template/import | `/api/cdt/outstanding/report`, `/import`, `/template`; `CdtOutstandingRecord`, `Customer` | **Active.** Evidence: `CdtOutstandingPanelClean.tsx`, outstanding routes. |
| OPS-04 | Rời mạng | Tất cả theo scope; import Admin | `/prepaid?view=disconnect`; lọc tháng báo cáo/hủy, nguồn, CTV/manager/account; trạng thái quá hạn | `/api/disconnect/report`, `/import`, `/template`; `DisconnectRecord`; `xlsx` | **Active.** Evidence: `DisconnectPanelClean.tsx`, routes, `disconnect-ui.test.ts`, `disconnect-ctv-map.test.ts`; commit `74707e1`. Có template riêng FTTH/TV. |
| OPS-05 | Nguy cơ rời mạng | Tất cả theo scope; import Admin | `/churn-risk`; list/search/tháng/pagination và upload Excel | `/api/churn-risk/report`, `/api/churn-risk/import`; `ChurnRiskRecord` | **Active.** Evidence: churn-risk page/routes; commit `0f462a3`. Bảng runtime không nằm trong backup hiện tại. |

### 5.8 Công văn

| ID | Capability | Role | Làm gì / entry point | Backend, data, integrations | Trạng thái, evidence và limitation |
|---|---|---|---|---|---|
| DOC-01 | Tra cứu công văn đã công bố | Admin, Manager, CTV | `/prepaid?view=official-docs`; tìm kiếm, category, pinned/order; user thường chỉ thấy `PUBLISHED` chưa hết hạn | `/api/official-docs`; `OfficialDocument`, assets | **Active.** Evidence: `OfficialDocsPanelClean.tsx`, official-doc routes/db; commit `bdcd63a`. |
| DOC-02 | Soạn, xuất bản và quản lý công văn | Admin | Tạo/sửa/xóa, draft/publish, ngày hết hạn, pin/thứ tự, link ngoài, nội dung | `/api/official-docs`, `/api/official-docs/[id]`; runtime document tables | **Active.** Evidence: panel, document routes, `official-docs-db.ts`. |
| DOC-03 | Tệp, ảnh/video nhúng và revision | Admin ghi; user đọc tài sản published | Upload asset tạm/chính, lưu file base64 hoặc external URL, xem lịch sử revision | `/api/official-docs/upload`, `/assets/*`, `/temp/*`, document id route; document asset/revision tables | **Active.** Evidence: official-doc routes/db; commit `49404d4`. Lưu binary dạng base64 trong DB có rủi ro tăng kích thước. |

### 5.9 Archive, audit và vận hành dữ liệu

| ID | Capability | Role | Làm gì / entry point | Backend, data, integrations | Trạng thái, evidence và limitation |
|---|---|---|---|---|---|
| ADM-01 | Archive KPI/Cước theo tháng | Admin | `/archive`; export XLSX, confirm tháng quá khứ, khóa import, hủy trước purge | `/api/archive/export`, `/confirm`, `/cancel`, `/status`; `ArchiveLog`, `ArchiveExportLog` | **Active.** Evidence: archive page/routes, `kpi-db.ts`; commit `7db6446`. Confirm yêu cầu export đủ mới và chỉ cho tháng quá khứ. |
| ADM-02 | Purge dữ liệu archive | Admin; cron secret cho endpoint tự động | Xóa thủ công hoặc tự động sau 2 ngày; status/export/confirm/cancel cũng kích hoạt kiểm tra purge hết hạn | `/api/archive/purge`, `/api/archive/cron`; archive service/tables | **Active thủ công; cron là Partial.** Evidence: archive routes. Không có `vercel.json` hay scheduler config trong repo; `ARCHIVE_CRON_SECRET` không có trong `.env` hiện tại. |
| ADM-03 | Xem và xóa edit logs | Admin | `/logs`; phân trang, lọc client theo action/search, xem diff, xóa theo id/khoảng | `/api/logs`; Prisma `EditHistory` | **Active.** Evidence: logs page/API. Nguồn log không bao phủ thay đổi do Admin. |
| ADM-04 | Backup và restore dữ liệu | Admin | Tải JSON backup; upload restore ghi đè các bảng được hỗ trợ | `/api/admin/backup`; Prisma + SQL runtime tables | **Active nhưng không toàn phần.** Evidence: backup route/logs UI. Thiếu `CuocCdDailyResult`, `CuocCdConfig`, `ChurnRiskRecord`, `Node0Tb`; xem limitation. |

### 5.10 Business tools

| ID | Capability | Role | Làm gì / entry point | Backend, data, integrations | Trạng thái, evidence và limitation |
|---|---|---|---|---|---|
| TOOL-01 | Sửa/đóng dấu ảnh hiện trường | Admin, Manager | `/tools/photo`; chọn ảnh/logo, đơn vị, thời gian, tọa độ, chọn vị trí, zoom và tải ảnh | Static tool asset qua `/api/tools/assets/[...path]`; browser geolocation; Leaflet; html2canvas CDN | **Active.** Evidence: photo page, `ToolPageFrameClean.tsx`, `tool-assets/photo-editor`. Không lưu dữ liệu app. |
| TOOL-02 | Tạo QR thanh toán | Admin, Manager, CTV | `/tools/qr`; nhập mã hợp đồng, tiền/nội dung tùy chọn, preview/copy/download | `/api/tools/qr-image`; `src/lib/tools-qr.ts`; `img.vietqr.io` BIDV | **Active.** Evidence: QR page/API/library and `next.config.ts` remote image host. Phụ thuộc endpoint ảnh VietQR. |
| TOOL-03 | Phiếu thu | Admin, Manager qua URL trực tiếp | `/tools/receipt`; nhập/import danh sách, cấu hình người thu/đơn vị/kỳ và in phiếu | Static tool assets; client-side `xlsx`/printing | **Hidden/feature-flagged (navigation).** Evidence: receipt page and assets still exist; commit `bf805e3` removed menu entry. Không bị xóa hoặc block route. |
| TOOL-04 | Lọc/chia Excel | Admin, Manager qua URL trực tiếp | `/tools/excel`; đọc workbook, lọc nhiều cột, helper quản lý/nhân viên, export gộp hoặc chia file | Static tool assets; `/api/users`; ExcelJS/FileSaver/JSZip/XLSX CDN | **Hidden/feature-flagged (navigation).** Evidence: excel page/assets; commit `bf805e3`. Không có menu hiện tại. |

### 5.11 Platform capability

| ID | Capability | Role | Làm gì / entry point | Backend, data, integrations | Trạng thái, evidence và limitation |
|---|---|---|---|---|---|
| PLAT-01 | Cài đặt dạng PWA | User trình duyệt hỗ trợ | Manifest tên Customer Viewer, start URL `/map`, icon và service-worker generation | `next-pwa`; `next.config.ts`; `public/manifest.json` | **Partial/experimental.** Có cấu hình build và commit `43fdbda`, nhưng không có test hoặc tài liệu chứng minh install/offline hoạt động trên build hiện tại; config ghi chú vấn đề Turbopack. |
| PLAT-02 | LibSQL/Turso hoặc SQLite local | Toàn ứng dụng | Prisma dùng adapter libSQL; URL/token chọn local/remote database | `src/lib/prisma.ts`; `@prisma/adapter-libsql`, `@libsql/client`; env | **Active infrastructure.** `DATABASE_URL` và tùy chọn `TURSO_AUTH_TOKEN`; fallback local SQLite. Không phải capability UI. |

## 6. B — Capability đã từng có nhưng không còn hoặc đã được thay thế

| ID | Capability lịch sử | Trước đây làm gì | Trạng thái hiện tại | Evidence Git và code hiện tại |
|---|---|---|---|---|
| HIST-01 | Dashboard tổng quan/biểu đồ | Root dashboard có cards/charts và `/api/dashboard` | **Removed/Replaced.** Root redirect thẳng `/customers`. | Added trong `334a36c`; removed bởi `a92f46c`, xóa `DashboardCharts.tsx`, dashboard CSS và `src/app/api/dashboard/route.ts`; hiện `src/app/(dashboard)/page.tsx` chỉ redirect. README vẫn mô tả dashboard. |
| HIST-02 | Màn hình riêng khách hàng đóng trước sắp hết hạn | `/prepaid` từng hiển thị danh sách khách hàng đóng trước hết hạn trong tháng | **Removed/Replaced.** Route `/prepaid` chuyển thành trung tâm KPI; capability lọc/export hết hạn còn ở `/customers`. | Added `ea9c6a1`; replaced `1d7ac95`; current evidence ở customers page/export API. |
| HIST-03 | Customer Drawer trên bản đồ | Mở chi tiết khách hàng bằng drawer | **Removed/Replaced.** Dùng Leaflet popup. | Added `1868d8f`, reverted/replaced `2f8e425` cùng ngày 2026-03-08; current `CustomerMap.tsx`. |
| HIST-04 | Route/menu riêng “tổng hợp toàn bộ quản lý” | Một route/menu độc lập cho manager KPI all | **Removed/Replaced.** Dùng tab `__all__` trong KPI quản lý. | Commits `12d222b` → `151f429`; current `ManagerSummaryKpiPanelClean.tsx`. |
| HIST-05 | Phiếu thu và Excel trong menu Tools | Hai tool được hiển thị trong menu và `/tools` launcher | **Deprecated/Hidden**, không phải removed. Page còn dùng trực tiếp cho Admin/Manager; `/tools` chuyển sang photo. | Added `420f94e`/`6bf58a5`; hidden bởi `bf805e3`; current receipt/excel pages và `ToolPageFrameClean.tsx`. |
| HIST-06 | Default dark map | Map từng được đổi mặc định sang dark | **Removed/Reverted.** Mặc định quay về light. | `88f7d4a` rồi `a8dd487` ngày 2026-03-08. Người dùng vẫn có thể chọn layer khác. |
| HIST-07 | Central API auth gate bằng `getToken` trong middleware | Middleware từng kiểm tra token tập trung cho API | **Removed một phần.** Proxy hiện chỉ rate-limit/chặn setup-seed; auth nằm ở route handlers. | Added/hardened `ebee837`, removed gate `de995e8`; current `src/proxy.ts`. Không đồng nghĩa toàn bộ auth bị xóa. |

## 7. C — Code/hạ tầng chưa đủ bằng chứng là feature thực tế

| ID | Thành phần | Bằng chứng tồn tại | Vì sao chưa thể coi là capability vận hành |
|---|---|---|---|
| INFRA-01 | Setup database qua `/api/setup` | `src/app/api/setup/route.ts`, `SETUP_SECRET` | `src/proxy.ts` trả 404 cho route này. Setup chỉ tạo một số bảng cũ và không phản ánh đầy đủ runtime schema hiện tại. |
| INFRA-02 | Seed admin qua `/api/seed` | `src/app/api/seed/route.ts`, env `SEED_ADMIN_*` | Proxy chặn 404; route còn yêu cầu session Admin, secret và password >=12. README mô tả flow cũ không còn đúng. |
| INFRA-03 | Archive cron tự động | `src/app/api/archive/cron/route.ts`, `ARCHIVE_CRON_SECRET` | Không có scheduler/deployment config trong repo và biến không có trong `.env` hiện tại. Endpoint có thể chạy nếu hệ thống ngoài gọi, nhưng không chứng minh có lịch thực tế. |
| INFRA-04 | PWA offline/install hoàn chỉnh | `next-pwa`, manifest, icons | Không có kiểm thử service worker/offline/install; plugin bị disable ở development và config ghi chú Turbopack. |
| INFRA-05 | Script migrate/Prisma probe | `migrate-turso.mjs`, `test-prisma.js` | Không nằm trong `package.json` scripts và không có runbook chứng minh dùng trong vận hành. |
| INFRA-06 | Analytics/telemetry | Không tìm thấy SDK, event catalog hoặc lệnh track | Không có bằng chứng để liệt kê analytics như feature. Chuỗi “segment” trong CSS chỉ là segmented control. |

## 8. Integrations

| Integration | Dùng cho | Evidence | Ghi chú |
|---|---|---|---|
| Turso/libSQL/SQLite | Persistence qua Prisma adapter | `src/lib/prisma.ts`, `package.json` | Hỗ trợ URL local và token remote; schema runtime phân tán. |
| NextAuth Credentials + bcrypt | Session và xác thực mật khẩu | `src/auth.ts`, auth route | JWT session; không có OAuth/SSO. |
| Leaflet + markercluster | Bản đồ khách hàng/node/Node0TB/công cụ ảnh | map components, `package.json` | Tile từ OpenStreetMap, CartoDB, Esri; marker asset có nguồn ngoài. |
| Google Maps | Link chỉ đường | customer/node/Node0TB map components | Chỉ deep link/web URL, không thấy Google Maps SDK/API key. |
| Zalo | Mở chat/liên hệ theo số điện thoại | customer table/modal/map popup | Chỉ tạo link; không có Zalo OpenAPI. |
| VietQR/BIDV | Sinh ảnh QR thanh toán | `src/lib/tools-qr.ts`, QR API/page | Dùng `img.vietqr.io`; phụ thuộc mạng và format URL bên thứ ba. |
| XLSX/ExcelJS/FileSaver/JSZip | Import/export dữ liệu và tools | `xlsx` dependency, route imports, `tool-assets` | Một số tool tải thư viện từ CDN trong asset HTML/JS. |
| AdmZip + XML DOM | Đọc KMZ/KML node | node upload route, `package.json` | Dùng trong import node địa lý. |
| Browser Geolocation | Vị trí hiện tại, ảnh hiện trường | map/photo components | Yêu cầu HTTPS/quyền trình duyệt. |
| CDN static libraries | Photo/receipt/excel tools | `tool-assets` | Khả năng hoạt động phụ thuộc CDN; không được bundle thống nhất với Next app. |

## 9. Feature flags và configuration

Repo không có hệ thống feature flag chuyên dụng. Các cơ chế tương đương đang dùng là role guard, route visibility, environment secret và build mode.

| Cơ chế | Tác động | Evidence |
|---|---|---|
| Role `ADMIN`/`MANAGER`/`CTV` | Ẩn/hiện menu, quyết định import/config/read scope | `src/components/Sidebar.tsx`, `src/lib/scope.ts`, route handlers |
| `User.canUseGps` | Hiện quyền thao tác GPS trong UI khách hàng/CTV | Prisma `User`, CTV/customer UI |
| Phiếu thu/Excel không còn trong sidebar | Feature còn route nhưng hidden khỏi navigation | Sidebar + commit `bf805e3` |
| `NODE_ENV === development` | Disable PWA trong development | `next.config.ts` |
| `ARCHIVE_CRON_SECRET` | Bảo vệ archive cron | archive cron route |
| `SETUP_SECRET`, `SEED_ADMIN_*` | Bảo vệ setup/seed còn lại | setup/seed routes; proxy hiện chặn cả hai |
| `PRISMA_DEBUG` | Bật log Prisma | `src/lib/prisma.ts` |
| `proxyClientMaxBodySize = 64mb` | Cho phép upload request lớn qua proxy client | `next.config.ts` |

Biến môi trường được tham chiếu trong code: `AUTH_SECRET`, `DATABASE_URL`, `TURSO_AUTH_TOKEN`, `CRON_SECRET`, `ARCHIVE_CRON_SECRET`, `NODE_0TB_DEFAULT_FILE_PATH`, `CUOC_CD_DEFAULT_FILE_PATH`, `NODE_ENV`. File mẫu [.env.example](file:///d:/code/app-ca-nhan/customer-manager/.env.example) đã được cung cấp để hướng dẫn thiết lập.

## 10. Known limitations và rủi ro vận hành đã xác minh

### 10.1 Authorization và audit

- Phân quyền API: Các route nhạy cảm (User management, Customer delete/bulk-delete, Backup/Restore, Archive) đã được bảo vệ chặt chẽ bởi `requireAuth({ roles: [...] })`.
- Quyền GPS: Cờ `canUseGps` áp dụng cơ chế fail-closed chặt chẽ (`if (canUseGps !== true) return 403`), đảm bảo tài khoản không được cấp quyền hoặc lỗi truy vấn database đều bị từ chối.
- Audit Trail: Bảng `AuditLog` ghi nhận toàn bộ thao tác nhạy cảm: `USER_CREATE`, `USER_UPDATE`, `USER_DELETE`, `CUSTOMER_DELETE`, `CUSTOMER_BULK_DELETE` kèm IP và snapshot chi tiết. Bảng `EditHistory` ghi nhận diffs thay đổi từng trường khi cập nhật thông tin khách hàng.
- Rate limit: Lưu trong `Map` bộ nhớ của tiến trình runtime; hoạt động tốt cho single-server/monolith nhưng không chia sẻ state giữa các serverless instances độc lập nếu scale ngang mà không dùng Redis.

### 10.2 Data lifecycle và deployment

- Quản lý Database Schema: Toàn bộ 24 models đã được chuẩn hóa và tập trung trong `prisma/schema.prisma`. 4 migrations SQL tập trung quản lý lịch sử schema từ khởi tạo đến hiện tại, bao gồm cả bảng `Node0Tb` khóa chính `TEXT` và bảng `AuditLog`.
- Migration Runner: Script [scripts/migrate.mjs](file:///d:/code/app-ca-nhan/customer-manager/scripts/migrate.mjs) hỗ trợ chạy cả Turso remote và SQLite local với cơ chế fail-fast ngắt ngay lập tức khi gặp lỗi DDL nghiêm trọng, không để database ở trạng thái áp dụng dở dang.
- Backup & Restore: Module [src/app/api/admin/backup/route.ts](file:///d:/code/app-ca-nhan/customer-manager/src/app/api/admin/backup/route.ts) bao phủ toàn diện 24 bảng dữ liệu, bao gồm cả `ChurnRiskRecord` (sắp xếp theo `id`), `Node0Tb` (bảo toàn chuỗi UUID), `CuocCdDailyResult`, `CuocCdConfig`, và `OfficialDocumentAsset`.
- Archive Cron: Endpoint `/api/archive/cron` chấp nhận cả `CRON_SECRET` (tiêu chuẩn Vercel Cron trong `vercel.json`) lẫn `ARCHIVE_CRON_SECRET` (dùng cho GitHub Actions hoặc runner ngoài).
- File đính kèm công văn: Asset công văn hỗ trợ lưu trữ base64 trực tiếp trong database hoặc file ngoài, cần lưu ý dung lượng upload trong `next.config.ts` (giới hạn 64MB).

### 10.3 Product/UI

- Phiếu thu và Excel: Các trang `/tools/phieu-thu` và `/tools/excel` vẫn hoạt động với đầy đủ bảo vệ nhưng không nằm trong navigation chính của Sidebar (chỉ truy cập trực tiếp khi có nhu cầu).
- KPI calculator: Đóng vai trò công cụ mô phỏng dự tính KPI cho người dùng, không lưu dữ liệu tính toán vào database.
- PWA: Có cấu hình `manifest.json` và service headers; tối ưu cho trải nghiệm mobile/desktop cài đặt.

### 10.4 Test coverage & CI/CD

- Hệ thống kiểm thử tự động: Sử dụng **Vitest** runner với **12 test suites, 45 unit tests** bao phủ:
  - Xác thực Zod schema cho Customer (xử lý coercion chuỗi rỗng/số) và User (xử lý mật khẩu để trống khi update, validate username).
  - Phân quyền & Scope (`api-auth`, `scope`).
  - Kiểm thử cấu trúc Backup & Restore tránh lỗi hồi quy (`backup-regression.test.ts`).
  - Audit logging (`audit.test.ts`).
  - Rate limiting (`rate-limit.test.ts`).
  - Nghiệp vụ tính cước, cước cố định, ngắt kết nối và KPI.
- CI/CD Pipeline: GitHub Actions workflow [ci.yml](file:///d:/code/app-ca-nhan/customer-manager/.github/workflows/ci.yml) tự động chạy 5 bước kiểm tra chất lượng trên mỗi commit/PR:
  1. `npx prisma validate`
  2. `npx tsc --noEmit`
  3. `npm run lint`
  4. `npm test`
  5. `npm run build`

## 11. Điểm phụ thuộc môi trường bên ngoài

1. **Turso / LibSQL Database:** Hoạt động phụ thuộc vào kết nối internet tới URL cụm Turso và token `TURSO_AUTH_TOKEN` còn hiệu lực.
2. **Dịch vụ Bản đồ & Tọa độ:** Bản đồ OpenStreetMap tiles, Leaflet, và Google Maps navigation phụ thuộc vào kết nối internet.
3. **Thanh toán VietQR & Tra cứu Zalo:** Tạo mã QR thanh toán và link liên hệ Zalo phụ thuộc vào kết nối API các nhà cung cấp bên thứ ba.

## 12. Thành phần đã dọn dẹp khỏi Codebase

| Thành phần đã dọn | Ghi chú |
|---|---|
| `CustomerModal.tsx` & `CustomerNotes.tsx` cũ | Đã xóa; UI sử dụng `CustomerModalRefined.tsx` và `CustomerNotesRefined.tsx`. |
| `PersonalKpiPanel.tsx`, `SummaryKpiPanel.tsx`, `ManagerSummaryKpiPanel.tsx` cũ | Đã xóa; các trang sử dụng các bản `*Clean.tsx`. |
| `map-detail` route | Đã xóa; map sử dụng `map-data`, `search-map` và `customers/[id]`. |
| Thư viện thừa `recharts`, `react-leaflet-cluster` | Đã gỡ bỏ khỏi `package.json`. |
| File tĩnh boilerplate `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | Đã xóa khỏi thư mục `public/`. |
| Các thư mục output test `*-test-out` | Đã xóa, chuyển toàn bộ runner sang Vitest in-memory. |

## 13. Nguồn kiểm tra chính

- Application routes/pages: `src/app/**`
- Shared UI/hooks/services: `src/components/**`, `src/hooks/**`, `src/lib/**`
- Auth/proxy: `src/auth.ts`, `src/proxy.ts`, `src/lib/api-auth.ts`
- Data declarations: `prisma/schema.prisma`, `prisma/migrations/**`
- Tests: `tests/unit/**` (12 test suites, 45 tests)
- CI/CD: `.github/workflows/**`, `vercel.json`
