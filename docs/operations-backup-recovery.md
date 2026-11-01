# Backup ngoài máy và phục hồi — checklist vận hành

Ngày đối chiếu: **01/11/2026, Asia/Saigon**. **Mới chuẩn bị quy trình; chưa có backup ngoài máy hoặc lịch tự động được xác minh từ đợt này.** Không thay application code, settings, provider, auth, dữ liệu hoặc deployment.

## 1. Trạng thái và phạm vi

- [Phát hành FTTH](ftth-production-release.md) ghi snapshot logic nhất quán trước nâng và phục hồi/đối soát bản sao thành công. Hai bản SQLite được giữ trong thư mục ACL riêng, một bản ngoài repo, nhưng vẫn cùng ổ D. Không bảo vệ được khi mất máy/hỏng ổ hoặc mất toàn bộ ổ D.
- Đó là backup **trước nâng FTTH**, không phải bản mới nhất sau khi người dùng tiếp tục nhập/sửa. Không dùng nó để khẳng định mọi dữ liệu FTTH mới đã được sao lưu.
- Production đã có baseline ledger và schema FTTH. Backup mới cần kiểm tra bao phủ dữ liệu/schema FTTH và xử lý ledger đúng định dạng, không tự thêm baseline dựa vào tên bảng.
- Chủ dữ liệu chưa chọn nơi lưu ngoài máy. Không tự copy vào thư mục đồng bộ, tạo tài khoản/dịch vụ, bật paid tier hoặc gửi dữ liệu lên Git/GitHub Actions/Vercel artifacts.

## 2. Phân biệt định dạng trước khi khôi phục

| Định dạng | Công dụng / giới hạn |
| --- | --- |
| JSON xuất bằng `GET /api/admin/backup` | Backup nghiệp vụ của ứng dụng, có collection FTTH theo source mới; không phải snapshot SQLite vật lý và không mang migration ledger. Đối chiếu contract của `src/app/api/admin/backup/route.ts` và `docs/migration-safety.md` trước restore. |
| SQLite phục hồi từ snapshot logic | Schema + dữ liệu được snapshot/đối soát theo manifest. Bản trước nâng không có ledger/FTTH mới; bản mới cần kiểm chứng catalog/ledger tương ứng. Không tải file `.sqlite` vào UI nhận JSON. |
| Gói mã hóa để lưu ngoài máy | Chỉ là lớp bảo vệ của một trong hai định dạng trên, không phải định dạng restore mới của app. Phải giải mã và xác minh ở máy kiểm thử trước; app hiện không được bổ sung khả năng giải mã. |

JSON restore trên web Vercel hiện có cap **4.000.000 byte**, không phải hỗ trợ file lớn tùy ý. Không đổi đuôi, chia nhỏ/chỉnh backup hoặc tăng timeout/body limit để lách cap. File lớn cần quy trình phục hồi offline được kiểm thử riêng. **Mở localhost không đồng nghĩa dùng database local**: luôn xác minh target, tránh vô tình trỏ Production.

## 3. Thông tin cần chốt trước khi chạy

| Mục | Trạng thái / quyết định cần có |
| --- | --- |
| Nơi lưu | Chờ owner chọn USB/ổ ngoài hoặc thư mục cloud cá nhân được phép chứa dữ liệu này; cần đường dẫn đích thực tế. |
| Truy cập và mã hóa | Backup chứa dữ liệu cá nhân/tài khoản. Chốt công cụ mã hóa và kiểm thử giải mã trước; mật khẩu/khóa không gửi trong chat, Git, log hoặc lưu cạnh backup. Owner cần giữ khóa và bản dự phòng riêng. Chưa triển khai công cụ mã hóa. |
| Tần suất/retention | Chốt lịch sao lưu và số phiên bản giữ lại theo dung lượng/nhu cầu; không overwrite bản tốt duy nhất, không tự xóa bản cũ trong lúc chuẩn bị. |
| Mức mất dữ liệu chấp nhận (RPO) | Owner chốt khoảng thời gian tối đa có thể mất dữ liệu; chỉ có lịch dự kiến chưa phải bằng chứng đạt RPO. |
| Thời gian phục hồi mục tiêu (RTO) | Chốt mục tiêu và đo bằng drill thật trên DB riêng; không hứa thời gian khi chưa thử. |
| Người chịu trách nhiệm | Chốt người chạy, người nhận cảnh báo và nơi giữ khóa; có bước xử lý khi máy tắt, ổ ngoài vắng hoặc cloud hết dung lượng. |

Thư mục cloud đồng bộ không tự là cơ chế backup: xóa/ghi đè có thể đồng bộ theo. Cần xác minh version/retention và khả năng phục hồi; chỉ chuyển gói đã được bảo vệ sau khi owner đồng ý. USB/ổ ngoài cần xác minh không trùng ổ D và nên ngắt kết nối sau khi kiểm tra xong.

## 4. Checklist thực hiện sau khi chốt nơi lưu

- [ ] Xác minh target và phạm vi được phép đọc; dùng phương thức snapshot nhất quán đã được review. Không copy trực tiếp SQLite đang ghi mà bỏ sót WAL, không dùng tài khoản/API để xóa hay sửa dữ liệu trong bước backup.
- [ ] Tạo **backup mới sau nâng FTTH** trong thư mục private/ACL riêng, khác mọi backup cũ. Không chạy lại helper baseline/nâng FTTH để tạo backup, không sửa marker lịch sử để tái sử dụng.
- [ ] Tạo manifest private gồm thời điểm, fingerprint đích không chứa credential, định dạng, schema/migration version, dung lượng và SHA-256. Đối soát table/collection counts và content checksum theo hợp đồng; không ghi business rows, token, password hash hoặc cookie vào log.
- [ ] Với snapshot database, xác minh integrity, foreign keys, schema/ledger và FTTH. Với JSON, xác minh collection/shape và quy trình schema riêng: không giả định JSON phục hồi ledger.
- [ ] Mã hóa bằng phương án đã chốt, kiểm tra có thể giải mã; giữ key riêng. Chỉ bản mã hóa đúng phạm vi được phép mới chuyển sang nơi lưu ngoài máy.
- [ ] Copy sang tên/phiên bản mới tại đích. So SHA-256 của **cùng gói mã hóa** ở nguồn/đích; sync đang chạy hoặc thông báo copy thành công chưa chứng minh dữ liệu đã toàn vẹn/được giữ ngoài máy.
- [ ] Tải/đọc lại từ đích và giải mã vào thư mục kiểm thử private, đối chiếu SHA-256 plaintext với manifest. Không log nội dung hoặc upload bản giải mã lên CI.
- [ ] Hoàn thành restore drill dưới đây trước khi coi backup ngoài máy là usable. Chỉ sau đó mới tự động hóa lịch/retention/notification bằng công cụ được duyệt.

## 5. Restore drill và điều kiện đạt

1. Tạo database/file mới do drill sở hữu, không ghi đè Production, local đang dùng hoặc bản backup gốc. Xác minh đường dẫn/URL trước mọi thao tác ghi; với file local, chặn network trong môi trường drill để tránh trỏ nhầm remote.
2. Giải mã và phục hồi bản đọc lại từ nơi lưu ngoài máy theo đúng định dạng. Không tự chạy migration cũ, `db push` hoặc baseline adoption để bỏ guard. JSON và SQLite có quy trình khác nhau; nếu thiếu ledger/schema thì dừng và lập phương án được phê duyệt.
3. Kiểm tra integrity/FK khi áp dụng, schema/runtime domains, catalog/ledger phù hợp và checksum/counts. FTTH/CD/config phải khớp manifest; **không reset tỷ lệ về 99,5%** nếu backup chứa tỷ lệ owner đã chỉnh.
4. Kiểm tra quan hệ User/Customer/Node và đối soát tổng hợp KPI/CD/FTTH mà không in dữ liệu thật vào báo cáo. Browser test ba role ưu tiên dữ liệu giả/anonymized; không đưa raw restored database vào Git/CI hoặc nơi truy cập công khai.
5. Ghi thời gian khôi phục đo được, tuổi snapshot, checksum khớp/không khớp và kết quả kiểm tra, không chép dữ liệu nghiệp vụ. Nếu lỗi thì giữ bản tốt cũ và bằng chứng lỗi, không tự retry ghi vào database đang dùng.

**Điều kiện đóng:** có bản mới thực sự ngoài máy, kiểm tra mã hóa/khóa và checksum đọc lại, phục hồi trên DB riêng đạt, owner giữ được khóa, có lịch/retention/người chịu trách nhiệm cùng RPO/RTO đã chốt. Chưa đạt các điều kiện này thì không đánh dấu Task 12 hoặc vận hành backup hoàn tất.

## 6. Tách rollback source và dữ liệu

- Rollback deployment không đồng nghĩa rollback database. Giữ migration history, snapshot và dữ liệu phát sinh; đánh giá tương thích source/schema trước khi đổi phiên bản.
- Phục hồi dữ liệu lên Production là thao tác riêng có thể mất mọi thay đổi sau snapshot: cần owner duyệt target, phạm vi, khoảng ngừng ghi, backup mới trước restore và phương án đối soát/cutover. Hướng dẫn này không cấp quyền thực hiện.
- Nhật ký/manifest và bản giải mã phải ở nơi private. Không commit `.env`, JWT, backup, customer rows hoặc khóa mã hóa vào tài liệu này.

## 7. Giới hạn đợt chuẩn bị

Chưa đọc/snapshot database online, chọn nơi lưu, mã hóa, copy ngoài máy, restore dữ liệu thật, cài scheduler hoặc thay quyền truy cập trong đợt tài liệu này. Backup trước nâng vẫn chỉ chứng minh checkpoint trước nâng. Xem [plan chính](superpowers/plans/2026-10-26-web-ux-performance.md), Task 12–13 và [tiến độ](../tiendokpi.md).
