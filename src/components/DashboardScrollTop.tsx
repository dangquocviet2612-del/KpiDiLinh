"use client";

import { ArrowUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./DashboardScrollTop.module.css";
import { cn } from "@/lib/utils";

const SHOW_THRESHOLD = 760;

export default function DashboardScrollTop() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scrollContainer = document.querySelector<HTMLElement>("[data-dashboard-main]");
    if (!scrollContainer) {
      return;
    }

    const handleScroll = () => {
      setVisible(scrollContainer.scrollTop > SHOW_THRESHOLD);
    };

    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  if (pathname?.startsWith("/tools")) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Lên đầu trang"
      title="Lên đầu trang"
      onClick={() => {
        const scrollContainer = document.querySelector<HTMLElement>("[data-dashboard-main]");
        scrollContainer?.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className={cn("ui-icon-btn", styles.button, visible && styles.visible)}
    >
      <ArrowUp size={18} />
    </button>
  );
}
