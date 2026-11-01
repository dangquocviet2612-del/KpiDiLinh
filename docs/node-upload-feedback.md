# Import bản đồ Node: xác thực phản hồi và cảnh báo kết quả chưa rõ

Mục 68, ngày 30/10/2026. **Candidate chỉ ở worktree, chưa tích hợp source/test vào repo chính; chưa commit/push/deploy. Không import file, đăng nhập hoặc dùng database thật.** Tiếp Task12 sau vòng đời import mục67, không thiết kế lại giao diện hoặc thay server. Repo chính chỉ nhận tài liệu trạng thái pending; hành vi ứng dụng ở đó vẫn là mục67.

## Vấn đề candidate xử lý

Ba handler cũ dựa vào HTTPok: KML/KMZ có thể báo thành công với object rỗng; hai báo cáo Excel có thể điền số0 khi fields thiếu. Network, lỗi JSON hoặc phản hồi HTML bị gộp vào lỗi file, trong khi backend có thể đã thay đổi dữ liệu. Kết quả này được tái hiện bằng test, không phải tuyên bố đã quan sát trên Production.

## Hợp đồng xác nhận tối thiểu

Tất cả cần HTTPok, object không array, `message` là chuỗi có nội dung và `totalRows` là số nguyên an toàn không âm. Nếu có `success`, chỉ chấp nhận true; nếu có `mode`, phải đúng loại đã chọn. Giữ tương thích payload thiếu hai fields này mà consumer/fixtures cũ chấp nhận, không suy ra lịch sử server hoặc bảo đảm loại import khi mode vắng.

| Luồng | Fields thêm cần kiểm tra |
| --- | --- |
| KML/KMZ vị trí | `created`/`updated` nếu xuất hiện phải là số nguyên an toàn không âm |
| Hiệu suất Excel | `updated`, `notMatched` là số đếm hợp lệ; `errors` và `notMatchedSamples` là mảng chuỗi |
| Node thuê bao | `imported`, `inserted`, `updated`, `syncedCustomers` là số đếm hợp lệ; `errors` là mảng chuỗi |

Không suy quan hệ tổng/số lỗi hoặc tự bịa count thiếu. Chấp nhận số0 hợp lệ và fields dư. Đây là kiểm tra hợp đồng UI tối thiểu, **không chứng minh giao dịch, dữ liệu, checksum hoặc tính toàn vẹn database**.

## Phản hồi và hành vi

- HTTP413 xử lý trước JSON bằng hướng dẫn giới hạn file mục62; không đọc raw HTML. HTTP5xx xử lý trước body, không lấy message thành công trong body lỗi.
- Network, JSON không đọc được hoặc HTTP200 không đúng hợp đồng: “Chưa xác định được kết quả import Node. Dữ liệu có thể đã thay đổi; hãy kiểm tra trước khi thử lại.” Không success/report mới, không refresh bản đồ/panel hoặc tự POST lại; giữ báo cáo hợp lệ trước đó.
- Các HTTP lỗi khác chỉ dùng `error` là chuỗi có nội dung hoặc thông báo chung riêng của handler. JSON hợp lệ không bị từ chối chỉ vì thiếu MIME header; không đọc/in raw response text.
- Chỉ validack mới dùng báo cáo/thông báo thành công và refresh cũ. Phân biệt lỗi chuẩn bị multipart trước POST, kết quả chưa rõ sau gửi và lỗi UI sau đã nhận validack. Lỗi refresh đã được helper cũ bắt không phủ nhận knownack hoặc gửi lại import.
- Giữ nguyên ref chung, cap/no-file, captured input/File, reset picker/finally mục67. Muốn thử lại phải chọn file thủ công; không thêm hàng đợi hoặc thay nội dung báo cáo/truncation10lỗi, query, quyền, CSS, template hoặc API.

## Kiểm chứng

**Chưa đạt scoped acceptance:** worktree có **64 file pass / 1 file fail; 1.275 test pass / 1 fail trong 1.276**. Test lỗi là `tests/unit/schema-auth-order.test.ts:177`, case `GET users returns 401 without schema or database access`, timeout5.000ms — cùng test/lỗi đã từng được ghi ở mục56/57. Chưa xác minh root cause hoặc quan hệ nhân quả với candidate; đây không phải bằng chứng endpoint Production hay đăng nhập thật bị lỗi.

Focused83/83,22policy, TypeScript nonincremental và ESLint src/nextconfig/newtest0error/0warning đạt. **Spec APPROVE rồi quality CODE ONLY APPROVE đúng hai hash; không có approval tích hợp source, scoped acceptance hoặc release.** Không chạy lại unchanged candidate để lấy xanh; không skip/nới timeout/đổi pool/oldtests hoặc sửa auth theo suy đoán. Raw failed log/report, strict integration guard và pending status được giữ nguyên. Chưa chạy primary QA vì source chưa được phép tích hợp; không dùng lượt pass ở mục67 để thay thế failed gate68.

83 regression cases actual NodeMapComponent với fake session/HTTP/Leaflet: **RED69failed/14passed → GREEN83/83**. Bao gồm thiếu/sai message/counts/arrays, mode/success tường minh sai,413 trước JSON,5xx/network/unreadableJSON, structured4xx, valid legacy/explicit/zero và JSON thiếu MIME, knownack UI/refresh error, giữ báo cáo trước và khóa67 qua response đang chờ, preparation error prefix. Không đọc file hoặc gọi actual API/DB.

Snapshot526publicpaths/377source-config-test,45thay đổi repo chính/279worktree,2.157oldartifacts. Chỉ một component + một newtest + bốn tài liệu. Exact-scope đối chiếu nguyên prefix/finally67, valid report/refresh sau khi bỏ guard, rồi đảo helpers/ba handler và so toàn component. Source/backend/config/oldtests giữ nguyên ngoài phạm vi; lưu preimages/backups/inventory/hash, default redacted secret scan và whitespace. Progress nối68, không sửa lịch sử lỗi hoặc publication59.

Evidence private `.local/performance/node-upload-feedback-20261030/`; không commit env/DB/token/log/businessdata. Candidate source nằm ở `.worktrees/ux-performance-batch1/`; primary source/test vẫn nguyên trạng67. Chỉ tích hợp bốn tài liệu với manifest pending riêng, không chạy/nới helper tích hợp source yêu cầu allPassed. Không kiểm tra lại trạng thái live hoặc publish đợt local nào.

## Hạn chế

- Guard nằm sau response. API vẫn tự nhận loại file như cũ; mode khác có thể tương ứng với dữ liệu đã ghi. Cảnh báo không rollback hoặc chặn trước backend. Payload không có mode chỉ được xác nhận ở mức tối thiểu nêu trên.
- Unknown result không có nghĩa database chưa đổi. Admin phải kiểm tra trước thử lại. Ref chỉ per-component, không server idempotency/cross-tab/user locking, cancellation, transaction hoặc exactly-once.
- Chưa import dữ liệu thật, đối soát SQL/counts/checksum/FK/roundtrip, storage/jobs hoặc file lớn. Không benchmark latency hoặc suy web nhanh hơn từ fake HTTP.
- Full Task11/12, native Windows/libSQL/auth/KPI-timeout cũ, Next/browser/ba role, Node0TB strict visual/timing, CI/RUM/release vẫn mở.
