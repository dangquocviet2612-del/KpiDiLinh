"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./MapWorkspace.module.css";

export default function MapToolsDisclosure({ children, panelClassName }: { children: ReactNode; panelClassName?: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) details.open = false;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const details = detailsRef.current;
      if (event.key !== "Escape" || event.defaultPrevented || !details?.open) return;
      const fromTools = event.target instanceof Node && details.contains(event.target);
      const fromBody = event.target === document || event.target === document.body || event.target === document.documentElement;
      if (!fromTools && (!fromBody || document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]'))) return;
      details.open = false;
      details.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details ref={detailsRef} className={styles.tools}>
      <summary className={styles.toolsToggle} title="Công cụ bản đồ">
        <MoreHorizontal size={20} aria-hidden="true" />
        <span className={styles.toolsLabel}>Công cụ bản đồ</span>
      </summary>
      <div className={cn(styles.toolsPanel, panelClassName)}>{children}</div>
    </details>
  );
}
