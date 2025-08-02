#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdir, access } from "fs/promises";
import type { PairSymbol } from "@common/types";
import { logger } from "@back/utils/logger";
import ccxt from "ccxt";

/**
 * OHLC candle data structure
 */
export interface OHLCCandle {
  timestamp: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Supported OHLC timeframes with their duration in seconds
 */
export enum OHLCTimeframe {
  S5 = 5, // 5 seconds (cache only)
  S20 = 20, // 20 seconds (cache only)
  M1 = 60, // 1 minute (stored)
  M5 = 300, // 5 minutes (stored)
  M30 = 1800, // 30 minutes (stored)
}

/**
 * OHLC computation state for a timeframe
 */
interface OHLCState {
  currentCandle: OHLCCandle | null;
  lastSaveTimestamp: number;
}

/**
 * Cache entry for short timeframes
 */
interface CacheEntry {
  candles: OHLCCandle[];
  maxSize: number;
}

/**
 * Historical data requirements
 */
const HISTORICAL_DATA_REQUIREMENTS = {
  MIN_DAYS: 7, // Minimum 1 week of data
  FILL_DAYS: 14, // Fill with 2 weeks of data when missing
};

/**
 * OHLC Storage Service
 * Manages per-pair SQLite databases with timeframe-specific tables
 * Handles real-time OHLC computation, caching, and historical data filling
 */
export class OHLCStorageService {
  private databases: Map<string, Database> = new Map();
  private ohlcStates: Map<string, Map<OHLCTimeframe, OHLCState>> = new Map();
  private cacheStorage: Map<string, Map<OHLCTimeframe, CacheEntry>> = new Map();
  private saveQueues: Map<string, Map<OHLCTimeframe, OHLCCandle[]>> = new Map();
  private isSaving: Map<string, Set<OHLCTimeframe>> = new Map();
  private ccxtExchange: ccxt.binance;

  // Stored timeframes (saved to disk)
  private readonly STORED_TIMEFRAMES = [
    OHLCTimeframe.M1,
    OHLCTimeframe.M5,
    OHLCTimeframe.M30,
  ];

  // Cached timeframes (kept in memory only)
  private readonly CACHED_TIMEFRAMES = [OHLCTimeframe.S5, OHLCTimeframe.S20];

  // Cache size limits
  private readonly CACHE_LIMITS = {
    [OHLCTimeframe.S5]: 720, // 1 hour of 5s candles
    [OHLCTimeframe.S20]: 180, // 1 hour of 20s candles
  };

  constructor(private dataDir: string = "./data/ohlc") {
    this.ccxtExchange = new ccxt.binance({
      sandbox: false,
      enableRateLimit: true,
    });
  }

  /**
   * Initialize the OHLC storage service
   */
  async initialize(): Promise<void> {
    // Create data directory
    await mkdir(this.dataDir, { recursive: true });

    logger.info("OHLC Storage Service initialized");
  }

  /**
   * Get or create database for a trading pair
   */
  private async getDatabase(pair: string): Promise<Database> {
    if (this.databases.has(pair)) {
      return this.databases.get(pair)!;
    }

    const dbPath = join(this.dataDir, `${pair}.db`);
    const db = new Database(dbPath);

    // Create tables for each stored timeframe
    for (const timeframe of this.STORED_TIMEFRAMES) {
      const tableName = this.getTableName(timeframe);
      db.run(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          timestamp INTEGER PRIMARY KEY,
          open REAL NOT NULL,
          high REAL NOT NULL,
          low REAL NOT NULL,
          close REAL NOT NULL,
          volume REAL NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )
      `);

      // Create index for timestamp queries
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_${tableName}_timestamp
        ON ${tableName}(timestamp)
      `);
    }

    this.databases.set(pair, db);
    logger.debug(`Created/opened database for pair: ${pair}`);

    return db;
  }

  /**
   * Get table name for timeframe
   */
  private getTableName(timeframe: OHLCTimeframe): string {
    const names = {
      [OHLCTimeframe.M1]: "candles_1m",
      [OHLCTimeframe.M5]: "candles_5m",
      [OHLCTimeframe.M30]: "candles_30m",
    };
    return names[timeframe];
  }

  /**
   * Get pair name from symbol (extract the base/quote pair)
   */
  private getPairFromSymbol(symbol: PairSymbol): string {
    // Extract pair from symbol like "binance:spot:BTCUSDT" -> "BTCUSDT"
    const parts = symbol.split(":");
    return parts[parts.length - 1];
  }

  /**
   * Convert internal symbol format to CCXT format
   * "binance:spot:BTCUSDT" -> "BTC/USDT"
   */
  private getCCXTSymbol(symbol: PairSymbol): string {
    const pair = this.getPairFromSymbol(symbol);

    // Convert common pairs to CCXT format with slash
    const pairMappings: Record<string, string> = {
      BTCUSDT: "BTC/USDT",
      ETHUSDT: "ETH/USDT",
      USDCUSDT: "USDC/USDT",
      "1INCHUSDT": "1INCH/USDT",
      AAVEUSDT: "AAVE/USDT",
    };

    return pairMappings[pair] || pair;
  }

  /**
   * Process real-time price update and compute OHLC candles
   */
  async processPriceUpdate(
    symbol: PairSymbol,
    price: number,
    volume: number = 0,
  ): Promise<void> {
    const pair = this.getPairFromSymbol(symbol);
    const timestamp = Date.now();

    // Initialize states if needed
    if (!this.ohlcStates.has(pair)) {
      this.ohlcStates.set(pair, new Map());
      this.cacheStorage.set(pair, new Map());
      this.saveQueues.set(pair, new Map());
      this.isSaving.set(pair, new Set());

      // Initialize cache for cached timeframes
      for (const tf of this.CACHED_TIMEFRAMES) {
        this.cacheStorage.get(pair)!.set(tf, {
          candles: [],
          maxSize: this.CACHE_LIMITS[tf],
        });
        this.saveQueues.get(pair)!.set(tf, []);
      }

      // Initialize save queues for stored timeframes
      for (const tf of this.STORED_TIMEFRAMES) {
        this.saveQueues.get(pair)!.set(tf, []);
      }
    }

    const pairStates = this.ohlcStates.get(pair)!;
    const pairCache = this.cacheStorage.get(pair)!;

    // Process all timeframes
    const allTimeframes = [
      ...this.STORED_TIMEFRAMES,
      ...this.CACHED_TIMEFRAMES,
    ];

    for (const timeframe of allTimeframes) {
      await this.processTimeframeUpdate(
        pair,
        timeframe,
        timestamp,
        price,
        volume,
        pairStates,
        pairCache,
      );
    }
  }

  /**
   * Process price update for a specific timeframe
   */
  private async processTimeframeUpdate(
    pair: string,
    timeframe: OHLCTimeframe,
    timestamp: number,
    price: number,
    volume: number,
    pairStates: Map<OHLCTimeframe, OHLCState>,
    pairCache: Map<OHLCTimeframe, CacheEntry>,
  ): Promise<void> {
    const timeframeMs = timeframe * 1000;
    const candleStartTime = Math.floor(timestamp / timeframeMs) * timeframeMs;

    if (!pairStates.has(timeframe)) {
      pairStates.set(timeframe, {
        currentCandle: null,
        lastSaveTimestamp: 0,
      });
    }

    const state = pairStates.get(timeframe)!;

    // Check if we need to close the current candle and start a new one
    if (
      !state.currentCandle ||
      state.currentCandle.timestamp !== candleStartTime
    ) {
      // Save the completed candle if it exists
      if (state.currentCandle) {
        await this.saveCandle(pair, timeframe, state.currentCandle, pairCache);
      }

      // Start new candle
      state.currentCandle = {
        timestamp: candleStartTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volume,
      };
    } else {
      // Update current candle
      state.currentCandle.high = Math.max(state.currentCandle.high, price);
      state.currentCandle.low = Math.min(state.currentCandle.low, price);
      state.currentCandle.close = price;
      state.currentCandle.volume += volume;
    }
  }

  /**
   * Save completed candle to appropriate storage (database or cache)
   */
  private async saveCandle(
    pair: string,
    timeframe: OHLCTimeframe,
    candle: OHLCCandle,
    pairCache: Map<OHLCTimeframe, CacheEntry>,
  ): Promise<void> {
    if (this.CACHED_TIMEFRAMES.includes(timeframe)) {
      // Save to cache
      const cache = pairCache.get(timeframe)!;
      cache.candles.push(candle);

      // Maintain cache size limit
      if (cache.candles.length > cache.maxSize) {
        cache.candles.shift(); // Remove oldest candle
      }
    } else {
      // Queue for database save (async)
      const saveQueues = this.saveQueues.get(pair)!;
      saveQueues.get(timeframe)!.push(candle);

      // Trigger async save (non-blocking)
      setImmediate(() => this.flushSaveQueue(pair, timeframe));
    }
  }

  /**
   * Flush save queue for a specific pair and timeframe (async, non-blocking)
   */
  private async flushSaveQueue(
    pair: string,
    timeframe: OHLCTimeframe,
  ): Promise<void> {
    const savingSet = this.isSaving.get(pair)!;

    // Prevent concurrent saves for the same pair/timeframe
    if (savingSet.has(timeframe)) {
      return;
    }

    savingSet.add(timeframe);

    try {
      const saveQueues = this.saveQueues.get(pair)!;
      const queue = saveQueues.get(timeframe)!;

      if (queue.length === 0) {
        return;
      }

      // Move candles to save and clear queue
      const candlesToSave = [...queue];
      queue.length = 0;

      const db = await this.getDatabase(pair);
      const tableName = this.getTableName(timeframe);

      // Batch insert for better performance
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO ${tableName} (timestamp, open, high, low, close, volume)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      db.transaction(() => {
        for (const candle of candlesToSave) {
          stmt.run(
            candle.timestamp,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
          );
        }
      })();

      logger.debug(
        `Saved ${candlesToSave.length} ${timeframe}s candles for ${pair}`,
      );
    } catch (error) {
      logger.error(
        `Failed to save OHLC candles for ${pair}:${timeframe}:`,
        error,
      );
    } finally {
      savingSet.delete(timeframe);
    }
  }

  /**
   * Get OHLC candles for a pair and timeframe
   */
  async getCandles(
    symbol: PairSymbol,
    timeframe: OHLCTimeframe,
    startTime?: number,
    endTime?: number,
    limit?: number,
  ): Promise<OHLCCandle[]> {
    const pair = this.getPairFromSymbol(symbol);

    if (this.CACHED_TIMEFRAMES.includes(timeframe)) {
      // Get from cache
      const pairCache = this.cacheStorage.get(pair);
      if (!pairCache) return [];

      const cache = pairCache.get(timeframe);
      if (!cache) return [];

      let candles = [...cache.candles];

      // Apply filters
      if (startTime) {
        candles = candles.filter((c) => c.timestamp >= startTime);
      }
      if (endTime) {
        candles = candles.filter((c) => c.timestamp <= endTime);
      }
      if (limit) {
        candles = candles.slice(-limit); // Get most recent
      }

      return candles;
    } else {
      // Get from database
      const db = await this.getDatabase(pair);
      const tableName = this.getTableName(timeframe);

      let query = `SELECT * FROM ${tableName}`;
      const params: any[] = [];
      const conditions: string[] = [];

      if (startTime) {
        conditions.push("timestamp >= ?");
        params.push(startTime);
      }
      if (endTime) {
        conditions.push("timestamp <= ?");
        params.push(endTime);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " ORDER BY timestamp DESC";

      if (limit) {
        query += " LIMIT ?";
        params.push(limit);
      }

      const stmt = db.prepare(query);
      const results = stmt.all(...params) as any[];

      return results
        .map((row) => ({
          timestamp: row.timestamp,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume,
        }))
        .reverse(); // Return in ascending order
    }
  }

  /**
   * Run sanity check on historical data and fill gaps if needed
   */
  async runDataSanityCheck(symbols: PairSymbol[]): Promise<void> {
    logger.info("Running OHLC data sanity check...");

    const now = Date.now();
    const minRequiredTime =
      now - HISTORICAL_DATA_REQUIREMENTS.MIN_DAYS * 24 * 60 * 60 * 1000;

    for (const symbol of symbols) {
      const pair = this.getPairFromSymbol(symbol);

      // Only check 1-minute data - we'll construct higher timeframes from it
      try {
        const existingCandles = await this.getCandles(
          symbol,
          OHLCTimeframe.M1,
          minRequiredTime,
        );

        if (
          existingCandles.length === 0 ||
          existingCandles[0].timestamp > minRequiredTime
        ) {
          logger.info(
            `Missing historical data for ${pair}:${OHLCTimeframe.M1}s, filling gaps...`,
          );
          await this.fillHistoricalData(symbol, OHLCTimeframe.M1);
        } else {
          logger.debug(`Historical data OK for ${pair}:${OHLCTimeframe.M1}s`);
        }
      } catch (error) {
        logger.error(
          `Failed to check data for ${pair}:${OHLCTimeframe.M1}s:`,
          error,
        );
      }
    }

    logger.info("OHLC data sanity check completed");
  }

  /**
   * Fill historical data using CCXT from Binance
   */
  private async fillHistoricalData(
    symbol: PairSymbol,
    timeframe: OHLCTimeframe,
  ): Promise<void> {
    const pair = this.getPairFromSymbol(symbol);

    // Only fetch 1-minute data; higher timeframes will be constructed from it
    if (timeframe !== OHLCTimeframe.M1) {
      logger.warn(
        `fillHistoricalData should only be called with M1 timeframe, got ${timeframe}s`,
      );
      return;
    }

    try {
      // Convert to CCXT timeframe format (1m)
      const ccxtTimeframe = this.getCCXTTimeframe(timeframe);
      if (!ccxtTimeframe) {
        logger.warn(`Unsupported timeframe for historical fill: ${timeframe}s`);
        return;
      }

      const now = Date.now();
      const startTime =
        now - HISTORICAL_DATA_REQUIREMENTS.FILL_DAYS * 24 * 60 * 60 * 1000;

      logger.info(
        `Fetching ${HISTORICAL_DATA_REQUIREMENTS.FILL_DAYS} days of ${timeframe}s data for ${pair}...`,
      );

      // Convert to CCXT symbol format and fetch historical data
      const ccxtSymbol = this.getCCXTSymbol(symbol);
      const ohlcvData = await this.fetchHistoricalDataBatch(
        ccxtSymbol,
        ccxtTimeframe,
        startTime,
        now,
      );

      if (ohlcvData.length === 0) {
        logger.warn(`No historical data available for ${pair}`);
        return;
      }

      // Convert CCXT format to our format
      const candles: OHLCCandle[] = ohlcvData.map(
        ([timestamp, open, high, low, close, volume]) => ({
          timestamp,
          open,
          high,
          low,
          close,
          volume: volume || 0,
        }),
      );

      // Save to database
      const db = await this.getDatabase(pair);
      const tableName = this.getTableName(timeframe);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO ${tableName} (timestamp, open, high, low, close, volume)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      db.transaction(() => {
        for (const candle of candles) {
          stmt.run(
            candle.timestamp,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
          );
        }
      })();

      // Always construct higher timeframes from 1-minute data
      if (timeframe === OHLCTimeframe.M1) {
        await this.constructHigherTimeframes(pair, candles);
      }

      logger.info(
        `Filled ${candles.length} historical candles for ${pair}:${timeframe}s`,
      );
    } catch (error) {
      logger.error(
        `Failed to fill historical data for ${pair}:${timeframe}s:`,
        error,
      );
    }
  }

  /**
   * Fetch historical data in batches with rate limiting
   * Binance API limits to 1000 candles per request, so we need to paginate
   */
  private async fetchHistoricalDataBatch(
    ccxtSymbol: string,
    ccxtTimeframe: string,
    startTime: number,
    endTime: number,
  ): Promise<any[]> {
    const allData: any[] = [];
    const batchSize = 1000; // Binance API limit - ensure we use exactly 1000
    const rateLimitDelay = 250; // 250ms between requests to avoid rate limiting

    let currentStartTime = startTime;
    let batchCount = 0;

    logger.info(
      `Starting batch fetch for ${ccxtSymbol} from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`,
    );

    while (currentStartTime < endTime) {
      try {
        batchCount++;
        logger.debug(
          `Fetching batch ${batchCount} for ${ccxtSymbol} starting from ${new Date(currentStartTime).toISOString()}`,
        );

        // Use CCXT symbol format and ensure limit is exactly 1000
        const batchData = await this.ccxtExchange.fetchOHLCV(
          ccxtSymbol,
          ccxtTimeframe,
          currentStartTime,
          batchSize,
        );

        if (batchData.length === 0) {
          logger.debug(
            `No more data available for ${ccxtSymbol} at ${new Date(currentStartTime).toISOString()}`,
          );
          break;
        }

        // Add to our collection
        allData.push(...batchData);

        // Update start time for next batch (last candle timestamp + 1 timeframe interval)
        const lastCandle = batchData[batchData.length - 1];
        const timeframeMs = this.getTimeframeInMilliseconds(ccxtTimeframe);
        currentStartTime = lastCandle[0] + timeframeMs;

        logger.debug(
          `Fetched ${batchData.length} candles for ${ccxtSymbol}, total: ${allData.length}`,
        );

        // If we got less than the batch size, we've reached the end
        if (batchData.length < batchSize) {
          logger.debug(
            `Received partial batch (${batchData.length}/${batchSize}), assuming end of data`,
          );
          break;
        }

        // Rate limiting - wait between requests
        if (currentStartTime < endTime) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));
        }
      } catch (error) {
        logger.error(
          `Error fetching batch ${batchCount} for ${ccxtSymbol}:`,
          error,
        );
        // Wait longer on error then continue
        await new Promise((resolve) => setTimeout(resolve, rateLimitDelay * 2));

        // If we have some data, continue; otherwise abort
        if (allData.length === 0) {
          throw error;
        }
        break;
      }
    }

    logger.info(
      `Completed batch fetch for ${ccxtSymbol}: ${allData.length} candles in ${batchCount} batches`,
    );
    return allData;
  }

  /**
   * Convert CCXT timeframe string to milliseconds
   */
  private getTimeframeInMilliseconds(ccxtTimeframe: string): number {
    const timeframeMap: Record<string, number> = {
      "1m": 60 * 1000,
      "5m": 5 * 60 * 1000,
      "30m": 30 * 60 * 1000,
    };
    return timeframeMap[ccxtTimeframe] || 60 * 1000; // default to 1 minute
  }

  /**
   * Construct higher timeframe data from M1 data
   */
  private async constructHigherTimeframes(
    pair: string,
    m1Candles: OHLCCandle[],
  ): Promise<void> {
    const higherTimeframes = [OHLCTimeframe.M5, OHLCTimeframe.M30];

    for (const timeframe of higherTimeframes) {
      const constructedCandles = this.constructFromM1(m1Candles, timeframe);

      if (constructedCandles.length > 0) {
        const db = await this.getDatabase(pair);
        const tableName = this.getTableName(timeframe);

        const stmt = db.prepare(`
          INSERT OR REPLACE INTO ${tableName} (timestamp, open, high, low, close, volume)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        db.transaction(() => {
          for (const candle of constructedCandles) {
            stmt.run(
              candle.timestamp,
              candle.open,
              candle.high,
              candle.low,
              candle.close,
              candle.volume,
            );
          }
        })();

        logger.debug(
          `Constructed ${constructedCandles.length} ${timeframe}s candles from M1 data`,
        );
      }
    }
  }

  /**
   * Construct higher timeframe candles from M1 candles
   */
  private constructFromM1(
    m1Candles: OHLCCandle[],
    targetTimeframe: OHLCTimeframe,
  ): OHLCCandle[] {
    const timeframeMs = targetTimeframe * 1000;
    const constructedCandles: OHLCCandle[] = [];

    // Group M1 candles by target timeframe
    const groups = new Map<number, OHLCCandle[]>();

    for (const candle of m1Candles) {
      const groupKey = Math.floor(candle.timestamp / timeframeMs) * timeframeMs;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(candle);
    }

    // Construct candles from groups
    for (const [timestamp, candles] of groups) {
      if (candles.length === 0) continue;

      candles.sort((a, b) => a.timestamp - b.timestamp);

      const constructedCandle: OHLCCandle = {
        timestamp,
        open: candles[0].open,
        high: Math.max(...candles.map((c) => c.high)),
        low: Math.min(...candles.map((c) => c.low)),
        close: candles[candles.length - 1].close,
        volume: candles.reduce((sum, c) => sum + c.volume, 0),
      };

      constructedCandles.push(constructedCandle);
    }

    return constructedCandles.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Convert our timeframe to CCXT timeframe format
   */
  private getCCXTTimeframe(timeframe: OHLCTimeframe): string | null {
    const mapping = {
      [OHLCTimeframe.M1]: "1m",
      [OHLCTimeframe.M5]: "5m",
      [OHLCTimeframe.M30]: "30m",
    };
    return mapping[timeframe] || null;
  }

  /**
   * Get statistics about stored data
   */
  async getDataStats(symbol: PairSymbol): Promise<Record<string, any>> {
    const pair = this.getPairFromSymbol(symbol);
    const stats: Record<string, any> = {};

    // Database stats
    for (const timeframe of this.STORED_TIMEFRAMES) {
      try {
        const candles = await this.getCandles(
          symbol,
          timeframe,
          undefined,
          undefined,
          1,
        );
        const db = await this.getDatabase(pair);
        const tableName = this.getTableName(timeframe);

        const countResult = db
          .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
          .get() as { count: number };
        const oldestResult = db
          .prepare(`SELECT MIN(timestamp) as oldest FROM ${tableName}`)
          .get() as { oldest: number };
        const newestResult = db
          .prepare(`SELECT MAX(timestamp) as newest FROM ${tableName}`)
          .get() as { newest: number };

        stats[`${timeframe}s`] = {
          count: countResult.count,
          oldest: oldestResult.oldest
            ? new Date(oldestResult.oldest).toISOString()
            : null,
          newest: newestResult.newest
            ? new Date(newestResult.newest).toISOString()
            : null,
        };
      } catch (error) {
        stats[`${timeframe}s`] = { error: error.message };
      }
    }

    // Cache stats
    const pairCache = this.cacheStorage.get(pair);
    if (pairCache) {
      for (const timeframe of this.CACHED_TIMEFRAMES) {
        const cache = pairCache.get(timeframe);
        if (cache) {
          stats[`${timeframe}s_cache`] = {
            count: cache.candles.length,
            maxSize: cache.maxSize,
          };
        }
      }
    }

    return stats;
  }

  /**
   * Close all databases and cleanup
   */
  async shutdown(): Promise<void> {
    // Flush all pending saves
    const flushPromises: Promise<void>[] = [];

    for (const [pair, saveQueues] of this.saveQueues) {
      for (const timeframe of this.STORED_TIMEFRAMES) {
        flushPromises.push(this.flushSaveQueue(pair, timeframe));
      }
    }

    await Promise.all(flushPromises);

    // Close all databases
    for (const [pair, db] of this.databases) {
      try {
        db.close();
        logger.debug(`Closed database for pair: ${pair}`);
      } catch (error) {
        logger.error(`Failed to close database for ${pair}:`, error);
      }
    }

    this.databases.clear();
    this.ohlcStates.clear();
    this.cacheStorage.clear();
    this.saveQueues.clear();
    this.isSaving.clear();

    logger.info("OHLC Storage Service shutdown completed");
  }
}

// Export singleton instance
let ohlcStorageInstance: OHLCStorageService | null = null;

export function initOHLCStorage(dataDir?: string): OHLCStorageService {
  if (!ohlcStorageInstance) {
    ohlcStorageInstance = new OHLCStorageService(dataDir);
  }
  return ohlcStorageInstance;
}

export function getOHLCStorage(): OHLCStorageService {
  if (!ohlcStorageInstance) {
    throw new Error(
      "OHLC Storage not initialized. Call initOHLCStorage first.",
    );
  }
  return ohlcStorageInstance;
}
