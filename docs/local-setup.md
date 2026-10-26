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

```powershell
npm.cmd run db:migrate
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Lệnh build hiện cũng chạy migrations. Kiểm tra `DATABASE_URL` trước khi chạy trên môi trường khác. Không dùng `prisma migrate reset` để chạy thử vì lệnh đó xóa dữ liệu.

## Chuyển sang web online sau này

SQLite này dành cho chạy trên máy. Khi triển khai online, cần tạo database online riêng, đặt URL/token trong cấu hình của nền tảng triển khai và chạy migrations trên database mới. Database local không tự được chuyển lên GitHub hoặc lên host.
