# Card khách hàng: gói cước và CTV còn thiếu

## Phạm vi, 30/10/2026

Mục52 tiếp Task11 đã duyệt, chỉ local. Không tiếp tục chạy lại auth để tìm lượt xanh khi lỗi chưa tái hiện; gate50/trace51 giữ nguyên và không được coi đã sửa.

- Package có tên: giữ label `Gói cước`, nguyên tên/title/giá như trước. Nếu chỉ có giá, label `Chưa có tên gói`, bỏ span tên giả `---`; giá vẫn hiển thị, kể cả0đ. Một price child tự về đầu hàng theo flex hiện có; không đổi stylesheet hoặc thiết kế lại card.
- Package+price cùng thiếu vẫn không có strip; không tự biến null thành0, đổi formatter/billing/expiry, validation hoặc dữ liệu. Test giá âm/thập phân chỉ giữ cách hiển thị cũ, không xác nhận chúng hợp lệ để nhập/thu cước.
- CTVfalsy hiện `Chưa có`, title `Chưa có mã CTV`; không suy luận đã/chưa giao việc, trạng thái hoạt động hoặc role từ việc mã trống. Chỉ fallback này được inline whiteSpace normal/overflowWrap anywhere để không cắt chữ khi phóng lớn.
- CodeCTV/package được cung cấp giữ verbatim/title/DOM, kể cả whitespace-only hoặc literal `---`; không trim/normalize/reclassify dữ liệu. Hai style override không áp dụng khi có mã; React có thể giữ style="" sau chuyển trạng thái nhưng hai property đều được clear.
- Không sửa CSSfiles/globalpalette/fonts/breakpoints/helper/handlers/state/data/API/roles/scope. Desktop, rawcopy/tel-Zalo/actions/flags/node-disabled/44px controls và missingphone-account hints mục50 giữ nguyên. Full-data card không đổi geometry.

## Regression và đo giao diện

Fixture mới dùng dữ liệu giả đã có,6variant: complete/price-only/zero-price/missingCTV/zero-price-noCTV/empty-metadata. `tests/ui/customer-missing-metadata.test.tsx` có **24case** actual component/user-event, không DB/API/accounts thật.

- Initial **RED13fail/10pass→GREEN23/23**: explicit missing labels/names/codes. Coverage null/empty,0/negative/decimal/name-only, whitespace/literalplaceholder, rawvalues/callbacks/copyfeedback/links,3roleprops/flags, rerender và desktop expansion.
- ChromeV1after metadata đúng nhưng **6case root-font200%390px bị cắt CTVfallback**. Diagnostic actualCSS nowrap/hidden/ellipsis, box69.97px nhưng range99.23px. Thêm wrap regression **RED1fail/23pass**, rồi conditional2style chỉ missingCTV.
- GREEN-V2 vẫn1test fail vì kỳ vọng React phải xóa toàn bộ thuộc tính style sau rerender; thực tế chỉ clear styles và để style="". Lưu app/testcandidateV2, đối chiếu installedReact setValueForStyles; chỉ sửa assertion để kiểm hai property rỗng, không đổi application/matcher/tolerance. Final **GREEN-V3 24/24**, app nguyên qua correction. Mọi source/log/RED/fail V1–V2 giữ riêng.

ChromeV2 actual CustomerTableRefined SSR +actual CSS/globalCSS, synthetic populated props/fakeADMIN; no Next server/build/auth/API/DB/hydration.96case =6variant×6width360/390/768/769/1024/1440×2theme72, thêm24root-font200% ở390/1440. Không gọi root-font là browser zoom/device thật.

- BeforeV2 có80DOMmetadata failures (40mobile/40hidden-cardDOM ở desktop); afterV2 **96/96case đạt**,0metadata/text/control failure.
- Text-range checks chỉ cho missing-name label/missingCTV, không nghiệm thu mọi longfield trên card. Controls giữ≥44px/horizontal containment/non-submit; không thay keyboard/screen-reader/clipboard/router/CRUD E2E.
- Desktop rawDOM/geometry96case giữ nguyên, trong đó48visible và48hiddenzero. Complete-card rawDOM/geometry16case giữ nguyên,8visiblemobile/8hiddenzero. Không dùng hidden zero bounds để khẳng định visible layout.
- Stylesheet hashes before/after giống nhau; không canonicalize generated classes hoặc nới geometry equality. Parent xem before/after390px zero-price-noCTV PNG. Page-overflow là diagnostic, không wholeapp responsive/CLS/speed acceptance.
- Một mẫu bổ sung dark390/root-font200% từ saved V2HTML xác nhận CTVfallback2dòng vừa box69.97px và7controls nằm trong card cả hai trục; parent đã xem PNG. Đây chỉ1mẫu, không mở rộng vertical containment thành96case. Header/name/node/phone/account khác không được nghiệm thu từ ảnh này hoặc sửa trong batch.

## QA và bảo toàn

**Worktree và primary chạy riêng đều đạt47file/787scoped test +22policy**, TypeScript nonincremental; lintsrc+newfixture/test0error/3warning cũ. Mỗi root ChromeV2after96/96case. Không cộng hai lượt thành testcase mới, dùng focused/browser/reviewer/trace51 thay primary hoặc gọi selection là fullnative/build/E2E acceptance. Current primary run là uninstrumented, sau source change của mục52, không retry unchanged để lấy xanh hoặc rootfix auth.

Freeze3hash trước review/QA. Exact-scope kiểm toàncomponent chỉ đổi package label/name guard và CTVfallback/title/conditionalstyle; helpers/prices/predicates/request/handlers/desktop/parent và CSS giữ nguyên. Samefixture/test before/after browser, application byte-equal qua test assertion correction. Snapshot471union paths/350source-config-test paths,150dirty và1117artifact cũ được giữ làm guard; chỉ7ownedfiles (1app/2fixture-test/4docs).

Review static độc lập APPROVE spec trước quality exact3hash, không critical/important findings; không thay primary QA/integration/scans. Source/docs integration có backups/preimage, whitespace/default secret scan không finding; final scope/inventory guards kiểm471paths/150thay đổi cũ/1117artifact cũ/HEAD-index-buildId, candidate không sửa sau freeze. Toàn application/test/config khác giữ nguyên.

Current batch scoped acceptance nếu đạt chỉ nói về source mới và selection đã chạy. **Không chứng minh hoặc sửa nguyên nhân auth timeout cũ.** Original primary762/763 failure/pending gate50 và trace51 không đổi; historicalAuthTimeoutRootCauseProvenfalse, releaseReadyfalse. Native/libsql/KPI-timeout/Node0TBvisual-timing/Task10/Task11/full-browser/Production gates còn riêng. Không branch/commit/push/deploy, full-native/build/dependency upgrade hoặc dữ liệu thật.

Evidence ignored `.local/performance/customer-missing-metadata-20261030/`: snapshot/preimages/candidateV1-V2/RED/GREEN/browser/SSRHTML/PNG/clipdiagnostic/hashes/exact-scope/review/QA/scans/backups/manifests. Không đưa log/DB/env/token/business data vào Git.
