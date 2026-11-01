# Giới hạn file nhập dữ liệu bản đồ Node

Checkpoint62, ngày30/10/2026. **Chỉ local, chưa commit/push/deploy.** Tiếp phần validation hosting trong Task12; không phải workflow xử lý file lớn.

## Thay đổi cho người dùng

Khi build/chạy trên Vercel với `VERCEL=1`, cả ba chức năng import Node giới hạn **4.000.000 byte/file (4MB decimal)**:

| Chức năng | Định dạng | Luồng cũ giữ nguyên |
| --- | --- | --- |
| Vị trí Node | KML/KMZ | Đọc XML/ZIP, thêm/cập nhật tọa độ, refresh node |
| Hiệu suất Node | XLSX/XLS | Đọc cột hiệu suất, cập nhật node, báo cáo kết quả |
| Node thuê bao | XLSX/XLS | Nhập mapping account-node và đồng bộ khách hàng, báo cáo kết quả |

- Quyền **ADMIN** như trước. API vẫn trả401 cho anonymous/MANAGER/CTV trước khi đọc body.
- File quá ngưỡng được chặn trước đóng menu, bật busy, tạo FormData hoặc gửi POST; thông báo giới hạn và reset picker để chọn lại. Không xóa báo cáo import trước đó hoặc giả báo thành công.
- File đúng ngưỡng và nhỏ hơn tiếp tục importer cũ. Không tự cắt file, đổi dữ liệu hoặc gửi lại ngầm.
- Local/non-Vercel không thêm giới hạn4MB này. Đây là giữ hành vi cũ, không bảo đảm mọi file lớn đều nhập được.
- Với KMZ/KML, nếu cần dữ liệu nhỏ hơn nên xuất lại tập dữ liệu phù hợp bằng công cụ nguồn; không cắt bytes/chia ZIP thủ công rồi kỳ vọng vẫn hợp lệ.

## Kiến trúc và cấu hình

`NodeMapOptionsMenu` → ba handler thật trong `NodeMapComponent.tsx` → `POST /api/nodes/upload` → các importer vị trí/hiệu suất/mapping hiện có → Node/CustomerNodeMapping/Customer và invalidation cũ.

| File | Trách nhiệm mới |
| --- | --- |
| `src/lib/node-upload-limits.ts` | Cap và message chung cho Node; server chỉ áp cap khi runtime `VERCEL === "1"`; client dùng public0 để giữ local, thiếu/sai giá trị fallback4MB |
| `next.config.ts` | Thêm đúng một numeric key không bí mật `NEXT_PUBLIC_NODE_UPLOAD_MAX_BYTES`:4000000 trên hosted,0 trên local; giữ nguyên key customer-import của61 |
| `src/app/(dashboard)/node-map/NodeMapComponent.tsx` | File.size preflight ở cả ba handler, sau no-file check và trước mọi side effect upload |
| `src/app/api/nodes/upload/route.ts` | Kiểm cap độc lập sau auth/formData/File validation, trước arrayBuffer/Buffer, XLSX/ZIP/XML và các service nghiệp vụ |

Không thay `.env`, database, schemas, quyền, parser/header mapping, SQL/batches, counters, transaction, cache, CSS/menu hoặc dependencies. Không thêm request lấy config, provider, storage, background job hay chi phí.

Cap Node có key/helper riêng để không làm thay đổi hợp đồng của customer import61. Chỉ số cap được phát vào bundle tại build, không phải token/DB URL hoặc dump process.env. Không tin public0 để bỏ server gate. System flag Vercel phải tồn tại; chưa kiểm cấu hình Production. Khi dùng prebuilt/chuyển platform cần rebuild đúng môi trường; đổi runtime env không tự đổi client bundle.

## Kiểm chứng

- **56 regression case mới**:20 API +36 UI. RED25fail/31pass trước sửa → GREEN56/56. Boundary4.000.000/+1, bốn extension, ba handler, public0/default/invalid, no-file, reset/chọn lại và bảo toàn report được kiểm tra.
- API chạy route thật, fake auth/ORM/XLSX; hai golden KML/KMZ dùng parser XML/ZIP thật với fixture nhỏ. Golden Excel hiệu suất/mapping giữ row mapping/write-call/cache behavior; không phải database thật hoặc import Excel trên platform thật.
- UI chạy component/handlers/Dialog thật, fake Leaflet canvas, options child, session và HTTP. Metadata File.size giúp kiểm boundary mà không upload file lớn. Không coi đây là map visual/browser/hydration hoặc3roleE2E.
- V1 scoped56file/1004test +22policy và lint đạt, TypeScript phát hiện TS2345 ở **annotation của fixture unit mới**: default Buffer<ArrayBuffer> không nhận ZIP Buffer<ArrayBufferLike>. Giữ nguyên candidate/log V1; chỉ đổi parameter thành Uint8Array. Không sửa app/assertions/mocks/oldtests/deadline/pool để vượt gate.
- **Spec và quality review đều APPROVE đúng6hash V2.** Worktree V2 và repo chính mỗi nơi qua một lần QA mới riêng biệt: **56 file / 1.004 scoped test +22policy**, TypeScript nonincremental và ESLint src+nextconfig+newtests đạt, lint0error/0warning. Actual installed Next config loader/staticEnv probes ở mỗi root đạt hosted4000000/local0 cho cả customerkey cũ và nodekey mới; proxy vẫn67108864byte. Không chạy full Next build hoặc kiểm emitted browserbundle. 56case mới đã nằm trong1.004, không cộng lượt chạy; V1 typefailure vẫn giữ riêng.
- Exact-scope đối chiếu toàn nội dung ba file cũ sau khi bỏ đúng các import/gate/config additions, chỉ chuẩn hóa CRLF khi so sánh; tất cả parser/quyền/write/cache/giao diện và checkpoint61 ngoài các additions giữ nguyên. Snapshot501publicpaths/364source-config-test,13primarydirty/249WTdirty,1818old artifacts được bảo toàn bằng hash/inventory/backups. Quét secret mặc định/redacted, whitespace và review gắn exact candidate hash.

Evidence riêng tư: `.local/performance/node-upload-size-20261030/`. Không commit env/DB/token/log hoặc dữ liệu nghiệp vụ. Production vẫn code965e8e9 ở mục59; các checkpoint60–62 chưa được publish.

## Giới hạn và phần còn mở

File cap này không giới hạn toàn multipart/extra fields/filename, dung lượng giải nén ZIP/workbook, số dòng, SQLtime, report/response, hoặc upload Node0TB/KPI/tài liệu/backup ở endpoint khác. `request.formData()` vẫn đọc body trước API File.size gate; platform có thể reject trước handler/auth. Không coi gate sau formData là streaming hoặc hàng rào chống ZIP bomb.

Chưa sửa phản hồi gateway413/unknown-success/refguard của các handler Node; chúng giữ nguyên flow cũ. Chưa storage/job/progress/cancel/idempotent retry, benchmark throughput hay backup/restore nghiệm thu. Toàn Task12 vẫn mở. Historical auth timeout, native Windows/libSQL/KPI-timeout, Node0TB strict visual/timing, full Next/browser/3role và CI/RUM vẫn là các gate riêng; scoped PASS không chứng minh đã giải quyết các mục đó.

Policy4MB kế thừa61, chừa multipart headroom so với cap4.5MB toàn body do [Vercel Functions limits](https://vercel.com/docs/functions/limitations) công bố; không bảo đảm mọi multipart ở mức file cap đều vừa. [Next config env](https://nextjs.org/docs/app/api-reference/config/next-config-js/env) là legacy API còn hỗ trợ, giá trị được inline lúc build; không nâng stack hoặc thay compilerplugin trong slice này.
