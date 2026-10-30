# KPI: cách ly bộ ghi nhận của test panel

Ngày: 29/10/2026. Phạm vi: **local, chỉ fixture kiểm thử**, nối tiếp mục 37 trong `tiendokpi.md`.

## Kết luận

- Đã tái hiện và ngăn một lỗi sở hữu trạng thái trong fixture `tests/ui/prepaid-view-loading.test.tsx`: mock factory hoặc component hoàn tất muộn có thể ghi vào bộ ghi nhận của test kế tiếp.
- **Chưa xác định nguyên nhân các timeout KPI 5 giây trước đây.** Các lượt đo mới không quan sát được factory/import vượt qua ranh giới testcase; không được đồng nhất lỗi fixture có thể tái hiện với nguyên nhân timeout chưa chứng minh.
- Không đổi giao diện, nghiệp vụ, API, query, auth, dependency, pool/isolation, timeout/hook budget hoặc assertions cũ. Không commit/push/deploy.

## Vấn đề có bằng chứng

Fixture đăng ký các async mock factory cho 11 panel. Trước thay đổi, factory đọc trực tiếp ba biến có thể được gán lại trong `beforeEach`: `evaluated`, `mounted`, `moduleGates`. Component giả cũng đọc `mounted` lúc mount và cleanup.

Nếu factory thuộc lần A được gọi hoặc hoàn tất khi các biến đã trỏ sang bộ ghi nhận B, nó có thể ghi nhận evaluation/mount vào B, bỏ qua gate của A hoặc xóa entry của B lúc unmount. Hai test mới chủ động tái tạo đúng sự thay đổi owner này, không chờ timeout hoặc phụ thuộc thứ tự chạy ngẫu nhiên.

| Hợp đồng | Regression xác định | Sửa tối thiểu |
| --- | --- | --- |
| Evaluation và chunk gate thuộc lần đăng ký | Giữ factory A, chuyển biến hiện hành sang B trước khi gọi; A phải ghi evaluation vào A và đợi gate A | Capture array và map tại lúc đăng ký factory |
| Mount/cleanup thuộc lần đăng ký, kể cả resolve muộn | B đã có entry cùng tên; resolve factory A rồi mount/unmount A, không được xóa entry của B | Truyền set của A vào `observePanel` và closure effect/cleanup |

`panelFactories` giữ **chính factory được truyền vào `vi.doMock`** để test hợp đồng này; không tạo bản sao thuật toán chỉ dùng cho regression. Fixture vẫn dùng implementation `next/dist/shared/lib/app-dynamic` thật. Toàn bộ 20 testcase cũ được giữ nguyên; kiểm tra so sánh phần thân sau chuẩn hóa CRLF/LF.

Đây không phải cơ chế hủy tất cả tác vụ async: không drain import, không hủy promise/chunk hoặc sửa pending report/fetch. Chỉ cách ly ba bộ ghi nhận nêu trên. `tests/ui/current-user-query.test.tsx` không thay đổi vì chưa có lỗi xác định đủ chứng cứ để sửa.

## Các lần chạy được giữ nguyên

Evidence riêng: `.local/performance/kpi-test-isolation-20261029/`. Không đưa log, env, database hoặc dữ liệu nghiệp vụ vào Git.

| Lượt | Kết quả thực tế | Điều có thể kết luận |
| --- | --- | --- |
| Original, hai file KPI | 76/76 đạt | Không tái hiện timeout trong cell này |
| Trace hai file | 76/76 đạt | Reporter mặc định không xuất trace của test đạt; không suy luận phase từ lần này |
| Trace broader, 34 file | 571/572 đạt; GET users trong `schema-auth-order.test.ts` timeout 5 giây | KPI đạt; toàn selection không đạt. Giữ failure và không sửa test không thuộc phạm vi |
| 207 phase/epoch events trong broader trace | Không quan sát loader/factory cross-epoch; shell import đầu khoảng 1.204 ms | Một quan sát bị ảnh hưởng instrumentation, không chứng minh nguyên nhân các lỗi trước |
| Ownership RED | Hai assertion fail đúng bộ ghi nhận, 20 testcase cũ đạt | Tái hiện lỗi fixture, không phải lỗi import/setup hay timeout |
| Ownership GREEN, hai file | 78/78 đạt | Hai regression mới đạt cùng 76 testcase trước |

Trace là chỉnh sửa tạm trên worktree, đã restore đúng preimage trước khi thêm regression. Không để trace hoặc instrumentation vào test cuối.

SHA-256 test được freeze để review/QA: `88d2855b09f60a0dcedf9e7b94f16139494cf089f24959495d68b36bce30fab3`.

Hai cell broader sau sửa được chốt trước: một worktree và một primary, mỗi cell một process mới, cùng selection 12 unit filters + `tests/ui` (34 file, 574 test), không retry đến khi xanh. Policy gồm 22 kiểm tra riêng, **không phải E2E**. Kết quả cuối và tích hợp ghi tại mục 38 `tiendokpi.md` và các artifact `worktree-qa.json`, `primary-qa.json`, `integrated-files.json`.

**Kết quả cả hai root:** worktree và primary, mỗi nơi 34/34 file, **574/574 test + 22/22 policy đạt**; TypeScript nonincremental exit 0. Đây là hai cell độc lập có cùng selection, không phải 1.148 testcase khác nhau hoặc full suite. Không thêm lượt chạy để ép xanh.

Lint tại cả worktree và primary: 0 error, **3 warning**. Hai warning unused ở upload routes và một warning `react-hooks/exhaustive-deps` tại `MapComponent.tsx:381` về đọc ref trong cleanup. Application source chứa các warning này đã có ở snapshot đầu checkpoint; không sửa ngoài phạm vi hoặc tiếp tục ghi là chỉ có 2 warning. Primary được chạy riêng, không dùng worktree thay thế.

## Giới hạn và bước tiếp theo

1. Reliability/timeout cũ vẫn mở, kể cả hai broader cell mới đạt: số mẫu giới hạn không chứng minh hết lỗi. Cần phép thử riêng ghi lại phase bị kẹt trước khi chọn sửa tiếp; không tăng deadline, chuyển import sang hook budget lớn hơn hoặc bỏ assertion để ép xanh.
2. Full-native Windows crash, strict visual bản đồ cũ và nghiệm thu timing Node0TB vẫn mở. Không chạy lại full-native suite trong checkpoint này.
3. Không rebuild hoặc browser benchmark cho thay đổi test-only. Build `GSevXO8cImpsugMzfsFK1` của mục 37 là mốc cũ của application, không phải kết quả build mới ở đây; không có claim nhanh hơn, p95/RUM hay nghiệm thu Production.
4. Dependency/runtime không đổi; không cài đặt hoặc chạy audit mạng trong checkpoint này. Security/dependency audit nếu làm cần phiên riêng, không suy ra dependency an toàn từ test fixture.
5. Các phần còn lại của Task 8/9/13 và roadmap vẫn giữ trạng thái chưa hoàn tất. Chỉ tiếp tục tối ưu app khi có evidence theo domain; chưa publish theo yêu cầu owner.
