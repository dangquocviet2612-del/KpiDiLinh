# Customer import file-size preflight — local Tasks12 slice61

**Policy/design:** Vercel customer import cap4,000,000bytes (4MB decimal) leaves headroom below documented4.5MB whole-body cap. Runtime VERCEL===1 selects server cap, other environments keep previous uncapped-by-app behavior. Nextconfig injects ONLY a derived nonsecret numeric NEXT_PUBLIC_CUSTOMER_IMPORT_MAX_BYTES (4000000 hosted,0 local), shared client helper defaults conservatively4MB if the compiled value is absent/invalid. No process.env dump, hostname sniffing, new provider/cost, DB/env settings, migrations or uploads to Production.

**Implementation:** Shared pure limits module. UI checks File.size after existing no-file/in-flight guard, before busy/FormData/fetch; reject clears picker, preserves previous report/CSV and permits re-selection. API checks after auth/formData/File validation but before arrayBuffer/XLSX/business queries; direct clients cannot bypass with publiccap0. Keep all row parsing/scoping/transaction/cache behavior and old error contracts. Nextconfig only adds helper import and numeric env property, no proxy/body/timeout/dependency changes. Vercel/Next docs checked30/10/2026; Nextconfigenv is supported legacy API, used narrowly because it handles both bundlers without new compiler plugins.

## Checklist
- [x] Scope existing code/docs and snapshot496publicpaths/361source,6primarydirty/242WTdirty/1759old artifacts, preserve60 and published59; reuse worktree.
- [x]24newregressions: RED9fail/15pass trên2file trước sửa, đúng thiếu UI/API filesizegate; metadataFile stubs, fake transport/auth/ORM/XLSX, không oldtests/mocks/deadline/pool changes.
- [x] Chỉ limits/config/customerpage/importAPI; GREEN24/24. ActualNextconfigloader+staticEnv collector trong hosted/local fakeenv processes đạt numeric4000000/0 và1nonsecretkey; một actualmultipart fixture4MB có headroom. PrivateprobeV1 sai kỳ vọng64mbraw thaynormalized67108864, giữlogs rồi sửa checkerV2, không sourcechange hoặc fullbuild/browserclaim.
- [x] Spec→quality review APPROVE đúng6hash; fresh QA mỗi root54file/948scoped+22policy/types/lint0warning và actual Next config probes4000000/0 đạt. Giữ mọi historicalfailure, không rerun-until-green hoặc fullnative/build/realbrowser/role/production acceptance claim.
- [x] Tích hợp được kiểm soát bởi backups/defaultsecret/whitespace/hash-inventory guards,4docs, append61; chỉ xác nhận sau final integrated manifest. Local only, no commit/push/deploy.

## Boundaries
Cap applies to file bytes in this one import flow, not every multipart body or compressed workbook expansion/row count/SQLduration. Request.formData still parses body before server filesize guard; Vercel may reject a request before handler/auth. Prebuilt artifacts carry build-time clientcap; rebuild for a different platform, server runtime cap stays independent. Requires VERCEL system flag enabled on hosted environment. Node/KPI/document/backup uploads, directstorage/jobs/cancel/restore, historical auth/native/Node0TB/Next/3role gates remain separate.

Sources: https://vercel.com/docs/functions/limitations ; https://vercel.com/docs/environment-variables/system-environment-variables ; https://nextjs.org/docs/app/api-reference/config/next-config-js/env
