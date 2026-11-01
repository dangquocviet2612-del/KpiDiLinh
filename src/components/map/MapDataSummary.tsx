import styles from "./MapWorkspace.module.css";

type MapDataSummaryProps = {
  label: string;
  totalLabel?: string;
  totalCount: number;
  coordinateCount: number;
  matchedCount: number;
  inViewportCount: number | null;
  loading?: boolean;
  scopeNote?: string;
};

function isCount(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= 0;
}

export default function MapDataSummary({
  label, totalLabel = "Đã tải", totalCount, coordinateCount, matchedCount, inViewportCount,
  loading = false, scopeNote,
}: MapDataSummaryProps) {
  const metrics = [
    { label: totalLabel, value: totalCount },
    { label: "Có tọa độ", value: coordinateCount },
    { label: "Qua bộ lọc", value: matchedCount },
    { label: "Trong khung", value: inViewportCount },
  ];
  const missing = !loading && isCount(totalCount) && isCount(coordinateCount) ? Math.max(0, totalCount - coordinateCount) : 0;

  return (
    <section className={styles.summary} aria-label={label} aria-busy={loading}>
      <dl className={styles.metrics}>
        {metrics.map((metric) => (
          <div key={metric.label} className={styles.metric}>
            <dt>{metric.label}</dt>
            <dd>{!loading && isCount(metric.value) ? metric.value.toLocaleString("vi-VN") : "—"}</dd>
          </div>
        ))}
      </dl>
      {(missing > 0 || scopeNote) && (
        <div className={styles.notes}>
          {missing > 0 && <span>{missing.toLocaleString("vi-VN")} bản ghi chưa có tọa độ hợp lệ.</span>}
          {scopeNote && <span>{scopeNote}</span>}
        </div>
      )}
    </section>
  );
}
