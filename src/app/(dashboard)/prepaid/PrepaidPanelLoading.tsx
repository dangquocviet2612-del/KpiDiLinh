import PrepaidPanelSkeleton from "./PrepaidPanelSkeleton";
import styles from "./kpi.module.css";

export default function PrepaidPanelLoading() {
  return (
    <div className={styles.container} role="status" aria-label="Đang tải báo cáo" aria-busy="true">
      <PrepaidPanelSkeleton />
    </div>
  );
}
