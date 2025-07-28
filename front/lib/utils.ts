import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
}

export function formatPercent(num: number): string {
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

export function formatPrice(price: number, decimals: number = 6): string {
  return price.toFixed(decimals);
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
    case "running":
    case "filled":
    case "up":
      return "text-green-600 dark:text-green-400";
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