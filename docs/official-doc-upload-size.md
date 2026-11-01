# Tệp đính kèm công văn — giới hạn upload

Checkpoint63,30/10/2026. **Local, chưa commit/push/deploy.** Đây là phần validation hosting của Task12, không phải dịch vụ lưu file lớn.

## Người dùng nhận được gì

- Trên bản build/runtime Vercel có `VERCEL=1`, file ảnh/video/tài liệu đính kèm công văn giới hạn **4.000.000byte/file (4MB decimal)**, thay vì chấp nhận file20/200MB rồi mới lỗi tại Function.
- Kiểm tra **tất cả tệp đã chọn** trước khi bật busy, tạo FormData hay gửi request. Nếu có một file quá ngưỡng, không upload bất kỳ file nào trong lượt chọn đó, giữ nguyên form và các asset trước đó.
- Sau xử lý, picker được reset để chọn lại cùng tệp. File hợp lệ vẫn được gửi tuần tự, một file mỗi POST; không áp cap4MB lên tổng tất cả các file trong lượt chọn.
- Video lớn có thể dùng chức năng **Thêm link video** sẵn có. Không tự upload sang dịch vụ khác, mua storage, tạo link hoặc kiểm tra khả dụng của website video ngoài.
- Quyền ADMIN như trước. Local/non-Vercel giữ giới hạn API cũ:20MiB cho file thường,200MiB cho MIME video; không tự chuyển mọi môi trường sang4MB.

## Luồng kỹ thuật

`OfficialDocsPanel` picker → `useOfficialDocsPanel.uploadDocFiles` (snapshot/preflight toàn selection) → `POST /api/official-documents/upload` (auth401,role403,File400,hostedsize413,legacy-local-size400) → `createTempOfficialDocAsset` → `OfficialDocumentTempAsset` chứa base64 như cũ. Lưu công văn/attach asset và các route đọc asset không thay đổi.

| File | Thay đổi có chủ đích |
| --- | --- |
| `src/lib/official-doc-upload-limits.ts` | Cap/message dùng chung; server runtimeflag độc lập, client public0 để giữ local, thiếu/sai value fallback4MB |
| `next.config.ts` | Thêm một derived numeric key `NEXT_PUBLIC_OFFICIAL_DOC_UPLOAD_MAX_BYTES`4000000/0, giữ nguyên hai key customer/node của61/62 |
| `src/app/(dashboard)/prepaid/useOfficialDocsPanel.ts` | Snapshot FileList, preflight whole selection trước side effect; accepted files giữ upload tuần tự/append assets cũ |
| `src/app/(dashboard)/prepaid/OfficialDocsPanel.tsx` | Capture input trước await và reset trong finally; không đổi CSS/menu/props/label/video link |
| `src/app/api/official-documents/upload/route.ts` | File.size gate sau auth/role/File validation nhưng trước asset service, Buffer/base64/DDL/DB; guard20/200MiB và error contracts khác giữ nguyên |

Không thay `official-doc-assets.ts`, storage/base64, schemas, SQL, session/roles, công thức KPI, customer/node imports, dependencies hoặc config proxy/timeout. Không thêm startup/config request hoặc đọc/ghi dữ liệu/env thật. Numeric public config không chứa secret; phải build/rebuild đúng platform, không đổi được client cap bằng runtime env sau build. Hosted systemflag phải tồn tại; chưa kiểm cấu hình Production.

## Kiểm chứng

- **47 regression case mới**:27API+20UI, RED16fail/31pass trước sửa → GREEN47/47. Kiểm ảnh/video/tài liệu, exact/below/above cap, missing/invalid/public0, auth401/403/File400, local20/200MiB, cả lượt chọn có file lỗi, upload tuần tự/tổng lượt chọn lớn hơn4MB, draft/assets/imageURL, picker chọn lại và link video cũ.
- **Spec và quality review đều APPROVE đúng7hash.** Worktree và repo chính mỗi nơi qua lần QA mới riêng biệt: **58 file / 1.051 scoped test +22policy**, TypeScript nonincremental và ESLint src+nextconfig+newtests đạt, lint0error/0warning. 47case mới đã nằm trong1.051, không cộng các lượt chạy. Không sửa tests/config/deadline/pool cũ hoặc chạy lại tới xanh.
- Actual installed Next config loader/staticEnv probes ở cả hai root đạt đúng3numeric publickeys:4000000 trên hosted,0 trên local; hai key61/62 và proxy67108864byte giữ nguyên. Không chạy full Next build hay kiểm emitted browserbundle/hydration.
- Tests dùng metadata File.size, fake service/auth/transport; không upload file lớn thật, dùng DB thật hoặc coi scoped QA là nghiệm thu browser/native/3role/Production. API tests xác minh service boundary, không chứng minh file base64 lớn luôn lưu được vào database online.

Snapshot506publicpaths/367source-config-test,20primarydirty/255WTdirty và1882old artifacts được bảo toàn; chỉ7source/test+4docs. Source/docs default redacted secret scans, whitespace, exact-scope và backups/hash-inventory là cổng tích hợp. Progress nối mục63, không sửa lịch sử failedgate hoặc publication59–62.

Evidence riêng tư: `.local/performance/official-doc-upload-size-20261030/`. Không commit env/DB/token/log hoặc dữ liệu nghiệp vụ. Production vẫn code965e8e9 ở mục59;60–63 chưa publish.

## Giới hạn còn lại

- Whole-selection preflight chỉ tránh partial upload do **size-invalid đã biết trước**. Lỗi mạng/service giữa lượt upload vẫn có thể để lại temp asset; chưa atomic batch/rollback/cleanup/idempotency/single-flight hoặc validation toàn bộ response. Không báo các phần đó đã được sửa.
- `formData()` vẫn đọc body trước server size gate, platform có thể reject trước handler. File cap không phải giới hạn toàn multipart/extra fields/filename, response/download, tổng lượt chọn, DB/base64 payload hoặc số lượng asset.
- Video/file lớn cần thiết kế storage/job/quyền/chi phí riêng nếu muốn upload trực tiếp. Giữ local20/200MiB không bảo đảm runtime, bộ nhớ hoặc database chấp nhận mọi file đó.
- Chưa sửa toàn bộ uploadsNode0TB/KPI/backup, download asset cũ hoặc backup/restore. Historical auth/native Windows/libSQL/KPI-timeout, Node0TB strictvisual/timing, full Next/browser/3role và CI/RUM vẫn mở. Toàn Task12/release chưa được nghiệm thu; không có số đo để tuyên bố tăng tốc Production.

Policy4MB chừa multipart headroom so với cap4.5MB toàn body theo [Vercel Functions limits](https://vercel.com/docs/functions/limitations), không bảo đảm mọi multipart ở cap đều vừa. [Next config env](https://nextjs.org/docs/app/api-reference/config/next-config-js/env) là legacy API còn được hỗ trợ, inline giá trị vào bundle lúc build; không nâng stack hay thêm compiler plugin trong batch này.
