"use client";

import { forwardRef, useRef, type ChangeEvent } from "react";
import {
  Download,
  Eye,
  FileSpreadsheet,
  Layers3,
  Loader2,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { MAP_STYLE_OPTIONS, type MapStyleMode } from "@/lib/map-tiles";
import styles from "./node-map.module.css";

type NodeMapOptionsMenuProps = {
  open: boolean;
  canAdmin: boolean;
  mapStyle: MapStyleMode;
  busy: boolean;
  onToggle: () => void;
  onClose: () => void;
  onExport: () => void;
  onMapStyleChange: (style: MapStyleMode) => void;
  onUploadNodes: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadEfficiency: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadCustomerNodeMap: (event: ChangeEvent<HTMLInputElement>) => void;
  onShowCustomerNodeMappings: () => void;
  onDownloadCustomerNodeTemplate: () => void;
  onDownloadNodeEfficiencyTemplate: () => void;
};

const NodeMapOptionsMenu = forwardRef<HTMLDivElement, NodeMapOptionsMenuProps>(function NodeMapOptionsMenu(
  props,
  ref,
) {
  const nodeFileRef = useRef<HTMLInputElement>(null);
  const efficiencyFileRef = useRef<HTMLInputElement>(null);
  const customerNodeFileRef = useRef<HTMLInputElement>(null);

  const runAndClose = (action: () => void) => {
    action();
    props.onClose();
  };

  return (
    <div className={styles.styleMenuAnchor} ref={ref}>
      <button
        type="button"
        className={`ui-action-btn ui-action-btn--pill ${styles.mapActionBtn} ${styles.optionsTrigger}`}
        onClick={props.onToggle}
        aria-expanded={props.open}
        aria-controls="node-map-options-menu"
        aria-haspopup="menu"
      >
        {props.busy ? <Loader2 size={17} className="animate-spin" /> : <SlidersHorizontal size={17} />}
        <span>Tùy chọn</span>
      </button>

      {props.open && (
        <div
          id="node-map-options-menu"
          className={`ui-action-menu ${styles.mapStyleDropdown} ${styles.optionsMenu}`}
          role="menu"
          aria-label="Tùy chọn bản đồ node"
        >
          <button
            type="button"
            className="ui-action-menu-item"
            role="menuitem"
            onClick={() => runAndClose(props.onExport)}
          >
            <Download size={15} />
            <span>Xuất Excel</span>
          </button>

          <div className={styles.optionsMenuSectionLabel}>Kiểu bản đồ</div>
          {MAP_STYLE_OPTIONS.map((option) => {
            const active = props.mapStyle === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={`ui-action-menu-item ${active ? styles.active : ""}`}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => runAndClose(() => props.onMapStyleChange(option.key))}
              >
                <Layers3 size={15} />
                <span>{option.label}</span>
              </button>
            );
          })}

          {props.canAdmin && (
            <>
              <div className={styles.optionsMenuSectionLabel}>Nhập dữ liệu</div>
              <button
                type="button"
                className="ui-action-menu-item"
                role="menuitem"
                disabled={props.busy}
                onClick={() => nodeFileRef.current?.click()}
              >
                <Upload size={15} />
                <span>Nhập vị trí KML/KMZ</span>
              </button>
              <button
                type="button"
                className="ui-action-menu-item"
                role="menuitem"
                disabled={props.busy}
                onClick={() => efficiencyFileRef.current?.click()}
              >
                <FileSpreadsheet size={15} />
                <span>Nhập hiệu suất Node</span>
              </button>
              <button
                type="button"
                className="ui-action-menu-item"
                role="menuitem"
                disabled={props.busy}
                onClick={() => customerNodeFileRef.current?.click()}
              >
                <FileSpreadsheet size={15} />
                <span>Nhập Node thuê bao</span>
              </button>
              <button
                type="button"
                className="ui-action-menu-item"
                role="menuitem"
                onClick={() => runAndClose(props.onShowCustomerNodeMappings)}
              >
                <Eye size={15} />
                <span>Xem mapping Account - Node</span>
              </button>

              <div className={styles.optionsMenuSectionLabel}>File mẫu</div>
              <button
                type="button"
                className="ui-action-menu-item"
                role="menuitem"
                onClick={() => runAndClose(props.onDownloadCustomerNodeTemplate)}
              >
                <Download size={15} />
                <span>Mẫu Node thuê bao</span>
              </button>
              <button
                type="button"
                className="ui-action-menu-item"
                role="menuitem"
                onClick={() => runAndClose(props.onDownloadNodeEfficiencyTemplate)}
              >
                <Download size={15} />
                <span>Mẫu hiệu suất Node</span>
              </button>
            </>
          )}
        </div>
      )}

      <input ref={nodeFileRef} type="file" accept=".kmz,.kml" hidden onChange={props.onUploadNodes} />
      <input
        ref={efficiencyFileRef}
        type="file"
        accept=".xlsx,.xls"
        hidden
        onChange={props.onUploadEfficiency}
      />
      <input
        ref={customerNodeFileRef}
        type="file"
        accept=".xlsx,.xls"
        hidden
        onChange={props.onUploadCustomerNodeMap}
      />
    </div>
  );
});

export default NodeMapOptionsMenu;
