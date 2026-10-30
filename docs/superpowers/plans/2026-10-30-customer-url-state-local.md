# Customer URL state implementation plan

> Continue approved Task11 locally with TDD, isolated history/browser checks and independent review. No branch/commit/push/deploy, real env/auth/DB, dependency/config/deadline/pool changes or full native reruns.

**Goal:** URL khách hàng lưu filter/page/limit hợp lệ, reload/deep link/Back/Forward khôi phục đúng ngữ cảnh, không tạo history cho từng ký tự hoặc fetch sai query ban đầu.

**Architecture:** Pure parser/serializer whitelist; dedicated state/history hook opt-in chỉ `/customers`; useCustomers vẫn sở hữu SWR/query/debounce/selection. Khởi tạo URL sau hydration, gate fetch tới khi ready; restore atomically page/limit/rawfilters và revision/request seed để không fetch query cũ hoặc debounce URLrestore. Khi user edit tiếp, per-field debounce500/300ms vẫn đúng kể cả edit trong thời gian restore. Native history push chỉ lúc raw/requestfilters khớp; pop không echo; giữ hash/params không sở hữu nhưng không forward chúng vào API. Không chạm Next private state, không router.push gây RSC navigation mỗi filter.

**Tech Stack:** Existing React/SWR/useDebounce, browser History API. RTL realhook/SWR/deferredfetch và browser native history với synthetic auth/transport; không nghiệm thu Next fullapp/production.

## Boundaries và bằng chứng

- Node map đã có link `/customers?q=...` nhưng hook hiện bỏ qua URL. Canonical search key chọn `q`; nhận `search` legacy khi không có q, q có precedence kể cả rỗng. Các keys khác page/limit/subscriberType/billingType/prepaidPeriod/ctvCode/expirationFilter/status.
- Whitelist enum đúng options UI, limit10/20/50/100, page integer1..10000 (capAPI hiện10000). Invalid/ambiguous duplicate về defaults; q/CTV text giữ nguyên Unicode/whitespace/plus, chỉ URL-encode, không trim/inject. URL không cấp quyền; backend auth/scope giữ nguyên.
- Search URL có thể chứa tên/SĐT/account do người dùng gõ: không log/query analytics, không tự share, docs nhắc cẩn thận khi gửi link. Không claim URL là kho bí mật.
- InstalledNext app-router patch native push/replace để copy router metadata và update search params. Dùng public native API với null state, không tự gắn/strip `__NA`/private tree. Native-only browser fixture không thay fullNext navigation acceptance.
- Không URL hóa view của KPI trong slice khách hàng; không CSS/UI layout/CRUD/role changes. FixedFilters thắng URL; default hook không sync URL để giữ các caller/tests khác.
- SSR/client first render đều defaults/loading, không đọc window trong render. URLready gate ngăn unfiltered initial fetch. Pop re-seed debounce snapshot, không thêm follow-up API cùng key khi timer bắt kịp.

## Files

- Create `src/lib/customer-query-state.ts`, `src/hooks/useCustomerQueryState.ts`.
- Modify `src/hooks/useCustomers.ts` và duy nhất option opt-in ở `src/app/(dashboard)/customers/page.tsx`.
- Create `tests/ui/customer-url-state.test.tsx`.
- Docs `docs/customer-url-state.md`, plan này, roadmap Task11 và append56 `tiendokpi.md` (9owned paths).

## Checklist

- [x] Rà callers/AGENTS/Next/history/API limits; snapshot486paths/357source-config-test paths/167dirty/1528oldartifacts, reuse WT.
- [x] RED tests existing hook/page trước app: correctedRED50=13fail37pass; initial49testfailure có testsetup timeout/actpollution được giữ riêng. Không sửa tests cũ/deadline.
- [x] Minimal helper/statehook/useCustomers opt-in; mạnh hóa request-count xác minh cùng filter ởpage2 vẫn reset1 đúng code cũ, sửa riêng giả định no-op ởtestmới. Reorder-history regression RED1fail51pass→finalGREEN52/52; giữ reset/filter/paging/API/SWR/debounce semantics, no-op thật không ghi history.
- [x] Worktree native ChromeV2:12scenario×11steps deep link/reload/search/page/limit/Back2/Forward2/reload/back-during-edit,3roleprops×390/1440×lightdark. Realpage/hook/SWR nhưng session/transport giả, không NextAppRouter/SSRhydration acceptance. V1missingreact-dom prebundle/createPortal lỗi giữ nguyên; V2chỉprivatebundlerinclude, không đổi app/tolerance/deadline/bỏcase.
- [x] Freeze5hash và independent spec→quality APPROVE, fresh scoped WT/primary đã chạy riêng; cả hai root893pass1fail/894 do GETusers401 auth timeout5000ms, không lấy52focused/staticreview thay broadQA. Policy22/types/lint0error3warning cũ đạt mỗiroot; không broadretry đến xanh.
- [ ] **Scoped acceptance còn đỏ:** GETusers auth test đang tái hiện, rootunknown. Giữ failure/exit1, không broadretryunchanged đến xanh/skip/timeout/pool/config/oldassertions change. Local integration chỉ lưu implementation với pendinggate, không waive gate hoặc approve release, kể cả primary nếu đạt riêng.
- [x] Primary nativebrowserV2 riêng12/12scenario/132steps nhưWT; source/docs backups/defaultscan/whitespace/hash/inventory/HEAD/index guards và append56,9ownedpaths/167dirty/1528oldartifacts bảo toàn. Finalpreservationcheck không thay acceptance; pendingmanifest ghiSHA hai authfailure mới, historical auth/native/Node0TB/Task11/release gates giữ mở.
