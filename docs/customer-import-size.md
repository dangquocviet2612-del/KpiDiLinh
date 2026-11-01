# Giới hạn file import khách hàng — checkpoint61, local

## Người dùng nhận được gì

- Khi build/chạy trên Vercel với systemflag `VERCEL=1`, file Excel của chức năng import khách hàng được giới hạn **4.000.000byte (4MB decimal)**. File vượt cap bị chặn ngay ở picker handler, chưa tạo FormData/upload/busy; có hướng dẫn chia nhỏ file, input reset để chọn lại.
- API kiểm độc lập cùng cap sau auth/File validation, trước arrayBuffer/XLSX và các bước đọc/ghi nghiệp vụ. Bỏ qua kiểm tra trình duyệt hoặc publiccap0 không vượt được servergate khi runtimeflag1.
- Build local/non-Vercel phát publiccap0 và không thêm hạn chế4MB vào server local; điều này giữ hành vi trước task, không hứa local hỗ trợ file kích thước bất kỳ. File đúng ngưỡng vẫn đi qua importer cũ.
- Lỗi bị chặn ở client không xóa report/CSV trước đó, không success/refresh/POST, không kẹt single-flight. Mọi phản hồi/checkpoint60 và request multipart cũ giữ nguyên.

**Trạng thái:** 24/24 regression test mới đạt. Worktree và repo chính đều qua lần kiểm tra mới riêng biệt: **54 file / 948 test trong phạm vi + 22 policy test**, TypeScript và ESLint đạt (lint không có lỗi/cảnh báo). Đây chỉ là thay đổi local, chưa commit/push/deploy; Production vẫn bản965e8e9 ở mục59.

## Vì sao4MB thay vì4.5MB

[Vercel Functions limits](https://vercel.com/docs/functions/limitations) và [FUNCTION_PAYLOAD_TOO_LARGE](https://vercel.com/docs/errors/function_payload_too_large) mô tả cap4.5MB cho toàn requestbody. File không phải toàn multipartbody, nên4.000.000byte là **policy thận trọng của app**, không phải tuyên bố hosting có cap4MB. Một fixture thật với một File4MB và FormData/Request cho thấy body có overhead nhưng vẫn dưới4.500.000byte; không dùng fixture đó làm bảo đảm mọi multipart/filename/additionalfields đều vừa.

Không đổi `proxyClientMaxBodySize`64mb hoặc timeout để giả tăng giới hạn Vercel. Cần workflow storage/job riêng nếu muốn file lớn hơn; chưa thêm dịch vụ/chi phí hoặc tự chia workbook.

## Wiring và giới hạn môi trường

| Thành phần | Hành vi |
| --- | --- |
| `src/lib/customer-import-limits.ts` | Hostedcap/message dùng chung; server chỉ chọn cap khi VERCEL===1; client dùng public0 để giữ local, absent/invalid publicvalue fallback4MB |
| `next.config.ts` | Tính một giá trị không bí mật từ flag của build và inject `NEXT_PUBLIC_CUSTOMER_IMPORT_MAX_BYTES`; chỉ4000000 hoặc0, không dump process.env |
| `src/app/(dashboard)/customers/page.tsx` | No-file/in-flightguard cũ → metadata filesizegate → busy/FormData/fetch/report flow60 |
| `src/app/api/import/route.ts` | Auth → formData/File validation → runtimefilesizegate → Buffer/XLSX → scope/rows/transaction/cache cũ |

[Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables) là nguồn flag; môi trường hosted phải cung cấp VERCEL=1. Không suy platform bằng hostname, NODE_ENV hoặc tin giá trị client. Nếu systemvars bị tắt hoặc build prebuilt trên môi trường khác, phải kiểm cấu hình/rebuild; không claim đã xác minh flag của Production ở task này.

[Nextconfig env](https://nextjs.org/docs/app/api-reference/config/next-config-js/env) đưa giá trị cấu hình vào bundle tại buildtime. Đây là API legacy còn supported; chọn phạm vi một numeric key để hỗ trợ config hiện có/both bundlers, không thêm compilerplugin hoặc đổi stack. Browser không thể nhận cap mới chỉ bằng thay env runtime sau build; servergate đọc runtimeflag độc lập. Không có token/database URL/authsecret trong publicconfig.

## Điều giữ nguyên

- Roles/permissions của importer cũ, auth401 trước parsebody, missing/wrongFile400 và parserempty400. File trong ngưỡng vẫn dùng parser/mapping, CTVscope, payload, transaction/counters/cache invalidations cũ.
- Customer/User/Node schemas, database và nội dung file; không sửa normalization/date/rounding, SQL, rowcountlimits, imports khác, menus đã ẩn hoặc CSS.
- Feedback60 (413 từ gateway, unknown-result, refresh/CSVfallback, errorpreview/single-flight), cùng toàn bộ oldtests/fixtures/config không liên quan và dependencies.
- Không có API lấy limit mới, không thêm request startup hoặc backgroundjob. Không đo/tuyên bố tăng tốc latency/Production từ các unit tests.

## Evidence và kiểm tra

- TDD: **RED9fail/15pass trên24 → GREEN24/24**.15APIunit cases mock auth/ORM/XLSX nhưng chạy route/mapper/cache-callback thật;9UI cases dùng page thật và fake transport/query/session. Metadata boundaries4.000.000 và+1, localflag/public0/unknown,401/no-body,3authenticatedroleprops và2goldensuccess imports được kiểm tra. Đây không phải3roleE2E hoặc database thật.
- File.size thường dùng metadata stub để không tạo file lớn; một actual4MB multipart control chỉ tạo bytes trong process, không gọi network/DB. Không coi unitfake workbook là xử lý Excel thật trên Vercel.
- Actual installedNext configloader +staticEnv collector, hai childprocess hosted/local với fakeenv/env-fileguard: publiccap4000000/0 và đúng1nonsecretkey. PrivateprobeV1 kỳ vọng proxystring64mb trong khi Next normalize67108864; giữlog và sửa checkerV2, không sửa candidate hoặc nới sizeassertion. Không chạy fullNextbuild hoặc kiểm actual emitted browserbundle.
- Worktree và repo chính mỗi nơi đạt 54 file / 948 test trong phạm vi + 22 policy test, TypeScript nonincremental và ESLint src+newtests+nextconfig không lỗi/cảnh báo. Kết quả từng nơi được lưu riêng; 24 case mới đã nằm trong 948, không cộng các lượt. Cả hai nơi cũng qua actual Next config loader/staticEnv probes cho hosted/local (4000000/0).
- Hai bước spec review và quality review đều APPROVE trên cùng 6 whole-file hash. Exact-scope so byte cho3file có sẵn: chỉ import/sizeguard/numeric env, giữ importer/60/CSS/proxy/oldtests/deps. Backup/defaultredactedsecret scan/whitespace/hash-inventory guards bảo toàn496snapshotpaths,361oldsource-config-test paths,6primarydirty/242WTdirty và1759old artifacts.

Private evidence: `.local/performance/customer-import-size-20261030/` chứa snapshot/preimage/RED/GREEN,configprobesV1/V2,scopedQA/reviews/scans/backups/integration/manifests. Không commit env/DB/token/log/businessdata.

## Chưa giải quyết

Request.formData vẫn đọc/parse multipart trước serverFile.size; platform có thể từ chối request trước handler/auth. Filecap không giới hạn toàn body, số dòng, workbook decompression/zip expansion, SQLtime, responseCSV hoặc uploadsNode/KPI/documents/backup. Chưa directstorage/job/progress/cancel/restore; checkbox toànTask12 vẫn mở.

Authtimeout cũ, fullnative Windows/libSQL/KPI-timeout/Node0TBstrictvisual-timing/Nextbrowser/3role/CI-RUM vẫn riêng. Không thay lịch sử failedgate hoặc coi configprobe/scopedPASS là nghiệm thu toàn app/release.
