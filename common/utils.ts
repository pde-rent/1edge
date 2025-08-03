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
 * Comprehensive symbol parsing utilities
 */

/**
 * Parse a symbol string into components
 * Handles formats like: "exchange:type:pair", "exchange:pair", "pair"
 */
export function parseSymbol(
  symbol: string,
): { exchange: string; type?: string; pair: string } | null {
  if (!symbol) return null;

  const parts = symbol.split(":");
  if (parts.length === 3) {
    return {
      exchange: parts[0],
      type: parts[1] === "undefined" ? undefined : parts[1],
      pair: parts[2],
    };
  } else if (parts.length === 2) {
    return {
      exchange: parts[0],
      pair: parts[1],
    };
  } else if (parts.length === 1) {
    // Single part - treat as pair only
    return {
      exchange: "",
      pair: parts[0],
    };
  }
  return null;
}

/**
 * Enhanced feed symbol parser for frontend components
 * Returns parsed components including base/quote token extraction
 */
export function parseFeedSymbol(symbol: string): {
  main: string;
  tags: string[];
  base: string;
  quote: string;
  exchange?: string;
  type?: string;
} {
  if (!symbol) return { main: "N/A", tags: [], base: "", quote: "" };

  const parts = symbol.split(":");
  let main: string;
  let tags: string[];
  let exchange: string | undefined;
  let type: string | undefined;

  if (parts.length === 3) {
    // e.g., agg:spot:BTCUSD -> main: BTCUSD, tags: [agg, spot]
    [exchange, type, main] = parts;
    tags = [exchange, type];
  } else if (parts.length === 2) {
    // e.g., binance:BTCUSDT -> main: BTCUSDT, tags: [binance]
    [exchange, main] = parts;
    tags = [exchange];
  } else if (parts.length === 1 && parts[0].includes("-")) {
    // e.g., BTC-USD -> main: BTC-USD, tags: []
    main = parts[0];
    tags = [];
  } else {
    // Default fallback
    main = symbol;
    tags = [];
  }

  // Extract base and quote tokens from main symbol
  const { base, quote } = extractBaseQuote(main);

  return { main, tags, base, quote, exchange, type };
}

/**
 * Extract base and quote tokens from a trading pair string
 * Handles formats like "BTCUSDT", "BTC-USD", "ETHUSDC"
 */
export function extractBaseQuote(pair: string): {
  base: string;
  quote: string;
} {
  if (!pair) return { base: "", quote: "" };

  if (pair.includes("-")) {
    // Format: BTC-USD
    const tokenParts = pair.split("-");
    return {
      base: tokenParts[0] || "",
      quote: tokenParts[1] || "",
    };
  } else {
    // Format: BTCUSDT, ETHUSDC, etc.
    // Common quote currencies to try matching (in order of priority)
    const commonQuotes = ["USDT", "USDC", "USD", "WETH", "WBTC", "BTC", "ETH"];

    for (const commonQuote of commonQuotes) {
      if (pair.endsWith(commonQuote)) {
        const base = pair.slice(0, -commonQuote.length);
        if (base.length > 0) {
          return { base, quote: commonQuote };
        }
      }
    }

    // Fallback if no common quote found
    if (pair.length > 3) {
      if (pair.length > 6) {
        // Assume last 4 chars are quote for longer symbols
        return {
          base: pair.slice(0, -4),
          quote: pair.slice(-4),
        };
      } else {
        // Assume last 3 chars are quote for shorter symbols
        return {
          base: pair.slice(0, -3),
          quote: pair.slice(-3),
        };
      }
    }
  }

  return { base: pair, quote: "" };
}

/**
 * Trading pair parsing - parse symbol into base and quote tokens
 * @param pairSymbol - Trading pair symbol (e.g., "BTCUSDT", "ETHUSDC")
 * @returns Object with base and quote token symbols
 */
export function parseTradingPair(
  pairSymbol: string,
): { base: string; quote: string } | null {
  // Remove common prefixes/suffixes if they exist
  const cleanSymbol = pairSymbol.replace(/^agg:spot:/, "");
  return extractBaseQuote(cleanSymbol);
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
 * Generate an order ID based on user address and timestamp
 * Returns a 32-character hash using Bun's built-in crypto
 */
export function generateOrderId(userAddress: string): string {
  const timestamp = Date.now().toString();
  const input = timestamp + userAddress.toLowerCase();

  // Use Bun's built-in crypto to create MD5 hash
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(input);
  return hasher.digest("hex");
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
 * Token and price formatting utilities
 */

/**
 * Format price with appropriate precision
 * Uses scientific notation for very small values
 */
export function formatPrice(price: number): string {
  if (price === undefined || price === null) return "-";
  if (price === 0) return "0";

  // Use scientific notation for very small numbers
  if (Math.abs(price) < 0.000001) {
    return price.toExponential(3);
  }

  // Use roundSig for normal numbers
  return roundSig(price, 6).toString();
}

/**
 * Format mid value for display (alias for formatPrice)
 */
export function formatMidValue(value: number | undefined): string {
  if (value === undefined || value === null) return "-";
  return formatPrice(value);
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
 * Address and symbol mapping utilities
 * Note: These require a token mapping config to be passed in
 */

/**
 * Convert asset address to token symbol using provided token mapping
 */
export function addressToSymbol(
  address: string,
  tokenMapping: Record<string, Record<string, string>>,
  chainId: number = 1,
): string {
  const lowercaseAddress = address.toLowerCase();
  const chainStr = chainId.toString();

  for (const [symbol, chains] of Object.entries(tokenMapping)) {
    const chainAddress = chains[chainStr];
    if (chainAddress && chainAddress.toLowerCase() === lowercaseAddress) {
      return symbol;
    }
  }

  return "UNKNOWN";
}

/**
 * Convert token symbol to asset address using provided token mapping
 */
export function symbolToAddress(
  symbol: string,
  tokenMapping: Record<string, Record<string, string>>,
  chainId: number = 1,
): string | undefined {
  const chainStr = chainId.toString();
  const tokenConfig = tokenMapping[symbol];

  if (!tokenConfig) {
    return undefined;
  }

  return tokenConfig[chainStr];
}

/**
 * Create price feed symbol from maker and taker asset addresses
 */
export function getSymbolFromAssets(
  makerAsset: string,
  takerAsset: string,
  tokenMapping: Record<string, Record<string, string>>,
  chainId: number = 1,
): `${string}:${string}:${string}` {
  const makerSymbol = addressToSymbol(makerAsset, tokenMapping, chainId);
  const takerSymbol = addressToSymbol(takerAsset, tokenMapping, chainId);

  return `agg:spot:${makerSymbol}${takerSymbol}`;
}

/**
 * Get display symbol for logging purposes
 */
export function getAssetSymbol(
  assetAddress: string,
  tokenMapping: Record<string, Record<string, string>>,
  chainId: number = 1,
): string {
  return addressToSymbol(assetAddress, tokenMapping, chainId);
}

/**
 * Map symbol for price feeds (WETH -> ETH, WBTC -> BTC for feeds)
 */
export function mapSymbolForFeed(symbol: string): string {
  switch (symbol) {
    case "WETH":
      return "ETH";
    case "WBTC":
      return "BTC";
    default:
      return symbol;
  }
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
  if (!address) return "";
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
}
