# Migration có kiểm soát — batch local

## Trạng thái

Runner và runtime guard mới chỉ được kiểm thử trên database giả. **Batch này không đọc hoặc thay đổi SQLite phục hồi/Turso thật; chưa commit/push/deploy.** Build vẫn chỉ đóng gói Next.js. Batch3 LOCAL đã thay toàn bộ runtime `ensure` có DDL bằng guard chỉ đọc; Production vẫn chạy release cũ, không tự nhận thay đổi local.

`scripts/migrate.mjs` nay gọi runner an toàn thay vì phát lại mọi SQL rồi bỏ qua lỗi. Mặc định là **check**, không phải apply. Runner không tự đọc `.env`/`.env.local`, không chọn `dev.db` khi thiếu cấu hình; phải truyền `DATABASE_URL` tường minh trong process. Điều này không đổi cách Next.js đọc env khi chạy web.

## Runtime readiness và migration thứ 5

Guard runtime kiểm tra chỉ đọc các bảng/cột bắt buộc, PK, unique và sự hiện diện của 3 dòng default: `CuocConfig` id 1, `CuocCdConfig` id 1, `KpiMetricConfig` có `kpiCode = CUOC_N1_N3_RATE`. Guard không ép rate hoặc trạng thái enabled về giá trị mặc định. Thiếu contract báo rõ `SCHEMA_NOT_READY`, không tạo/sửa bảng/index, seed hoặc tự repair database; đây không phải no-op thay cho kiểm tra schema.

`npm run db:check-schema` gọi `scripts/check-runtime-schema.mjs`, mặc định kiểm tra cả 7 domain: `kpi`, `customer`, `users`, `node0tb`, `mapping`, `node`, `documents`. Có thể giới hạn bằng `-- --domain kpi`; đạt một domain không chứng minh cả database sẵn sàng. CLI chỉ đọc, không migrate/seed/adopt, không tự đọc `.env`/`.env.local`, cần `DATABASE_URL` tường minh trong process. Remote cần `--allow-remote` và phê duyệt riêng; network/UNC không hỗ trợ. File local không tồn tại bị từ chối, không tự tạo database.

Readiness và migration history là hai kiểm tra khác nhau: `db:check-schema` không thay thế `db:check` hoặc adoption. Database untracked đủ runtime contract vẫn có thể phục vụ GET; release apply vẫn bị chặn tới khi ledger/adoption được xác minh. Contract runtime không thay thế đối chiếu đầy đủ type/null/default/FK/index trong quy trình adoption. Trước cutover source mới, phải preflight đúng snapshot/target đã được duyệt; nếu thiếu schema/default, cần upgrade đã kiểm chứng trên bản tách riêng, không chạy migration lịch sử mù quáng.

Migration mới thứ 5 `20261026000000_runtime_schema_readiness` bổ sung 6 index không trùng và 3 dòng default trên bằng `ON CONFLICT DO NOTHING`. 4 file SQL lịch sử không thay đổi. Default chỉ được chèn khi thiếu; không ghi đè rate tùy chỉnh hoặc bật lại `CUOC_N1_N3_RATE` đã tắt. Migration này không phải lối tắt để apply vào database phục hồi chưa adoption.

GET không còn tự import Excel từ `NODE_0TB_DEFAULT_FILE_PATH` / `CUOC_CD_DEFAULT_FILE_PATH`; đây là hai tên env cũ bị bỏ qua, không còn trong `.env.example`. Import thủ công qua Admin UI/API vẫn được giữ. Không đổi cấu hình env đang dùng của app trong batch này. Preview vẫn phải tách database Production vì thao tác nghiệp vụ và cron còn ghi dữ liệu, không phải vì guard mới ghi DDL/seed.

## Các hàng rào

| Trường hợp | Hành vi |
|---|---|
| Không truyền target / argument lạ | Từ chối trước kết nối |
| `--check`, file local chưa tồn tại | Báo empty/pending, không tạo file |
| `--check`, database tồn tại | Chỉ đọc catalog/ledger; không DDL, seed hay ghi ledger |
| Database đã có bảng/view nhưng chưa có ledger | Từ chối apply trước mọi ghi; yêu cầu quy trình adoption riêng |
| Empty ledger đi cùng bảng nghiệp vụ | Từ chối, không xem đây là baseline hợp lệ |
| Database mới, trống + `--apply` | Áp dụng SQL theo version, ghi `_AppMigration` trong cùng transaction |
| Chạy lại database do runner quản lý | Kiểm tra checksum, không replay version đã áp dụng |
| Checksum đổi / version lạ / ledger bị hổng thứ tự | Từ chối, không tự sửa ledger hoặc bỏ qua lỗi |
| URL remote | Cần `--allow-remote` riêng; opt-in không thay thế phê duyệt release/backup/adoption |
| Apply tới private/named in-memory database | Từ chối trước kết nối/ghi; libSQL có thể mở connection private khác giữa các version |

Ledger gồm `version`, `checksum` SHA-256 và `appliedAt`. Core API apply cũng yêu cầu target persistent tường minh, không chỉ guard ở CLI. Checksum chuẩn hóa CRLF/CR thành LF để Windows/CI không báo drift chỉ vì line endings; không sửa file SQL lịch sử. Việc thay đổi nội dung migration đã áp dụng vẫn bị từ chối. Phát hiện schema bỏ qua đúng prefix nội bộ `sqlite_`, không bỏ nhầm tên hợp lệ như `sqliteXbusiness`.

Mỗi version dùng write transaction: kiểm tra lại ledger sau khi lấy lock → DDL/data statements → ghi ledger → `foreign_key_check` → commit. Lỗi copy/drop/rename rollback cả schema, dữ liệu và ledger của **version đang chạy**. Các version đã commit trước đó vẫn còn, không phải rollback nguyên release. Chỉ retry có giới hạn cho SQLite BUSY/LOCKED; lỗi khác dừng. Nếu kết quả commit/kết nối không rõ, chạy check trước, không tự sửa checksum hay replay mù quáng.

Có một compatibility rule được giới hạn tường minh: `20260227023408_init` đã tạo `Customer.expirationDate`, nhưng `20260920000000_consolidated_schema` thêm lại cùng cột. Runner chỉ bỏ đúng statement trùng của version này khi cột hiện có khớp `DATETIME`, nullable, không default, không PK. Không bắt lỗi "already exists"/"duplicate column" tổng quát; schema khác kỳ vọng bị từ chối.

## Thử trên database bỏ đi

Chỉ dùng database local mới dưới `.local/`, không thay đường dẫn bằng database phục hồi hoặc Turso thật trong batch này:

```powershell
New-Item -ItemType Directory -Path .local -Force | Out-Null
$env:DATABASE_URL = "file:.local/migration-demo.sqlite"
$env:TURSO_AUTH_TOKEN = ""
node scripts/migrate.mjs --check
node scripts/migrate.mjs --apply
node scripts/migrate.mjs --check
npm.cmd run db:check-schema
npm.cmd run db:check-schema -- --domain kpi
node scripts/migrate.mjs --apply
```

Hai lệnh preflight chỉ đọc database demo sau apply; ví dụ này không cho phép migrate database phục hồi. Lượt apply thứ hai trên database demo đã được runner quản lý phải có `applied: []`. Hai command entry points `scripts/migrate.mjs` và `scripts/release-migrations.mjs` dùng cùng policy. Không dùng `prisma migrate reset`, không xóa database để làm test xanh.

SQL scanner hỗ trợ comment, quoted identifier/string, escape quote và dấu `;` trong chuỗi. Chưa hỗ trợ trigger hoặc SQL tự điều khiển transaction/PRAGMA/ATTACH/DETACH/VACUUM; từ chối trước thực thi thay vì chia SQL sai. Migration tương lai cần các lệnh này phải có thiết kế/test runner riêng.

## Adoption database phục hồi — chưa thực hiện

Release source-only cho bản vá bảo mật có thể tách riêng, không chạy migration, sau phê duyệt của owner và staging phù hợp. Với source batch3 đã bỏ runtime DDL, còn phải xác nhận database đủ runtime contract trước cutover; nếu thiếu, cần upgrade đã kiểm chứng, không dựa vào request để tự sửa. Chưa xong adoption không mặc nhiên chặn GET trên database đủ contract, nhưng vẫn chặn release apply. Batch hiện tại không deploy vì chỉ được yêu cầu làm local.

Không có `--baseline` tự động hoặc nút "coi tất cả đã chạy". Database phục hồi có runtime schema/index/default khác lịch sử SQL, nên tên bảng hay số dòng giống nhau không đủ để đánh dấu applied.

1. Chốt target và cửa sổ không ghi; tạo snapshot database đầy đủ và kiểm thử restore trên bản tách riêng.
2. Tạo reference database từ cùng catalog migration; đối chiếu table/column/type/null/default/PK, unique/index, foreign keys và schema runtime còn thiếu. Không clone dữ liệu cá nhân vào Git/CI.
3. Tạo manifest có fingerprint target/snapshot, checksum migration, schema diff và content checksum trước/sau. Giải thích từng khác biệt; không sửa lịch sử migration hoặc ép bỏ qua lỗi.
4. Thiết kế baseline/upgrade riêng, kiểm thử bản đã phục hồi và fault injection trên fixture. Giữ nguyên dữ liệu, quan hệ và các default nghiệp vụ, gồm `CUOC_N1_N3_RATE`.
5. Owner duyệt manifest/release/rollback rồi mới cho phép ghi ledger trên đúng target. Batch local hiện tại **chưa cung cấp thao tác adoption này**.
6. Preflight lại runtime contract trước cutover sang source mới đã bỏ runtime DDL. Nếu còn thiếu, hoàn thành upgrade đã được xác minh/phê duyệt rồi kiểm tra lại; không replay mù quáng các SQL cũ, đánh dấu baseline khi chưa đối chiếu hoặc đổi guard thành no-op.

Rollback source không phục hồi dữ liệu đã migrate. Không ghi đè snapshot lên database đang có dữ liệu phát sinh; rollback data cần kế hoạch đối soát riêng.

## Backup và kiểm thử

Kiểm tra cấu trúc cho backup/restore tách riêng với full runtime readiness: không bắt buộc có 3 dòng default trước khi backup hoặc restore, để backup cũ có danh sách default rỗng vẫn phục hồi được. Đây không phải bằng chứng database đã đủ runtime contract.

POST restore được cấp quyền gọi bước bổ sung 3 default bắt buộc **sau các dòng phục hồi trong transaction hiện có**. Các lệnh `ON CONFLICT DO NOTHING` chỉ thêm `CuocConfig` id 1 (97), `CuocCdConfig` id 1 (99.5) và `CUOC_N1_N3_RATE` khi thiếu; giữ rate tùy chỉnh và trạng thái tắt của metric đã phục hồi. Đây là ghi có chủ đích của restore, không phải seed trên GET hay tự repair schema; lỗi vẫn rollback cùng transaction restore.

Ledger là bảng mới ngoài manifest backup nghiệp vụ phiên bản 10. Không coi JSON backup hiện tại là bản sao migration history. Snapshot SQLite nhất quán có toàn bộ bảng giữ ledger; restore từ JSON vào database mới phải đi qua quy trình adoption riêng, không dựng lại ledger từ tên bảng. Bổ sung default sau restore không giải quyết rủi ro ledger/adoption; phần này vẫn chưa hoàn thành.

Permanent regression: `tests/integration/migration-runner.test.ts`. Test dùng SQLite giả và các SQL lịch sử; kiểm tra check/read-only, untracked refusal, checksum, apply lần hai, hai client độc lập, first-version rollback và lỗi sau DROP trong rebuild Node0Tb. Không sử dụng env/database thật. Trên Windows, fixture file có native SQLite handles được giữ trong `.local/performance/migration-fixtures/` tới sau khi process test kết thúc, không đưa vào Git; CI Linux dọn fixture đã xác minh nằm trong đúng thư mục.

Chưa kiểm thử contention nhiều process/region trên Turso, token chỉ đọc thật hoặc upgrade/adoption database đã phục hồi. Không coi test SQLite local là chứng minh các bước đó đã xong.
