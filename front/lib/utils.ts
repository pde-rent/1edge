import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export from common utils to avoid duplication
export {
  roundSig,
  formatNumber,
  formatDuration,
  formatTimestamp as formatDateTime,
  percentChange,
  truncateAddress,
} from "@common/utils";

// Import roundSig for local use
import { roundSig } from "@common/utils";

/**
 * Format percentage with sign
 */
export function formatPercent(num: number): string {
  return `${num >= 0 ? "+" : ""}${roundSig(num, 6)}%`;
}

/**
 * Format price with 6 significant digits
 */
export function formatPrice(price: number): string {
  return roundSig(price, 6).toString();
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
    case "running":
    case "filled":
    case "up":
      return "text-primary";
    case "pending":
    case "paused":
    case "partially_filled":
      return "text-yellow-600 dark:text-yellow-400";
    case "cancelled":
    case "stopped":
    case "failed":
    case "down":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
}

export function getStatusBadgeClass(status: string): string {
  const baseClass = "status-indicator";
  switch (status.toLowerCase()) {
    case "active":
    case "running":
    case "filled":
    case "up":
      return `${baseClass} status-up`;
    case "cancelled":
    case "stopped":
    case "failed":
    case "down":
      return `${baseClass} status-down`;
    default:
      return `${baseClass} status-unknown`;
  }
}
