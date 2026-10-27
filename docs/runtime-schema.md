# Runtime schema chỉ đọc

## Trạng thái local 27/10/2026

Batch này thay các ensure helper ghi DDL/default trên đường request bằng kiểm tra readiness chỉ đọc. Chưa commit/push/deploy, chưa đọc hoặc migrate SQLite phục hồi/Turso thật. Production vẫn chạy release trước.

Readiness xác nhận contract cần cho đường đọc/ghi hiện tại, **không xác nhận migration provenance** và không tự tạo ledger. Database untracked nhưng đủ contract vẫn đọc được; chạy release migration trên nó tiếp tục bị từ chối nếu chưa verified adoption.

## Guard làm gì

| Domain | Contract | Số SELECT cold / warm trong cùng process |
|---|---|---|
| `kpi` | Cột, PK, UNIQUE và ba cấu hình hệ thống tồn tại | 2 / 0 |
| `customer`, `users` | Các cột và key theo model | 1 / 0 |
| `node0tb`, `node`, `mapping` | Cột/PK/key phục vụ import và lookup | 1 / 0 |
| `documents` | Bốn bảng công văn/tệp/revision | 1 / 0 |

Các request đồng thời dùng chung promise theo domain/mode; chỉ memoize thành công, xóa cache khi lỗi để lần sau có thể kiểm tra lại. Đây là schema cache theo process, không phải cache dữ liệu hay quyền người dùng. Thay schema ngoài app cần process/release mới hoặc chạy CLI preflight mới; không có cơ chế theo dõi thay đổi liên tục.

Metadata kiểm tra required columns, PK và UNIQUE không partial/expression. UNIQUE có thứ tự cột khác nhưng cùng tập cột được chấp nhận vì SQLite upsert hỗ trợ key tương đương. Guard không đối chiếu đầy đủ type/null/default DDL, foreign keys, collation, mọi model hoặc mọi performance index: đây không thay thế checklist adoption đầy đủ.

KPI chỉ yêu cầu tồn tại `CuocConfig.id=1`, `CuocCdConfig.id=1`, `CUOC_N1_N3_RATE`; không ép target rate, điểm chuẩn hay trạng thái enabled về giá trị mặc định. Lỗi `SCHEMA_NOT_READY` chỉ chứa tên yêu cầu/schema, không trả raw SQL, URL/token hoặc dữ liệu nghiệp vụ từ driver.

## Migration và compatibility

Migration mới `20261026000000_runtime_schema_readiness` bổ sung sáu performance index còn thiếu và ba default insert `ON CONFLICT … DO NOTHING`. Bốn SQL migration cũ giữ nguyên. Không tạo thêm index không unique trên cùng bộ cột đã có UNIQUE chỉ để bắt chước tên runtime cũ.

Runtime cũ của KPI thực hiện 49 setup statements khi process chưa memoize. Guard mới dùng hai SELECT cold, không DDL/seed; số query này được kiểm tra qua callback thực thi trên SQLite giả. Không suy ra phần trăm tăng tốc, p95 hoặc thời gian trên Vercel/Turso từ phép đo local này.

Database phục hồi chưa được migration/adoption trong batch này. Không sửa/xóa ledger để vượt guard; không chạy lại mọi SQL lịch sử. Khi thiếu contract, tạo snapshot và xác minh nâng cấp trên bản riêng trước, theo `docs/migration-safety.md`.

## Preflight không ghi

`db:check` kiểm tra migration ledger; `db:check-schema` kiểm tra runtime contract. Hai kết quả không đồng nghĩa nhau: contract có thể ready trong khi ledger vẫn untracked.

Chỉ trên database demo đã tạo riêng, ví dụ:

```powershell
$env:DATABASE_URL = "file:.local/migration-demo.sqlite"
$env:TURSO_AUTH_TOKEN = ""
npm.cmd run db:check-schema
npm.cmd run db:check-schema -- --domain kpi
```

CLI không tự đọc env file, không chọn database mặc định, không tạo file nếu target thiếu, không migrate/seed/adopt. Mặc định kiểm tra bảy domain, tám SELECT; chỉ in trạng thái và tên yêu cầu thiếu. Remote libSQL/HTTPS cần opt-in và phê duyệt riêng; UNC/network file paths bị từ chối trước filesystem probe, kể cả khi bật opt-in remote. Không sử dụng target online trong batch local này.

## Excel không tự import khi mở trang

GET Node0TB và cước CĐ không còn đọc/import từ `NODE_0TB_DEFAULT_FILE_PATH` hoặc `CUOC_CD_DEFAULT_FILE_PATH`. Hai biến cũ không còn hiệu lực; template env không quảng bá chúng nữa. Dữ liệu đã nhập không bị xóa. Admin tiếp tục nhập qua UI/API upload có sẵn; parser, matching exact/base/prefix, thống kê và rounding giữ nguyên.

Loại filesystem loader khỏi dependency của GET xử lý nguyên nhân bốn cảnh báo tracing toàn project của Next 16.4, không dùng ignore comment để che cảnh báo.

## Backup/restore

Backup GET và preflight trước restore chỉ yêu cầu cấu trúc KPI, không đòi sẵn ba dòng config: vẫn có thể xuất/khôi phục backup cũ thiếu config. Cache structural và full tách riêng, nên structural success không bỏ qua kiểm tra đầy đủ khi đọc KPI.

Sau khi chèn các dòng từ backup, **POST restore đã xác thực ADMIN** khôi phục ba default còn thiếu ngay trong transaction hiện có. `DO NOTHING` giữ rate tùy chỉnh, điểm chuẩn và metric bị disabled nếu backup có chúng. Đây là data invariant của thao tác restore tường minh, không phải seed trên GET. Lỗi ở default insert rollback cùng dữ liệu restore.

JSON backup hiện chưa mang migration ledger; không tự dựng history từ schema/tên bảng. Phần snapshot/adoption cho restore sang database khác vẫn cần xác minh riêng.

## Phạm vi kiểm thử

Permanent tests: runtime contract/CLI trên SQLite thật, auth-order, không auto-import filesystem, backup/restore qua PrismaLibSql thật, unique key đảo thứ tự và rollback khi chèn defaults lỗi. Golden API so 27 payload/status theo ba role trước/sau; Chrome calculator desktop/mobile theo ba role và hash schema/data sau các GET.

Fixture dùng dữ liệu giả, không thay thế kiểm thử database phục hồi, token online chỉ đọc, contention đa process/region hoặc rollout Production. Còn dependency high và các task SQL/cache/bundle/map/UI ở roadmap; không coi toàn bộ audit đã được giải quyết.
