"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    CalendarClock,
    Download,
    FileSpreadsheet,
    Loader2,
    Plus,
    RotateCcw,
    Search,
    SlidersHorizontal,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import toast from "react-hot-toast";
import styles from "./customers.module.css";
import CustomerModal from "@/components/CustomerModalRefined";
import CustomerTable from "@/components/CustomerTableRefined";
import PaginationControls from "@/components/PaginationControls";
import PullToRefresh from "@/components/PullToRefresh";
import { SkeletonTable } from "@/components/SkeletonTable";
import { useCustomers } from "@/hooks/useCustomers";
import type { CtvUser, Customer } from "@/types";
import ActionMenu from "@/components/ui/ActionMenu";
import AsyncState from "@/components/ui/AsyncState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Dialog from "@/components/ui/Dialog";
import { useDialogAccessibility } from "@/hooks/useDialogAccessibility";

type DeleteTarget =
    | { type: "single"; id: string }
    | { type: "bulk"; count: number };

type ImportReport = {
    added: number;
    updated: number;
    errors: string[];
    errorCsvUrl?: string;
    errorFileName?: string;
};

export default function CustomersPage() {
    const router = useRouter();
    const {
        customers,
        total,
        page,
        setPage,
        totalPages,
        limit,
        setLimit,
        loading,
        selectedIds,
        setSelectedIds,
        fetchCustomers,
        filters,
        setFilter,
    } = useCustomers();

    const { data: session } = useSession();
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const importReportUrlRef = useRef<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [canUseGps, setCanUseGps] = useState(false);
    const [ctvList, setCtvList] = useState<CtvUser[]>([]);
    const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [showMobileSheet, setShowMobileSheet] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [importReport, setImportReport] = useState<ImportReport | null>(null);
    const mobileSheetDialogRef = useDialogAccessibility<HTMLDivElement>({
        enabled: showMobileSheet,
        onClose: () => setShowMobileSheet(false),
    });

    const hasActiveFilters = Boolean(
        filters.search ||
            filters.subscriberType ||
            filters.billingType ||
            filters.prepaidPeriod ||
            filters.status ||
            filters.expirationFilter ||
            filters.ctvCode
    );

    const hasAdvancedFilters = Boolean(filters.billingType || filters.prepaidPeriod || filters.ctvCode);
    const hasNonSearchFilters = Boolean(
        filters.subscriberType ||
            filters.billingType ||
            filters.prepaidPeriod ||
            filters.status ||
            filters.expirationFilter ||
            filters.ctvCode
    );

    const activeFilterCount = [
        filters.search,
        filters.subscriberType,
        filters.billingType,
        filters.prepaidPeriod,
        filters.status,
        filters.expirationFilter,
        filters.ctvCode,
    ].filter(Boolean).length;

    const activeFilterChips = useMemo(() => {
        const chips: Array<{ key: keyof typeof filters; label: string }> = [];

        if (filters.search) {
            chips.push({ key: "search", label: `Tìm: ${filters.search}` });
        }

        if (filters.subscriberType) {
            chips.push({
                key: "subscriberType",
                label: `Thuê bao: ${filters.subscriberType === "FIXED" ? "Cố định" : "Di động"}`,
            });
        }

        if (filters.status) {
            chips.push({
                key: "status",
                label: `Trạng thái: ${filters.status === "Hoat dong" ? "Hoạt động" : "Rời mạng"}`,
            });
        }

        if (filters.expirationFilter) {
            const expirationLabelMap: Record<string, string> = {
                soon: "Sắp hết hạn",
                expiringThisMonth: "Hết hạn trong tháng",
                expired: "Đã hết hạn",
            };

            chips.push({
                key: "expirationFilter",
                label: `Hạn dùng: ${expirationLabelMap[filters.expirationFilter] || filters.expirationFilter}`,
            });
        }

        if (filters.billingType) {
            chips.push({
                key: "billingType",
                label: `Loại cước: ${filters.billingType === "PREPAID" ? "Đóng trước" : "Hàng tháng"}`,
            });
        }

        if (filters.prepaidPeriod) {
            chips.push({
                key: "prepaidPeriod",
                label: `Kỳ đóng: ${filters.prepaidPeriod} tháng`,
            });
        }

        if (filters.ctvCode) {
            const ctvName = ctvList.find((ctv) => ctv.username === filters.ctvCode)?.username || filters.ctvCode;
            chips.push({ key: "ctvCode", label: `CTV: ${ctvName}` });
        }

        return chips;
    }, [ctvList, filters]);

    const canCreateCustomer = Boolean(session?.user);
    const canFilterByCtv = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
    const isAdmin = session?.user?.role === "ADMIN";

    useEffect(() => {
        const fetchGpsPermission = async () => {
            try {
                const res = await fetch("/api/me");
                if (res.ok) {
                    const data = await res.json();
                    setCanUseGps(data.role === "ADMIN" || data.canUseGps === true);
                    if (Array.isArray(data.ctvList)) setCtvList(data.ctvList);
                }
            } catch (error) {
                console.error("Error fetching GPS permission:", error);
            }
        };
        fetchGpsPermission();
    }, []);

    useEffect(() => {
        if (hasAdvancedFilters) {
            setShowAdvancedFilters(true);
        }
    }, [hasAdvancedFilters]);

    useEffect(() => () => {
        if (importReportUrlRef.current) {
            URL.revokeObjectURL(importReportUrlRef.current);
        }
    }, []);

    const closeTransientPanels = useCallback(() => {
        setShowMobileSheet(false);
    }, []);

    const closeImportReport = useCallback(() => {
        if (importReportUrlRef.current) {
            URL.revokeObjectURL(importReportUrlRef.current);
            importReportUrlRef.current = null;
        }
        setImportReport(null);
    }, []);

    const openCreateModal = useCallback(() => {
        setSelectedCustomer(null);
        setIsModalOpen(true);
        closeTransientPanels();
    }, [closeTransientPanels]);

    const handleTemplateDownload = useCallback(() => {
        closeTransientPanels();
        window.open("/api/template", "_blank");
    }, [closeTransientPanels]);

    const deleteOne = useCallback(async (id: string) => {
        try {
            const response = await fetch(`/api/customers/${id}`, { method: "DELETE" });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.error || "Không thể xóa khách hàng.");
            }
            fetchCustomers();
            setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
            toast.success("Đã xóa khách hàng.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Lỗi khi xóa khách hàng.");
        }
    }, [fetchCustomers, selectedIds, setSelectedIds]);

    const deleteBulk = useCallback(async () => {
        try {
            const res = await fetch("/api/customers/bulk", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds }),
            });

            if (res.ok) {
                setSelectedIds([]);
                fetchCustomers();
                toast.success(`Đã xóa ${selectedIds.length} khách hàng.`);
            } else {
                const data = await res.json();
                toast.error(`Lỗi khi xóa: ${data.error}`);
            }
        } catch {
            toast.error("Lỗi kết nối khi xóa hàng loạt.");
        }
    }, [fetchCustomers, selectedIds, setSelectedIds]);

    const handleDelete = useCallback((id: string) => {
        setDeleteTarget({ type: "single", id });
    }, []);

    const handleBulkDelete = useCallback(() => {
        if (selectedIds.length === 0) return;
        setDeleteTarget({ type: "bulk", count: selectedIds.length });
    }, [selectedIds.length]);

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            if (deleteTarget.type === "single") {
                await deleteOne(deleteTarget.id);
            } else {
                await deleteBulk();
            }
            setDeleteTarget(null);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleExport = useCallback(() => {
        const params = new URLSearchParams({
            search: filters.search,
            subscriberType: filters.subscriberType,
            billingType: filters.billingType,
            prepaidPeriod: filters.prepaidPeriod,
            expirationFilter: filters.expirationFilter,
            status: filters.status,
        });
        if (filters.ctvCode) {
            params.set("ctvCode", filters.ctvCode);
        }
        closeTransientPanels();
        toast.success("Đang tải file khách hàng theo bộ lọc hiện tại.");
        window.open(`/api/export?${params.toString()}`, "_blank");
    }, [
        closeTransientPanels,
        filters.billingType,
        filters.ctvCode,
        filters.expirationFilter,
        filters.prepaidPeriod,
        filters.search,
        filters.status,
        filters.subscriberType,
    ]);

    const handleExportWithCoordinates = useCallback(() => {
        const params = new URLSearchParams({
            search: filters.search,
            subscriberType: filters.subscriberType,
            billingType: filters.billingType,
            prepaidPeriod: filters.prepaidPeriod,
            expirationFilter: filters.expirationFilter,
            status: filters.status,
            hasCoordinates: "true",
        });
        if (filters.ctvCode) {
            params.set("ctvCode", filters.ctvCode);
        }
        closeTransientPanels();
        toast.success("Đang tải file khách hàng đã lọc theo tọa độ.");
        window.open(`/api/export?${params.toString()}`, "_blank");
    }, [
        closeTransientPanels,
        filters.billingType,
        filters.ctvCode,
        filters.expirationFilter,
        filters.prepaidPeriod,
        filters.search,
        filters.status,
        filters.subscriberType,
    ]);

    const handleExportExpiringThisMonth = useCallback(() => {
        closeTransientPanels();
        toast.success("Đang tải file khách hàng hết hạn trong tháng.");
        window.open("/api/export?expirationFilter=expiringThisMonth", "_blank");
    }, [closeTransientPanels]);

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        closeTransientPanels();
        setIsImporting(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/import", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (res.ok) {
                if (importReportUrlRef.current) {
                    URL.revokeObjectURL(importReportUrlRef.current);
                    importReportUrlRef.current = null;
                }

                let errorCsvUrl: string | undefined;
                let errorFileName: string | undefined;
                if (data.errorCsv) {
                    const blob = new Blob([data.errorCsv], { type: "text/csv;charset=utf-8;" });
                    errorCsvUrl = URL.createObjectURL(blob);
                    errorFileName = `import_errors_${Date.now()}.csv`;
                    importReportUrlRef.current = errorCsvUrl;
                }

                setImportReport({
                    added: Number(data.added) || 0,
                    updated: Number(data.updated) || 0,
                    errors: Array.isArray(data.errors) ? data.errors : [],
                    errorCsvUrl,
                    errorFileName,
                });
                toast.success("Import khách hàng đã hoàn tất.");

                fetchCustomers();
            } else {
                toast.error(`Lỗi: ${data.error}`);
            }
        } catch {
            toast.error("Lỗi import file.");
        } finally {
            setIsImporting(false);
            e.target.value = "";
        }
    };

    const handleCopyAccount = useCallback((account: string) => {
        if (!account) return;
        navigator.clipboard.writeText(account);
        setCopiedAccount(account);
        toast.success(`Đã copy Account: ${account}`);
        setTimeout(() => setCopiedAccount(null), 2000);
    }, []);

    const handleEdit = useCallback((customer: Customer) => {
        setSelectedCustomer(customer);
        setIsModalOpen(true);
    }, []);

    const handleViewNode = useCallback((customer: Customer) => {
        const nodeTarget = customer.nodeName?.trim();
        if (!nodeTarget) {
            toast.error("Khách hàng này chưa có node để xem.");
            return;
        }

        closeTransientPanels();
        router.push(`/node-map?focusNode=${encodeURIComponent(nodeTarget)}`);
    }, [closeTransientPanels, router]);

    const clearFilters = useCallback(() => {
        setFilter("search", "");
        setFilter("subscriberType", "");
        setFilter("billingType", "");
        setFilter("prepaidPeriod", "");
        setFilter("status", "");
        setFilter("expirationFilter", "");
        setFilter("ctvCode", "");
        setShowAdvancedFilters(false);
        closeTransientPanels();
    }, [closeTransientPanels, setFilter]);

    const clearNonSearchFilters = useCallback(() => {
        setFilter("subscriberType", "");
        setFilter("billingType", "");
        setFilter("prepaidPeriod", "");
        setFilter("status", "");
        setFilter("expirationFilter", "");
        setFilter("ctvCode", "");
        setShowAdvancedFilters(false);
        closeTransientPanels();
    }, [closeTransientPanels, setFilter]);

    return (
        <>
            <PullToRefresh onRefresh={fetchCustomers}>
                <div className={styles.container}>
                    <div className={styles.header}>
                        <div className={styles.headerInfo}>
                            <h1 className={styles.title}>Khách hàng</h1>
                            <p className={styles.subtitle}>Một màn hình để tìm kiếm, lọc và cập nhật thuê bao.</p>
                            <div className={styles.headerMeta}>
                                <span>
                                    Tổng <strong>{total}</strong> khách hàng
                                </span>
                                <span>
                                    Trang <strong>{page}</strong> / {totalPages}
                                </span>
                                {selectedIds.length > 0 && (
                                    <span>
                                        Đang chọn <strong>{selectedIds.length}</strong>
                                    </span>
                                )}
                                {hasActiveFilters && (
                                    <span>
                                        Đang dùng <strong>{activeFilterCount}</strong> bộ lọc
                                    </span>
                                )}
                            </div>
                        </div>
                        {canCreateCustomer && (
                            <div className={styles.headerActions}>
                                <button className="btn btn-primary" onClick={openCreateModal}>
                                    <Plus size={18} /> Thêm khách hàng
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={styles.toolbarCard}>
                        <div className={styles.toolbarRow}>
                            <div className={styles.searchControl}>
                                <Search size={18} className={styles.filterSearchIcon} />
                                <label className={styles.srOnly} htmlFor="customer-search-desktop">Tìm kiếm khách hàng</label>
                                <input
                                    id="customer-search-desktop"
                                    type="text"
                                    className="input-base"
                                    placeholder="Tìm theo tên, SĐT, Account..."
                                    value={filters.search}
                                    onChange={(e) => setFilter("search", e.target.value)}
                                />
                            </div>

                            <div className={styles.quickFilters}>
                                <label className={styles.srOnly} htmlFor="customer-subscriber-desktop">Loại thuê bao</label>
                                <select
                                    id="customer-subscriber-desktop"
                                    className={`input-base ${styles.filterSelect}`}
                                    value={filters.subscriberType}
                                    onChange={(e) => setFilter("subscriberType", e.target.value)}
                                >
                                    <option value="">Tất cả thuê bao</option>
                                    <option value="FIXED">Cố định</option>
                                    <option value="MOBILE">Di động</option>
                                </select>

                                <label className={styles.srOnly} htmlFor="customer-status-desktop">Trạng thái khách hàng</label>
                                <select
                                    id="customer-status-desktop"
                                    className={`input-base ${styles.filterSelect}`}
                                    value={filters.status}
                                    onChange={(e) => setFilter("status", e.target.value)}
                                >
                                    <option value="">Tất cả trạng thái</option>
                                    <option value="Hoat dong">Hoạt động</option>
                                    <option value="Roi mang">Rời mạng</option>
                                </select>

                                <label className={styles.srOnly} htmlFor="customer-expiration-desktop">Hạn sử dụng</label>
                                <select
                                    id="customer-expiration-desktop"
                                    className={`input-base ${styles.filterSelect}`}
                                    value={filters.expirationFilter}
                                    onChange={(e) => setFilter("expirationFilter", e.target.value)}
                                >
                                    <option value="">Tất cả hạn dùng</option>
                                    <option value="soon">Sắp hết hạn ({"<="} 7 ngày)</option>
                                    <option value="expiringThisMonth">Hết hạn trong tháng</option>
                                    <option value="expired">Đã hết hạn</option>
                                </select>
                            </div>

                            <div className={styles.toolbarActions}>
                                <button
                                    className={`ui-action-btn ui-action-btn--compact ${styles.toolbarGhostBtn}`}
                                    onClick={() => setShowAdvancedFilters((prev) => !prev)}
                                    type="button"
                                >
                                    <SlidersHorizontal size={16} />
                                    {showAdvancedFilters ? "Ẩn lọc nâng cao" : "Lọc nâng cao"}
                                    {hasAdvancedFilters && <span className={styles.filterDot} />}
                                </button>

                                <button
                                    className={`ui-action-btn ui-action-btn--compact ${styles.toolbarGhostBtn}`}
                                    onClick={clearFilters}
                                    disabled={!hasActiveFilters}
                                    type="button"
                                >
                                    <RotateCcw size={16} /> Xóa lọc
                                </button>

                                {isAdmin && (
                                    <ActionMenu
                                        label="Tác vụ dữ liệu khách hàng"
                                        className={styles.actionMenuWrap}
                                        triggerClassName={`ui-action-btn--compact ${styles.actionMenuBtn}`}
                                        menuClassName={styles.actionMenu}
                                        trigger={<><Upload size={16} /> Tác vụ</>}
                                    >
                                        <button
                                            className={styles.actionMenuItem}
                                            onClick={() => importInputRef.current?.click()}
                                            type="button"
                                            disabled={isImporting}
                                        >
                                            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                            <span>{isImporting ? "Đang import..." : "Import Excel"}</span>
                                        </button>
                                        <button className={styles.actionMenuItem} onClick={handleExport} type="button">
                                            <Download size={16} />
                                            <span>Export hiện tại</span>
                                        </button>
                                        <button className={styles.actionMenuItem} onClick={handleExportWithCoordinates} type="button">
                                            <Download size={16} />
                                            <span>Export có tọa độ</span>
                                        </button>
                                        <button className={styles.actionMenuItem} onClick={handleTemplateDownload} type="button">
                                            <FileSpreadsheet size={16} />
                                            <span>Tải file mẫu</span>
                                        </button>
                                        <button className={styles.actionMenuItem} onClick={handleExportExpiringThisMonth} type="button">
                                            <CalendarClock size={16} />
                                            <span>Export hết hạn tháng</span>
                                        </button>
                                    </ActionMenu>
                                )}
                            </div>
                        </div>

                        {showAdvancedFilters && (
                            <div className={styles.advancedPanel}>
                                <label className={styles.srOnly} htmlFor="customer-billing-desktop">Loại cước</label>
                                <select
                                    id="customer-billing-desktop"
                                    className={`input-base ${styles.filterSelect}`}
                                    value={filters.billingType}
                                    onChange={(e) => setFilter("billingType", e.target.value)}
                                >
                                    <option value="">Tất cả loại cước</option>
                                    <option value="PREPAID">Đóng trước</option>
                                    <option value="MONTHLY">Hàng tháng</option>
                                </select>

                                <label className={styles.srOnly} htmlFor="customer-period-desktop">Kỳ đóng trước</label>
                                <select
                                    id="customer-period-desktop"
                                    className={`input-base ${styles.filterSelect}`}
                                    value={filters.prepaidPeriod}
                                    onChange={(e) => setFilter("prepaidPeriod", e.target.value)}
                                >
                                    <option value="">Tất cả kỳ đóng</option>
                                    <option value="3">3 tháng</option>
                                    <option value="6">6 tháng</option>
                                    <option value="12">12 tháng</option>
                                </select>

                                {canFilterByCtv && (
                                    <>
                                        <label className={styles.srOnly} htmlFor="customer-ctv-desktop">Mã CTV</label>
                                        <select
                                            id="customer-ctv-desktop"
                                            className={`input-base ${styles.filterSelect}`}
                                            value={filters.ctvCode}
                                            onChange={(e) => setFilter("ctvCode", e.target.value)}
                                        >
                                            <option value="">Tất cả CTV</option>
                                            {ctvList.map((ctv) => (
                                                <option key={ctv.id} value={ctv.username}>
                                                    {ctv.username}
                                                </option>
                                            ))}
                                        </select>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.mobileToolbar}>
                        <div className={styles.mobileSearchControl}>
                            <Search size={18} className={styles.filterSearchIcon} />
                            <label className={styles.srOnly} htmlFor="customer-search-mobile">Tìm kiếm khách hàng</label>
                            <input
                                id="customer-search-mobile"
                                type="text"
                                className="input-base"
                                placeholder="Tìm theo tên, SĐT, Account..."
                                value={filters.search}
                                onChange={(e) => setFilter("search", e.target.value)}
                            />
                        </div>

                        <div className={styles.mobileToolbarActions}>
                            <button className={`ui-action-btn ui-action-btn--compact ${styles.mobileToolBtn}`} onClick={() => setShowMobileSheet(true)} type="button">
                                <SlidersHorizontal size={16} /> Bộ lọc
                                {hasActiveFilters && <span className={styles.mobileToolCount}>{activeFilterCount}</span>}
                            </button>

                            {canCreateCustomer && (
                                <button
                                    className={`ui-action-btn ui-action-btn--compact ui-action-btn--primary ${styles.mobileToolBtnPrimary}`}
                                    onClick={openCreateModal}
                                    type="button"
                                >
                                    <Plus size={16} /> Thêm
                                </button>
                            )}
                        </div>
                    </div>

                    {activeFilterChips.length > 0 && (
                        <div className={styles.filterChipBar}>
                            <div className={styles.filterChipList}>
                                {activeFilterChips.map((chip) => (
                                    <button
                                        key={`${chip.key}-${chip.label}`}
                                        className={styles.filterChip}
                                        onClick={() => setFilter(chip.key, "")}
                                        type="button"
                                        title={`Bỏ lọc ${chip.label}`}
                                    >
                                        <span>{chip.label}</span>
                                        <X size={14} />
                                    </button>
                                ))}
                            </div>

                            <button
                                className={`ui-action-btn ui-action-btn--compact ${styles.clearChipBtn}`}
                                onClick={clearFilters}
                                type="button"
                            >
                                <RotateCcw size={15} /> Xóa tất cả
                            </button>
                        </div>
                    )}

                    {isAdmin && selectedIds.length > 0 && (
                        <div className={styles.bulkActionsBar}>
                            <span className={styles.bulkText}>
                                Đang chọn <strong>{selectedIds.length}</strong> khách hàng
                            </span>
                            <button className="btn btn-destructive" onClick={handleBulkDelete}>
                                <Trash2 size={18} /> Xóa đã chọn
                            </button>
                        </div>
                    )}

                    <div className={styles.listShell}>
                        {loading ? (
                            <SkeletonTable rows={10} />
                        ) : customers.length === 0 ? (
                            <AsyncState
                                status="empty"
                                title={hasActiveFilters ? "Không tìm thấy khách hàng" : "Chưa có khách hàng"}
                                description={hasActiveFilters
                                    ? hasNonSearchFilters
                                        ? "Không có kết quả với các bộ lọc hiện tại. Bạn có thể bỏ các bộ lọc khác nhưng vẫn giữ từ khóa tìm kiếm."
                                        : "Không có kết quả cho từ khóa hiện tại."
                                    : "Thêm khách hàng đầu tiên để bắt đầu quản lý thuê bao."}
                                actionLabel={hasNonSearchFilters ? "Xóa bộ lọc khác" : filters.search ? "Xóa từ khóa" : undefined}
                                onAction={hasNonSearchFilters ? clearNonSearchFilters : filters.search ? () => setFilter("search", "") : undefined}
                            />
                        ) : (
                            <CustomerTable
                                customers={customers}
                                selectedIds={selectedIds}
                                onSelectIds={setSelectedIds}
                                onEdit={handleEdit}
                                onViewNode={handleViewNode}
                                onDelete={handleDelete}
                                userRole={session?.user?.role || ""}
                                copiedAccount={copiedAccount}
                                onCopyAccount={handleCopyAccount}
                            />
                        )}

                        {customers.length > 0 && (
                            <PaginationControls
                                page={page}
                                totalPages={totalPages}
                                total={total}
                                limit={limit}
                                onPageChange={setPage}
                                onLimitChange={setLimit}
                            />
                        )}
                    </div>
                </div>
            </PullToRefresh>

            {showMobileSheet && (
                <div
                    className={styles.mobileSheetOverlay}
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setShowMobileSheet(false);
                    }}
                >
                    <div
                        ref={mobileSheetDialogRef}
                        className={styles.mobileSheet}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Bộ lọc khách hàng"
                        tabIndex={-1}
                    >
                        <div className={styles.mobileSheetHeader}>
                            <div>
                                <div className={styles.mobileSheetEyebrow}>Bộ lọc khách hàng</div>
                                <h2 className={styles.mobileSheetTitle}>Tìm đúng nhóm cần xử lý</h2>
                            </div>
                            <button
                                className={styles.mobileSheetClose}
                                onClick={() => setShowMobileSheet(false)}
                                type="button"
                                aria-label="Đóng bộ lọc"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.mobileSheetBody}>
                            <div className={styles.mobileSection}>
                                <span className={styles.mobileSectionTitle}>Bộ lọc chính</span>
                                <label className={styles.mobileFilterField}>
                                    <span>Loại thuê bao</span>
                                    <select className={`input-base ${styles.filterSelect}`} value={filters.subscriberType} onChange={(e) => setFilter("subscriberType", e.target.value)}>
                                        <option value="">Tất cả thuê bao</option>
                                        <option value="FIXED">Cố định</option>
                                        <option value="MOBILE">Di động</option>
                                    </select>
                                </label>
                                <label className={styles.mobileFilterField}>
                                    <span>Trạng thái khách hàng</span>
                                    <select className={`input-base ${styles.filterSelect}`} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                                        <option value="">Tất cả trạng thái</option>
                                        <option value="Hoat dong">Hoạt động</option>
                                        <option value="Roi mang">Rời mạng</option>
                                    </select>
                                </label>
                                <label className={styles.mobileFilterField}>
                                    <span>Hạn sử dụng</span>
                                    <select className={`input-base ${styles.filterSelect}`} value={filters.expirationFilter} onChange={(e) => setFilter("expirationFilter", e.target.value)}>
                                        <option value="">Tất cả hạn dùng</option>
                                        <option value="soon">Sắp hết hạn ({"<="} 7 ngày)</option>
                                        <option value="expiringThisMonth">Hết hạn trong tháng</option>
                                        <option value="expired">Đã hết hạn</option>
                                    </select>
                                </label>
                            </div>

                            <div className={styles.mobileSection}>
                                <span className={styles.mobileSectionTitle}>Lọc nâng cao</span>
                                <label className={styles.mobileFilterField}>
                                    <span>Loại cước</span>
                                    <select className={`input-base ${styles.filterSelect}`} value={filters.billingType} onChange={(e) => setFilter("billingType", e.target.value)}>
                                        <option value="">Tất cả loại cước</option>
                                        <option value="PREPAID">Đóng trước</option>
                                        <option value="MONTHLY">Hàng tháng</option>
                                    </select>
                                </label>
                                <label className={styles.mobileFilterField}>
                                    <span>Kỳ đóng trước</span>
                                    <select className={`input-base ${styles.filterSelect}`} value={filters.prepaidPeriod} onChange={(e) => setFilter("prepaidPeriod", e.target.value)}>
                                        <option value="">Tất cả kỳ đóng</option>
                                        <option value="3">3 tháng</option>
                                        <option value="6">6 tháng</option>
                                        <option value="12">12 tháng</option>
                                    </select>
                                </label>
                                {canFilterByCtv && (
                                    <label className={styles.mobileFilterField}>
                                        <span>Mã CTV</span>
                                        <select className={`input-base ${styles.filterSelect}`} value={filters.ctvCode} onChange={(e) => setFilter("ctvCode", e.target.value)}>
                                            <option value="">Tất cả CTV</option>
                                            {ctvList.map((ctv) => (
                                                <option key={ctv.id} value={ctv.username}>{ctv.username}</option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                                <button className={`btn btn-secondary ${styles.mobileResetBtn}`} onClick={clearFilters} disabled={!hasActiveFilters} type="button">
                                    <RotateCcw size={16} /> Xóa lọc
                                </button>
                            </div>

                            {isAdmin && (
                                <div className={styles.mobileSection}>
                                    <span className={styles.mobileSectionTitle}>Dữ liệu</span>
                                    <div className={styles.mobileActionsGrid}>
                                        <button
                                            className={`ui-action-btn ui-action-btn--compact ${styles.mobileActionCard}`}
                                            onClick={() => importInputRef.current?.click()}
                                            type="button"
                                            disabled={isImporting}
                                        >
                                            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                            <span>{isImporting ? "Đang import" : "Import Excel"}</span>
                                        </button>
                                        <button className={`ui-action-btn ui-action-btn--compact ${styles.mobileActionCard}`} onClick={handleExport} type="button">
                                            <Download size={16} />
                                            <span>Export hiện tại</span>
                                        </button>
                                        <button className={`ui-action-btn ui-action-btn--compact ${styles.mobileActionCard}`} onClick={handleExportWithCoordinates} type="button">
                                            <Download size={16} />
                                            <span>Export tọa độ</span>
                                        </button>
                                        <button className={`ui-action-btn ui-action-btn--compact ${styles.mobileActionCard}`} onClick={handleTemplateDownload} type="button">
                                            <FileSpreadsheet size={16} />
                                            <span>Tải file mẫu</span>
                                        </button>
                                        <button
                                            className={`ui-action-btn ui-action-btn--compact ${styles.mobileActionCard}`}
                                            onClick={handleExportExpiringThisMonth}
                                            type="button"
                                        >
                                            <CalendarClock size={16} />
                                            <span>Export HH tháng</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <input
                ref={importInputRef}
                type="file"
                accept=".xlsx"
                hidden
                onChange={handleImport}
                disabled={isImporting}
                aria-label="Chọn file Excel để import khách hàng"
            />

            {isModalOpen && <CustomerModal customer={selectedCustomer} onClose={() => setIsModalOpen(false)} onRefresh={fetchCustomers} />}

            {importReport && (
                <Dialog
                    open
                    title="Kết quả import khách hàng"
                    description="Kiểm tra số dòng đã xử lý và tải báo cáo lỗi nếu cần."
                    onClose={closeImportReport}
                    className={styles.importReportDialog}
                >
                    <div className={styles.importReportSummary} aria-live="polite">
                        <div className={styles.importReportMetric}>
                            <span>Thêm mới</span>
                            <strong>{importReport.added}</strong>
                        </div>
                        <div className={styles.importReportMetric}>
                            <span>Cập nhật</span>
                            <strong>{importReport.updated}</strong>
                        </div>
                        <div className={`${styles.importReportMetric} ${importReport.errors.length > 0 ? styles.importReportMetricError : ""}`}>
                            <span>Bỏ qua do lỗi</span>
                            <strong>{importReport.errors.length}</strong>
                        </div>
                    </div>

                    {importReport.errors.length > 0 && (
                        <div className={styles.importReportErrors}>
                            <h3>Một số lỗi cần kiểm tra</h3>
                            <ul>
                                {importReport.errors.slice(0, 5).map((error, index) => (
                                    <li key={`${index}-${error}`}>{error}</li>
                                ))}
                            </ul>
                            {importReport.errors.length > 5 && (
                                <p>Còn {importReport.errors.length - 5} lỗi khác trong báo cáo CSV.</p>
                            )}
                        </div>
                    )}

                    <div className={styles.importReportActions}>
                        {importReport.errorCsvUrl && importReport.errorFileName && (
                            <a
                                className="btn btn-secondary"
                                href={importReport.errorCsvUrl}
                                download={importReport.errorFileName}
                            >
                                <Download size={16} /> Tải báo cáo lỗi CSV
                            </a>
                        )}
                        <button className="btn btn-primary" type="button" onClick={closeImportReport}>
                            Hoàn tất
                        </button>
                    </div>
                </Dialog>
            )}

            <ConfirmDialog
                open={Boolean(deleteTarget)}
                title={deleteTarget?.type === "bulk" ? `Xóa ${deleteTarget.count} khách hàng?` : "Xóa khách hàng?"}
                description="Dữ liệu khách hàng và thông tin liên quan sẽ bị xóa vĩnh viễn."
                confirmLabel="Xóa khách hàng"
                destructive
                busy={isDeleting}
                onConfirm={() => void confirmDelete()}
                onClose={() => setDeleteTarget(null)}
            />
        </>
    );
}
