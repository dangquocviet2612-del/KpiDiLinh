import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type MapLegendProps = Omit<HTMLAttributes<HTMLDivElement>, "aria-label"> & {
  label: string;
  children: ReactNode;
};

export default function MapLegend({ label, children, className, ...props }: MapLegendProps) {
  return (
    <div {...props} className={cn(className)} role="group" aria-label={label}>
      {children}
    </div>
  );
}
