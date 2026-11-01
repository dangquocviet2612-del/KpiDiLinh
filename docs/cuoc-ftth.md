# Cước FTTH

## Phạm vi

- Menu **Cước FTTH**, cạnh **Cước CD**, mở `/prepaid?view=cuoc-ftth`.
- Giữ giao diện desktop/mobile, chọn ngày, tìm mã nhân viên/CTV, sắp xếp, phân trang, tổng hợp và import Excel giống CD. Dùng chung `CuocCdPanelClean`, `useCuocCdPanel`, parser và hàm tổng hợp của CD; không sao chép CSS hoặc thay nghiệp vụ CD.
- FTTH có dữ liệu, tỷ lệ và cache riêng. Không tự sao chép dữ liệu hoặc tỷ lệ đang chỉnh của CD sang FTTH. Tỷ lệ FTTH ban đầu **99,5%**, bằng mặc định CD trong code; sau đó ADMIN chỉnh độc lập.

## Phân quyền

| Role | Xem | Import | Sửa tỷ lệ |
| --- | --- | --- | --- |
| ADMIN | Các dòng khớp tài khoản/mã phụ đã đăng ký, giống CD | Có | Có |
| MANAGER | Phạm vi CTV được cấp và dòng khớp mã quản lý, giống CD | Có, thay dữ liệu FTTH của ngày import như CD | Không |
| CTV | Dòng khớp tài khoản của mình, giống CD | Không | Không |

API kiểm tra quyền trước schema/SQL. Import của MANAGER giữ quyền thay báo cáo theo ngày như CD, **không phải** chỉ ghi các dòng thuộc nhóm của mình. Tỷ lệ nhận số hữu hạn từ 0 đến 200; không nhận chuỗi, null hay boolean.

## Luồng dữ liệu

| Entry point | Xử lý | Lưu trữ |
| --- | --- | --- |
| `GET /api/cuoc-ftth/report?reportDate=YYYY-MM-DD` | Mặc định ngày mới nhất; lọc role/tài khoản; tính lại theo tỷ lệ đã lưu; trả tổng hợp | `CuocFtthDailyResult`, `CuocFtthConfig`, `User` |
| `GET /api/cuoc-ftth/config` | Đọc tỷ lệ; mặc định 99,5 nếu thiếu bản ghi | `CuocFtthConfig`, khóa `id=1` |
| `POST /api/cuoc-ftth/config` | ADMIN lưu tỷ lệ, ghi audit, xóa cache FTTH | `CuocFtthConfig`, audit action `CUOC_FTTH_CONFIG_UPDATE` |
| `POST /api/cuoc-ftth/import` | Cùng định dạng XLSX/parser CD; ánh xạ mã phụ sang username; transaction thay một ngày FTTH; chia lô tối đa 800 bind | `CuocFtthDailyResult`, đọc `User` và tỷ lệ FTTH |

`thuaThieu = ceil(dauKy × targetRatePercent / 100 − luyKe)`; `tonChuaThu = dauKy − luyKe` làm tròn 2 chữ số, giống CD. Cache dùng tiền tố `cuoc-ftth:report`, không dùng/xóa cache CD khi import hoặc sửa tỷ lệ FTTH. Mở một panel không tải dữ liệu panel kia. Khóa React riêng làm mới tìm kiếm/sort khi đổi CD ↔ FTTH.

`src/proxy.ts` áp dụng cùng giới hạn import **6 yêu cầu/phút theo endpoint/IP** như CD. Bộ đếm ở bộ nhớ tiến trình, không phải quota phân tán giữa các instance Vercel. Test `tests/unit/cuoc-ftth-proxy.test.ts` kiểm tra ngưỡng, hết cửa sổ và tách budget CD/FTTH/IP.

## Backup và khôi phục

Backup ADMIN có thêm `cuocFtthDailyResults` và `cuocFtthConfigs`. Shape guard vẫn kiểm tra các collection trước schema/ghi dữ liệu.

- Thiếu cả hai key trong backup cũ: không kiểm tra schema FTTH, không xóa/ghi FTTH và không thay tỷ lệ FTTH hiện tại.
- Có key dữ liệu với `[]`: xóa các dòng FTTH; không phải bỏ qua key.
- Có key cấu hình với `[]`: khôi phục mặc định 99,5%. Có cấu hình hợp lệ: giữ đúng tỷ lệ của backup.
- Backup đầy đủ có đọc FTTH, nên cần nâng schema trước khi xuất backup bằng phiên bản app mới. Đây không phải bằng chứng nghiệm thu toàn bộ quy trình disaster recovery.

## Điều kiện chạy và phát hành

Migration mới: `prisma/migrations/20261031000000_add_cuoc_ftth/migration.sql`. Tạo hai bảng FTTH, unique key theo ngày/mã nhân viên và các index; seed 99,5%. Không đổi bảng/dữ liệu CD. Runtime domain `cuocFtth` tách khỏi `kpi`; request chỉ kiểm tra, **không** tự tạo bảng/seed.

Production `kpidi-linh` đã được owner phê duyệt và nâng riêng ngày 01/11/2026; baseline adoption năm version được đối chiếu trước khi chỉ áp dụng migration FTTH. Tám domain sẵn sàng, mặc định 99,5%, schema/nội dung cũ được đối soát giữ nguyên. Xem `docs/ftth-production-release.md` để phân biệt trạng thái database với trạng thái phát hành source. Với database đích khác, trước khi dùng FTTH:

1. Sao lưu bằng phiên bản đang chạy và xác minh khả năng khôi phục; xác định rõ database đích, không đưa token vào Git/chat.
2. Kiểm tra ledger và migration còn thiếu theo quy trình `scripts/release-migrations.mjs`. Script không tự nạp `.env`; database cũ thiếu ledger đã xác minh phải dừng để lập phương án baseline, không ép chạy toàn bộ migration hoặc dùng `db push`.
3. Chỉ áp dụng migration sau khi được chủ dữ liệu cho phép; remote cần phê duyệt riêng. Không dùng build/deploy để tự chạy migration.
4. Kiểm tra schema `cuocFtth`, thử ba role, import file mẫu FTTH, sửa tỷ lệ, đối chiếu CD không đổi và backup/restore trên bản sao trước phát hành.

Nếu chưa có bảng, FTTH và xuất backup mới trả lỗi schema; các domain KPI/CD cũ không bị buộc phụ thuộc domain FTTH. Không tắt readiness guard để che lỗi.

## Kiểm thử và giới hạn

- Unit FTTH dùng SQLite trong bộ nhớ, XLSX giả và mock session: migration/readiness, mặc định, quyền, phạm vi báo cáo, công thức, cache/data tách CD, import theo lô/rollback, backup roundtrip và backup cũ.
- UI kiểm tra menu ba role, branding CD/FTTH, tỷ lệ ADMIN, endpoint riêng, panel đang mở và tải dữ liệu có điều kiện. Tests liên quan: `tests/unit/cuoc-ftth.test.ts`, `tests/ui/cuoc-ftth.test.tsx`, `tests/ui/prepaid-view-loading.test.tsx`.
- Test native `tests/integration/runtime-schema-contract.test.ts` cập nhật catalog 6 migration, 8 domain/9 metadata-default reads và fixture replay phần đuôi; chưa chạy do vấn đề libSQL native Windows còn mở. Không dùng mock/unit thay kết luận cho native integration hoặc web thật.
- Giới hạn checkpoint triển khai ban đầu: chưa nghiệm thu Next build/trình duyệt ba role, dữ liệu thực, hiệu năng thực tế hoặc migration Production. Kết quả build và nâng Production bổ sung được ghi tại tài liệu phát hành; không tự đóng giới hạn native Windows, trình duyệt ba role, template và hiệu năng.
- Chưa có file báo cáo FTTH thực tế để đối chiếu; import hiện kỳ vọng đúng template XLSX của CD theo yêu cầu dùng chung chức năng.

## Nghiệm thu nâng cấp trên SQLite giả lập (01/11/2026)

`tests/unit/cuoc-ftth-upgrade.test.ts` bổ sung 11 kiểm thử dùng migration runner và catalog SQL thật. Mỗi ca tạo một file SQLite riêng trong thư mục tạm do test sở hữu, dùng `node:sqlite` qua adapter chỉ dành cho test; không lấy URL/token từ môi trường hoặc truy cập database đang dùng.

- Khởi tạo từ trống qua đủ 6 migration, seed FTTH 99,5%, kiểm tra 8 runtime domain bằng 9 truy vấn chỉ đọc metadata/defaults.
- Nâng fixture có 5 migration lên FTTH: giữ toàn bộ schema cũ, nội dung các bảng cũ, lịch sử ledger và tỷ lệ CD/Cước đã chỉnh. Fixture có dữ liệu giả User, Customer, Node, Cước CD và KPI; nhiều bảng khác vẫn rỗng. Đây **không phải** bản sao/anonymized của database đã phục hồi.
- Chạy lại khi đủ 6 migration: bỏ qua phiên bản đã áp dụng, giữ tỷ lệ FTTH giả lập 84% và dòng dữ liệu đã nhập.
- Từ chối database có ledger thiếu, rỗng, sai checksum hoặc đứt thứ tự; không tự adopt, nâng schema hoặc sửa dữ liệu.
- Chèn SQL lỗi sau các statement FTTH trong catalog thử nghiệm: transaction rollback toàn bộ phần FTTH, dữ liệu/schema cũ không đổi, migration thứ sáu vẫn pending. Không sửa file migration để tạo lỗi.
- Trước nâng cấp, FTTH báo thiếu schema nhưng KPI cũ vẫn sẵn sàng. Thiếu cột hoặc unique key FTTH thì từ chối, không sửa schema. Ngoài đối chiếu trạng thái, test ghi nhận từng SQL validator và yêu cầu SELECT-only, nên không coi snapshot không đổi là đủ chứng minh không thử DDL.

Đây là kiểm chứng runner/SQL/validator trên SQLite cục bộ, **không phải** nghiệm thu native `@libsql/client`, CLI/env handling, Prisma, Turso, cạnh tranh nhiều process/region, backup/restore database thật hay quyền phát hành. Không chạy lại bộ native Windows đang có lỗi chỉ để thay kết quả cũ bằng một lần xanh. Trước khi bật trên database thật vẫn phải sao lưu, xác minh ledger và xin phê duyệt đích nâng cấp.

## Chuẩn bị Production

Đợt kiểm tra/sao lưu online, thử nghiệm trên bản sao dữ liệu thật và nâng Production sau phê duyệt được ghi riêng tại `docs/ftth-production-release.md`. Database đã sẵn sàng; xem tài liệu phát hành để biết trạng thái push/deploy. Những kết quả này không thay các giới hạn của unit test nêu trên hoặc tự cấp quyền baseline/nâng schema cho database khác.
