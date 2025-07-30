import { TIME } from "./constants";

/**
 * Sleep for a given number of milliseconds
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Format a number with significant digits
 */
export function roundSig(num: number, sig: number): number {
  if (num === 0) return 0;
  const mult = Math.pow(10, sig - Math.floor(Math.log10(Math.abs(num))) - 1);
  return Math.round(num * mult) / mult;
}

/**
 * Format a large number with K, M, B suffixes
 */
export function formatNumber(num: number): string {
  if (Math.abs(num) >= 1e9) return `${roundSig(num / 1e9, 3)}B`;
  if (Math.abs(num) >= 1e6) return `${roundSig(num / 1e6, 3)}M`;
  if (Math.abs(num) >= 1e3) return `${roundSig(num / 1e3, 3)}K`;
  return roundSig(num, 4).toString();
}

/**
 * Parse a symbol string into components
 */
export function parseSymbol(
  symbol: string,
): { exchange: string; type?: string; pair: string } | null {
  const parts = symbol.split(":");
  if (parts.length === 3) {
    return {
      exchange: parts[0],
      type: parts[1],
      pair: parts[2],
    };
  } else if (parts.length === 2) {
    return {
      exchange: parts[0],
      pair: parts[1],
    };
  }
  return null;
}

/**
 * Create a symbol string from components
 */
export function createSymbol(
  exchange: string,
  pair: string,
  type?: string,
): string {
  return type ? `${exchange}:${type}:${pair}` : `${exchange}:${pair}`;
}

/**
 * Convert between different time units
 */
export function toSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

export function toMilliseconds(seconds: number): number {
  return seconds * 1000;
}

/**
 * Format a timestamp to a readable date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Calculate percentage change
 */
export function percentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge deep partial objects
 */
export function mergeDeep<T extends object>(target: T, source: Partial<T>): T {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key as keyof T];
      const targetValue = target[key as keyof T];

      if (isObject(sourceValue)) {
        if (!(key in target)) {
          Object.assign(output, { [key]: sourceValue });
        } else if (isObject(targetValue)) {
          (output as any)[key] = mergeDeep(
            targetValue as any,
            sourceValue as any,
          );
        }
      } else {
        Object.assign(output, { [key]: sourceValue });
      }
    });
  }
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === "object" && !Array.isArray(item);
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    factor?: number;
    maxDelay?: number;
  } = {},
): Promise<T> {
  const { attempts = 3, delay = 1000, factor = 2, maxDelay = 30000 } = options;

  let lastError: Error;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < attempts - 1) {
        const waitTime = Math.min(delay * Math.pow(factor, i), maxDelay);
        await sleep(waitTime);
      }
    }
  }

  throw lastError!;
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Calculate moving average
 */
export function movingAverage(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = values
        .slice(i - period + 1, i + 1)
        .reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * Calculate exponential moving average
 */
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[0]);
    } else {
      result.push(values[i] * k + result[i - 1] * (1 - k));
    }
  }

  return result;
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: string, decimals: number): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const quotient = BigInt(amount) / divisor;
  const remainder = BigInt(amount) % divisor;

  const quotientStr = quotient.toString();
  const remainderStr = remainder.toString().padStart(decimals, "0");

  // Remove trailing zeros
  const trimmedRemainder = remainderStr.replace(/0+$/, "");

  return trimmedRemainder ? `${quotientStr}.${trimmedRemainder}` : quotientStr;
}

/**
 * Parse token amount to smallest unit
 */
export function parseTokenAmount(amount: string, decimals: number): string {
  const [whole, fraction = ""] = amount.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + paddedFraction).toString();
}

/**
 * Calculate price impact
 */
export function calculatePriceImpact(
  currentPrice: number,
  executionPrice: number,
): number {
  return Math.abs(percentChange(currentPrice, executionPrice));
}

/**
 * Check if a value is within a percentage range
 */
export function isWithinRange(
  value: number,
  target: number,
  percentRange: number,
): boolean {
  const diff = Math.abs(value - target);
  const threshold = target * (percentRange / 100);
  return diff <= threshold;
}

/**
 * Get current timestamp in seconds
 */
export function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Check if timestamp is expired
 */
export function isExpired(timestamp: number): boolean {
  return timestamp < now();
}

/**
 * Format time duration
 */
export function formatDuration(ms: number): string {
  if (ms < TIME.MINUTE) return `${Math.round(ms / 1000)}s`;
  if (ms < TIME.HOUR) return `${Math.round(ms / TIME.MINUTE)}m`;
  if (ms < TIME.DAY) return `${Math.round(ms / TIME.HOUR)}h`;
  return `${Math.round(ms / TIME.DAY)}d`;
}

/**
 * Truncate an address for display
 */
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
}
