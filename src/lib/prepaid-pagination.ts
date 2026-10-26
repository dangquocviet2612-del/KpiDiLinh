export function computeWindowedPageMeta(totalCountInput: number, requestedPageInput: number, pageSizeInput: number) {
  const totalCount = Math.max(0, Number(totalCountInput || 0));
  const pageSize = Math.max(1, Math.floor(Number(pageSizeInput || 1)));
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const requestedPage = Math.max(1, Math.floor(Number(requestedPageInput || 1)));
  const page = Math.min(requestedPage, totalPages);
  return { totalCount, totalPages, page };
}
