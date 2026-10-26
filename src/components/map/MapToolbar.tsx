import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type MapToolbarProps = Omit<HTMLAttributes<HTMLDivElement>, "aria-label"> & {
  label: string;
  children: ReactNode;
};

export default function MapToolbar({ label, children, className, ...props }: MapToolbarProps) {
  return (
    <div {...props} className={cn(className)} role="region" aria-label={label}>
      {children}
    </div>
  );
}
