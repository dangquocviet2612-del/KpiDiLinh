# An toàn cấu trúc file restore backup — mục 71

## Vấn đề đã tái hiện

`POST /api/admin/backup` trước đây chuẩn hóa collection bằng `Array.isArray(value) ? value : []`, nhưng quyết định xóa các bảng optional lại theo sự có mặt của key. Vì vậy `{ kpiDailyResults: null }` trong một backup còn đủ user ADMIN có thể đi vào nhánh xóa bảng mà không có bản ghi thay thế. Một số collection core sai kiểu cũng trở thành rỗng; row null có thể gây HTTP500.

Test mock đã tái hiện HTTP200/transaction/coreDeletes/rawWrites cho những payload sai cấu trúc; đây là bằng chứng **attempted calls trong mock**, không phải kết luận đã có mất dữ liệu thực tế hoặc đã restore thử DB.

## Thay đổi nhỏ, đúng điểm chặn

- Entry point: `src/app/api/admin/backup/route.ts`, POST dành cho ADMIN.
- Sau auth và đọc body theo size guard mục64, `hasValidBackupData` kiểm tra trước mọi prepare/schema/database/transaction/default/cache call.
- `data` phải là object khác null, không phải array.
- Mỗi **known collection có mặt dưới dạng own key** phải là array; mọi phần tử phải là object khác null, không phải array. Kiểm tra toàn bộ các phần tử, không chỉ phần tử đầu tiên.
- Typed exhaustive record khớp `BackupPayload.data`, hiện có 23 collection. Thêm key mới vào type mà chưa thêm vào record làm TypeScript báo lỗi.
- Sai cấu trúc trả HTTP400 với thông báo có sẵn `File backup không hợp lệ`; không echo payload hoặc lỗi parser ra response, không truy cập DB trước khi từ chối.

Các collection được kiểm tra:

| Domain | Collection |
|---|---|
| Tài khoản/khách hàng | users, customers, editHistory, customerNotes |
| Node | nodes, customerNodeMappings, node0TbRecords |
| KPI | kpiMetricConfigs, kpiDailyResults, managerKpiDailyResults |
| Cước | cuocDailyResults, cuocConfigs, cuocCdDailyResults, cuocCdConfigs |
| Báo cáo nghiệp vụ | cdtTransactions, cdtOutstandingRecords, disconnectRecords, churnRiskRecords |
| Lưu trữ | archiveLogs, archiveExportLogs |
| Văn bản | officialDocuments, officialDocumentAssets, officialDocumentRevisions |

Không thay GET/export, SQL/transaction/defaults/cache, UI/confirmation, roles/auth, config/schema/migration/dependencies, size guard64, feedback65–66, code/test công cụ70 hoặc test cũ.

## Tương thích giữ nguyên

- Backup cũ thiếu các key optional vẫn theo nhánh hiện hữu, không bị từ chối chỉ vì thiếu key.
- Collection được cung cấp là `[]` vẫn có ý nghĩa hiện hữu; **không** chuyển array rỗng thành “bỏ qua bảng”. Riêng users rỗng vẫn bị business rule cũ từ chối.
- Các key lạ và metadata không bị siết thêm; không tự áp quy tắc schemaVersion mới.
- Object row vẫn phải qua validation field/ADMIN/password và các parser nghiệp vụ cũ; shape hợp lệ không có nghĩa bản ghi hợp lệ.
- Mã số/false/0 trong field của object không bị guard mới sửa; test giữ giá khách hàng và tọa độ node bằng 0.
- Quy tắc hiện hữu với core collection bị thiếu cũng không thay đổi: một số core table vẫn bị clear khi restore. Đây là giới hạn completeness cần đánh giá riêng, **không được hiểu “key thiếu luôn bảo toàn dữ liệu”**.

## Kiểm chứng local

`tests/unit/backup-restore-shape.test.ts` mock toàn bộ auth, Prisma, schema helpers, defaults, cache và document assets trước khi import route. Không load native libSQL hoặc dùng dữ liệu/người dùng thật.

- Ban đầu 169 case: **RED147 fail/22 pass**, capture report hoàn chỉnh, exit1, không unhandled error. Log cho thấy các call ghi giả; không sửa log đỏ để thành xanh.
- Guard nhỏ → GREEN169. Tự review phát hiện cách truyền `[]` trong `it.each` có thể bị diễn giải như tuple rỗng; giữ candidate/log V1, chỉ box các tham số row/data/body để kiểm đúng nested array và root array. Source app không đổi trong correction này; GREEN V2 vẫn169/169.
- Worktree: **6 file/285 case backup API/UI liên quan PASS**, không skip, không tăng timeout/retry/pool. **48 tool tests +22 policy tests, types và lint0warning PASS**.
- Sau source-only SPEC rồi QUALITY **APPROVE đúng hai hash**, quét bí mật và backup preimage trước copy riêng source71 vào repo chính. Repo chính chạy fresh **6 file/285 backup case,48 tool+22policy, types/lint0warning PASS**, không suy kết quả từ worktree. Approval không mở rộng sang docs/private harness/full restore/release.
- Các lượt test dùng recorder70: giữ main report đã lọc, process report riêng và exit lỗi ngay trong lượt RED, không cần chạy lại suite để thu bằng chứng. Private exact-scope proof ban đầu chỉ nhận LF nên fail trên CRLF; sửa riêng helper, proof đảo thay đổi byte-exact với preimage đạt trên CRLF và normalizedLF, không đổi source/test để làm proof xanh.
- Default redacted secret scan, whitespace, backups và inventory/hash guards áp dụng hai source/test và bốn docs; giữ prefix tiến độ70, source68deltas/failedgate và toàn bộ2.325artifacts cũ. Final manifest xác nhận sáu file local, không commit/push/deploy.

Các bộ backup liên quan gồm regression schema, size body API/UI, restore feedback và download feedback. Không chạy lại unchanged65file/1276case app suite, full native hoặc browser/DB E2E trong batch này.

## Giới hạn và trạng thái

Chỉ chặn lỗi **hình dạng** trước nhánh ghi, không chứng minh file backup đầy đủ/đúng nguồn, checksum/foreign keys/duplicate IDs/semantic integrity, consistent snapshot, rollback, password correctness, server idempotency hoặc tải file lớn. Không restore/đọc DB thật; transaction và defaults trong test mới là mock. Không khẳng định mọi input sai đều bị chặn trước mọi DB access: shape hợp lệ nhưng field nghiệp vụ sai vẫn theo validator cũ.

Candidate68 vẫn chỉ ở worktree, failed auth gate68/rootcause vẫn mở; không dùng QA mục71 để promote68 hoặc đóng full Task12/native/Node0TB strict visual-timing/Next/browser/ba role/CI-RUM/release. Không đổi hạ tầng hoặc mua provider, không commit/push/deploy.

Evidence private: `.local/performance/backup-restore-shape-20261030/` giữ snapshot/preimage, RED/GREEN và recorder/process reports, candidate V1, QA mỗi root, review đúng hash, secret/whitespace/exact-scope/backups/inventory/integration và pending manifests. Không commit log/env/DB/token/dữ liệu nghiệp vụ.
