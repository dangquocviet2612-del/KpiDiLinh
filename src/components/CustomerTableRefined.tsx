"use client";

import { memo, useCallback, useMemo, useState, type MouseEvent } from "react";
import { Check, ChevronDown, Copy, Edit, MapPin, MessageCircle, PhoneCall, Trash2 } from "lucide-react";
import styles from "@/app/(dashboard)/customers/customers.module.css";
import type { Customer } from "@/types";

interface CustomerTableProps {
  customers: Customer[];
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onEdit: (customer: Customer) => void;
  onViewNode: (customer: Customer) => void;
  onDelete: (id: string) => void;
  userRole: string;
  visibleColumns?: {
    status?: boolean;
    billingType?: boolean;
    zaloButton?: boolean;
  };
  copiedAccount: string | null;
  onCopyAccount: (account: string) => void;
}

function getRowClass(expDateString: string | null, isChecked: boolean): string {
  const classNames: string[] = [];

  if (expDateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);

    const expDate = new Date(expDateString);

    if (expDate < today) {
      classNames.push(styles.rowExpired);
    } else if (expDate <= in7Days) {
      classNames.push(styles.rowWarning);
    }
  }

  if (isChecked) {
    classNames.push(styles.rowSelected);
  }

  return classNames.join(" ");
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${date.getFullYear()}`;
}

function formatSubscriberType(type: string | null | undefined): string {
  return type === "FIXED" ? "Cố định" : "Di động";
}

function formatBillingType(type: string | null | undefined): string {
  if (!type) return "Chưa có";
  return type === "PREPAID" ? "Đóng trước" : "Hàng tháng";
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "";
  return `${price.toLocaleString()}đ`;
}

function getSecondaryText(customer: Customer): string {
  return customer.nodeName || customer.address || "Chưa có node hoặc địa chỉ";
}

function getExpiryMeta(dateString: string | null): { label: string; tone: string } {
  if (!dateString) {
    return { label: "Chưa có", tone: styles.expiryEmpty };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(dateString);
  expiration.setHours(0, 0, 0, 0);

  const diffDays = Math.round((expiration.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return { label: `Quá hạn ${Math.abs(diffDays)} ngày`, tone: styles.expiryExpired };
  }

  if (diffDays <= 7) {
    return { label: `Còn ${diffDays} ngày`, tone: styles.expirySoon };
  }

  return { label: formatDate(dateString), tone: styles.expiryNormal };
}

type CustomerRowProps = {
  customer: Customer;
  isAdmin: boolean;
  showStatus: boolean;
  showBillingType: boolean;
  showZaloButton: boolean;
  isChecked: boolean;
  isExpanded: boolean;
  copiedAccount: string | null;
  colSpan: number;
  onSelectOne: (id: string, checked: boolean) => void;
  onCopyAccount: (account: string) => void;
  onEdit: (customer: Customer) => void;
  onViewNode: (customer: Customer) => void;
  onDelete: (id: string) => void;
  onToggleExpand: (id: string) => void;
};

const CustomerRow = memo(function CustomerRow({
  customer,
  isAdmin,
  showStatus,
  showBillingType,
  showZaloButton,
  isChecked,
  isExpanded,
  copiedAccount,
  colSpan,
  onSelectOne,
  onCopyAccount,
  onEdit,
  onViewNode,
  onDelete,
  onToggleExpand,
}: CustomerRowProps) {
  const statusLabel = customer.status || "Hoạt động";
  const isActive = statusLabel === "Hoạt động";
  const secondaryText = getSecondaryText(customer);
  const expiryMeta = getExpiryMeta(customer.expirationDate);
  const packagePrice = formatPrice(customer.price);
  const packageValue = customer.package || "";
  const detailItems = [
    { label: "Địa chỉ", value: customer.address || "Chưa có" },
    { label: "Node", value: customer.nodeName || "Chưa có" },
    { label: "Thuê bao", value: formatSubscriberType(customer.subscriberType) },
    { label: "Loại cước", value: formatBillingType(customer.billingType) },
    { label: "Kỳ đóng", value: customer.prepaidPeriod ? `${customer.prepaidPeriod} tháng` : "Chưa có" },
    { label: "Gia hạn tháng", value: customer.renewalMonth || "Chưa có" },
  ];

  const stopAndRun = (event: MouseEvent<HTMLElement>, callback: () => void) => {
    event.stopPropagation();
    callback();
  };

  return (
    <>
      <tr className={`${styles.desktopRow} ${getRowClass(customer.expirationDate, isChecked)}`} onClick={() => onToggleExpand(customer.id)}>
        {isAdmin && (
          <td className={styles.checkboxCell}>
            <input
              type="checkbox"
              aria-label={`Chọn khách hàng ${customer.name}`}
              checked={isChecked}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onSelectOne(customer.id, event.target.checked)}
              className={styles.checkbox}
            />
          </td>
        )}

        <td className={styles.customerSummaryCell}>
          <div className={styles.customerSummary}>
            <div className={styles.customerSummaryHeader}>
              <div className={styles.customerIdentity}>
                <div className={styles.customerName} title={customer.name}>
                  {customer.name}
                </div>
                {showStatus && (
                  <span className={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusInactive}`}>
                    {statusLabel}
                  </span>
                )}
              </div>

              <div className={styles.expandAffordance}>
                <span className={styles.expandAffordanceText}>{isExpanded ? "Thu gọn" : "Xem nhanh"}</span>
                <button
                  type="button"
                  className={`${styles.expandToggle} ${isExpanded ? styles.expandToggleOpen : ""}`}
                  onClick={(event) => stopAndRun(event, () => onToggleExpand(customer.id))}
                  aria-label={isExpanded ? "Thu gọn chi tiết" : "Mở rộng chi tiết"}
                  title={isExpanded ? "Thu gọn chi tiết" : "Mở rộng chi tiết"}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>

            <div className={styles.customerContactLine}>
              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  title="Gọi điện"
                  className={styles.phoneLink}
                  onClick={(event) => event.stopPropagation()}
                >
                  <PhoneCall size={15} />
                </a>
              )}
              <span className={styles.customerPhone}>{customer.phone || "Chưa có SĐT"}</span>
              {showZaloButton && customer.phone && (
                <a
                  href={`https://zalo.me/${customer.phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Nhắn Zalo"
                  className={styles.zaloLink}
                  onClick={(event) => event.stopPropagation()}
                >
                  <MessageCircle size={15} />
                </a>
              )}
            </div>

            <div className={styles.customerMetaLine}>
              <span className={styles.customerNodeText} title={secondaryText}>
                {secondaryText}
              </span>
              <span className={styles.subscriberInlineBadge}>{formatSubscriberType(customer.subscriberType)}</span>
            </div>
          </div>
        </td>

        <td>
          <div className={styles.accountCell}>
            {customer.account && (
              <button
                onClick={(event) => stopAndRun(event, () => onCopyAccount(customer.account!))}
                title="Copy Account"
                className={`${styles.copyBtn} ${copiedAccount === customer.account ? styles.copyActive : ""}`}
                type="button"
              >
                {copiedAccount === customer.account ? <Check size={15} /> : <Copy size={15} />}
              </button>
            )}
            <span className={styles.accountValue} title={customer.account || "Chưa có"}>
              {customer.account || "Chưa có"}
            </span>
          </div>
        </td>

        <td>
          <div className={styles.packageCell}>
            {packageValue ? (
              <>
                <span className={styles.packagePrimary} title={packageValue}>
                  {packageValue}
                </span>
                {packagePrice ? <span className={styles.packageSecondary}>{packagePrice}</span> : null}
              </>
            ) : packagePrice ? (
              <span className={styles.packagePrimary}>{packagePrice}</span>
            ) : (
              <span className={styles.emptyValue}>Chưa có</span>
            )}
          </div>
        </td>

        <td>
          <div className={styles.expiryCell}>
            <span className={`${styles.expiryBadge} ${expiryMeta.tone}`}>{expiryMeta.label}</span>
            {customer.expirationDate ? <span className={styles.expiryDateText}>{formatDate(customer.expirationDate)}</span> : null}
          </div>
        </td>

        <td>
          <span className={styles.ctvValue} title={customer.ctvCode || "Chưa có"}>
            {customer.ctvCode || "Chưa có"}
          </span>
        </td>

        <td>
          <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={`ui-icon-btn ${styles.iconBtn}`}
              onClick={() => onViewNode(customer)}
              aria-label="Xem node"
              title={customer.nodeName?.trim() ? "Xem node" : "Khách hàng chưa có node"}
              disabled={!customer.nodeName?.trim()}
            >
              <MapPin size={16} />
            </button>
            <button type="button" className={`ui-icon-btn ${styles.iconBtn}`} onClick={() => onEdit(customer)} aria-label="Sửa">
              <Edit size={16} />
            </button>
            {isAdmin && (
              <button
                type="button"
                className={`ui-icon-btn ui-icon-btn--danger ${styles.iconBtn} ${styles.delete}`}
                onClick={() => onDelete(customer.id)}
                aria-label="Xóa"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr className={styles.detailRow}>
          <td colSpan={colSpan} className={styles.detailCell}>
            <div className={styles.detailPanel}>
              {detailItems.map((item) => (
                <div key={`${customer.id}-${item.label}`} className={styles.detailItem}>
                  <span className={styles.detailLabel}>{item.label}</span>
                  <span className={styles.detailValue} title={item.value}>
                    {item.value}
                  </span>
                </div>
              ))}
              {showBillingType && customer.billingType && (
                <div className={styles.detailHint}>Hàng này đang mở rộng để xem nhanh thông tin chi tiết mà không cần mở modal.</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

const CustomerMobileCard = memo(function CustomerMobileCard({
  customer,
  isAdmin,
  showStatus,
  showBillingType,
  showZaloButton,
  isChecked,
  copiedAccount,
  onSelectOne,
  onCopyAccount,
  onEdit,
  onViewNode,
  onDelete,
}: Omit<CustomerRowProps, "isExpanded" | "colSpan" | "onToggleExpand">) {
  const statusLabel = customer.status || "Hoạt động";
  const isActive = statusLabel === "Hoạt động";
  const secondaryText = getSecondaryText(customer);
  const accountValue = customer.account || "---";
  const expiryMeta = getExpiryMeta(customer.expirationDate);
  const priceText = formatPrice(customer.price);
  const packageValue = customer.package || "---";
  const showPackageStrip = Boolean(customer.package || priceText);

  return (
    <article className={`${styles.mobileCard} ${getRowClass(customer.expirationDate, isChecked)}`}>
      <div className={styles.mobileCardHeader}>
        <div className={styles.mobileCardHeaderMain}>
          {isAdmin && (
            <input
              type="checkbox"
              aria-label={`Chọn khách hàng ${customer.name}`}
              checked={isChecked}
              onChange={(event) => onSelectOne(customer.id, event.target.checked)}
              className={`${styles.checkbox} ${styles.mobileCardCheckbox}`}
            />
          )}

          <div className={styles.mobileCardTitleBlock}>
            <div className={styles.mobileCardName} title={customer.name}>
              {customer.name}
            </div>
            <div className={styles.mobileCardSecondary} title={secondaryText}>
              {secondaryText}
            </div>
          </div>
        </div>

        {showStatus && (
          <span className={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusInactive} ${styles.mobileCardStatus}`}>
            {statusLabel}
          </span>
        )}
      </div>

      <div className={styles.mobilePhoneRow}>
        <div className={styles.mobilePhoneMain}>
          {customer.phone && (
            <a href={`tel:${customer.phone}`} title="Gọi điện" className={styles.phoneLink}>
              <PhoneCall size={16} />
            </a>
          )}
          <span className={styles.mobilePhoneValue}>{customer.phone || "---"}</span>
          {showZaloButton && customer.phone && (
            <a
              href={`https://zalo.me/${customer.phone}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Nhắn Zalo"
              className={styles.zaloLink}
            >
              <MessageCircle size={16} />
            </a>
          )}
        </div>
      </div>

      <div className={styles.mobileAccountStrip}>
        <div className={styles.mobileStripLabel}>Account</div>
        <div className={styles.mobileAccountValueRow}>
          {customer.account && (
            <button
              onClick={() => onCopyAccount(customer.account!)}
              title="Copy Account"
              className={`${styles.copyBtn} ${styles.mobileAccountCopyBtn} ${copiedAccount === customer.account ? styles.copyActive : ""}`}
            >
              {copiedAccount === customer.account ? <Check size={15} /> : <Copy size={15} />}
            </button>
          )}
          <span className={styles.mobileAccountValue} title={accountValue}>
            {accountValue}
          </span>
        </div>
      </div>

      <div className={styles.mobileMetaRow}>
        <span className={`${styles.subscriberBadge} ${styles.mobileMetaChip}`}>{formatSubscriberType(customer.subscriberType)}</span>
        {showBillingType && <span className={`${styles.metaPill} ${styles.mobileMetaChip}`}>{formatBillingType(customer.billingType)}</span>}
        <span className={`${styles.expiryBadge} ${styles.mobileMetaChip} ${expiryMeta.tone}`}>{expiryMeta.label}</span>
      </div>

      {showPackageStrip && (
        <div className={styles.mobilePackageStrip}>
          <div className={styles.mobileStripLabel}>Gói cước</div>
          <div className={styles.mobilePackageContent}>
            <span className={styles.mobilePackageName} title={packageValue}>
              {packageValue}
            </span>
            {priceText && <span className={styles.mobilePackagePrice}>{priceText}</span>}
          </div>
        </div>
      )}

      <div className={styles.mobileCardFooter}>
        <div className={styles.mobileFooterMeta}>
          <div className={styles.mobileStripLabel}>CTV</div>
          <span className={styles.mobileFooterValue} title={customer.ctvCode || "---"}>
            {customer.ctvCode || "---"}
          </span>
        </div>

        <div className={styles.actions}>
          <button
            className={`ui-icon-btn ${styles.iconBtn}`}
            onClick={() => onViewNode(customer)}
            aria-label="Xem node"
            title={customer.nodeName?.trim() ? "Xem node" : "Khách hàng chưa có node"}
            disabled={!customer.nodeName?.trim()}
          >
            <MapPin size={16} />
          </button>
          <button className={`ui-icon-btn ${styles.iconBtn}`} onClick={() => onEdit(customer)} aria-label="Sửa">
            <Edit size={16} />
          </button>
          {isAdmin && (
            <button
              className={`ui-icon-btn ui-icon-btn--danger ${styles.iconBtn} ${styles.delete}`}
              onClick={() => onDelete(customer.id)}
              aria-label="Xóa"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

export default function CustomerTableRefined({
  customers,
  selectedIds,
  onSelectIds,
  onEdit,
  onViewNode,
  onDelete,
  userRole,
  visibleColumns = {},
  copiedAccount,
  onCopyAccount,
}: CustomerTableProps) {
  const {
    status: showStatus = true,
    billingType: showBillingType = true,
    zaloButton: showZaloButton = true,
  } = visibleColumns;

  const isAdmin = userRole === "ADMIN";
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const colCount = isAdmin ? 7 : 6;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectIds(customers.map((customer) => customer.id));
      return;
    }
    onSelectIds([]);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectIds([...selectedIds, id]);
      return;
    }
    onSelectIds(selectedIds.filter((selectedId) => selectedId !== id));
  };

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  return (
    <>
      <div className={`${styles.tableWrapper} ${styles.desktopTableWrapper}`}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>Danh sách khách hàng</caption>
          <colgroup>
            {isAdmin && <col className={styles.checkboxCol} />}
            <col className={styles.customerCol} />
            <col className={styles.accountCol} />
            <col className={styles.packageCol} />
            <col className={styles.expiryCol} />
            <col className={styles.ctvCol} />
            <col className={styles.actionsCol} />
          </colgroup>
          <thead>
            <tr>
              {isAdmin && (
                <th className={styles.checkboxHead}>
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả khách hàng trên trang"
                    checked={customers.length > 0 && selectedIds.length === customers.length}
                    onChange={(event) => handleSelectAll(event.target.checked)}
                    className={styles.checkbox}
                  />
                </th>
              )}
              <th>Khách hàng</th>
              <th>Account</th>
              <th>Gói cước</th>
              <th>Ngày hết hạn</th>
              <th>Mã CTV</th>
              <th>Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={colCount} className={styles.emptyState}>
                  Không tìm thấy dữ liệu.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  isAdmin={isAdmin}
                  showStatus={showStatus}
                  showBillingType={showBillingType}
                  showZaloButton={showZaloButton}
                  isChecked={selectedIdSet.has(customer.id)}
                  isExpanded={expandedId === customer.id}
                  copiedAccount={copiedAccount}
                  colSpan={colCount}
                  onSelectOne={handleSelectOne}
                  onCopyAccount={onCopyAccount}
                  onEdit={onEdit}
                  onViewNode={onViewNode}
                  onDelete={onDelete}
                  onToggleExpand={handleToggleExpand}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.mobileCards}>
        {customers.length === 0 ? (
          <div className={styles.mobileEmptyState}>Không tìm thấy dữ liệu.</div>
        ) : (
          customers.map((customer) => (
            <CustomerMobileCard
              key={customer.id}
              customer={customer}
              isAdmin={isAdmin}
              showStatus={showStatus}
              showBillingType={showBillingType}
              showZaloButton={showZaloButton}
              isChecked={selectedIdSet.has(customer.id)}
              copiedAccount={copiedAccount}
              onSelectOne={handleSelectOne}
              onCopyAccount={onCopyAccount}
              onEdit={onEdit}
              onViewNode={onViewNode}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </>
  );
}
