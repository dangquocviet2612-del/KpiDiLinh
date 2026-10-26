import { cloneElement, type ReactElement, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import styles from "./ui.module.css";

type FieldControlProps = {
  id?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

type FormFieldProps = {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactElement<FieldControlProps>;
  className?: string;
  labelExtra?: ReactNode;
};

export default function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  children,
  className,
  labelExtra,
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = id ?? children.props.id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn(styles.formField, className)}>
      <div className={styles.formLabelRow}>
        <label className={styles.formLabel} htmlFor={controlId}>
          {label}
          {required && <span className={styles.formRequired} aria-hidden="true"> *</span>}
        </label>
        {labelExtra}
      </div>
      {cloneElement(children, {
        id: controlId,
        className: cn("input-base", children.props.className),
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })}
      {hint && <p id={hintId} className={styles.formHint}>{hint}</p>}
      {error && <p id={errorId} className={styles.formError}>{error}</p>}
    </div>
  );
}
