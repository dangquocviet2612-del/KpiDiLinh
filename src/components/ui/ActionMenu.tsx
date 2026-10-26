"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./ui.module.css";

type MenuItemProps = {
  className?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  role?: string;
  tabIndex?: number;
};

type ActionMenuProps = {
  label: string;
  children: ReactNode;
  trigger?: ReactNode;
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
};

export default function ActionMenu({
  label,
  children,
  trigger,
  align = "end",
  className,
  triggerClassName,
  menuClassName,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const getItems = () => Array.from(
    menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not([disabled])") ?? [],
  );

  const closeAndRestoreFocus = () => {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;

    window.setTimeout(() => getItems()[0]?.focus());
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = getItems();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || items.length === 0) return;

    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1 + items.length) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const items = Children.map(children, (child) => {
    if (!isValidElement<MenuItemProps>(child)) return child;

    return cloneElement(child as ReactElement<MenuItemProps>, {
      role: "menuitem",
      tabIndex: -1,
      className: cn("ui-action-menu-item", child.props.className),
      onClick: (event) => {
        child.props.onClick?.(event);
        setOpen(false);
        window.setTimeout(() => document.getElementById(triggerId)?.focus());
      },
    });
  });

  return (
    <div ref={rootRef} className={cn(styles.actionMenuRoot, className)}>
      <button
        id={triggerId}
        ref={triggerRef}
        type="button"
        className={cn("ui-action-btn", !trigger && "ui-action-btn--icon", triggerClassName)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger ?? <MoreHorizontal size={18} aria-hidden="true" />}
      </button>
      {open && (
        <div
          ref={menuRef}
          className={cn("ui-action-menu", styles.actionMenu, align === "start" && styles.actionMenuStart, menuClassName)}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
        >
          {items}
        </div>
      )}
    </div>
  );
}
