import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MAP_STYLE_OPTIONS, type MapStyleMode, type MapStyleOption } from "@/lib/map-tiles";

type MapStyleMenuProps = {
  open: boolean;
  id: string;
  label: string;
  value: MapStyleMode;
  onSelect: (style: MapStyleMode) => void;
  className?: string;
  optionClassName?: string;
  activeOptionClassName?: string;
  header?: ReactNode;
  itemsClassName?: string;
  options?: MapStyleOption[];
  renderOption?: (option: MapStyleOption, active: boolean) => ReactNode;
};

export default function MapStyleMenu({
  open,
  id,
  label,
  value,
  onSelect,
  className,
  optionClassName,
  activeOptionClassName,
  header,
  itemsClassName,
  options = MAP_STYLE_OPTIONS,
  renderOption,
}: MapStyleMenuProps) {
  if (!open) return null;

  const optionButtons = options.map((option) => {
    const active = value === option.key;
    return (
      <button
        key={option.key}
        type="button"
        className={cn("ui-action-menu-item", optionClassName, active && activeOptionClassName)}
        onClick={() => onSelect(option.key)}
        role="menuitemradio"
        aria-checked={active}
      >
        {renderOption ? renderOption(option, active) : option.label}
      </button>
    );
  });

  return (
    <div id={id} className={cn("ui-action-menu", className)} role="menu" aria-label={label}>
      {header}
      {itemsClassName ? <div className={itemsClassName}>{optionButtons}</div> : optionButtons}
    </div>
  );
}
