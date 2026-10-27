# Chạy KpiDiLinh trên máy

## Cấu hình hiện tại

- Thư mục dự án: `D:\code\webkpimoi`.
- GitHub: `https://github.com/dangquocviet2612-del/KpiDiLinh.git`.
- SQLite riêng: `data/kpidi-linh.sqlite`.
- `.env` trỏ bằng đường dẫn tuyệt đối tới SQLite này; không sử dụng token Turso.
- Database đã được phục hồi từ bản sao lưu của `https://cumtomer.vercel.app` ngày 26/10/2026.
- Admin local: `admin`. Mật khẩu ngẫu nhiên được lưu trong `.local/admin-credentials.txt`.

## Dữ liệu đã phục hồi

- Giữ 33 tài khoản từ web cũ cùng password hash và phân quyền; giữ thêm admin local, tổng cộng 34 tài khoản.
- 200 khách hàng, 2.420 node, 138 Node 0TB và 25.983 mapping Account - Node.
- 69.961 dòng KPI cá nhân, 6.151 dòng KPI quản lý, dữ liệu cước, CDT, tồn CDT và rời mạng theo backup.
- Bản backup JSON gốc và báo cáo đối chiếu nằm trong `.local/backups/`.
- SQLite trước phục hồi được giữ tại `.local/backups/local-before-web-restore-20261026.sqlite`.

Đây là bản chụp dữ liệu tại thời điểm xuất. Dữ liệu phát sinh sau đó trên web cũ không tự đồng bộ về máy. Backup phiên bản 10 không chứa hai bảng `AuditLog` và `OfficialDocumentTempAsset`; các bảng này không được coi là đã phục hồi. `EditHistory` và ghi chú khách hàng có trong backup đã được phục hồi.

## Chạy app

Với source batch3 LOCAL, cần preflight runtime contract trước khi cutover database hiện có theo mục bên dưới. Các guard thay runtime DDL chỉ đọc column/PK/unique và kiểm tra sự hiện diện của default bắt buộc; thiếu contract báo `SCHEMA_NOT_READY`, không tự sửa database. Database đủ contract có thể phục vụ GET dù chưa có ledger; điều đó không cho phép apply migration.

Mở PowerShell:

```powershell
Set-Location D:\code\webkpimoi
npm.cmd run dev
```

Truy cập `http://localhost:3000/login`, lấy mật khẩu từ file local ở trên và đổi mật khẩu sau khi đăng nhập.

## Giữ dữ liệu local riêng tư

`.env`, thư mục `data/`, `.local/`, các file SQLite và khóa riêng đều bị loại khỏi Git bởi `.gitignore`. Chỉ `.env.example` là file mẫu có thể đưa lên GitHub. Không dùng `git add -f` cho các file riêng tư.

GitHub lưu mã nguồn. Database SQLite và file upload cần được sao lưu riêng. Dừng app trước khi sao chép toàn bộ thư mục `data/`; giữ bản sao ngoài thư mục dự án.

## Migrations và build

**Chỉ LOCAL, chưa commit/push/deploy:** `build` chỉ chạy `next build`. Batch3 đã thay toàn bộ runtime `ensure` có DDL bằng guard chỉ đọc. Migration thứ 5 `20261026000000_runtime_schema_readiness` thêm 6 index không trùng và 3 default bằng `ON CONFLICT DO NOTHING`; 4 SQL lịch sử không đổi. `scripts/migrate.mjs` gọi release runner có ledger/checksum/transaction, mặc định check. Production vẫn chạy release cũ; thay đổi local không cập nhật Production. Xem `tiendokpi.md` và [migration safety](migration-safety.md).

Database local ở trên đã phục hồi dữ liệu nhưng chưa có ledger được adoption: **không apply migration**, kể cả trước build/test/lint. Runner mới từ chối database untracked trước mọi ghi; không tự đánh dấu các version là đã chạy. Quy trình đối chiếu snapshot/schema/content checksum và owner duyệt adoption vẫn chưa hoàn thành.

`npm.cmd run db:check-schema` gọi `scripts/check-runtime-schema.mjs`: mặc định kiểm tra cả 7 domain (`kpi`, `customer`, `users`, `node0tb`, `mapping`, `node`, `documents`); `-- --domain kpi` chỉ kiểm tra KPI. Lệnh cần `DATABASE_URL` tường minh trong process, không tự đọc `.env`/`.env.local`, không migrate/seed/adopt. Remote cần `--allow-remote` và phê duyệt riêng; đường dẫn network/UNC không được hỗ trợ. Batch này không đọc hoặc thay đổi database phục hồi/Turso thật, nên chưa xác nhận readiness của các target đó.

Trước cutover, owner cần xác minh preflight trên đúng snapshot/target được duyệt. Nếu thiếu schema/default, phải kiểm chứng upgrade trên bản tách riêng và duyệt rollout/rollback; không chạy lại migration lịch sử, baseline mù quáng hay biến guard thành no-op. Preflight đạt không thay thế quy trình adoption/ledger cho release apply.

Trước khi kiểm tra local, xác nhận `scripts.build` trong `package.json` đã là `next build`, không còn gọi `scripts/migrate.mjs`. Nếu vẫn là build cũ, dừng bước build trên database phục hồi. Sau khi đã tách migration, chạy các lệnh kiểm tra riêng, không tự chèn migration trước chúng:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Chỉ với **database SQLite giả riêng**, truyền `DATABASE_URL` tường minh qua process; runner không tự đọc `.env`/`.env.local` hoặc dùng `dev.db` mặc định. Ví dụ đầy đủ check/apply/reapply nằm trong `docs/migration-safety.md`; không thay target thành bản phục hồi hay database online:

```powershell
New-Item -ItemType Directory -Path .local -Force | Out-Null
$env:DATABASE_URL = "file:.local/migration-demo.sqlite"
$env:TURSO_AUTH_TOKEN = ""
npm.cmd run db:check
npm.cmd run db:migrate -- --apply
npm.cmd run db:check-schema
npm.cmd run db:check-schema -- --domain kpi
```

Hai lệnh preflight cuối chỉ đọc database demo sau khi apply; không dùng ví dụ này để migrate bản phục hồi. Reapply chỉ an toàn đối với database đã được runner quản lý, checksum/history còn khớp; không áp dụng kết luận đó cho bản phục hồi untracked. Không dùng `prisma migrate reset` vì lệnh đó xóa dữ liệu.

## Import và phục hồi có chủ đích

GET không còn tự đọc Excel qua `NODE_0TB_DEFAULT_FILE_PATH` / `CUOC_CD_DEFAULT_FILE_PATH`; hai tên env cũ bị bỏ qua, không cần giữ biến rỗng trong template. Import thủ công qua Admin UI/API vẫn được giữ; batch này không đổi cấu hình env đang dùng của app.

Backup dùng kiểm tra cấu trúc riêng, không đòi đủ default như full runtime readiness, để backup cũ có danh sách default rỗng vẫn phục hồi được. POST restore được cấp quyền bổ sung `CuocConfig` id 1, `CuocCdConfig` id 1 và `KpiMetricConfig.CUOC_N1_N3_RATE` **sau các dòng phục hồi, trong transaction hiện có**, bằng `ON CONFLICT DO NOTHING`. Không seed trên GET, không ghi đè rate tùy chỉnh hoặc bật lại `CUOC_N1_N3_RATE` đã bị tắt. JSON backup v10 không chứa ledger; adoption sau restore vẫn là việc riêng chưa hoàn thành.

## Chuyển sang web online sau này

SQLite này dành cho chạy trên máy. Khi triển khai online, cần database riêng, URL/token riêng và quy trình preflight/upgrade/adoption/release trong `docs/migration-safety.md`; không chạy lại SQL lịch sử trên database đã nhập hoặc tự sửa ledger. Preview phải tách Production vì thao tác nghiệp vụ và cron còn ghi dữ liệu, không phải vì runtime guard mới ghi schema/seed. Database local không tự được chuyển lên GitHub/host; kết quả local không chứng minh độ trễ cloud.
