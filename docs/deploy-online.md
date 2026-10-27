# Đưa KpiDiLinh lên database online và Vercel mới

Ngày chuẩn bị: **26/10/2026**. Đây là hướng dẫn triển khai; trạng thái tạo database, nhập dữ liệu và deploy chỉ được đánh dấu hoàn tất sau khi thực hiện và xác minh.

## 1. Phương án cho bản hiện tại

- Mã nguồn: repo `dangquocviet2612-del/KpiDiLinh`.
- Database mới: Turso tương thích SQLite/libSQL, phù hợp với `@prisma/adapter-libsql` đang dùng.
- Hosting: Vercel project mới `kpidi-linh`, hiện deploy trực tiếp bằng CLI; chưa kết nối tự động deploy từ repo KpiDiLinh.
- Bản local tiếp tục dùng `data/kpidi-linh.sqlite`; đặt cấu hình online riêng trong Vercel.

Mã nguồn đã được commit và push lên nhánh `main` của GitHub KpiDiLinh. Database Turso mới đã được nhập và xác minh 25 bảng; web Production đã triển khai tại **https://kpidi-linh.vercel.app**. Chưa kết nối tự động deploy từ GitHub với Vercel.

**Phân biệt local và live:** các kết quả triển khai trong tài liệu này thuộc release Production cũ, có build kèm migration. Batch LOCAL đã tách `build` thành `next build` duy nhất và giữ `db:migrate` là `node scripts/migrate.mjs` để gọi riêng; batch này đã kiểm thử local, chưa commit/push/deploy. Production vẫn chạy release cũ, không tự nhận thay đổi local; kết quả local ở mục 16 của `tiendokpi.md`.

Batch3 LOCAL tiếp tục thay toàn bộ runtime `ensure` có DDL bằng guard chỉ đọc column/PK/unique và sự hiện diện của default bắt buộc. Migration thứ 5 `20261026000000_runtime_schema_readiness` thêm 6 index không trùng và 3 dòng default bằng `ON CONFLICT DO NOTHING`, không sửa 4 SQL lịch sử. Không đọc hoặc thay đổi SQLite phục hồi/Turso thật trong batch này; các kết quả local không xác nhận readiness hay độ trễ cloud của Production.

## Trạng thái đã thực hiện (release Production cũ)

- Database đích: `kpidi-linh-dangquocviet2612-del.aws-ap-northeast-1.turso.io`.
- Xác nhận database trống trước khi nhập, sau đó nhập schema/index và dữ liệu bằng SDK theo từng lô nhỏ trực tiếp từ máy Windows.
- Đã đối chiếu 25 bảng, tổng 133.752 bản ghi, bằng số dòng và checksum dữ liệu; kiểm tra toàn vẹn và khóa ngoại đạt.
- Bản local cổng 3000 vẫn dùng SQLite riêng; một bản thử dùng database online đã được dùng để kiểm tra đăng nhập/API.
- Báo cáo và trạng thái nhập ở `.local/deployment/turso-import-report.json`, `.local/deployment/turso-import-state.json`.
- File `.local/deployment/vercel-production.env` đã có URL database, token thay thế và khóa Production mới; đã cấu hình lên đúng project mới. File người dùng điền nhầm ở gốc repo đã chuyển vào `.local/deployment/`.
- Đã đổi mật khẩu của admin từng lộ trong seed cũ **chỉ trên database online mới**; mật khẩu mới ở `.local/deployment/online-admin-credentials.txt`. Tài khoản `admin` phục hồi vẫn dùng thông tin tại `.local/admin-credentials.txt`.
- Ở lần triển khai release cũ, build Vercel có chạy migration và đã đạt; đăng nhập ADMIN, 18 trang và 15 API đã qua smoke test. Database sau migration còn nguyên số dòng 25 bảng / 133.752 bản ghi; checksum Node 0TB khớp nguồn. Đây là kết quả lịch sử, không phải xác nhận runner an toàn để chạy lại. Báo cáo chi tiết trong `.local/deployment/vercel-smoke-report.json`, `post-deploy-database-verification.json` và `tiendokpi.md`.
- **Token cũ đã gửi trong chat vẫn hợp lệ ở lần kiểm tra trước deploy.** Việc tạo token thay thế không tự thu hồi token cũ; đây là việc bảo mật còn phải xử lý, không đánh dấu hoàn tất.

Các bước bên dưới tiếp tục là quy trình triển khai/tham chiếu, không phải yêu cầu deploy batch LOCAL này. Không chạy nhập lại vào database đã có dữ liệu mà bỏ qua kiểm tra; không chạy `db:migrate` trên database đã nhập/phục hồi hoặc Production.

## 2. Dữ liệu chuẩn bị trên máy

Bản SQLite để chuyển dữ liệu được chuẩn bị ở:

```text
.local/deployment/kpidi-linh-20261026.db
.local/deployment/snapshot-manifest.json
```

Manifest ghi checksum, số lượng từng bảng và kết quả kiểm tra toàn vẹn của bản chụp. Bản chụp được tạo nhất quán bằng `VACUUM INTO`, sau đó chuẩn bị WAL/checkpoint trên chính bản sao. Database đang dùng không đổi đường dẫn.

Đối chiếu số lượng database online theo manifest sau khi nhập. Nếu tiếp tục nhập/sửa dữ liệu ở local sau thời điểm tạo bản chụp, cần quyết định thời điểm chốt và tạo lại bản chụp trước khi chuyển chính thức; dữ liệu không tự đồng bộ.

Không đưa file SQLite, backup JSON, token hoặc thư mục `.local/` lên GitHub.

## 3. Database Turso mới

1. Đăng nhập tài khoản Turso của bạn tại `https://turso.tech`.
2. Dùng database SQLite/libSQL mới dành riêng cho KpiDiLinh. Tên gợi ý: `kpidi-linh`; không dùng database của web cũ.
3. Nếu tạo database trống trên dashboard, lưu URL `libsql://...` và token có quyền đọc/ghi vào file riêng:

   ```text
   D:\code\webkpimoi\.local\deployment\turso.env
   ```

   File này có hai biến: `DATABASE_URL` và `TURSO_AUTH_TOKEN`. Không gửi token qua chat.

4. Kiểm tra kết nối và trạng thái trống trước khi nhập. Không nhập đè lên database đã có dữ liệu khi chưa đối chiếu.
5. Chuyển dữ liệu trực tiếp từ máy lên Turso, rồi kiểm tra số bảng, số dòng, quan hệ và đăng nhập.

Nếu dùng Turso Cloud CLI đã đăng nhập, tài liệu chính thức hỗ trợ tạo database từ file SQLite:

```text
turso db create kpidi-linh --from-file <duong-dan-ban-sao-SQLite>
```

Lệnh này tạo database mới; không chạy tạo trùng tên database đã có trên dashboard. Cách nhập vào database trống đã tạo cần được chọn sau khi kiểm tra kết nối. Trên Windows, tài liệu CLI yêu cầu WSL; không chạy hướng dẫn cài đặt Bash trực tiếp trong PowerShell. Việc cài CLI/WSL chưa được thực hiện.

Nguồn: [Turso db create](https://docs.turso.tech/cli/db/create), [Turso CLI trên Windows](https://docs.turso.tech/cli/installation), [Chuẩn bị SQLite và nhập vào Turso](https://turso.tech/blog/migrating-and-importing-sqlite-to-turso-just-got-easier).

## 4. Mã nguồn GitHub

Trước commit đầu tiên:

- Kiểm tra file sẽ đưa lên Git và chạy secret scan.
- Giữ `.env`, `.local/`, `data/`, file backup và thông tin đăng nhập ngoài commit.
- Tạo commit trên repo mới, sau đó push nhánh `main` tới `https://github.com/dangquocviet2612-del/KpiDiLinh.git`.

Đã commit/push nhánh `main` ngày 26/10/2026, với [commit source đầu tiên `1f0d456`](https://github.com/dangquocviet2612-del/KpiDiLinh/commit/1f0d45618a760d1a5752b2eb2ad93a02e1d72c02). Trước push đã kiểm tra file riêng tư, quét Gitleaks và chạy lại 126 test/TypeScript; xem mục 13 của `tiendokpi.md`. Web vẫn được triển khai trực tiếp bằng Vercel CLI; chưa có tự động deploy từ GitHub.

## 5. Tạo Vercel project mới

Project `kpidi-linh` đã được tạo và triển khai trong scope `vietdq9` bằng Vercel CLI; không cần tạo lại. Repo đã có source trên GitHub; các bước Dashboard bên dưới là tham chiếu khi kết nối repo với Vercel hoặc khi tạo một project khác.

1. Đăng nhập `https://vercel.com` bằng tài khoản có quyền truy cập repo mới.
2. Chọn **Add New / Project**, import repo **KpiDiLinh**.
3. Framework: **Next.js**. Root Directory: gốc repo. Build command: `npm run build`. Release Production cũ được build với migration; chỉ source đã áp dụng batch LOCAL mới có script `build` là `next build` duy nhất. Không deploy source build cũ vào database đã nhập/phục hồi để thử lại.
4. Đặt biến môi trường cho Production trước khi deploy:

| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | URL Turso mới; không dùng đường dẫn `file:` trên máy |
| `TURSO_AUTH_TOKEN` | Token đọc/ghi của database mới |
| `AUTH_SECRET` | Khóa ngẫu nhiên riêng cho web mới |
| `AUTH_URL` | URL HTTPS chính thức của deployment mới khi đã xác định; không đặt `localhost` |
| `CRON_SECRET` | Khóa riêng cho cron của project mới |
| `ARCHIVE_CRON_SECRET` | Khóa riêng nếu dùng cơ chế xác thực archive tương ứng |
| `PRISMA_DEBUG` | `false` |

Trong deployment đã xác minh, `AUTH_URL` được để không cấu hình và đăng nhập hoạt động với NextAuth `trustHost: true` trên domain Production. Không cần đặt localhost hoặc URL deployment tạm vào Production. Chỉ pin URL HTTPS chính thức nếu cấu hình thực tế yêu cầu.

Source batch3 LOCAL bỏ tự import Excel từ GET; `NODE_0TB_DEFAULT_FILE_PATH` và `CUOC_CD_DEFAULT_FILE_PATH` là tên env cũ bị bỏ qua, đã bỏ khỏi `.env.example`. Import thủ công qua Admin UI/API vẫn giữ nguyên. Không thay env deployment đang chạy trong batch local này. Các API setup/seed không cần được mở để nhập dữ liệu vì tài khoản đã có trong database phục hồi.

Không dùng chung database Production cho Preview, kể cả sau khi áp dụng batch3 LOCAL: guard mới không ghi DDL/seed nhưng các thao tác nghiệp vụ và cron vẫn ghi dữ liệu. Tách migration khỏi build và bỏ runtime DDL không có nghĩa toàn bộ app chỉ đọc. Build của release cũ còn gọi migration, thêm rủi ro nếu dùng chung URL/token. Chỉ bật Preview sau khi cấu hình URL/token của database riêng, không dùng thông tin kết nối Production.

Trước cutover sang source LOCAL mới, cần preflight chỉ đọc trên đúng snapshot/target được phê duyệt bằng `npm run db:check-schema` (`scripts/check-runtime-schema.mjs`). Mặc định kiểm tra cả 7 domain, có thể chọn `-- --domain kpi`; phải truyền `DATABASE_URL` tường minh trong process, không tự đọc env file, không migrate/seed/adopt. Remote cần `--allow-remote` cùng phê duyệt riêng; network/UNC không hỗ trợ. Batch này không chạy lệnh đó trên target thật.

Database đủ runtime contract có thể phục vụ GET dù chưa có ledger, nhưng release apply vẫn bị chặn tới khi adoption được xác minh. Thiếu column/PK/unique/default báo `SCHEMA_NOT_READY`, không tự sửa database. Nếu thiếu, phải kiểm chứng upgrade trên bản tách riêng và owner duyệt rollout/rollback trước cutover; không replay SQL lịch sử hoặc baseline/no-op mù quáng. Xem [migration safety](migration-safety.md).

Vercel áp dụng thay đổi biến môi trường vào deployment mới; cập nhật biến sau khi deploy thì cần redeploy.

Nguồn: [Import Git repository vào Vercel](https://vercel.com/docs/git), [Environment Variables](https://vercel.com/docs/environment-variables).

## 6. An toàn dữ liệu và các giới hạn còn lại

- Đã đổi đúng một mật khẩu admin cũ từng lộ trong lịch sử Git trên database mới; web cũ và SQLite local không bị thay đổi mật khẩu. User checksum sau đổi mật khẩu không còn giống bản nhập; chỉ hai trường `password` và `updatedAt` của một dòng được thay có chủ đích.
- Đã đối chiếu dữ liệu online với `snapshot-manifest.json` sau build: 25 bảng / 133.752 bản ghi; Node 0TB khớp toàn bộ checksum và không có vi phạm khóa ngoại.
- Cần thu hồi token cũ đã gửi trong chat. Lệnh Turso `db tokens invalidate` có thể vô hiệu hóa token của **cả group**, không chỉ token cũ hoặc riêng một app. Xác minh database nào dùng chung group trước khi thực hiện; chuẩn bị thay token cho các app bị ảnh hưởng và redeploy Vercel sau cập nhật. Không tự vô hiệu hóa toàn group khi chưa biết tác động. Nguồn: [Turso invalidate tokens](https://docs.turso.tech/cli/db/tokens/invalidate).
- Kiểm tra ảnh/tệp đính kèm cần lưu bền vững; file ghi vào ổ đĩa của Function không thay thế được kho lưu trữ dữ liệu lâu dài.
- Kiểm tra cron trong `vercel.json`: `/api/archive/cron` có lịch `0 2 * * *`; endpoint có thể purge dữ liệu archive hết hạn khi được xác thực.
- Batch LOCAL đã tách `npm run build` thành `next build`; đây chưa phải cấu hình của release Production đang live. Không tự chạy migration trước build/test/lint.
- `db:migrate` vẫn gọi `node scripts/migrate.mjs`, nhưng wrapper local mới đã thay runner replay bằng check mặc định và apply tường minh với ledger/checksum/write transaction. Không auto-load env file; remote cần opt-in. Database đã nhập/phục hồi chưa có ledger được adoption sẽ bị từ chối trước ghi; **không tự baseline hoặc thử apply trên Production**. Xem `docs/migration-safety.md`; rollout/adoption thật chưa được thực hiện.
- Backup kiểm tra cấu trúc riêng với full runtime readiness, cho phép phục hồi backup cũ thiếu default. Chỉ POST restore được cấp quyền mới bổ sung 3 dòng default bắt buộc sau các dòng phục hồi trong transaction hiện có bằng `ON CONFLICT DO NOTHING`; không seed trên GET, không ghi đè rate tùy chỉnh hoặc bật lại `CUOC_N1_N3_RATE` đã tắt. JSON backup v10 vẫn không chứa ledger; restore không xác lập adoption.

Backup JSON đã phục hồi khoảng 73 MB. Vercel Functions có giới hạn payload request 4,5 MB, nên không dùng trang restore trên Vercel để tải nguyên backup này lên. Cấu hình `proxyClientMaxBodySize: "64mb"` trong Next.js không nâng được giới hạn của nền tảng Vercel. Nhập dữ liệu trực tiếp vào Turso từ máy.

Upload công văn hiện lưu dữ liệu base64 trong database (`src/lib/official-doc-assets.ts`), nhưng API nhận file vẫn đi qua Function. Giới hạn trong source cho phép 20 MB hoặc 200 MB tùy loại không đảm bảo upload được file đó trên Vercel; chưa thực hiện thử upload trong smoke test này.

Nguồn: [Vercel FUNCTION_PAYLOAD_TOO_LARGE](https://vercel.com/docs/errors/function_payload_too_large). Các hành vi build/cron nêu trên được đối chiếu với `package.json`, `scripts/migrate.mjs`, `vercel.json` và `src/app/api/archive/cron/route.ts` của repo.

## 7. Xác minh sau triển khai

Đã hoàn thành smoke test ADMIN và các API đọc dữ liệu ngày 26/10/2026, không thay thế kiểm thử UI đầy đủ. Checklist cần tiếp tục:

- Đăng nhập Admin/Manager/CTV và kiểm tra phạm vi dữ liệu.
- Xem khách hàng, tài khoản, bản đồ node, Node 0TB và báo cáo KPI gần nhất.
- Kiểm tra các báo cáo cước/CDT/rời mạng và công văn.
- Kiểm tra import/export theo giới hạn file của hosting; không coi mọi file chạy local là mặc nhiên upload được trên Vercel.
- Kiểm tra khả năng sao lưu database online và phục hồi thử trên bản riêng.
- Ghi URL mới, database đích, thời điểm và bằng chứng kiểm tra vào `tiendokpi.md`.

URL sử dụng: **https://kpidi-linh.vercel.app**. Các URL deployment/alias phụ có thể được Vercel Authentication bảo vệ; không tắt toàn bộ lớp bảo vệ để xử lý nhầm URL. Source, database local, backup và token đã được lọc bằng `.gitignore`/`.vercelignore`; không commit thư mục `.vercel/`, `.local/`, `.env.local` hoặc file `*.env`.

Sau khi chốt chuyển sang web mới, dữ liệu phát sinh tiếp ở web cũ hoặc SQLite local **không tự đồng bộ** vào Turso mới. Giữ backup cũ và quyết định một nơi nhập dữ liệu chính để tránh phân tán dữ liệu.
