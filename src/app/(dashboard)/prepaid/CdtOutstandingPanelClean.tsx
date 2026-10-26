"use client";

import { Fragment, type ChangeEvent, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Download, Loader2, Upload } from "lucide-react";
import {
  OUTSTANDING_STATUS_COLLECTED,
  OUTSTANDING_STATUS_PENDING,
} from "@/lib/cdt-outstanding";
import PrepaidPanelState from "./PrepaidPanelState";
import styles from "./kpi.module.css";

const TEXT = {
  title: "T\u1ed3n CDT",
  subtitle: "Theo d\u00f5i danh s\u00e1ch t\u1ed3n ch\u01b0a thu theo k\u1ef3 file v\u00e0 th\u00e1ng h\u1ebft h\u1ea1n.",
  back: "Quay l\u1ea1i CDT",
  downloadTemplate: "T\u1ea3i file m\u1eabu",
  uploadOutstanding: "T\u1ea3i file T\u1ed3n CDT",
  reportMonth: "K\u1ef3 file",
  expiryMonth: "Th\u00e1ng HH",
  status: "Tr\u1ea1ng th\u00e1i",
  account: "Thu\u00ea bao",
  allMonths: "T\u1ea5t c\u1ea3 th\u00e1ng",
  monthPrefix: "Th\u00e1ng",
  pending: "Ch\u01b0a thu",
  collected: "\u0110\u00e3 thu",
  all: "T\u1ea5t c\u1ea3",
  allCtv: "T\u1ea5t c\u1ea3 CTV",
  allManagers: "T\u1ea5t c\u1ea3 qu\u1ea3n l\u00fd",
  refresh: "L\u00e0m m\u1edbi T\u1ed3n CDT",
  refreshing: "\u0110ang l\u00e0m m\u1edbi d\u1eef li\u1ec7u...",
  filters: "B\u1ed9 l\u1ecdc",
  allStatuses: "T\u1ea5t c\u1ea3 tr\u1ea1ng th\u00e1i",
  managerShort: "QL",
  refreshingShort: "\u0110ang l\u00e0m m\u1edbi...",
  emptyTitle: "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u T\u1ed3n CDT",
  emptyDescription: "Th\u1eed \u0111i\u1ec1u ch\u1ec9nh k\u1ef3 file, th\u00e1ng h\u1ebft h\u1ea1n ho\u1eb7c b\u1ed9 l\u1ecdc \u0111\u1ec3 xem danh s\u00e1ch t\u1ed3n.",
  totalSubscribers: "T\u1ed5ng thu\u00ea bao",
  totalSubscribersHelp: "To\u00e0n b\u1ed9 thu\u00ea bao trong k\u1ef3 file hi\u1ec7n t\u1ea1i",
  pendingHelp: "C\u1ea7n ti\u1ebfp t\u1ee5c x\u1eed l\u00fd v\u00e0 \u0111\u1ed1i so\u00e1t",
  collectedHelp: "\u0110\u00e3 x\u00e1c nh\u1eadn thu th\u00e0nh c\u00f4ng",
  other: "Kh\u00e1c",
  totalTbShort: "T\u1ed5ng TB",
  serviceUnknown: "Kh\u00f4ng r\u00f5 d\u1ecbch v\u1ee5",
  address: "\u0110\u1ecba ch\u1ec9",
  unknown: "Ch\u01b0a r\u00f5",
  page: "Trang",
  prev: "Tr\u01b0\u1edbc",
  next: "Sau",
  noData: "-",
  expiryPrefix: "H\u1ebft h\u1ea1n",
  details: "Chi ti\u1ebft",
  collapse: "Thu g\u1ecdn",
  expandDetails: "M\u1edf chi ti\u1ebft",
  serviceLabel: "D\u1ecbch v\u1ee5",
  phoneLabel: "S\u0110T",
  addressLabel: "\u0110\u1ecba ch\u1ec9",
} as const;

type CtvOption = {
  id: string | number;
  username: string;
};

type OutstandingRow = {
  id: number;
  reportMonth: string;
  account: string;
  customerName?: string | null;
  phone?: string | null;
  address?: string | null;
  ctvCode: string;
  serviceName?: string | null;
  expiryDateText?: string | null;
  expiryMonth: string;
  statusCheck: string;
  subscriberType: string;
};

type OutstandingTotals = {
  total: number;
  chuaThu: number;
  daThu: number;
  ftth: number;
  ths: number;
  camera: number;
  khac: number;
  chuaThuFtth: number;
  chuaThuThs: number;
  chuaThuCamera: number;
  chuaThuKhac: number;
  daThuFtth: number;
  daThuThs: number;
  daThuCamera: number;
  daThuKhac: number;
};

type CdtOutstandingPanelCleanProps = {
  canAdmin: boolean;
  canSelectCtv: boolean;
  reportMonth: string;
  expiryMonth: string;
  statusFilter: string;
  accountFilter: string;
  selectedCtv: string;
  managerFilter: string;
  availableExpiryMonths: string[];
  reportMonthLabel: string;
  activeMobileFilterCount: number;
  showMobileFilters: boolean;
  loading: boolean;
  refreshing: boolean;
  importing: boolean;
  downloadingTemplate: boolean;
  errorMessage: string | null;
  rows: OutstandingRow[];
  totals: OutstandingTotals;
  page: number;
  totalPages: number;
  managerOptions: string[];
  ctvOptions: CtvOption[];
  surfaceActionBtnClass: string;
  surfacePrimaryBtnClass: string;
  surfacePaginationBtnClass: string;
  surfaceBadgeClass: string;
  surfaceChipClass: string;
  onBack: () => void;
  onReportMonthChange: (value: string) => void;
  onExpiryMonthChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onAccountFilterChange: (value: string) => void;
  onSelectedCtvChange: (value: string) => void;
  onManagerFilterChange: (value: string) => void;
  onRefresh: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: () => void;
  onToggleMobileFilters: () => void;
  onPageChange: (value: number | ((current: number) => number)) => void;
};

function getOutstandingTypeToneClass(subscriberType?: string | null) {
  const value = String(subscriberType || "").toUpperCase();
  if (value === "FTTH") return styles.cdtToneFtth;
  if (value === "THS") return styles.cdtToneThs;
  if (value === "CAMERA") return styles.cdtToneCamera;
  return styles.cdtToneDefault;
}

function getOutstandingStatusClass(status?: string | null) {
  const value = String(status || "");
  if (value === OUTSTANDING_STATUS_PENDING) return styles.outstandingStatusPending;
  if (value === OUTSTANDING_STATUS_COLLECTED) return styles.outstandingStatusCollected;
  return styles.outstandingStatusUnknown;
}

export default function CdtOutstandingPanelClean(props: CdtOutstandingPanelCleanProps) {
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="ui-panel-heading">
          <h1 className={`${styles.title} ui-panel-title`}>{TEXT.title}</h1>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>{TEXT.subtitle}</p>
        </div>
        <div className={styles.cdtHeaderActions}>
          <button className={props.surfaceActionBtnClass} onClick={props.onBack}>
            {TEXT.back}
          </button>
          {props.canAdmin ? (
            <>
              <button
                className={`${props.surfaceActionBtnClass} ${styles.cdtMobileHeaderAction}`}
                onClick={props.onDownloadTemplate}
                disabled={props.downloadingTemplate}
              >
                {props.downloadingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {TEXT.downloadTemplate}
              </button>
              <label className={`${props.surfacePrimaryBtnClass} ${styles.cdtMobileHeaderAction}`}>
                {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {TEXT.uploadOutstanding}
                <input type="file" accept=".xlsx,.xls" hidden onChange={props.onImport} disabled={props.importing} />
              </label>
            </>
          ) : null}
        </div>
      </div>

      <div className={`glass-panel ${styles.toolbar} ${styles.mobileStickyFilter} ${styles.cdtDesktopToolbar}`}>
        <div className={styles.outstandingToolbarFilters}>
          <div className={styles.toolbarField}>
            <span className={styles.toolbarFieldLabel}>{TEXT.reportMonth}</span>
            <input
              type="month"
              className="input-base"
              value={props.reportMonth}
              onChange={(event) => props.onReportMonthChange(event.target.value)}
            />
          </div>
          <div className={styles.toolbarField}>
            <span className={styles.toolbarFieldLabel}>{TEXT.expiryMonth}</span>
            <select
              className="input-base"
              value={props.expiryMonth}
              onChange={(event) => props.onExpiryMonthChange(event.target.value)}
            >
              <option value="">{TEXT.allMonths}</option>
              {props.availableExpiryMonths.map((month) => (
                <option key={`outstanding-expiry-${month}`} value={month}>
                  {TEXT.monthPrefix} {month}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.toolbarField}>
            <span className={styles.toolbarFieldLabel}>{TEXT.status}</span>
            <select
              className="input-base"
              value={props.statusFilter}
              onChange={(event) => props.onStatusFilterChange(event.target.value)}
            >
              <option value={OUTSTANDING_STATUS_PENDING}>{TEXT.pending}</option>
              <option value={OUTSTANDING_STATUS_COLLECTED}>{TEXT.collected}</option>
              <option value="">{TEXT.all}</option>
            </select>
          </div>
          <div className={`${styles.toolbarField} ${styles.outstandingAccountField}`}>
            <span className={styles.toolbarFieldLabel}>{TEXT.account}</span>
            <input
              className="input-base"
              placeholder="T\u00ecm theo thu\u00ea bao"
              value={props.accountFilter}
              onChange={(event) => props.onAccountFilterChange(event.target.value)}
            />
          </div>
          {props.canSelectCtv ? (
            <select
              className="input-base"
              value={props.selectedCtv}
              onChange={(event) => props.onSelectedCtvChange(event.target.value)}
            >
              <option value="">{TEXT.allCtv}</option>
              {props.ctvOptions.map((user) => (
                <option key={`outstanding-ctv-${user.id}`} value={user.username}>
                  {user.username}
                </option>
              ))}
            </select>
          ) : null}
          {props.canAdmin ? (
            <select
              className="input-base"
              value={props.managerFilter}
              onChange={(event) => props.onManagerFilterChange(event.target.value)}
            >
              <option value="">{TEXT.allManagers}</option>
              {props.managerOptions.map((manager) => (
                <option key={`outstanding-manager-${manager}`} value={manager}>
                  {manager}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div className={styles.outstandingToolbarActions}>
          <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
            {TEXT.refresh}
          </button>
          {props.canAdmin ? (
            <>
              <button
                className={props.surfaceActionBtnClass}
                onClick={props.onDownloadTemplate}
                disabled={props.downloadingTemplate}
              >
                {props.downloadingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {TEXT.downloadTemplate}
              </button>
              <label className={props.surfacePrimaryBtnClass}>
                {props.importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {TEXT.uploadOutstanding}
                <input type="file" accept=".xlsx,.xls" hidden onChange={props.onImport} disabled={props.importing} />
              </label>
            </>
          ) : null}
          {props.refreshing ? <span className={styles.refreshHint}>{TEXT.refreshing}</span> : null}
        </div>
      </div>

      <div className={`glass-panel ${styles.mobileStickyFilter} ${styles.cdtMobileToolbar}`}>
        <div className={styles.cdtMobileToolbarSummary}>
          <div className={styles.cdtMobileDateSummary} title={props.reportMonthLabel}>
            <CalendarDays size={16} />
            <span>{props.reportMonthLabel}</span>
          </div>
          <button
            type="button"
            className={`${props.surfaceActionBtnClass} ${styles.cdtMobileFilterToggle}`}
            onClick={props.onToggleMobileFilters}
            aria-expanded={props.showMobileFilters}
          >
            <span>
              {props.activeMobileFilterCount > 0 ? `${TEXT.filters} (${props.activeMobileFilterCount})` : TEXT.filters}
            </span>
            {props.showMobileFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {(props.expiryMonth || props.statusFilter !== OUTSTANDING_STATUS_PENDING || props.accountFilter || props.selectedCtv || props.managerFilter || props.refreshing) ? (
          <div className={styles.cdtMobileFilterMeta}>
            {props.expiryMonth ? (
              <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>{TEXT.expiryMonth}: {props.expiryMonth}</span>
            ) : null}
            {props.statusFilter !== OUTSTANDING_STATUS_PENDING ? (
              <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>
                {props.statusFilter || TEXT.allStatuses}
              </span>
            ) : null}
            {props.accountFilter ? (
              <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>{TEXT.account}: {props.accountFilter}</span>
            ) : null}
            {props.selectedCtv ? (
              <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>CTV: {props.selectedCtv}</span>
            ) : null}
            {props.canAdmin && props.managerFilter ? (
              <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>{TEXT.managerShort}: {props.managerFilter}</span>
            ) : null}
            {props.refreshing ? (
              <span className={`${props.surfaceChipClass} ${styles.cdtMobileMetaChip}`}>{TEXT.refreshingShort}</span>
            ) : null}
          </div>
        ) : null}
        {props.showMobileFilters ? (
          <div className={styles.cdtMobileFilterPanel}>
            <div className={styles.toolbarField}>
              <span className={styles.toolbarFieldLabel}>{TEXT.reportMonth}</span>
              <input
                type="month"
                className="input-base"
                value={props.reportMonth}
                onChange={(event) => props.onReportMonthChange(event.target.value)}
              />
            </div>
            <select
              className="input-base"
              value={props.expiryMonth}
              onChange={(event) => props.onExpiryMonthChange(event.target.value)}
            >
              <option value="">{TEXT.allMonths}</option>
              {props.availableExpiryMonths.map((month) => (
                <option key={`outstanding-mobile-expiry-${month}`} value={month}>
                  {TEXT.monthPrefix} {month}
                </option>
              ))}
            </select>
            <select
              className="input-base"
              value={props.statusFilter}
              onChange={(event) => props.onStatusFilterChange(event.target.value)}
            >
              <option value={OUTSTANDING_STATUS_PENDING}>{TEXT.pending}</option>
              <option value={OUTSTANDING_STATUS_COLLECTED}>{TEXT.collected}</option>
              <option value="">{TEXT.all}</option>
            </select>
            <input
              className="input-base"
              placeholder="T\u00ecm theo thu\u00ea bao"
              value={props.accountFilter}
              onChange={(event) => props.onAccountFilterChange(event.target.value)}
            />
            {props.canSelectCtv ? (
              <select
                className="input-base"
                value={props.selectedCtv}
                onChange={(event) => props.onSelectedCtvChange(event.target.value)}
              >
                <option value="">{TEXT.allCtv}</option>
                {props.ctvOptions.map((user) => (
                  <option key={`outstanding-mobile-ctv-${user.id}`} value={user.username}>
                    {user.username}
                  </option>
                ))}
              </select>
            ) : null}
            {props.canAdmin ? (
              <select
                className="input-base"
                value={props.managerFilter}
                onChange={(event) => props.onManagerFilterChange(event.target.value)}
              >
                <option value="">{TEXT.allManagers}</option>
                {props.managerOptions.map((manager) => (
                  <option key={`outstanding-mobile-manager-${manager}`} value={manager}>
                    {manager}
                  </option>
                ))}
              </select>
            ) : null}
            <div className={styles.cdtMobileActionGrid}>
              <button className={props.surfaceActionBtnClass} onClick={props.onRefresh}>
                {TEXT.refresh}
              </button>
              {props.canAdmin ? (
                <button className={props.surfaceActionBtnClass} onClick={props.onDownloadTemplate}>
                  {TEXT.downloadTemplate}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <PrepaidPanelState
        loading={props.loading}
        errorMessage={props.errorMessage}
        isEmpty={props.rows.length === 0}
        emptyTitle={TEXT.emptyTitle}
        emptyDescription={TEXT.emptyDescription}
        onRetry={props.onRefresh}
        actionBtnClass={props.surfaceActionBtnClass}
        skeletonStats={3}
        skeletonRows={6}
      >
        <>
          <div className={`glass-panel ${styles.cdtReportStats} ${styles.cdtDesktopStats}`}>
            <div className={`${styles.cdtReportStatCard} ${styles.cdtReportStatPrimary}`}>
              <span>{TEXT.totalSubscribers}</span>
              <strong>{props.totals.total}</strong>
              <div className={styles.outstandingStatusBreakdown}>
                <div className={styles.outstandingStatusBreakdownItem}>
                  <label>FTTH</label>
                  <b>{props.totals.ftth}</b>
                </div>
                <div className={styles.outstandingStatusBreakdownItem}>
                  <label>THS</label>
                  <b>{props.totals.ths}</b>
                </div>
                <div className={styles.outstandingStatusBreakdownItem}>
                  <label>Camera</label>
                  <b>{props.totals.camera}</b>
                </div>
                <div className={styles.outstandingStatusBreakdownItem}>
                  <label>{TEXT.other}</label>
                  <b>{props.totals.khac}</b>
                </div>
              </div>
              <em className={styles.outstandingStatFootnote}>{TEXT.totalSubscribersHelp}</em>
            </div>
            <div className={`${styles.cdtReportStatCard} ${styles.outstandingPendingCard}`}>
              <span>{TEXT.pending}</span>
              <strong>{props.totals.chuaThu}</strong>
              <div className={styles.outstandingStatusBreakdown}>
                <div className={styles.outstandingStatusBreakdownItem}>
                  <label>FTTH</label>
                  <b>{props.totals.chuaThuFtth}</b>
                </div>
                <div className={styles.outstandingStatusBreakdownItem}>
                  <label>THS</label>
                  <b>{props.totals.chuaThuThs}</b>
                </div>
              </div>
              <em className={styles.outstandingStatFootnote}>{TEXT.pendingHelp}</em>
            </div>
            <div className={`${styles.cdtReportStatCard} ${styles.outstandingCollectedCard}`}>
              <span>{TEXT.collected}</span>
              <strong>{props.totals.daThu}</strong>
              <div className={styles.outstandingStatusBreakdown}>
                <div className={styles.outstandingStatusBreakdownItem}>
                  <label>FTTH</label>
                  <b>{props.totals.daThuFtth}</b>
                </div>
                <div className={styles.outstandingStatusBreakdownItem}>
                  <label>THS</label>
                  <b>{props.totals.daThuThs}</b>
                </div>
              </div>
              <em className={styles.outstandingStatFootnote}>{TEXT.collectedHelp}</em>
            </div>
          </div>

          <div className={styles.cdtMobileStatsGrid}>
            <div className={`${styles.cdtMobileStatCard} ${styles.cdtMobileBreakdownCard}`}>
              <span>{TEXT.totalTbShort}</span>
              <strong>{props.totals.total}</strong>
              <div className={styles.outstandingStatusBreakdownMobile}>
                <small>FTTH {props.totals.ftth}</small>
                <small>THS {props.totals.ths}</small>
                <small>Camera {props.totals.camera}</small>
                <small>
                  {TEXT.other} {props.totals.khac}
                </small>
              </div>
            </div>
            <div className={`${styles.cdtMobileStatCard} ${styles.outstandingPendingCard}`}>
              <span>{TEXT.pending}</span>
              <strong>{props.totals.chuaThu}</strong>
              <div className={styles.outstandingStatusBreakdownMobile}>
                <small>FTTH {props.totals.chuaThuFtth}</small>
                <small>THS {props.totals.chuaThuThs}</small>
              </div>
            </div>
            <div className={`${styles.cdtMobileStatCard} ${styles.outstandingCollectedCard}`}>
              <span>{TEXT.collected}</span>
              <strong>{props.totals.daThu}</strong>
              <div className={styles.outstandingStatusBreakdownMobile}>
                <small>FTTH {props.totals.daThuFtth}</small>
                <small>THS {props.totals.daThuThs}</small>
              </div>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <colgroup>
                <col className={styles.outstandingColIndex} />
                <col className={styles.outstandingColAccount} />
                <col className={styles.outstandingColCustomer} />
                <col className={styles.outstandingColCtv} />
                <col className={styles.outstandingColExpiry} />
                <col className={styles.outstandingColStatus} />
                <col className={styles.outstandingColToggle} />
              </colgroup>
              <thead>
                <tr>
                  <th className={styles.stickyFirst}>STT</th>
                  <th>Thuê bao</th>
                  <th>Khách hàng</th>
                  <th>CTV</th>
                  <th>Hết hạn CDT</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {props.rows.map((row, index) => {
                  const expanded = expandedRowId === row.id;
                  const handleToggle = () => setExpandedRowId(expanded ? null : row.id);
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`${styles.outstandingRowInteractive} ${expanded ? styles.outstandingRowExpanded : ""}`}
                        onClick={handleToggle}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleToggle();
                          }
                        }}
                        tabIndex={0}
                        aria-expanded={expanded}
                      >
                        <td className={`${styles.stickyFirst} ${styles.nameCell}`}>
                          {(props.page - 1) * 40 + index + 1}
                        </td>
                        <td className={styles.cdtAccountCell}>
                          <div className={styles.outstandingPrimaryCell}>
                            <strong>{row.account}</strong>
                            <span className={styles.outstandingSecondaryText}>
                              {row.serviceName || TEXT.serviceUnknown}
                            </span>
                          </div>
                        </td>
                        <td className={styles.outstandingCustomerCell}>
                          <div className={styles.outstandingStack}>
                            <strong>{row.customerName || TEXT.noData}</strong>
                            {row.phone ? <span>{row.phone}</span> : null}
                          </div>
                        </td>
                        <td className={styles.outstandingCtvCell}>
                          <div className={styles.outstandingCompactText}>{row.ctvCode}</div>
                        </td>
                        <td className={styles.outstandingExpiryCell}>
                          <div className={styles.outstandingStack}>
                            <strong>{row.expiryDateText || TEXT.noData}</strong>
                            <span>{TEXT.monthPrefix} {row.expiryMonth}</span>
                          </div>
                        </td>
                        <td className={styles.outstandingStatusCell}>
                          <span className={`${props.surfaceBadgeClass} ${getOutstandingStatusClass(row.statusCheck)}`}>
                            {row.statusCheck || TEXT.unknown}
                          </span>
                        </td>
                        <td className={styles.outstandingToggleCell}>
                          <button
                            type="button"
                            className={styles.outstandingToggleBtn}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggle();
                            }}
                            aria-expanded={expanded}
                            aria-label={expanded ? TEXT.collapse : TEXT.expandDetails}
                            title={expanded ? TEXT.collapse : TEXT.expandDetails}
                          >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      <tr
                        className={`${styles.outstandingDetailRow} ${
                          expanded ? styles.outstandingDetailRowExpanded : styles.outstandingDetailRowCollapsed
                        }`}
                        aria-hidden={!expanded}
                      >
                          <td className={`${styles.stickyFirst} ${styles.outstandingDetailIndex}`} />
                          <td colSpan={6} className={styles.outstandingDetailCell}>
                            <div
                              className={`${styles.outstandingDetailInner} ${
                                expanded ? styles.outstandingDetailInnerExpanded : styles.outstandingDetailInnerCollapsed
                              }`}
                            >
                              <div className={styles.outstandingDetailConnector} aria-hidden="true">
                                <span className={styles.outstandingDetailConnectorDot} />
                              </div>
                              <div className={styles.outstandingDetailGrid}>
                                <div className={styles.outstandingDetailItem}>
                                  <span className={styles.outstandingDetailLabel}>{TEXT.serviceLabel}</span>
                                  <div className={styles.outstandingDetailValue}>
                                    <strong>{row.serviceName || TEXT.serviceUnknown}</strong>
                                    <span className={`${styles.cdtTypePill} ${getOutstandingTypeToneClass(row.subscriberType)}`}>
                                      {row.subscriberType || TEXT.other}
                                    </span>
                                  </div>
                                </div>
                                <div className={styles.outstandingDetailItem}>
                                  <span className={styles.outstandingDetailLabel}>{TEXT.phoneLabel}</span>
                                  <div className={styles.outstandingDetailValue}>
                                    <strong>{row.phone || TEXT.noData}</strong>
                                  </div>
                                </div>
                                <div className={`${styles.outstandingDetailItem} ${styles.outstandingDetailWide}`}>
                                  <span className={styles.outstandingDetailLabel}>{TEXT.addressLabel}</span>
                                  <div className={styles.outstandingDetailValue}>
                                    <strong>{row.address || TEXT.noData}</strong>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            <div className={styles.mobileCards}>
              {props.rows.map((row, index) => (
                <div key={`outstanding-mobile-${row.id}`} className={`glass-panel ${styles.mobileCard} ${styles.cdtMobileCard}`}>
                  <div className={`${styles.mobileHeader} ${styles.cdtMobileHeader}`}>
                    <div className={styles.mobileTitle}>
                      {(props.page - 1) * 40 + index + 1}. {row.account}
                    </div>
                    <span className={`${props.surfaceBadgeClass} ${getOutstandingStatusClass(row.statusCheck)}`}>
                      {row.statusCheck || TEXT.unknown}
                    </span>
                  </div>
                  <div className={styles.mobileSummaryRows}>
                    <div className={styles.mobileSummaryLine}>
                      <strong>{row.customerName || TEXT.noData}</strong>
                    </div>
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>CTV: {row.ctvCode}</span>
                      {row.phone ? <span className={`${props.surfaceChipClass} ${styles.chip}`}>{row.phone}</span> : null}
                    </div>
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${styles.cdtTypePill} ${getOutstandingTypeToneClass(row.subscriberType)}`}>
                        {row.subscriberType || TEXT.other}
                      </span>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                        {row.serviceName || TEXT.serviceUnknown}
                      </span>
                    </div>
                    <div className={styles.mobileSummaryLine}>
                      <span className={`${props.surfaceChipClass} ${styles.chip}`}>
                        {TEXT.expiryPrefix}: {row.expiryDateText || TEXT.noData} / {TEXT.monthPrefix} {row.expiryMonth}
                      </span>
                    </div>
                    {row.address ? (
                      <div className={styles.mobileMetaRow}>
                        <span>{TEXT.address}</span>
                        <strong>{row.address}</strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {props.totalPages > 1 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "10px 12px" }}>
                <button
                  className={props.surfacePaginationBtnClass}
                  disabled={props.page <= 1}
                  onClick={() => props.onPageChange((current) => Math.max(1, current - 1))}
                >
                  {TEXT.prev}
                </button>
                <span className={styles.refreshHint}>{TEXT.page} {props.page}/{props.totalPages}</span>
                <button
                  className={props.surfacePaginationBtnClass}
                  disabled={props.page >= props.totalPages}
                  onClick={() => props.onPageChange((current) => Math.min(props.totalPages, current + 1))}
                >
                  {TEXT.next}
                </button>
              </div>
            ) : null}
          </div>
        </>
      </PrepaidPanelState>
    </div>
  );
}
