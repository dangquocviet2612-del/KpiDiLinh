import styles from "./MapWorkspace.module.css";
import { ChevronDown } from "lucide-react";

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
  const displayCount = (value: number | null) => !loading && isCount(value) ? value.toLocaleString("vi-VN") : "—";

  return (
    <section className={styles.summary} aria-label={label} aria-busy={loading}>
      <details className={styles.statistics}>
        <summary className={styles.summaryToggle}>
          <span>{displayCount(inViewportCount)} trong khung · {displayCount(matchedCount)} qua lọc</span>
          <span className={styles.summaryLabel}>Số liệu <ChevronDown size={13} aria-hidden="true" /></span>
        </summary>
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
      </details>
    </section>
  );
}
