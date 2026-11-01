# Chuẩn bị phát hành FTTH — 01/11/2026

## Trạng thái

**Database Production đã nâng và đối soát thành công; đang chuẩn bị commit/push/deploy source.** Project đích là `kpidi-linh`, web `kpidi-linh.vercel.app`; cấu hình Vercel được kiểm tra trước phát hành là chưa nối tự động deploy Git.

## Kết quả nâng database ngày 01/11/2026

- Owner xác nhận lại: “Đã ngừng nhập/sửa, tiếp tục nâng database”. Giữ nguyên consent cũ; ghi consent lần hai riêng, không sửa thời gian xác nhận cũ.
- Lần thử thứ hai chạy đúng core/entry đã review, kiểm tra target, hai bản backup, catalog và dữ liệu live cả trước và dưới write lock.
- Ghi baseline adoption năm version đã đối chiếu, không thực thi SQL lịch sử. Runner chỉ áp dụng `20261031000000_add_cuoc_ftth`; cả baseline và FTTH đã nhận xác nhận commit thành công, ledger hiện `current` với sáu version.
- Đối soát sau nâng: schema/nội dung của 25 bảng cũ, sequence và database headers giữ nguyên; không có vi phạm foreign key. Cả tám runtime domain sẵn sàng; mặc định FTTH 99,5%.
- Hai bản backup trước nâng được giữ nguyên. Owner có thể tiếp tục nhập/sửa sau khi được thông báo nâng xong. Không restore snapshot lên dữ liệu đang dùng hoặc chạy lại baseline.
- Evidence private: `owner-upgrade-consent-attempt2.json`, `production-upgrade-attempt2-started.json`, `production-upgrade-attempt2-result.json`; báo cáo lỗi lần đầu vẫn còn nguyên. Các mục chờ bên dưới mô tả checkpoint trước khi nhận xác nhận lần hai, không phải trạng thái database hiện tại.

## Cập nhật lần tiếp tục ngày 01/11/2026

- Owner đã đồng ý phạm vi baseline adoption và nâng FTTH, đồng thời tạm ngừng nhập/sửa. Helper thực thi được kiểm thử và review trước khi chạy.
- Lần đầu lỗi `ECONNRESET` ở `pre-write-content-verification`: `writeAttempted=false`, số lệnh ghi được duyệt đã thử bằng 0, baseline và FTTH chưa commit. Giữ nguyên marker và báo cáo lỗi; không xóa bằng chứng để chạy lại.
- Chẩn đoán chỉ đọc sau lỗi đối chiếu đủ 25 bảng: số dòng/checksum nội dung, schema, sequence và database headers khớp backup; không có vi phạm foreign key. Đây là kết quả tại thời điểm chẩn đoán, không thay thế kiểm tra live trước lần thực thi tiếp theo.
- Chuẩn bị entry cho đúng một lần thử có kiểm soát: chỉ nhận lần lỗi trước đã chứng minh chưa ghi, báo cáo/marker mới riêng, giữ nguyên core và kiểm tra target/backup/proposal/catalog. Review độc lập duyệt đúng hash của core và entry; review không thay quyền của owner.
- Khi tiếp tục, xác nhận cửa sổ ngừng ghi cũ đã hơn ba giờ. Không sửa timestamp hoặc tái sử dụng để vượt guard 30 phút; đang chờ owner xác nhận lại. Lần thử thứ hai chưa chạy.
- Source ứng dụng giữ nguyên so với candidate đã kiểm tra; lượt local mới có **94 file / 1.655 case đạt**, 0 unhandled errors; types và lint đạt. Không chạy lại native integration Windows đã biết lỗi, không đóng gate68 hay nghiệm thu ba role.
- Vercel `deploy --dry --json` kiểm tra **541 file / 8.608.006 byte**: không có env, database, backup, thư mục private hoặc worktree; đủ ba API và migration FTTH. File ngoài inventory Git duy nhất là `next-env.d.ts` sinh bởi Next. Dry-run không upload, tạo deployment hoặc đổi alias.

Evidence bổ sung: `production-upgrade-failure.json`, `freshness-diagnostic.json`, `production-execution-review-attempt2.json`, `unit-ui-resume.log`, `types-resume-exit.json`, `lint-resume-exit.json`, `vercel-dry-resume-check.json` trong thư mục evidence private bên dưới. Các kết quả chuẩn bị không phải xác nhận phát hành thành công.

- Kiểm thử rộng lần đầu: 94 file, 1.653 đạt / 1 lỗi trong 1.654 case. Lỗi inventory cache chưa liệt kê API FTTH mới, không phải lỗi timeout auth.
- Bổ sung FTTH vào inventory; giữ nguyên kiểm tra AST generation trước async và đối với mọi lần ghi cache. Focused 20/20 đạt; lượt rộng mới **94 file/1.655 case đạt**, không thay timeout/pool hoặc bỏ test.
- TypeScript, ESLint không lỗi/warning; 48 recorder và 22 policy tests đạt.
- `next build`/Turbopack đạt trên snapshot source với khóa và database giả; output riêng, chặn đọc `.env` thật và không cung cấp credential Production. Cảnh báo workspace root do hai lockfile của snapshot được lưu, không sửa source chỉ để che cảnh báo.
- Quét 550 đường dẫn public không phát hiện token/private key theo các rule đã dùng; hai chuỗi dummy của CI/QA được đối chiếu riêng. Đây không phải cam kết mọi dạng secret đều được nhận diện.
- Vercel ban đầu trả 403; người dùng đã xác thực lại bằng luồng CLI chính thức. Token Turso loại Sensitive không được trích từ API Vercel: dùng credential local đã có, chỉ sau khi đối chiếu URL với cấu hình Production hiện tại; không in/lưu giá trị vào báo cáo.

## Preflight database trước nâng

Preflight ban đầu chỉ đọc xác nhận bảy domain cũ sẵn sàng, nhưng thiếu `CuocFtthDailyResult`/`CuocFtthConfig` và database chưa có ledger được xác minh (`untracked`). Khi đó deploy source mới ngay sẽ khiến FTTH và xuất backup mới lỗi schema. Không chạy toàn bộ catalog trên database này để vượt guard. Trạng thái sau nâng được ghi ở đầu tài liệu.

Sau khi người dùng chọn chuẩn bị sao lưu/nâng cấp an toàn:

1. Snapshot online bằng một batch `read` transaction, chỉ SELECT; không sửa dữ liệu Production.
2. Phục hồi ra SQLite trong thư mục riêng đã giới hạn ACL cho tài khoản hiện tại, SYSTEM và Administrators. File chứa dữ liệu nhạy cảm, luôn nằm dưới `.local/`, không đưa vào Git/Vercel/chat.
3. Đối soát đủ **25 bảng / 137.427 bản ghi** tại thời điểm snapshot; kiểm tra DDL, checksum nội dung kèm rowid, BLOB/integer, `sqlite_sequence`, integrity và foreign keys. Backup gốc không bị thay đổi khi chạy thử.
4. Thử riêng migration FTTH trên bản sao: cả tám domain sẵn sàng, tỷ lệ mặc định 99,5%, các bảng/nội dung cũ giữ nguyên.

Đây là snapshot logic nhất quán đã phục hồi/đối soát, không phải tuyên bố file SQLite bit-for-bit giống vật lý server. Số bản ghi phản ánh thời điểm snapshot, không bảo đảm database live không có phát sinh sau đó.

Có thêm bản sao đã xác minh checksum ngoài repo tại `D:/code/KpiDiLinh-backups/pre-ftth-20261101/production-before-ftth.sqlite`, cũng có ACL riêng, để không mất cùng thư mục source khi clone/xóa repo. Hai bản vẫn ở cùng ổ D; không thay thế backup ngoài máy hoặc quy trình khôi phục của nhà cung cấp.

## Phương án nâng cấp đã duyệt và thực hiện

- Đối chiếu 25 bảng với schema dựng từ năm migration đầu: columns/types/null/default/PK/FK và toàn bộ index canonical khớp.
- DDL của 25 bảng chỉ khác xuống dòng/khoảng trắng ngoài literal. Ba index `idx_official_doc_category`, `idx_official_doc_revision_doc_changed`, `idx_official_doc_temp_asset_created` cũng chỉ khác trình bày; literal và predicate không bị chuẩn hóa bỏ qua.
- Giữ nguyên bốn index không unique bổ sung. Index unique `idx_node_0tb_node_code` trùng ràng buộc unique `nodeCode` đã có, được đối chiếu field/collation/partial và giữ nguyên; không drop index cũ.
- Sau khi owner duyệt đúng manifest/target: ghi **baseline adoption đã đối chiếu** vào bảng lịch sử migration, không giả định năm file SQL đã từng chạy và **không chạy lại chúng**. Tiếp đó runner hiện có bỏ qua năm version này và chỉ áp dụng version FTTH mới.
- Đã thử trên ba bản sao của backup thật: nâng thành công; lỗi giữa lúc ghi baseline rollback toàn bộ baseline; lỗi sau SQL FTTH rollback FTTH và giữ baseline đã commit. Tất cả giữ checksum dữ liệu cũ.

**Hai bước commit riêng.** Nếu FTTH lỗi, chỉ transaction FTTH rollback; năm bản ghi baseline đã commit vẫn còn. Phải dừng, kiểm tra trạng thái, không xóa ledger hoặc tự phục hồi snapshot đè lên dữ liệu phát sinh.

## Điều kiện trước khi thực hiện

1. Owner xác nhận riêng việc baseline adoption và nâng FTTH trên đúng Production, đồng ý khoảng thời gian tạm ngừng nhập/sửa dữ liệu.
2. Review helper thực thi; kiểm tra lại target/backup/catalog checksum, schema và ledger dưới write lock. Hồ sơ chuẩn bị không tự cấp quyền ghi.
3. Ghi metadata baseline theo đúng manifest, chạy riêng FTTH qua runner, kiểm tra ledger/runtime/FK và đối soát dữ liệu. Kết quả commit không rõ phải dừng và kiểm tra lại, không replay mù quáng.
4. Chỉ khi database và các cổng phát hành đạt mới commit/push đúng candidate, deploy có kiểm tra trạng thái/alias và smoke; không promote candidate68 từ worktree.

Native libSQL Windows, full integration và trình duyệt thật ba role vẫn chưa được nghiệm thu đầy đủ; lần unit/UI hoặc build đạt không tự đóng những gate đó. Không tuyên bố tăng tốc Production từ các kết quả này.

Evidence private: `.local/deployment/production-publish-20261101/` gồm log lượt lỗi/lượt sửa, build, preflight, ACL, backup/shadow, schema diff, proposal V1–V3 và addendum. Không commit các file này.
