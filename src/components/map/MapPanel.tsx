import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type MapPanelProps = HTMLAttributes<HTMLDivElement> & {
  labelledBy: string;
  children: ReactNode;
};

const MapPanel = forwardRef<HTMLDivElement, MapPanelProps>(function MapPanel(
  { labelledBy, children, className, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={cn(className)}
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelledBy}
    >
      {children}
    </div>
  );
});

export default MapPanel;
