import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BaseSectionProps {
  className?: string;
  children: ReactNode;
  [key: string]: any;
}

/**
 * BaseSection is a styled component for consistent panel layout with dark theme.
 * @param props - BaseSectionProps
 */
export function BaseSection({
  className = "",
  children,
  ...props
}: BaseSectionProps) {
  return (
    <div
      className={cn(
        "h-full w-full flex flex-col overflow-auto",
        "bg-gray-950  border-gray-800 rounded-2xl border-2 border-green-700",
        "shadow-lg shadow-black/20",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * BaseSectionTitle is a styled component for section titles.
 * @param props - React component props
 */
export function BaseSectionTitle({ className = "", ...props }) {
  return (
    <h2
      className={cn(
        "mb-4 pb-2 border-b border-gray-800",
        "text-lg font-medium text-gray-100",
        className,
      )}
      {...props}
    />
  );
}
