import styles from "./kpi.module.css";

type PrepaidPanelSkeletonProps = {
  stats?: number;
  rows?: number;
  compact?: boolean;
};

export default function PrepaidPanelSkeleton({
  stats = 4,
  rows = 5,
  compact = false,
}: PrepaidPanelSkeletonProps) {
  return (
    <div className={styles.skeletonWrap} aria-hidden="true">
      {stats > 0 ? (
        <div className={styles.skeletonStats}>
          {Array.from({ length: stats }).map((_, index) => (
            <div key={`stat-${index}`} className={`glass-panel ${styles.skeletonStatCard}`}>
              <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
              <span className={`${styles.skeletonLine} ${styles.skeletonLineWide}`} />
            </div>
          ))}
        </div>
      ) : null}
      {rows > 0 ? (
        <div className={`glass-panel ${styles.skeletonTable} ${compact ? styles.skeletonTableCompact : ""}`}>
          {Array.from({ length: rows }).map((_, index) => (
            <div key={`row-${index}`} className={styles.skeletonRow}>
              <span className={`${styles.skeletonLine} ${styles.skeletonLineMedium}`} />
              <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
              <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
              <span className={`${styles.skeletonLine} ${styles.skeletonLineMedium}`} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
