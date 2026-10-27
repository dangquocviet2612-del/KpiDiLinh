# Tiến độ dự án KpiDiLinh

> Cập nhật: **27/10/2026**, múi giờ **Asia/Saigon (UTC+7)**.
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
| Audit UI/hiệu năng toàn web | Đã đo 46 lượt desktop/mobile, lập báo cáo và plan; các đề xuất mới **chưa triển khai**, xem mục 15 |
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

## 15. Audit giao diện và tốc độ toàn web ngày 26/10/2026

- [x] Người dùng yêu cầu rà giao diện lẫn code, ưu tiên tốc độ trên **cả máy tính và điện thoại**; phạm vi hiện tại chỉ phân tích/lập plan.
- [x] Đối chiếu source, API/schema/migration, manifest, test, deployment và các roadmap cũ; không xem checkbox cũ là bằng chứng việc chưa làm.
- [x] Đo **29 route/view desktop + 17 mobile = 46 lượt** bằng Chrome trên web mới, role ADMIN. Có toàn bộ 10 subview prepaid; desktop 1440×960, mobile emulation 390×844, chưa throttle mạng/CPU.
- [x] Chỉ duyệt/đọc; không thao tác sửa/import/xóa nghiệp vụ. Chặn HTTP mutation và GET archive status có thể purge; archive không có benchmark backend thực tế trong đợt này.
- [x] Xác minh KPI có request 9,3–9,9 giây; Tính KPI gọi report 10/11 lần trong mẫu desktop/mobile. Source có personal fetch ẩn cùng calculator và runtime schema setup cần trace thêm.
- [x] Ghi nhận payload bản đồ, bundle prepaid, cột KPI lấn nội dung và hit-target mobile nhỏ; không ghi các nhận xét chưa xác nhận thành bug.
- [x] Tạo `docs/web-ux-performance-audit.md`: methodology, baseline/domain coverage, bằng chứng, ưu tiên và phần chưa xác minh.
- [x] Tạo `docs/superpowers/plans/2026-10-26-web-ux-performance.md`: 5 đợt, 13 task có dependencies, file scope, test/acceptance và guardrails dữ liệu.
- [x] Owner đã duyệt thực hiện đợt đầu; sau đó chốt **chỉ hoàn thiện và kiểm thử local**. Trạng thái triển khai tiếp theo ở mục 16; không hiểu các đề xuất còn lại là đã được thực hiện.

Số liệu là lab single-run, không phải INP/p75/p95 field; cold browser không đồng nghĩa cold Function. Không dùng chênh lệch desktop/mobile đo ở thời điểm khác nhau để kết luận thiết bị nào nhanh hơn.

Bằng chứng riêng tư, không commit: `.local/web-performance-audit-20261026/browser-audit.json`, `layout-probes.json`, `infrastructure-observation.json` và ảnh chụp cùng thư mục. Không đưa dữ liệu khách hàng/ảnh có PII lên Git. Baseline test 127 đạt ở đợt sửa trước; audit này chỉ thêm tài liệu nên không chạy lại build/migration/test ứng dụng.

## 16. Đợt tối ưu đầu tiên — chỉ local, ngày 26/10/2026

### Phạm vi và an toàn dữ liệu

- [x] Người dùng yêu cầu tiếp tục thực hiện nhưng **không commit/push/deploy**. GitHub và web Production chưa nhận batch này; web cũ không bị tác động.
- [x] Làm việc trên bản checkout tách riêng `.worktrees/ux-performance-batch1`, cùng base `1ecfa38`; kiểm thử với SQLite mới chứa tài khoản/KPI giả, không copy dữ liệu hoặc env Production.
- [x] Giữ nguyên `.env`, SQLite phục hồi trong `data/` và cấu hình Turso/Vercel của dự án chính. Chỉ khởi tạo migration một lần trên database giả mới, không chạy runner vào database có dữ liệu.
- [x] Tích hợp 27 file source/test/tool vào `D:\code\webkpimoi` sau khi kiểm tra file đích chưa bị sửa; đối chiếu byte-for-byte với checkout đã build. Chạy lại 265 test, 22 policy test, TypeScript và lint tại thư mục chính, với `DATABASE_URL=file::memory:` và token rỗng cho lượt kiểm tra.

### Các thay đổi trong batch

- [x] Archive: bỏ auto-purge khỏi GET status/export và các handler confirm/cancel/purge trước xác thực. GET export cũ trả 405/`Allow: POST`; UI dùng POST ADMIN, giữ log xuất file và kiểm tra độ mới trước xác nhận.
- [x] Archive worker: conditional UPDATE claim rồi DELETE trong cùng transaction; lỗi rollback cả claim, kiểm tra lại hạn purge/trạng thái, chỉ đếm tháng thực sự được xử lý. Manual purge ADMIN vẫn là thao tác tường minh; lịch GET/POST cron có secret không đổi.
- [x] Sửa lệch múi giờ archive: đọc cột DATETIME dưới dạng text tường minh, giữ precision và null thay vì để adapter đổi UTC thành giờ local. Regression qua PrismaLibSql thật trong hai Node process UTC/UTC+7; export mới xác nhận được, dữ liệu mới hơn export vẫn bị chặn.
- [x] Tính KPI: không tải thêm báo cáo cá nhân ẩn; một key chỉ có một request đang chạy. Abort response lỗi thời, callback đổi identity/ngày tự resolve không làm tải lặp hoặc reset draft mô phỏng.
- [x] KPI cá nhân: ổn định `/api/me` khi đổi CTV/session object tương đương; key theo auth scope/CTV/ngày. Sau import, xóa alias hoàn tất cũ và yêu cầu ngày mới nhất thay vì giữ điểm cũ hoặc tải lại ngày cũ.
- [x] Report/summary: thêm `Server-Timing` với label cố định cho auth/schema/scope/date/query/compute/serialize/total/cache. Không đổi SQL, công thức, rounding hay quyền; phase query không phải bộ đếm SQL statements.
- [x] Build: `npm run build` chỉ chạy `next build`, có regression test. `db:migrate` còn nguyên runner legacy, chưa có ledger/checksum/idempotency; **không chạy trên database đã phục hồi hoặc Production**.
- [x] Công cụ đo: thêm `perf:baseline`, `perf:summarize`, `test:performance`; dùng Chrome có sẵn, chỉ lưu số liệu đã redact trong `.local/performance/`, chặn mutation/GET nguy hiểm/redirect khác origin. Không tải browser, không lưu cookie/session/body khách hàng.

### Bằng chứng đo và giới hạn

- Harness chạy **11 view báo cáo × 3 mẫu = 33 lượt desktop** trên database giả: hoàn tất 33/33, không có route đo thất bại. Mỗi mẫu calculator có **1 `/api/kpi/report` + 1 `/api/me`**, không lỗi JavaScript hoặc HTTP API tại calculator.
- Baseline Production cũ từng có 10/11 request calculator; đây là bằng chứng giảm request trong fixture, **không phải** so sánh độ trễ đồng điều kiện với Turso online. Chưa khẳng định web thật nhanh gấp bao nhiêu hoặc đã đạt p95/INP/Core Web Vitals.
- Chrome thật kiểm tra calculator ở **1440×960 và 390×844**: mỗi viewport 1 report/1 me, có timing header, không lỗi JavaScript. Kiểm tra UI archive tải XLSX bằng POST → dialog xác nhận → hủy, không mất bản ghi; GET/unauthorized không purge dù có archive quá hạn.
- Hai HTTP cron GET/POST đồng thời trên SQLite giả qua PrismaLibSql thật trả tổng purge 1; chạy lại 0, chỉ xóa đúng dòng fixture quá hạn. Không dùng cron hoặc thao tác archive trên database thật để kiểm tra.
- Bộ Vitest cuối: **44 file / 265 test đạt**, gồm wrapper chạy thêm **24 checks adapter archive** trong hai process UTC/UTC+7. TypeScript và build đạt; SQLite giả giữ nguyên SHA-256 qua lượt test/build. Lint không có error, còn 4 warning cũ; log test vẫn có các cảnh báo `act`, React key và `punycode` hiện hữu.
- Policy harness: **22/22 test đạt**, gồm redirect từng hop không vượt budget 500 request và không ghi lượt bị chặn thành mẫu đo thành công. Số request là lab observation, không phải load test hoặc phép kiểm chứng database read-only tuyệt đối.
- Test worker SQLite phần lớn vẫn có adapter transaction giả lập tuần tự; HTTP smoke PrismaLibSql local bổ sung không thay thế kiểm thử lock/contention nhiều process trên Turso. Harness hiện là desktop, chưa có mobile/throttle flags; checks Chrome mobile riêng không phải RUM/thiết bị thật.
- `npm audit --omit=dev --audit-level=high` báo **24 dependency entries**: 3 critical, 19 high, 1 moderate, 1 low; nhóm critical gồm `next`, `next-auth`, `@auth/core`. Không nâng cấp hàng loạt trong batch này. Lockfile chỉ thêm dev dependency `playwright-core`, không đổi version dependency hiện có; chưa đánh giá khả năng khai thác từng advisory.

### Việc chưa hoàn thành

- [ ] Migration runner có ledger/checksum/chống replay và kiểm thử upgrade/rollback; đây vẫn là P0 trước thay đổi schema/deploy tiếp theo.
- [ ] Loại DDL/seed khỏi runtime KPI, đếm SQL/trace thực tế, tối ưu query/cache/invalidation/permission revocation và xác minh region. Chưa đổi hạ tầng hoặc công thức.
- [ ] Tách bundle theo view, DTO/viewport bản đồ, tối ưu CDT và sửa layout/hit-target responsive trong các task tiếp theo; chưa thiết kế lại giao diện toàn app.
- [ ] Security dependency upgrade có regression auth/PWA/Next riêng; CI performance/RUM, ba role, nhiều mẫu có cùng dữ liệu, thiết bị thật và mạng chậm.
- [ ] Owner duyệt riêng trước khi commit/push/deploy. Các checkbox còn lại trong implementation plan vẫn là backlog, không tự động được xem là xong.

Bằng chứng riêng tư, không commit: `.local/performance/batch1/` chứa manifest 27 file tích hợp, log test/policy/lint ở thư mục chính, báo cáo build không đổi SQLite giả, browser verification và baseline/summary đã redact. Checkout thử và credentials dữ liệu giả giữ riêng ở `.worktrees/ux-performance-batch1/.local/performance/`; `.env.local` của checkout đó chỉ trỏ database giả, không đưa vào thư mục chính/Git/Vercel. Không lưu token/password/session vào các báo cáo đo. Chưa commit/push/deploy batch này.

## 17. Migration an toàn và dependency critical — batch local 2, 26/10/2026

### Phạm vi

- [x] Tiếp tục theo yêu cầu người dùng, **vẫn chỉ local**, không commit/push/deploy hoặc chạy migration trên SQLite phục hồi/Turso thật. Tái sử dụng checkout tách riêng, giữ toàn bộ batch 1 chưa commit; snapshot hash các file trước batch 2 để tích hợp không đè thay đổi khác.
- [x] `scripts/migrate.mjs` nay gọi release runner mới: check là mặc định, apply phải tường minh. Không tự đọc `.env`/`.env.local`, không fallback sang `dev.db`, không log target URL/token/SQL. URL remote cần opt-in riêng nhưng chưa được phép dùng trong batch này.
- [x] Ledger `_AppMigration` lưu version/checksum SHA-256 chuẩn hóa line endings/thời điểm áp dụng. Kiểm tra lại sau write lock, commit DDL/data/ledger cùng transaction theo version; checksum hoặc thứ tự history không khớp thì dừng. Reapply managed database không replay migration.
- [x] Chặn database đã có schema nhưng chưa có ledger, ledger rỗng giả và target private-memory/filename rỗng trước ghi. Kiểm tra catalog chỉ bỏ prefix nội bộ literal `sqlite_`, không bỏ nhầm bảng/view như `sqliteXbusiness`.
- [x] Giữ nguyên mọi SQL migration lịch sử. Một compatibility rule có kiểm tra type/null/default/PK xử lý đúng statement `Customer.expirationDate` trùng trong init/consolidated; không generic-ignore lỗi duplicate/already-exists.
- [x] Regression migration trên SQLite giả: check không tạo schema/file mới, untracked không bị đổi, checksum/history drift, hai client độc lập, rollback version đầu và fault sau DROP/RENAME Node0Tb, retry không mất dòng/ledger. SQL scanner có test comment/quote/semicolon, từ chối transaction controls/PRAGMA/trigger chưa hỗ trợ.

### Các phiên bản cập nhật

| Gói | Trước batch | Local batch 2 |
|---|---|---|
| `next`, `eslint-config-next` | 16.1.6 | 16.4.1 |
| `next-auth` | 5.0.0-beta.25 | 5.0.0-beta.32 |
| `@auth/core` qua dependency upstream | 0.37.2 | 0.41.3, không force override |
| `@types/node` / CI runtime | types 20 / Node 20 | types 24 / Node 24 |

Next 16.4.1 là bản 16.x được upstream nêu để vá các advisory critical tháng 10; không thể giải quyết bằng giữ nguyên 16.1.x. Nguồn: [typed-array RCE](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr), [image optimization RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw). Beta.32 cập nhật security fixes của Auth Core; xem [release upstream](https://github.com/nextauthjs/next-auth/releases/tag/next-auth@5.0.0-beta.32). Không kết luận app đã bị khai thác từ số advisory.

- npm audit Production: **3 critical / 19 high / 1 moderate / 1 low → 0 critical / 17 high / 1 moderate / 1 low**, 19 package entries còn cảnh báo. Audit toàn bộ dependency sau cập nhật: 0 critical / 30 high / 9 moderate / 1 low. Đây là số package entries, không phải số CVE duy nhất hoặc bằng chứng app an toàn tuyệt đối.
- Không nâng cấp hàng loạt các gói còn lại. Bản Production vẫn dùng release trước, chưa nhận các bản vá local.
- Vitest 5 hiện yêu cầu Node 22.12+/24 và Node types 22+/24; cấu hình CI 20/types 20 cũ không phù hợp. Đã chỉnh CI/types thành 24, kiểm tra clean `npm ci` thành công **không dùng `--legacy-peer-deps`**, regenerate Prisma Client không kết nối database. Chưa chạy GitHub Actions thật hoặc thay runtime Vercel.
- ESLint mới nhận nhầm biến ref `markersRefObj` là prop immutable trong Node0TB: chỉ alias biến nội bộ thành `markersRef`, giữ tên prop, UI và cách cluster; không tắt rule hoặc đổi nghiệp vụ bản đồ.

### Kiểm tra local

- **46 file / 293 test + 22/22 policy test đạt tại thư mục chính**; regression gồm 23 case migration, 4 auth-security cases và guard CI/runtime. TypeScript đạt; lint giữ 4 warning cũ, không có error sau cập nhật alias ref. Tích hợp 16 file của batch sau khi kiểm tra hash đích; đối chiếu byte-for-byte với checkout đã build, có bản lưu file trước tích hợp trong evidence riêng tư.
- Synthetic JWT session đọc được cả chiều beta.25 → beta.32 và ngược lại, giữ role; báo cáo chỉ ghi boolean, không lưu/log token hoặc secret.
- Chrome thật dùng database giả: ADMIN/MANAGER/CTV đăng nhập được; CTV không đọc số KPI CTV khác bằng cách đổi query, MANAGER bị 403 với CTV ngoài scope, summary giữ quyền 200/403 và anonymous report 401. Không thay thế kiểm thử mọi chức năng/thu hồi quyền.
- Calculator desktop/mobile vẫn 1 report + 1 me, không lỗi JavaScript. Archive UI POST/XLSX → confirm → cancel, legacy GET 405, unauthorized không purge, hai cron đồng thời purge đúng một lần trên fixture đều đạt.
- Build Next 16.4.1 đạt; lượt build kiểm tra SHA-256 SQLite giả không đổi. Lint trở về 0 error / 4 warning cũ. Next mới còn 4 cảnh báo tracing do code đọc đường dẫn file động trong `cuoc-cd.ts`/`node-0tb-db.ts`; cần xử lý trong Task 4, không che cảnh báo bằng ignore comment.
- Secret scan trên 16 file thay đổi: default scanner chỉ báo đúng khóa CI giả đã có; đã đối chiếu và dùng allowlist cục bộ khớp **đúng file + đúng giá trị giả**, không ignore rule toàn cục. Scan đã review không tìm thấy secret thực; không quét/đưa env hoặc database vào tập file tích hợp.

### Giới hạn và việc tiếp theo

- [ ] **Adoption database đã phục hồi chưa thực hiện.** Runner mới cố ý từ chối nó; không tự điền ledger để vượt guard. Cần snapshot/restore riêng, schema/index/default/foreign-key/content checksum và owner duyệt manifest/release trước mọi target thật.
- [ ] JSON backup nghiệp vụ hiện tại không chứa ledger mới. Không dựng lại history từ tên bảng; cần full snapshot nhất quán hoặc quy trình verified adoption khi restore vào database mới.
- [ ] Chưa bỏ runtime DDL/seed, chưa tối ưu SQL/cache/bundle/viewport bản đồ hoặc redesign UI trong batch 2. Không coi Task 3 hoàn tất end-to-end hay toàn bộ roadmap đã xong.
- [ ] Còn dependency high cần chia release xử lý; cảnh báo dynamic file tracing có thể làm bundle server lớn. Chưa đo p95/INP, cold Function, multi-region/Turso contention hoặc token online chỉ đọc.
- [ ] Chỉ commit/push/deploy sau khi người dùng duyệt riêng. Các kết quả local không cập nhật web đang live và không thu hồi token Turso cũ.

Có thể đề xuất release **source-only bản vá bảo mật, không chạy migration**, tách khỏi dự án adoption/schema, sau khi owner duyệt và staging tương ứng đã được xác minh. Không tự trì hoãn bản vá nguồn chỉ vì chưa cho phép migrate dữ liệu; batch này vẫn chưa deploy vì người dùng chỉ yêu cầu local.

Hướng dẫn: `docs/migration-safety.md`. Plan chi tiết: `docs/superpowers/plans/2026-10-26-migration-security-local.md`. Bằng chứng riêng tư ở `.local/performance/batch2/`; fixture thử nằm trong checkout `.worktrees/ux-performance-batch1/.local/performance/`, không đưa credentials/database vào Git/Vercel.

## 18. Bỏ setup khỏi request và sửa tracing — batch local 3, 26–27/10/2026

### Phạm vi và thay đổi

- [x] Tiếp tục Task 4 của roadmap, **chỉ local**. Giữ các batch 1–2 chưa commit; chụp hash 353 file ở hai checkout trước batch 3 để không ghi đè thay đổi khác. Không đọc env, mở database phục hồi hoặc kết nối Turso thật để kiểm thử batch này.
- [x] Thay DDL/seed trong các `ensure` đang được sử dụng bằng readiness guard chỉ đọc, dùng chung contract cho 7 domain: KPI, khách hàng, tài khoản, Node0TB, mapping, node và công văn. Kiểm tra required column/PK/unique và sự hiện diện 3 default nghiệp vụ, không ép rate hoặc enabled về mặc định. Auth/permission và validation phù hợp được chạy trước guard ở các entry point liên quan.
- [x] KPI từ **49 statement setup ở helper cũ → 2 SELECT khi guard cold, 0 khi warm**; đây chỉ là SQL của readiness, không phải toàn bộ SQL hay độ trễ của API. Single-flight chia sẻ request đồng thời, chỉ cache thành công và cho retry khi lỗi. Structural-only readiness của backup không bỏ qua full readiness của KPI.
- [x] Migration thứ 5 `20261026000000_runtime_schema_readiness` bổ sung 6 index còn thiếu, tránh index trùng UNIQUE, và 3 default (`CuocConfig` id 1, `CuocCdConfig` id 1, `CUOC_N1_N3_RATE`) bằng `ON CONFLICT DO NOTHING`. Giữ nguyên 4 SQL migration lịch sử và cấu hình tùy chỉnh. Chỉ apply vào fixture mới do test quản lý; không apply vào dữ liệu thật.
- [x] Thêm `npm run db:check-schema`: preflight chỉ đọc cả 7 domain hoặc chọn domain, không tự đọc env file, không tạo file thiếu, không seed/adopt. Database đủ contract nhưng chưa có ledger vẫn đọc được; **không đồng nghĩa được phép apply migration**. Thiếu contract báo `SCHEMA_NOT_READY`, không tự sửa schema.
- [x] Chặn file URL/đường dẫn UNC/network ngay trước filesystem probe hoặc client, kể cả dạng encoded/extra slash. Remote `libsql`/HTTPS vẫn yêu cầu opt-in riêng; không thực hiện remote access trong batch này.
- [x] Bỏ tự đọc/import Excel trên GET ở Node0TB và cước CĐ. Hai tên env cũ `NODE_0TB_DEFAULT_FILE_PATH`, `CUOC_CD_DEFAULT_FILE_PATH` bị bỏ qua; parser/upload/import thủ công, matching, thống kê và dữ liệu đã nhập được giữ. Đây là thay đổi hành vi có chủ đích, cần biết trước rollout.
- [x] Backup/restore chỉ kiểm tra cấu trúc, không đòi default phải có trước khi khôi phục backup cũ. **POST restore được cấp quyền** thêm lại đúng 3 default còn thiếu sau các dòng phục hồi trong cùng transaction, giữ rate tùy chỉnh và metric đã tắt; lỗi bổ sung default rollback cả restore. GET không seed; JSON backup v10 vẫn không chứa migration ledger.

### Bằng chứng kiểm tra local

- **50 file / 398 test + 22/22 policy test đạt** trên checkout thử; TypeScript và build Next 16.4.1 đạt. Test mới gồm readonly contract/CLI/cache/constraints, auth-before-schema, không auto-import file, restore mặc định/giữ config/rollback và UNC guard. Có kiểm tra RED → GREEN trước các sửa lỗi chính.
- Lint: **0 error / 3 warning cũ**: `canUseGps` ở trang khách hàng, `skippedRows` ở upload Node0TB, `readSheetObjectRows` ở upload node. Không dọn code ngoài phạm vi chỉ để làm sạch warning.
- **4 cảnh báo dynamic-file tracing trước đó → 0** ở build mới nhờ bỏ default filesystem loader, không dùng ignore để che warning. SHA-256 SQLite giả không đổi xuyên suốt build.
- So sánh **27 response** trước/sau trên 9 endpoint × ADMIN/MANAGER/CTV: HTTP status và hash response body khớp, giữ đúng 200/403 theo quyền. Fixture có metric dương/âm, cước và fallback ngày; đây không thay thế kiểm chứng toàn bộ biến thể dữ liệu thật.
- Chrome thật: **6 lượt calculator = 3 role × desktop/mobile**, mỗi lượt 1 request report, không JavaScript error. Schema và toàn bộ dữ liệu trong fixture không đổi sau nhóm GET/browser mới. Không suy diễn kết quả SQLite local thành tốc độ cloud, p95, INP hoặc cold Function.
- Hai vòng review độc lập xác minh và đóng lỗi false-negative với UNIQUE đảo thứ tự cột, đường dẫn UNC trước filesystem, và restore khi backup thiếu default. Test từ chối partial/expression index thay UNIQUE đầy đủ; contract không dựa vào tên index.
- Đã tích hợp **39 file batch 3** sau đối chiếu hash, giữ các sửa đổi local trước đó và lưu bản trước tích hợp. Chạy lại tại thư mục chính: 50 file / 398 test, 22 policy test, TypeScript đạt; lint 0 error / 3 warning cũ. Secret scan default trên tập file tích hợp không tìm thấy secret; không cần allowlist mới cho batch này.

### Giới hạn và việc tiếp theo

- [ ] **Chưa xác nhận readiness của SQLite phục hồi/Turso thật.** Trước cutover source mới phải được duyệt preflight đúng snapshot/target; nếu thiếu contract cần upgrade được kiểm chứng riêng, không replay SQL lịch sử, baseline mù quáng hoặc đổi guard thành no-op.
- [ ] Adoption/upgrade/rollback dữ liệu thật và bổ sung migration history vào chiến lược backup vẫn là checkpoint riêng của Task 3. Guard không kiểm chứng toàn bộ type/null/default/FK/index hay provenance của database.
- [ ] Cache readiness theo process: thay schema/config trực tiếp ngoài các flow được hỗ trợ cần restart hoặc quy trình release; không có cơ chế invalidation phân tán giữa nhiều instance. Thiếu schema ở HTTP route hiện dùng envelope lỗi sẵn có, không bổ sung màn hình vận hành mới trong batch này.
- [ ] Chưa tối ưu critical-path query, cache dữ liệu/quyền, region Turso, chia bundle, DTO/viewport bản đồ hoặc layout desktop/mobile. Các Task 5–13 còn lại không được xem là đã xong.
- [ ] 17 high của production dependencies là số liệu audit batch 2, chưa xử lý trong batch 3; chưa khẳng định số advisory hiện tại không đổi. Production chưa nhận bản vá local. Chỉ commit/push/deploy hoặc thao tác database thật sau khi người dùng duyệt riêng.

Hướng dẫn mới: `docs/runtime-schema.md`; cập nhật `README.md`, `.env.example`, setup/deploy và migration safety để phân biệt source local với release đang live. Plan: `docs/superpowers/plans/2026-10-26-runtime-schema-local.md`. Evidence riêng tư: `.local/performance/batch3/`; không đưa env, credentials, session, response body hoặc SQLite vào Git. Batch này chưa commit/push/deploy.

## 19. Giảm round-trip và chuỗi chờ KPI — batch local 4, 27/10/2026

### Đã thực hiện

- [x] Tiếp tục phần đầu Task 6, **chỉ local**, giữ các batch trước. Snapshot hash 365 file ở hai checkout trước thay đổi; không đọc env/database phục hồi, không kết nối Turso thật, không sửa dependencies, schema/migration, region hoặc cấu hình cache.
- [x] Personal KPI đọc rows, target cước và completion cước mới nhất song song **sau auth/scope/date/cache gate**. Summary cước đọc target và cùng-ngày song song, giữ fallback theo toàn scope. Không prefetch private data trước quyền hoặc khi không có ngày KPI.
- [x] Summary thông thường gộp hai lượt metadata thành một: giữ minimum sort-order, raw group trước trim, tên trùng sau trim, Unicode/case, negative/max-percent và SQL JOIN/GROUP BY. Không đổi formula/rounding/merge/disabled metric, scope, status, cache key hoặc TTL.
- [x] Thêm SQL templates dùng chung route/EXPLAIN và công cụ local-only `scripts/performance/explain-reports.mjs`; cần file URL tường minh, không auto-load env hoặc target mặc định. Chỉ in planner metadata, không business rows/URL/SQL params/raw driver error. Mở SQLite read-only; missing-file race không tạo database mới. Không dùng công cụ lên target thật trong batch này.

### Bằng chứng và giới hạn

- 60 native Prisma/SQLite test case với **63 status/full-JSON hashes** từ source local trước batch 4; explicit assertions về công thức và scope. Golden không tự cập nhật trong routine tests, có hash hai handler gốc. Cold/warm/read-only/config-preservation và negative/merged/null/empty/fallback/whitespace/case/Unicode/tie đều được kiểm tra.
- Trên fixture ADMIN/MANAGER summary explicit-date: **6→5 logical Prisma reads sau auth giả**, metadata **2→1**, metadata rows **15→15**, warm cache **0→0**. Bao gồm guard/scope khi cold, không gồm auth thật; không tuyên bố toàn API chỉ có 5 SQL hoặc cloud nhanh hơn một tỷ lệ cụ thể.
- Scheduling test có **3 RED → 7 GREEN**; test timing cũ được đổi mock từ ba queue responses thành hai, giữ expected math/payload/manager cache key/TTL. Hai vòng review không thấy sai lệch spec hoặc security trong app patch; công cụ EXPLAIN được bổ sung read-only open sau review để chặn create race.
- Chrome thật: **33 API status/body hashes trước/sau khớp**, 6 calculator cases qua 3 role × desktop/mobile giữ 1 report request, và 4 summary smoke ADMIN/MANAGER × desktop/mobile chọn được nhóm cước trả 200; không JS error. Schema/data fixture không đổi sau GET/browser; build Next 16.4.1 đạt, 0 broad tracing warning, SHA-256 SQLite giả không đổi.
- EXPLAIN trên fixture 12/1.984 dòng và app fixture managed dùng index đang có ở JOIN/aggregate/latest-date. Metadata còn SCAN/sort và personal còn temporary ORDER BY B-tree; chưa thêm index vì chưa đo workload mục tiêu/write cost. Planner SQLite của Node không chứng minh Turso online có cùng plan/RTT.
- Checkout tách riêng đạt **53 file / 504 test + 22 policy test**, TypeScript, scoped lint và build. Lint app còn 0 error / 3 warning cũ. Công cụ EXPLAIN đạt 39 test, có kiểm tra mở database chỉ đọc thật và race file biến mất không tạo database mới. Node 24 phát ExperimentalWarning cho SQLite của công cụ đo local, không phải warning mới của application lint/build.
- Review cuối bắt thêm mismatch ở stderr CLI: test từng suppress ExperimentalWarning nhưng command hướng dẫn không suppress. Đã bỏ flag suppress khỏi test, chỉ load SQLite sau preflight/SQL validation; no-args bị từ chối bằng đúng thông báo đã sanitize, không load engine. Test giữ kiểm tra leak trên toàn bộ stderr, chỉ nhận dạng đúng diagnostic SQLite đã biết; không nuốt warning/error tùy ý. RED 25 → GREEN 39 case.
- Một lượt full-suite tại thư mục chính có child process của test migration cũ thoát **3221225477 / 0xC0000005**, chưa xác định nguyên nhân native. **3 lượt chạy riêng liên tiếp đều 26/26 đạt** trên fixture mới. Giữ log lần lỗi, không thêm retry/ignore hoặc hạ assertion; không coi sự cố đã được sửa hoặc chứng minh native runtime Windows hoàn toàn ổn định. Không liên quan đến thao tác lên database thật vì chỉ dùng fixture riêng.
- Lượt xác minh toàn bộ cuối tại thư mục chính đạt **53 file / 504 test + 22 policy test**, TypeScript và lint đạt (0 error / 3 warning cũ). Đã tích hợp **13 file** sau kiểm tra hash, lưu bản trước tích hợp, đối chiếu source với checkout đã build; secret scan default trên tập file tích hợp không phát hiện secret. Không sửa application code để né lỗi test native.
- **Chưa làm:** benchmark auth/Turso/cold Function/p50/p95/region thật; Task 7 cache invalidation/permission revocation nhiều instance; chia bundle, DTO/viewport map, UI responsive; manager-summary query và phần lifecycle summary/manager của Task 5. Metadata nhiều metric có thể tăng payload so với cách cũ, cần đo trên dataset mục tiêu.
- **Chưa preflight/adopt hoặc migrate database phục hồi/online; chưa commit/push/deploy.** Không tự cutover source mới khi contract của database chưa được duyệt. Chưa xử lý các dependency high còn lại của batch 2.

Hướng dẫn: `docs/kpi-query-performance.md`; plan chi tiết: `docs/superpowers/plans/2026-10-27-kpi-query-local.md`. Evidence riêng tư: `.local/performance/batch4/`; không đưa env, credentials, session, response body hoặc SQLite vào Git. Các số đo local không xác nhận tốc độ web Production.

## 20. Checkpoint công bố mã nguồn GitHub — 27/10/2026

- Chủ dự án yêu cầu commit/push các cải tiến lên repo `dangquocviet2612-del/KpiDiLinh`, nhánh `main`, và xác nhận **"Push main dù có thể tự deploy"**. Không coi đây là yêu cầu chạy migration, verified adoption hoặc sửa dữ liệu thật.
- Phạm vi source gồm các batch 1–4: request/archive safety, vòng đời tải KPI, dependency critical, migration runner tách khỏi build, guard runtime chỉ đọc, bỏ GET auto-import Excel, metadata/query KPI, diagnostics/tests và tài liệu. Không tự thêm feature hoặc đổi nghiệp vụ trong bước công bố.
- Cổng kiểm tra trước push: chạy lại test/policy/TypeScript/lint bằng fixture giả; đối chiếu source đã build; quét snapshot **Git index** và từ chối env/database/backup/upload/credentials riêng tư. CI có đúng một secret giả đã được review, chỉ allowlist theo đúng file và đúng literal, không ignore rule toàn cục.
- Không xác minh kết nối GitHub → Vercel do ngoài phạm vi truy cập được duyệt. Nếu đã bật liên kết, push có thể kích hoạt deploy tự động; không chạy lệnh deploy Vercel, không chạm database thật. Readiness/adoption của SQLite phục hồi/Turso vẫn chưa được xác minh, vì vậy công bố source không chứng minh rollout an toàn hoặc web mới đã qua smoke test.
- Các dòng **"chưa commit/push/deploy"** ở mục 16–19 và plan từng batch là nhật ký checkpoint local trước lần cho phép công bố này, không phải trạng thái nhánh Git sau push. SHA ở GitHub phải được đối chiếu với HEAD local sau khi push; không coi chỉ tạo commit là đã đưa lên remote.
- Evidence riêng tư của bước công bố ở `.local/performance/github-publish-20261027/`; không đưa token, file env, database, credentials, session hoặc báo cáo dữ liệu riêng tư vào commit.

## 21. Cache correctness sau mutation — batch local 5, 27/10/2026

### Phạm vi đã sửa

- [x] Tiếp tục slice đầu Task 7, **chỉ local**, base đã công bố `5193010`. Snapshot 373 file, đối chiếu 308 source/config file trước sửa; tái sử dụng checkout có HEAD cũ `1ecfa38` nhưng app source bằng primary, không reset/commit/branch/push hoặc chạm dữ liệu thật.
- [x] Matrix `cache-tags.ts`: import/config cước clear `cuoc:`/`kpi:`/`prepaid:`; upload node clear `node:`/`nodes:`/`map:`/`customers:` vì mapping sync ghi nodeName; user create/update/delete và restore clear toàn bộ store `kpi-cache` trong process. Nearest-node invalidation riêng được giữ; không xóa JWT, rate limiter hoặc mọi memo khác.
- [x] Cache memory có cap **1.000 entry**, LRU và prune expired khi ghi; hết hạn tại đúng boundary, TTL không hợp lệ/không dương không lưu. Get không kéo dài TTL; giữ ba export và kiểu giá trị cache cũ. Cap theo số entry, chưa theo byte.
- [x] Không chỉ sửa success path: node efficiency đợi `allSettled` rồi clear khi có row write commit; mapping có optional callback sau mỗi batch upsert/sync; user fallback clear nếu write đầu commit rồi raw-field update sau lỗi. Không thêm DML/transaction hoặc biến import thành atomic. Full rollback/401/403/validation/no-write vẫn giữ cache.
- [x] User PUT no-op/fallback `data: {}` không bị coi là write; raw update thành công vẫn được đánh dấu khi update sau lỗi. Giữ audit/response/SQL semantics, không thay cách tính KPI hoặc quyền hiện có.

### Bằng chứng hiện có

- Core: **8 fail/4 pass → 12/12 GREEN**, thêm 4 matrix case. Review bổ sung dependency customer của node có RED 1/4 → GREEN 4/4.
- Native Prisma/libSQL, chỉ mock auth: baseline đầu **14 fail/16 pass (30)**; mở rộng **24 fail/14 pass/6 pending (44)** rồi worker crash `0xC0000005`. Các ca partial-write tập trung đã fail trước crash; giữ log gốc và hash-checked restoration, không gọi lượt này là clean RED, không retry/ignore/pool-change để che lỗi.
- Sau sửa partial commits có **44/44 GREEN**. Review no-op tracker tiếp tục có clean **RED 5 fail/47 pass → GREEN 52/52**, không crash; bao gồm user scope cố định-role, XLSX/KML/KMZ, fallback raw fields, commit batch trước rồi lỗi batch sau, rollback toàn bộ, archive/safeguard và audit. Không coi GREEN là đã xác định/sửa nguyên nhân crash native Windows.
- Các review core và handler đã đóng 4 P2 + 1 P3 sau native regressions, không thấy thêm thay đổi SQL/transaction/formula/API contract ngoài phạm vi. Không dùng mock cache/query để che stale data.
- Full checkout local đạt **56 file / 572 test + 22 policy test**, TypeScript/build đạt; lint 0 error / 3 warning cũ, 0 broad tracing warning. 33 API status/body hashes khớp trước/sau; 6 calculator cases qua 3 role và 4 summary cases ADMIN/MANAGER desktop/mobile không JS error, calculator vẫn 1 report request. SQLite giả không đổi qua build/GET/browser; chưa suy diễn thời gian cloud.
- Thư mục chính đã tích hợp **17 file** sau hash-check, lưu bản trước tích hợp; chạy lại full suite tại primary cũng đạt **572 test + 22 policy test**, TypeScript/lint đạt (3 warning cũ). Source app/tests/scripts/config đối chiếu byte với checkout đã build; secret scan trên tập file tích hợp không phát hiện secret. Preview fixture cổng 3005 đã dừng, hash SQLite giả vẫn bằng trước build; không chạy build bằng env/database thật của primary.

### Chưa hoàn thành — không đánh dấu xong đợt 2

- **JWT/session revocation chưa sửa:** đổi role/xóa user/đổi password không tự hủy claims/cookie cũ. Clear store không phải xác minh lại quyền; cần chốt legacy-session/password policy và subject validation. Phân tích evidence: `docs/cache-permission-gaps.md`.
- **Chưa có shared version/invalidation đa instance**, single-flight, generation chống loader cũ refill sau clear, stable identity/permission-version cho mọi key. Tests same-process không chứng minh các mục đó.
- Chưa đo cloud p50/p95, cold Function, CPU/byte budget với payload lớn; chưa preflight/adopt database phục hồi/Turso; chưa sửa lifecycle summary/manager, bundle/map DTO/CDT hoặc UI của các đợt sau.
- **Chưa commit/push/deploy batch 5 hoặc thao tác database thật.** Commit GitHub vẫn là `5193010`; không suy ra trạng thái Vercel sau push trước đó vì chưa xác minh.

Hướng dẫn: `docs/cache-correctness.md`; plan: `docs/superpowers/plans/2026-10-27-cache-correctness-local.md`. Evidence riêng tư `.local/performance/batch5/`; fixtures riêng trong checkout, không đưa env, credentials, cookies, SQLite hoặc response bodies vào Git.

## 22. Công bố batch 5 lên GitHub và Vercel — 27/10/2026

- Chủ dự án yêu cầu **đẩy GitHub và chạy deploy** sau checkpoint local ở mục 21. Phạm vi là batch 5/cache correctness, không phải đã hoàn tất Task 7 hoặc toàn roadmap.
- Kiểm tra lại trước công bố: 56 file / 572 test + 22 policy test đạt, TypeScript và lint đạt (3 warning cũ). Source đối chiếu checkout đã build bằng fixture giả; quét toàn bộ Git index, giữ env/database/backup/credentials ngoài source upload.
- Deploy đúng project `kpidi-linh`/scope `vietdq9`, giữ cấu hình môi trường có sẵn. Build là `next build`, không migration/seed/adoption/restore hay chỉnh dữ liệu online. Kiểm tra readiness chỉ đọc metadata và sự hiện diện của default trước khi chuyển alias; thiếu readiness thì dừng và báo, không tự sửa database.
- Các gap JWT/session revocation, cache nhiều instance và in-flight refill tại mục 21 vẫn còn; deploy không giải quyết những gap này. Không dùng smoke test Production để thử import/restore hoặc tạo dữ liệu giả vào database thật.
- SHA GitHub, deployment READY/alias và kết quả smoke chỉ được công bố sau xác minh. Báo cáo riêng tư ở `.local/performance/github-deploy-batch5-20261027/`; không commit log chứa credentials, cookies hoặc business rows. Những dòng “chưa commit/push/deploy batch 5” ở mục 21 là checkpoint trước yêu cầu công bố này.
