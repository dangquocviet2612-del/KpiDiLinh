export function buildDisconnectMobileFilterSummary(args: {
  activeCount: number;
  cancelMonthLabel?: string;
  sourceLabel?: string;
}) {
  const { activeCount, cancelMonthLabel, sourceLabel } = args;
  const parts = [cancelMonthLabel, sourceLabel].filter((value) => value && value.trim());
  let detail = parts.join(" · ");
  if (detail.length > 32) detail = `${detail.slice(0, 31)}…`;
  return {
    title: `Đang áp dụng (${activeCount})`,
    detail: detail || undefined,
  };
}

export function isDisconnectPastCancelDate(cancelDateIso: string | null | undefined, todayIso: string) {
  return Boolean(cancelDateIso && cancelDateIso < todayIso);
}
