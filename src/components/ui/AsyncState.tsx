import type { ReactNode } from "react";
import { AlertCircle, CircleCheck, Inbox, Info, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./ui.module.css";

type AsyncStatus = "loading" | "error" | "empty" | "success" | "info";

type AsyncStateProps = {
  status: AsyncStatus;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  icon?: ReactNode;
  className?: string;
};

const ICONS = {
  loading: LoaderCircle,
  error: AlertCircle,
  empty: Inbox,
  success: CircleCheck,
  info: Info,
};

export default function AsyncState({
  status,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  icon,
  className,
}: AsyncStateProps) {
  const Icon = ICONS[status];
  const role = status === "error" ? "alert" : "status";

  return (
    <div
      className={cn(styles.asyncState, compact && styles.asyncStateCompact, styles[`asyncState_${status}`], className)}
      role={role}
      aria-live={status === "error" ? "assertive" : "polite"}
      aria-busy={status === "loading" || undefined}
    >
      <div className={cn(styles.asyncIcon, status === "loading" && styles.asyncIconSpin)} aria-hidden="true">
        {icon ?? <Icon size={compact ? 22 : 30} />}
      </div>
      <div className={styles.asyncCopy}>
        <h2 className={styles.asyncTitle}>{title}</h2>
        {description && <p className={styles.asyncDescription}>{description}</p>}
      </div>
      {actionLabel && onAction && (
        <button type="button" className="ui-action-btn ui-action-btn--primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
