"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./ToolFrameClient.module.css";

type ToolFrameClientProps = {
  src: string;
  title: string;
  frameClassName: string;
};

function ToolFrameAttempt({ src, title, frameClassName, focusOnMount, onReload }: ToolFrameClientProps & { focusOnMount: boolean; onReload: () => void }) {
  const [status, setStatus] = useState<"loading" | "slow" | "error" | "loaded">("loading");
  const messageId = useId();
  const warningId = useId();
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => { setStatus((current) => current === "loading" ? "slow" : current); }, 15_000);
    return () => { window.clearTimeout(timer); };
  }, [status]);

  useEffect(() => {
    if (focusOnMount) frameRef.current?.focus();
  }, [focusOnMount]);

  const canReload = status === "slow" || status === "error";
  const message = status === "loading"
    ? `Đang tải công cụ ${title}…`
    : status === "slow"
      ? "Công cụ tải lâu hơn dự kiến. Nếu nội dung chưa xuất hiện, bạn có thể tải lại."
      : "Chưa tải được khung công cụ. Bạn có thể thử tải lại.";

  return (
    <div className={styles.viewport}>
      {status !== "loaded" && (
        <div className={styles.notice}>
          <div className={styles.noticeText}>
            <p id={messageId} role={canReload ? "alert" : "status"} aria-atomic="true">{message}</p>
            {canReload && <p id={warningId} className={styles.warning}>Tải lại sẽ làm mất tệp đang chọn và thay đổi chưa lưu trong công cụ.</p>}
          </div>
          {canReload && (
            <button type="button" className={`btn btn-secondary ${styles.reloadButton}`} aria-describedby={warningId} onClick={onReload}>
              Tải lại công cụ
            </button>
          )}
        </div>
      )}
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        className={frameClassName}
        aria-busy={status === "loading"}
        aria-describedby={status !== "loaded" ? messageId : undefined}
        onLoad={() => { setStatus("loaded"); }}
        onErrorCapture={() => { setStatus("error"); }}
      />
    </div>
  );
}

export default function ToolFrameClient(props: ToolFrameClientProps) {
  const [attempt, setAttempt] = useState(0);
  return <ToolFrameAttempt key={`${props.src}:${attempt}`} {...props} focusOnMount={attempt > 0} onReload={() => { setAttempt((current) => current + 1); }} />;
}
