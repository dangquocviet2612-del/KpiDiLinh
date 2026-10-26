import React from "react";
import styles from "../app/(dashboard)/customers/customers.module.css";
import skeletonStyles from "./SkeletonTable.module.css";

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
    return (
        <div className={styles.tableWrapper} role="status" aria-label="Đang tải danh sách khách hàng">
            <table className={styles.table} aria-hidden="true">
                <thead>
                    <tr>
                        <th className={skeletonStyles.checkboxColumn}><div className={skeletonStyles.skeletonCheckbox}></div></th>
                        {Array.from({ length: 10 }).map((_, columnIndex) => (
                            <th key={columnIndex}><div className={skeletonStyles.skeletonText}></div></th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <tr key={i}>
                            <td className={skeletonStyles.checkboxCell}>
                                <div className={skeletonStyles.skeletonCheckbox}></div>
                            </td>
                            <td><div className={skeletonStyles.skeletonText}></div></td>
                            <td><div className={skeletonStyles.skeletonText}></div></td>
                            <td><div className={skeletonStyles.skeletonBadge}></div></td>
                            {Array.from({ length: 6 }).map((_, columnIndex) => (
                                <td key={columnIndex}><div className={skeletonStyles.skeletonText}></div></td>
                            ))}
                            <td>
                                <div className={skeletonStyles.actionIcons}>
                                    <div className={skeletonStyles.skeletonIcon}></div>
                                    <div className={skeletonStyles.skeletonIcon}></div>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
