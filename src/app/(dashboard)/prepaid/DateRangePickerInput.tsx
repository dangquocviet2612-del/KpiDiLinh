"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import styles from "./kpi.module.css";

type DateRangePickerInputProps = {
  value: string;
  title: string;
  onChange: (next: string) => void;
};

const formatIsoToVnDate = (value?: string | null): string => {
  if (!value) return "";
  const datePart = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
};

export default function DateRangePickerInput({ value, title, onChange }: DateRangePickerInputProps) {
  const nativeRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.dateRangePickerWrap}>
      <input
        type="text"
        className={`input-base ${styles.dateRangeInput} ${styles.dateRangeDisplayInput}`}
        value={formatIsoToVnDate(value)}
        placeholder="dd/mm/yyyy"
        title={title}
        readOnly
        onClick={() => nativeRef.current?.showPicker?.()}
      />
      <button
        type="button"
        className={`ui-icon-btn ${styles.dateRangePickerButton}`}
        aria-label={title}
        title={title}
        onClick={() => nativeRef.current?.showPicker?.()}
      >
        <CalendarDays size={18} />
      </button>
      <input
        ref={nativeRef}
        type="date"
        className={styles.nativeDateInput}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
