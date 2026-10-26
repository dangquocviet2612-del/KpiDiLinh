"use client";

import type { ReactNode } from "react";
import styles from "./MapSearchResults.module.css";

type SearchResultBase = {
  id: string | number;
};

type MapSearchResultsProps<T extends SearchResultBase> = {
  id?: string;
  className?: string;
  items: T[];
  loading?: boolean;
  visibleCount?: number;
  resultNoun: string;
  emptyText: string;
  onSelect: (item: T) => void;
  getPrimaryText: (item: T) => ReactNode;
  getSecondaryText?: (item: T) => ReactNode;
  renderActions?: (item: T) => ReactNode;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
};

export default function MapSearchResults<T extends SearchResultBase>({
  id,
  className,
  items,
  loading = false,
  visibleCount = 8,
  resultNoun,
  emptyText,
  onSelect,
  getPrimaryText,
  getSecondaryText,
  renderActions,
  activeIndex = -1,
  onActiveIndexChange,
}: MapSearchResultsProps<T>) {
  const visibleItems = items.slice(0, visibleCount);
  const hiddenCount = Math.max(items.length - visibleItems.length, 0);

  return (
    <div className={className}>
      <div className={styles.header}>
        {loading ? (
          "Đang tìm..."
        ) : (
          <>
            Tìm thấy <strong>{items.length}</strong> {resultNoun}
          </>
        )}
      </div>

      {items.length > 0 ? (
        <ul id={id} className={styles.list} role="listbox">
          {visibleItems.map((item, index) => {
            const secondaryText = getSecondaryText?.(item);
            const active = index === activeIndex;

            return (
              <li
                key={item.id}
                className={`${styles.item} ${active ? styles.active : ""}`}
                onMouseEnter={() => onActiveIndexChange?.(index)}
              >
                <button
                  type="button"
                  id={id ? `${id}-option-${index}` : undefined}
                  className={styles.selectButton}
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelect(item)}
                  onFocus={() => onActiveIndexChange?.(index)}
                >
                  <div className={styles.details}>
                    <div className={styles.primary}>{getPrimaryText(item)}</div>
                    {secondaryText ? <div className={styles.secondary}>{secondaryText}</div> : null}
                  </div>
                </button>
                {renderActions ? <div className={styles.actions}>{renderActions(item)}</div> : null}
              </li>
            );
          })}
          {hiddenCount > 0 ? <li className={styles.more}>...và {hiddenCount} kết quả khác</li> : null}
        </ul>
      ) : (
        !loading && <div id={id} className={styles.empty}>{emptyText}</div>
      )}
    </div>
  );
}
