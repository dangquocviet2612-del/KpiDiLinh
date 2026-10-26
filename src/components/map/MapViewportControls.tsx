import { Minus, Plus, Scan } from "lucide-react";
import { cn } from "@/lib/utils";

type MapViewportControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  fitLabel: string;
  className?: string;
  buttonClassName?: string;
};

export default function MapViewportControls({
  onZoomIn,
  onZoomOut,
  onFit,
  fitLabel,
  className,
  buttonClassName,
}: MapViewportControlsProps) {
  return (
    <div className={cn(className)} role="group" aria-label="Điều khiển bản đồ">
      <button type="button" className={cn(buttonClassName)} onClick={onZoomIn} title="Phóng to" aria-label="Phóng to bản đồ">
        <Plus size={17} aria-hidden="true" />
      </button>
      <button type="button" className={cn(buttonClassName)} onClick={onZoomOut} title="Thu nhỏ" aria-label="Thu nhỏ bản đồ">
        <Minus size={17} aria-hidden="true" />
      </button>
      <button type="button" className={cn(buttonClassName)} onClick={onFit} title="Hiện toàn bộ" aria-label={fitLabel}>
        <Scan size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
