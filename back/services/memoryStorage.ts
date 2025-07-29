/**
 * In-memory storage service to replace SQLite for real-time data
 * This matches bet-bot's Redis approach but uses simple in-memory storage
 */

import type { TickerFeed, AggregatedTicker, Symbol } from "@common/types";
import { logger } from "@back/utils/logger";

class MemoryStorage {
  private tickers: Map<Symbol, TickerFeed | AggregatedTicker> = new Map();
  private ttls: Map<Symbol, number> = new Map();

  // Clean up expired entries every 30 seconds
  constructor() {
    setInterval(() => this.cleanup(), 30000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [symbol, expiry] of this.ttls) {
      if (expiry < now) {
        this.tickers.delete(symbol);
        this.ttls.delete(symbol);
      }
    }
  }

  cacheTicker(
    symbol: Symbol,
    ticker: TickerFeed | AggregatedTicker,
    ttlSeconds = 300,
  ) {
    this.tickers.set(symbol, ticker);
    this.ttls.set(symbol, Date.now() + ttlSeconds * 1000);
    logger.debug(`Cached ticker ${symbol} with TTL ${ttlSeconds}s`);
  }

  getCachedTicker(symbol: Symbol): (TickerFeed | AggregatedTicker) | null {
    const expiry = this.ttls.get(symbol);
    if (expiry && expiry < Date.now()) {
      // Expired
      this.tickers.delete(symbol);
      this.ttls.delete(symbol);
      return null;
    }
    return this.tickers.get(symbol) || null;
  }

  getActiveTickers(): Record<Symbol, TickerFeed | AggregatedTicker> {
    const result: Record<Symbol, TickerFeed | AggregatedTicker> = {};
    const now = Date.now();

    for (const [symbol, ticker] of this.tickers) {
      const expiry = this.ttls.get(symbol);
      if (!expiry || expiry >= now) {
        result[symbol] = ticker;
      }
    }

    return result;
  }

  clear() {
    this.tickers.clear();
    this.ttls.clear();
  }
}

// Single instance
const memoryStorage = new MemoryStorage();

// Export functions that match the existing storage interface
export const cacheTicker = (
  symbol: Symbol,
  ticker: TickerFeed | AggregatedTicker,
  ttlSeconds = 300,
) => {
  memoryStorage.cacheTicker(symbol, ticker, ttlSeconds);
};

export const getCachedTicker = (
  symbol: Symbol,
): (TickerFeed | AggregatedTicker) | null => {
  return memoryStorage.getCachedTicker(symbol);
};

export const getActiveTickers = (): Record<
  Symbol,
  TickerFeed | AggregatedTicker
> => {
  return memoryStorage.getActiveTickers();
};
