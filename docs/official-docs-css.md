# Thử tách CSS công văn — không nhận vào app

Ngày: **28/10/2026**. Phạm vi: thử nghiệm local thuộc Task 8, không đổi thiết kế hoặc nghiệp vụ. **Kết luận: không đạt mục tiêu giảm lượng tải, đã giữ lại application code trước thử nghiệm.**

## Mục tiêu và cách thử

- Chuyển CSS chỉ công văn dùng khỏi stylesheet KPI chung, giữ nguyên top-level lazy panel và SSR mặc định.
- Giữ hooks/state trong shell để không làm mất bộ lọc/draft hoặc buộc API chờ tải code. Không đổi bundler, dependencies, auth/API/schema hay công thức.
- Candidate có 71 class/99 rule, gồm 83 rule thường và 16 rule trong media 900px; bốn rule panelState dùng chung vẫn ở file cũ. 102 class references chuyển sang module riêng, không đổi JSX behavior.
- Kiểm tra canonical AST, thứ tự, media ancestry, specificity, 344 declarations và ba important của phần chuyển. Đảo import/prefix phục hồi panel cũ sau chuẩn hóa CRLF. Audit 16 consumers; 20 UI test files cũ không đổi.

## Kết quả thực tế

| Kiểm tra | Trước | Candidate | Nhận xét |
|---|---:|---:|---|
| CSS decoded tải ở KPI cá nhân | 164.879 byte | 165.001 byte | **Tăng 122 byte**, không đạt |
| Stylesheet responses ở KPI cá nhân | 3 | 3 | Không có stylesheet công văn deferred riêng |
| JS decoded ở KPI cá nhân | 639.813 byte | 637.206 byte | Giảm 2.607 byte trong build thử; không nhận candidate chỉ vì số này |
| Candidate regression mới | RED 7 fail/1 pass | GREEN 8/8 | Test source separation không chứng minh compiled CSS được lazy |
| Candidate full suite | — | 64 file/823 test +22 policy | Types/build đạt, login static; lint 0 error/2 warning cũ |
| Đối chiếu visual | 48 baseline | 48 khớp | Computed styles và PNG hashes giống nhau |
| Giữ draft Tính KPI | Policy ở mục 29 tiến độ | 6/6 đạt | Không đủ để thay thế gate CSS thất bại |

34 ca Chrome được chạy trên API thật của fixture SQLite giả: ADMIN 11 view, MANAGER 4 view, CTV 2 view, mỗi role trên desktop/mobile. Comparator API/settled UI được thực thi trước assertion lượng CSS; runner **kết thúc exit 1** ở “Personal CSS must actually shrink”. Không có báo cáo browser-after PASS; không coi toàn bộ gate browser đã đạt.

Diagnostic độc lập ở KPI cá nhân xác nhận CSS asset 68.267 byte chứa **cả docsToolbar/docUrlModal và shared panelState**; tổng ba asset vẫn 165.001 byte. Đây là bằng chứng output build hiện tại vẫn gom CSS công văn vào phần tải eager, không chỉ là suy luận từ source imports. Không quy kết lỗi framework phổ quát hoặc cho rằng đổi SSR/bundler chắc chắn giải quyết được.

Visual fixture riêng chỉ dùng kiểm tra CSS: dữ liệu công văn và ảnh tổng hợp được fulfill trong browser, không thay cho API-equivalence gate. ADMIN: 390/768/900/1024/1440px × sáng/tối × empty/detail/editor/modal; MANAGER/CTV: 390/1440px × sáng/tối × detail. Không chứng nhận hover/focus, screen reader, mọi loại nội dung hoặc điện thoại thật.

## Quyết định và trạng thái giữ lại

- Spec review xác nhận lossless extraction; quality review **REJECT integration** do runtime acceptance thất bại. Không bỏ/nới assertion, đổi bundler, dùng ssr:false hay inline style injection để ép đạt.
- Lưu bốn file candidate, diff/hashes, CSS build và logs vào evidence private; hoàn nguyên **chỉ bốn file thử nghiệm** về preimage sau đối chiếu hash. Không reset Git hoặc bỏ 65 thay đổi local đã có.
- Candidate mới thêm unit test/CSS không còn trong app. Những con số 823 test/48 visual/637.206 byte là kết quả candidate bị loại, không phải app hiện tại.
- 405 file snapshot khớp lại trước khi ghi tài liệu; 323 source/config/test giữ nguyên. Preview candidate đã dừng: build trong checkout thử nghiệm không còn khớp source được phục hồi, **phải build lại trước khi tái sử dụng next start**.
- Chỉ bổ sung guide/plan/roadmap/tiến độ. Full primary sau phục hồi **không đạt**: 62/63 file, 801/815 test hoàn tất, một worker crash `3221225477/0xC0000005` tại `tests/integration/cache-invalidation.test.ts`. Runner dừng sau lỗi, không chạy lại suite/skip/đổi pool. Policy22/22, TypeScript và lint được chạy độc lập sau đó và đạt (0 error/2 warning cũ), không thay kết quả suite thất bại.
- Đối chiếu lại 323 source/config/test với snapshot và hai checkout khớp byte. Đây là bằng chứng giữ nguyên source, **không phải nghiệm thu native hoặc release**; không xác minh native stack/nguyên nhân chính xác của lần crash mới.

## Giới hạn và việc tiếp theo

1. Task 8 vẫn chưa hoàn tất: hook/view ownership và selective CSS/deferred loading cần thiết kế/đo lại; không lặp source-only extraction rồi tuyên bố nhanh hơn.
2. Nếu thử ranh giới route/view khác, giữ contract ngày/CTV/scope/draft của calculator, direct link, SSR và API không chờ code. Cần before/after cùng fixture, byte/loading gate, visual và permission regression riêng.
3. Có thể tiếp tục Task 9 bằng đo payload marker thực tế và đối chiếu semantics trước khi sửa DTO; đây là hướng còn lại của roadmap, chưa được triển khai trong thử nghiệm này.
4. Source CSS cũ có CRLF: 82.327 byte raw/78.422 byte normalized; shared candidate 66.405 và phần tách 12.047 byte. **Không dùng chênh lệch raw source làm network savings.** Các số CSS/JS ở bảng là decoded body, không phải compressed transfer, latency hoặc p95/Production.
5. Nút Chèn ảnh URL nằm trong label có sẵn làm accessible name khác visible text; helper visual dùng visible text locator. Chưa sửa markup/a11y trong slice hiệu năng này, cần follow-up Task 11.
6. Native Windows/libsql reliability, auth/version/revocation/nhiều instance/single-flight và nguyên nhân me500 cũ vẫn mở. Full suite đạt không đóng các gate này.

## Evidence local

Private: `.local/performance/official-docs-css-20261028/`.

- `starting-files.json`, `review-hashes.json`, `review-delta.diff`, `original-kpi.module.css`.
- `browser-before.json`, `browser-after.log`, `browser-after-error.log`, `css-hoisting-diagnostic.json`.
- `worktree-verification.json`, `worktree-*.log`; `visual-before.json`, `visual-after.json`, PNG/computed styles; `draft-browser-after.json`.
- `rejected-candidate/`, `baseline-retained.json`, `reviews.json`, `primary-retained-verification.json`, `primary-retained-static-verification.json`, `docs-only-integrated.json`.
- Visual helper v1 dùng sai role/name locator; diagnostic v1 dùng sai tên docImageUrlModal thay vì docUrlModal: source/log lỗi được giữ. Chỉ sửa helper; gate CSS thất bại gốc không thay đổi hoặc chạy lại để ép PASS.

Không commit logs, SQLite, env, cookie, credentials hoặc response body. Chưa commit/push/deploy; release đã xác minh gần nhất vẫn `9d0365e`.
