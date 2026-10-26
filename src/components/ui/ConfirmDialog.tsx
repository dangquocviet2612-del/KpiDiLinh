"use client";

import { type ReactNode, type RefObject, useEffect, useState } from "react";
import Dialog from "./Dialog";
import styles from "./ui.module.css";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  details?: ReactNode;
  confirmationText?: string;
  onConfirm: () => void;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  destructive = false,
  busy = false,
  details,
  confirmationText,
  onConfirm,
  onClose,
  returnFocusRef,
}: ConfirmDialogProps) {
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const confirmationMatches = !confirmationText || typedConfirmation === confirmationText;

  useEffect(() => {
    if (open) setTypedConfirmation("");
  }, [confirmationText, open]);

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={busy ? () => undefined : onClose}
      closeOnBackdrop={!busy}
      returnFocusRef={returnFocusRef}
    >
      {details && <div className={styles.confirmDetails}>{details}</div>}
      {confirmationText && (
        <label className={styles.confirmPhraseField}>
          <span>
            Nhập <strong>{confirmationText}</strong> để tiếp tục
          </span>
          <input
            className="input-base"
            value={typedConfirmation}
            onChange={(event) => setTypedConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      )}
      <div className={styles.dialogActions}>
        <button type="button" className="ui-action-btn" disabled={busy} onClick={onClose}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={destructive ? "ui-action-btn ui-action-btn--danger" : "ui-action-btn ui-action-btn--primary"}
          disabled={busy || !confirmationMatches}
          onClick={onConfirm}
        >
          {busy ? "Đang xử lý…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
