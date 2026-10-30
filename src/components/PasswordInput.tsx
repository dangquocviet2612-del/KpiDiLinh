"use client";

import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./PasswordInput.module.css";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  id: string;
  visible: boolean;
  visibilityLabel: string;
  onToggle: () => void;
};

export default function PasswordInput({ id, visible, visibilityLabel, onToggle, className, disabled, ...inputProps }: PasswordInputProps) {
  const toggleLabel = `${visible ? "Ẩn" : "Hiện"} ${visibilityLabel}`;

  return (
    <div className={styles.field}>
      <input {...inputProps} id={id} type={visible ? "text" : "password"} className={`${className ?? ""} ${styles.input}`} disabled={disabled} />
      <button
        type="button"
        className={styles.toggle}
        aria-label={toggleLabel}
        title={toggleLabel}
        aria-controls={id}
        aria-pressed={visible}
        disabled={disabled}
        onClick={onToggle}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
