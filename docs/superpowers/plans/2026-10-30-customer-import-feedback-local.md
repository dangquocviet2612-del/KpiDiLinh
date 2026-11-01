# Customer import feedback — local slice of Tasks 11/12

**Scope:** Giữ POST `/api/import`, FormData/file, importer SQL/transactions/roles, parser, API contract và CSS. Sửa client feedback khi gateway413/non-JSON, contract thành công sai, gửi trùng trong cùng lượt; phân biệt import đã xác nhận với lỗi CSV/refresh sau đó. Không tự đổi giới hạn file, config/env/hosting, thêm storage/job/cost hoặc gọi database thật. Không commit/push/deploy đợt này.

**Evidence:** Customer page hiện awaitres.json trước xét status; successful malformed object có thể báo0/0success; không synchronous guard; CSV/refresh failures bị lẫn hoặc unhandled. API trả sốadded/updated không âm, errors optionalstring[], errorCsv optionalstring. Vercel giới hạn toàn request4.5MB, không phải chỉ file: https://vercel.com/docs/functions/limitations và https://vercel.com/docs/errors/function_payload_too_large (đối chiếu30/10/2026). Slice này chỉ xử lý phản hồi413, **chưa** preflight file-size/multipart hoặc giải quyết upload lớn.

## Checklist

- [x] Đọc roadmap/code/contract, snapshot493paths/360source, reuse existingWT với source byte-equal primary. Giữ published59 và old reports.
- [x]27regression trên app cũ: RED21fail/6pass (27), đúng các lỗi feedback/ack/duplicate/CSV/refresh; không đổi test cũ. GREEN27/27, không unhandled rejection ở candidate.
- [x] Sửa riêng customerpage; busyinput hiện có, refguard synchronous, captureinput; strictknownsuccessshape trước report/toast/refetch/URL replace; không tự retry POST hoặc nói mutation đã rollback khi lỗi mạng/5xx.
- [x] V2GREEN30/30, spec→qualityreview APPROVE đúng2hash cuối; freshWT vàprimary riêng mỗiroot52file924/924+22policy/types/lint0error0warning. Không đổi old tests/deadlines/pools/config/mocks để lấy xanh; không fullnative/build/browser acceptance claim.
- [x] Tích hợp local đúng2source/test+4docs có backups/defaultsecret/whitespace/hash-inventory guards; append60 giữ59đãpublish và cập nhật roadmap partial. Không tick wholeTask12/largefiles/native/auth/Node0TB/Next/3role/release.

## Gate disposition

V1focused27PASS, WTbroad52file920pass/1fail trên921: đúng GETusers4015000ms; giữ failurehash/pendingdisposition/candidate/review và QA không ghi đè. V2sửa P2 đã cóREDriêng chứ không rerun đểxóa failure: focused30PASS, **WT vàprimary freshV2 mỗiroot52file924/924+22policy/types/lint0warning đạt**. CurrentV2scoped acceptance đạt nhưng không chứng minh authfix hoặc waive historicalgate; rootunknown/releaseReadyfalse. Primary chỉ lưu local, không merge/commit/push/deploy. File-size/largeupload/fullnative/Next/3role/wholeTask12 còn mở.

**Success:**413hiển thị hướng dẫn chia nhỏ Excel mà không đọc JSON; data chưa được xác nhận không tạo report/success/refetch/revokeoldURL; validcounts/rowerrors/CSV như cũ. CSVlocal hoặc listrefresh lỗi không phủ nhận ack thành công, không unhandled rejection. Một POST tại một thời điểm; finally mở lại input và chọn lại cùng file. Những guard này không cung cấp server idempotency/cancel/rollback guarantee.

**Quality follow-up V2:** ReviewP2 xác minh khi CSVhỏng có>5errors thì phần còn lại bị ẩn dù toast nói vẫn xem được. Giữ candidate/review/QA V1. Regressionmới RED2fail/27pass (29), bổ sung controlCSVtốt: GREEN30/30. Chỉ thêm countstate/reset và fallback Hiệnthêmlỗi5dòng/lượt khi khôngCSV; dùng btnclass sẵn, typebutton/aria-controls/listid. CSVtốt vẫn5preview+download, không render toàn bộ lỗi ngay từ đầu hoặc đổi CSS/data/API. Spec và quality cần review lại đúng2hashV2; freshQA sau sourcechange không phải rerun để xóa failureV1.
