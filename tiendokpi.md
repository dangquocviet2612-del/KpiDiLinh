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
- Kết quả công bố đã xác minh: `main` và source Production cùng commit `9d0365e51057a2f274d0f37e163042ccc4547e3b`; deployment `dpl_AKhNhpyTKFLeKZ9Dym9TCir5Qmwf` READY, domain `kpidi-linh.vercel.app` trỏ đúng bản này. Fresh Admin login, session Admin từ release cũ, 10 trang và 13 API đạt ở lượt cuối; preflight 7 domain chỉ đọc, không migration hoặc ghi database. Project chưa có Git integration, lần này deploy bằng CLI/gán alias domain đã xác minh.
- Giữ nguyên sự cố trước lượt thành công: một lượt `/api/me` trả 500 khiến rollback; shadow/final smoke sau đó đạt nhưng chưa xác định nguyên nhân. Không gọi đây là lỗi đã được sửa. Báo cáo `release-result.json` và các attempt lỗi vẫn được giữ riêng tư.

## 23. Tổng hợp KPI/KPI quản lý — lifecycle, batch local 6, 27/10/2026

### Đã sửa và kiểm tra ở checkout local

- [x] Tiếp tục phần còn dở của Task 5/đợt 2 sau source `9d0365e`, không đổi UI nhận diện/công thức/API/SQL/auth/schema/dependency. Snapshot 380 file, 312 source/config khớp giữa primary và checkout cũ; không reset checkout hoặc đụng env/database thật.
- [x] Hai resource owner summary/manager-summary dùng `useLatestKpiRequest` hiện có, key theo resource + id/name/role + ngày/manager/group. Cùng key pending được gộp; không reload do object session tương đương. Auto-date/group có alias qua các nhịp debounce nên không lặp request.
- [x] Hủy request ngay khi đổi intent filter (kể cả khoảng debounce), ẩn view, unmount hoặc đổi scope; stale success/error/settled không ghi đè view mới. Đổi scope reset rows/options/meta/error/key, giữ previous data khi refresh cùng scope với trạng thái cập nhật.
- [x] Refresh/retry/mở lại view đọc lại đúng dữ liệu. Import vô hiệu alias cần thiết, chỉ đọc panel đang mở; manager import dùng ngày server trả về, không fetch ngày debounce cũ. Nếu import ẩn thiếu reportDate, giữ latest intent đến khi mở lại; user chọn ngày tường minh ở cả bốn view dùng chung ngày có thể thay intent này. Calculator có local data-revision sau import để bỏ alias cũ và hủy pending reentry, active tải latest còn hidden giữ idle. Giữ `__all__`/allRows và regression personal/calculator; không thay hook dùng chung hoặc auth scope.

### Bằng chứng

- Baseline test cũ 12/12 đạt. Regression mới có clean RED **32 fail/3 pass (35)**; boundary review **1 fail/41 pass (42)** rồi sửa. Spec review bắt thêm explicit-date personal/calculator chưa xóa hidden manager import-latest intent: RED **2 fail/44 pass (46)**, sửa năm dòng callback chung và giữ automatic-resolution control. Quality review bắt calculator có thể reuse empty-date alias trước import: RED **1 fail/47 pass (48)**, sửa ba dòng local revision và giữ hidden-panel control. Final **48 case mới** đạt; targeted cuối **62/62** qua năm file, TypeScript và lint hai file sạch. Không gặp native crash, không thêm retry/ignore để che lỗi.
- Full checkout sau hai P2 **57 file / 620 test + 22 policy test** đạt; TypeScript/build đạt, lint app 0 error/3 warning cũ. Build dùng SQLite giả riêng, hash không đổi.
- Đã tích hợp **6 file** sau hash-check, backup và secret scan; thư mục chính cũng đạt **57 file / 620 test + 22 policy test**, TypeScript/lint đạt (3 warning cũ). Hai vòng review đã đóng cả hai P2 có regression riêng. Source app/tests/scripts/config được đối chiếu byte với checkout đã build; preview riêng cổng 3006 đã dừng và SQLite giả giữ nguyên hash. Không build primary bằng env thật, không commit/push/deploy batch mới.
- Chrome thật qua 8 case ADMIN/MANAGER × desktop/mobile × summary/manager-summary: initial report **4→1 request**, refresh **1→1**, hash JSON trước/sau khớp; manager `__all__` có dữ liệu giả thật. Hai case lỗi 503 giả → retry và đổi ngày nhanh chỉ gửi ngày cuối, hai case history/back có 1 request khi trở lại; không JavaScript error, schema/data fixture không đổi qua GET/browser.
- Fixture batch 3 thiếu ManagerKpiDailyResult, nên lượt harness ban đầu không chứng minh `__all__`; đã tạo fixture giả mới hoàn toàn thay vì sửa API/nới assertion. Không dùng dữ liệu khách thật hoặc upload/import vào Production.

### Còn lại

- Shared `/api/me` query/server session hydration, cache permission-version/JWT revocation/đa instance/single-flight, RUM/region và các đợt bundle/map/UI vẫn pending. Batch này không sửa lỗi `/api/me` 500 từng thấy trên web; nguyên nhân lần đó chưa được xác minh.
- **Batch 6 chưa commit/push/deploy.** Bản GitHub/Production đã công bố gần nhất vẫn là `9d0365e`; chỉ tích hợp local sau review/hash/secret scan và chạy xác minh primary.

Hướng dẫn: `docs/kpi-summary-lifecycle.md`; plan: `docs/superpowers/plans/2026-10-27-kpi-summary-lifecycle-local.md`. Evidence riêng tư: `.local/performance/batch6/`; không đưa env/SQLite/credentials/cookies/business rows vào Git.

## 24. Session dashboard từ server — batch local 7, 27/10/2026

### Phạm vi và thay đổi

- Tiếp tục slice server session hydration của Task 5/đợt 2, giữ nguyên sáu thay đổi local batch 6. Snapshot 383 file; 313 source/config/test file giữa primary và checkout khớp. Không reset checkout cũ, không sửa auth callbacks, API/SQL/schema/dependency/công thức hoặc dữ liệu thật.
- `src/app/(dashboard)/layout.tsx` giữ `auth()`/redirect `/login` và truyền session allowlist expires + user id/name/role/email/image vào Providers. Root layout không còn client Providers global; metadata/lang/Toaster giữ nguyên, `/login` vẫn static. Key id/name/role reset subtree khi server identity đổi, không remount theo expires hoặc object mới tương đương.
- SessionProvider giữ default focus/cross-tab/revalidation/signout, ConfirmDialogProvider vẫn bao dashboard/sidebar. Không truyền server-only token/password hoặc Prisma/auth module vào client. Hydration không phải JWT revocation hoặc cache quyền mới.

### Kiểm chứng checkout

- TDD source gốc **18 fail/2 pass → 20/20 đạt** ở `tests/ui/session-hydration.test.tsx`, dùng SessionProvider thật. Targeted regression **129/129 qua 22 file**, spec/quality review độc lập không còn actionable finding trên bốn hash frozen.
- Full checkout **58 file / 640 test + 22 policy test** đạt; TypeScript/build đạt, lint 0 error/3 warning cũ. Fixture SQLite giả giữ nguyên hash, không build bằng env thật.
- Chrome sáu case ADMIN/MANAGER/CTV × desktop/mobile: initial GET session **2→0**, report **1→1**, hash JSON report khớp. Focus vẫn revalidate đúng role; lượt cuối đo 2 request do SDK broadcast/storage follow-up. Baseline cũ đo 1 trong cửa sổ ngắn hơn; không coi đây là cải thiện/regression focus hoặc cloud latency. Giữ log harness sai kỳ vọng/selector/URL; không thay app hay tắt revalidation để test qua.
- DOM login/logout ADMIN/MANAGER/CTV, anonymous redirect trước/sau logout, sai mật khẩu ADMIN và modal khách hàng desktop/mobile đều đạt; không JavaScript error, schema/data fixture không đổi. Preview riêng được dừng sau kiểm tra. Không ghi nghiệp vụ vào fixture hoặc web thật.
- Đã tích hợp **8 file** sau snapshot/hash/backup, hai vòng review và quét secret mặc định không có finding. Primary cũng đạt **58 file / 640 test + 22 policy test**, TypeScript/lint đạt (3 warning cũ); source app/tests/scripts/config đối chiếu byte với checkout đã build. Giữ nguyên các file batch 6 ngoài roadmap/tiến độ được nối tiếp; không build bằng env thật, không commit/push/deploy.

### Còn lại và trạng thái công bố

- Shared `/api/me` còn pending vì caller GPS/CTV list khác semantics. Task 5/đợt 2 chưa hoàn tất; permission-version/JWT revocation, invalidation đa instance/single-flight, region/RUM, bundle/map/UI vẫn còn trong roadmap.
- Không xử lý nguyên nhân `/api/me` 500 từng thấy ở rollout batch 5. **Batch 6 và 7 chưa commit/push/deploy**; release GitHub/Production đã xác minh gần nhất vẫn là `9d0365e`.

Hướng dẫn: `docs/session-hydration.md`; plan: `docs/superpowers/plans/2026-10-27-server-session-local.md`. Evidence riêng tư: `.local/performance/batch7/`; không commit env/SQLite/credentials/cookies/business rows.

## 25. Dùng chung request tài khoản — batch local 8, 27/10/2026

### Phạm vi

- Tiếp tục shared `/api/me` trong Task 5; snapshot 386 file, 314 source/config/test file khớp checkout, giữ 12 thay đổi local batch 6–7. Không reset checkout detached cũ hoặc sửa API/auth/SQL/schema/dependency/công thức/UI nhận diện.
- Chỉ chia sẻ **request đang chạy** trong dashboard/identity id/name/role. Không thêm client TTL/cache quyền: mở lại modal sau khi request đã xong vẫn hỏi server. Một consumer hủy không ảnh hưởng consumer khác; hết consumer hoặc đổi scope thì hủy và bỏ request cũ, completion/cleanup lỗi thời không đụng replacement.
- Giữ GPS theo response thành công (`ADMIN || canUseGps === true || !!customer`), modal Admin/Manager vẫn đọc `/api/users`; customer/KPI dùng `me.ctvList`. Không lấy danh sách khác contract để thay nhau. Payload sai subject phải bị từ chối; không fetch/render dữ liệu subject cũ sau logout/scope mới.
- Review plan đã bổ sung real SessionProvider.update loading với session data còn giữ, fencing selected/debounced CTV khi me scope mới chưa xong, và subject-mismatch/ABA/entry-identity regression. Không làm mất draft chỉ do renew session hoặc làm panel khác chờ CTV list không cần thiết.

### Bằng chứng

- Chrome baseline ba role × desktop/mobile: customers/modal đồng thời có **2 GET me**, focus có **2**; mở lại tuần tự thêm **1**, KPI mỗi ca có **1 report**, me KPI Admin/Manager **1** và CTV **0**. Hash GPS/options/users/me/report chỉ lưu riêng tư; schema/data fake không đổi. KPI cold đo ở context sạch, không cộng request focus từ trang trước vào startup; giữ log harness lỗi ban đầu.
- TDD assertion-only **38 fail/6 pass (44)** trên caller gốc/fallback test-only, final không giữ fallback. Mở rộng lên 52 test bắt non-array CTV list refresh (**51 pass/1 fail**) rồi sửa guard. Spec review bắt thêm hai P2: refresh cá nhân gửi CTV debounce cũ sau list đổi, và window focus vẫn visible không revalidate; regression **2 fail/51 pass → 53/53**. All UI **169/169 qua 18 suite**, TypeScript/owned lint đạt; spec đã re-approve, không nới assertion test cũ.
- Full checkout sau hai P2 **59 file / 693 test + 22 policy**, types/build đạt, login vẫn static, lint 0 error/2 warning ở upload routes không sửa. Candidate trước P2 được lưu riêng, không coi QA trước sửa là bằng chứng sau sửa.
- Quality review bắt continuation import chậm dùng callback cá nhân của CTV cũ dù list đã đổi. Regression **2 fail/54 pass → 56/56**, all UI **172/172 qua 18 suite**, types/owned lint đạt. Import dùng callback committed mới nhất và guard scope; kiểm tra đường calculator, không sửa hook ngoài scope. Lượt QA/Chrome trước fix được lưu riêng, không coi là bằng chứng candidate cuối.
- Checkout candidate cuối **59 file / 696 test + 22 policy**, TypeScript/build đạt, login static; lint 0 error/2 warning cũ. Browser report cuối gắn build ID + mười source/test hash, không dùng nhầm kết quả trước sửa. Final test runner tắt Vite env-file discovery; build/preview dùng guard chặn env-file root và env fake. CLI RED/GREEN đầu không tắt discovery rõ ràng, không yêu cầu/in nội dung env; không suy ra các lượt đầu không đọc file ngầm. Giữ cảnh báo React act của test nhãn field đồng bộ, không suppress.
- Spec và quality re-review trên mười hash candidate cuối đều APPROVE, không còn actionable P1/P2. Chrome sáu ca: concurrent me **2→1**, reopen tuần tự vẫn **+1**; focus riêng sau reopen xong có **1 GET**, GPS/options/users/me/KPI hash khớp, mỗi ca vẫn 1 report. DOM login/logout ba role đạt, không JavaScript error/ghi nghiệp vụ; schema/data fake giữ nguyên hash, preview riêng đã dừng. Log focus delta 0 ban đầu là đang coalesce đúng vào reopen còn pending, không sửa app/nới assertion để chiều harness.
- Đã tích hợp đúng **14 file** sau hash/backup/review/Chrome/secret scan, giữ các thay đổi batch 6–7 ngoài phần tiếp tục có chủ đích. **Gate full primary chưa đạt:** 58/59 file, 694/696 test hoàn tất trước worker crash Windows `3221225477`/`0xC0000005` ở `tests/integration/kpi-report-equivalence.test.ts` không sửa. Không có bằng chứng nguyên nhân đã được sửa; giữ nguyên log/status fail, không retry/skip/suppress để tuyên bố xanh.
- Primary follow-up đạt **18 file / 172 UI test + 22 policy**, TypeScript/lint đạt (0 error/2 warning cũ); **317 source/config/test file** khớp byte checkout đã build. Giữ đúng 21 thay đổi local kết hợp, bảo toàn 12 thay đổi trước ngoài phần tiếp tục có chủ đích. Kết quả riêng không thay full-suite pass: `integration-scope-verification.json` ghi `complete: false` và `fullPrimarySuitePassed: false`; chỉ đóng gate sau khi chẩn đoán native crash và xác minh lại. Không commit/push/deploy.

### Giới hạn / công bố

- Không giảm request giữa những lần mở modal tuần tự sau settlement, không hứa cloud latency/p95. `/api/me` server cache 30s vẫn còn; đây không phải JWT revocation/permission-version/invalidation đa instance hay sửa sự cố `/api/me` 500 trước đây.
- **Batch 6–8 chưa commit/push/deploy**. Release đã công bố gần nhất được xác minh là `9d0365e`; đợt 2 và toàn roadmap còn các mục chưa làm.

Hướng dẫn: `docs/current-user-query.md`; plan: `docs/superpowers/plans/2026-10-27-shared-current-user-local.md`. Evidence riêng tư: `.local/performance/batch8/`; không commit env/SQLite/credentials/cookies/business bodies.

## 26. Khoanh vùng crash native Windows — 28/10/2026

- Snapshot 391 file, 317 source/config/test khớp checkout, bảo toàn 21 thay đổi local batch6–8 và các log fail cũ. Không đổi mã app, test source/assertion, manifests/lockfile, DB/env thật, không commit/push/deploy.
- Đã tái hiện lỗi **ngoài app/Prisma/Vitest**: matrix cố định 18 child process, concurrency 2, mỗi mode 6 process × 300 DB trống in-memory. Mode libsql không close để GC/finalizer xử lý có **4/6 crash 3221225477/0xC0000005**; libsql close tường minh và control node:sqlite đều **6/6 exit 0**. Thêm riêng sáu child node:sqlite không-close với cùng GC workload cũng **6/6 exit 0**, tổng 24 child, không chạy lại matrix cũ. Một child ghi JS complete/exit handler code 0 trước native crash. GC là kích hoạt chẩn đoán, không phải workaround vận hành; mẫu nhỏ không chứng minh close() sửa được lỗi.
- Direct probe 60 vòng dual-client/480 Prisma SELECT song song đạt; file KPI giữ nguyên có trace **60/60 đạt**. Một full run có trace, env discovery tắt và cwd đúng đạt **59 file / 696 test**, không đổi pool/skip/auto-retry/suppress. **Không coi pass này là native đã sửa**; giữ nguyên failed primary run ngày 27/10 và gate tin cậy Windows còn mở.
- Installed binding 0.5.22 cùng SHA giữa primary/checkout, binary có core string libsql-0.9.23. Đối chiếu maintainer PR235/libsql-js và core PR2261 cho thấy lỗi native tương tự đã được mô tả upstream; chưa có stack của crash gốc để kết luận frame/cơ chế chính xác. Chỉ đọc metadata stable latest 0.5.29, không tự nâng hoặc khẳng định phiên bản đó chứa patch.
- Helper lần đầu sai cwd gây lỗi migration/setup đã được lưu riêng; không dùng lỗi harness làm bằng chứng app/native. Không đọc dump, không sửa những cleanup gap chưa chứng minh liên quan. Chưa có distro WSL/Docker local được xác minh để nghiệm thu Linux; không tự cài toàn máy hoặc push CI.

Chi tiết và nguồn: `docs/native-crash-investigation.md`; plan `docs/superpowers/plans/2026-10-28-native-crash-investigation.md`. Evidence private `.local/performance/native-crash-20261028/`. **Chưa đóng native Windows acceptance, chưa push/deploy.**

## 27. Chặn cache cũ nạp lại sau invalidation — local 28/10/2026

### Phạm vi và triển khai

- Tiếp tục slice correctness Task 7; snapshot **393 file /317 source/config/test** khớp checkout, giữ 23 thay đổi local trước đó. Không reset checkout detached cũ, không đổi auth/JWT/SQL/TTL/key/API body/schema/dependency/công thức hoặc dữ liệu thật.
- Core dùng một Symbol generation cho module/store, đổi ở mọi prefix clear kể cả store rỗng. **34 setter /23 owning functions /18 caller files** lấy token tại entry trước await auth/scope/date/schema và truyền vào setter. Token cũ bị bỏ trước invalid-TTL delete/prune/replace/LRU eviction, không ghi đè giá trị mới.
- Invalidation vẫn chỉ xóa settled entries khớp prefix; ongoing fills bị fence bảo thủ sau bất kỳ invalidation nào kể cả prefix khác. Có thể làm giảm cache hit trong lúc ghi dữ liệu; chưa có benchmark hit-rate/latency Production, không tuyên bố web nhanh hơn theo tỷ lệ.

### Kiểm chứng candidate

- Runtime RED trên code cũ **14 assertion fail /4 pass**, final bỏ fallback generation test-only. Regression mới **37/37 qua hai file**: 18 deferred race/core behavior và 19 AST inventory/entry/fourth-arg checks. Core cũ **12/12**, dependency matrix **4/4** giữ nguyên.
- Bảy mock test files thêm export generation và exact token; năm exact setter assertions giữ nguyên ba đối số cũ. Scoped run **174 test**, archive timezone bổ sung **12 test** đạt. Kiểm tra cơ học đảo các import/token/đối số mới tái tạo source cũ sau CRLF normalization; không thay SQL/guard/timing hoặc nới assertions.
- Candidate checkout **61 file /733 test +22 policy**, TypeScript/build đạt; login vẫn static, lint **0 error/2 warning cũ** tại hai upload routes không sửa. Core/hai test mới và 25 worker-owned files đều scoped lint 0 error/warning. Fixture fake build giữ nguyên hash, frozen source không đổi.
- Full checkout dùng outer Vitest `envDir:false`, explicit database/Turso env giả; wrapper timezone cũ spawn CLI nên lần này **chưa attest child không đọc env ngầm**. Build có root env-file guard. Giữ manifest gốc và ghi correction metadata riêng, không đổi kết quả test; primary QA sẽ dùng inherited guard cho cả hai repo roots và child. Không dùng việc sửa harness làm native workaround/retry để ép xanh.
- Spec rồi quality review độc lập đều **APPROVE** trên 28 frozen source/test hashes, không còn actionable P1/P2. Đã tích hợp đúng **34 file** có preimage/hash/backup và secret scan mặc định không finding, bảo toàn 23 thay đổi trước ngoài hai tài liệu tiến độ được nối tiếp.
- Primary đạt **61 file /733 test +22 policy**, TypeScript/lint đạt (0 error/2 warning cũ). Runner primary kế thừa guard chặn env-file ở cả hai repo roots, kể cả timezone child; fixture fake và frozen source giữ nguyên. **319 source/config/test file** được đối chiếu byte với checkout đã build. Đây là gate của slice generation, không đóng Windows native reliability hoặc toàn Task 7.
- Helper primary lần đầu dừng trước khi Vitest khởi chạy vì backslash trong `NODE_OPTIONS --require` bị Node giải mã sai. Giữ log/manifest gốc, chuẩn hóa đường dẫn helper sang slash và probe guard thành công trước lượt test thực sự đầu tiên. Không thay app/assertion hoặc chạy lại một native failure để ép xanh.

### Giới hạn / công bố

- Đây chỉ là **stale cache publication fence cùng module/store**, không hủy response cũ, không single-flight, không shared version nhiều process, không đổi JWT/permission version hoặc SLA thu hồi quyền. Những gap auth/PWA vẫn còn; Task 7 và toàn roadmap chưa hoàn tất.
- Full run đạt không có nghĩa native Windows/libsql đã sửa: không nâng binding, đổi pool/skip/auto-retry hoặc đóng reliability gate. Sự cố `/api/me` 500 của rollout batch5 vẫn chưa xác minh nguyên nhân.
- Chưa commit/push/deploy; không công bố lại các batch local trước. Release GitHub/Production đã xác minh gần nhất vẫn `9d0365e`.

Chi tiết: `docs/cache-generation.md`; plan `docs/superpowers/plans/2026-10-28-cache-generation-local.md`. Evidence private `.local/performance/cache-generation-20261028/`, không commit SQLite/env/token/credentials/business rows hoặc logs.

## 28. Chia bundle giao diện báo cáo — local 28/10/2026

### Phạm vi

- Bắt đầu slice Task8, snapshot397 file/319 source khớp checkout, giữ55 thay đổi local trước. Tái sử dụng checkout detached cũ, không reset/branch/commit/push/deploy hoặc dùng dữ liệu thật.
- KPI cá nhân vẫn static,10 panel khác dùng top-level literal `next/dynamic` với SSR mặc định. Hooks/state/guards/scope/API/callback/công thức/CSS không đổi; business body của shell byte-identical. Chưa tách view containers/hook ownership hoặc CSS.
- Loading dùng skeleton/container có sẵn với status/busy accessible. Error boundary riêng prepaid dùng AsyncState, nút **Tải lại trang** và cảnh báo mất draft; không chỉ reset promise import đã reject, không tự reload khi người dùng chưa bấm.

### Kiểm chứng và số liệu

- TDD code cũ có **18 semantic module-evaluation failures**; final **20 test mới**, toàn UI **192/192 qua19 file**.18 UI file cũ/461 assertions không đổi, không dùng preloadAll hoặc ssr:false để chiều test. Owned lint0 warning/error, TypeScript đạt.
- Full candidate checkout **62 file/753 test+22 policy**, TypeScript/build đạt, login static; lint0 error/2 warning cũ ở hai upload routes không sửa. Vite envDir:false và inherited env-file guard cho cả hai repo roots/child, fake DB/source hash không đổi.
- Chrome **34 ca**: ADMIN11 view×2 viewport, MANAGER4×2, CTV2×2. Mỗi cold context trước sửa tải783.436 byte JS decoded/12 scripts. KPI cá nhân sau sửa **638.158 byte**, giảm **145.278 byte/18,54%**, nhưng script responses tăng **12→14**; selected views đo đến659.169 byte. Không quy giảm byte thành giảm18,54% thời gian hoặc claim p95/Production.
- API báo cáo và me/users được theo dõi giữ status/count/body hash; settled headings/buttons/text hash/overflow khớp toàn34ca. Không JS error/business write, fixture fake không đổi. Đây không phải kiểm thử mọi role ở mọi domain/điện thoại thật/PWA lifecycle.
- Compiled App Router thật: personal không request chunk calculator; khi giữ chunk pending, report API đã hoàn tất và loading accessible hiện trước khi nhả chunk. Chặn chunk2 lần hiện error UI/cảnh báo draft; bấm reload tải lại script thành công, giữ view và report hash, không ghi nghiệp vụ.
- Native browser click sidebar/Back giữ ngày/CTV. **Draft calculator bị normalize sau forced reentry refresh đã có ở baseline và vẫn như vậy sau sửa**; test mới chỉ chứng minh giữ trong lúc pending. Không sửa hook trong slice bundle, ghi riêng follow-up để giữ/cảnh báo draft đúng policy.
- Baseline harness đầu nhầm21/26 RSC prefetch bị Next hủy với lỗi network; diagnostic và log giữ nguyên, classifier chỉ tách nonnavigation fetch/_rsc/ERR_ABORTED và vẫn fail script/API/navigation bất thường. Navigation baseline kỳ vọng draft quá mạnh đã fail sau ghi observations; giữ `preservedDraft:false`, after đối chiếu cùng behavior, không ghi thành đã fix.

### Gate / công bố

- Spec rồi quality review độc lập đều **APPROVE trên4 frozen source/test hashes**, không còn actionable P1/P2. Quality agent đầu lỗi service capacity, không được coi là đã review/approve; reviewer mới đọc độc lập và xác minh business body/hash/artifacts trước-sau.
- Đã tích hợp đúng **8 file** sau hash/preimage/backup và quét secret mặc định không finding; giữ55 thay đổi trước ngoài ba file được tiếp tục có chủ đích (shell/roadmap/tiến độ), không sửa461 assertions cũ.
- Primary cũng đạt **62 file/753 test+22 policy**, TypeScript/lint đạt (0 error/2 warning cũ), inherited env-file guard cho root/child và fixture fake không đổi. **322 source/config/test file** đối chiếu byte với checkout đã build; không thay application source sau QA. Đóng slice lazy panel, không đóng toàn Task8 hoặc native Windows reliability.
- Task8 còn view/hook owner/CSS split và broader budget/CLS. Task7 auth/version/nhiều instance/single-flight, native Windows reliability và nguyên nhân `/api/me`500 cũ vẫn chưa xử lý; full run xanh không đóng các gate đó.
- Chưa commit/push/deploy các bản local. Release đã xác minh gần nhất vẫn `9d0365e`; không tự migration/deploy bằng dữ liệu thật.

Chi tiết `docs/prepaid-panel-loading.md`; plan `docs/superpowers/plans/2026-10-28-prepaid-panel-loading-local.md`. Evidence private `.local/performance/bundle-views-20261028/`; không commit log/SQLite/env/cookie/credential/body nghiệp vụ.

## 29. Giữ draft Tính KPI sau reentry/Refresh — local 28/10/2026

### Lỗi và thay đổi

- Tiếp tục lỗi đã chỉ ra ở mục28, snapshot402 file/322 source khớp checkout và60 thay đổi local trước. Không reset/branch, không dùng database/env thật hoặc tự công bố.
- Old onSuccess normalize lại toàn draft sau GET. Policy mới giữ **explicit overrides cùng scope/import revision, CTV và ngày**, source/defaults chưa sửa vẫn làm mới. Một active context, không persistent draft/history. Đổi date/CTV/scope/revision/logout hoặc chỉ tiêu bị bỏ không mang draft cũ theo, A→B→A không phục hồi; initial blank→resolved date alias giữ1request.
- Typing/step/target khi GET chờ thắng khi response về; Reset trong lúc chờ không resurrect override. Error cùng context giữ dữ liệu/draft hiện có, không fallback scope khác. Snapshot owner fence/masking bảo vệ data/command cũ khi đổi context.
- Nút **Khôi phục dữ liệu gốc** dùng optional hasDraftEdits qua một prop shell để khả dụng với edit có zero score delta/cap/rỗng/raw format; fallback standalone giữ cũ. Không đổi dirtyCount, caption, formula/parser/rounding, UI layout, API/auth/cache/schema/dependency hoặc shared request hook.

### Regression / review / candidate

- Initial real-hook RED **46 fail/10 control pass →56/56**, old19UI file/assertions byte-identical; allUI248 đạt. Spec review bắt P2 inherited overrides lookup cho mã constructor/toString/hasOwnProperty; thêm6 before-edit/after-Reset cases **6fail/56pass→62/62**, sửa own-property lookup.
- R1 full809 test+22policy/types/lint/build đã đạt nhưng không dùng làm proof sau P2. Giữ R1 artifacts riêng; R2 **63 file/815 test+22 policy**, TypeScript/build đạt, login static; lint0 error/2 warning cũ ở upload routes không sửa. Fake DB/frozen source giữ hash, env-file discovery tắt/guard kế thừa root và child.
- Spec re-review và quality review độc lập R2 đều **APPROVE** trên4 frozen source/test hashes, đóng P2, không còn actionable P1/P2. Old19UI files/assertions vẫn byte-identical; không lấy approval R1 thay candidate cuối.
- Đã tích hợp đúng **9 file** sau preimage/hash/backup và secret scan mặc định không finding, giữ60 thay đổi trước ngoài các file được tiếp tục có chủ đích. Primary đạt **63 file/815 test+22 policy**, TypeScript/lint đạt (0error/2warning cũ), env-file guard kế thừa và fixture fake không đổi.
- **323 source/config/test file** đối chiếu byte với checkout R2 đã build; application source không thay sau QA. Đóng slice draft fix, không đóng toàn Task8 hoặc native Windows gate; tài liệu bundle cũ được đánh dấu checkpoint lịch sử và dẫn sang policy mới, không sửa lại số liệu cũ.

### Browser thật trên fixture giả

- Baseline34 ca API/UI/JS giữ build trước sửa, cộng6 case draft ba role×desktop/mobile. Cả6 mất override sau Back, Refresh và edit lúc pending; Reset không khả dụng dù edit khác default, không JS/API error/ghi nghiệp vụ.
- R2 sau sửa **6/6 đạt**: giữ override sau Back/Refresh/late response, Reset khi pending và reachability đúng; đổi CTV/date/roundtrip không carry draft. API response thật, không fake response để test qua. Fixture SQLite giữ hash, preview riêng đã dừng.
- **34 ca** report/API me/users giữ status/count/body hash và settled UI khớp baseline, không JS error/business write. Personal JS decoded **639.813 byte** so638.158 trước fix (+1.655), vẫn dưới eager baseline783.436;14script responses giữ nguyên. Đây là bugfix, không claim tốc độ/p95 hoặc thêm giảm byte.
- Harness v1 đợi response rồi cố click disabled Reset gây waiter timeout; v2 kỳ vọng sai zero rows trên ngày không có kết quả, trong khi LEFT JOIN metric config vẫn tạo defaults. Giữ source/log/observations cả hai; sửa helper/waiter và record baseline defect, không sửa API hoặc hạ gate after. Sáu case after bắt buộc toàn bộ preservation/reset/context flags đúng.

### Giới hạn / công bố

- Không giữ draft qua full reload/unmount/đóng tab/logout; warning của prepaid error recovery vẫn đúng. Khi tách hook/view owner trong Task8 phải giữ state contract này, không unmount owner cơ học làm mất draft.
- Task8 view/hook/CSS extraction, auth/version/revocation/nhiều instance/single-flight, native Windows/libsql reliability và nguyên nhân me500 cũ vẫn chưa xử lý. Full pass không chứng minh native đã hết lỗi, không đổi binding/pool/skip/retry để ép xanh.
- Chưa commit/push/deploy. Release đã xác minh gần nhất vẫn `9d0365e`; không tự chạy migration hoặc đọc credentials thật.

Chi tiết `docs/kpi-calculator-drafts.md`; plan `docs/superpowers/plans/2026-10-28-calculator-drafts-local.md`. Evidence private `.local/performance/calculator-drafts-20261028/`; không commit env/SQLite/log/cookie/credentials hoặc body nghiệp vụ.

## 30. Thử tách CSS công văn — không đạt, giữ app cũ — local 28/10/2026

### Thử nghiệm và kết quả

- Tiếp tục selective CSS của Task8, snapshot405file/323source khớp checkout và65 thay đổi local trước. Giữ hooks/state tại shell để không mất filter/draft hoặc tạo API waterfall; không đổi giao diện/nghiệp vụ/auth/schema/dependencies.
- Candidate chuyển71class/99rule (83base+16mobile900px),102references; bốn panelState rules dùng chung không chuyển. AST/declarations/media/order và component-prefix reversal khớp preimage;16consumers audit,20UI test files cũ byte-identical. TDD7semantic fail/1pass→8/8.
- Full candidate **64file/823test+22policy**, TypeScript/build đạt, login static, lint0error/2warning cũ. Đây là kết quả thử nghiệm bị loại, không phải kết quả app sau phục hồi.
- Chrome34case chạy đủ ba role×desktop/mobile rồi **exit1** ở assertion CSS phải giảm: personal **164.879→165.001 byte (+122),3stylesheets**. Comparator API/settled UI chạy trước gate đó; không có browser-after PASS/final manifest, không đánh dấu toànbrowser gate xanh.
- Diagnostic độc lập xác nhận personal tải asset68.267byte chứa cả docsToolbar/docUrlModal và shared panelState. Source extraction không tạo deferred CSS trong build này. JS candidate637.206 so639.813(-2.607byte) không đủ để nhận khi mục tiêu CSS thất bại; không claim web nhanh hơn.
-48visual cases sáng/tối ở390/768/900/1024/1440px khớp computed styles/PNGhash;6draft cases giữ policy mục29. Visual dùng fixture tổng hợp riêng, không giả response để thay API-equivalence. Không chứng nhận hover/focus/screenreader/điện thoại thật.

### Quyết định và giữ lại

- Spec review PASS lossless extraction, quality review **REJECT integration** theo runtime gate; không đổi bundler/SSR hoặc nới assertion để ép đạt.
- Lưu bốn file candidate, diff/hashes/CSS build/logs, sau đó phục hồi **đúng bốn file do thử nghiệm thay đổi**, đối chiếu405snapshotfiles khớp cả hai checkout. Không reset Git/branch hoặc bỏ65 thay đổi trước, không nhận CSS/unit test candidate vào app.
- Preview candidate riêng đã dừng. Build trong WT thử nghiệm không còn khớp source đã phục hồi; phải build lại trước khi dùng next start, không dùng nó làm preview app hiện tại.
- Tài liệu mới `docs/official-docs-css.md` ghi số liệu/giới hạn và follow-up; Task8 vẫn partial. Không dùng raw sourcebyte giảm do CRLF normalization làm network savings.
- Full primary sau phục hồi **không đạt**:62/63file,801/815test hoàn tất; worker crash3221225477/0xC0000005 tại `tests/integration/cache-invalidation.test.ts`, không phải assertion14test fail. Giữ log/exit1, không rerun suite/skip/đổi pool. Chưa có native stack chứng minh chính xác nguyên nhân lần này, không gán chắc chắn cho một frame/binding.
- Runner dừng ở suite fail; chạy riêng22policy/TypeScript/lint sau đó đạt (0error/2warning cũ) nhưng không thay kết quả full-suite thất bại.323source/config/test khớp byte snapshot và hai checkout, application code giữ nguyên.
- Chỉ tích hợp bốn tài liệu sau preimage/hash/backup, whitespace và default secret scan không finding; không nhận bất kỳ application/test candidate nào. Giữ65 thay đổi trước ngoài hai tài liệu roadmap/tiến độ được nối tiếp có chủ đích. Gate nghiệm thu primary/native vẫn mở.

### Việc còn lại / công bố

- Selective CSS thực sự deferred và view/hook ownership chưa hoàn tất. Muốn thử ranh giới khác phải giữ draft/filter/scope/direct-link/SSR và chứng minh không tạo code→API waterfall; không lặp cách source-only rồi tuyên bố tăng tốc.
- Task9 payload marker là hướng tiếp theo có thể đo trước khi sửa, chưa triển khai ở slice này. A11y label bọc nút Chèn ảnh URL có sẵn cần follow-up Task11, không sửa markup trong thử nghiệm CSS.
- Native Windows/libsql reliability, auth/version/revocation/nhiều instance/single-flight và nguyên nhân me500 cũ vẫn mở. Không native retry/skip/pool/dependency workaround.
- Chưa commit/push/deploy; release đã xác minh gần nhất vẫn `9d0365e`.

Chi tiết `docs/official-docs-css.md`; plan `docs/superpowers/plans/2026-10-28-official-docs-css-local.md`. Evidence private `.local/performance/official-docs-css-20261028/`; không commit env/SQLite/log/cookie/credentials hoặc business body. Các lỗi helper ban đầu và bằng chứng thất bại được giữ, không sửa lịch sử thành PASS.

## 31. Xác minh bản stable cho native crash — local 28/10/2026

- Tiếp tục điều tra worker crash mục30 trước khi nâng dependency. Snapshot407file/323source khớp hai checkout, giữ67 thay đổi local trước; không reset/branch/commit/push/deploy hoặc đọc database/env thật.
- Metadata npm public xác nhận stable `libsql0.5.29`, gitHead `55bee86d1c284f1ddf2b9e280e870d2b6cef884a`, optional Windows0.5.29. Cargo.toml/lock source release khai báo core0.9.30.
- Source core tag0.9.30 vẫn gọi close mà không null raw handle như PR2261; binding src/lib.rs0.5.29 thiếu pin_module_in_memory/GetModuleHandleExW của PR235. **Chưa thiết lập được verified fixed stable candidate**, không nâng chỉ vì version cao hơn installed0.5.22.
- Đây là đối chiếu source/metadata, **không** kiểm tra/chạy binary npm0.5.29, không chứng minh build provenance hoặc xác định native frame của lần cache-invalidation.test.ts crash. Cùng mã0xC0000005 không tự chứng minh cùng một nguyên nhân.
- Không cài package/prerelease/custom binary, sửa app/test, đổi pool/skip/retry hoặc chạy lại full suite/stress matrix. Giữ kết quả primary **801/815 hoàn tất rồi worker exit3221225477**, chưa có full-suite PASS mới; không dùng số test cũ làm nghiệm thu lần này.
- Helper đầu giả định sai module pin; upstream patch thực tế thêm hàm pin_module_in_memory trong lib.rs. Giữ source/error v1 và sửa riêng helper trên responses đã lưu; không sửa application/assertions native hoặc fetch/test lại để ép xanh.
- Native Windows gate vẫn mở. Đề xuất tiếp Task9 giảm payload bản đồ trong khi giữ cảnh báo; nếu ưu tiên Linux thì cần thống nhất môi trường/cách chạy trước. Chưa cài WSL/Docker, chạy CI cloud hoặc bắt đầu sửa DTO trong audit này.

Chi tiết `docs/native-crash-investigation.md`; follow-up plan `docs/superpowers/plans/2026-10-28-native-crash-investigation.md`. Evidence private `.local/performance/native-stable-audit-20261028/` chứa metadata/source URL+hash, snapshot và manifest tài liệu; không commit env/SQLite/log/credentials/business rows. Không đánh dấu Task8/9 hoặc Windows native acceptance hoàn tất.

## 32. Node0TB map — opt-in payload rút gọn — local 28/10/2026

### Phạm vi và thay đổi

- Owner đã chọn tiếp Task9 độc lập, giữ cảnh báo native Windows chưa xử lý xong. Snapshot407file/323source khớp checkout,67 thay đổi local trước. Không reset/branch, dùng env guard và bản sao SQLite giả riêng16node/12tọa độ/4thiếu; original fake DB không đổi.
- Bản đồ gọi `/api/node-0tb?projection=map`, giữ8field đang dùng: id/nodeCode/dateKdFormatted/totalPort/categoryKd/latitude/longitude/hasCoordinates. API không có/unknown/empty/case khác projection vẫn trả legacy đủ field. Dữ liệu không bị xóa khỏi DB.
- Pure allowlist mapper sau getNode0TbList. Không đổi byte SQL/matching/readiness service; description search vẫn chạy trước projection, stats/categories tính trên toàn dataset trước filter như cũ. Không thêm per-marker request/cache/query, không claim giảm backend SQL/thời gian.
- Component chỉ thay type names và URL, đảo hai thay đổi tái tạo đúng preimage; original type models giữ nguyên prefix. Không đổi JSX/CSS/popup/hooks/state/handler/role guard/DELETE/upload/template. Quyền đọc ba role và admin-only UI giữ semantics hiện có.

### Regression và QA

- Plan review phát hiện tên test định tạo đã tồn tại, đổi sang `tests/unit/node-0tb-projection.test.ts`, giữ regression tile-provider cũ. Initial RED có2selector lỗi tên accessible ghép sẵn, sửa riêng selector mới trước production edits: clean semanticRED **12fail/41pass→53/53** (26unit+11UI mới,15readonly+1tile cũ).
- Unit chạy route/getNode0TbList/mapper thật với mock auth/Prisma/readiness boundaries, không native addon. Cover0/null/escaped/future fields/purity/order, exact/base/prefix/missing tọa độ, global stats/filter/description search, legacy fallback, ba role/auth-before-data/errors/empty và query/write counts.
- UI component thật với Leaflet/session/fetch/browser mocks cover counts/list/search/filter/fit/zoom/popup/clipboard/GPS/admin menu/template/upload callback/retry, kể cả projection URL sau upload.20UI files và tất cả assertions cũ không đổi.
- WT đạt **26file/387scoped test+22policy**, TypeScript/build đạt, login static; lint0error/2warning cũ. Fake DB/frozen6source hash không đổi; inherited env guard root/child. Không chạy lại full native suite đã biết lỗi, không skip/retry/pool/upgrade workaround; không có full-suite PASS mới.
- Source spec và quality review độc lập đều APPROVE sáu frozen hashes **cho source/API**, không thay thế runtime gate hoặc nghiệm thu native.

### Đo lượng tải / browser

- 12case trước/sau: ba role×390/1440px×app light/dark. API thật trên cùng SQLite giả: initial payload **6.166→3.203byte**, giảm2.963byte/**48,05%**; legacy responsehash giữ nguyên. No per-marker request; initial1request, lỗi500 được inject riêng rồi retry đúng endpoint trả lại cùng data.
- Lượt đầu72tóm tắtUI (text/button/disabled/overflow, **không phải toàn DOM**) khớp,41/48PNG khớp;7ảnh khác17–26pixel với maxchannel1–2 tại glyph toolbar/filter. **Gate ảnh đã fail**, không kết luận các delta này vô hại hoặc bỏ assertion. Giữ source/log/ảnh lần đầu và diagnostic.
- Same-build paint control5lượt sau350ms có geometry/raw/encoded hashes ổn định,0active animations. Chuẩn hóa settle350ms+hai animation frames và thêm geometry/style hash cho **cả baseline/candidate**, vẫn bắt PNGhash khớp tuyệt đối. Tạm phục hồi đúng6preimages để rebuild baseline, sau đó phục hồi exact6candidatehashes, scoped QA/build lại; không authored UI edit hoặc reset/bỏ các thay đổi trước.
- Controlled lượt2 vẫn **strict gate FAILED**:72tóm tắtUI khớp,45/48PNG khớp;3PNG khác ở CTV390light missing-list/popup và CTV1440light popup;2geometry/style hash khác ở ADMIN390light/CTV390dark error states. Chưa xác minh nguyên nhân, không gọi là raster flake/vô hại; giữ nguyên runner exit1, assertions và evidence capture-v1/v2.
- Báo cáo `browser-functional-after.json` tách riêng: API/retained values/order/stats/legacyhash và72tóm tắtUI đạt, nhưng strictRasterAndGeometryGatePassed=false/fullDomEquivalenceEstablished=false. Không tạo `browser-after.json` PASS để che failure.
- Review độc lập Avicenna **APPROVE LOCAL FUNCTIONAL ONLY**, không miễn image gate hoặc đóng QA. Cho phép checkpoint local có thể hoàn nguyên dựa trên source/API contracts, giữ visual/native/release acceptance mở.
- Đã tích hợp đúng **11file** (6source/test,5docs) sau preimage/hash/backup, whitespace và default secret scan không finding. Giữ67 thay đổi local trước ngoài các tài liệu được nối tiếp có chủ đích; primary có75path dirty, không commit/branch/publish.
- Primary đạt **26file/387scoped test+22policy**, TypeScript/lint đạt (0error/2warning cũ), env guard/fake DB/frozen source giữ nguyên. **326source/config/test** đối chiếu byte với WT candidate đã build; không authored application edits sau QA. Không chạy full native suite hoặc tuyên bố full-suite/visual acceptance đã đạt.
- Manifest kết quả ghi **functionalProjectionImplemented=true, completeForNode0TbProjectionSlice=false, strictVisualGatePassed=false**, Task9/native/release vẫn mở. Đây là checkpoint functional có thể hoàn nguyên, không phải ảnh đã khớp hoặc toàn slice hoàn tất.
- Size-only benchmark cùng frozen mapper:1k/10k/50k metadata tối thiểu giảm44,57/44,45/44,32%; metadata thông thường note/description ngắn giảm51,44/51,32/51,21%. Giữ retained values/order/stats/categories; không mutate inputs. Không query DB, chạy lookup hoặc render50k marker; không claim compressed transfer/latency/p95.

### Giới hạn / công bố

- Chỉ Node0TB marker projection. Bản đồ khách hàng/node thường, reuse/lookup tối ưu, bbox/clustering và toàn Task9 còn pending; mục tiêu50% không đạt ở mọi dataset, browser fixture giảm48,05%.
- Browser tile images tổng hợp, service worker tắt, GPS denial inject; không chứng nhận provider/điện thoại/PWA thật hoặc clipboard/upload nghiệp vụ Production. Popup/UI state được đối chiếu riêng, không dùng fake success API để thay payload-equivalence.
- Helper prepare ban đầu giả định fixture cũ rỗng nhưng có2row; dừng trước seed/build, giữ evidence và chỉ clear/seed bản sao fake sau hash check. Browser helperv1 đợi server-error text trong khi UI có thông báo HTTP chung; giữ log/ảnh và sửa locator, không thay app/gate.
- Native Windows/libsql/full primary801/815fail từ mục30 và các auth/PWA gate vẫn mở. Không báo đã sửa native hoặc đủ điều kiện release.
- Chưa commit/push/deploy, release đã xác minh gần nhất vẫn `9d0365e`.

Chi tiết `docs/node0tb-map-projection.md`; plan `docs/superpowers/plans/2026-10-28-node0tb-projection-local.md`. Evidence private `.local/performance/node0tb-projection-20261028/`; không commit SQLite/env/log/cookie/credentials hoặc business rows.

## 33. Bản đồ khách hàng — node coordinates DTO — local 29/10/2026

### Phạm vi và hợp đồng

- Tiếp tục Task9 theo hướng đã duyệt, không đổi giao diện/nghiệp vụ. Snapshot412file/326source, giữ75 thay đổi local trước; dùng lại WT hiện có, không reset/branch/commit/push/deploy, đọc env/database thật hoặc đổi dependency.
- Bản đồ khách hàng đổi duy nhất node bootstrap sang `/api/nodes?projection=coordinates`, chỉ nhận id/name/latitude/longitude. Original types giữ nguyên byte-prefix, component chỉ đổi type import/state và URL; mechanical reversal tái tạo đúng baseline. Customer API/search/nearest tie-break/polyline/confirmation/PUT/modal/GPS/JSX/CSS giữ nguyên.
- Route chỉ opt-in exact flag trên default list. **Cache `nodes:list` vẫn chứa full legacy payload**, cùng key/TTL60giây/generation capture trước await và setter fence; project tại hai response hit/miss, không cache DTO rút gọn. Coordinate-first→legacy-hit và legacy-first→coordinate-hit đều có test cache/core thật.
- Default `/api/nodes`, fallback unknown/empty/case khác, downloadTemplate và các `view` giữ semantics/quyền/scope/paging/headers cũ. Bản đồ node thường vẫn lấy đầy đủ metadata cho popup/filter/CSV. Không đổi SQL/readiness hoặc thêm cache/per-marker request.

### TDD và QA candidate

- 33unit+12UI mới. Semantic RED11fail/34pass→GREEN45/45; failures là response shape/URL cũ, không phải thiếu helper. Real route/cache/mapper, XLSX serialization và Leaflet distance; auth/Prisma/readiness/render/browser boundaries được mock.
- Cover cache hai chiều/full identity/purity/future fields/zero/null/order/TTL, generation invalidation khi auth/query pending, role/auth-before-cache/DB/errors, template và scoped views; UI cover nearest thật/tie hai thứ tự, cancel/Escape/PUT đúng payload, GPS, list/search/create/edit/retry. Assignment dùng event `assignNode` sẵn có, không thêm nút hoặc sửa guard zero-customer tọa độ.
- 21file UI cũ và tất cả assertions/test cũ giữ nguyên, Node0TB không đổi ngoài original types prefix được giữ nguyên. Worker helper validation lần đầu thiếu `tests/setup/ui.ts` tạo13matcher type diagnostics; giữ log, sửa riêng compiler harness, không thay app/assertions.
- Parent candidate đạt **32file/470scoped test+22policy**, full TypeScript/build, login static; lint0error/2warning cũ ở upload Node0TB/node. Frozen6source/fake DB giữ hash. Không cộng counts chồng nhau hoặc coi scoped selection là full-suite.
- Spec review Parfit và quality review Hegel độc lập đều APPROVE đúng sáu frozen hashes, không sửa source. Chỉ source/API/local-functional, không coi reviewer approval là native/visual/release acceptance.

### Đo lượng tải / browser

- Browser trước/sau **12case** ba role×390/1440px×app light/dark, cùng14node giả và customer scope ADMIN10/MANAGER10/CTV5. Actual node API JSON **3.312→1.268byte**, giảm2.044byte/**61,71%**; legacy-full node/customer/scoped-view hashes khớp, DTO exact retained values/order. Một initial node/một customer request, không thêm waterfall/per-marker call.
- Nearest confirmation giữ tên/khoảng cách0m fixture, polyline và **48UI summaries** text/button/disabled/link/overflow khớp. GPS-denied/customer500/retry đúng,0business write/JS error/unexpected network failure, fake DB/hash không đổi. Không phải full DOM/pixel identity hoặc browser production-write acceptance.
- Size-only benchmark chính frozen mapper trên cùng input1k/10k/50k: metadata tối thiểu giảm58,58/58,29/58,03%; metadata thông thường giảm66,45/66,18/65,94%. Retained values/order/zero và input không mutate; không DB query/browser render/latency hoặc compressed-transfer claim.
- Provider tiles tổng hợp, SW tắt, GPS denial và customer500 inject riêng. UI summaries không phải full DOM, ảnh chỉ chẩn đoán; không tạo gate pixel PASS hoặc miễn strict visual Node0TB trước.
- Baseline harnessv1 bắt nhầm tile image ERR_ABORTED khi zoom/reload; giữ log/partial/source v1. Classifier chỉ miễn exact URL của ảnh provider đã được runner intercept, resource image/nonnavigation/ERR_ABORTED, cộng rule RSC cũ. API/script/navigation/lỗi bất ngờ vẫn fail; không thay app/tests cũ.

### Tích hợp và phần còn lại

- Đã tích hợp đúng **10file** (6source/test+4docs) sau preimage/hash/backup, whitespace và default secret scan không finding, giữ75 thay đổi trước ngoài các file được nối tiếp có chủ đích. Không reset/commit/branch/publish hoặc thay application source sau QA.
- Primary đạt **32file/470scoped test+22policy**, full TypeScript/lint(0error/2warning cũ); frozen6source và fake DB/hash giữ nguyên. **329source/config/test** đối chiếu byte với WT candidate đã build; không dùng WT PASS thay primary QA.
- Chỉ checkpoint functional local: customerMapNodeProjectionFunctionalSliceVerified=true, fullDomOrPixelEquivalenceClaimed=false, previousStrictVisualGateStillOpen=true, allTask9Complete=false. Không đóng native/full-suite/release gate, không claim SQL/latency cải thiện.
- Chỉ node bootstrap của customer map: customer payload/full node-map/detail-loading, SQL/lookup, bbox/clustering và toàn Task9 còn pending. Không tuyên bố thời gian toàn web nhanh hơn theo tỷ lệ payload.
- Native Windows/libsql gate vẫn mở từ primary801/815 rồi worker exit3221225477; không chạy lại full native/skip/retry/pool/upgrade để ép xanh. Strictvisual Node0TB3PNG/2errorgeometry chưa rõ nguyên nhân vẫn mở nguyên trạng.
- JWT/revocation/version/đa instance/single-flight, nguyên nhân `/api/me`500 cũ và QA Production/điện thoại/provider/PWA thật chưa xác minh. Chưa đủ điều kiện release hoặc đánh dấu toàn Task9 hoàn tất.
- Chưa commit/push/deploy; release đã xác minh gần nhất vẫn `9d0365e`.

Chi tiết `docs/customer-map-node-projection.md`; plan `docs/superpowers/plans/2026-10-29-customer-map-node-projection-local.md`. Evidence private `.local/performance/customer-map-node-projection-20261028/` và worker-r2 stage lưu source/log RED-GREEN và failure helper ban đầu; không commit SQLite/env/log/cookie/credentials hoặc business rows.

## 34. Customer → node bulk read batching — local 29/10/2026

**Tóm tắt:** Mỗi lượt đọc mapping lấy tối đa900account thay300. Trong phép đo helper với10.000account giả, cần12lượt SELECT thay34, giữ cùng kết quả. Không đổi code giao diện hay nghiệp vụ gán node; chưa đo mức cải thiện tốc độ web online.

### Phạm vi

- Tiếp tục Task9 local, snapshot417file/329source khớp candidate đã build, giữ81thay đổi trước. Không reset/branch/commit/push/deploy, đọc database/env thật, migration hoặc đổi dependencies.
- Chọn giảm round-trips của bulk lookup trước khi thêm index tiền tố Node0TB. Chỉ literal300→900 trong `getMappedNodeNamesByAccounts`; SQL parameterized/normalize/dedupe/readiness/sequential/result handling giữ nguyên. Các read/write batch khác và toàn bộ frontend/API/auth/cache giữ bytes. Node0TB matching không thay đổi.
- Ba consumer thực tế: map-data, customer list và import đều dùng keyed .get; search-map không gọi helper. SQL không có ORDER BY nên Map iteration order không được hứa; phải giữ key/value và customer DTO/order/meta. List cap100 vẫn một mapping SELECT, không claim mọi trang tăng tốc.
- SQLite historical default999/newer32766 theo tài liệu chính thức, nhưng custom/runtime limits có thể thấp hơn. Local900parameter probe đạt trên bản sao SQLite giả, Prisma900binding/online runtime acceptance phải phân biệt.

### TDD / QA

- Plan review Kant APPROVE local-only, không sửa source và không miễn runtime gate. Worker mới chỉ có quyền sửa đúng2source/test; test cũ, Node0TB/coordinate projections giữ nguyên.
- 48test mới (20helper+28route/cache), semantic RED12fail/36pass→GREEN48/48; worker33file/518scoped (470cũ+48mới), owned lint/types đạt. Parent QA/build/spec/quality riêng, không coi worker report là nghiệm thu.
- Parent WT đạt **33file/518scoped+22policy**, full TypeScript/build, login static/lint0error/2warning cũ ở uploadNode0TB/node; fakeDB/frozenhashes không đổi. Owned lint0warning không thay thế full-source lint. Spec Archimedes rồi quality Hume độc lập đều APPROVE đúng2hashes, source/API local-functional only, không sửa source hoặc miễn native/visual/release gate.
- Freeze2hashes: service chỉ thay đúng1byte, reversal khôi phục toàn preimage;69test cũ/22UI files và mọi source khác giữ nguyên. Initial runner EPERM do sandbox được lưu riêng, không tính RED hoặc sửa application/config để ép xanh.

### Baseline / đo trước-sau

- Benchmark helper/normalization thật, mocked DB boundary,13boundarysizes:1k/10k/50k unique keys **4→2 /34→12 /167→56 mapping SELECT**. Key/value hashes bằng nhau, tối đa900params, mỗi normalized key đọc đúng một lần/input không mutate.10k giảm64,71%SELECT trong riêng helper, không phải tổng SQL/API hoặc cloud latency.
- Private SQLite copy có1812customers/1544mappings; thêm1802khách giả thiếu tọa độ, vẫn10coordinate customers để không tăng marker UI. Account trim/case/quotes và mapped/fallback được seed riêng. Original fake DB/hash giữ nguyên, không dùng dữ liệu thật.
- **21scopedAPIcase** qua3role có first/warm replay, status/body/bytes/count hashes trước-sau khớp. Details on/off, coordinate filter, take900/901/1800/20000/customer list và anonymous401 giữ đúng. Large map details-on hasCoordinates=false ADMIN1812/MANAGER1812/CTV906rows (>900distinct accounts); helper900 đã build thực thi thành công trên actual local Prisma/SQLite, không chỉ standalone/mock proof. Không chứng nhận remote/custom lower limits hoặc native reliability.
- **12browsercase** ba role×390/1440×light/dark,48UI summaries/nearest confirmation/polyline và node/customer/scoped-view hashes khớp. GPS/error/retry đúng,0business writes/JS/unexpectednetworkerrors, fakeDB/hash unchanged. Không phải full DOM/pixel identity hoặc production-write acceptance.
- Provider images giả/SW off/GPS/error inject; UI summaries không phải full DOM/pixel equivalence. Strictvisual Node0TB3PNG/2geometry giữ mở.

### Tích hợp / phần còn lại

- Đã tích hợp đúng **6file** (2source/test+4docs) sau preimage/hash/backup, whitespace/default secret scan không finding, giữ81thay đổi trước ngoài các file được nối tiếp có chủ đích. Không reset/commit/branch/publish hoặc authored application edits sau QA.
- Primary đạt **33file/518scoped test+22policy**, full TypeScript/lint0error/2warning cũ. Frozen2source và fakeDB/hash giữ nguyên; **330source/config/test** đối chiếu byte với WT candidate đã build. Không suy ra primary PASS từ worker/WT hoặc gọi scoped selection là full suite.
- customerMappingBatchesFunctionalSliceVerified=true, mappingValuesAndScopedBodiesPreserved=true, realLocalApiWithOver900AccountsPassed=true; benchmark DB boundary mocked/totalApiQueryCountMeasured=false/databaseOrCloudLatencyMeasured=false. fullDomOrPixelEquivalenceClaimed=false, allTask9Complete=false; không đóng native/visual/release gate.
- Native Windows full-suite801/815 rồi worker3221225477 vẫn chưa sửa; không chạy lại full native/skip/retry/pool/upgrade để ép xanh,2warning lint cũ giữ nguyên.
- Không xử lý concurrent-read snapshot, import customer.findMany riêng, JWT/revocation/version/đa instance/single-flight, `/api/me`500 cũ hoặc remote DB limits. Không giảm DTO/payload, thêm viewport/clustering hay sửa prefix matching trong slice này.
- Task9/native/visual/release còn mở. Chưa commit/push/deploy; release đã xác minh gần nhất vẫn9d0365e.

Chi tiết `docs/customer-node-mapping-batches.md`; plan `docs/superpowers/plans/2026-10-29-customer-node-mapping-batches-local.md`. Evidence private `.local/performance/customer-mapping-batches-20261029/` và staging worker chứa snapshot/preimage/RED-GREEN/logs/API/browser/benchmark/manifest; không commit SQLite/env/log/cookie/credentials/business bodies.

## 35. Node0TB — tránh quét prefix lặp trong một request — local 29/10/2026

**Tóm tắt:** Mỗi lần tải Node0TB tái sử dụng kết quả cho mã gốc lặp, tối đa 1.000 kết quả trong request đó. Trên bộ thử 50.000 dòng có 100 mã gốc, số lần quét danh sách node giảm từ 50.000 xuống 100; tọa độ, thống kê và bộ lọc giữ nguyên. Chỉ là checkpoint functional local, chưa nghiệm thu tốc độ cho mọi workload hoặc web online.

### Phạm vi và baseline

- Tiếp tục lookup Task9, không thay UI/quy tắc chọn tọa độ. Snapshot420file/330source khớp buildLv9R4uBtzz459gsJFzkZT, giữ85thay đổi trước; dùng lại WT, không reset/branch/commit/push/deploy, DB/env thật, migration hoặc dependency changes.
- Đã đo service/import-utils thật, Prisma/readiness boundaries giả. Grouped138/1k/10k/50krows quét prefix138/1000/10000/50000lần;50k duyệt49.387.500cặp,3-sample uninstrumented median647,665ms. Exact-only0scans; distinct-miss một scan/dòng. Đây là synthetic workload, không phải phân bố dữ liệu thật hoặc độ trễ web/database/cloud.
- Chọn memo local trong mỗi getNode0TbList: keybaseCode cũ, .has để cache cảundefined, tối đa1.000entry hits/misses, không eviction. Exact full-code rồi exact-base vẫn kiểm trước memo ở mọi dòng. Cap đầy thì key mới tiếp tục scan như cũ; không trie hoặc cache giữa request/role.
- Same SQL/readiness/two reads/normalization/first-prefix insertion order/DTO/row order/date fallback/stats toàn tập trước filter/search description/category. Không sửa matching ambiguity hoặc tọa độ validation. Memo entry cap không phải byte budget; worst-case unique-prefix scan vẫn còn.
- Plan review Mill APPROVE narrow local design; chỉnh rõ exact-base hit không thể có warmed fallback cùng base trên nodeMap bất biến. Test exact-code-after-cache và exact-base precedence riêng, không fake dữ liệu mutable để tạo tình huống bất khả thi.

### TDD / QA

- Chỉ2paths: node-0tb-db service và unit prefix-memo mới;39test semantic RED33fail/6pass→GREEN39/39, giữ70test cũ/22UI và source ngoài phạm vi. Runner preflight EPERM giữ riêng, không tính là semanticRED. Tiếp tục từ checkpoint sau gián đoạn bằng source/hash/log thực, không suy ra completion từ worker final chưa có.
- Parent freeze2hashes: đảo declaration/prefix branch tái tạo toàn service byte, exact/base/SQL/readiness/DTO/stats/filter/normalization và source ngoài phạm vi giữ nguyên. Fresh WT34file/557scoped+22policy/types/lint0error/2warning cũ/build, login static, fakeDB/hash unchanged. Spec Epicurus APPROVE source/API only, không phải performance/native/visual/release approval.
- Quality Lorentz **APPROVE_LOCAL_FUNCTIONAL_ONLY**, giữ uniqueTimingUncertainty OPEN/performance acceptance pending; không sửa source hoặc miễn native/strictvisual/release. Capture reviewer Bernoulli APPROVE symmetricsettledprotocol/evidence preservation, không thay kết quả runtime.
- Không chạy lại full native suite đã biết801/815 rồi worker3221225477; không skip/retry/pool/package workaround.2lint warnings cũ và strictvisual Node0TB3PNG/2geometry giữ mở.

### API/browser và phép đo sau

- Bản sao SQLite giả mới20Node0Tb/14tọa độ/6thiếu; thêm4SPsiblings (2positive/2negative) để có memo hit/miss thực, không đọc/seed dữ liệu thật, giữhashfakeDB cũ.
- Đối chiếu 24 trường hợp API qua ba vai trò: legacy, projection bản đồ, tìm kiếm, phân loại, giá trị projection không hỗ trợ và đọc lặp đều giữ nguyên status/body/bytes/count hashes. 12 lượt trình duyệt, mỗi lượt sáu trạng thái, tạo 72 bản tóm tắt UI khớp đầy đủ sau khi animation ổn định. Không ghi dữ liệu nghiệp vụ; hash database giả giữ nguyên.
- Provider images giả/SW off/GPS/error inject, screenshots chẩn đoán thôi; summaries không phải fullDOM/pixel equivalence. Không chuyển các fail strictvisual trước thành PASS hoặc miễn image gate.
- **UIcapturev1 FAILED**,24APIbodies/payload hashes khớp,67/72summaries khớp,5desktopGPSstates thiếu4tooltiptext. Giữexit1/runner/assertions/error/partial/ảnh/buildmetadata ởcapture-v1, không tạo PASS từpartial. Same-build control2fast+2settled: fast350ms nhãn còn hiện nhưng800/1600ms mất, settled1600ms sau popup/zoom/fit thì ổn định; CSSzoomflagfalse, không suy đoán lệnh bịignore. Snapshot350 chưa quiescent, nguồn hiện cóflyTo1,2s/0,9s+timer50ms.
- Harnessv2 giữmọiassertion/cases/summaryfield, thêmwait1600ms+transform/tooltip stable200ms+CSSquiet/timeout5s và tách các thao táczoom/fit. Rebuild baseline từpreimage service thật/capture đầyđủ; sau đórestoreexactcandidate2hashes, QA557+22policy/types/lint/build lại, không authoredappcode saureview. **Controlled v2 PASS:**24APIcase/12browsercase/72fullsummaries khớp,0business writes/JS/unexpectednetworkerrors, cùng1initialrequest và500→retry200. Frontendkhôngsửa, nofullDOM/pixelclaim, oldstrictvisualTask32khôngđượcđóng.
- Benchmark actual-service/import-utils trước/sau12datasets full-response hashes khớp, input giữ nguyên/cùng2reads+1readiness. Grouped138/1k/10k/50k scans **138→20 /1.000→100 /10.000→100 /50.000→100**,50k visits49.387.500→98.775. Exact0scan/unique-miss1scan mỗirow giữ nguyên; SQL/payload không giảm.
- **Timing uncertainty giữ mở:** matrix đầu grouped50k647,665→17,925ms nhưng unique50k614,184→1.526,097ms (3mẫu/process riêng). Không bỏ số liệu, không sửa app hoặc retry matrix để ép xanh. One controlled diagnostic: cùng process hai frozen source, alternating order,2warmups+5mẫu/version, khôngprototype instrumentation/GC flags/forcedGC; unique417,133→423,051ms, grouped426,992→13,035ms, output/hash/read-counts khớp. Không tái hiện mức chậm2,5× trong control, **chưa xác minh nguyên nhân matrix đầu/không chứng minh unique không regression**; không quy kết flake/GC/JIT hoặc nghiệm thu performance/cloud/page latency/p95/RUM. Quality disposition cho LOCAL functional checkpoint còn chờ.

### Tích hợp / phần còn lại

- Đã tích hợp đúng **6 file** (2 source/test, 4 tài liệu) sau preimage/hash/backup, whitespace và secret scan mặc định không finding. Giữ 85 thay đổi local trước ngoài các file được nối tiếp có chủ đích; không reset/branch/commit/push/deploy. First scan bắt nhầm prose test-summary dính chữ, không phải credential; giữ report/log redacted riêng và viết lại câu rõ nghĩa, không thêm allowlist/sửa rule. Scan mặc định lại đạt trước integration.
- Primary đạt **34 file/557 test scoped + 22 policy checks**, TypeScript/lint 0 error và 2 warning cũ. Fake database và hai source hashes giữ nguyên; **331 file source/config/test** đối chiếu byte với WT candidate đã build. Không dùng WT/worker PASS thay primary QA, không gọi scoped selection là full suite.
- node0TbPrefixMemoFunctionalSliceVerified=true, controlledMotionFunctionalGatePassed=true; originalV1UiSummaryGateFailed=true và failure evidence vẫn giữ nguyên. uniqueTimingUncertaintyRemainsOpen=true, performanceAcceptancePassed=false, fullDomOrPixelEquivalenceClaimed=false, allTask9Complete=false. Không đóng native/old strictvisual/release gate hoặc gọi timing anomaly là vô hại.
- Không giảm SQL/payload hoặc đóng snapshot/read-consistency/JWT/revocation/đa instance/single-flight/`/api/me`500 cũ. Customer/detail DTO, node-map thường, unique-prefix index và viewport/clustering còn pending.
- Task9/native/strictvisual/release vẫn mở; không claim mọi request nhanh hơn. Chưa commit/push/deploy, release đã xác minh gần nhất9d0365e.

Chi tiết `docs/node0tb-prefix-memo.md`; plan `docs/superpowers/plans/2026-10-29-node0tb-prefix-memo-local.md`. Evidence private `.local/performance/node0tb-prefix-memo-20261029/` và staging worker lưu snapshot/preimage/RED-GREEN/reviews/benchmark/API/browser/QA/build/manifest; không commit SQLite/env/log/cookie/credentials/business bodies.

## 36. Điều tra timing Node0TB, không sửa app (29/10/2026, local)

### Đã làm

- Tiếp unique50k uncertainty mục35. Chốt trước endpoint, factorial contrasts và thứ tự tám process: hai source trước/sau memo × hai history U/G × hai repetitions. U không gán prototype; G dùng counting generator ở call thứ năm rồi restore. Không có observer trực tiếp trong timer nhưng workload sau có execution history khác.
- Dùng service/import-utils thật và Prisma/readiness boundary giả, cùng12datasets/process; một warmup + ba timed + một untimed/call validation cho mỗi dataset. Tám process chạy tuần tự exit0 đúng một lần:480 service calls,96 process/dataset observations, không retry/cherry-pick/optional ablation/trace/forced GC. Toàn bộ input/full-response hashes/query/read/counter invariants khớp; lưu mọi samples.
- Review trước chạy đã sửa rõ endpoint/đơn vị fresh process, bỏ optional branch, giữ raw evidence khi caught error. Snapshot423 paths,331 source/config/test,89 dirty paths và161 artifacts cũ trước thử; không đọc `.env`, credential hoặc database thật.

### Kết quả và điều chưa được chứng minh

- Unique50k repetition1: B_U407,499 → A_U382,930ms; B_G630,280 → A_G643,071ms. Repetition2: B_U366,641 → A_U375,106ms; B_G629,041 → A_G622,430ms. Median ba mẫu riêng mỗi process, không pool thành sáu independent samples.
- History G/U cao hơn ở cả hai source/repetition: trước1,547/1,716; sau1,679/1,659. Có evidence timing nhạy với observer-history package trong protocol mới, **không xác định riêng JIT/GC/property invalidation**.
- Source ratios U0,940/1,023 và G1,020/0,989; interaction1,086/0,967 đổi hướng. Không tái hiện/giải thích gap2,5× ban đầu, không quy kết flake/vô hại hoặc zero regression. Giữ matrix cũ614,184→1.526,097ms và paired417,133→423,051ms nguyên vẹn.
- Báo đủ12workloads, kể cả secondary unique138 sau cao hơn cả bốn so sánh và exact50k U sau cao hơn cả hai repetitions. Grouped giảm quét nhưng không suy mọi request nhanh hơn. Unique50k vẫn50triệu pairs, hai reads/call giữ nguyên, không SQL/payload/cloud/page-load/p95/RUM measurement.

### Tích hợp và giới hạn

- Chỉ5 tài liệu: guide mới `docs/node0tb-timing-investigation.md`, plan diagnostic mới, annotation guide memo, roadmap và mục36 này. Có backup/preimage/hash/whitespace/default secret scan và review riêng trước tích hợp; không đổi app/test/config/dependency.89 dirty paths có sẵn/331source files và161artifacts cũ được giữ; không reset/branch/commit/push/deploy.
- Không rerun app tests/native/build/browser cho docs-only checkpoint.557scoped/22policy/build/browser ở mục35 là kết quả cũ, không gọi là fresh PASS. Candidate build `uHuPDrGeI3CACKtH0ZyOi` giữ nguyên; full-native801/815 rồi exit3221225477 và strictvisual3PNG/2geometry vẫn OPEN.
- uniqueTimingUncertaintyRemainsOpen=true, performanceAcceptancePassed=false, allTask9Complete=false. Functional memo chỉ LOCAL theo mục35. Chưa hoàn tất exact/unique overhead, marker/detail DTO, node-map thường, viewport/clustering; không đóng auth/revocation/snapshot/`/api/me`500 cũ hoặc release.
- Thí nghiệm dừng đúng tám cell đã chốt. Không sửa production bằng phỏng đoán; thiết kế riêng cho workload đại diện/overhead và tách observer khỏi lifetime timed process trước performance acceptance. Release xác minh gần nhất9d0365e, chưa publish các thay đổi local này.

Chi tiết `docs/node0tb-timing-investigation.md`; plan `docs/superpowers/plans/2026-10-29-node0tb-timing-investigation-local.md`. Evidence private `.local/performance/node0tb-timing-rca-20261029/` lưu snapshot, preregistered hashes, raw cells/logs, matrix/analysis, reviews và integration manifest. Mọi artifacts cũ giữ nguyên; không commit logs/env/SQLite/cookie/token/business bodies.

## 37. Bản đồ khách hàng: ID marker, popup sau flight và group lifetime (29/10/2026, local)

### Phạm vi / đã sửa

- Owner dừng push/deploy để tiếp tục plan local. Chưa tạo nhánh release/commit/push, deploy Preview/Production hoặc database Turso test. Bước chuẩn bị trước chỉ đọc metadata Vercel, không in/lưu giá trị token hay đổi settings/database.
- Audit consumer:14customer fields và10node-map fields hiện trả về đều có nơi sử dụng. Chưa cắt DTO cơ học làm mất search/popup/form; lazy-detail/viewport cần thiết kế riêng.
- Cluster popup dùng raw customer ID/public `sourceTarget` qua index current-filtered-array thay vì tìm khách đầu tiên bằng coordinate epsilon. Ba ID actions tái sử dụng index; không thêm API/detail request hoặc listener theo từng marker.
- Chrome phát hiện identity-only popup đúng ID nhưng mất khi flyTo tiếp tục. Reveal/open nay chỉ sau public moveend của đúng position object; stop motion cũ trước khi đăng ký once, giữ zoom17/duration1,2giây và delay/retry bounds cũ. Request cũ bị vô hiệu khi chọn khác/GPS/unmount; stale cluster callback không được mở popup.
- Quality review P2: đổi filter giữa flight có thể để ref thuộc group đã tháo. Cleanup chỉ xóa refs còn thuộc đúng group; callback phải khớp entry hiện tại. Không gọi/mở marker cũ, không xóa refs của group mới. API/SQL/auth/fields/CSS/HTML/confirmation/write payload không đổi.

### Kiểm chứng và failures giữ riêng

- Identity RED6fail/13pass →GREEN19; motion RED6fail/19pass →GREEN25; lifetime RED2fail/25pass →GREEN27. Original12case bodies/assertions giữ nguyên, thêm15case, gồm real nested Leaflet FeatureGroup protocol. Missing import, hai lỗi type mock và distinct-group setup timeout được giữ là failed attempts, không giả thành semantic RED.
- Final WT **10file/256test map-domain +22policy, full types/lint0error/2warning cũ/build đạt**, fake DB/current hashes giữ nguyên. Build `GSevXO8cImpsugMzfsFK1`; final pair `066ab426ec007acb55879f5d498e926d47c94c122ece93afa1fa184e674aa1b3` / `b06d0589c6842c7c7ba254040043250d925dbcc17a1806ff6abdd2ba457b298a`. Spec và quality APPROVE đúng pair/local-functional-only; không dùng reviews b1/c2 hoặc52ec/d8 thay final.
- Broad selection không được ghi là đạt ổn định: v1 564/564 rồi type fixture fail; v2 561/564, isolated74/76, baseline original331source76/76, broad motion569/570 với prepaid5s timeout. Giữ mọi logs/exit/status, chưa xác định nguyên nhân reliability; không tăng timeout, đổi pool/skip hoặc sửa KPI để ép xanh. Selection256theo domain không thay thế broad/full suite.
- Browser V1 fail popup persistence, V2 fail optional spider-leg CSS-class count. Cùng-build probe giữ class assertion fail nhưng ghi ba SVG legs +A/B tách60px và popup đúng. Installed plugin kiểm `L.Path.SVG` không có trong installed Leaflet nên class không đại diện cho mọi legs; không sửa app/CSS cho selector.
- V3 protocol kiểm đúng3native-leg DOM paths dương stroke/opacity/width và visible/distinct A/B boxes, giữ nguyên mọi assertion/flow còn lại của sáu case. **6/6 Chrome:3role×390/1440**, đúng ID trùng/gần điểm và popup còn mở,1customer+1node read/case,0write/JSerror/overflow, fake DB unchanged. Login thật trên DB giả; marker API/provider images giả, SW tắt. Không API-scope equivalence, full DOM/pixel/dark/leg-endpoint/occlusion/provider/điện thoại thật claim. V1/V2/probe failures không bị đổi thành PASS.

### Tích hợp và phần còn mở

- Tích hợp đúng **6file**: MapComponent +test hiện có, guide/plan mới, roadmap và mục37. Source-pair phase có backup/hash/whitespace/default secret scan riêng; primary chạy lại **256map-domain+22policy/types/lint** độc lập trước docs guard. Final integration manifest kiểm331source/config/test so built WT, giữ91dirty paths trước và209artifacts cũ; không reset/branch/commit/push/deploy.
- customerMarkerIdentityFunctionalSliceVerified=true, popupFlightAndGroupLifetimeVerified=true, browserPhysicalV3SixCasesPassed=true; originalBrowserV1Failed=true và originalV2ClassGateFailed=true được giữ. broaderTestReliabilityRemainsOpen=true, fullDomOrPixelEquivalenceClaimed=false, performanceAcceptancePassed=false, allTask9Complete=false.
- Chưa đo giảm payload/SQL, actual page-load/p95 hoặc mọi rapid/manual navigation. Native Windows full-suite crash801/815 rồi3221225477, strictvisual cũ3PNG/2geometry, Node0TB timing anomaly, auth/revocation/distributed-state và release vẫn OPEN. Không kết luận mọi request nhanh hơn hoặc mọi phần plan hoàn tất.
- Việc tiếp theo: chẩn đoán riêng độ ổn định test preload/import của KPI trước release; customer lazy detail/DTO, node lookup/viewport và các domain khác tiếp tục theo roadmap, không tự đổi giao diện/nghiệp vụ.

Chi tiết `docs/customer-marker-identity.md`; plan `docs/superpowers/plans/2026-10-29-customer-marker-identity-local.md`. Evidence private `.local/performance/customer-marker-identity-20261029/` lưu snapshot/preimage, versioned source hashes, failed/RED/GREEN/QA/build/browser/probe/reviews, backups/scans và manifests source/final integration. Không commit env/database/log/cookie/token/business bodies; release xác minh gần nhất vẫn9d0365e.

## 38. KPI test: cách ly observation, chưa kết luận nguyên nhân timeout (29/10/2026, local)

### Phạm vi và bằng chứng

- Tiếp tục theo yêu cầu owner, vẫn dừng publish. Snapshot 427 union paths, 331 source/config/test paths, 93 dirty paths và 348 artifact cũ. Không đọc env/database thật, không full-native suite, branch/commit/push/deploy hoặc dependency/config/pool/deadline change.
- Original hai file KPI 76/76 đạt. Trace hai file 76/76 nhưng reporter không xuất phase của test đạt; giữ lần chạy này và không suy luận từ trace không có. Một broader trace đăng ký trước: 571/572 đạt, GET-users schema-auth timeout 5 giây, hai file KPI đạt. Thu 207 events, không quan sát cross-epoch loader/factory; shell import đầu khoảng 1.204 ms. File trace được restore chính xác trước khi sửa fixture.
- Do đó **chưa xác minh nguyên nhân timeout KPI cũ**; không gọi lỗi fixture sau đây là nguyên nhân đã chứng minh. Independent audit current-user không tìm được lỗi xác định để sửa, giữ file đó nguyên trạng.
- Chứng minh riêng hợp đồng observation ownership: registered panel factory có thể đọc `evaluated/moduleGates/mounted` đã trỏ sang lần test kế tiếp; effect cleanup cũng có thể xóa entry của lần mới. Hai controlled regression gọi đúng factory được đăng ký với `vi.doMock`, chủ động đổi owner thay vì chờ timeout ngẫu nhiên.

### Thay đổi và kiểm tra

- Chỉ sửa `tests/ui/prepaid-view-loading.test.tsx`: capture array/map/set tại registration, truyền đúng set vào component mount/cleanup. Giữ nguyên 20 testcase cũ, real Next dynamic, thời gian chờ/assertions và default 5 giây. Không drain/cancel mọi async task hoặc thay pending-report/fetch semantics; không sửa production code.
- Ownership RED đúng 2 semantic failure/20 testcase cũ đạt; GREEN hai file 78/78. Freeze test SHA-256 `88d2855b09f60a0dcedf9e7b94f16139494cf089f24959495d68b36bce30fab3`; so sánh xác nhận phần thân 20 testcase cũ không đổi sau chuẩn hóa CRLF/LF.
- Worktree chạy đúng một post-fix broader cell đã chốt: **34 file/574 test +22 policy đạt**, full TypeScript nonincremental đạt, lint 0 error/**3 warning**. Hai unused upload warnings và một MapComponent ref-cleanup warning đều nằm trong source snapshot có sẵn; không sửa app ngoài phạm vi hoặc tiếp tục ghi chỉ 2 warning.
- Primary chạy riêng đúng cell thứ hai đã chốt: **34 file/574 test +22 policy đạt**, TypeScript nonincremental đạt, lint 0 error/3 warning như worktree. Không cộng hai lượt thành số testcase khác nhau hoặc gọi đây là full suite/stability acceptance; không thêm retries.
- Spec rồi quality review APPROVE đúng frozen test hash. Guarded test integration có backup/whitespace/default secret scan đạt trước primary QA. Tổng phạm vi 5 file: 1 test và 4 tài liệu; manifest docs kiểm tra lại 427 snapshot paths, inventories từng root, 93 thay đổi cũ và 348 artifact cũ. Không đổi source app/current-user test, HEAD/branch/index hoặc build cũ. Báo cáo cuối `integrated-files.json` và `test-integrated.json` giữ hashes, scan và preservation evidence; không commit/push/deploy.

### Giới hạn giữ mở

- Đây là hardening một lỗi fixture có thể tái hiện, **không phải chứng nhận hết timeout, hết lỗi app hoặc tăng tốc web**. Broader trace failure trước sửa được giữ nguyên; không retry đến khi xanh, tăng timeout, đổi pool/isolation hoặc bỏ assertion để đóng gate.
- Không rebuild/browser benchmark cho test-only. Build `GSevXO8cImpsugMzfsFK1` thuộc mục 37, không phải fresh build ở đây. Không claim page-load/p95/RUM hoặc Production acceptance.
- Full-native Windows crash, strictvisual bản đồ cũ, Node0TB timing uncertainty, auth/revocation/distributed state, các phần còn lại Task 8/9/13 và release vẫn mở. Mục 38 là checkpoint, không phải thêm một plan hoàn tất hay thay đổi số nhóm backlog.

Chi tiết `docs/kpi-test-isolation.md`; plan `docs/superpowers/plans/2026-10-29-kpi-test-isolation-local.md`. Evidence private `.local/performance/kpi-test-isolation-20261029/` lưu snapshot, preimage, original/trace/restoration, RED/GREEN, frozen hash, reviews/QA/scans/backups và manifests. Không đưa env/DB/log/cookie/credentials vào Git; chưa commit/push/deploy.

## 39. Node gần nhất: gộp read đồng thời và chặn cache cũ (29/10/2026, local)

### Phạm vi và thay đổi

- Tiếp lát cắt Task 7/9 sau mục 38. Helper `findNearestNodeName` là fallback khi thêm/cập nhật khách hàng hoặc resolve node từ tọa độ; không phải mọi lượt mở bản đồ đều đi qua helper này. Không sửa giao diện, routes/auth, upload/backup, shared KPI cache, dependency hoặc config.
- Snapshot 429 union paths/331 source-config-test paths, 95 thay đổi local và hash 397 artifact cũ trước khi sửa. Không env/database thật, full-native suite, tạo nhánh/commit/push/deploy; giữ source ở primary và worktree theo preimage.
- Tái hiện hai lỗi: cold/expired callers tự đọc lặp tọa độ; read cũ đang chờ có thể republish sau invalidation hoặc ghi đè snapshot mới. Thêm pending promise dùng chung read trong cùng generation/process, capture generation trước await và chỉ publish khi còn đúng token. Invalidation đổi token/detach pending; finally chỉ xóa promise đúng identity.
- Giữ ba field Prisma select, Haversine/tie/row-order, null filter/tọa độ 0, cache mảng rỗng và TTL 5 phút từ successful completion. Mỗi caller vẫn tính nearest riêng; không cache một tên node dùng chung. Old caller có thể nhận snapshot cũ, nhưng không làm bẩn cache mới; không cancel, linearizability hoặc distributed guarantee.

### Kiểm chứng

- Test mới chạy helper thật với Prisma boundary giả, deferred promises và Date điều khiển; không sleep hay tăng deadline. **RED 10 semantic fail/8 pass → GREEN 18/18**, bao gồm concurrent miss/expiry, empty/null/zero/tie, TTL boundary/completion, shared errors/retry/sync throw và invalidation/old success-failure finalizers qua nhiều generation.
- Burst giả 1/10/100 callers: **1/10/100 → 1/1/1 lượt `findMany`**, cùng kết quả nearest cho từng tọa độ. Đây là số lần gọi boundary, không phải SQL toàn API, throughput hoặc latency web/database thật.
- Freeze source `99d1f356f138103e4175082edcf7c676fb6fd8f31c1cf8cd77bc8ad6cbb42c3a`, test `2b2abd2aba8088e60b40cbe49db0237feb1482596dc438b7cca883c5cc6d3d92`. Worktree đạt **35 file/592 test +22 policy**, TypeScript nonincremental đạt, ESLint 0 error/3 warning có sẵn.
- Primary chạy độc lập đúng một lượt đã chốt: **35 file/592 test +22 policy đạt**, TypeScript nonincremental đạt, ESLint 0 error/3 warning có sẵn. Không dùng worktree PASS thay primary, không cộng hai lượt thành testcase khác nhau hoặc gọi scoped selection là full suite. Không chạy thêm retry để ép xanh.
- Review APPROVE đúng frozen source/test pair; parent đối chiếu hash và QA thật trước tích hợp. Source integration có backup/preimage, whitespace/default secret scan không finding. Tổng phạm vi 6 file: 1 helper, 1 test mới và 4 tài liệu; docs manifest kiểm lại 429 snapshot paths, inventories, 95 thay đổi local trước và 397 artifact cũ. Không sửa file app/test có sẵn khác, HEAD/branch/index hoặc publish. Evidence có `source-integrated.json`, `integrated-files.json`, `final-check.json`.

### Giới hạn giữ mở

- Chỉ dedupe trong một module/process; chưa giảm Haversine mỗi caller, mọi query của create/update/import hoặc dùng shared cache nhiều Vercel instance. Không sửa các mutation chưa gọi invalidator hoặc write đang chạy từ snapshot cũ.
- Pending read chưa settle có thể giữ waiter cùng thế hệ; không thêm timeout/fallback, dùng behavior database hiện có. Failure không được cache; invalidation cho thế hệ mới đọc riêng.
- Không rebuild/browser benchmark trong helper-only local checkpoint này. Build trước đó không phải fresh build của source mới. Chưa chứng minh page-load/p95/RUM, zero regression, Production/release acceptance hoặc mọi phần Task 7/9 hoàn tất.
- Timeout KPI cũ, full-native Windows crash, strictvisual cũ, Node0TB timing uncertainty và các phần roadmap khác vẫn mở. Không đổi ba lint warning trong đợt này; không push/deploy.

Chi tiết `docs/nearest-node-cache.md`; plan `docs/superpowers/plans/2026-10-29-nearest-node-cache-local.md`. Evidence private `.local/performance/nearest-node-cache-20261029/` lưu snapshot/preimage, RED/GREEN, frozen hashes, review/QA và manifests/scans/backups; không commit env/DB/log/token hoặc business data.

## 40. Bỏ menu Tồn CDT và Rời mạng theo yêu cầu (29/10/2026, local)

- Owner xác nhận hai mục không dùng: gỡ hai link khỏi Sidebar dùng chung desktop/mobile; gỡ cả hai nút Tồn CDT ở header/toolbar trang CDT. Xóa icon import và prop/callback `onOpenOutstanding` không còn dùng, không thay bố cục/CSS ngoài việc bỏ các entry này.
- Giữ CDT thường, Công văn, Cước, KPI, Nguy cơ rời mạng, trạng thái khách hàng và các chỉ tiêu KPI liên quan rời mạng. Module/hooks/dynamic loader, URL cũ, API/schema và dữ liệu vẫn còn; đây là bỏ menu, **không phải xóa tính năng/dữ liệu hoặc thu hồi quyền**. URL cũ vẫn có thể mở trực tiếp theo cơ chế quyền hiện có.
- Dừng tối ưu COUNT CDT tồn đang dở trước yêu cầu mới. Candidate và RED/GREEN22 giữ trong evidence private, không tích hợp vào primary; restore đúng route worktree từ preimage và xóa riêng test tạm sau hash guard. Không tiếp tục đầu tư hai màn hình này nếu owner chưa yêu cầu bật lại.
- Snapshot sau restore: 432 union paths/332 source-config-test paths, 99 thay đổi local trước và 442 artifact cũ. Giữ nguyên API/dữ liệu và các thay đổi của những đợt trước; không branch/commit/push/deploy.
- Thêm 9 UI case: 3 role × Sidebar mở sẵn/mobile drawer/CDT actions. Lần RED đầu có 3 queryByRole ambiguity vì tồn tại hai nút; giữ log, đổi sang queryAll đếm0 để kiểm cả hai entry. **RED-count 9 failure vì entry còn tồn tại → GREEN9/9**; các link/callback CDT còn dùng vẫn hoạt động.
- Worktree lượt đầu đạt **36 file/601 scoped test +22 policy**, lint 0 error/3 warning có sẵn nhưng TypeScript phát hiện option `exact` không hợp lệ trong test queryByRole. Giữ log/type failure và hash manifest V1, đổi riêng 7 query sang name regex có neo đầu/cuối để giữ exact-name assertion; không suppress type error hoặc nới assertion. Các test direct URL preload của hai module cũ vẫn giữ nguyên và nằm trong selection.
- **Worktree V2 và primary chạy riêng đều đạt 36 file/601 scoped test +22 policy**, full TypeScript nonincremental đạt, lint 0 error/3 warning có sẵn. Không cộng hai lượt thành số testcase khác nhau, không dùng WT PASS thay primary hoặc gọi đây là full suite.
- Review APPROVE đúng final4hashes, xác nhận app3file không đổi giữa V1/V2, test chỉ sửa 7 query name matchers. Source integration có backup/preimage, whitespace/default secret scan không finding. Tổng phạm vi 7 file: Sidebar, CdtPanelClean, PrepaidPageImpl, test UI mới, plan, roadmap và tiến độ. Docs manifest kiểm lại 432 snapshot paths, inventories, 99 thay đổi cũ và 442 artifact cũ; các API và test có sẵn khác giữ nguyên. Evidence có `source-integrated.json`, `integrated-files.json`, `final-check.json`; không commit/push/deploy.
- Không chạy full-native/build/browser/pixel QA, không claim cải thiện tốc độ hay release acceptance. Timeout KPI cũ, native Windows, strictvisual và Node0TB timing uncertainty vẫn mở; chưa push/deploy.

Plan `docs/superpowers/plans/2026-10-29-hide-unused-report-menus.md`; evidence private `.local/performance/hide-unused-report-menus-20261029/` và interruption archive `.local/performance/cdt-outstanding-count-20261029/`. Không đưa env/DB/log/token vào Git.

## 41. Cước CĐ: bỏ read ngày mới nhất lặp khi cache nóng (29/10/2026, local)

- Tiếp Task10 cho màn hình còn dùng; không bật lại/đầu tư Tồn CDT hoặc Rời mạng. Snapshot 434 union paths/333 source-config-test paths, 103 thay đổi local và hash 488 artifact cũ; giữ HEAD/index và worktree hiện có.
- `GET /api/cuoc-cd/report` trước đây luôn query ngày mới nhất trước response cache khi không truyền ngày. Thêm metadata chuỗi (kể cả rỗng) TTL30giây từ completion, trong namespace `cuoc-cd:report:latest-date`; lookup sau auth/role/readiness/scope, explicit date bypass. Import/config đã clear prefix bao phủ key này, không sửa writers.
- Giữ response key/TTL60giây, global-date semantics, role/registry/secondary/manager filters, row order và rounding/summary/fallback. Metadata/response cùng generation capture trước auth, không publish read cũ sau invalidation. AST xác nhận cả5SQL expressions/params giữ nguyên byte.
- TDD route/cache/SQL thật trên SQLite `:memory:`, chỉ Prisma/auth/scope/readiness boundary giả: **RED18 semantic fail/3 pass → GREEN21/21**. Payload đối chiếu reference JS độc lập cho3role; positive/negative TTL, explicit date, errors/retry, legacy schema, scope-key và invalidation trong auth/read đều có coverage. Database explicit close; không libsql/DB file thật.
- Schema thông thường: cold latest vẫn4 report SELECT; cùng response/meta warm **1→0**, khác role/meta warm/report miss **4→3**, explicit date vẫn3; empty request lặp **1→0**. Đây là SQL trong database bộ nhớ của report route, không bao gồm auth/scope/readiness hoặc chứng minh web/p95/Turso nhanh hơn.
- **Freshness contract mới:** write trực tiếp sau fill không invalidation có thể chờ TTL còn lại trong30giây từ completion; nếu xen giữa read đang chờ, thời gian read và TTL có thể cộng lại, không có hard freshness bound. Import/config prefix invalidate trong process đó. Không single-flight/distributed invalidation, snapshot linearizability hoặc sửa role-matching hạn chế cũ. Không claim mọi payload identical khi có uninvalidated/concurrent writes.
- WT V1 đạt38file/628test+22policy/types nhưng lint bắt helper test tên `useRole` bị nhận nhầm là React Hook khi gọi trong loop. Giữ log/hash V1, chỉ đổi tên helper và call sites thành `setSessionRole`, không sửa app/logic/assertion hoặc suppress rule; V2 QA ghi riêng.
- **WT V2 và primary chạy riêng đều đạt38file/628scoped test +22policy**, TypeScript nonincremental đạt, lint0error/3warning cũ. Không dùng focused/worker PASS thay primary, không cộng hai lượt thành testcase khác nhau hoặc gọi scoped selection là full suite. SQL scope pushdown/identity mapping, giảm row transfer và phần khác Task10 chưa làm.
- Review APPROVE final source/test pair, source hash không đổi sau V1; test chỉ rename helper. Source integration có backup/preimage, whitespace/default secret scan không finding. Tổng6file:1API route,1test mới, guide/plan/roadmap/tiến độ; docs manifest kiểm lại434 snapshot paths, inventories,103thay đổi trước và488artifact cũ. API/UI/menu đã ẩn và tests có sẵn khác giữ nguyên, không branch/commit/push/deploy. Prefix invalidation có hiệu lực trong cùng cache-store/module instance; không bảo đảm đồng bộ mọi Vercel worker. Evidence có source/docs manifests và `final-check.json`.
- Chỉ local, không env/database thật, không native full suite/build/browser/Production benchmark, dependency upgrade hoặc branch/commit/push/deploy. Native/KPI-timeout/oldvisual/Node0TB timing và release gates vẫn mở; ba lint warning cũ giữ nguyên.

Chi tiết `docs/cuoc-cd-latest-date.md`; plan `docs/superpowers/plans/2026-10-29-cuoc-cd-latest-date-local.md`. Evidence private `.local/performance/cuoc-cd-latest-date-20261029/` giữ mọi failed/pass artifacts, SQL invariants, frozen hashes, reviews/QA/scans/backups và manifests. Không commit env/DB/log/token/business data.

## 42. Bỏ thêm menu Nguy cơ rời mạng (29/10/2026, local)

- Theo yêu cầu mới của owner, gỡ `/churn-risk` khỏi Sidebar dùng chung desktop/mobile và import `ShieldAlert` không còn dùng. Không sửa CSS, các menu khác, route/page/API, dữ liệu hoặc chỉ tiêu KPI; URL cũ vẫn mở trực tiếp theo quyền hiện có. Hai mục Tồn CDT/Rời mạng vẫn giữ trạng thái đã bỏ khỏi menu.
- Bổ sung một assertion trong test điều hướng hiện có, giữ đủ9case/3role và kiểm cả drawer mobile: **RED6fail/3pass do link còn tồn tại → GREEN9/9**. Exact-edit reconstruction xác nhận app chỉ mất một nav entry/icon import, test chỉ thêm assertion và sửa tiêu đề; không claim independent peer review.
- Snapshot437 paths/334 source-config-test paths,106 thay đổi local trước và529 artifact cũ. Worktree và primary chạy riêng đều đạt **2file/10test điều hướng/app-shell +22policy**, full TypeScript nonincremental đạt, lint0error/3warning cũ. Đây là selection tập trung, không phải chạy lại628test hoặc native full suite.
- Tích hợp đúng4file: Sidebar, test điều hướng hiện có, roadmap và tiến độ. Có preimage/backup, exact-edit guard, whitespace/default secret scan và final hash/inventory preservation; giữ106thay đổi cũ theo scope đã nối tiếp và529artifact cũ. Các file API/page/feature data và tests ngoài phạm vi giữ nguyên; manifests xác định rõ ownedFiles, không claim mọi test file không đổi khi test điều hướng có thêm assertion.
- Thay đổi local, không build/browser/pixel hoặc Production acceptance; không commit/push/deploy. Dữ liệu/API và các gate cũ không được coi là đã xử lý chỉ vì bỏ menu.

Evidence private `.local/performance/hide-churn-risk-menu-20261029/` lưu preimage, RED/GREEN, exact-edit scope, QA/scans/backups và manifests; không commit env/DB/log/token.

## 43. Login: phục hồi sau lỗi và chặn submit trùng (29/10/2026, local)

- Tiếp lát cắt Task11, không thay UI lớn hoặc bật lại ba menu đã bỏ. Snapshot437 paths/334source-config-test paths,106 thay đổi local và hash565artifact cũ; giữ HEAD/index và worktree hiện có.
- Tái hiện handler cũ không catch rejected signIn nên loading/disabled bị giữ và có unhandled rejection; undefined/ok:false không có error vẫn own push dashboard; hai submit liên tiếp có thể gọi auth hai lần.
- Client form dùng ref guard +try/catch/finally: lỗi đã settle mở lại form/guard, giữ nguyên giá trị credentials; error copy credential cũ, exception/unknown response dùng message cố định. Chỉ ok=true và không error mới push("/")/refresh; sau success giữ busy như trước tới navigation. Không trim password/username, không log exception/credentials hoặc đổi redirect:false/backend auth/session/role.
- Thêm alert region/id, aria-describedby/busy và autocomplete username/current-password, username autocapitalize none. Giữ CSS/bố cục, không thêm input name hay nút hiện mật khẩu. Test kiểm attrs, không claim screen-reader/password-manager/browser mobile thực.
- **RED13 assertion fail/1pass+3unhandled rejections cũ → GREEN14/14**, giữ mọi artifact không suppress. Ba exception là hai signIn rejects và một sync navigation throw. Có pending/duplicate/retry/error clearing/fields/verbatim/unknown responses/error precedence/success-lock coverage bằng React DOM thật, auth/router giả, không tài khoản/network thật.
- **Worktree và primary chạy riêng đều đạt39file/642scoped test +22policy**, full TypeScript nonincremental đạt, lint0error/3warning cũ. Không cộng hai lượt thành testcase khác nhau, không dùng focused/worker PASS thay primary hoặc gọi đây là full suite. Không retry unchanged code/tăng timeout để ép xanh.
- Review static độc lập APPROVE final source/test pair; không thêm authored code sau freeze. Source integration có backup/preimage, whitespace/default secret scan không finding. Tổng6file: LoginPage, test UI mới, guide/plan/roadmap/tiến độ; docs manifest kiểm lại437 snapshot paths, inventories,106thay đổi cũ và565artifact cũ. CSS, server auth/API và các menu đã bỏ giữ nguyên; tests có sẵn khác không đổi. Evidence có source/docs manifests và `final-check.json`, không commit/push/deploy.
- SignIn chưa settle vẫn pending, không thêm deadline/cancel; SDK có path tự redirect trước undefined, chỉ guard own dashboard push. Không chờ route commit/unmount/cross-tab guarantee, không sửa mọi provider-error classification.
- Chưa hoàn tất Task11/iframe/hiện mật khẩu/mobile/pixel hoặc release; không native full suite/build/browser/Production benchmark, env/DB thật, dependency upgrade hoặc branch/commit/push/deploy. Native/KPI-timeout/oldvisual/Node0TB timing và các gate cũ vẫn mở.

Chi tiết `docs/login-feedback.md`; plan `docs/superpowers/plans/2026-10-29-login-feedback-local.md`. Evidence private `.local/performance/login-feedback-20261029/` giữ preimage, RED/GREEN gồm unhandled failures cũ, hashes/reviews/QA/scans/backups và manifests. Không commit env/DB/log/token hoặc credentials thật.

## 44. Đổi mật khẩu: khóa form khi gửi và không báo thành công sai (29/10/2026, local)

- Tiếp Task11 cho form còn dùng, không đổi CSS/bố cục hoặc bật lại ba menu đã bỏ. Snapshot440 paths/335source-config-test paths,110 thay đổi local và hash599artifact cũ; giữ HEAD/index/worktree hiện có.
- Ref guard chặn submit trùng, disable3field và bỏ qua change trong lúc PUT đang chờ; finally release sau response settle. Giữ local min6/confirm, PUT `/api/change-password`/JSON hai field verbatim, không trim hoặc gửi confirmation. Không sửa backend/auth/bcrypt/session/JWT/revocation/password policy.
- Bám contract API hiện tại: HTTP200 + object có message string không rỗng/không error mới success và clear fields. Well-formed4xx error giữ copy API, còn network/JSON/5xx/malformed/201/202 dùng message cố định về kết quả chưa xác nhận; giữ field values và nhắc kiểm tra đăng nhập trước khi gửi lại. Không auto-retry hoặc claim server chưa mutation.
- Labels nối id, autocompletecurrent/new/new, alert/status/description/busy và tên nút pending; field names/masking/CSS giữ nguyên. Form methodPOST chỉ tránh default native GET lộ dữ liệu vào query nếu JS không chạy; không cung cấp native POST change-password flow, API vẫn PUT.
- TDD dùng React DOM thật/fetch mock/Response giả, không API hay mật khẩu thật. Giữ RED đầu có it.each array-spread fixture mismatch, sửa object-wrapped rows trước app: **corrected RED19fail/4pass→coreGREEN23**. Hai case HTTP201/202 sau đó **RED2fail/23pass→finalGREEN25/25**; không suppress/skip/deadline changes.
- Bao phủ validation/retry, pending editing/duplicate, known4xx, Error/string rejection, non-JSON200/502, 5xx detail, non-string error,6malformed JSON shapes, strict status contract, success clear fields và verbatim body. Mỗi duplicate mock có Response riêng, deferreds settle trong finally.
- **Worktree và primary chạy riêng đều đạt40file/667scoped test +22policy**, TypeScript nonincremental đạt, lint0error/3warning cũ; không cộng hai lượt thành testcase khác nhau, không dùng focused/worker PASS thay primary hoặc gọi scoped selection là full suite. Không retry unchanged code/skip/deadline changes.
- Static review độc lập APPROVE exact source/test pair, source/API contract đối chiếu nhưng không chạy password write thật. Source integration có backup/preimage, whitespace/default secret scan không finding. Tổng6file: client page/test mới, guide/plan/roadmap/tiến độ; docs manifest kiểm440 snapshot paths, inventories,110thay đổi cũ và599artifact cũ. CSS, backend/auth/server policy, các menu đã ẩn và tests có sẵn khác giữ nguyên; không authored code sau freeze, không branch/commit/push/deploy. Evidence có source/docs manifests và `final-check.json`.
- Promise chưa settle vẫn pending, không cancel/deadline/backend idempotency/cross-tab guarantee; client không xác minh DB sau mất phản hồi. Không real auth/write/session-revocation/browser/mobile/autofill acceptance.
- Chưa xong iframe hoặc toàn Task11/Task10, không native full suite/build/browser/Production benchmark, env/DB thật hoặc dependency upgrade/branch/commit/push/deploy. Các gate cũ và3warning cũ vẫn mở.

Chi tiết `docs/change-password-feedback.md`; plan `docs/superpowers/plans/2026-10-29-change-password-feedback-local.md`. Evidence private `.local/performance/change-password-feedback-20261029/` giữ snapshot/preimage, mọi RED/GREEN và fixture attempts, hashes/reviews/QA/scans/backups/manifests. Không commit env/DB/log/token hoặc credentials thật.

## 45. Công cụ nhúng: phản hồi tải và tải lại thủ công (29/10/2026, local)

- Tiếp Task11 cho Phiếu thu/Excel/Sửa ảnh; giữ server access guard, src/query, iframe CSS100dvh, assets/routes/quyền và ba menu đã bỏ. Snapshot443 union paths/336source-config-test paths,114 thay đổi local và639artifact cũ; tái dùng worktree/HEAD/index, không cài thêm dependency.
- Tách client attempt sau `await ensureToolsAccess()`: title Việt có dấu, status/busy/description khi tải; sau15giây chỉ cảnh báo chờ lâu, không hủy request/tự reload hoặc probe thêm. Khi nhận load dọn notice/timer; error capture nhận non-bubbling event nếu browser phát, không coi đó là HTTP status monitor.
- Slow/error có nút Tải lại công cụ cùng cảnh báo mất tệp/chỉnh sửa chưa lưu. Chỉ click mới thay iframe cùng URL/query, reset state/timer và focus khung mới; keyed attempt cô lập timer/event cũ, rerender cùng props không phá iframe đang dùng. CSS riêng theme tokens/wrap/44px/focus-visible; không đổi nội dung công cụ hoặc palette/bố cục app.
- TDD auth/router giả/fake timers/React DOM thật, không fetch tool assets: **RED11fail/14pass**. Initial implementation còn2fail do React iframe không gắn target error listener; đối chiếu source React cài sẵn rồi dùng capture. Một fail timer-count sau đó trace được jsdom SelectionImpl focus tạo timer0ms; flush đúng0ms trong test, không tăng ngưỡng15giây/skip/assertion/config suppression. Diagnostic/failed logs giữ nguyên, final **25/25 pass**.
- Coverage3tool title/src/attrs,2allowed roles/4forbidden roles/2missing session/pending auth; load/slow/error/late load; deliberate reload/focus, DOM cũ, src change/same render và unmount4state. Đây là event/DOM tests, không chứng minh asset HTTP/auth hoặc app-ready thực.
- **Worktree và primary chạy riêng đều đạt41file/692scoped test +22policy**, full TypeScript nonincremental đạt, lint0error/3warning cũ. Không cộng hai lượt thành testcase khác nhau, gọi selection là full suite hoặc dùng focused/reviewer PASS thay QA primary. Không sửa app/test sau freeze.
- Review static độc lập kiểm spec trước quality, APPROVE exact4hashes; source integration có backup/preimage, whitespace/default secret scan không finding. Tổng8file: wrapper/client/CSS/test mới và guide/plan/roadmap/tiến độ; manifests/final-check kiểm443snapshot paths, inventories,114thay đổi cũ và639artifact cũ. Mọi API/guard/asset/menu và tests có sẵn khác giữ nguyên, không branch/commit/push/deploy.
- Iframe load có thể là401/403/404 hoặc HTML xong nhưng scripts lỗi; onError không bảo đảm, timeout không chứng minh mất mạng. Không no-JS/hydration/iframe nội bộ/camera/CDN/file-processing/real-browser/mobile/screen-reader/CLS acceptance, full native/build/Production benchmark. Native/KPI timeout/oldvisual/Node0TB timing và các gate cũ vẫn mở; không branch/commit/push/deploy, chưa xong toàn Task11/Task10.

Chi tiết `docs/tool-frame-feedback.md`; plan `docs/superpowers/plans/2026-10-29-tool-frame-feedback-local.md`. Evidence private `.local/performance/tool-frame-feedback-20261029/` giữ mọi snapshot/preimage, RED/GREEN/diagnostic, hashes/review/QA/scans/backups/manifests. Không commit env/DB/log/token hoặc dữ liệu kinh doanh.

## 46. Hiện/ẩn mật khẩu trên Login và Đổi mật khẩu (29/10/2026, local)

- Tiếp phần Task11 đã duyệt, snapshot448union paths/339source-config-test paths,120thay đổi local và681artifact cũ; giữ worktree/HEAD/index hiện có, không dependency mới. Không đổi CTV modal/công cụ/quyền hoặc bật lại3menu đã bỏ.
- Shared PasswordInput controlled chỉ forward native attributes và render icon/nút typebutton; từng ô có Hiện/Ẩn tiếng Việt, aria-controls/pressed và disabled đồng bộ. CSS module riêng dùng theme tokens/focus-visible, nút44px và chừa padding; field min-height44px có thể tăng chiều cao để đủ vùng bấm, không thay global palette/bố cục lớn.
- Login và3ô Đổi mật khẩu masked default, visibility local mỗi mount/field. JS submit handler che lại trước request/validation, pending ref guard chặn queued reveal. Error giữ values nhưng che, confirmed success change-password vẫn clear, login vẫn busy tới navigation. Không trim/mutate credentials, thêm name Login, đổi request/auth/validation/strict response/uncertainty policy hoặc session/backend.
- **RED22/22fail do thiếu controls→GREEN22/22pass**, React DOM/user-event/auth-router-fetch giả, không tài khoản/API/DB thật. Test8Login/14Change bao phủ native keyboard không submit, attrs, independent reveal/hide/values, same-batch submit/toggle guard, pending/failure/validation/success/verbatim/onChange và remount; không skip/suppress/deadline/config changes.
- WT V1 đạt42file/714test+22policy/lint nhưng types fail vì test mới truyền `exact:true` vào ByRoleOptions không hỗ trợ. Đối chiếu thư viện cài sẵn, V2 chỉ bỏ24option đó: string name đã exact trong role.js/matches(), không đổi app/assertion/matcher hoặc suppress types. Giữ source/hash/log V1 riêng trước sửa, focusedV2 vẫn22/22pass; QA V2 có artifacts riêng, không ghi đè lỗi cũ.
- **Worktree V2 và primary chạy riêng đều đạt42file/714scoped test +22policy**, full TypeScript nonincremental đạt, lint0error/3warning cũ. Không cộng hai lượt thành testcase khác nhau, gọi selection là full suite hoặc dùng focused/reviewer PASS thay primary/types. Không sửa app/test sau freeze V2, không retry unchanged code để ép xanh.
- Static review độc lập APPROVE spec trước quality exact5hash V2, đối chiếu preimage và narrow24query correction. Source integration có backup/preimage, whitespace/default secret scan không finding. Tổng9ownedfile:2page/component/CSS/test mới và4docs; manifests/final-check kiểm448snapshot paths, inventories,120thay đổi cũ và681artifact cũ. Mọi API/guard/asset/menu/CTV và tests có sẵn khác giữ nguyên, V1 sources/type-failure/logs/hash bảo toàn; V2-correction chứng minh app/assertion/matcher không thay. Không branch/commit/push/deploy.
- Không claim bảo vệ plaintext khỏi người nhìn/extension/script/DevTools. Không auto-hide theo blur/timer; native-invalid/no-JS submit có thể không chạy handler. Chưa browser/OS/autofill/password-manager/IME/caret/mobile/screen-reader/layout/CLS/performance acceptance, full native/build hoặc Production benchmark. Native/KPI timeout/oldvisual/Node0TB timing và release gates cũ vẫn mở, không branch/commit/push/deploy; chưa xong toànTask11/Task10.

Chi tiết `docs/password-visibility.md`; plan `docs/superpowers/plans/2026-10-29-password-visibility-local.md`. Evidence private `.local/performance/password-visibility-20261029/` giữ snapshot/preimage/RED/GREEN/hashes/review/QA/scans/backups/manifests; không commit env/DB/log/token hoặc credentials thật.

## 47. Tổng hợp KPI: mã dài không lấn cột và số dễ đọc (29/10/2026, local)

- Tiếp Task11, snapshot453union paths/342source-config-test paths,125thay đổi local và731artifact cũ. Rà customer/KPI rồi giới hạn fix theo repro trên2màn tổng hợp còn dùng; không sửa CustomerTable/CTV hoặc bật lại3menu đã bỏ, giữ worktree/HEAD/index/dependencies hiện có.
- Root cause table fixed-layout +tdnowrap, nameCell chỉfont/color; mã dài có thể vẽ xuyên KH/TH/% dù page không overflow. Mobile title/manager metadata thiếu overflow-wrap nên tràn/cắt trong card. Thêm đúng2root scope classes và CSS wrapnameCell/mobileTitle/summaryManagerMeta, số table right/tabular. Không đổi strings/values/formulas/handlers/filters/pagination/widths/sticky/scroll/breakpoints/backend/quyền/palette; extreme string tăng row/card height để giữ đủ chữ.
- Typed fixture giả dài/Unicode/name/title, **RTL RED2fail/4pass→GREEN6/6**: scope riêng, full text/6cột/row/totals/formatting/negative gap preserved. Không dùng jsdom làm bằng chứng pixel.
- Chrome harness SSR actual components +compiledCSS/globalCSS, không Next server/build/hydration/auth/API/DB hoặc dùngbuild cũ. Initial/V2/V3 loader setup errors0case giữ riêng; trace installedVitefetchModule xác định file://inlineCommonJS, chuyển bare imports/rootdedupe trong private harness. V4 layoutRED valid; V5 bổ sung manager metadata trước app fix. Không sửa project configs/deps/timeout/skip/suppress để ép xanh.
- Matrix20case2panel×5width360/390/768/1024/1440×2theme +4root-font200% (không browserzoom). **V5before24/24identityfail→WTafter24/24pass**, metadatafits, numericcomputedright/tabular, pageoverflow0 trong fixture; request/pageerror0. Numericstyle đọc desktoptable kể cảhiddenmobile, không claim chipmobile alignment. Parent xem ảnhbefore/after desktopNV/mobileQL, không full-web/real-device acceptance.
- **Worktree và primary chạy riêng đều đạt43file/720scoped test +22policy**, full TypeScript nonincremental đạt, lint0error/3warning cũ; mỗi root Chrome SSR V5after24/24case đạt. Không cộng hai lượt, gọi selection/matrix là full/native/app-E2E acceptance hoặc dùng reviewer/focused PASS thay primary. Không sửa app/fixture/test sau freeze.
- Static review độc lập APPROVE exact5hash, xác nhận2root +13lineCSSblock là toàn bộ appdelta; exact-scope manifest kiểm cùngfixture/frozenbrowser. Source integration có backup/preimage, whitespace/default secret scan không finding; tổng9ownedfile3app/2fixture-test/4docs. Manifests/final-check kiểm453snapshot paths, inventories,125thay đổi cũ và731artifact cũ, API/guard/asset/menu/customer/CTV/tests có sẵn giữ nguyên. Docs làm rõ bảng `__all__` dùngclassriêng không nhận numeric alignment rule, metadata cùngclass vẫnwrap; không rộng claim nghiệm thu view đó. Không branch/commit/push/deploy.
- Chưa browser hydration/dashboard-shell/3role/API/DB/mobiledevice/screen-reader/CLS/RUM/performance hoặc mọi bảng/panel; không Next build/native fullsuite/Production acceptance. Native/KPI timeout/oldvisual/Node0TB timing và release gates vẫn mở, không branch/commit/push/deploy, chưa đóng toànTask11/Task10.

Chi tiết `docs/summary-identity-layout.md`; plan `docs/superpowers/plans/2026-10-29-summary-identity-layout-local.md`. Evidence private `.local/performance/summary-identity-layout-20261029/` lưu snapshot/preimages/RED/GREEN/setup/geometry/SSRhtml/PNG/hashes/review/QA/scans/backups/manifests; không commit env/DB/log/token/business data.

## 48. Card khách hàng mobile: dễ bấm và không submit nhầm form (29/10/2026, local)

- Tiếp Task11, snapshot457union paths/344source-config-test paths,132thay đổi local và815artifact cũ; giữ worktree/HEAD/index/dependencies. Chỉ CustomerMobileCard/CSS scoped, không desktop table/handlers/backend/menu/KPI/CTV hoặc bật lại3menu đã bỏ.
- Native label44px bao checkbox16px, min44px links/copy/node/edit/delete và focus; card có thể cao hơn, không phóng icon/checkbox toàn app. Article/action/link names Việt theo khách hàng,4nút typebutton; giữ callbacks/account verbatim/tel-Zalo URLs/target-rel/flags/no-node-disabled và ADMIN-only selection/delete.
- RED đầu8fail/11pass có1queryfixture whitespace-normalizer; giữ source/log, sửa query normalizedtext +assert rawtitle trước app. **CorrectedRED7fail/12pass→GREEN19/19**;4case form wrapper tái hiện onSubmit ngoài callback. Không claim production page hiện bọc table trong form, không skip/suppress/timeout/config changes. Tests còn lại roles, native label/Space/deselect, copy acknowledgement, missing data/flag, nhiều card và desktop expansion/stopPropagation.
- Chrome actual SSRcomponent/CSS +propsgiả, không Next/auth/API/DB/hydration/link/app mutation.36case30matrix5width×2theme×3role+6root-font200%desktop;18mobilecase trước lỗi44target/type/name và6labelpaddingfail→WTafter0fail. Native paddingclick nhận1change/click rồi togglevềfalse; callback React kiểmRTL riêng.18desktop controls geometry/names/types unchanged; không ép desktop44, không gọifake roles auth-E2E/rootfont làbrowserzoom. Parent xem mobileADMIN before/after, không wholeapp visual.
- **Worktree và primary chạy riêng đều đạt44file/739scoped test +22policy**, full TypeScript nonincremental đạt, lint0error/3warning cũ; mỗi root ChromeSSR V2after36/36case,18desktopgeometry unchanged. Không cộng hai lượt, dùng focused/reviewer PASS thay primary hoặc gọi selection/matrix là full/native/appE2E acceptance. Không sửa app/fixture/test sau freeze.
- Static review độc lập APPROVE spec trước quality exact4hash, xác nhận chỉmobile delta/CSS scoped. Exact-scope kiểm desktop/sharedhelpers/defaultparent byte-equal, AST callbacks/link/disabled/checked giữ nguyên và samefixturetest. Source integration có backup/preimage, whitespace/default secret scan không finding; tổng8ownedfile2app/2fixturetest/4docs. Manifests/final-check kiểm457snapshot paths, inventories,132thay đổi cũ/815artifact cũ; API/auth/menu/KPI/CTV/tests có sẵn và mọiRED/querycorrection/browser artifacts bảo toàn, không branch/commit/push/deploy.
- Chưa hydrate/router/clipboard/CRUD/session/realrole/device/mobilefont200%/screenreader/CLS/RUM/speed/Production acceptance hoặc toànTask11. Native/KPI-timeout/oldvisual/Node0TB timing/release gates vẫn mở; không full-native/build/dependency upgrade hoặc branch/commit/push/deploy.

Chi tiết `docs/customer-mobile-controls.md`; plan `docs/superpowers/plans/2026-10-29-customer-mobile-controls-local.md`. Evidence private `.local/performance/customer-mobile-controls-20261029/` giữ preimages/snapshot/RED/querycorrection/GREEN/geometry/SSRhtml/PNG/hashes/review/QA/scans/backups/manifests; không commit env/DB/log/token/business data.

## 49. CTV mobile: thống kê gọn và bỏ khoảng trống tìm kiếm (29/10/2026, local)

- Tiếp Task11, snapshot461union paths/346source-config-test paths,138thay đổi local và887artifact cũ. Giữ HEAD/worktree/index/dependencies và3menu đã bỏ; chỉ2JSX attribute sites +CSS trong media640, không đổi data/backend/guard/requests/filter/counts/handlers/strings cũ.
- Thống kê tài khoản≤640px thành2×2, giữ đủ4nhãn/value/chú thích, không giảm font/line-height/ẩn chữ/thêm toggle hoặc DOM trùng. Region/search names Việt; CSS scoped giảm min-height/padding, số tabular/wrap. Trên641px và KPIconfig giữ geometry.
- Root cause search: flex-basis380px của layout ngang thành chiều cao khi toolbar column; input44px nhưng wrapper380px, icon căn giữa wrapper nên lệch và khối sau bị đẩy xuống. Reset basisauto đúng scope mobile, không sửa globalinput. Counts vẫn toàn users sau loạiADMIN, không theo search; hintCTVactive cũ không có kiểm trạng thái active mới.
- **RTL RED2fail/8pass→GREEN10/10**, fake fetch/router/React DOM: named region/search/scope, ADMINexclusion/totals/fullhints, search/clear/no-match không refetch, empty/loading/error/retry và KPIbranch. Không dùng jsdom khẳng định pixel, sửa existingtests/config/deps/skip/suppress/deadline.
- Chrome actual CtvClient initialSSR0counts/loading +actual CSS/childCSS/provider, private Nextadapters, không hydration/server/auth/API/DB.32case7width×2theme×2view+4root-font200%desktop; V5before6mobilecompact/searchfield/iconfail và16namefail→WTafter0fail/32case,26noncompact/configgeometryexact. Mobile390 stats479.17→235.72px/search lên243.45px, searchField380→44px, loadingcontent lên579.45px. Không gọi đây loadedrow/latency/Production-speed hoặc browserzoom/device acceptance; parent xem390before/after PNG.
- Giữ V1setupfail/V2missingchildCSS/V3diagnostic/V4expandedmeasurement; V4after rootfont comparison subpixel fail do font đổi sau render giữa inputtransition. Diagnostic chứng minh37.1875→72.375px sau settle; V5embedfont/theme trướclayout vàbaselinepreimages, không nới tolerance/tắtanimation/thêm sleep/appchange. Exact-scope firstexpectedorder sai privateverifier, sửa đúng aria-label sauplaceholder; app/test/hashes không đổi, failed artifacts bảo toàn.
- **Worktree và primary chạy riêng đều đạt45file/749scoped test +22policy**, full TypeScript nonincremental đạt, lint0error/3warning cũ; mỗi root ChromeV5after32/32case,26noncompact geometry unchanged. Không cộng hai lượt thành testcase khác nhau hoặc dùng focused/browser/reviewer để suy ra primary/fullnative/build acceptance; app/test không sửa sau freeze.
- Review static độc lập APPROVE spec trước quality exact4hash, exact-scope chứng minh delta tối thiểu/samefixtures/preimages. Source và docs integration có backup/preimage, whitespace/default secret scan không finding; tổng8ownedfile2app/2fixturetest/4docs. Manifests/final-check kiểm461snapshot paths, inventories,138thay đổi cũ/887artifact cũ và HEAD/index/buildId, mọi API/auth/menu/KPI/tests/app khác bảo toàn. Không branch/commit/push/deploy.
- Chưa Next hydration/dashboard-shell/realroles/modal/CRUD/loadedcard/device/mobilefont200%/screenreader/CLS/RUM/API speed hoặc toànTask11. Native/KPI-timeout/oldvisual/Node0TBtiming/Task10SQLscope/release gates vẫn mở; không branch/commit/push/deploy.

Chi tiết `docs/ctv-user-stats-compact.md`; plan `docs/superpowers/plans/2026-10-29-ctv-user-stats-compact-local.md`. Evidence private `.local/performance/ctv-user-stats-compact-20261029/` giữ snapshots/preimages/RED/GREEN/geometry/SSRHTML/PNG/fontdiagnostic/hashes/exact-scope/review/QA/scans/backups/manifests; không commit env/DB/log/token/business data.

## 50. Card khách hàng mobile: thông báo gọn khi thiếu SĐT/account (29–30/10/2026, local)

- Tiếp Task11, snapshot465union paths/348source-config-test paths,144thay đổi local và992artifact cũ; reuse worktree/HEAD/index/dependencies. Không bật lại3menu đã bỏ hoặc sửa API/auth/data/KPI/CTV/desktop/helpers/parent.
- Chỉ CustomerMobileCard: guard2phone/account strips theo truthiness cũ, thiếu một/cảhai thì một flex-wrap row hiện rõ `Chưa có SĐT`/`Chưa có account`, thay fullstrip `---`. CSS class mới dùng secondarytext tokens, không trim/mutate/reclassify whitespace/literalplaceholder; full-data subtrees/callbacks/rawaccount/copyfeedback/links/options/ADMINgates/node-disabled và44px controls giữ nguyên. Placeholder CTV/package/date/billing ngoài phạm vi.
- **RTL RED9fail/5pass→GREEN14/14** actualcomponent/propsgiả:4biến thể/null/empty,3role thiếu cảhai, edit/non-submit/node-disabled, fullraw/URLs/copyfeedback, whitespace/literal`---`, rerenderrestore, flags/metadata và desktopexpand. Không coi propsrole là authE2E hoặc jsdom là pixel; existingtests/config/deps/deadlines giữ nguyên, không skip/suppress.
- Chrome SSR actualcomponent/CSS, syntheticloadedprops/fakeADMIN,64case6width360/390/768/769/1024/1440×2theme×4variant +16root-font200%390/1440 (không zoom/device). V2before48DOMcontractfail gồm24mobile/24hidden-cardDOM→WTafter0fail/64, text/control0.24mobilemissingcase gọn≥20px/trường;390thiếuSĐT giảm23.89px/account41.36px/cảhai90.78px. Desktoptable canonicalDOM/geometry64case gồm32visible/32hiddenzero; fullcard16case gồm8mobilevisible/8hiddenzero giữ nguyên, không gọi zero bounds là visiblelayout acceptance. Parent xem390missingbefore/after PNG.
- V1đủ64case/geometry unchanged nhưng rawDOMcomparison failgenerated CSSmodule hash/line tokens. Giữ V1harness/report; V2chỉ map exact exported tokens về logicalclass keys, giữ classorder/externalclasses/attrs/text/DOM khác và strictgeometry, không nới threshold/timing/sửaapp. Exact-scope chứng minh guard2strips+hintrow/1CSSclass là toànappdelta, desktop/helpers/parent/populatedsubtrees byte-equal, samefixture/test/preimages và V1/V2phase hashes.
- **Worktree đạt46file/763scoped test +22policy**, full TypeScript nonincremental đạt, lint0error/3warning cũ. **Primary762pass/1fail**: `schema-auth-order.test.ts` case GETusers trả401 timeout5000ms; primary22policy/types/lint đạt và ChromeV2after64/64 đạt riêng. Auth+UI chạy riêng75/75 chỉ diagnostic, không thay gate đỏ; nguyên nhân timeout chưa chứng minh, không kết luận máy chậm/flaky/coldimport hoặc bug auth thật. Không sửa test/route/config/pool/deadline hay chạy lại bộ rộng unchanged để lấy xanh; giữ log/QA manifest lỗi nguyên vẹn.
- Review static độc lập APPROVE spec trước quality exact4hash; source integration có backup/preimage/whitespace/default secret scan, candidate không sửa sau freeze. Docs tích hợp riêng để lưu pending với cùng hàng rào, không chuyển QA đỏ thành xanh; tổng8ownedfile2app/2fixturetest/4docs. Scope-only final-check đối chiếu465snapshot paths/348source-config-test paths, inventories,144thay đổi cũ/992artifact cũ, HEAD/index/buildId và các tests/auth/config/app khác giữ nguyên. `primaryScopedAcceptancePassed:false`, `allRequiredQaGatesPassed:false`, `releaseReady:false`; không xem scope-check là nghiệm thu xong batch.
- Chưa Next hydration/router/realroles/API/DB/clipboard/CRUD/device/screen-reader/CLS/RUM/speed hoặc toànTask11; placeholdermetadata/CTV/package còn riêng. Native/KPI-timeout/oldNode0TBvisual/timing/Task10SQLscope/release gates vẫn mở. Không branch/commit/push/deploy/fullnative/build/dependency changes.

Chi tiết `docs/customer-empty-fields.md`; plan `docs/superpowers/plans/2026-10-29-customer-empty-fields-local.md`. Evidence private `.local/performance/customer-empty-fields-20261029/` giữ snapshots/preimages/RED/GREEN/browserV1–V2/SSRHTML/PNG/hashes/exact-scope/review/QA/scans/backups/manifests/final-check; không commit env/DB/log/token/business data.

## 51. Truy vết test auth timeout: chưa tái hiện, giữ gate mở (30/10/2026, local)

- Tiếp gate mục50, snapshot469union paths/148dirty và1088artifact cũ, reuse WT/HEAD/index. Không application/publictest/fixture/projectconfig/dependency/permission/menu changes; chỉ4docs public. Giữ nguyên primary auth GETusers timeout5000ms/762pass1fail và pending-acceptance mục50.
- Đối chiếu invoke/hook/resetModules/mock/importgraph: test budget gồm route.load rồi handler. Chưa tìm thấy bằng chứng quy nguyên nhân cho module/handler/scheduling cụ thể; không chuyển import sang hook/prewarm, đổi assertions/mocks/pool/deadline/deps để né timeout.
- Private Vite pre-transform đúng1file/2marker đo import:start/end và handler:start/end, không sửa file trên đĩa. EnvDir:false/env-file guard và mockauth/DB hiện có; không credentials/requestbody/session/token/businessdata/loggingruntime thật, không Next/build/browser/realDB/API.
- V1focused **61/61**, GETusers import109.11ms/handler1.60ms; một V1broad diagnostic **46file/763test**, import262.09ms/handler3.40ms; V2stable-context focused **61/61**, import96.82ms/handler1.55ms. Mỗi run212events53invocations, group identity/phase/time checks đạt; V2capturetest/path/method/pid/sequence đầu invocation, tránh gán event muộn vào test sau. Giữ runner/logsV1-V2, không cộng tests giữa lượt hoặc gọi fake process timings là tốc độ web.
- **Không tái hiện timeout, chưa chứng minh root cause, không có bản sửa auth.** Traced green có observer effect, không thay uninstrumented primary acceptance; `primaryScopedAcceptancePassed:false`, `releaseReady:false`. Không kết luận do máy chậm/flaky/coldimport/worker contention hoặc bug auth Production, không chạy lại bộ rộng đến khi xanh. Consistency của recorded success không bao phủ mọi failure path tracer.
- Review static độc lập APPROVE đúng2hash runner/driver, phạm vi transform và kết luận giới hạn; không thay acceptance/scans. Source/publictests/config không đổi, chỉ4docs có backup/whitespace/default secret scan và scope-only hash/inventory guards kiểm469paths/148dirty/1088artifact cũ; original failure/QA/pending gate giữ nguyên. Logging có observer effect/có thể tự lỗi; env-file guard không phải sandbox tổng quát, không suy absolute side-effect guarantees từ metadata.
- Gate native/libsql/KPI-timeout/Node0TBvisual-timing/Task10/Task11/release cũ vẫn riêng. Cần failing trace rồi regression/rootfix và uninstrumented QA mới xem xét đóng auth gate. Không branch/commit/push/deploy.

Chi tiết `docs/schema-auth-timeout-investigation.md`; plan `docs/superpowers/plans/2026-10-30-schema-auth-trace-local.md`. Evidence private `.local/performance/schema-auth-trace-20261030/` giữ snapshots/preimages/trace rawlogs/state/JSON/runner/summary/review/scan/manifests; original mục50 thất bại không bị ghi đè hoặc đánh dấu lại thành xanh.

## 52. Card khách hàng: gói cước/CTV còn thiếu rõ nghĩa (30/10/2026, local)

- Tiếp Task11 thay vì retryauth không có failingtrace mới. Snapshot471union paths/350source-config-test paths,150dirty và1117artifact cũ, reuse WT/HEAD/index/dependencies; không bật lại3menu ẩn. Chỉ1appfile/2fixture-test/4docs, không CSSfiles/backend/API/auth/permissions/helpers/priceformatter/predicates changes.
- Mobile chỉcóprice label `Chưa có tên gói`, không renderfake-name`---`,0đ vẫn hiện; package+price cùngrỗng vẫnnostrip. MissingCTV `Chưa có`/title `Chưa có mã CTV`, không suy assignment/status. Whitespace/literal`---`/rawnames/code vẫn dữ liệu; full-data subtrees/actions/links/roles/copy/node-disabled/flags/phone-account hints vàdesktop nguyên.
- **RTL RED13fail10pass→GREEN23/23**. BrowserV1after metadata đúng nhưng6missingCTVcase ở390rootfont200 bị clip; diagnostic computednowrap/hidden/ellipsis box69.97px/range99.23px. Thêm wrapregression RED1fail23pass, onlymissingCTV inlinewhiteSpace normal/overflowWrap anywhere; suppliedcodes không override.
- GREEN-V2 còn1testfail do expectReactphải xóa styleattr sau rerender, thực tếstyle="" đãclear. Giữ candidateV2/app/test/failure và đốichiếuinstalledReactsetValueForStyles; chỉ đổi assert hai styleproperties empty, không app/tolerance/matcher thayđổi. **FinalGREEN-V3 24/24**; tests cover6variant/null/empty/zero/negative/decimal/name-only/verbatim/whitespace/literal/3roleprops/flags/rerender/desktop.
- ChromeV2 actualSSR/CSS/syntheticloadedprops/fakeADMIN,96case6variant×6width×2theme+24root-font200%390/1440: before80DOMmetafail(40mobile/40hidden)→WTafter96/96/0fail. Missinglabel/CTV textfits,44px/horizontalcontrols/nonsubmit; rawdesktopDOM/geometry96(48visible48hiddenzero), completecard16(8mobile8hiddenzero) unchanged, stylesheet hashes same. Không canonicalize/nới geometry hoặc gọihiddenzero/propsrole/rootfont làauth/fullappE2E/device/zoom/speed acceptance; parentxem390before/after PNG.
- **Worktree và primary chạy riêng đều đạt47file/787scoped test+22policy**, full TypeScript nonincremental đạt; lint0error/3warning cũ, mỗi root ChromeV2after96/96case. Primarycurrentbatch là uninstrumented sau sourcechange52, không traced51 hoặc retryunchanged để lấy xanh. Không cộng lượt/gọiselectionfullnative/build hoặc thay primarybằngfocused/browser/reviewer. Freeze3hash/exact-scope kiểm JSX tối thiểu/samefixture/CSS/app nguyên qua assertcorrection; không sửa candidate saufreeze.
- Review static độc lập APPROVE spec trước quality3hash; source/docs integration có backup/preimage/whitespace/default secret scan không finding, finalguards kiểm471snapshot paths/350source-config-test paths, inventories,150thay đổi cũ/1117artifact cũ vàHEAD/index/buildId. Chỉ7ownedfile, mọiAPI/auth/tests/config/app khác giữ nguyên. Extra1mẫu390dark/rootfont200 xác nhận CTV2dòng fitbox và7controls trongcardbothaxes, không suy96casefullvertical/header acceptance; parentđãxemPNG.
- Originalauthtimeout50 chưa córootcause, trace51khôngtáihiện; originalfailedQA/pendingmanifest vẫn byte-equal, không retrođánh dấu fixed khi currentbatchQA đạt. Native/libsql/KPI-timeout/Node0TBvisual-timing/Task10/Task11/browser/Production gates còn riêng; releaseReadyfalse. Không branch/commit/push/deploy/fullnative/build/dependency changes.

Chi tiết `docs/customer-missing-metadata.md`; plan `docs/superpowers/plans/2026-10-30-customer-missing-metadata-local.md`. Evidence private `.local/performance/customer-missing-metadata-20261030/` giữ snapshot/preimages/RED/GREEN/candidates/browser/SSRHTML/PNG/clipdiagnostic/hashes/exact-scope/review/QA/scans/backups/manifests; không commit env/DB/log/token/business data.

## 53. Đầu card khách hàng: tên không chồng trạng thái khi chữ lớn (30/10/2026, local)

- Tiếp Task11: snapshot475union paths/352source-config-test paths,154dirty và1233artifact cũ; reuse WT/HEAD/index/dependencies. Chỉ1CSS/2fixture-test/4docs; không JSX/code/auth/backend/roles/data/handlers/helper/font/colors/padding/breakpoint changes, không bật3menu đã bỏ. Classestrùngtên ở churn/disconnect importmodule riêng không bị đổi.
- Không đoán lỗi từảnh52: actualprobe390/rootfont200 fakeADMIN namebox59.97px/firstglyph85.14px, giao status5.98×38px, computedheadernowrap/nameoverflowwrapnormal. Rootcauseflexmột hàng đểbadgechiếmchỗ vàtênkhôngngắttừ; nameink dọc vượtlinebox chút không tự gọi là clipping.
- Chỉ7CSSdeclarations/4existingmobileheaderrules: headerflexwrap, mainbasis12rem giữgrow/shrink, nameanywhere, statusmaxwidth100%/normal/anywhere/marginleftauto. Text/phông đầyđủ, status tự xuốnghàng/canhphải khi thiếuchỗ; không xóatên hoặc suy statusbusiness. Longstatusfixture49kýtự trongschema50; tên115trong200, không thêm statusoption/validation.
- PreservationRTL **13/13trước vàsau**, actualcomponent/rawtext-title/3roleprops/native label/callbacks/non-submit/tone/options/missingcontact/secondary/rerender/desktop; không jsdompixelhoặc giảRED. CSSRED từChromeactualSSR/CSS/syntheticprops:192case4variant×3role×6width×2theme+48rootfont200%390/1440. Before68name/44overlap/18statusfail(control0)→WTafter192/192/0all; metric có thểtrùngkhôngcộngtổngcases.
- Canonicalcard/tableDOM192giốngpreimage, chỉmapexactexportedCSStokens giữattrs/text/order/externalclasses; component/globalCSS/basefixturehash bấtbiến. Tablegeometry192(96visible96hiddenzero),18normalfont100mobileheader/card/controlsgeometry exact unchanged. Namehorizontalrange/directglyph-statusintersection/statusbounds,44pxtargetsbothaxes/nonsubmit/role-gates; không fulltextmọifield/allpage/CLS/RUM/speed/device/authE2E/browserzoom guarantee. Parentxemnormal390font200before/after vàlongstatus390font100after PNG.
- **Worktree và primary chạy riêng đều đạt48file/800scoped test+22policy**, TypeScript nonincremental đạt, lint0error/3warning cũ; mỗi root Chromeafter192/192case. Primarycurrentbatch uninstrumented sauCSSsourcechange, không traced51 hoặc retryunchanged để lấy xanh. Không cộng lượt/gọiselectionfullnative/build/appE2E hoặc lấy focused/browser/reviewer thay QAchính; freeze3hash/exactscope, không sửa candidate saufreeze.
- Review static độc lập APPROVE spec trước quality3hash; source/docs integration có backup/preimage/default secret scan/whitespace không finding. Finalguards kiểm475snapshot paths/352source-config-test paths, inventories,154thay đổi cũ/1233artifact cũ/HEAD/index/buildId, chỉ7ownedfiles; component JSX/globalCSS/fixtures tests cũ/API/auth/config/app khác nguyên. CurrentBatchPrimaryScopedPassedtrue, historicalAuthTimeoutRootCauseProvenfalse/releaseReadyfalse, originalauthfailure/pending/history giữ byte-equal.
- Original authfailure50/trace51 giữ byte-equal/rootunknown, currentQA nếuđạt khôngchứngminh authfix. Native/libsql/KPI-timeout/Node0TBvisual/timing/Task10/Task11/fullnative/build/realbrowser/release cònriêng, releaseReadyfalse. Không branch/commit/push/deploy.

Chi tiết `docs/customer-header-layout.md`; plan `docs/superpowers/plans/2026-10-30-customer-header-layout-local.md`. Evidence private `.local/performance/customer-header-layout-20261030/` giữ snapshot/preimages/glyphprobe/preservation/browser/SSRHTML/PNG/hashes/exact-scope/review/QA/scans/backups/manifests; không commit env/DB/log/token/business data.

## 54. Phân trang khách hàng: không tràn khi chữ lớn, thao tác rõ nghĩa (30/10/2026, local)

- Tiếp Task11, giữ giao diện/nghiệp vụ chính; snapshot479union paths/354source-config-test paths,158dirty và1312artifact cũ. Reuse worktree, không branch/commit/push/deploy, không DB/env/auth thật hoặc bật lại3menu đã bỏ.
- Baseline Chrome80mẫu xác minh10lỗi điều khiển vượt khung ở390/rootfont200%. Vùng bấm≥44px và Tab/focus đã đạt sẵn: giữ nguyên shared styles, không thêm CSS trùng hoặc nói đã sửa lỗi không tồn tại.
- Chỉ4CSSdeclarations trong media≤768px: rowwrap và select widthauto/minwidth0/flex1 1 8rem. Khi chữ lớn, chọn số dòng và hai nút có thể tách hàng để không tràn; desktop≥769px giữ geometry. Mẫu số lớn390/font200 tăng khung243.375→325.375px có chủ đích, không cắt chữ để ép gọn.
- Root thành namednav `Phân trang khách hàng`; select có explicit name `Số khách hàng mỗi trang`, giữ title cũ; nút typebutton/names `Trang trước`/`Trang sau`. Giữ chữ Trước/Sau, options10/20/50/100, page±1, Numberlimit, disabled equality và controlledprops. Không sửa hook/caller/API/data/roles/config/dependencies hoặc tests cũ.
- Caller thật nằm ngoài form và chỉ hiện phân trang khi có khách hàng. Native form wrapper trong fixture chỉ chứng minh defensive component contract (baseline64submit), không phải lỗi submit của caller production. Select trước sửa đã có accessible title, focus hiện có giữ nguyên.
- **RTL RED5fail/14pass→GREEN19/19**, kiểm tên, click/Enter/Space, boundaries, numeric callbacks, options/info/title, rerender và Tab bỏ qua nút disabled. Không thêm aria-live báo tải xong theo pageprop vì SWRkeepPreviousData có thể còn rows cũ; refreshing badge/URLfilter là scope sau.
- **Chrome actual-component SSR/CSS: WT và primary mỗi root80/80**, gồm5variant×6width×2theme=60 +20rootfont200%390/1440. Before10layout/80new-semantic-contract/64synthetic-formfail→after0, targets/focus trước/sau đều0fail; các số lỗi có thể trùng mẫu. Values/options/text/disabled80 và geometrydesktop40 unchanged. Native trusted click64mẫu enabled,16singlepage không click; React callbacks do RTL kiểm, không hydration.
- Parent đã xem ảnh390 trước/sau số lớnfont200 và sau sửa font100; select100/trang sau sửa vừa khung. Rootfont scaling không phải browserzoom/device; fixture SSR không phải toàn app/authE2E/Nextbuild/SWRnetwork/realdata/native-popup-paint/screenreader/CLS/INP/p95 hoặc speed acceptance.
- **QA fresh riêng WT và primary:49file/819scoped test +22policy đều đạt**, TypeScript nonincremental đạt, ESLint0error/3warning cũ. Không cộng lượt, không gọi selection là full native, không lấy focused/browser/reviewer thay primary. Không đổi timeout/pool/assertion/mock/config để lấy xanh.
- Review static độc lập APPROVE spec trước quality đúng4whole-file hashes; parent exact-scope chứng minh chỉ root/attributes JSX và4mobileCSSdeclarations, CSSheader53/hooks/caller/globals/fixtures-tests cũ/app khác giữ nguyên. Source/docs integration có preimage/backup, whitespace/default secret scan và finalguards kiểm snapshot/inventories/old dirty/evidence/HEAD/index/BUILD_ID; chỉ8ownedpaths, progress append-only.
- Current-batch primary scoped đạt **không sửa lại lịch sử**: original authfailure50/pendingmanifest và trace51 byte-equal, nguyên nhân timeout vẫn chưa chứng minh. Native Windows/libSQL/KPI-timeout/Node0TBvisual-timing/Task10/Task11/fullbrowser/release còn riêng, `releaseReady:false`. Chưa push/deploy.

Chi tiết `docs/customer-pagination-controls.md`; plan `docs/superpowers/plans/2026-10-30-customer-pagination-controls-local.md`. Evidence private `.local/performance/customer-pagination-controls-20261030/` giữ snapshot/preimages/RED/GREEN/browser/SSRHTML/PNG/frozenhashes/exact-scope/review/QA/scans/backups/manifests; không commit env/DB/log/token/business data.

## 55. Khách hàng: giữ dữ liệu khi tải lại, báo lỗi và thử lại đúng ngữ cảnh (30/10/2026, local)

- Tiếp Task11 sau phân trang54. Snapshot483union paths/356source-config-test paths,163dirty và1396artifact cũ; reuse worktree, không branch/commit/push/deploy, không DB/env/auth thật, không bật3menu đã bỏ.
- Xác minh installedSWR: previous data vẫn có nhưng keymới chưa cache có thể isLoadingtrue. Hook cũ làm page hiện skeleton dù rows còn; page cũng bỏ qua error, có thể báo Chưa có khách hàng khi request lỗi. Tái hiện bằng hook/page/SWR thật với deferred fetch giả, không đoán do SQL/network chậm.
- Chỉ tách hasData/loading/refreshing, so đủ7raw/debounced filters để báo chờ ngay cả khoảng500/300ms. Giữ nguyên API key/params/encoding/verbatim search, fetcher/error, delay/SWRoptions/cache/mutate, page/limit/reset/selection/fixedFilters và phân quyền. Rows không bị thay bằng skeleton khi có data; cachedempty vẫn là data.
- Có strip Đang cập nhật danh sách, nhắc dữ liệu đang hiện có thể chưa khớp filter/trang mới. Initialerror hoặc staleerror có Thử lại, không đưa rawbackenddetail lên UI; khi pending/error không khẳng định kết quả mới là rỗng. Namedregion/aria-busy chỉ ở list, status/error nằm ngoài. Không live-success dựa trên pageprop hoặc đổi các thao tác trên rows.
- Manual retry giữ page/limit/filter; guard theo context và attempt identity chống click trùng, retry cũ không chặn filter mới hoặc finally cũ xóa guard mới. Không clear data/filter, không success toast hoặc thêm retry policy/timeout; giữ automatic retry mặc định của SWR ngoài wrapper test.
- TDD22case **RED21fail/1pass→GREEN22/22**; bổ sung race retryA pending, filterB lỗi và retryB bị guard boolean khóa: **RED1fail/22pass→GREEN23/23**. Kiểm đủ7debounces, previous/empty, manualerror, stale page reply, limits/reset/selection/fixedFilters, initialHTTP/networkerror, same-rowDOM, status ngoài busylist và3roleprops. Mock transport/session/router/currentuser, không mock hook/SWR; tắt error auto-retry chỉ trong isolatedtestwrapper, không productionconfig.
- Chromev1 fixture lỗi routeralias0case, không appRED. V2 chạy96case phát hiện24retry-targetfail ởfont100%, chiều cao390 là40.796875px. Giữ4filecandidatev1/review/QA/hashes/reports; candidatev2 chỉ thêm queryErrorclass và2scopedmin44declarations. Không đổi globalbutton/CSS cũ hoặc nới phép đo.
- Chromev3 đạt geometry/state nhưng PNG mờ vì animation slideUp350ms còn chạy; V4 chờ finite animation thật kết thúc, loại spinner vô hạn và assert opacity1/transformnone. Không sửa app/disableCSS/sleep tùy ý; giữ V1–V3. **WT và primary V4 mỗi root96/96**:6states×6width×2theme=72 +24rootfont200%390/1440;48mobile/48desktop-tablet, feedback/text/retry44px/busy/rows/no falseempty/rawdetail/pageoverflow đều đạt,0pageerror/request ngoài. Parent xem ảnh V4 initialerror390font100 và refreshing390font200.
- **QA candidatev2 fresh riêng WT và primary:50file/842scoped test +22policy đều đạt**, full TypeScript nonincremental đạt, ESLint0error/3warning cũ. Không cộng lượt, không gọi selection là fullnative, không dùng focused/SSR/reviewer thay primary hoặc đổi deadline/pool/oldassertions/mocks/config/deps để lấy xanh.
- Review static độc lập spec trước quality APPROVE đúng4hash-v2; parent exact-scope kiểm chỉ feedback/retry/emptyguard/derivedstate và3newCSSselectors. Mọi oldCSS/header53/pagination54/CustomerTable/CRUD/import/export/roles/API/auth và tests cũ nguyên. Source/docs tích hợp có preimage/backup/whitespace/default secret scan, finalguards kiểm snapshot/inventories/HEAD/index/oldBUILD_ID và8ownedpaths; progress append-only,163dirty/1396artifact cũ bảo toàn.
- FixtureSSR không dùng realSWR/hydration/auth/DB/API; lifecycle do RTL realSWR kiểm riêng. Roleprops/rootfont không phải serverauth/device/browserzoom/screenreader/axe/fullapp visual acceptance; không before-after browsergeometry claim cho toànpage hoặc chứng minh giảm latency/CLS/INP/p95. Strip/error có thể đổi chiều cao khi xuất hiện, chưa CLS acceptance.
- Current-batch QA đạt **không xóa gate lịch sử**: original authfailure50/pendingmanifest/trace51 byte-equal, rootcause timeout vẫn chưa chứng minh. Native Windows/libSQL/KPI-timeout/Node0TBvisual-timing/Task10/fullTask11/build/realbrowser/release vẫn mở, `releaseReady:false`. Chưa push/deploy. URLwhitelist/back-forward/filtercontext là bước tiếp theo riêng.

Chi tiết `docs/customer-query-feedback.md`; plan `docs/superpowers/plans/2026-10-30-customer-query-feedback-local.md`. Evidence private `.local/performance/customer-query-feedback-20261030/` giữ snapshots/preimages/RED/GREEN/race/candidate-v1/reviews/frozenhashes/QA/exact-scope/browserV1–V4/SSRHTML/PNG/scans/backups/manifests; không commit env/DB/log/token/business data.

## 56. URL bộ lọc khách hàng: implementation local, còn gate auth timeout (30/10/2026)

- Tiếp Task11 sau55; snapshot486union paths/357source-config-test paths,167dirty và1528oldartifacts. Reuse WT/HEAD/index, không branch/commit/push/deploy, DB/env/auth thật hoặc bật lại3menu đã bỏ. Không coi batch này được nghiệm thu toàn bộ.
- Thêm parser/serializer whitelist và state/history hook opt-in `/customers`; page chỉ đổi1dònguseCustomersopts. q canonical nhận link node-map vốn có, search legacyfallback khiqvắng; giữ textUnicode/whitespace/plus. Enums đúng UI, pageinteger1..10000capAPI, limit10/20/50/100, duplicatesinvalid vềdefaults. Params lạ/hash giữ trongURL nhưng không forwardAPI hay cấp quyền; fixedFilters thắngURL/useredit.
- SSR/client initialdefaults/loading đồng nhất, readygate ngăn fetchdefault trước đọcURL. Restore atomic page/limit/rawfilters/revision/requestseed: pop khôngecho hoặc fetchquerytrộn cũ/mới; useredit trướcseedtimer bắt kịp vẫn debounce500/300ms. Chỉ ghi history khi filterssettled; page/limit riêng, không push mỗi ký tự. No-op thật không đổi thứ tựparams chỉ để tạoentry, nhưng samefilter ởpage2 vẫn resetpage1 như cũ.
- NativeHistorynullstate dùng patchNext sẵn có, không tự sửa privateflags/tree hoặc routerpush mỗi filter. Pathguard không kéo người dùng về customers sau khi đã rời trang; cleanupsubscription, historywrite bị browserrefuse không crashUI (chưa có cảnh báo persistence riêng). Từ khóa có thể chứaPII trongURL, không log/analytics/tự share; cần cẩn thận khi gửilink.
- Testmới dùng realhook/page/SWR +deferredfetch giả. RED49 đầu có testsetup timeout/actpollution vì giả định URLseed, giữlog và sửa precondition; correctedRED50=13fail37pass. GREEN đầu mới lộ testno-op sai kỳ vọng resetpage2: request-countprobe xác minh hành vi cũ hợp lệ, chỉ sửa case vềpage1 và thêm preservationcasepage2→1. ReorderhistoryRED1fail51pass→**finalGREEN52/52**; không oldtest/assertions/config/deadline/pool changes.
- NativeChromev1 harness thiếu react-dom root prebundle/createPortal,12scenario chưa mount được vàtimeout; giữreport/moduleerrors, không gọi là appNext bug. V2 chỉ privateoptimizerinclude/failfast, app5hash khôngđổi. **WT và primary V2 mỗi root12/12scenario×11steps (132steps/lượt)**,3roleprops×390/1440×lightdark:deep-link/reload/search/page/limit/Back2/Forward2/reload/back-during-edit, không defaultunfiltered request, hash/from giữ vàunknownparams khôngforward,0pageerror/requestngoài. Parent xemPNG390/1440 saufiniteanimation. Browserclient realpage/hook/SWR nhưng fakeauth/transport, khôngNextAppRouter/SSRhydration/serverauth/fullapp/latency acceptance; RTLadvance500 kiểm late-debounce riêng.
- **Gate broad QA chưa đạt ở cả WT và primary: mỗi root893pass/1fail trên894test**, cùng GETusers401 trong schema-auth-order timeout5000ms. Policy22/TypeScript nonincremental đạt, ESLint0error/3warning cũ mỗiroot. Primaryfresh sau sourcechange, không rerunWT đếnkhi xanh. Không skip/quarantine/nới deadline/pool/mocks/oldassertions hoặc lấy52focused/staticreview/nativebrowser thay broadgate; nguyên nhân chưa chứng minh.
- Review static độc lập spec→quality APPROVE đúng5hash chỉ implementation; parent exact-scope giữ fetcher/APIURL/SWRoptions/selection/refresh/CRUD/roles/auth/backend/CSS/shared useDebounce và tests cũ nguyên. Source được lưu local có preimage/backup/default secret scan/whitespace/hash-inventory guards với **pending disposition**, không waive failure hoặc đánh dấu gate xanh. Docs/finalmanifest ghi cả failureSHA, currentBatchWorktreeScopedPassedfalse/currentBatchPrimaryScopedPassedfalse/currentBatchScopedAcceptancePassedfalse/releaseReadyfalse.
- Original authfailure50/pending/trace51 và1528artifact cũ giữ byte-equal; lỗi mới56 giữ độc lập, không xóa lịch sử vì run khác từng pass. Native Windows/libSQL/KPI-timeout/Node0TBvisual-timing/Task10/fullTask11/Nextrealbrowser/release vẫn riêng. **Ưu tiên tiếp theo: điều tra test GETusers đang tái hiện để đóng gate, không tiếp tục thêm UI nhằm lờ lỗi đỏ.** Chưa publish.

Chi tiết `docs/customer-url-state.md`; plan `docs/superpowers/plans/2026-10-30-customer-url-state-local.md`. Evidence private `.local/performance/customer-url-state-20261030/` giữ snapshots/preimages/RED/GREEN/probes/frozen5hash/review/QA/nativebrowserV1–V2/PNG/scans/backups/scope/pending/finalmanifests; không commit env/DB/log/token/business data.

## 57. Điều tra timeout GET users: chưa tái hiện, chưa sửa auth (30/10/2026, local)

- Tiếp ưu tiên56, không thêmUI để lờ failedgate. Snapshot491union paths/360source-config-test paths,172dirty và1587old artifacts; reuseWT, không branch/commit/push/deploy/build mới, DB/env/auth thật. Chỉ4docs public, application code/publictests/config/deps không đổi.
- Source test tính cả dynamicimport trong5000ms trước khi gọi handler; GET kiểm auth trước schema/DB. Chưa có bằng chứng import/handler/scheduling hay module cụ thể gây lỗi cũ; không dời import khỏi budget/nới deadline/đổi pool/mocks/assertions/resetModules hoặc skip để lấy xanh.
- Một broadbodytrace cùng selection56:51file/894PASS,395events/53invocations/61hooktriples; GETusersimport385.29ms/handler7.81ms, không tái hiện. Readonlymodulemap10module nhưng totalTimefieldabsent (internaldurationkhác), không suy tổng hoặc0. In-memory transform/stdout có observer effect.
- Loaderprofiler không transform thân test, buffer targetspans tới afterAll. V1privatecrossdrive setup /@fs không resolve36jsdomsuite:325testpass/36suitefail, workloadinvalid giữ riêng. V2cùngsetup trong ignoredWT/.local:894PASSnhưng configmerge originalsetup2lần; giữrunner/setup/config/logs, không exactbaseline/acceptance.
- V3chỉappend privatesetup, preflightkhông chạytest vàworker đều original1+private1/5000ms/forks/isolate unchanged. **51file/894PASS**, target315.56ms;6nestedspan, root evaluator244.20ms, user.schema131.97ms có zod120.36ms. Không cộng nestedwall hoặc gọi rootspan là fullimport; phần còn lại case chưa quy thuộc, không ghép handler7.81ms ở lượt khác hoặc quyZod/Next là nguyên nhân timeout.
- Privateevaluator/ALS/snapshot/continuations còn observereffect/internalAPIlimit. CPUprocesswide cumulative/ELU không per-moduleCPU hoặc productionmetrics; cleanup pending[] chỉ điểm đo, restore/flush normalcompletiononly, không guarantee khi kill/crash. Không warm/cold/p95/độổnđịnh/production-speedclaim.
- Independent staticreview APPROVE đúng5finaltoolhash chỉ chodiagnostics/conclusionsgiớihạn, không authfix/gateclosure/release; parent kiểm lại hashes/config/6spancontainment/rawlogs/snapshot. Chỉdocs có preimage/backup/whitespace/defaultredactedsecretscan và hash/inventory/HEAD/index/oldBUILD_ID guards; tiếnđộ append-only,172dirty/1587artifacts cũ bảo toàn.
- **Chưa sửa được lỗi auth.** Các validdiagnostics không tái hiện; original56WT/primary mỗi893pass1fail/894 vẫn failed và manifest/logs byte-equal, historical50/trace51 cũng nguyên. `originalFailureRootCauseProven:false`, `currentBatchScopedAcceptancePassed:false`, `releaseReady:false`. Không dùng894instrumentedPASS thay uninstrumentedacceptance, không xóa hay ghiđè failure/bảnphântíchV2;57summaryfinal phân biệt rõV1/V2/V3.
- Bước tiếp: cần failingtrace đủ bằng chứng rồi regressionRED/sửa tốithiểu/review/freshuninstrumented WT+primaryQA; không rerun vô hạn tới xanh. NativeWindows/libSQL/KPI-timeout/Node0TBstrictvisual-timing/Task10/fullTask11/NextAppRouter-hydration/3role-staging/release vẫn mở. Chưa publish.

Chi tiết `docs/schema-auth-timeout-repro.md`; plan `docs/superpowers/plans/2026-10-30-schema-auth-timeout-repro-local.md`. Evidence private `.local/performance/schema-auth-timeout-repro-20261030/` giữ snapshots/preimages/bodytrace/loaderV1–V3/configpreflight/archivedV2tools/summaryfinal/review/scan/backups/integration/pendingmanifests; không commit env/DB/log/token/business data.

## 58. Dọn ba warning cũ, đối chứng auth không gắn worker profiler (30/10/2026, local)

- Snapshot493union paths/360source-config-test paths/174dirty và1624old artifacts; reuseWT, không branch/commit/push/deploy/build mới, DB/env/auth thật. Không thêmUI/bật3menu đã bỏ hoặc sửa auth theo suy đoán.
- Đối chiếu runners và installedVitest RPC: coordinator tự ghi fetch durations. Một lượtWT cùng selection56, chỉ đọc state sau startVitest trả về, không thêm setup/plugin/reporter/evaluatorpatch: **51file894/894PASS**, GETusers503.34ms/retry0, originalsetup1/5000ms/forks/isolate unchanged. Không rerun tới xanh; logs/config/cases/metadata giữ riêng.
- URL-level RPCfetchaggregate users48.33ms/user.schema41.64ms/next1.70ms/zod0.69ms không per-case/fullimport/handler attribution, không cộng/ghép với503.34ms hoặc đo Production. Pass không chỉ khi workerprofiler có mặt, nhưng **không chứng minh nguyên nhân hai timeout56 hoặc test không thể tái diễn**; không đọc Vitestflakyfalse thành rootproof.
- Vì chưa có failingtrace, giữauthgate mở và làm cleanup quality baseline riêng: markerRegistry capture một lần bên trong cluster effect, dùng cho writes+cleanup và giữ cgownershipguard/deps; bỏ unusedskippedRows allocation của Node0TBupload; bỏ uncalledreadSheetObjectRows helper của Nodesupload nhưng giữ SheetRow/matrix/importflows. Không đổi UI/popup/CRUD/auth/DB/date/rowparse/APIresponse/test/config/deps và không tắt lint rule.
- Testgreen894 trước refactor; sau sửa WTfocusedmap/read-only **42/42**. **FreshQA riêng WT và primary mỗiroot51file894/894scoped+22policy/types nonincremental đạt; ESLint toànsrc0error/0warning với max-warnings0.** Không cộng các lượt, không gọi là fullnative/build/Next/browser/role/device/latency acceptance hoặc authfix.
- Independentreview APPROVE đúng3whole-filehash chỉ cleanup; exactscope proof đúng ba chỉnh sửa nhỏ. Source/docs có preimage/backup/defaultredactedsecretscan/whitespace/hash-inventory/HEAD/index/oldBUILD_ID guards; chỉ3source+3docs, toàntest/fixture/cấuhình và các thayđổi cũ khác nguyên; progress append-only,174dirty/1624old artifacts giữ nguyên.
- `cleanupCurrentBatchScopedAcceptancePassed:true` **không đóng auth**: `authTimeoutRootCauseProven:false`, `original56ScopedAcceptanceClosed:false`, `releaseReady:false`; cả2log893pass1fail/894 vàmanifest56/diagnostics57/historical50/51 byte-equal. NativeWindows/libSQL/KPI-timeout/Node0TBstrictvisual-timing/Task10/fullTask11/fullNext3role/CI-RUM-rollout vẫn mở, chưa publish. Cần failingtrace đủ bằng chứng rồi mới authregression/sửa/QA, không nới deadline/skip/pool đổi để lấy xanh.

Chi tiết `docs/schema-auth-timeout-repro.md` follow-up58; roadmapTask13. Evidence private `.local/performance/schema-auth-coordinator-trace-20261030/` giữ snapshot/preimage/coordinatorcontrol/rawstate/summary/cleanupscope/focused/QA/review/source-docsscans/backups/integration/pending; không commit env/DB/token/log/businessdata.
