# Tiến độ dự án KpiDiLinh

> Cập nhật: **26/10/2026**, múi giờ **Asia/Saigon (UTC+7)**.
>
> File này ghi lại các việc đã thực hiện, bằng chứng kiểm tra và việc còn lại để tiếp tục dự án. Số liệu phục hồi là mốc của bản backup ngày 26/10/2026; dữ liệu nhập thêm sau mốc này có thể làm số lượng thay đổi.

## 1. Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Thư mục làm việc mới | `D:\code\webkpimoi` |
| Nguồn mã được lấy lại | `D:\code\customer-manager` |
| GitHub mới | `https://github.com/dangquocviet2612-del/KpiDiLinh.git` |
| Git remote `origin` | Đã trỏ tới GitHub mới |
| Lịch sử Git cũ | Đã cất riêng; chưa đưa sang repo mới |
| Commit/push lên GitHub mới | **Đã push nhánh `main`**; bản sửa thêm khách hàng `3f89383` đã được đối chiếu hash local/GitHub |
| Database đang dùng | SQLite local: `data/kpidi-linh.sqlite` |
| Dữ liệu nghiệp vụ | Đã phục hồi từ backup của `https://cumtomer.vercel.app` |
| Địa chỉ chạy local | `http://localhost:3000` |
| Database online mới | Turso `kpidi-linh`, đã nhập và xác minh 25 bảng / 133.752 bản ghi |
| Web Production mới | **https://kpidi-linh.vercel.app**; Vercel project `kpidi-linh`, đã triển khai và kiểm tra |
| Thêm mới khách hàng | Đã sửa và kiểm tra lưu thật ở cả menu khách hàng và bản đồ khách hàng; xem mục 14 |
| Cách triển khai hiện tại | Vercel CLI trực tiếp; chưa kết nối tự động deploy từ GitHub |
| Bảo mật còn phải xử lý | Token Turso cũ đã gửi trong chat vẫn hợp lệ ở lần kiểm tra gần nhất; cần thu hồi có kế hoạch |

## 2. Các việc đã hoàn tất

### 2.1. Tách bản mã nguồn để tiếp tục phát triển

- [x] Clone mã nguồn sang `D:\code\webkpimoi`.
- [x] Mang theo hai thay đổi local: sửa ô nhập Node trong form khách hàng và test kiểm tra việc nhập/lưu Node.
- [x] Kiểm tra bốn script tạm chưa commit.
- [x] Chuyển bốn script tạm ra ngoài dự án mới để lưu riêng:
  - `check-customer.js`: kiểm tra cấu trúc và dữ liệu mẫu khách hàng.
  - `check-nodes.js`: kiểm tra dữ liệu mẫu node.
  - `seed-local.js`: chứa thông tin admin viết cứng; không đưa vào repo mới.
  - `test-validation.js`: thử dữ liệu đầu vào thủ công.
- [x] Clone repo GitHub mới đang trống để lấy cấu hình Git riêng, giữ mã nguồn hiện tại trong `webkpimoi`.
- [x] Cất metadata Git cũ và bốn script ở `D:\code\webkpimoi-recovery-backup-20261026`.

Bằng chứng: `git remote -v`, `git status`, thư mục lưu riêng ở trên; `src/components/CustomerModalRefined.tsx`, `tests/ui/customer-workflow.test.tsx`.

### 2.2. Kiểm tra file nhạy cảm trước khi đưa lên GitHub

- [x] Rà `.env.example`: các khóa bí mật dùng placeholder, không chép token thật vào file mẫu.
- [x] Xác nhận lịch sử Git cũ từng chứa thông tin đăng nhập viết cứng; vì vậy dùng lịch sử mới cho KpiDiLinh.
- [x] Bổ sung `.gitignore` cho các file SQLite, file journal, thư mục dữ liệu, thông tin đăng nhập local và khóa riêng.
- [x] Xác minh Git bỏ qua `.env`, `data/`, `.local/`, các file database và file mật khẩu local.
- [x] Rà các file có thể đưa vào Git để kiểm tra không chứa những giá trị bí mật đã biết trong đợt phục hồi.

Ban đầu kiểm tra theo các giá trị/mẫu đã biết; trước khi push đã quét thêm bằng Gitleaks 8.30.1 trên source staged và commit. Một cảnh báo cho khóa giả chỉ dùng trong CI đã được xác minh, ngoại lệ giới hạn đúng giá trị và file đó; không có secret thật được phát hiện. Không ghi mật khẩu, token, password hash hoặc dữ liệu khách hàng vào file tiến độ này.

Bằng chứng: `.gitignore`, `.env.example`, kết quả `git check-ignore` đã chạy trong phiên phục hồi.

### 2.3. Chuẩn bị môi trường và SQLite riêng

- [x] Cài thư viện bằng `npm.cmd ci --no-audit --no-fund`, giữ nguyên manifest và lockfile.
- [x] Generate Prisma Client.
- [x] Tạo `.env` local với khóa xác thực và khóa cron ngẫu nhiên.
- [x] Cố định kết nối vào SQLite trong dự án mới; cấu hình local không dùng token Turso.
- [x] Chạy bốn migrations, tạo đủ **25 bảng** tương ứng schema hiện tại.
- [x] Tạo admin local `admin`, dùng mật khẩu ngẫu nhiên và lưu riêng trong `.local/admin-credentials.txt`.
- [x] Viết hướng dẫn vận hành local: `docs/local-setup.md`.

Bằng chứng: `package.json`, `package-lock.json`, `prisma/schema.prisma`, `prisma/migrations/`, `.local/database-initialization.json`, `docs/local-setup.md`.

### 2.4. Lấy và phục hồi dữ liệu web cũ

- [x] Kiểm tra database cũ trên máy: chỉ có 3 khách hàng và 1 node, chưa có KPI; không dùng bản này làm nguồn phục hồi đầy đủ.
- [x] Tải backup phiên bản **10**, khoảng **73 MB**, từ chức năng sao lưu có xác thực admin của web cũ.
- [x] Lưu nguyên file JSON gốc và checksum SHA-256 trong `.local/backups/`.
- [x] Phục hồi vào một file SQLite riêng trước khi thay database của bản local.
- [x] Giữ 33 tài khoản cũ, password hash, vai trò và các trường phân công có trong backup.
- [x] Giữ thêm admin local để tiếp tục truy cập: **34 tài khoản** sau phục hồi.
- [x] Đối chiếu **133.751 bản ghi nguồn**, thuộc **23 nhóm dữ liệu**, khớp các giá trị trường có trong backup.
- [x] Kiểm tra SQLite: `integrity_check = ok`; không có lỗi khóa ngoại.
- [x] Thử đăng nhập và API ở cổng 3001 trước khi chuyển sang cổng 3000.
- [x] Cất SQLite trước phục hồi để có thể quay lại khi cần.
- [x] Chuyển bản local sang dữ liệu đã phục hồi và khởi động lại ở cổng 3000.

Bằng chứng: `.local/backups/latest-export-summary.json`, `.local/backups/restoration-report.json`, bản backup JSON gốc và SQLite trước phục hồi.

## 3. Số liệu đã phục hồi

Số lượng dưới đây là mốc đã đối chiếu sau phục hồi, không phải số đếm tự cập nhật theo thời gian thực.

| Nhóm dữ liệu | Bảng | Số lượng local sau phục hồi |
|---|---|---:|
| Tài khoản | `User` | 34: 33 tài khoản nguồn + 1 admin local |
| Khách hàng | `Customer` | 200 |
| Node hạ tầng | `Node` | 2.420 |
| Lịch sử sửa khách hàng | `EditHistory` | 132 |
| Ghi chú khách hàng | `CustomerNote` | 3 |
| Cấu hình KPI | `KpiMetricConfig` | 27 |
| KPI cá nhân | `KpiDailyResult` | 69.961 |
| KPI quản lý | `ManagerKpiDailyResult` | 6.151 |
| Cước | `CuocDailyResult` | 3.631 |
| Cước cố định | `CuocCdDailyResult` | 635 |
| Cấu hình cước cố định | `CuocCdConfig` | 1 |
| Giao dịch CDT | `CdtTransaction` | 12.690 |
| Tồn CDT | `CdtOutstandingRecord` | 11.345 |
| Rời mạng | `DisconnectRecord` | 173 |
| Nguy cơ rời mạng | `ChurnRiskRecord` | 222 |
| Nhật ký archive | `ArchiveLog` | 0 theo backup |
| Nhật ký xuất archive | `ArchiveExportLog` | 0 theo backup |
| Cấu hình cước | `CuocConfig` | 1 |
| Công văn | `OfficialDocument` | 2 |
| File đính kèm công văn | `OfficialDocumentAsset` | 0 theo backup |
| Phiên bản công văn | `OfficialDocumentRevision` | 3 |
| Mapping Account - Node | `CustomerNodeMapping` | 25.983 |
| Node 0TB | `Node0Tb` | 138 |

**Hai bảng không có trong backup:** `AuditLog` và `OfficialDocumentTempAsset`. Chưa khôi phục dữ liệu cũ của hai bảng này và chưa xác minh được số bản ghi của chúng trên web cũ. `AuditLog` khác với `EditHistory`; 132 bản ghi `EditHistory` đã được khôi phục.

## 4. Các chức năng có trong bản mã hiện tại

Đây là chức năng kế thừa từ mã nguồn và các cải tiến đã có trong repo. Sự hiện diện của code không có nghĩa là đã kiểm thử lại toàn bộ luồng nghiệp vụ trên mọi thiết bị trong đợt phục hồi này.

| Mảng sản phẩm | Chức năng có trong code | Điểm vào / bằng chứng |
|---|---|---|
| Tài khoản và phân quyền | Đăng nhập, đổi mật khẩu, vai trò Admin/Manager/CTV, quản lý tài khoản | `/login`, `/change-password`, `/ctv`; `src/auth.ts`, `src/lib/scope.ts` |
| Khách hàng | Danh sách, tìm kiếm, lọc, tạo/sửa/xóa, import/export, ghi chú và lịch sử | `/customers`; `src/app/api/customers/`, `src/components/CustomerModalRefined.tsx` |
| Bản đồ khách hàng | Hiển thị khách hàng, tìm kiếm và tương tác vị trí | `/map`; `src/app/(dashboard)/map/` |
| Bản đồ node | Tìm theo tên/tọa độ, gom cụm, lọc hiệu suất/bán kính, định vị, xuất Excel và công cụ nhập dữ liệu | `/node-map`; `src/app/(dashboard)/node-map/` |
| Node 0TB | Bản đồ và tra cứu node chưa có thuê bao; nhập dữ liệu và phân nhóm | `/node-0tb`; `src/app/(dashboard)/node-0tb/`, `src/app/api/node-0tb/` |
| KPI | KPI cá nhân, tổng hợp, quản lý, cấu hình và công cụ tính/mô phỏng | `/prepaid`; `src/app/(dashboard)/prepaid/`, `src/app/api/kpi/` |
| Cước và CDT | Cước, cước cố định, giao dịch CDT, tồn CDT | Các mục tương ứng trong `/prepaid`; `src/app/api/cuoc/`, `src/app/api/cuoc-cd/`, `src/app/api/cdt/` |
| Rời mạng | Báo cáo rời mạng và danh sách nguy cơ rời mạng | `/prepaid`, `/churn-risk`; `src/app/api/disconnect/`, `src/app/api/churn-risk/` |
| Công văn | Soạn và quản lý công văn, tài sản đính kèm, phiên bản | `src/app/(dashboard)/prepaid/OfficialDocsPanel.tsx`, `src/app/api/official-documents/` |
| Sao lưu và lưu trữ | Xuất/khôi phục backup, xem lịch sử chỉnh sửa, archive | `/logs`, `/archive`; `src/app/api/admin/backup/route.ts`, `src/app/api/archive/` |
| Công cụ | Ghi SIM, QR, ảnh, phiếu thu, xử lý Excel | `/tools`; `src/app/(dashboard)/tools/` |

### Các cải tiến đã xác nhận còn trong code

- [x] Trường Node của form khách hàng dùng `handleChange`; có test chống lỗi nhập/lưu trường này.
- [x] Tổng hợp KPI sắp xếp nhân viên theo tỷ lệ hoàn thành; desktop/mobile dùng chung danh sách đã sắp xếp và lọc.
- [x] KPI tổng hợp/quản lý có bộ lọc **Chỉ hiện chưa đạt**.
- [x] Phân biệt **Còn thiếu** và **Vượt ngưỡng** theo chiều của KPI.
- [x] Toolbar bản đồ node gom tác vụ phụ vào **Tùy chọn**.
- [x] Bộ lọc node có **Tất cả hiệu suất**, **Xóa lọc** và hiển thị số lượng theo bộ lọc.
- [x] Tìm kiếm node hỗ trợ các phím lên/xuống, Enter và Escape.
- [x] Có cải tiến vùng bấm mobile và hỗ trợ giảm chuyển động trong CSS bản đồ node.

Bằng chứng: `src/lib/kpi-summary.ts`, `src/app/(dashboard)/prepaid/PrepaidPageImpl.tsx`, `SummaryKpiPanelClean.tsx`, `ManagerSummaryKpiPanelClean.tsx`; `src/app/(dashboard)/node-map/NodeMapComponent.tsx`, `NodeMapOptionsMenu.tsx`, `node-map.module.css`; `tests/ui/customer-workflow.test.tsx`.

## 5. Kết quả xác minh đã thực hiện

| Kiểm tra | Kết quả và phạm vi |
|---|---|
| Cài dependencies / generate Prisma Client | Thành công trong đợt chuẩn bị bản local ngày 26/10/2026 |
| `prisma validate` | Schema hợp lệ |
| `npm.cmd test` | **37 file test, 126 test đạt** trong đợt cài đặt trước phục hồi dữ liệu |
| Production build | Thành công; bước kiểm tra TypeScript trong build đạt |
| Lint | Không có error; còn **4 warning có sẵn** |
| Kiểm tra dữ liệu phục hồi | 133.751 bản ghi nguồn khớp giá trị trong backup |
| SQLite | `integrity_check = ok`, `foreign_key_check` không có vi phạm |
| Đăng nhập local | Đăng nhập admin thành công trên bản thử và bản chính |
| API khách hàng / node / tài khoản | Đọc được 200 khách hàng, 2.420 node, 34 tài khoản |
| API Node 0TB | Đọc được 138 node |
| API KPI | Đọc được báo cáo ngày **25/10/2026**, 13 chỉ tiêu trong kết quả kiểm tra |
| Kiểm tra khi viết file này | Trang `/login` ở cổng 3000 trả HTTP 200; các file riêng tư tiếp tục được Git ignore |

Các test/build ở trên là kết quả đã chạy trong phiên phục hồi; việc tạo file Markdown này không chạy lại toàn bộ test/build. Các kiểm tra API là kiểm tra chức năng đọc dữ liệu, chưa thay thế kiểm thử giao diện thủ công hoặc e2e đầy đủ.

Bốn warning đã ghi nhận:

1. `src/app/(dashboard)/customers/page.tsx`: biến `canUseGps` chưa dùng.
2. `src/app/api/cuoc-cd/report/route.ts`: biến `reportDate` chưa dùng.
3. `src/app/api/node-0tb/upload/route.ts`: biến `skippedRows` chưa dùng.
4. `src/app/api/nodes/upload/route.ts`: hàm `readSheetObjectRows` chưa dùng.

## 6. Các bản lưu cần giữ

| Bản lưu | Vị trí | Ghi chú |
|---|---|---|
| Lịch sử Git cũ và bốn script tạm | `D:\code\webkpimoi-recovery-backup-20261026` | Có thông tin nhạy cảm cũ; giữ riêng |
| Database đang chạy | `D:\code\webkpimoi\data\kpidi-linh.sqlite` | Dữ liệu đã phục hồi |
| Backup JSON web cũ | `.local/backups/cumtomer-web-backup-2026-10-26T03-01-55-672Z.json` | Tên file dùng thời gian UTC |
| Database trước khi nhập dữ liệu web | `.local/backups/local-before-web-restore-20261026.sqlite` | Giữ để đối chiếu/quay lại |
| Metadata bản xuất | `.local/backups/latest-export-summary.json` | Có checksum và số lượng từng nhóm |
| Báo cáo khôi phục | `.local/backups/restoration-report.json` | Ghi số lượng, kiểm tra toàn vẹn và đối chiếu dữ liệu |
| Thông tin admin local | `.local/admin-credentials.txt` | Xem trên máy; không chép mật khẩu vào tài liệu/repo |
| Hướng dẫn chạy local | `docs/local-setup.md` | Có thể đưa lên GitHub cùng mã nguồn |

Các đường dẫn bắt đầu bằng `.local/` hoặc `data/` được tính từ `D:\code\webkpimoi`.

## 7. Việc còn lại

### Trước khi đưa mã nguồn lên GitHub mới

- [ ] Kiểm tra giao diện và các thao tác chính bằng dữ liệu thật đã phục hồi, đặc biệt KPI, bản đồ node và import/export.
- [x] Chạy secret scan chuyên dụng; kiểm tra 331 file đưa vào commit, không có database hoặc thông tin đăng nhập riêng tư.
- [x] Đổi mật khẩu admin cũ từng xuất hiện trong lịch sử Git trên **database online mới**; không đổi mật khẩu trên web cũ hoặc SQLite local.
- [x] Tạo commit đầu tiên trên repo mới và push nhánh `main` lên GitHub KpiDiLinh; đã đối chiếu commit local và remote.

### Trước khi chạy web mới online

- [x] Kết nối database Turso mới `kpidi-linh`, xác nhận trống trước khi nhập dữ liệu.
- [x] Cấu hình URL/token mới và khóa xác thực/cron riêng cho môi trường Production.
- [x] Đưa dữ liệu đã xác minh lên database online và đối chiếu lại 25 bảng.
- [x] Tạo deployment mới; kiểm tra đăng nhập ADMIN, 18 trang, 15 API và chặn truy cập chưa đăng nhập/API setup.
- [ ] Kiểm tra đăng nhập thực tế MANAGER/CTV, phạm vi dữ liệu từng role, thao tác UI/import/export trên web mới.
- [ ] Thu hồi token Turso cũ đã gửi trong chat; việc tạo token mới chưa vô hiệu hóa token cũ.
- [ ] Thiết lập sao lưu định kỳ và bản lưu ngoài máy/ngoài ổ đĩa đang dùng; thử khôi phục từ bản sao lưu.

### Các đề xuất chưa được triển khai trong đợt phục hồi

- [ ] Xử lý bốn lint warning còn lại khi thực hiện đợt sửa code tiếp theo.
- [ ] Xác minh khả năng lấy thêm `AuditLog` và dữ liệu công văn tạm nếu cần bảo toàn hai phần này.
- [ ] Tích hợp gửi KPI qua Zalo: mới trao đổi phương án, chưa có chức năng gửi KPI tự động được triển khai trong đợt này.

## 8. Lưu ý khi tiếp tục công việc

- GitHub lưu mã nguồn; database SQLite, file upload và file riêng tư cần sao lưu riêng.
- Đây là một bản chụp từ web cũ. Dữ liệu phát sinh tiếp trên web cũ không tự đồng bộ sang local.
- `npm.cmd run build` hiện gọi `scripts/migrate.mjs` trước khi build Next.js; kiểm tra `DATABASE_URL` trước khi chạy ở môi trường khác.
- Không dùng `prisma migrate reset` để thử trên database đã phục hồi.
- `tiendo.md` và một số tài liệu cũ có mô tả tổng quan khác mốc hiện tại. Dùng báo cáo phục hồi và file này cho tiến độ của đợt chuyển sang KpiDiLinh; không suy ra mọi chức năng đã hoàn thiện 100% chỉ từ tài liệu cũ.
- Khi hoàn tất một việc mới, cập nhật ngày, trạng thái, kết quả kiểm tra và bằng chứng vào file này. Không đánh dấu hoàn thành cho việc chỉ mới đề xuất.

## 9. Nhật ký mốc công việc

| Ngày | Mốc đã thực hiện |
|---|---|
| 26/10/2026 | Lấy lại mã nguồn, tạo thư mục `webkpimoi`, giữ hai sửa đổi form Node/test |
| 26/10/2026 | Rà các file nhạy cảm, lưu riêng script tạm và lịch sử Git cũ, kết nối repo GitHub mới |
| 26/10/2026 | Cài thư viện, tạo SQLite riêng, admin local; test và production build đạt |
| 26/10/2026 | Lấy backup web cũ, phục hồi 23 nhóm dữ liệu, đối chiếu 133.751 bản ghi |
| 26/10/2026 | Chuyển bản local sang dữ liệu phục hồi; xác minh đăng nhập và API ở cổng 3000 |
| 26/10/2026 | Tạo `tiendokpi.md` để lưu tiến độ và các bước còn lại |
| 26/10/2026 | Chuẩn bị bản chụp SQLite và hướng dẫn chuyển sang Turso/Vercel; chưa tạo database online hoặc deploy |
| 26/10/2026 | Nhập và xác minh 25 bảng trên Turso mới; chuẩn bị cấu hình Production riêng, Vercel chưa deploy |
| 26/10/2026 | Nhận token thay thế, bảo vệ file cấu hình, đổi mật khẩu admin bị lộ trên database online mới |
| 26/10/2026 | Tạo project Vercel `kpidi-linh`, deploy trực tiếp bằng CLI, xác minh web Production và dữ liệu sau migration |
| 26/10/2026 | Quét 331 file bằng Gitleaks, tạo commit source `1f0d456`, xác thực đúng tài khoản và push nhánh `main` lên GitHub mới |
| 26/10/2026 | Sửa lỗi DOM của form thêm khách hàng, push `3f89383`, deploy và kiểm tra lưu thật qua cả danh sách/bản đồ |

## 10. Chuẩn bị chuyển online ngày 26/10/2026

- [x] Đối chiếu cấu hình Turso/libSQL và Vercel với source hiện tại, tham khảo tài liệu chính thức.
- [x] Xác nhận người dùng đã có tài khoản Turso.
- [x] Tạo bản SQLite nhất quán tại `.local/deployment/kpidi-linh-20261026.db`, khoảng 62,7 MB, để chuyển dữ liệu trực tiếp từ máy.
- [x] Ghi checksum và số lượng của 25 bảng trong `.local/deployment/snapshot-manifest.json`; kiểm tra toàn vẹn đạt, không có vi phạm khóa ngoại.
- [x] Tạo file cấu hình riêng tư `.local/deployment/turso.env`; đã thay bằng token mới, xác minh quyền đọc/ghi. Token cũ đã gửi trong chat vẫn cần được thu hồi.
- [x] Tạo hướng dẫn `docs/deploy-online.md`, gồm nhập dữ liệu, biến môi trường, GitHub, Vercel và kiểm tra sau deploy.
- [x] Xác minh bản SQLite chuẩn bị và file token được Git ignore.
- [x] Nhận cấu hình truy cập hợp lệ của database Turso mới và kiểm tra kết nối.
- [x] Nhập dữ liệu lên online và đối chiếu với manifest.
- [x] Tạo Vercel project mới và xác minh web online; triển khai trực tiếp bằng CLI.
- [x] Commit/push mã lên repo mới; nhánh `main` đã có trên GitHub.
- [ ] Kết nối GitHub với Vercel để tự động deploy; chưa thực hiện trong yêu cầu push source.

Lưu ý đã xác minh: backup JSON khoảng 73 MB vượt giới hạn payload 4,5 MB của Vercel Functions; dữ liệu đã được chuyển trực tiếp vào database, không tải qua trang restore trên Vercel. Build hiện chạy migrations và cron archive có thể purge dữ liệu hết hạn; hướng dẫn triển khai đã ghi rõ hai tác động này. Bản local vẫn dùng SQLite riêng; database Turso và web Vercel mới đã hoạt động độc lập với web cũ.

## 11. Hoàn tất chuyển dữ liệu lên Turso ngày 26/10/2026

- [x] Kết nối đúng database mới `kpidi-linh-dangquocviet2612-del.aws-ap-northeast-1.turso.io`.
- [x] Xác nhận database đích không có bảng dữ liệu trước khi bắt đầu; không ghi đè database đã có dữ liệu.
- [x] Nhập schema, index và dữ liệu bằng `@libsql/client`, theo các lô transaction nhỏ trực tiếp từ máy Windows; không cần cài Turso CLI/WSL để thực hiện đợt nhập này.
- [x] Có trạng thái nhập riêng để tiếp tục nếu kết nối bị ngắt; không tự xóa dữ liệu để thử lại.
- [x] Giữ giá trị auto-increment của các bảng từ SQLite nguồn.
- [x] Đối chiếu số dòng và checksum dữ liệu của **25 bảng**, tổng **133.752 bản ghi**, gồm 33 tài khoản cũ và 1 admin local.
- [x] Kiểm tra toàn vẹn online: `integrity_check = ok`, không có vi phạm khóa ngoại.
- [x] Kiểm tra đăng nhập và API của app qua một bản chạy thử dùng database online; bản local cổng 3000 tiếp tục dùng SQLite.
- [x] Chuẩn bị `.local/deployment/vercel-production.env` với khóa xác thực/cron mới; đã nhận và cấu hình token thay thế, xác minh kết nối đọc/ghi.
- [x] Sáu test của công cụ chuyển dữ liệu đã đạt: chặn database có sẵn, tham số hóa dữ liệu, giới hạn số tham số, giữ giá trị null/0/binary và thứ tự khóa ngoại.
- [x] Tạo token thay thế và lưu riêng trên máy/Vercel; không đưa token vào mã nguồn hoặc tham số lệnh.
- [ ] Thu hồi token cũ đã gửi trong chat; kiểm tra trước khi deploy cho thấy token này **vẫn còn hiệu lực**.
- [x] Đổi mật khẩu admin cũ từng lộ trong lịch sử Git trên bản database dùng cho web mới.
- [x] Tạo Vercel project mới và xác minh web sau deploy bằng CLI.
- [x] Commit/push mã nguồn lên nhánh `main` của GitHub mới.
- [ ] Kết nối tự động deploy từ GitHub với Vercel.

Bằng chứng riêng tư, không đưa lên Git: `.local/deployment/turso-import-state.json`, `.local/deployment/turso-import-report.json`, `.local/deployment/snapshot-manifest.json`. Báo cáo ghi số dòng và checksum, không ghi token. Kết quả đối chiếu toàn bộ checksum là tại thời điểm nhập; sau đó một mật khẩu admin và thời điểm cập nhật được thay có chủ đích, xem mục 12.

## 12. Triển khai Vercel Production ngày 26/10/2026

### Những việc đã thực hiện

- [x] Đăng nhập Vercel của chủ dự án, tạo **project mới** `kpidi-linh` trong scope `vietdq9`; không sửa các project có sẵn `kpidilinh1`, `kpidilinh`, `kpiviet` hoặc web cũ.
- [x] Cấu hình framework Next.js, Node.js 24.x; giữ build command của repo. Build trên Vercel hoàn tất, trạng thái `READY`.
- [x] Cấu hình **chỉ Production**: `DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`, `CRON_SECRET`, `ARCHIVE_CRON_SECRET`, `PRISMA_DEBUG`. Các khóa bí mật được nhập qua stdin, không ghi vào command line. Chưa cấu hình database cho Preview.
- [x] Dùng domain **https://kpidi-linh.vercel.app**. Đăng nhập hoạt động nhờ cấu hình xác định host hiện tại; không đặt `AUTH_URL` thành localhost.
- [x] Bổ sung `.gitignore` cho `*.env`, `*.env.*`; chuyển file `vercel-production.env` người dùng điền ở gốc repo vào `.local/deployment/`. Không để file token ở gốc repo.
- [x] Tạo `.vercelignore` để không upload `.local/`, database, backup, env/token, cache, file upload local và cấu hình công cụ. Vercel CLI tạo thêm `.env.local` chứa OIDC token; file này cũng bị Git và deployment ignore.
- [x] Thay đúng **một** mật khẩu admin từng lộ trong seed cũ trên database online mới; kiểm tra mật khẩu cũ không còn khớp. Thông tin mới ở `.local/deployment/online-admin-credentials.txt`. Tài khoản phục hồi `admin` vẫn được giữ, thông tin ở `.local/admin-credentials.txt`.
- [x] Không sửa source nghiệp vụ trong đợt triển khai này; không commit/push khi chưa có yêu cầu riêng.

### Kết quả kiểm tra

| Kiểm tra | Kết quả thực tế |
|---|---|
| Unit/UI test chạy lại trước deploy | **37 file / 126 test đạt** |
| TypeScript | `tsc --noEmit` đạt |
| ESLint | Không có error; còn 4 warning đã liệt kê ở mục 5 |
| Vercel build | Hoàn tất, deployment `dpl_E4igS6VTaNRjtEpGm7Rs5nYEtTfw` |
| Đăng nhập trên domain Production | ADMIN đăng nhập thành công |
| Trang sau đăng nhập | HTTP 200 cho 18 trang: dashboard, khách hàng, CTV, trả trước/KPI, hai bản đồ, Node 0TB, nguy cơ rời mạng, nhật ký, archive, đổi mật khẩu và công cụ |
| API đọc dữ liệu | HTTP 200 cho 15 endpoint: tài khoản hiện tại, khách hàng, node, Node 0TB, users, KPI cá nhân/tổng hợp/quản lý, cước, cước cố định, CDT, tồn CDT, rời mạng, nguy cơ rời mạng, công văn |
| Số liệu chính | 200 khách hàng, 2.420 node, 138 Node 0TB, 34 tài khoản; báo cáo KPI 25/10/2026 có 13 chỉ tiêu |
| Truy cập chưa đăng nhập | API khách hàng/users/cron bị chặn; setup/seed không mở |
| Bootstrap khi đã đăng nhập ADMIN | Setup/seed trả 404 do không cấu hình khóa mở setup |
| Database sau migration | 25 bảng, 133.752 bản ghi; số dòng không đổi, toàn vẹn `ok`, không có vi phạm khóa ngoại |
| Dữ liệu Node 0TB sau build | Checksum toàn bộ dữ liệu khớp bản đã nhập |
| Tài khoản sau bảo vệ admin | 34 dòng khớp nguồn, ngoại trừ đúng một mật khẩu admin và thời điểm cập nhật được đổi có chủ đích |
| Secret scan theo các giá trị đã biết | Không tìm thấy khóa bí mật local/Production trong 331 file có thể đưa vào Git ở thời điểm preflight; không thay thế Gitleaks |

Các kiểm tra trên là HTTP/API smoke test, **không phải** xác nhận mọi thao tác trình duyệt hoặc e2e đã đạt. Chưa thử đăng nhập MANAGER/CTV thật, upload/import/export lớn, xóa/sửa dữ liệu hay purge archive. Domain Production công khai trang đăng nhập của app; các URL deployment/alias phụ vẫn có thể yêu cầu đăng nhập Vercel.

### Bằng chứng và điểm còn lại

- Project: `prj_RAnaEm2i5BjdF4sRtc5VVKNCHc2u`; deployment: `dpl_E4igS6VTaNRjtEpGm7Rs5nYEtTfw`; xem [Vercel deployment](https://vercel.com/vietdq9/kpidi-linh/E4igS6VTaNRjtEpGm7Rs5nYEtTfw).
- Báo cáo riêng tư: `.local/deployment/production-config-verification.json`, `vercel-configuration-report.json`, `online-admin-security.json`, `vercel-smoke-report.json`, `post-deploy-database-verification.json`, `vercel-deployment-report.json` (các tên sau cùng đều trong `.local/deployment/`).
- **Chưa hoàn tất thu hồi token cũ.** Tạo token khác không tự thu hồi token đã gửi trong chat. Theo tài liệu Turso, thao tác `db tokens invalidate` có thể vô hiệu hóa cả token của các database trong cùng group; cần kiểm tra ảnh hưởng, tạo lại token cần thiết, cập nhật Vercel và redeploy. Không tự thu hồi toàn group vì có thể ảnh hưởng web/dự án khác. [Turso token invalidation](https://docs.turso.tech/cli/db/tokens/invalidate).
- Source đã được push lên GitHub sau đợt deploy, xem mục 13. Web vẫn deploy CLI trực tiếp; chưa có tự động deploy khi push.
- Giữ backup riêng ngoài Git/GitHub; chưa thiết lập sao lưu online định kỳ hoặc thử phục hồi online sang một database thứ ba.

## 13. Đưa mã nguồn lên GitHub ngày 26/10/2026

- [x] Nhận yêu cầu commit/push của chủ dự án; không tạo branch mới, không force-push.
- [x] Kiểm tra repo đích `https://github.com/dangquocviet2612-del/KpiDiLinh.git` còn trống trước commit đầu tiên.
- [x] Quét **331 file**, khoảng 6,5 MB source; xác minh 11 đường dẫn riêng tư tiếp tục bị Git ignore. Database, backup, token, file mật khẩu và `.vercel/` không nằm trong commit.
- [x] Dùng Gitleaks 8.30.1 từ release chính thức, kiểm tra checksum gói Windows trước chạy. Quét bản source staged và chính commit; chỉ có khóa build giả tại `.github/workflows/ci.yml:40` được xác minh là false positive. Ngoại lệ quét đặt ngoài repo, giới hạn đúng giá trị/file đó; không tắt rule cho toàn repo.
- [x] Chạy lại **37 file / 126 test**, tất cả đạt; TypeScript `tsc --noEmit` đạt. Không chạy migration hoặc sửa database để thực hiện push.
- [x] Tạo [commit source đầu tiên `1f0d456`](https://github.com/dangquocviet2612-del/KpiDiLinh/commit/1f0d45618a760d1a5752b2eb2ad93a02e1d72c02): `Initial import of recovered KpiDiLinh application`.
- [x] Xử lý lỗi 403 do Git cache tài khoản cũ: chủ dự án xác thực `dangquocviet2612-del`; chỉ cấu hình chọn tài khoản cho repo mới, không đăng xuất hoặc thay cấu hình repo cũ.
- [x] Push nhánh `main`, thiết lập upstream `origin/main`; đối chiếu GitHub và local cùng hash `1f0d45618a760d1a5752b2eb2ad93a02e1d72c02` ở lần push source đầu tiên.
- [x] Giữ lịch sử Git cũ và script nhạy cảm ở thư mục backup riêng, không ghép lịch sử cũ vào repo mới.
- [ ] Kết nối repo GitHub với project Vercel để tự động deploy; đây là bước riêng, chưa thực hiện. Web Production hiện tại không bị redeploy bởi đợt push này.

Bằng chứng riêng tư: `.local/github-publish/preflight-report.json`, `gitleaks-staged-report.json`, `gitleaks-reviewed-staged-report.json`, `gitleaks-commit-report.json`, `push-report.json` (đều trong `.local/github-publish/`). Báo cáo Gitleaks đã redact; một cảnh báo khóa giả CI được ghi nhận riêng thay vì khẳng định mặc định scanner không có cảnh báo.

GitHub lưu mã nguồn, **không lưu dữ liệu Turso/SQLite hoặc backup**. Việc push không thu hồi token Turso cũ; đầu việc bảo mật ở mục 12 vẫn còn.

## 14. Sửa lỗi thêm mới khách hàng ngày 26/10/2026

### Triệu chứng và nguyên nhân đã xác minh

- Người dùng không thêm được khách hàng trên `https://kpidi-linh.vercel.app` ở cả menu khách hàng và bản đồ khách hàng.
- Hai màn hình cùng dùng `src/components/CustomerModalRefined.tsx`. Input Node có `name="nodeName"`, khiến cơ chế named access của trình duyệt ghi đè thuộc tính DOM `form.nodeName` bằng chính input thay vì chuỗi tên thẻ `FORM`.
- Tái hiện bằng Chrome thật: lỗi JavaScript `nodeName.toLowerCase is not a function`, không có POST tạo khách hàng được gửi. Đây là lỗi ở form trước khi gọi API, không phải lỗi thiếu dữ liệu hoặc hết quyền ghi Turso.

### Bản sửa và kiểm thử

- [x] Đổi tên control HTML thành `customerNodeName`; ánh xạ lại vào state/payload `nodeName`. Giữ nguyên API, schema và trường dữ liệu Node hiện có.
- [x] Thêm regression case cho cả danh sách và bản đồ có tọa độ mặc định. Test kiểm tra tên control không chiếm `form.nodeName`, vẫn nhập/sửa được Node và gửi đúng `nodeName`.
- [x] Chạy test trước sửa để xác nhận hai case bắt đúng lỗi; sau sửa toàn bộ **37 file / 127 test đạt**.
- [x] TypeScript `tsc --noEmit` đạt; lint không có error, còn 4 warning cũ ở mục 5; kiểm tra whitespace và Gitleaks cho các file sửa đều đạt.
- [x] Kiểm tra Chrome trên bản local: cả hai màn hình không còn lỗi JavaScript, nút Lưu gửi được POST; bước local chặn ghi dữ liệu thật.
- [x] Người dùng xác nhận cho phép cập nhật web mới và commit/push GitHub.
- [x] Push [commit sửa lỗi `3f89383`](https://github.com/dangquocviet2612-del/KpiDiLinh/commit/3f893830667ab94da9999913613415589e8680b1) lên `main`; đối chiếu GitHub và local cùng hash.
- [x] Deploy đúng project Vercel mới `kpidi-linh`, deployment `dpl_6vS42qZLk96eek3F4HCi8jikpQg7` đạt `READY`; domain Production giữ nguyên **https://kpidi-linh.vercel.app**.
- [x] Kiểm tra từ đầu đến cuối trên Production bằng Chrome: thêm đúng một khách hàng TEST từ `/customers` và một khách hàng TEST từ `/map`; cả hai trả **HTTP 201**, dữ liệu được lưu thật trong Turso, giữ đúng Node và tọa độ.
- [x] Xóa đúng hai bản ghi TEST định danh ngẫu nhiên và lịch sử tạo của chính chúng sau kiểm tra; không sửa/xóa khách cũ. Database có **200 khách hàng trước và sau kiểm tra**, không còn hai bản ghi TEST.

### Bằng chứng và phạm vi

- Source: `src/components/CustomerModalRefined.tsx`; regression test: `tests/ui/customer-workflow.test.tsx`.
- Deployment: [Vercel bản sửa](https://vercel.com/vietdq9/kpidi-linh/6vS42qZLk96eek3F4HCi8jikpQg7).
- Báo cáo riêng tư, không commit: `.local/customer-create-debug/browser-local-fixed.json`, `.local/customer-create-debug/production-create-verification.json`, `.local/customer-create-debug/customer-fix-release-report.json`. Báo cáo Production xác nhận cả hai POST 201, dữ liệu Turso khớp, cleanup thành công và không có lỗi JavaScript.
- Kiểm tra tạo thật sử dụng role ADMIN; chưa thay thế kiểm thử quyền MANAGER/CTV hoặc kiểm thử mọi thao tác sửa/import/export. Không đổi cấu hình phân quyền hoặc schema trong bản sửa này.
- Không tác động web cũ; không đổi cách deploy CLI hiện tại và chưa kết nối tự động deploy từ GitHub. Nếu trình duyệt vẫn giữ bản cũ, tải lại trang/`Ctrl+F5` trước khi thử.
