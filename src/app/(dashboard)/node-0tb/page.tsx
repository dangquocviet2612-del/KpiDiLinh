"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import styles from "../node-map/node-map.module.css";

const Node0TbMap = dynamic(() => import("./Node0TbMap"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
      <Loader2 className="animate-spin" size={40} />
      <span style={{ marginLeft: "10px" }}>Đang tải bản đồ...</span>
    </div>
  ),
});

export default function Node0TbPage() {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageMapWrapper}>
        <Node0TbMap />
      </div>
    </div>
  );
}
