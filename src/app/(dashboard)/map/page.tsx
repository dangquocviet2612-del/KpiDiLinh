"use client";

import dynamic from "next/dynamic";
import styles from "./map.module.css";

const MapComponent = dynamic(() => import("./MapComponent"), {
    ssr: false,
    loading: () => <div className={styles.loading}>Đang tải bản đồ...</div>
});

export default function MapPage() {
    return (
        <div className={styles.container}>
            <div className={styles.mapWrapper}>
                <MapComponent />
            </div>
        </div>
    );
}
