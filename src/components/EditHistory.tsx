"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import styles from "./CustomerModal.module.css";
import type { EditHistoryItem } from "@/types";

interface EditHistoryProps {
    edits: EditHistoryItem[];
    showLabel?: boolean;
    compact?: boolean;
}

export default function EditHistory({ edits, showLabel = true, compact = false }: EditHistoryProps) {
    if (edits.length === 0) return null;

    return (
        <div
            className={styles.fullWidth}
            style={compact ? undefined : { marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}
        >
            {showLabel && <label className="label-base">Lịch sử chỉnh sửa</label>}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: showLabel ? "0.5rem" : 0 }}>
                {edits.map((edit) => {
                    let details: { action: string; changes?: Record<string, { old: string; new: string }> };
                    try {
                        details = JSON.parse(edit.details);
                    } catch {
                        details = { action: "UNKNOWN" };
                    }
                    return (
                        <div key={edit.id} style={{ background: "var(--input)", padding: "0.75rem", borderRadius: "0.5rem", fontSize: "0.85rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontWeight: 600 }}>
                                <span>{edit.user?.username} ({details.action})</span>
                                <span style={{ color: "var(--secondary-foreground)" }}>{new Date(edit.createdAt).toLocaleString("vi-VN")}</span>
                            </div>
                            {details.action === "UPDATE" && details.changes && (
                                <div className={styles.diffContainer}>
                                    {Object.entries(details.changes).map(([key, change]) => {
                                        const isOldEmpty = !change.old || change.old === "N/A" || change.old === "";
                                        const isNewEmpty = !change.new || change.new === "N/A" || change.new === "";

                                        return (
                                            <div key={key} className={styles.diffRow}>
                                                <div className={styles.diffField}>{key}</div>
                                                <div className={styles.diffValues}>
                                                    <div className={`${styles.diffOldValue} ${isOldEmpty ? styles.diffEmpty : ""}`}>
                                                        {isOldEmpty ? "[Trống]" : String(change.old)}
                                                    </div>
                                                    <ArrowRight size={14} className={styles.diffIcon} />
                                                    <div className={`${styles.diffNewValue} ${isNewEmpty ? styles.diffEmpty : ""}`}>
                                                        {isNewEmpty ? "[Trống]" : String(change.new)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
