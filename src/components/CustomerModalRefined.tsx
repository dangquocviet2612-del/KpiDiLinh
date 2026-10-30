"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, MapPin, MessageCircle, X } from "lucide-react";
import toast from "react-hot-toast";
import styles from "./CustomerModal.module.css";
import CustomerNotesRefined from "./CustomerNotesRefined";
import EditHistory from "./EditHistory";
import type { CtvUser, Customer, CustomerFormData, EditHistoryItem } from "@/types";
import { getCustomerDateInputWarning } from "@/lib/customer-date-input";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import { useDialogAccessibility } from "@/hooks/useDialogAccessibility";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface CustomerModalProps {
    customer: Customer | null;
    onClose: () => void;
    onRefresh: () => void;
    defaultLocation?: { latitude: number; longitude: number } | null;
}

const FIXED_PACKAGES = [
    "NET1PLUS",
    "BASIC360",
    "HOMET",
    "FAST2T",
    "NETVT1_T",
    "BASICBOX",
    "MESH1T",
    "MESH4T",
    "STAR1T",
    "MESH7T",
    "STDBOX",
    "NET2",
    "NET2PLUS",
    "SUPERNET2",
    "NET1",
    "SUPERNET1",
    "STD",
    "MeshEco16",
    "Flexi1IPG",
    "SUN1T",
    "MeshPlus3",
    "FLEXIIP",
    "MeshEco14",
    "NET1PLUSN",
    "FLEXITV2IP",
    "NETTVVIP",
    "MeshEco3",
    "ECO6",
    "FAST1T",
    "NET4",
    "Fiber 1",
    "Fiber 2",
    "CLOUD07_VHT_NEW",
    "NETVT2_T",
    "FlexiIPG",
    "SUPERNET4",
    "STAR2T",
    "NETCB1_T",
    "NET3PLUS",
    "MeshEco1",
    "SMARTTV1",
    "FTTHEDU",
    "MESHVT1_T",
    "MeshEco15",
    "MeshEco6",
    "CLOUD07_40K",
    "STAR3T",
    "MESH8T",
    "MeshEco5",
    "MESH3T",
    "F90N",
    "Family1IP",
    "SUN2T",
    "MESH6T",
    "Fiber3",
];

function getInitialFormData(
    customer: Customer | null,
    defaultLocation?: { latitude: number; longitude: number } | null,
): CustomerFormData {
    return {
        name: customer?.name || "",
        account: customer?.account || "",
        subscriberType: customer?.subscriberType || "FIXED",
        phone: customer?.phone || "",
        package: customer?.package || "",
        price: customer?.price ? customer.price.toString() : "",
        address: customer?.address || "",
        nodeName: customer?.nodeName || "",
        latitude: customer?.latitude
            ? customer.latitude.toString()
            : defaultLocation?.latitude
                ? defaultLocation.latitude.toFixed(6)
                : "",
        longitude: customer?.longitude
            ? customer.longitude.toString()
            : defaultLocation?.longitude
                ? defaultLocation.longitude.toFixed(6)
                : "",
        billingType: customer?.billingType || "MONTHLY",
        status: customer?.status || "Hoạt động",
        prepaidPeriod: customer?.prepaidPeriod ? customer.prepaidPeriod.toString() : "",
        renewalMonth: customer?.renewalMonth ? customer.renewalMonth.split("T")[0] : "",
        ctvCode: customer?.ctvCode || "",
    };
}

function formatRenewalDisplay(value: string): string {
    if (!value) return "";
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
}

export default function CustomerModalRefined({ customer, onClose, onRefresh, defaultLocation }: CustomerModalProps) {
    const router = useRouter();
    const [formData, setFormData] = useState<CustomerFormData>(getInitialFormData(customer, defaultLocation));
    const [initialSnapshot, setInitialSnapshot] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [gpsLoading, setGpsLoading] = useState(false);
    const [edits, setEdits] = useState<EditHistoryItem[]>([]);
    const { data: currentUser, scope } = useCurrentUser();
    const [ctvState, setCtvState] = useState<{ scope: typeof scope; users: CtvUser[] }>({ scope, users: [] });
    const ctvs = ctvState.scope === scope ? ctvState.users : [];
    const canUseGps = Boolean(currentUser && (currentUser.role === "ADMIN" || currentUser.canUseGps === true || !!customer));
    const { data: session } = useSession();
    const role = session?.user?.role;
    const confirm = useConfirmDialog();

    const currentSnapshot = useMemo(() => JSON.stringify(formData), [formData]);
    const isDirty = initialSnapshot !== "" && currentSnapshot !== initialSnapshot;
    const isPhoneValid = formData.phone === "" || /^0\d{8,10}$/.test(formData.phone);
    const showPrepaidFields = formData.billingType === "PREPAID";
    const renewalMonthWarning = useMemo(() => {
        if (!showPrepaidFields) return null;
        return getCustomerDateInputWarning(formData.renewalMonth);
    }, [formData.renewalMonth, showPrepaidFields]);
    const isRenewalMonthInvalid = Boolean(renewalMonthWarning);

    useEffect(() => {
        const nextData = getInitialFormData(customer, defaultLocation);
        setFormData(nextData);
        setInitialSnapshot(JSON.stringify(nextData));
    }, [customer, defaultLocation]);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        setCtvState({ scope, users: [] });
        const fetchCtvs = async () => {
            if (!scope || (role !== "ADMIN" && role !== "MANAGER")) {
                return;
            }

            try {
                const res = await fetch("/api/users", { signal: controller.signal });
                if (res.ok) {
                    const data = await res.json();
                    if (active && !controller.signal.aborted) setCtvState({ scope, users: Array.isArray(data) ? data : [] });
                }
            } catch (fetchError) {
                if (active && !controller.signal.aborted) console.error("Error fetching CTVs:", fetchError);
            }
        };

        fetchCtvs();
        return () => { active = false; controller.abort(); };
    }, [role, scope]);

    useEffect(() => {
        if (!customer) {
            setEdits([]);
            return;
        }

        fetch(`/api/customers/${customer.id}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.edits) {
                    setEdits(data.edits);
                }
            })
            .catch((fetchError) => console.error("Failed to fetch edits", fetchError));
    }, [customer]);

    const handleRequestClose = async () => {
        if (loading) return;
        if (isDirty) {
            const shouldClose = await confirm({
                title: "Bỏ thay đổi chưa lưu?",
                description: "Các thông tin bạn vừa chỉnh sửa sẽ không được lưu.",
                confirmLabel: "Bỏ thay đổi",
                destructive: true,
            });
            if (!shouldClose) return;
        }
        onClose();
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = event.currentTarget;
        if (name === "phone") {
            const numericValue = value.replace(/\D/g, "").slice(0, 11);
            setFormData((prev) => ({ ...prev, [name]: numericValue }));
            return;
        }
        const fieldName = name === "customerNodeName" ? "nodeName" : name;
        setFormData((prev) => ({ ...prev, [fieldName]: value }));
    };

    const handleRenewalDisplayChange = (rawValue: string) => {
        let value = rawValue.replace(/[^\d/]/g, "");
        if (value.length === 2 && !value.includes("/")) value += "/";
        if (value.length === 5 && value.split("/").length === 2 && !value.endsWith("/")) value += "/";
        if (value.length > 10) value = value.slice(0, 10);

        if (value.length === 10) {
            const [day, month, year] = value.split("/");
            if (day && month && year && year.length === 4) {
                setFormData((prev) => ({ ...prev, renewalMonth: `${year}-${month}-${day}` }));
                return;
            }
        }

        setFormData((prev) => ({ ...prev, renewalMonth: value }));
    };

    const handleOpenNodeMap = () => {
        const nodeTarget = formData.nodeName.trim();
        if (!nodeTarget) return;
        onClose();
        router.push(`/node-map?focusNode=${encodeURIComponent(nodeTarget)}`);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (isRenewalMonthInvalid) {
            const message = renewalMonthWarning || "Ngày gia hạn không hợp lệ.";
            setError(message);
            toast.error(message);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const customerId = customer?.id;
            const isEdit = Boolean(customerId);
            const url = customerId ? `/api/customers/${customerId}` : "/api/customers";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Có lỗi xảy ra.");
            }

            toast.success(isEdit ? "Đã cập nhật khách hàng." : "Đã thêm khách hàng.");
            onRefresh();
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Có lỗi xảy ra.";
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const dialogRef = useDialogAccessibility<HTMLDivElement>({
        onClose: () => void handleRequestClose(),
        closeOnEscape: !loading,
    });

    return (
        <div
            className={styles.overlay}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) void handleRequestClose();
            }}
        >
            <div
                ref={dialogRef}
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="customer-modal-title"
                tabIndex={-1}
            >
                <div className={styles.header}>
                    <div className={styles.headerCopy}>
                        <h2 id="customer-modal-title">{customer ? "Sửa khách hàng" : "Thêm khách hàng mới"}</h2>
                        <p className={styles.headerSubtext}>
                            {customer
                                ? "Cập nhật liên hệ, gói cước, tọa độ và ghi chú nội bộ ngay trong một popup."
                                : "Điền các trường cần thiết để tạo khách hàng mới."}
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        {isDirty && <span className={styles.dirtyBadge}>Chưa lưu</span>}
                        <button onClick={handleRequestClose} className={styles.closeBtn} aria-label="Đóng" disabled={loading}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {error && <div className={styles.error} role="alert">{error}</div>}

                <form onSubmit={handleSubmit} className={styles.formBody}>
                    <div className={styles.fieldset}>
                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Thông tin cơ bản</h3>
                            <div className={styles.grid}>
                                <div className={styles.col}>
                                    <label className="label-base" htmlFor="customer-name">Tên khách hàng *</label>
                                    <input id="customer-name" name="name" required className="input-base" value={formData.name} onChange={handleChange} />
                                </div>

                                <div className={styles.col}>
                                    <div className={styles.labelRow}>
                                        <label className="label-base" htmlFor="customer-phone">Số điện thoại</label>
                                        {formData.phone && (
                                            <a
                                                href={`https://zalo.me/${formData.phone}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                 title="Nhắn Zalo"
                                                 aria-label={`Nhắn Zalo cho ${formData.phone}`}
                                                className={styles.zaloQuickLink}
                                            >
                                                <MessageCircle size={14} /> Zalo
                                            </a>
                                        )}
                                    </div>
                                    <input
                                        id="customer-phone"
                                        type="tel"
                                        inputMode="numeric"
                                        name="phone"
                                        className="input-base"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        aria-invalid={!isPhoneValid}
                                        aria-describedby="customer-phone-help"
                                    />
                                    <span id="customer-phone-help" className={!isPhoneValid ? styles.helperError : styles.helperText}>
                                        {isPhoneValid ? "Nhập từ 9 - 11 chữ số (bắt đầu bằng 0)." : "Số điện thoại không hợp lệ (cần 9-11 chữ số, bắt đầu bằng 0)."}
                                    </span>
                                </div>

                                <div className={styles.col}>
                                    <label className="label-base" htmlFor="customer-account">Account</label>
                                    <input id="customer-account" name="account" className="input-base" value={formData.account} onChange={handleChange} />
                                </div>

                                <div className={styles.col}>
                                    <div className={styles.labelRow}>
                                        <label className="label-base" htmlFor="customer-node">Node (hộp)</label>
                                        {formData.nodeName.trim() && (
                                            <button
                                                type="button"
                                                className={`ui-action-btn ui-action-btn--compact ui-action-btn--pill ${styles.inlineQuickLink}`}
                                                onClick={handleOpenNodeMap}
                                                title="Xem node trên bản đồ"
                                            >
                                                <MapPin size={14} /> Xem node
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        id="customer-node"
                                        name="customerNodeName"
                                        className="input-base"
                                        value={formData.nodeName}
                                        onChange={handleChange}
                                        disabled={loading}
                                    />
                                </div>

                                <div className={styles.col}>
                                    <label className="label-base" htmlFor="customer-status">Trạng thái</label>
                                    <select id="customer-status" name="status" className="input-base" value={formData.status} onChange={handleChange}>
                                        <option value="Hoạt động">Hoạt động</option>
                                        <option value="Rời mạng">Rời mạng</option>
                                    </select>
                                </div>

                                <div className={styles.col}>
                                    <label className="label-base" htmlFor="customer-subscriber-type">Loại thuê bao</label>
                                    <select id="customer-subscriber-type" name="subscriberType" className="input-base" value={formData.subscriberType} onChange={handleChange}>
                                        <option value="FIXED">Cố định</option>
                                        <option value="MOBILE">Di động</option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Gói cước và thanh toán</h3>
                            <div className={styles.grid}>
                                <div className={styles.col}>
                                    <label className="label-base" htmlFor="customer-billing-type">Loại cước</label>
                                    <select id="customer-billing-type" name="billingType" className="input-base" value={formData.billingType} onChange={handleChange}>
                                        <option value="MONTHLY">Hàng tháng</option>
                                        <option value="PREPAID">Đóng trước</option>
                                    </select>
                                </div>

                                {showPrepaidFields && (
                                    <>
                                        <div className={styles.col}>
                                            <label className="label-base" htmlFor="customer-prepaid-period">Kỳ đóng trước (tháng)</label>
                                            <select id="customer-prepaid-period" name="prepaidPeriod" className="input-base" value={formData.prepaidPeriod} onChange={handleChange} aria-describedby="customer-prepaid-period-help">
                                                <option value="">-- Chọn --</option>
                                                <option value="3">3 tháng</option>
                                                <option value="6">6 tháng</option>
                                                <option value="12">12 tháng</option>
                                            </select>
                                            <span id="customer-prepaid-period-help" className={styles.helperText}>Chọn đúng chu kỳ để tự động tính hạn sử dụng.</span>
                                        </div>

                                        <div className={styles.col}>
                                            <label className="label-base" htmlFor="customer-renewal-date">Tháng gia hạn (dd/mm/yyyy)</label>
                                            <input
                                                id="customer-renewal-date"
                                                name="renewalMonthDisplay"
                                                type="text"
                                                className={`${isRenewalMonthInvalid ? styles.invalidInput : ""} input-base`}
                                                placeholder="dd/mm/yyyy"
                                                value={formatRenewalDisplay(formData.renewalMonth)}
                                                onChange={(e) => handleRenewalDisplayChange(e.currentTarget.value)}
                                                aria-invalid={isRenewalMonthInvalid}
                                                aria-describedby="customer-renewal-date-help"
                                                disabled={loading}
                                            />
                                            <span id="customer-renewal-date-help" className={isRenewalMonthInvalid ? styles.helperWarning : styles.helperText}>
                                                {renewalMonthWarning || "Nhập đúng định dạng để tránh lệch ngày gia hạn."}
                                            </span>
                                        </div>
                                    </>
                                )}

                                <div className={styles.col}>
                                    <label className="label-base" htmlFor="customer-package">Gói cước</label>
                                    <select id="customer-package" name="package" className="input-base" value={formData.package} onChange={handleChange} disabled={loading}>
                                        <option value="">-- Chọn gói cước --</option>
                                        {formData.subscriberType === "MOBILE" ? (
                                            <>
                                                <option value="POBAS">POBAS</option>
                                                <option value="Trả trước">Trả trước</option>
                                            </>
                                        ) : (
                                            FIXED_PACKAGES.map((pkg) => (
                                                <option key={pkg} value={pkg}>
                                                    {pkg}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                <div className={styles.col}>
                                    <label className="label-base" htmlFor="customer-price">Giá tiền (VNĐ)</label>
                                    <input id="customer-price" name="price" type="number" inputMode="numeric" className="input-base" value={formData.price} onChange={handleChange} disabled={loading} />
                                </div>

                                {(session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER") && (
                                    <div className={styles.col}>
                                        <label className="label-base" htmlFor="customer-ctv-code">
                                            Mã CTV (giao khách)
                                        </label>
                                        <select
                                            id="customer-ctv-code"
                                            name="ctvCode"
                                            className="input-base"
                                            value={formData.ctvCode}
                                            onChange={handleChange}
                                            disabled={loading}
                                        >
                                            <option value="">
                                                {session?.user?.role === "MANAGER"
                                                    ? "-- Mặc định (thuộc quản lý) --"
                                                    : "-- Thuộc admin (không giao) --"}
                                            </option>
                                            {ctvs.map((ctv) => (
                                                <option key={ctv.id} value={ctv.username}>
                                                    {ctv.username}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Địa chỉ và tọa độ</h3>
                            <div className={styles.fullWidth}>
                                <label className="label-base" htmlFor="customer-address">Địa chỉ</label>
                                <input id="customer-address" name="address" className="input-base" value={formData.address} onChange={handleChange} disabled={loading} />
                            </div>

                            <div className={styles.grid}>
                                <div className={styles.col}>
                                    <label className="label-base" htmlFor="customer-latitude">Vĩ độ (Latitude)</label>
                                    <input id="customer-latitude" name="latitude" type="number" step="any" className="input-base" value={formData.latitude} onChange={handleChange} disabled={loading} />
                                </div>
                                <div className={styles.col}>
                                    <label className="label-base" htmlFor="customer-longitude">Kinh độ (Longitude)</label>
                                    <input id="customer-longitude" name="longitude" type="number" step="any" className="input-base" value={formData.longitude} onChange={handleChange} disabled={loading} />
                                </div>
                            </div>

                            {canUseGps && (
                                <div className={styles.fullWidth}>
                                    <button
                                        type="button"
                                        className={styles.gpsBtn}
                                        disabled={gpsLoading}
                                        onClick={() => {
                                            if (!navigator.geolocation) {
                                                setError("Trình duyệt không hỗ trợ GPS.");
                                                return;
                                            }

                                            setGpsLoading(true);
                                            setError("");
                                            navigator.geolocation.getCurrentPosition(
                                                (position) => {
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        latitude: position.coords.latitude.toFixed(6),
                                                        longitude: position.coords.longitude.toFixed(6),
                                                    }));
                                                    setGpsLoading(false);
                                                },
                                                (gpsError) => {
                                                    const message = `Không lấy được tọa độ: ${gpsError.message}`;
                                                    setError(message);
                                                    toast.error(message);
                                                    setGpsLoading(false);
                                                },
                                                { enableHighAccuracy: true, timeout: 10000 }
                                            );
                                        }}
                                    >
                                        {gpsLoading ? <Loader2 className="animate-spin" size={16} /> : <MapPin size={16} />}
                                        {gpsLoading ? "Đang lấy tọa độ..." : "Lấy tọa độ hiện tại"}
                                    </button>
                                </div>
                            )}
                        </section>

                        {customer && (
                            <section className={styles.section}>
                                <div className={styles.sectionHeading}>
                                    <h3 className={styles.sectionTitle}>Ghi chú nội bộ</h3>
                                    <span className={styles.sectionMeta}>Hiển thị trực tiếp để thao tác nhanh</span>
                                </div>
                                <CustomerNotesRefined customerId={customer.id} showLabel={false} />
                            </section>
                        )}
                    </div>

                    {edits.length > 0 && (
                        <details className={styles.disclosure}>
                            <summary className={styles.disclosureSummary}>
                                <span>Lịch sử chỉnh sửa</span>
                                <span className={styles.disclosureMeta}>{edits.length} thay đổi</span>
                            </summary>
                            <div className={styles.disclosureBody}>
                                <EditHistory edits={edits} showLabel={false} compact />
                            </div>
                        </details>
                    )}

                    <div className={styles.footer}>
                        <div className={styles.footerHint}>
                            {error ? (
                                <span style={{ color: "#ef4444", fontWeight: 600 }}>
                                    ⚠️ {error}
                                </span>
                            ) : isDirty ? (
                                "Có thay đổi chưa lưu."
                            ) : customer ? (
                                "Thông tin sẽ được cập nhật ngay sau khi lưu."
                            ) : (
                                "Biểu mẫu đang ở trạng thái mới."
                            )}
                        </div>
                        <div className={styles.footerActions}>
                            <button type="button" onClick={handleRequestClose} className="btn btn-secondary" disabled={loading}>
                                Hủy
                            </button>
                            <button type="submit" disabled={loading || !isPhoneValid || isRenewalMonthInvalid} className="btn btn-primary">
                                {loading ? <Loader2 className="animate-spin" size={18} /> : "Lưu"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
