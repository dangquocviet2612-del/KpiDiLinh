# Backup restore — giới hạn trước xác nhận và parse JSON

Checkpoint64,30/10/2026. **Chỉ local, chưa commit/push/deploy. Không chạy restore thật.** Đây là validation hosting của Task12, không phải nghiệm thu backup/restore toàn hệ thống.

## Mục đích

Trên build/runtime Vercel có `VERCEL=1`, khôi phục qua web giới hạn **4.000.000byte** cho file chọn ở UI và body JSON thực tế ở API. File quá lớn bị chặn trước popup xác nhận ghi đè, bật busy, đọc File.text, parse/stringify JSON hoặc POST. Giữ file đã chọn để đối chiếu, nhật ký và giao diện cũ.

**Không chia nhỏ hoặc sửa backup để lách cap.** Restore ghi đè dữ liệu; file lớn cần quy trình local/offline riêng có backup, kiểm thử và rollback. Chỉ mở localhost không có nghĩa database là offline: phải xác minh đúng DB đích, không dùng Production để thử. Task này không tự thực hiện quy trình đó, đổi env/DB hoặc bảo đảm một backup bất kỳ khôi phục được.

File trong ngưỡng vẫn qua xác nhận phá hủy với chuỗi `KHOI PHUC`, rồi JSON parse/stringify và POST như trước. Local/non-Vercel không thêm cap4MB: API dùng request.json cũ, client public0 bỏ preflight. Đây là giữ hành vi cũ, không phải cam kết file lớn sẽ thành công ở local.

## Luồng và phạm vi

`LogsPage` → File.size preflight → confirm cũ → File.text/JSON → `POST /api/admin/backup` → ADMIN auth401 → bounded body reader → semantic validation/model preparation → schema/defaults/transaction/cache cũ.

| File | Trách nhiệm |
| --- | --- |
| `src/lib/backup-restore-limits.ts` | Cap/message và hàm chọn hosted/local; numeric public0 giữ local, missing/invalid client setting fallback4MB |
| `src/lib/backup-restore-body.ts` | Server reader riêng: check declared Content-Length lớn; đếm byte thực khi đọc stream, không tin header thiếu/thấp/sai; chỉ decode UTF8/parse JSON khi body nằm trong cap |
| `src/app/api/admin/backup/route.ts` | Giữ auth trước body; chỉ thêm parser có giới hạn và catch size error413 trước log/generic500; GET backup và toàn business/transaction không đổi |
| `src/app/(dashboard)/logs/page.tsx` | Preflight sau no-file check, trước confirm/busy/read/POST; không đổi picker, confirmation, download hoặc lịch sử |
| `next.config.ts` | Thêm một key không bí mật `NEXT_PUBLIC_BACKUP_RESTORE_MAX_BYTES`4000000/0, giữ ba key61–63 và proxy/timeout hiện có |

Reader dừng tại chunk làm vượt cap, không đưa chunk đó vào danh sách lưu để parse, best-effort cancel không chờ Promise hủy hoặc để rejection chưa xử lý, và release lock. Local vẫn request.json cũ. Size error thành413 với hướng dẫn giữ nguyên backup; malformed/empty/read lỗi vẫn generic500, semantic validation400 và unauthorized401 giữ nguyên.

Không sửa schemas, SQL, quyền/users, model mapping, cache/defaults, transaction, file backup thật, download GET, các luồng import khác, dependencies hoặc env. Server cap độc lập public0. Public cap là build-time; cần build/rebuild đúng platform và systemflag runtime, chưa kiểm cấu hình Production.

## Kiểm chứng

- **47 regression case mới**:28API+19UI. Vòng đầu27API+19UI: RED24fail/22pass trước sửa → GREEN46/46. Kiểm declared/actual/UTF8 bytes, chunk vượt cap/cancel/release, missing/malformed/read errors, auth-before-body, local/json compatibility và UI pre-confirm/no-read/retainedselection/transport cũ. Tests không đổi deadlines/pool/config hoặc assertions cũ.
- V1 fresh61file/1101scoped+22policy và lint đạt; TypeScript phát hiện3TS2769 ở **options của test UI mới** (`exact` không thuộc ByRoleOptions). Giữ nguyên candidate/log V1; V2 chỉ bỏ3props không được hỗ trợ, name:string vẫn match chính xác theo mặc định. Không sửa application hoặc nới assertions để vượt gate.
- V2 qua61file1101scoped/policy/types/lint và spec/quality review, nhưng parent kiểm thêm subtype Buffer: Buffer.slice chỉ tạo view. Một regression controlled Buffer tái sử dụng làm JSON hỏng500 thay vì semantic400 (**RED1fail/46pass trên47**); chỉ đổi copy thành Uint8Array.from, **V3GREEN47/47**. Đây là lỗi copy-contract trong candidate mới, không phải tuyên bố đã quan sát lỗi mạng/Production. Giữ nguyên V2candidate/review/QA/probes, approval cũ không áp vào hash mới. Xem [Node Buffer/TypedArray](https://nodejs.org/api/buffer.html#buffers-and-typedarrays).
- **Spec và quality review V3 đều APPROVE đúng7hash.** Worktree V3 và repo chính mỗi nơi qua một lần QA mới riêng biệt: **61 file / 1.102 scoped test +22policy**, TypeScript nonincremental và ESLint src+nextconfig+newtests đạt, lint0error/0warning. Actual installed Next config loader/staticEnv probes ở mỗi root đạt4numeric keys4000000 hosted/0local, giữ3key61–63 và proxy67108864byte. Không chạy full Next build hoặc kiểm emitted browserbundle/hydration. 47case mới đã nằm trong1.102;4backup regression cases cũ được thêm selection, không tính test mới hoặc cộng lượt chạy. V1typefailure/V2copy-contract evidence và approvals cũ giữ riêng.
- Unit route tests dùng Request/UTF8 bytes thật hoặc controlled reader, fake auth và toàn business/schema/cache services; các payload trong ngưỡng cố ý dừng ở validation users rỗng để không thực thi transaction. UI dùng page thật và fake HTTP/session/confirm/File.text, không gửi restore thật.

Snapshot511publicpaths/370source-config-test,28primarydirty/263WTdirty/1933oldartifacts; public inventory/backups và exact-scope so toàn nội dung ba file cũ sau khi bỏ đúng additions (chuẩn hóa CRLF khi cần), giữ local60–63, lịch sử thất bại/Production59. Default redacted secret scans, whitespace và review gắn bảy exact source/test hashes là cổng tích hợp. Evidence private `.local/performance/backup-restore-size-20261030/`, không commit env/DB/token/log/businessdata. Progress nối mục64;60–64 chưa publish.

## Chưa giải quyết

- Reader giới hạn byte được app giữ để parse, không phải hard heap/network/proxy budget: lower layers hoặc chunk đã giao có thể đã được buffer. Không giới hạn số chunk, CPU/depth/records của JSON, transaction duration hoặc tải nội dung trong DB.
- Không thêm snapshot consistency/checksum/foreign-key roundtrip, restore sang DB thử/activation/rollback, storage/job/progress/cancel UI, download backup lớn hoặc xử lý asset/base64/response lớn.
- Confirmation/success/error flow cũ không được coi là đã thêm single-flight, idempotency, unknown-result hay response validation trong slice này. Đây chỉ là gate kích thước; không thay semantics ghi đè hoặc khuyến nghị retry khi chưa rõ kết quả.
- Historical auth/native Windows/libSQL/KPI-timeout, Node0TB strictvisual/timing, full Next/browser/3role và CI/RUM/rollout vẫn mở. Scoped PASS hoặc fake stream không nghiệm thu restore thật, full Task12 hoặc release.

Policy4MB chừa khoảng dưới cap4.5MB toàn body do [Vercel Functions limits](https://vercel.com/docs/functions/limitations) công bố, không phải tăng giới hạn provider. [Streams standard](https://streams.spec.whatwg.org/) mô tả cancel/release; task chỉ có kiểm chứng trong process, không đo hành vi mạng thật. [Next config env](https://nextjs.org/docs/app/api-reference/config/next-config-js/env) inline giá trị vào bundle tại build; không nâng stack/compiler.
