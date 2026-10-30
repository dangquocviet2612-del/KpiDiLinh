# Đầu card khách hàng: tên dài và phóng chữ

## Phạm vi, 30/10/2026

Mục53 tiếp Task11, local. Đợt52 chỉ nghiệm thu missingmetadata; ảnh phóng chữ khi đó không được dùng để khẳng định header đã đúng. Đợt này đo riêng trước sửa và xác nhận lỗi thật, không suy từ screenshot hoặc page-overflow.

Mẫu actualSSR390px/rootfont200%, fakeADMIN, tên `Khách giả lập 01`: name box59.97px, first text range85.14px; glyph giao status **5.98×38px**. Computed header nowrap/name overflow-wrap normal. Nguyên nhân là flex một hàng để badge chiếm chỗ nhưng tên không ngắt từ dài.

## Thay đổi

Chỉ thêm **7CSS declarations trong4rule có sẵn** của customers CSS module:

- Header flex-wrap để thiếu chỗ thì tự tách hàng.
- Main flex-basis12rem làm space preference cho tên, giữ grow/shrink cũ; không fixed width hoặc JS theo viewport. Chữ phóng lớn làm preference tăng theo rem nên badge xuống hàng tự nhiên.
- Name overflow-wrap anywhere, giữ nguyên full text/title/font/line-height/weight/color. Không ellipsis hoặc ẩn bớt tên.
- Status max-width100%, white-space normal/overflow-wrap anywhere, margin-leftauto: đọc đủ text và giữ canh phải khi wrap. Không đổi active/inactive classification, strings, colors hoặc padding/breakpoints.

Normal-sized card đủ chỗ giữ vị trí cũ; các trường hợp stress có thể cao/thay đổi flow để không chồng chữ. Không JSX/helper/state/handler/roles/data/API/formatting/request change; native checkbox44px/copy/links/actions/footer/missingmetadata vẫn nguyên. Secondary node/address clamp/title cũ giữ nguyên, không nghiệm thu lại full visibility của nó.

`status` schema hiện là string tối đa50ký tự; stress fixture49ký tự nằm trong bound, không thêm tùy chọn/trạng thái nghiệp vụ hoặc validation. Classes trùng tên ở ChurnRisk/Disconnect dùng moduleCSS riêng (`churn-risk.module.css`/`kpi.module.css`), không chịu rule mới và không được bật lại menu.

## Regression và phép đo

CSS TDD dùng **real Chrome layout RED**, không giả pixel bằng jsdom. RTL13case là preservation và đạt trước/sau, không gọi chúng là RED.

- Fixture4variant normal/longunbrokenname/longstatus/status-hidden, tên115ký tự trong name bound200, status49trong50.3rolepropsADMIN/MANAGER/CTV,6width360/390/768/769/1024/1440 ×2theme =144; thêm48root-font200%390/1440: **192cases**,96mobile/96desktop.
- Before:68name horizontal-fit failures,44glyph/status overlap failures,18status containment/text-fit failures; đây là các metric có thể trùng case, không cộng thành tổngcase. Controls0fail. Sau CSS: **192/192case đạt, mọi metric0fail**.
- Name kiểm text-range theo chiều ngang và giao cắt glyph/status thật. Glyph font có thể vượt linebox vài pixel dọc; không coi ink top−3px đơn lẻ là clipping. Status nằm trong header và text vừa theo chiều ngang. Targets≥44px/both-axis card containment/non-submit/role-gates giữ đúng.
- Canonical card/table DOM192case giốngpreimage: chỉ map exact exported CSSmodule tokens về logicalkeys, giữ attrs/text/externalclasses/token order còn lại, không regex xóa classes hay normalize dữ liệu. Component/globalCSS/basefixture hashes bất biến.
- Table geometry192case unchanged (96visible/96hiddenzero), **18normal-font100% mobile cases** giữ chính xác header/card/controls geometry. Không dùng hidden zero bounds làm visible-layout coverage; font200%/stress layouts được phép đổi flow đúng mục tiêu.
- Parent xem before/after normal390/rootfont200% và afterlongstatus390/font100% PNG. Root-font không browser zoom/device, fake roles không authE2E. No Next server/build/hydration/API/DB/Production hoặc speed/CLS guarantee.

RTL cover rawname/title/status,3roleprops/disablednode, native labelselection/copy/edit/delete arguments/no-submit, status tone, visibility/contact hints, secondary fallback, rerender và desktop expansion. Không đổi tests/mock/config/deadline/pool/dependencies có sẵn.

## QA và bảo toàn

**Worktree và primary chạy riêng đều đạt48file/800scoped test +22policy**, TypeScript nonincremental đạt; lintsrc+newfixture/test0error/3warning cũ. Mỗi root Chromeafter192/192case. Không cộng hai lượt thành testcase mới, dùng focused/browser/reviewer thay primary hoặc gọi selection là fullnative/build/appE2E acceptance. Current primary uninstrumented sau CSS source change, không retryunchanged để lấy xanh/authfix.

Freeze3hash, exact-scope chứng minh chỉ7declarations/4existingselectors; sourcecomponent vàmọi app/code khác không đổi. Snapshot475union paths/352source-config-test paths,154dirty và1233oldartifacts được giữ làm integration guards. Tổng7ownedfiles:1CSS/2fixture-test/4docs. Không branch/commit/push/deploy.

Review static độc lập APPROVE spec trước quality đúng3hash, không finding critical/important/minor; không dùng review thay QA/scans/integration. Source/docs integration có backup/preimage và default secret/whitespace scans không finding; final guards đối chiếu475snapshot paths/154dirty/1233oldartifacts/inventories/HEAD/index/buildId. CSS/fixture/test không đổi sau freeze, mọi application/test/config khác giữ nguyên; currentBatchPrimaryScopedPassedtrue nhưng historicalAuthTimeoutRootCauseProvenfalse/releaseReadyfalse.

## Chưa hoàn tất

- Matrix chỉ componentSSR/CSS với syntheticprops, không dashboard shell/live3role/auth/realcustomer/import/data mutations hoặc device/screen-reader/keyboard allweb acceptance.
- Không chứng minh mọi text/footer/contact/secondary/desktop stress text đều hiện đầy đủ, toànpage khôngoverflow, font200% mọiwidth, CLS/RUM hoặc load-speed. Page overflow chỉ diagnostic, không acceptance predicate.
- Originalauthtimeout50/trace51rootcause vẫnunknown; current source-change QA nếu đạt không làm originalfailedgate thành authfix. Native/libsql/KPI-timeout/Node0TBvisual/timing/Task10/Task11/fullnative/build/release còn riêng, releaseReadyfalse.

Evidence ignored `.local/performance/customer-header-layout-20261030/`: preimages/snapshot/initialglyphprobe/preservationlogs/browserbefore-after/SSRHTML/PNG/hashes/exact-scope/review/QA/scans/backups/manifests. Không commit env/DB/token/log/PII.
