# Bản đồ khách hàng — chọn marker theo ID

> Task9, local29/10/2026. Owner đã dừng push/deploy; không tạo nhánh release, commit, Preview/Turso hay cập nhật Production trong checkpoint này.

## Vấn đề đã tái hiện

`VanillaMarkerCluster` trước đây tìm khách đầu tiên có tọa độ cách vị trí popup dưới0,00001độ. Hai khách trùng hoặc rất gần tọa độ có thể phát `customerSelected` cho khách khác. Khi markercluster spiderfy, marker/popup có vị trí hiển thị khác tọa độ gốc nên tìm theo vị trí có thể không chọn được ai.

Giữ sáu semantic RED: hai khách trùng tọa độ, hai khách cách0,000004độ, popup bị dịch vị trí, source thiếu, ID thiếu, ID không thuộc danh sách hiện tại. Source cũ fail cả sáu;12test có sẵn và một test protocol Leaflet thật pass. Đây không phải import/type error được gọi là RED.

## Bản sửa

- Một index ID→customer bằng `useMemo`, chỉ theo mảng khách đã lọc của cluster hiện tại. Không global/shared cache, TTL, snapshot hay quyền mới.
- Marker giữ `customerId` raw trong options; popup dùng public `event.sourceTarget` để lấy ID, không dựa vào tọa độ, HTML, private `_source` hoặc `Popup.getSource()` (không có trong phiên bản cài).
- Ba event edit/pick/assign hiện có dùng cùng index; event không thuộc danh sách hiện tại vẫn không thao tác. Giữ popupclose phát `null` và các callback/confirmation/write payload hiện có.
- Chỉ reveal/open sau public `moveend` của đúng flight. Dừng motion cũ trước khi đăng ký once listener rồi flyTo với zoom17/duration1,2giây như cũ. Pending request gắn với chính position object, hủy khi chọn khách khác/GPS/unmount; callback cluster cũ không được mở popup.
- Khi group bị tháo do đổi bộ lọc, chỉ xóa refs mà group đó còn sở hữu. Callback reveal phải khớp entry hiện tại, không gọi/mở marker thuộc group đã bị thay. Không xóa refs của group mới.
- Không thêm listener cho từng marker hoặc request lấy detail. Listener moveend là one-shot theo flight, có cleanup; không tăng delay10ms hoặc8lượt retry60ms hiện có. Giữ toàn bộ HTML/CSS, escape/encode ID, màu/filter/count/search, nearest-node tie order, GPS/modal và API/auth/query/DTO.
- Index tốn O(n) xây dựng/bộ nhớ khi mảng hiện tại đổi; lookup lặp không còn quét tuyến tính. Không đo hoặc hứa cải thiện wall-time/cloud/page load/SQL/payload.

Chỉ sửa app ở `src/app/(dashboard)/map/MapComponent.tsx`; test ở `tests/ui/customer-map-node-projection.test.tsx` giữ12case cũ, thêm7identity/protocol,6motion và2group-lifetime cases, tổng27. Schema đảm bảo customer ID duy nhất; không thay policy xử lý dữ liệu ID trùng không hợp lệ.

## Kiểm chứng và các gate tách riêng

- Focused regression: RED6fail/13pass → GREEN19/19. Case Leaflet thật dùng marker và hai FeatureGroups lồng nhau để xác minh `target` là ancestor nhưng `sourceTarget` vẫn là marker gốc; không chỉ dựa vào mock.
- TypeScript lần đầu bắt TS2348 ở kiểu mock `openPopup` cũ khi test mới gọi trực tiếp. Chỉ thu hẹp type fixture thành `vi.fn<() => void>`, không sửa runtime/assertion. Giữ failed log/hash v1 và manifest hiện tại.
- Broad WT run đầu:34files/564tests và22policy đạt, sau đó type fixture fail. Broad run sau type fix:561pass/3fail ở hai file khác, gồm timeout5giây tại current-user-query/prepaid-view-loading rồi assertion module-evaluation trùng. Không ghi toàn bộ suite PASS hoặc bỏ test.
- Diagnostic hai file riêng:74pass/2fail, prepaid timeout/module-evaluation vẫn xuất hiện; current-user-query pass ở diagnostic này. Chưa xác định cơ chế timeout, không quy kết flake/máy bận/JIT/GC, không tăng timeout/đổi pool hoặc sửa nghiệp vụ KPI để ép xanh.
- Một baseline control đúng331source ban đầu trong WT cho cùng hai file đạt76/76, sau đó phục hồi exact candidate hashes. Không vì baseline PASS mà bỏ candidate failure hoặc quy kết cause; broad reliability vẫn OPEN. Broad motion run sau đó569/570, còn một prepaid5s timeout; giữ nguyên tất cả logs, không chạy lại để chọn một bản xanh.
- Motion regression:6semantic RED/19pass →25/25 GREEN; intermediate missing-useCallback import và TS2511 mock abstract Evented đều giữ là lỗi thật của lần kiểm tra đó. Dùng concrete Leaflet FeatureGroup cho event bus, không thay assertion.
- Review P2 bổ sung hai distinct-group cases: lần setup-helper timeout giữ riêng, không tính là semantic RED; sau sửa helper chờ đúng group, RED2fail/25pass →GREEN27/27. Fix chỉ cleanup refs đúng owner và callback-entry identity.
- **Final WT:**10file/256test map-domain +22policy, full TypeScript/lint0error/2warning cũ/build đạt, fake DB/source hashes giữ nguyên. Đây là selection riêng theo domain, **không phải**34-file broad suite hoặc full-native suite đạt. Primary verification có log/manifest riêng, không dùng WT PASS thay primary.

## Chrome / lỗi harness giữ nguyên

- V1 identity-only build `9wZYPTcy-phD6hYokdChM`: đúng ID thứ hai đã được phát, nhưng popup mất sau flyTo; fail ngay case ADMIN390, chưa hoàn thành sáu case dự kiến. Không gọi lần này PASS. Trace source cho thấy reveal/open được gọi trước React FlyTo effect, trong khi markercluster unspiderfy khi zoom.
- V2 motion build `ZElECntPyOTSSBQ-n-bkg`: popup tồn tại đúng khách, nhưng assertion class `.leaflet-cluster-spider-leg` đếm0 và fail. Một probe cùng build giữ nguyên assertion fail, ghi DOM/ảnh trước assertion: ba native SVG legs màu#222/opacity0,5 đang vẽ; hai marker trùng tọa độ hiện cách60px; popup B tồn tại. Installed markercluster chỉ thêm class theo `L.Path.SVG`, flag không được định nghĩa trong installed Leaflet. Class count không đại diện đầy đủ cho spiderfy vật lý, không sửa CSS/app để ép selector xanh.
- V3 thay predicate CSS tùy chọn bằng điều kiện DOM/geometry liên quan trực tiếp hơn: đúng3native SVG leg paths có stroke/opacity/width/d hợp lệ, cả hai marker A/B nhìn thấy và bounding boxes khác nhau, đồng thời vẫn đúng ID/popup/read/write. Giữ nguyên sáu role×viewport cases, flow/dataset/1,6giây chờ và mọi assertion còn lại; output mới, không ghi đè V1/V2/probe hoặc đổi chúng thành PASS.
- **Final V3 đạt6/6:** ADMIN/MANAGER/CTV ×390/1440, đúng khách trùng/gần điểm, popup còn mở, ba legs thật, một customer request +một node request/case,0business writes/JS errors; fake DB giữ nguyên. Build `GSevXO8cImpsugMzfsFK1`, exact final pair bên dưới. Login thật trên DB giả; customer/node API rows và provider images giả, service worker tắt. Không chứng nhận API scope equivalence hoặc full DOM/pixel/dark/điện thoại/provider thật.
- Positive SVG attributes không phải computed-visibility/occlusion check từng leg và chưa đối chiếu mỗi endpoint với marker cụ thể. Kết luận chỉ là native-leg DOM structure +marker có ID nhìn thấy/tách vị trí +popup đúng khách tồn tại, không phải chứng minh đầy đủ leg pixels hoặc mọi kiểu renderer.

Integration/primary có manifest riêng. Gate broad-test reliability, full-native Windows, Node0TB timing, strictvisual cũ và release vẫn OPEN. Không dùng ảnh mới hoặc case Leaflet propagation để miễn gate3PNG/2geometry trước đó. Đây không phải mọi thao tác rapid-click/manual-pan hoặc mọi workload đã được nghiệm thu.

## Vì sao chưa cắt tiếp customer payload

Audit consumer xác nhận cả14field khách hiện trả về đều đang được dùng trực tiếp cho marker/filter/count, danh sách/tìm kiếm, popup hoặc form boundary. Node-map thường cũng đọc10field mà API list hiện đã select. Không bỏ field/popup để đạt một tỷ lệ giảm giả hoặc thêm projection không có lợi ích thực. Lazy detail loading/viewport cần thiết kế và đo riêng, chưa thực hiện trong bản sửa này.

## Evidence / phục hồi

Plan `docs/superpowers/plans/2026-10-29-customer-marker-identity-local.md`; roadmap Task9, tiến độ mục37. Evidence private `.local/performance/customer-marker-identity-20261029/` giữ snapshot425paths/331source/91dirty paths, preimages, RED/GREEN, versioned hashes, failed/scoped/static logs và các gate tiếp theo.209artifacts cũ được đóng băng để đối chiếu, không ghi đè.

Final SHA-256: app `066ab426ec007acb55879f5d498e926d47c94c122ece93afa1fa184e674aa1b3`; test `b06d0589c6842c7c7ba254040043250d925dbcc17a1806ff6abdd2ba457b298a`. Spec/quality approvals gắn với đúng pair, không dùng identity-only/motion-v1 reviews thay final. Full-source/build và source/primary integration giữ riêng; không branch/commit/push/deploy.

Rollback chỉ hai source/test sau kiểm hash/preimage; không reset checkout hoặc mất91thay đổi local trước đó. Không schema/migration/data change và không đọc `.env`, credential hay database thật. Login browser nếu chạy chỉ dùng credential/database giả riêng, không lưu cookie vào tài liệu/Git.
