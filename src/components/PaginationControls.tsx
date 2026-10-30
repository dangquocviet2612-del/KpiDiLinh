"use client";

import React from "react";
import styles from "@/app/(dashboard)/customers/customers.module.css";

interface PaginationControlsProps {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}

export default function PaginationControls({
    page,
    totalPages,
    total,
    limit,
    onPageChange,
    onLimitChange,
}: PaginationControlsProps) {
    return (
        <nav className={styles.pagination} aria-label="Phân trang khách hàng">
            <div className={styles.pageInfo}>
                Hiển thị trang {page} / {totalPages} (Tổng {total} khách hàng)
            </div>
            <div className={styles.pageControls}>
                <select
                    className={`input-base ${styles.limitSelect}`}
                    value={limit}
                    onChange={(e) => onLimitChange(Number(e.target.value))}
                    title="Số lượng hiển thị"
                    aria-label="Số khách hàng mỗi trang"
                >
                    <option value={10}>10 / trang</option>
                    <option value={20}>20 / trang</option>
                    <option value={50}>50 / trang</option>
                    <option value={100}>100 / trang</option>
                </select>
                <button type="button" aria-label="Trang trước" className="btn btn-secondary" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
                    Trước
                </button>
                <button type="button" aria-label="Trang sau" className="btn btn-secondary" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
                    Sau
                </button>
            </div>
        </nav>
    );
}
