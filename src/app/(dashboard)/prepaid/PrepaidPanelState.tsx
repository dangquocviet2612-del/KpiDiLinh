"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RotateCcw } from "lucide-react";
import PrepaidPanelSkeleton from "./PrepaidPanelSkeleton";
import styles from "./kpi.module.css";

type PrepaidPanelStateProps = {
  loading: boolean;
  errorMessage?: string | null;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  onRetry?: () => void;
  actionBtnClass?: string;
  skeletonStats?: number;
  skeletonRows?: number;
  skeletonCompact?: boolean;
  children: ReactNode;
};

export default function PrepaidPanelState({
  loading,
  errorMessage,
  isEmpty,
  emptyTitle,
  emptyDescription,
  onRetry,
  actionBtnClass,
  skeletonStats = 4,
  skeletonRows = 5,
  skeletonCompact = false,
  children,
}: PrepaidPanelStateProps) {
  if (loading) {
    return (
      <PrepaidPanelSkeleton stats={skeletonStats} rows={skeletonRows} compact={skeletonCompact} />
    );
  }

  if (errorMessage && isEmpty) {
    return (
      <div className={`glass-panel ${styles.panelStateCard} ${styles.panelStateError}`} role="alert">
        <div className={styles.panelStateHead}>
          <span className={styles.panelStateIcon} aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <div className={styles.panelStateBody}>
            <h3 className={styles.panelStateTitle}>Không tải được dữ liệu</h3>
            <p className={styles.panelStateDescription}>{errorMessage}</p>
          </div>
        </div>
        {onRetry ? (
          <div className={styles.panelStateActions}>
            <button type="button" className={actionBtnClass} onClick={onRetry}>
              <RotateCcw size={16} />
              Thử lại
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={`glass-panel ${styles.panelStateCard} ${styles.panelStateEmpty}`} role="status">
        <div className={styles.panelStateHead}>
          <span className={styles.panelStateIcon} aria-hidden="true">
            <Inbox size={18} />
          </span>
          <div className={styles.panelStateBody}>
            <h3 className={styles.panelStateTitle}>{emptyTitle}</h3>
            {emptyDescription ? (
              <p className={styles.panelStateDescription}>{emptyDescription}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {errorMessage ? (
        <div
          className={`glass-panel ${styles.panelStateCard} ${styles.panelStateError} ${styles.panelStateInline}`}
          role="alert"
        >
          <div className={styles.panelStateHead}>
            <span className={styles.panelStateIcon} aria-hidden="true">
              <AlertTriangle size={16} />
            </span>
            <div className={styles.panelStateBody}>
              <h3 className={styles.panelStateTitle}>Cập nhật dữ liệu không thành công</h3>
              <p className={styles.panelStateDescription}>{errorMessage}</p>
            </div>
          </div>
          {onRetry ? (
            <div className={styles.panelStateActions}>
              <button type="button" className={actionBtnClass} onClick={onRetry}>
                <RotateCcw size={16} />
                Thử lại
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </>
  );
}
