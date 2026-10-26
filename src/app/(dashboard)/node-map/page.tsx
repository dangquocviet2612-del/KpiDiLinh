"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import styles from "./node-map.module.css";

const NodeMapComponent = dynamic(() => import("./NodeMapComponent"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
      <Loader2 className="animate-spin" size={40} />
      <span style={{ marginLeft: "10px" }}>Đang tải bản đồ...</span>
    </div>
  ),
});

export default function NodeMapPage() {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageMapWrapper}>
        <NodeMapComponent />
      </div>
    </div>
  );
}
