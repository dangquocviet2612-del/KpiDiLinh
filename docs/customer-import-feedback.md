# Import khách hàng: phản hồi đúng kết quả — checkpoint60

## Phạm vi và trạng thái

Tiếp Tasks11/12 bằng một lát cắt client nhỏ: **phản hồi import**, không triển khai upload lớn, sửa parser/SQL hoặc thay giới hạn hosting. API `/api/import`, FormData/file, auth/scope/transaction, schema, CSS, các menu đã ẩn, URLfilters và luồng CRUD khác giữ nguyên. Chỉ làm local, không commit/push/deploy hoặc truy cập database/tài khoản thật.

**Implementation local:** V2 có30regression mới đạt, WTfresh52file/924test đạt cùng22policy/types/lint0warning. V1 trước đó broadWT52file/921test có **920pass/1fail**, đúng test `GET users returns 401 without schema or database access` timeout5000ms; log/failurehash giữ nguyên. V2 chỉ sửa P2 của report, không sửa auth; pass mới không chứng minh nguyên nhân timeout cũ hoặc xóa gate lịch sử. Không skip/nới deadline/đổi pool hoặc rerun đến xanh.

Primary V2 fresh QA riêng: **52file/924test +22policy/types nonincremental đạt, ESLint toànsrc+newtest0error/0warning**. CurrentV2scoped acceptance đạt ở cả2root, khác với historicalauth reliability còn mở. Không coi đây là bản sửa auth hoặc đã nghiệm thu toàn Tasks11/12.

## Vấn đề đã tái hiện

Trước sửa, page đọc JSON trước xét status nên413plain-text rơi vào lỗi chung; body `{}` với HTTPsuccessful có thể được báo thành công0/0; hai changeevents cùng batch có thể gửi2POST. Lỗi tạo CSV hoặc tải lại danh sách sau ack bị lẫn với lỗi import; rejected refresh có thể không được xử lý. Backend hiện trả added/updated là số không âm, errors optionalstring[] và errorCsv optionalstring sau transaction/cache invalidation.

`tests/ui/customer-import-feedback.test.tsx`: **RED21fail/6pass trên27 → GREEN27/27**. Quality review phát hiện fallbackCSVhỏng chỉ hiển thị5lỗi, còn lại bị ẩn. Đã kiểm source, giữ candidate/review/QA V1, thêm regression **RED2fail/27pass trên29**, rồi sửa và thêm controlCSVtốt: **GREEN30/30 V2**. Dùng customerpage thật, giả transport/session/currentuser/customerquery ở boundary; Dialog/FormData/File/URL lifecycle dùng React/DOM thật. Không mock handler, sửa test cũ hoặc gọi DB. Các case control cho validreport và structured400/401 đã đạt trước sửa.

## Hành vi sau sửa

| Tình huống | Phản hồi | Không làm |
| --- | --- | --- |
| HTTP413, kể cả plain-text | Hướng dẫn chia nhỏ file Excel | Không gọi json, báo success hay tự retry |
| Network/JSON lỗi,5xx hoặc successbody sai shape | Kết quả chưa được xác nhận; tải lại danh sách kiểm tra trước thử lại | Không nói mutation chưa commit/đã rollback, không tạo report hoặc revokeCSV cũ |
| Structured4xx với errorstring | Giữ thông báo từ backend như cũ | Không chuyển thành success hoặc Lỗi:undefined |
| Successfulresponse với added/updated safeinteger≥0, optionalerrors:string[]/errorCsv:string | Giữ report added/updated/rowerrors/CSV, success và refresh | Không coerce string/số âm/bodythiếu thành0 để giả thành công |
| Ack hợp lệ nhưng tạo CSV local lỗi | Vẫn hiện report/rowerrors/success; báo chưa tạo được file tải xuống | Không phủ nhận kết quả import đã xác nhận |
| Ack hợp lệ nhưng refresh sync/rejectedPromise lỗi | Giữ report/success; nhắc tải lại trang | Không unhandled rejection, gửi lại POST hay gọi lỗi import chung |
| Hai changeevents trước renderbusy | Synchronousref chỉ cho1POST | Không gửi file thứ hai song song |

Capture input trước await, FormData construction nằm trong try, finally mở lại busy và clearinput để có thể chọn lại cùng file. Hiddeninput/button disabled hiện có giữ nguyên; không thêm CSS hoặc thiết kế mới. Request vẫn POST `/api/import`, đúng một fieldfile và browser tự sinh multipart boundary; CSV MIME/filename và inlineerrors như cũ.

Report/CSV cũ chỉ thay/revoke sau ack đúng contract. Nếu không có CSV, ban đầu vẫn5lỗi; nút Hiệnthêmlỗi (typebutton/aria-controls) thêm5dòng/lượt đến hết và reset về5ở report mới. Không hướng người dùng tới CSV không tồn tại hoặc render toàn bộ lỗi ngay từ đầu; CSVcòn dùng được giữ nguyên5preview+note/download. Dùng btnclass sẵn, không CSS mới. Cleanup URL khi unmount đã có trước task, không thay bằng cơ chế mới. Guard chỉ là single-flight trong một pageinstance, không phải server idempotency, cross-tab lock, abort/cancel/rollback guarantee hoặc bảo đảm xử lý mọi response đến sau unmount.

## Giới hạn upload vẫn còn

[Vercel Functions limits](https://vercel.com/docs/functions/limitations) giới hạn requestbody4.5MB; multipart có overhead nên không đồng nhất với filesize4.5MB. [FUNCTION_PAYLOAD_TOO_LARGE](https://vercel.com/docs/errors/function_payload_too_large) mô tả lỗi vượt giới hạn request. Đối chiếu30/10/2026; các giới hạn nền tảng có thể đổi.

Slice này xử lý feedback413 **sau khi request đã được gửi**, chưa chặn file lớn trước upload, thay cap local/online, chia nhỏ workbook tự động, directstorage/jobs/progress/cancel hoặc sửa response CSV lớn. Không tăng proxy limit/timeout để giả vượt được hostingcap; không tự thêm provider/chi phí. Checkbox validation/file-size và toànTask12 vẫn mở.

## QA, evidence và bảo toàn

- FocusedV2:30/30; WTfreshV2scope924/924+policy22/types nonincremental/ESLint toànsrc+newtest0error0warning đạt. V1broad920/921 giữ riêng. Primary result được ghi riêng, không cộng lượt hoặc dùng focused thay scope.
- Spec review V1/V2 APPROVE đúng2hash mỗi version; qualityV1 tìmP2, qualityV2 APPROVE đúng2hash cuối, không còn actionablefinding. Staticreview không thay parentverification hoặc waive gate.
- Parent exactscopeV2 so byte: ngoài typeguard/constants/ref/state/handleImport và errorfallbackreport nguyên file; payload path/method/file, CSVmetadata, mọi backend/oldtests/fixtures/CSS/config/deps và các phần khác nguyên.
- Snapshot493paths/360source-config-test paths, primaryclean tại `1af73f3`, reuseWT1ecfa38 với239dirtypaths được giữ;1705old artifacts gồm cả báo cáo Production59 giữ byte/hash. Fileprogress phải giữ59 đã publish khi append60; WT còn thiếu59 được sync từ publishedpreimage trước append, không xóa lịch sử.
- Source/docs có backups, defaultredactedsecret scan/whitespace/hash-inventory/HEAD/index/oldBUILD_ID guards. Không thay env/DB, tạo nhánh/commit/push/deploy, hoặc đánh dấu appProduction đã dùng candidate60.

Evidence ignored: `.local/performance/customer-import-feedback-20261030/` giữ preimages/snapshot, RED/GREEN/rawQA, exactscope, review, failurehash/pendingdisposition, scans/backups/integration/pending manifests. Privatechecker ban đầu strip dòngref LF nhưng file CRLF, đã sửa checker theo newline hiện có; không normalize/reformat source hoặc nới scope.

**Còn mở:** authtimeout50/56/60 chưa rootproof; fullnative Windows/libSQL/KPI-timeout/Node0TBstrictvisual-timing/Nextbrowser/3role/CI-RUM và release acceptance còn riêng. Production hiện vẫn bản965e8e9 của mục59; kết quả local60 không tự cập nhật web.
